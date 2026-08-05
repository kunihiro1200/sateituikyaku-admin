/**
 * 売却スケジュール資料生成モーダル
 * - sellersテーブル: seller_number, name, property_address, valuation_amount_1/2/3
 * - property_listingsテーブル: listing_price, sales_price
 * - AI画像生成を使用しない（lucide-reactのSVGアイコンのみ）
 * - A4縦テンプレート固定・デザイン不変
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Print as PrintIcon,
  PictureAsPdf as PdfIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import api from '../services/api';
import {
  Header,
  PropertyInfoBox,
  Step1,
  Step2,
  Step3and4,
  SupportSection,
  MessageSection,
  Footer,
} from './SaleScheduleComponents';

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────
export interface SaleScheduleData {
  propertyNo: string;
  ownerName: string;
  propertyAddress: string;
  assessPrice?: number;      // 査定価格（valuation_amount_1）
  listPrice?: number;        // 売出価格（listing_price or sales_price）
  minimumPrice?: number;     // 最低売却価格
  startYear?: number;
  startMonth?: number;
  marketingPeriod?: string;  // 例: "2026年9月〜10月"
  contractYear?: number;
  contractMonth?: number;
  settlementYear?: number;
  settlementMonth?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** CallModePageから渡す初期seller情報（省略可） */
  initialSellerNumber?: string;
  initialOwnerName?: string;
  initialPropertyAddress?: string;
  initialAssessPrice?: number;
}

// ─────────────────────────────────────────
// DBデータ → SaleScheduleData 変換
// ─────────────────────────────────────────
function convertDbToScheduleData(
  seller: Record<string, unknown>,
  propertyListing: Record<string, unknown> | null
): Partial<SaleScheduleData> {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startYear = nextMonth.getFullYear();
  const startMonth = nextMonth.getMonth() + 1;
  const contractYear = startMonth + 3 > 12 ? startYear + 1 : startYear;
  const contractMonth = startMonth + 3 > 12 ? (startMonth + 3) - 12 : startMonth + 3;
  const settlementYear = contractMonth + 1 > 12 ? contractYear + 1 : contractYear;
  const settlementMonth = contractMonth + 1 > 12 ? (contractMonth + 1) - 12 : contractMonth + 1;

  const listPrice = (propertyListing?.listing_price as number | null) ||
    (propertyListing?.sales_price as number | null) ||
    undefined;

  const assessPrice = (seller?.valuation_amount_1 as number | null) ||
    (seller?.valuation_amount_2 as number | null) ||
    undefined;

  const mStart = startMonth;
  const mEnd = mStart + 1 > 12 ? 1 : mStart + 1;
  const yEnd = mStart + 1 > 12 ? startYear + 1 : startYear;
  const marketingPeriod = `${startYear}年${mStart}月〜${yEnd}年${mEnd}月`;

  return {
    propertyNo: (seller?.seller_number as string) || '',
    ownerName: (seller?.name as string) || '',
    propertyAddress: (seller?.property_address as string) || '',
    assessPrice: assessPrice ? Math.round(assessPrice / 10000) : undefined,
    listPrice: listPrice ? Math.round(listPrice / 10000) : undefined,
    startYear,
    startMonth,
    marketingPeriod,
    contractYear,
    contractMonth,
    settlementYear,
    settlementMonth,
  };
}

// ─────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────
export const SaleScheduleModal: React.FC<Props> = ({
  open,
  onClose,
  initialSellerNumber = '',
  initialOwnerName = '',
  initialPropertyAddress = '',
  initialAssessPrice,
}) => {
  const [searchNo, setSearchNo] = useState(initialSellerNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultData = (): SaleScheduleData => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const sy = nextMonth.getFullYear();
    const sm = nextMonth.getMonth() + 1;
    const cy = sm + 3 > 12 ? sy + 1 : sy;
    const cm = sm + 3 > 12 ? (sm + 3) - 12 : sm + 3;
    const sety = cm + 1 > 12 ? cy + 1 : cy;
    const setm = cm + 1 > 12 ? (cm + 1) - 12 : cm + 1;
    const me = sm + 1 > 12 ? 1 : sm + 1;
    const ye = sm + 1 > 12 ? sy + 1 : sy;
    return {
      propertyNo: initialSellerNumber,
      ownerName: initialOwnerName,
      propertyAddress: initialPropertyAddress,
      assessPrice: initialAssessPrice ? Math.round(initialAssessPrice / 10000) : undefined,
      listPrice: undefined,
      minimumPrice: undefined,
      startYear: sy,
      startMonth: sm,
      marketingPeriod: `${sy}年${sm}月〜${ye}年${me}月`,
      contractYear: cy,
      contractMonth: cm,
      settlementYear: sety,
      settlementMonth: setm,
    };
  };

  const [data, setData] = useState<SaleScheduleData>(defaultData);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback(async () => {
    if (!searchNo.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/sellers/by-number/${searchNo.trim().toUpperCase()}`);
      const seller = res.data;
      let propertyListing: Record<string, unknown> | null = null;
      try {
        const propRes = await api.get(`/api/property-listings/${searchNo.trim().toUpperCase()}`);
        propertyListing = propRes.data?.property || propRes.data || null;
      } catch {
        // property_listingsが無い場合はスキップ
      }
      const converted = convertDbToScheduleData(seller, propertyListing);
      setData(prev => ({ ...prev, ...converted }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '売主番号が見つかりませんでした');
    } finally {
      setLoading(false);
    }
  }, [searchNo]);

  const handleField = (field: keyof SaleScheduleData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setData(prev => ({
        ...prev,
        [field]: ['assessPrice','listPrice','minimumPrice','startYear','startMonth',
          'contractYear','contractMonth','settlementYear','settlementMonth']
          .includes(field) ? (val === '' ? undefined : Number(val)) : val,
      }));
    };

  const handlePrint = () => {
    window.print();
  };

  const handlePdfSave = () => {
    window.print();
  };

  const fmt = (v?: number) => v != null ? v.toLocaleString() : '―';

  // マーケティング期間の自動更新
  const updateMarketingPeriod = (sy: number, sm: number) => {
    const me = sm + 1 > 12 ? 1 : sm + 1;
    const ye = sm + 1 > 12 ? sy + 1 : sy;
    setData(prev => ({ ...prev, marketingPeriod: `${sy}年${sm}月〜${ye}年${me}月` }));
  };

  return (
    <>
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #sale-schedule-print, #sale-schedule-print * { visibility: visible !important; }
          #sale-schedule-print {
            position: fixed !important;
            left: 0 !important; top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
        PaperProps={{ sx: { maxHeight: '95vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" fontWeight="bold">売却スケジュール資料生成</Typography>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <Divider />

        <DialogContent sx={{ p: 2 }}>
          {/* 検索エリア */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <TextField
              label="売主番号"
              size="small"
              value={searchNo}
              onChange={e => setSearchNo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="例: AA12345"
              sx={{ width: 180 }}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
              onClick={handleSearch}
              disabled={loading}
            >
              物件情報取得
            </Button>
          </Box>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Grid container spacing={2}>
            {/* 左カラム：入力フォーム */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: '#061D3B' }}>
                物件情報
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="物件番号" value={data.propertyNo}
                    onChange={handleField('propertyNo')} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="売主様氏名" value={data.ownerName}
                    onChange={handleField('ownerName')} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="物件所在地" value={data.propertyAddress}
                    onChange={handleField('propertyAddress')} multiline rows={2} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="査定価格（万円）"
                    type="number" value={data.assessPrice ?? ''}
                    onChange={handleField('assessPrice')} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="売出価格（万円）"
                    type="number" value={data.listPrice ?? ''}
                    onChange={handleField('listPrice')} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="最低売却価格（万円）"
                    type="number" value={data.minimumPrice ?? ''}
                    onChange={handleField('minimumPrice')} />
                </Grid>
              </Grid>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, mb: 1, color: '#061D3B' }}>
                スケジュール
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="売出年" type="number"
                    value={data.startYear ?? ''}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setData(prev => ({ ...prev, startYear: v || undefined }));
                      if (v && data.startMonth) updateMarketingPeriod(v, data.startMonth);
                    }} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="売出月" type="number"
                    inputProps={{ min: 1, max: 12 }}
                    value={data.startMonth ?? ''}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setData(prev => ({ ...prev, startMonth: v || undefined }));
                      if (data.startYear && v) updateMarketingPeriod(data.startYear, v);
                    }} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="契約予定年" type="number"
                    value={data.contractYear ?? ''}
                    onChange={e => setData(prev => ({ ...prev, contractYear: Number(e.target.value) || undefined }))} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="契約予定月" type="number"
                    inputProps={{ min: 1, max: 12 }}
                    value={data.contractMonth ?? ''}
                    onChange={e => setData(prev => ({ ...prev, contractMonth: Number(e.target.value) || undefined }))} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="決済予定年" type="number"
                    value={data.settlementYear ?? ''}
                    onChange={e => setData(prev => ({ ...prev, settlementYear: Number(e.target.value) || undefined }))} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="決済予定月" type="number"
                    inputProps={{ min: 1, max: 12 }}
                    value={data.settlementMonth ?? ''}
                    onChange={e => setData(prev => ({ ...prev, settlementMonth: Number(e.target.value) || undefined }))} />
                </Grid>
              </Grid>
            </Grid>

            {/* 右カラム：A4プレビュー */}
            <Grid item xs={12} md={8}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: '#061D3B' }}>
                プレビュー（A4）
              </Typography>
              <Box sx={{
                overflowY: 'auto', maxHeight: 680,
                border: '1px solid #ccc', borderRadius: 1, background: '#e8e8e8', p: 1,
              }}>
                <SaleScheduleA4 data={data} ref={previewRef} fmt={fmt} />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
          <Button onClick={onClose} color="inherit">閉じる</Button>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
            印刷
          </Button>
          <Button variant="contained" startIcon={<PdfIcon />} onClick={handlePdfSave}
            sx={{ bgcolor: '#061D3B', '&:hover': { bgcolor: '#082447' } }}>
            PDF保存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ─────────────────────────────────────────
// A4 テンプレートコンポーネント（デザイン固定）
// ─────────────────────────────────────────
interface A4Props {
  data: SaleScheduleData;
  fmt: (v?: number) => string;
}
const SaleScheduleA4 = React.forwardRef<HTMLDivElement, A4Props>(({ data, fmt }, ref) => {
  // 共通色
  const NAVY = '#061D3B';
  const GOLD = '#C99A3D';
  const BG = '#FFFFFF';
  const BG_LIGHT = '#F6F7F9';

  // インラインスタイル（印刷時も再現）
  const a4: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    maxHeight: '297mm',
    background: BG,
    fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic Pro', 'Meiryo', sans-serif",
    fontSize: '9pt',
    color: '#1a1a1a',
    boxSizing: 'border-box',
    overflow: 'hidden',
    pageBreakAfter: 'always',
    printColorAdjust: 'exact',
    WebkitPrintColorAdjust: 'exact',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties;

  const padded: React.CSSProperties = {
    padding: '10mm 10mm 8mm 10mm',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4mm',
  };

  return (
    <div id="sale-schedule-print" ref={ref} style={a4}>
      {/* ── HEADER ── */}
      <Header navy={NAVY} gold={GOLD} />
      <div style={padded}>
        {/* ── 物件情報 ── */}
        <PropertyInfoBox data={data} navy={NAVY} bgLight={BG_LIGHT} />
        {/* ── STEP 1 ── */}
        <Step1 data={data} navy={NAVY} gold={GOLD} bgLight={BG_LIGHT} fmt={fmt} />
        {/* ── STEP 2 ── */}
        <Step2 data={data} navy={NAVY} gold={GOLD} bgLight={BG_LIGHT} />
        {/* ── STEP 3 + 4 ── */}
        <Step3and4 data={data} navy={NAVY} gold={GOLD} bgLight={BG_LIGHT} fmt={fmt} />
        {/* ── サポート体制 ── */}
        <SupportSection navy={NAVY} gold={GOLD} bgLight={BG_LIGHT} />
        {/* ── メッセージ ── */}
        <MessageSection navy={NAVY} gold={GOLD} />
      </div>
      {/* ── FOOTER ── */}
      <Footer navy={NAVY} gold={GOLD} />
    </div>
  );
});
SaleScheduleA4.displayName = 'SaleScheduleA4';

export default SaleScheduleModal;
