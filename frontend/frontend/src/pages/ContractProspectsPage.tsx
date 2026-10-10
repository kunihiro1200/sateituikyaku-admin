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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Grid,
  InputAdornment,
  CircularProgress,
  Snackbar,
  Alert,
  useTheme,
  useMediaQuery,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { supabase } from '../config/supabase';
import PageNavigation from '../components/PageNavigation';
import { useAuthStore } from '../store/authStore';
import { SECTION_COLORS } from '../theme/sectionColors';

// ============================================================
// 型定義
// ============================================================

interface PropertyListing {
  id: string;
  property_number: string;
  address?: string;
  display_address?: string;
  sales_assignee?: string;
  price?: number;
  commission_from_seller?: number;
  atbb_status?: string;
}

interface ContractProspect {
  id?: string;
  property_number: string;
  prospect_rank?: string | null;
  settlement_expected_month?: string | null;
  assessment_reason?: string | null;
  required_actions?: string | null;
  manager_check_status: string;
  manager_comment?: string | null;
  manager_checked_at?: string | null;
  manager_checked_by?: string | null;
  change_history?: ChangeHistoryEntry[];
  updated_at?: string;
  updated_by?: string | null;
  created_at?: string;
  created_by?: string | null;
}

interface ChangeHistoryEntry {
  changed_at: string;
  changed_by: string;
  changes: Record<string, { from: unknown; to: unknown }>;
}

interface PropertyWithProspect extends PropertyListing {
  prospect?: ContractProspect;
}

interface EditForm {
  prospect_rank: string;
  settlement_expected_month: string;
  assessment_reason: string;
  required_actions: string;
  manager_check_status: string;
  manager_comment: string;
}

// ============================================================
// 定数
// ============================================================

/** 担当者切替ボタン（全員 + 個人6名） */
const STAFF_BUTTONS = ['全員', '山本', '角井', '林田', '麻生', '裏', '国広'] as const;
type StaffName = (typeof STAFF_BUTTONS)[number];

/** 担当者 → 担当者コードのマッピング */
const STAFF_PATTERNS: Record<string, string[]> = {
  山本: ['山本', '山', 'Y'],
  角井: ['角井', 'I'],
  林田: ['林', '林田'],
  麻生: ['麻生', '麻'],
  裏: ['裏', 'U'],
  国広: ['K', '国広'],
};

/** 全担当者コード（全員フィルタ用） */
const ALL_STAFF_PATTERNS = Object.values(STAFF_PATTERNS).flat();

/** 成約見込みランク定義 */
const RANK_OPTIONS = [
  {
    value: 'A',
    label: 'A：成約見込みが高い',
    short: 'A',
    desc: '購入申込がある、または具体的な購入検討が進んでいる物件。',
    color: '#1565c0',
    bgColor: '#e3f2fd',
  },
  {
    value: 'B',
    label: 'B：成約見込みがある',
    short: 'B',
    desc: '問い合わせや内覧があり、価格もおおむね妥当な物件。',
    color: '#2e7d32',
    bgColor: '#e8f5e9',
  },
  {
    value: 'C',
    label: 'C：改善により成約が期待できる',
    short: 'C',
    desc: '現状の反響は少ないが、価格変更や販売方法の改善によって成約が期待できる物件。',
    color: '#e65100',
    bgColor: '#fff3e0',
  },
  {
    value: 'D',
    label: 'D：現状では成約が難しい',
    short: 'D',
    desc: '価格や売却条件などに課題があり、大幅な見直しが必要な物件。',
    color: '#c62828',
    bgColor: '#ffebee',
  },
] as const;

/** マネージャー確認状況の選択肢 */
const MANAGER_STATUS_OPTIONS = ['未確認', '確認済み', '要見直し'] as const;

/** 売上予測の両手率（初期設定 65%） */
const BOTH_HAND_RATE = 0.65;

const PROPERTY_COLOR = SECTION_COLORS.property.main; // '#2196f3'

// ============================================================
// ユーティリティ
// ============================================================

/** 担当者フィルタ判定 */
function matchesStaff(salesAssignee: string | undefined | null, staffName: StaffName): boolean {
  if (!salesAssignee) return false;
  if (staffName === '全員') {
    return ALL_STAFF_PATTERNS.some((p) => salesAssignee.includes(p));
  }
  const patterns = STAFF_PATTERNS[staffName];
  return patterns ? patterns.some((p) => salesAssignee.includes(p)) : false;
}

/**
 * 想定仲介手数料（税込・売主側）
 * - commission_from_seller が存在する場合は優先
 * - 800万円以上: (price × 3% + 6万円) × 1.1
 * - 800万円未満: 税込33万円固定
 */
function calcSellerCommission(price?: number | null, commissionFromSeller?: number | null): number {
  if (commissionFromSeller && commissionFromSeller > 0) return commissionFromSeller;
  if (!price || price <= 0) return 0;
  if (price >= 8_000_000) {
    return Math.round((price * 0.03 + 60_000) * 1.1);
  }
  return 330_000; // 税込33万円固定
}

/**
 * 想定売上（両手率65%適用）
 * = 売主側手数料 × (0.65×2 + 0.35×1) = 売主側 × 1.65
 */
function calcExpectedRevenue(sellerCommission: number): number {
  return Math.round(sellerCommission * (BOTH_HAND_RATE * 2 + (1 - BOTH_HAND_RATE)));
}

/** 金額表示（万円単位） */
function formatPrice(amount?: number | null): string {
  if (!amount || amount <= 0) return '-';
  const man = amount / 10_000;
  return `${man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)}万円`;
}

/** YYYY-MM → YYYY年M月 */
function formatMonth(yyyymm?: string | null): string {
  if (!yyyymm) return '-';
  const [year, month] = yyyymm.split('-');
  return `${year}年${parseInt(month, 10)}月`;
}

/** ランクの色コード */
function getRankColor(rank?: string | null): string {
  return RANK_OPTIONS.find((r) => r.value === rank)?.color ?? '#757575';
}

/** ランクの背景色 */
function getRankBgColor(rank?: string | null): string {
  return RANK_OPTIONS.find((r) => r.value === rank)?.bgColor ?? '#f5f5f5';
}

/** マネージャー確認状況の MUI Color */
function getManagerStatusChipColor(status: string): 'default' | 'success' | 'error' {
  if (status === '確認済み') return 'success';
  if (status === '要見直し') return 'error';
  return 'default';
}

/** テキスト正規化（全角→半角 + 小文字化） */
function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

/** 担当コード → 表示名に解決（例: 'Y' → '山本'） */
function resolveStaffName(salesAssignee: string | undefined | null): string {
  if (!salesAssignee) return '不明';
  for (const [name, patterns] of Object.entries(STAFF_PATTERNS)) {
    if (patterns.some((p) => salesAssignee.includes(p))) return name;
  }
  return salesAssignee;
}

// ============================================================
// コンポーネント
// ============================================================

export default function ContractProspectsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { employee } = useAuthStore();

  // --- データ ---
  const [properties, setProperties] = useState<PropertyWithProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- フィルタ ---
  const [selectedStaff, setSelectedStaff] = useState<StaffName>('全員');
  const [rankFilter, setRankFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnfilledOnly, setShowUnfilledOnly] = useState(false);
  const [showReviewOnly, setShowReviewOnly] = useState(false);

  // --- インライン編集 ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    prospect_rank: '',
    settlement_expected_month: '',
    assessment_reason: '',
    required_actions: '',
    manager_check_status: '未確認',
    manager_comment: '',
  });

  // --- ダイアログ ---
  const [rankGuideOpen, setRankGuideOpen] = useState(false);

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
      // 1. 物件リスト（専任・公開中 & FI番号除外）
      const { data: listings, error: listErr } = await supabase
        .from('property_listings')
        .select(
          'id, property_number, address, display_address, sales_assignee, price, commission_from_seller, atbb_status'
        )
        .eq('atbb_status', '専任・公開中')
        .not('property_number', 'ilike', '%FI%')
        .order('property_number', { ascending: true });

      if (listErr) throw listErr;

      // 2. 成約見込みデータ（全件）
      const { data: prospects, error: prospErr } = await supabase
        .from('property_contract_prospects')
        .select('*');

      if (prospErr) throw prospErr;

      // 3. マージ（対象担当者の物件のみ残す）
      const prospectMap = new Map(
        (prospects ?? []).map((p) => [p.property_number, p as ContractProspect])
      );

      const merged: PropertyWithProspect[] = (listings ?? [])
        .filter((l) => ALL_STAFF_PATTERNS.some((p) => (l.sales_assignee ?? '').includes(p)))
        .map((l) => ({
          ...l,
          prospect: prospectMap.get(l.property_number),
        }));

      setProperties(merged);
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
  // 集計（現在の担当者フィルタ適用）
  // ============================================================

  const stats = useMemo(() => {
    const base =
      selectedStaff === '全員'
        ? properties
        : properties.filter((p) => matchesStaff(p.sales_assignee, selectedStaff));

    return {
      total: base.length,
      filled: base.filter((p) => p.prospect?.prospect_rank).length,
      unfilled: base.filter((p) => !p.prospect?.prospect_rank).length,
      a: base.filter((p) => p.prospect?.prospect_rank === 'A').length,
      b: base.filter((p) => p.prospect?.prospect_rank === 'B').length,
      c: base.filter((p) => p.prospect?.prospect_rank === 'C').length,
      d: base.filter((p) => p.prospect?.prospect_rank === 'D').length,
      confirmed: base.filter((p) => p.prospect?.manager_check_status === '確認済み').length,
      unconfirmed: base.filter(
        (p) => !p.prospect || p.prospect.manager_check_status === '未確認'
      ).length,
      review: base.filter((p) => p.prospect?.manager_check_status === '要見直し').length,
    };
  }, [properties, selectedStaff]);

  // ============================================================
  // フィルタ後のリスト
  // ============================================================

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      // 担当者フィルタ
      if (!matchesStaff(p.sales_assignee, selectedStaff)) return false;
      // ランクフィルタ
      if (rankFilter && p.prospect?.prospect_rank !== rankFilter) return false;
      // マネージャー確認状況フィルタ
      if (statusFilter) {
        const status = p.prospect?.manager_check_status ?? '未確認';
        if (status !== statusFilter) return false;
      }
      // 決済見込み月フィルタ
      if (monthFilter && p.prospect?.settlement_expected_month !== monthFilter) return false;
      // 未入力のみ
      if (showUnfilledOnly && p.prospect?.prospect_rank) return false;
      // 要見直しのみ
      if (showReviewOnly && p.prospect?.manager_check_status !== '要見直し') return false;
      // テキスト検索
      if (searchQuery) {
        const q = normalizeText(searchQuery);
        const target = normalizeText(
          [p.property_number ?? '', p.address ?? '', p.display_address ?? '', p.sales_assignee ?? ''].join(' ')
        );
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [
    properties,
    selectedStaff,
    rankFilter,
    statusFilter,
    monthFilter,
    showUnfilledOnly,
    showReviewOnly,
    searchQuery,
  ]);

  // ============================================================
  // 売上予測サマリー（担当者別・月別）
  // ============================================================

  /** 決済見込み月が設定されている物件（現在の担当者フィルタ適用） */
  const forecastItems = useMemo(() => {
    const base =
      selectedStaff === '全員'
        ? properties
        : properties.filter((p) => matchesStaff(p.sales_assignee, selectedStaff));

    return base
      .filter((p) => p.prospect?.settlement_expected_month)
      .sort((a, b) => {
        // 月→担当者 の順でソート
        const mA = a.prospect?.settlement_expected_month ?? '';
        const mB = b.prospect?.settlement_expected_month ?? '';
        if (mA !== mB) return mA.localeCompare(mB);
        return resolveStaffName(a.sales_assignee).localeCompare(
          resolveStaffName(b.sales_assignee)
        );
      });
  }, [properties, selectedStaff]);

  /** 担当者名 → 物件リスト のマップ */
  const forecastByStaff = useMemo(() => {
    const map = new Map<string, PropertyWithProspect[]>();
    for (const p of forecastItems) {
      const name = resolveStaffName(p.sales_assignee);
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(p);
    }
    return map;
  }, [forecastItems]);

  /** 全体合計売上見込み */
  const forecastGrandTotal = useMemo(() => {
    return forecastItems.reduce((sum, p) => {
      const sc = calcSellerCommission(p.price, p.commission_from_seller);
      return sum + calcExpectedRevenue(sc);
    }, 0);
  }, [forecastItems]);

  // ============================================================
  // 編集ハンドラ
  // ============================================================

  const handleEdit = (property: PropertyWithProspect) => {
    setEditingId(property.property_number);
    setEditForm({
      prospect_rank: property.prospect?.prospect_rank ?? '',
      settlement_expected_month: property.prospect?.settlement_expected_month ?? '',
      assessment_reason: property.prospect?.assessment_reason ?? '',
      required_actions: property.prospect?.required_actions ?? '',
      manager_check_status: property.prospect?.manager_check_status ?? '未確認',
      manager_comment: property.prospect?.manager_comment ?? '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async (property: PropertyWithProspect) => {
    if (!employee) return;
    setSaving(true);

    try {
      const existing = property.prospect;
      const now = new Date().toISOString();
      const employeeName = employee.name ?? employee.email ?? 'ユーザー';

      // 担当者入力項目が変更された場合は確認状況を「未確認」に戻す
      let managerStatus = editForm.manager_check_status;
      if (existing && managerStatus === '確認済み') {
        const staffFieldChanged =
          editForm.prospect_rank !== (existing.prospect_rank ?? '') ||
          editForm.settlement_expected_month !== (existing.settlement_expected_month ?? '') ||
          editForm.assessment_reason !== (existing.assessment_reason ?? '') ||
          editForm.required_actions !== (existing.required_actions ?? '');
        if (staffFieldChanged) {
          managerStatus = '未確認';
        }
      }

      // 変更履歴の構築
      const oldHistory: ChangeHistoryEntry[] = existing?.change_history ?? [];
      const changes: Record<string, { from: unknown; to: unknown }> = {};

      const fieldKeys: (keyof EditForm)[] = [
        'prospect_rank',
        'settlement_expected_month',
        'assessment_reason',
        'required_actions',
        'manager_check_status',
        'manager_comment',
      ];
      for (const field of fieldKeys) {
        const oldVal = existing?.[field as keyof ContractProspect] ?? null;
        const newVal = editForm[field] || null;
        if (oldVal !== newVal) {
          changes[field] = { from: oldVal, to: newVal };
        }
      }

      const newHistory: ChangeHistoryEntry[] =
        Object.keys(changes).length > 0
          ? [...oldHistory, { changed_at: now, changed_by: employeeName, changes }]
          : oldHistory;

      // Upsert データ
      const upsertData: Record<string, unknown> = {
        property_number: property.property_number,
        prospect_rank: editForm.prospect_rank || null,
        settlement_expected_month: editForm.settlement_expected_month || null,
        assessment_reason: editForm.assessment_reason || null,
        required_actions: editForm.required_actions || null,
        manager_check_status: managerStatus,
        manager_comment: editForm.manager_comment || null,
        updated_at: now,
        updated_by: employeeName,
        change_history: newHistory,
      };

      // 確認状況が変わった場合に確認日時・確認者を記録
      if (!existing || managerStatus !== existing.manager_check_status) {
        if (managerStatus === '確認済み' || managerStatus === '要見直し') {
          upsertData.manager_checked_at = now;
          upsertData.manager_checked_by = employeeName;
        } else if (managerStatus === '未確認') {
          upsertData.manager_checked_at = null;
          upsertData.manager_checked_by = null;
        }
      }

      if (!existing) {
        upsertData.created_at = now;
        upsertData.created_by = employeeName;
      }

      const { data, error } = await supabase
        .from('property_contract_prospects')
        .upsert(upsertData, { onConflict: 'property_number' })
        .select()
        .single();

      if (error) throw error;

      // ローカル状態を更新
      setProperties((prev) =>
        prev.map((p) =>
          p.property_number === property.property_number ? { ...p, prospect: data } : p
        )
      );

      setEditingId(null);
      setSnackbar({ open: true, message: '保存しました', severity: 'success' });
    } catch (err) {
      console.error('保存エラー:', err);
      setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    } finally {
      setSaving(false);
    }
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
        <Typography
          variant={isMobile ? 'subtitle1' : 'h5'}
          fontWeight="bold"
          sx={{ color: PROPERTY_COLOR }}
        >
          成約見込み管理
        </Typography>
        <Chip
          label="大分店・専任媒介"
          size="small"
          sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 500 }}
        />
        <Tooltip title="ランク基準を確認" arrow>
          <IconButton size="small" onClick={() => setRankGuideOpen(true)}>
            <InfoOutlinedIcon fontSize="small" sx={{ color: PROPERTY_COLOR }} />
          </IconButton>
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

      {/* ─── 担当者切替ボタン ─── */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 2, mb: 1 }}>
        {STAFF_BUTTONS.map((staff) => (
          <Button
            key={staff}
            variant={selectedStaff === staff ? 'contained' : 'outlined'}
            size="small"
            onClick={() => {
              setSelectedStaff(staff);
              setEditingId(null);
            }}
            sx={{
              minWidth: 64,
              fontWeight: selectedStaff === staff ? 'bold' : 'normal',
              ...(selectedStaff === staff
                ? {
                    bgcolor: PROPERTY_COLOR,
                    '&:hover': { bgcolor: SECTION_COLORS.property.dark },
                  }
                : {
                    borderColor: PROPERTY_COLOR,
                    color: PROPERTY_COLOR,
                    '&:hover': { bgcolor: '#e3f2fd' },
                  }),
            }}
          >
            {staff}
          </Button>
        ))}
      </Box>

      {/* ─── ランク凡例バー ─── */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          ランク基準：
        </Typography>
        {RANK_OPTIONS.map((r) => (
          <Tooltip key={r.value} title={r.desc} arrow placement="bottom">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}>
              <Chip
                label={r.short}
                size="small"
                sx={{
                  bgcolor: r.color,
                  color: '#fff',
                  fontWeight: 'bold',
                  minWidth: 24,
                  fontSize: '0.72rem',
                  height: 20,
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {r.label.split('：')[1]}
              </Typography>
            </Box>
          </Tooltip>
        ))}
      </Box>

      {/* ─── 集計カード ─── */}
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {[
          { label: '販売中', value: stats.total, color: '#37474f' },
          { label: '入力済', value: stats.filled, color: '#1565c0' },
          { label: '未入力', value: stats.unfilled, color: '#e65100' },
          { label: 'Aランク', value: stats.a, color: '#1565c0' },
          { label: 'Bランク', value: stats.b, color: '#2e7d32' },
          { label: 'Cランク', value: stats.c, color: '#e65100' },
          { label: 'Dランク', value: stats.d, color: '#c62828' },
          { label: '確認済', value: stats.confirmed, color: '#2e7d32' },
          { label: '未確認', value: stats.unconfirmed, color: '#757575' },
          { label: '要見直', value: stats.review, color: '#c62828' },
        ].map((item) => (
          <Grid item key={item.label} xs={4} sm={2} md="auto">
            <Card
              sx={{
                textAlign: 'center',
                minWidth: 68,
                cursor: 'default',
                border: '1px solid #e0e0e0',
              }}
              elevation={1}
            >
              <CardContent sx={{ py: '6px !important', px: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                  {item.label}
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  sx={{ color: item.color, lineHeight: 1.3 }}
                >
                  {item.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ─── 売上予測サマリー ─── */}
      <Accordion
        defaultExpanded={false}
        sx={{ mb: 2, border: '1px solid #e3f2fd', '&:before': { display: 'none' } }}
        elevation={1}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ bgcolor: '#e3f2fd', minHeight: 44, '&.Mui-expanded': { minHeight: 44 } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon sx={{ color: PROPERTY_COLOR, fontSize: '1.1rem' }} />
            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: PROPERTY_COLOR }}>
              売上予測サマリー（決済見込み月入力済み物件）
            </Typography>
            {forecastItems.length > 0 && (
              <Chip
                label={`${forecastItems.length}件 / 合計 ${formatPrice(forecastGrandTotal)}`}
                size="small"
                sx={{ bgcolor: PROPERTY_COLOR, color: '#fff', fontWeight: 'bold', fontSize: '0.72rem' }}
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          {forecastItems.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                決済見込み月が入力された物件がありません
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    {['担当者', '物件番号', '所在地', 'ランク', '決済見込み月', '想定売上（予定）', '実際'].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.75, px: 1.5 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from(forecastByStaff.entries()).map(([staffName, items]) => {
                    const staffTotal = items.reduce((sum, p) => {
                      const sc = calcSellerCommission(p.price, p.commission_from_seller);
                      return sum + calcExpectedRevenue(sc);
                    }, 0);
                    return (
                      <>
                        {items.map((p, idx) => {
                          const sc = calcSellerCommission(p.price, p.commission_from_seller);
                          const rev = calcExpectedRevenue(sc);
                          return (
                            <TableRow
                              key={p.property_number}
                              sx={{ '&:hover': { bgcolor: '#fafafa' }, bgcolor: getRankBgColor(p.prospect?.prospect_rank) + '40' }}
                            >
                              {/* 担当者（グループ先頭行のみ表示） */}
                              <TableCell
                                sx={{ fontWeight: 600, fontSize: '0.8rem', px: 1.5, py: 0.75, borderBottom: idx === items.length - 1 ? '2px solid #e0e0e0' : undefined }}
                              >
                                {idx === 0 ? staffName : ''}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem', px: 1.5, py: 0.75, whiteSpace: 'nowrap' }}>
                                {p.property_number}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.75rem', px: 1.5, py: 0.75, maxWidth: 160 }}>
                                <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                                  {p.display_address || p.address || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ px: 1.5, py: 0.75 }}>
                                {p.prospect?.prospect_rank ? (
                                  <Chip
                                    label={p.prospect.prospect_rank}
                                    size="small"
                                    sx={{ bgcolor: getRankColor(p.prospect.prospect_rank), color: '#fff', fontWeight: 'bold', minWidth: 24, fontSize: '0.75rem', height: 20 }}
                                  />
                                ) : <Typography variant="caption" color="text.disabled">-</Typography>}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem', px: 1.5, py: 0.75, whiteSpace: 'nowrap', fontWeight: 500 }}>
                                {formatMonth(p.prospect?.settlement_expected_month)}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem', px: 1.5, py: 0.75, textAlign: 'right', fontWeight: 500, color: '#1565c0', whiteSpace: 'nowrap' }}>
                                {formatPrice(rev)}
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                                  (売主側: {formatPrice(sc)})
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.75rem', px: 1.5, py: 0.75, color: 'text.disabled' }}>
                                -
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {/* 担当者小計行 */}
                        <TableRow sx={{ bgcolor: '#e8f5e9' }}>
                          <TableCell colSpan={5} sx={{ fontWeight: 'bold', fontSize: '0.78rem', px: 1.5, py: 0.5, color: '#2e7d32' }}>
                            {staffName} 小計（{items.length}件）
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'bold', fontSize: '0.85rem', textAlign: 'right', px: 1.5, py: 0.5, color: '#2e7d32', whiteSpace: 'nowrap' }}>
                            {formatPrice(staffTotal)}
                          </TableCell>
                          <TableCell sx={{ px: 1.5, py: 0.5, color: 'text.disabled', fontSize: '0.75rem' }}>-</TableCell>
                        </TableRow>
                      </>
                    );
                  })}
                  {/* 合計行 */}
                  <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                    <TableCell colSpan={5} sx={{ fontWeight: 'bold', fontSize: '0.85rem', px: 1.5, py: 0.75, color: PROPERTY_COLOR }}>
                      合計（{forecastItems.length}件）
                      <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary', fontSize: '0.7rem' }}>
                        ※ 両手率{Math.round(BOTH_HAND_RATE * 100)}%で算出（初期設定）
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem', textAlign: 'right', px: 1.5, py: 0.75, color: PROPERTY_COLOR, whiteSpace: 'nowrap' }}>
                      {formatPrice(forecastGrandTotal)}
                    </TableCell>
                    <TableCell sx={{ px: 1.5, py: 0.75, color: 'text.disabled', fontSize: '0.75rem' }}>未成約</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </AccordionDetails>
      </Accordion>

      {/* ─── 検索・フィルタバー ─── */}      <Paper sx={{ p: 1.5, mb: 2 }} elevation={1}>
        <Grid container spacing={1} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="物件番号・所在地・担当者で検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Grid>
          <Grid item xs={6} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>ランク</InputLabel>
              <Select
                value={rankFilter}
                label="ランク"
                onChange={(e) => setRankFilter(e.target.value)}
              >
                <MenuItem value="">すべて</MenuItem>
                {RANK_OPTIONS.map((r) => (
                  <MenuItem key={r.value} value={r.value} sx={{ color: r.color, fontWeight: 'bold' }}>
                    ランク{r.value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>確認状況</InputLabel>
              <Select
                value={statusFilter}
                label="確認状況"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">すべて</MenuItem>
                {MANAGER_STATUS_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField
              fullWidth
              size="small"
              type="month"
              label="決済見込み月"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} sm={2}>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label="未入力のみ"
                size="small"
                color={showUnfilledOnly ? 'warning' : 'default'}
                variant={showUnfilledOnly ? 'filled' : 'outlined'}
                onClick={() => {
                  setShowUnfilledOnly(!showUnfilledOnly);
                  if (!showUnfilledOnly) setShowReviewOnly(false);
                }}
                sx={{ cursor: 'pointer', fontWeight: showUnfilledOnly ? 'bold' : 'normal' }}
              />
              <Chip
                label="要見直し"
                size="small"
                color={showReviewOnly ? 'error' : 'default'}
                variant={showReviewOnly ? 'filled' : 'outlined'}
                onClick={() => {
                  setShowReviewOnly(!showReviewOnly);
                  if (!showReviewOnly) setShowUnfilledOnly(false);
                }}
                sx={{ cursor: 'pointer', fontWeight: showReviewOnly ? 'bold' : 'normal' }}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* ─── テーブル ─── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
            {filteredProperties.length}件表示
            {filteredProperties.length !== stats.total && ` (全${stats.total}件中)`}
          </Typography>

          <TableContainer component={Paper} elevation={1} sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 1100 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: PROPERTY_COLOR }}>
                  {[
                    '物件番号',
                    '所在地',
                    '担当',
                    '売出価格',
                    '想定手数料（売主側）\n想定売上（両手率65%）',
                    'ランク',
                    '決済見込み月',
                    '判断理由',
                    '必要な対策',
                    '確認状況',
                    '最終更新',
                    '操作',
                  ].map((h) => (
                    <TableCell
                      key={h}
                      sx={{
                        color: '#fff',
                        fontWeight: 'bold',
                        whiteSpace: 'pre-line',
                        fontSize: '0.75rem',
                        py: 1,
                        px: 1,
                      }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredProperties.map((p) => {
                  const isEditing = editingId === p.property_number;
                  const sellerComm = calcSellerCommission(p.price, p.commission_from_seller);
                  const expectedRev = calcExpectedRevenue(sellerComm);
                  const managerStatus = p.prospect?.manager_check_status ?? '未確認';

                  // 行の背景色
                  const rowBg = isEditing
                    ? '#fffde7'
                    : managerStatus === '要見直し'
                    ? '#fff5f5'
                    : 'inherit';

                  return (
                    <TableRow
                      key={p.property_number}
                      sx={{
                        bgcolor: rowBg,
                        '&:hover': { bgcolor: isEditing ? '#fffde7' : '#f5f5f5' },
                        verticalAlign: 'top',
                      }}
                    >
                      {/* ① 物件番号 */}
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.8rem', px: 1 }}>
                        {p.property_number}
                      </TableCell>

                      {/* ② 所在地 */}
                      <TableCell sx={{ fontSize: '0.75rem', maxWidth: 180, px: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{ display: 'block', wordBreak: 'break-all', lineHeight: 1.4 }}
                        >
                          {p.display_address || p.address || '-'}
                        </Typography>
                      </TableCell>

                      {/* ③ 担当者 */}
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem', px: 1 }}>
                        {p.sales_assignee || '-'}
                      </TableCell>

                      {/* ④ 売出価格 */}
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem', textAlign: 'right', px: 1 }}>
                        {formatPrice(p.price)}
                      </TableCell>

                      {/* ⑤ 想定手数料 */}
                      <TableCell sx={{ fontSize: '0.75rem', textAlign: 'right', px: 1 }}>
                        {sellerComm > 0 ? (
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{ display: 'block', fontWeight: 500 }}
                            >
                              {formatPrice(sellerComm)}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', fontSize: '0.68rem' }}
                            >
                              売上見込：{formatPrice(expectedRev)}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            -
                          </Typography>
                        )}
                      </TableCell>

                      {/* ⑥ 成約見込みランク */}
                      <TableCell sx={{ px: 1 }}>
                        {isEditing ? (
                          <FormControl size="small" sx={{ minWidth: 80 }}>
                            <Select
                              value={editForm.prospect_rank}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, prospect_rank: e.target.value }))
                              }
                              displayEmpty
                            >
                              <MenuItem value="">
                                <em>未選択</em>
                              </MenuItem>
                              {RANK_OPTIONS.map((r) => (
                                <MenuItem
                                  key={r.value}
                                  value={r.value}
                                  sx={{ color: r.color, fontWeight: 'bold' }}
                                >
                                  {r.short}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : p.prospect?.prospect_rank ? (
                          <Tooltip title={RANK_OPTIONS.find((r) => r.value === p.prospect?.prospect_rank)?.desc ?? ''} arrow>
                            <Chip
                              label={p.prospect.prospect_rank}
                              size="small"
                              sx={{
                                bgcolor: getRankColor(p.prospect.prospect_rank),
                                color: '#fff',
                                fontWeight: 'bold',
                                minWidth: 28,
                                fontSize: '0.8rem',
                                cursor: 'help',
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            未入力
                          </Typography>
                        )}
                      </TableCell>

                      {/* ⑦ 決済見込み月 */}
                      <TableCell sx={{ px: 1 }}>
                        {isEditing ? (
                          <TextField
                            type="month"
                            size="small"
                            value={editForm.settlement_expected_month}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                settlement_expected_month: e.target.value,
                              }))
                            }
                            InputLabelProps={{ shrink: true }}
                            sx={{ width: 145 }}
                          />
                        ) : (
                          <Typography
                            variant="body2"
                            sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                          >
                            {formatMonth(p.prospect?.settlement_expected_month)}
                          </Typography>
                        )}
                      </TableCell>

                      {/* ⑧ 判断理由 */}
                      <TableCell sx={{ maxWidth: isEditing ? 220 : 160, px: 1 }}>
                        {isEditing ? (
                          <TextField
                            multiline
                            rows={3}
                            size="small"
                            fullWidth
                            placeholder="成約見込みの判断理由"
                            value={editForm.assessment_reason}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                assessment_reason: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          <Typography
                            variant="caption"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              wordBreak: 'break-all',
                              lineHeight: 1.5,
                            }}
                          >
                            {p.prospect?.assessment_reason || (
                              <span style={{ color: '#bbb' }}>-</span>
                            )}
                          </Typography>
                        )}
                      </TableCell>

                      {/* ⑨ 必要な対策 */}
                      <TableCell sx={{ maxWidth: isEditing ? 220 : 160, px: 1 }}>
                        {isEditing ? (
                          <TextField
                            multiline
                            rows={3}
                            size="small"
                            fullWidth
                            placeholder="成約に向けた必要な対策"
                            value={editForm.required_actions}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                required_actions: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          <Typography
                            variant="caption"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              wordBreak: 'break-all',
                              lineHeight: 1.5,
                            }}
                          >
                            {p.prospect?.required_actions || (
                              <span style={{ color: '#bbb' }}>-</span>
                            )}
                          </Typography>
                        )}
                      </TableCell>

                      {/* ⑩ マネージャー確認状況 */}
                      <TableCell sx={{ px: 1, minWidth: isEditing ? 160 : 100 }}>
                        {isEditing ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={editForm.manager_check_status}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    manager_check_status: e.target.value,
                                    // 未確認に戻す場合はコメントをクリア
                                    manager_comment:
                                      e.target.value === '未確認' ? '' : f.manager_comment,
                                  }))
                                }
                              >
                                {MANAGER_STATUS_OPTIONS.map((s) => (
                                  <MenuItem key={s} value={s}>
                                    {s}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            {editForm.manager_check_status === '要見直し' && (
                              <TextField
                                multiline
                                rows={2}
                                size="small"
                                fullWidth
                                placeholder="見直しコメント（例：価格設定が高いためDで再検討を）"
                                value={editForm.manager_comment}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    manager_comment: e.target.value,
                                  }))
                                }
                              />
                            )}
                          </Box>
                        ) : (
                          <Box>
                            <Chip
                              label={managerStatus}
                              size="small"
                              color={getManagerStatusChipColor(managerStatus)}
                              sx={{ fontSize: '0.7rem', fontWeight: 500 }}
                            />
                            {p.prospect?.manager_comment && (
                              <Tooltip title={p.prospect.manager_comment} arrow>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'block',
                                    mt: 0.5,
                                    color: '#c62828',
                                    cursor: 'help',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: 110,
                                    fontSize: '0.68rem',
                                  }}
                                >
                                  💬 {p.prospect.manager_comment}
                                </Typography>
                              </Tooltip>
                            )}
                            {p.prospect?.manager_checked_by && (
                              <Typography
                                variant="caption"
                                color="text.disabled"
                                sx={{ display: 'block', fontSize: '0.65rem', mt: 0.25 }}
                              >
                                {p.prospect.manager_checked_by}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </TableCell>

                      {/* ⑪ 最終更新日 */}
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.72rem', color: 'text.secondary', px: 1 }}>
                        {p.prospect?.updated_at ? (
                          <>
                            <Typography variant="caption" sx={{ display: 'block' }}>
                              {new Date(p.prospect.updated_at).toLocaleDateString('ja-JP', {
                                month: 'numeric',
                                day: 'numeric',
                              })}
                            </Typography>
                            {p.prospect.updated_by && (
                              <Typography
                                variant="caption"
                                sx={{ display: 'block', fontSize: '0.65rem', color: '#9e9e9e' }}
                              >
                                {p.prospect.updated_by}
                              </Typography>
                            )}
                          </>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            -
                          </Typography>
                        )}
                      </TableCell>

                      {/* 操作ボタン */}
                      <TableCell sx={{ whiteSpace: 'nowrap', px: 1 }}>
                        {isEditing ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<SaveIcon sx={{ fontSize: '0.9rem' }} />}
                              onClick={() => handleSave(p)}
                              disabled={saving}
                              sx={{ fontSize: '0.72rem', py: 0.5, bgcolor: PROPERTY_COLOR }}
                            >
                              保存
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              color="inherit"
                              startIcon={<CancelIcon sx={{ fontSize: '0.9rem' }} />}
                              onClick={handleCancelEdit}
                              disabled={saving}
                              sx={{ fontSize: '0.72rem', py: 0.5 }}
                            >
                              取消
                            </Button>
                          </Box>
                        ) : (
                          <Tooltip title="編集" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(p)}
                              sx={{ color: PROPERTY_COLOR }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredProperties.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary" variant="body2">
                        該当する物件がありません
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* ─── ランク基準ダイアログ ─── */}
      <Dialog
        open={rankGuideOpen}
        onClose={() => setRankGuideOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold', color: PROPERTY_COLOR }}>
          成約見込みランク基準
        </DialogTitle>
        <DialogContent dividers>
          {RANK_OPTIONS.map((r, i) => (
            <Box key={r.value}>
              {i > 0 && <Divider sx={{ my: 1.5 }} />}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Chip
                  label={r.short}
                  size="small"
                  sx={{
                    bgcolor: r.color,
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    minWidth: 28,
                    flexShrink: 0,
                    mt: 0.25,
                  }}
                />
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ color: r.color }}>
                    {r.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {r.desc}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRankGuideOpen(false)} color="primary">
            閉じる
          </Button>
        </DialogActions>
      </Dialog>

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
