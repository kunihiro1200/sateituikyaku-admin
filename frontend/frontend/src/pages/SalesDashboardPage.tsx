/**
 * 売上目標管理ダッシュボード
 *
 * 大分店（物件番号FI除外）の年度売上を管理する。
 * - 実績 : property_listings から決済日がFY内の決済済み物件
 * - 見込み: property_contract_prospects から決済見込み月がFY内かつ専任・公開中の物件
 * - 目標 : sales_targets テーブル（店舗全体・担当者別）
 *
 * ⚠️ 店舗判定は物件番号で行う（FI→福岡店、それ以外→大分店）。担当者の所属店舗では判定しない。
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Chip,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Snackbar,
  Alert,
  LinearProgress,
  Tooltip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { supabase } from '../config/supabase';
import PageNavigation from '../components/PageNavigation';
import { useAuthStore } from '../store/authStore';
import { SECTION_COLORS } from '../theme/sectionColors';

// ============================================================
// 定数
// ============================================================

const FISCAL_YEAR = '2026-2027';
const FY_START_DATE = '2026-10-01';
const FY_END_DATE = '2027-09-30';
const FY_START_MONTH = '2026-10';
const FY_END_MONTH = '2027-09';

/** 年度の全12ヶ月 */
const FY_MONTHS = [
  '2026-10', '2026-11', '2026-12',
  '2027-01', '2027-02', '2027-03',
  '2027-04', '2027-05', '2027-06',
  '2027-07', '2027-08', '2027-09',
];

/** 大分店全体目標のデフォルト（DBに未登録時） */
const DEFAULT_STORE_TARGET = 120_000_000;

/** 売上予測の両手率（初期設定65%） */
const BOTH_HAND_RATE = 0.65;

/** 担当者コードのマッピング */
const STAFF_PATTERNS: Record<string, string[]> = {
  山本: ['山本', '山', 'Y'],
  角井: ['角井', 'I'],
  林田: ['林', '林田'],
  麻生: ['麻生', '麻'],
  裏: ['裏', 'U'],
  国広: ['K', '国広'],
};

const STAFF_LIST = ['山本', '角井', '林田', '麻生', '裏', '国広'];

const PROPERTY_COLOR = SECTION_COLORS.property.main;

// ランク色
const RANK_COLORS: Record<string, string> = {
  A: '#1565c0',
  B: '#2e7d32',
  C: '#e65100',
  D: '#c62828',
};

// ============================================================
// 型定義
// ============================================================

interface SettledProperty {
  property_number: string;
  sales_assignee?: string | null;
  settlement_date?: string | null;
  total_commission?: number | null;
  commission_from_seller?: number | null;
  commission_from_buyer?: number | null;
  price?: number | null;
  address?: string | null;
  display_address?: string | null;
}

interface ActiveListing {
  property_number: string;
  sales_assignee?: string | null;
  price?: number | null;
  commission_from_seller?: number | null;
  address?: string | null;
  display_address?: string | null;
}

interface ProspectRecord {
  property_number: string;
  prospect_rank?: string | null;
  settlement_expected_month?: string | null;
  manager_check_status?: string | null;
}

interface ActiveListingWithProspect extends ActiveListing {
  prospect?: ProspectRecord;
}

interface SalesTarget {
  id?: string;
  fiscal_year: string;
  store_name: string;
  staff_name: string; // '' = 店舗全体
  target_amount: number;
  notes?: string;
}

interface StaffSummary {
  staffName: string;
  actual: number;
  forecast: number;
  projected: number;
  target: number;
  gap: number;
  progressPct: number;
  actualCount: number;
  forecastCount: number;
  settledItems: SettledProperty[];
  forecastItems: ActiveListingWithProspect[];
}

interface MonthSummary {
  month: string;
  actual: number;
  forecast: number;
  actualCount: number;
  forecastCount: number;
}

// ============================================================
// ユーティリティ
// ============================================================

function resolveStaffName(salesAssignee: string | undefined | null): string {
  if (!salesAssignee) return '不明';
  for (const [name, patterns] of Object.entries(STAFF_PATTERNS)) {
    if (patterns.some((p) => salesAssignee.includes(p))) return name;
  }
  return salesAssignee;
}

/**
 * 想定仲介手数料（税込・売主側）
 * commission_from_seller 優先 → 800万以上で計算式 → 未満で33万固定
 */
function calcSellerCommission(
  price?: number | null,
  commissionFromSeller?: number | null
): number {
  if (commissionFromSeller && commissionFromSeller > 0) return commissionFromSeller;
  if (!price || price <= 0) return 0;
  if (price >= 8_000_000) return Math.round((price * 0.03 + 60_000) * 1.1);
  return 330_000;
}

/**
 * 想定売上（両手率65%）
 * = 売主側 × 1.65
 */
function calcExpectedRevenue(sellerCommission: number): number {
  return Math.round(sellerCommission * (BOTH_HAND_RATE * 2 + (1 - BOTH_HAND_RATE)));
}

/**
 * 決済済み物件の実際の売上（税込）
 * total_commission → 売主+買主合計 → 価格から計算 の優先順位
 */
function getActualCommission(p: SettledProperty): number {
  if (p.total_commission && p.total_commission > 0) return p.total_commission;
  const s = p.commission_from_seller ?? 0;
  const b = p.commission_from_buyer ?? 0;
  if (s + b > 0) return s + b;
  // フォールバック：価格から計算
  return calcExpectedRevenue(calcSellerCommission(p.price));
}

function formatPrice(amount: number): string {
  if (amount <= 0) return '-';
  const man = amount / 10_000;
  return `${man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)}万円`;
}

function formatMonth(yyyymm: string): string {
  const [year, month] = yyyymm.split('-');
  return `${year}年${parseInt(month, 10)}月`;
}

function getSettlementMonth(settlementDate: string): string {
  return settlementDate.substring(0, 7);
}

// ============================================================
// メインコンポーネント
// ============================================================

export default function SalesDashboardPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { employee } = useAuthStore();

  // --- データ ---
  const [settled, setSettled] = useState<SettledProperty[]>([]);
  const [listings, setListings] = useState<ActiveListing[]>([]);
  const [prospects, setProspects] = useState<ProspectRecord[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [loading, setLoading] = useState(true);

  // --- 目標編集 ---
  const [editingTarget, setEditingTarget] = useState<string | null>(null); // '' or 'staff_name'
  const [editTargetValue, setEditTargetValue] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  // --- スナックバー ---
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // ============================================================
  // データ取得
  // ============================================================

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 決済済み物件（実績）
      // - FI番号除外（大分店）
      // - 決済日がFY内
      // - 担当者は誰でも大分店として集計
      const { data: settledData, error: e1 } = await supabase
        .from('property_listings')
        .select(
          'property_number, sales_assignee, settlement_date, total_commission, commission_from_seller, commission_from_buyer, price, address, display_address'
        )
        .not('property_number', 'ilike', '%FI%')
        .not('settlement_date', 'is', null)
        .gte('settlement_date', FY_START_DATE)
        .lte('settlement_date', FY_END_DATE)
        .order('settlement_date', { ascending: true });
      if (e1) throw e1;

      // 2. 専任・公開中の物件（見込み計算用）
      const { data: listingsData, error: e2 } = await supabase
        .from('property_listings')
        .select(
          'property_number, sales_assignee, price, commission_from_seller, address, display_address'
        )
        .eq('atbb_status', '専任・公開中')
        .not('property_number', 'ilike', '%FI%');
      if (e2) throw e2;

      // 3. 成約見込みレコード（FY内の月のみ）
      // - 2027年10月以降は大分店FY集計に含めない
      const { data: prospectsData, error: e3 } = await supabase
        .from('property_contract_prospects')
        .select('property_number, prospect_rank, settlement_expected_month, manager_check_status')
        .not('settlement_expected_month', 'is', null)
        .gte('settlement_expected_month', FY_START_MONTH)
        .lte('settlement_expected_month', FY_END_MONTH);
      if (e3) throw e3;

      // 4. 売上目標（大分店・FY）
      const { data: targetsData, error: e4 } = await supabase
        .from('sales_targets')
        .select('*')
        .eq('fiscal_year', FISCAL_YEAR)
        .eq('store_name', '大分店');
      if (e4) {
        // テーブルが存在しない場合はデフォルト値を使用
        console.warn('sales_targets fetch error:', e4);
      }

      setSettled(settledData ?? []);
      setListings(listingsData ?? []);
      setProspects(prospectsData ?? []);
      setTargets(targetsData ?? []);
    } catch (err) {
      console.error('データ取得エラー:', err);
      setSnackbar({ open: true, message: 'データの取得に失敗しました', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================================
  // 計算
  // ============================================================

  /** 物件番号ベースでの見込みマップ */
  const forecastItems = useMemo((): ActiveListingWithProspect[] => {
    const prospectMap = new Map(prospects.map((p) => [p.property_number, p]));
    return listings
      .map((l) => ({ ...l, prospect: prospectMap.get(l.property_number) }))
      .filter((l) => l.prospect?.settlement_expected_month);
  }, [listings, prospects]);

  /** 店舗全体目標（未登録時はデフォルト1.2億） */
  const storeTarget = useMemo(() => {
    const t = targets.find((t) => t.staff_name === '');
    return t?.target_amount ?? DEFAULT_STORE_TARGET;
  }, [targets]);

  /** 担当者別目標を取得 */
  const getStaffTarget = useCallback(
    (staffName: string): number => {
      return targets.find((t) => t.staff_name === staffName)?.target_amount ?? 0;
    },
    [targets]
  );

  /** 担当者別集計 */
  const staffSummaries = useMemo((): StaffSummary[] => {
    return STAFF_LIST.map((staffName) => {
      const patterns = STAFF_PATTERNS[staffName] ?? [];

      const mySettled = settled.filter((p) =>
        patterns.some((pat) => (p.sales_assignee ?? '').includes(pat))
      );
      const actual = mySettled.reduce((sum, p) => sum + getActualCommission(p), 0);

      const myForecast = forecastItems.filter((p) =>
        patterns.some((pat) => (p.sales_assignee ?? '').includes(pat))
      );
      const forecast = myForecast.reduce((sum, p) => {
        const sc = calcSellerCommission(p.price, p.commission_from_seller);
        return sum + calcExpectedRevenue(sc);
      }, 0);

      const target = getStaffTarget(staffName);
      const projected = actual + forecast;
      const gap = target > 0 ? target - projected : 0;
      const progressPct = target > 0 ? Math.min(999, Math.round((projected / target) * 100)) : 0;

      return {
        staffName,
        actual,
        forecast,
        projected,
        target,
        gap,
        progressPct,
        actualCount: mySettled.length,
        forecastCount: myForecast.length,
        settledItems: mySettled,
        forecastItems: myForecast,
      };
    });
  }, [settled, forecastItems, getStaffTarget]);

  /** 店舗全体集計 */
  const storeSummary = useMemo(() => {
    const actual = settled.reduce((sum, p) => sum + getActualCommission(p), 0);
    const forecast = forecastItems.reduce((sum, p) => {
      const sc = calcSellerCommission(p.price, p.commission_from_seller);
      return sum + calcExpectedRevenue(sc);
    }, 0);
    const projected = actual + forecast;
    const gap = storeTarget - projected;
    const progressPct = Math.min(100, Math.round((projected / storeTarget) * 100));
    return {
      actual,
      forecast,
      projected,
      target: storeTarget,
      gap,
      progressPct,
      actualCount: settled.length,
      forecastCount: forecastItems.length,
    };
  }, [settled, forecastItems, storeTarget]);

  /** 月別集計 */
  const monthSummaries = useMemo((): MonthSummary[] => {
    return FY_MONTHS.map((month) => {
      const monthSettled = settled.filter(
        (p) => p.settlement_date && getSettlementMonth(p.settlement_date) === month
      );
      const monthForecast = forecastItems.filter(
        (p) => p.prospect?.settlement_expected_month === month
      );
      return {
        month,
        actual: monthSettled.reduce((sum, p) => sum + getActualCommission(p), 0),
        forecast: monthForecast.reduce((sum, p) => {
          const sc = calcSellerCommission(p.price, p.commission_from_seller);
          return sum + calcExpectedRevenue(sc);
        }, 0),
        actualCount: monthSettled.length,
        forecastCount: monthForecast.length,
      };
    });
  }, [settled, forecastItems]);

  // ============================================================
  // 目標の保存
  // ============================================================

  const handleSaveTarget = async (staffNameKey: string) => {
    if (!employee) return;
    setSavingTarget(true);
    try {
      const man = parseFloat(editTargetValue);
      if (isNaN(man) || man < 0) throw new Error('正の数値を入力してください');
      const amount = Math.round(man * 10_000); // 万円→円

      const upsertData: SalesTarget = {
        fiscal_year: FISCAL_YEAR,
        store_name: '大分店',
        staff_name: staffNameKey,
        target_amount: amount,
        notes: staffNameKey === '' ? '大分店全体目標' : `${staffNameKey}個人目標`,
      };

      const { error } = await supabase
        .from('sales_targets')
        .upsert(upsertData, { onConflict: 'fiscal_year,store_name,staff_name' });

      if (error) throw error;

      // ローカル更新
      setTargets((prev) => {
        const filtered = prev.filter((t) => t.staff_name !== staffNameKey);
        return [...filtered, upsertData];
      });

      setEditingTarget(null);
      setSnackbar({ open: true, message: '目標を保存しました', severity: 'success' });
    } catch (err) {
      console.error('目標保存エラー:', err);
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '目標の保存に失敗しました',
        severity: 'error',
      });
    } finally {
      setSavingTarget(false);
    }
  };

  const startEditTarget = (key: string, currentValue: number) => {
    setEditingTarget(key);
    setEditTargetValue(currentValue > 0 ? (currentValue / 10_000).toString() : '');
  };

  // ============================================================
  // レンダリング
  // ============================================================

  return (
    <Container maxWidth="xl" sx={isMobile ? { px: 1, py: 2 } : { py: 3 }}>
      {/* ─── ページヘッダー ─── */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate('/property-listings')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <AssessmentIcon sx={{ color: PROPERTY_COLOR }} />
        <Typography
          variant={isMobile ? 'subtitle1' : 'h5'}
          fontWeight="bold"
          sx={{ color: PROPERTY_COLOR }}
        >
          売上目標管理
        </Typography>
        <Chip
          label={`大分店 ${FISCAL_YEAR.replace('-', '〜')}年度`}
          size="small"
          sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 500 }}
        />
        <Tooltip title="店舗判定：物件番号にFIを含まない＝大分店（担当者の所属店舗では判定しない）" arrow>
          <Chip
            label="FI除外＝大分店"
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem', color: 'text.secondary', cursor: 'help' }}
          />
        </Tooltip>
        <Box sx={{ ml: 'auto' }}>
          <Tooltip title="データを再読み込み" arrow>
            <IconButton size="small" onClick={fetchData} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <PageNavigation />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* ─── 店舗全体サマリー ─── */}
          <Paper
            sx={{ p: 2.5, mb: 2.5, border: `2px solid ${PROPERTY_COLOR}` }}
            elevation={2}
          >
            {/* タイトルと目標額 */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
              <TrendingUpIcon sx={{ color: PROPERTY_COLOR }} />
              <Typography variant="h6" fontWeight="bold" sx={{ color: PROPERTY_COLOR }}>
                大分店全体　2026年10月〜2027年9月
              </Typography>
              <Divider orientation="vertical" flexItem />
              {editingTarget === '__store__' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <TextField
                    size="small"
                    value={editTargetValue}
                    onChange={(e) => setEditTargetValue(e.target.value)}
                    label="目標（万円）"
                    type="number"
                    sx={{ width: 140 }}
                    inputProps={{ min: 0 }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    disabled={savingTarget}
                    onClick={() => handleSaveTarget('')}
                    startIcon={<SaveIcon />}
                    sx={{ bgcolor: PROPERTY_COLOR }}
                  >
                    保存
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    onClick={() => setEditingTarget(null)}
                    disabled={savingTarget}
                  >
                    取消
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    年度目標：{formatPrice(storeSummary.target)}
                  </Typography>
                  <Tooltip title="目標を編集">
                    <IconButton
                      size="small"
                      onClick={() => startEditTarget('__store__', storeSummary.target)}
                    >
                      <EditIcon sx={{ fontSize: '0.9rem' }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>

            {/* サマリーカード */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              {[
                {
                  label: '決済済み実績',
                  value: storeSummary.actual,
                  sub: `${storeSummary.actualCount}件`,
                  color: '#2e7d32',
                },
                {
                  label: '成約見込み（FY内）',
                  value: storeSummary.forecast,
                  sub: `${storeSummary.forecastCount}件・両手率${Math.round(BOTH_HAND_RATE * 100)}%`,
                  color: '#1565c0',
                },
                {
                  label: '年度末着地予測',
                  value: storeSummary.projected,
                  sub: '実績＋見込み（二重計上なし）',
                  color: '#6a1b9a',
                },
                {
                  label: '年度目標',
                  value: storeSummary.target,
                  sub: '税込',
                  color: '#37474f',
                },
                {
                  label: storeSummary.gap > 0 ? '目標まであと' : '目標超過！',
                  value: Math.abs(storeSummary.gap),
                  sub: storeSummary.gap > 0 ? '不足額' : '超過額',
                  color: storeSummary.gap > 0 ? '#c62828' : '#2e7d32',
                },
              ].map((item) => (
                <Grid item key={item.label} xs={6} sm={4} md>
                  <Card
                    elevation={1}
                    sx={{ border: `1px solid ${item.color}40`, height: '100%' }}
                  >
                    <CardContent sx={{ py: '10px !important', px: 1.5 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', fontSize: '0.7rem' }}
                      >
                        {item.label}
                      </Typography>
                      <Typography
                        variant="h6"
                        fontWeight="bold"
                        sx={{ color: item.color, lineHeight: 1.3, whiteSpace: 'nowrap' }}
                      >
                        {formatPrice(item.value)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: '0.65rem' }}
                      >
                        {item.sub}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* 目標達成率プログレスバー */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  目標達成率（年度末着地予測）
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight="bold"
                  sx={{
                    color:
                      storeSummary.progressPct >= 100
                        ? '#2e7d32'
                        : storeSummary.progressPct >= 80
                        ? '#fb8c00'
                        : PROPERTY_COLOR,
                  }}
                >
                  {storeSummary.progressPct}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={storeSummary.progressPct}
                sx={{
                  height: 14,
                  borderRadius: 7,
                  bgcolor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    bgcolor:
                      storeSummary.progressPct >= 100
                        ? '#2e7d32'
                        : storeSummary.progressPct >= 80
                        ? '#fb8c00'
                        : PROPERTY_COLOR,
                    borderRadius: 7,
                  },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">0</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  目標 {formatPrice(storeSummary.target)}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* ─── 担当者別集計 ─── */}
          <Accordion
            defaultExpanded
            elevation={1}
            sx={{ mb: 2, '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f5f5f5', minHeight: 44 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                担当者別集計
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#eeeeee' }}>
                      {[
                        '担当者',
                        '決済済み実績',
                        '成約見込み（FY内）',
                        '年度末着地予測',
                        '個人目標',
                        '差額',
                        '達成率',
                      ].map((h) => (
                        <TableCell
                          key={h}
                          sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 1, px: 1.5 }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {staffSummaries.map((s) => (
                      <TableRow key={s.staffName} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                        {/* 担当者名 */}
                        <TableCell sx={{ fontWeight: 600, px: 1.5, py: 1, whiteSpace: 'nowrap' }}>
                          {s.staffName}
                        </TableCell>

                        {/* 実績 */}
                        <TableCell sx={{ px: 1.5, py: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight={s.actual > 0 ? 600 : 'normal'}
                            sx={{ color: s.actual > 0 ? '#2e7d32' : 'text.disabled', whiteSpace: 'nowrap' }}
                          >
                            {s.actual > 0 ? formatPrice(s.actual) : '-'}
                          </Typography>
                          {s.actualCount > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                              {s.actualCount}件
                            </Typography>
                          )}
                        </TableCell>

                        {/* 見込み */}
                        <TableCell sx={{ px: 1.5, py: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight={s.forecast > 0 ? 600 : 'normal'}
                            sx={{ color: s.forecast > 0 ? '#1565c0' : 'text.disabled', whiteSpace: 'nowrap' }}
                          >
                            {s.forecast > 0 ? formatPrice(s.forecast) : '-'}
                          </Typography>
                          {s.forecastCount > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                              {s.forecastCount}件
                            </Typography>
                          )}
                        </TableCell>

                        {/* 着地予測 */}
                        <TableCell sx={{ px: 1.5, py: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{ color: s.projected > 0 ? '#6a1b9a' : 'text.disabled', whiteSpace: 'nowrap' }}
                          >
                            {s.projected > 0 ? formatPrice(s.projected) : '-'}
                          </Typography>
                        </TableCell>

                        {/* 個人目標（編集可） */}
                        <TableCell sx={{ px: 1.5, py: 1 }}>
                          {editingTarget === s.staffName ? (
                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                              <TextField
                                size="small"
                                value={editTargetValue}
                                onChange={(e) => setEditTargetValue(e.target.value)}
                                type="number"
                                label="万円"
                                sx={{ width: 100 }}
                                inputProps={{ min: 0 }}
                                autoFocus
                              />
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleSaveTarget(s.staffName)}
                                disabled={savingTarget}
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => setEditingTarget(null)}
                                disabled={savingTarget}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                {s.target > 0 ? formatPrice(s.target) : '未設定'}
                              </Typography>
                              <Tooltip title="個人目標を編集">
                                <IconButton
                                  size="small"
                                  onClick={() => startEditTarget(s.staffName, s.target)}
                                >
                                  <EditIcon sx={{ fontSize: '0.8rem' }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </TableCell>

                        {/* 差額 */}
                        <TableCell sx={{ px: 1.5, py: 1 }}>
                          {s.target > 0 ? (
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{
                                color: s.gap <= 0 ? '#2e7d32' : '#c62828',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {s.gap <= 0
                                ? `▲ ${formatPrice(-s.gap)}`
                                : `▼ ${formatPrice(s.gap)}`}
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.disabled">-</Typography>
                          )}
                        </TableCell>

                        {/* 達成率 */}
                        <TableCell sx={{ px: 1.5, py: 1 }}>
                          {s.target > 0 ? (
                            <Chip
                              label={`${s.progressPct}%`}
                              size="small"
                              sx={{
                                bgcolor:
                                  s.progressPct >= 100
                                    ? '#e8f5e9'
                                    : s.progressPct >= 70
                                    ? '#fff3e0'
                                    : '#ffebee',
                                color:
                                  s.progressPct >= 100
                                    ? '#2e7d32'
                                    : s.progressPct >= 70
                                    ? '#e65100'
                                    : '#c62828',
                                fontWeight: 'bold',
                                fontSize: '0.72rem',
                              }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.disabled">-</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* 合計行 */}
                    <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                      <TableCell sx={{ fontWeight: 'bold', px: 1.5, py: 1 }}>
                        合計（大分店）
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', px: 1.5, py: 1, color: '#2e7d32', whiteSpace: 'nowrap' }}>
                        {formatPrice(storeSummary.actual)}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                          {storeSummary.actualCount}件
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', px: 1.5, py: 1, color: '#1565c0', whiteSpace: 'nowrap' }}>
                        {formatPrice(storeSummary.forecast)}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                          {storeSummary.forecastCount}件
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', px: 1.5, py: 1, color: '#6a1b9a', whiteSpace: 'nowrap' }}>
                        {formatPrice(storeSummary.projected)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', px: 1.5, py: 1, whiteSpace: 'nowrap' }}>
                        {formatPrice(storeSummary.target)}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 'bold',
                          px: 1.5,
                          py: 1,
                          color: storeSummary.gap <= 0 ? '#2e7d32' : '#c62828',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {storeSummary.gap <= 0
                          ? `▲ ${formatPrice(-storeSummary.gap)}`
                          : `▼ ${formatPrice(storeSummary.gap)}`}
                      </TableCell>
                      <TableCell sx={{ px: 1.5, py: 1 }}>
                        <Chip
                          label={`${storeSummary.progressPct}%`}
                          size="small"
                          sx={{
                            bgcolor:
                              storeSummary.progressPct >= 100
                                ? '#e8f5e9'
                                : storeSummary.progressPct >= 70
                                ? '#fff3e0'
                                : '#ffebee',
                            color:
                              storeSummary.progressPct >= 100
                                ? '#2e7d32'
                                : storeSummary.progressPct >= 70
                                ? '#e65100'
                                : '#c62828',
                            fontWeight: 'bold',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ p: 1.5, bgcolor: '#fafafa', borderTop: '1px solid #e0e0e0' }}>
                <Typography variant="caption" color="text.secondary">
                  ※ 個人目標の合計が店舗全体目標と一致する必要はありません。
                  個人目標は各担当者の鉛筆アイコンから入力（万円単位）。
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* ─── 月別集計 ─── */}
          <Accordion
            defaultExpanded
            elevation={1}
            sx={{ mb: 2, '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f5f5f5', minHeight: 44 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                月別集計（2026年10月〜2027年9月）
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#eeeeee' }}>
                      {['月', '決済済み実績', '成約見込み（予定）', '月計'].map((h) => (
                        <TableCell
                          key={h}
                          sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 1, px: 1.5 }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthSummaries.map((m) => {
                      const monthTotal = m.actual + m.forecast;
                      const isNextYear = m.month.startsWith('2027');
                      return (
                        <TableRow
                          key={m.month}
                          sx={{
                            bgcolor: isNextYear ? '#fafff4' : 'inherit',
                            '&:hover': { bgcolor: '#f5f5f5' },
                          }}
                        >
                          <TableCell
                            sx={{
                              fontWeight: 500,
                              px: 1.5,
                              py: 0.75,
                              whiteSpace: 'nowrap',
                              borderLeft: isNextYear ? '3px solid #81c784' : undefined,
                              color: isNextYear ? '#2e7d32' : 'inherit',
                            }}
                          >
                            {formatMonth(m.month)}
                          </TableCell>
                          <TableCell
                            sx={{
                              px: 1.5,
                              py: 0.75,
                              color: m.actual > 0 ? '#2e7d32' : 'text.disabled',
                              fontWeight: m.actual > 0 ? 600 : 'normal',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.actual > 0 ? formatPrice(m.actual) : '-'}
                            {m.actualCount > 0 && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                                {m.actualCount}件
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell
                            sx={{
                              px: 1.5,
                              py: 0.75,
                              color: m.forecast > 0 ? '#1565c0' : 'text.disabled',
                              fontWeight: m.forecast > 0 ? 600 : 'normal',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.forecast > 0 ? formatPrice(m.forecast) : '-'}
                            {m.forecastCount > 0 && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                                {m.forecastCount}件
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell
                            sx={{
                              px: 1.5,
                              py: 0.75,
                              fontWeight: monthTotal > 0 ? 'bold' : 'normal',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {monthTotal > 0 ? formatPrice(monthTotal) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* 合計行 */}
                    <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                      <TableCell sx={{ fontWeight: 'bold', px: 1.5, py: 1 }}>年度合計</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', px: 1.5, py: 1, color: '#2e7d32', whiteSpace: 'nowrap' }}>
                        {formatPrice(storeSummary.actual)}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                          {storeSummary.actualCount}件
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', px: 1.5, py: 1, color: '#1565c0', whiteSpace: 'nowrap' }}>
                        {formatPrice(storeSummary.forecast)}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                          {storeSummary.forecastCount}件
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', px: 1.5, py: 1, color: '#6a1b9a', whiteSpace: 'nowrap' }}>
                        {formatPrice(storeSummary.projected)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  bgcolor: '#fafafa',
                  borderTop: '1px solid #e0e0e0',
                  display: 'flex',
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  🟢 実績：決済日がFY内の決済済み物件（FI番号除外）
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  🔵 見込み：専任・公開中で決済見込み月がFY内の物件（FI番号除外・両手率65%）
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ⚠️ 2027年10月以降の見込みは集計対象外
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* ─── 決済済み物件一覧 ─── */}
          {settled.length > 0 && (
            <Accordion
              elevation={1}
              sx={{ mb: 2, '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f5f5f5', minHeight: 44 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  決済済み物件一覧（{settled.length}件）
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#eeeeee' }}>
                        {['物件番号', '所在地', '担当者', '決済日', '売上金額（税込）'].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 1, px: 1.5 }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {settled.map((p) => (
                        <TableRow key={p.property_number} sx={{ '&:hover': { bgcolor: '#f5f5f5' } }}>
                          <TableCell sx={{ fontSize: '0.8rem', px: 1.5, py: 0.75, fontWeight: 500 }}>
                            {p.property_number}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', px: 1.5, py: 0.75, maxWidth: 200 }}>
                            <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                              {p.display_address || p.address || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem', px: 1.5, py: 0.75, whiteSpace: 'nowrap' }}>
                            {resolveStaffName(p.sales_assignee)}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem', px: 1.5, py: 0.75, whiteSpace: 'nowrap' }}>
                            {p.settlement_date
                              ? new Date(p.settlement_date).toLocaleDateString('ja-JP', {
                                  year: 'numeric',
                                  month: 'numeric',
                                  day: 'numeric',
                                })
                              : '-'}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontSize: '0.8rem',
                              px: 1.5,
                              py: 0.75,
                              textAlign: 'right',
                              fontWeight: 600,
                              color: '#2e7d32',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatPrice(getActualCommission(p))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          )}

          {/* ─── 成約見込み物件一覧（FY内） ─── */}
          {forecastItems.length > 0 && (
            <Accordion
              elevation={1}
              sx={{ mb: 2, '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f5f5f5', minHeight: 44 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  成約見込み物件一覧（FY内・{forecastItems.length}件）
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#eeeeee' }}>
                        {['物件番号', '所在地', '担当者', 'ランク', '決済見込み月', '想定売上', '確認状況'].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 1, px: 1.5 }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {forecastItems
                        .sort((a, b) =>
                          (a.prospect?.settlement_expected_month ?? '').localeCompare(
                            b.prospect?.settlement_expected_month ?? ''
                          )
                        )
                        .map((p) => {
                          const sc = calcSellerCommission(p.price, p.commission_from_seller);
                          const rev = calcExpectedRevenue(sc);
                          const rank = p.prospect?.prospect_rank;
                          return (
                            <TableRow key={p.property_number} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                              <TableCell sx={{ fontSize: '0.8rem', px: 1.5, py: 0.75, fontWeight: 500 }}>
                                {p.property_number}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.75rem', px: 1.5, py: 0.75, maxWidth: 180 }}>
                                <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                                  {p.display_address || p.address || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem', px: 1.5, py: 0.75, whiteSpace: 'nowrap' }}>
                                {resolveStaffName(p.sales_assignee)}
                              </TableCell>
                              <TableCell sx={{ px: 1.5, py: 0.75 }}>
                                {rank ? (
                                  <Chip
                                    label={rank}
                                    size="small"
                                    sx={{
                                      bgcolor: RANK_COLORS[rank] ?? '#757575',
                                      color: '#fff',
                                      fontWeight: 'bold',
                                      minWidth: 24,
                                      fontSize: '0.75rem',
                                      height: 20,
                                    }}
                                  />
                                ) : (
                                  <Typography variant="caption" color="text.disabled">-</Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem', px: 1.5, py: 0.75, whiteSpace: 'nowrap', fontWeight: 500 }}>
                                {formatMonth(p.prospect!.settlement_expected_month!)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: '0.8rem',
                                  px: 1.5,
                                  py: 0.75,
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: '#1565c0',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatPrice(rev)}
                              </TableCell>
                              <TableCell sx={{ px: 1.5, py: 0.75 }}>
                                {p.prospect?.manager_check_status && (
                                  <Chip
                                    label={p.prospect.manager_check_status}
                                    size="small"
                                    color={
                                      p.prospect.manager_check_status === '確認済み'
                                        ? 'success'
                                        : p.prospect.manager_check_status === '要見直し'
                                        ? 'error'
                                        : 'default'
                                    }
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          )}
        </>
      )}

      {/* ─── スナックバー ─── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
