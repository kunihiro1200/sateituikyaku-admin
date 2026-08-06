/**
 * 売却スケジュール資料生成モーダル
 *
 * 方式: 背景画像固定 + 文字のみ position:absolute で重ねる
 * 背景: /sale-schedule/illustrations/template.png (210mm × 297mm)
 * 印刷: 別ウィンドウ方式
 * プレビュー: iframe srcDoc 方式
 *
 * ========================================================
 * 座標定数一覧（A4左上原点・mm単位）
 * ※ 微調整はここだけ変更すればよい
 * ========================================================
 *
 * FIELD_COORDS = {
 *   propertyNo:          { left:49,  top:30.5, w:100, h:6,  fs:'9pt',  fw:600,   color:'#1a1a1a', align:'left'  }
 *   ownerName:           { left:49,  top:36.5, w:100, h:6,  fs:'9pt',  fw:600,   color:'#1a1a1a', align:'left'  }
 *   propertyAddress:     { left:49,  top:42.5, w:148, h:10, fs:'8.5pt',fw:600,   color:'#1a1a1a', align:'left'  } ←長い場合に縮小
 *   listPrice:           { left:74,  top:67,   w:60,  h:9,  fs:'18pt', fw:900,   color:'#C99A3D', align:'left'  }
 *   startYear:           { left:34,  top:73,   w:22,  h:5,  fs:'7.5pt',fw:700,   color:'#061D3B', align:'center'}
 *   startMonth:          { left:30,  top:78.5, w:28,  h:9,  fs:'15pt', fw:900,   color:'#C99A3D', align:'center'}
 *   marketingYear:       { left:27,  top:124,  w:28,  h:5,  fs:'7pt',  fw:700,   color:'#061D3B', align:'center'}
 *   marketingMonths:     { left:20,  top:129,  w:40,  h:9,  fs:'12pt', fw:900,   color:'#C99A3D', align:'center'}
 *   minimumPrice:        { left:74,  top:160,  w:60,  h:8,  fs:'16pt', fw:900,   color:'#C99A3D', align:'left'  }
 *   contractYear:        { left:34,  top:167,  w:22,  h:5,  fs:'7.5pt',fw:700,   color:'#061D3B', align:'center'}
 *   contractMonth:       { left:30,  top:172,  w:28,  h:9,  fs:'15pt', fw:900,   color:'#C99A3D', align:'center'}
 *   settlementYear:      { left:34,  top:198,  w:22,  h:5,  fs:'7.5pt',fw:700,   color:'#061D3B', align:'center'}
 *   settlementMonthMid:  { left:25,  top:203,  w:36,  h:8,  fs:'11pt', fw:900,   color:'#C99A3D', align:'center'}
 * }
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, Box, Typography,
  CircularProgress, Alert, Divider, IconButton,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon, Search as SearchIcon } from '@mui/icons-material';
import api from '../services/api';

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────
export interface SaleScheduleData {
  propertyNo: string;
  ownerName: string;
  propertyAddress: string;
  assessPrice?: number;
  listPrice?: number;
  minimumPrice?: number;
  startYear?: number;
  startMonth?: number;
  marketingYear?: number;
  marketingStartMonth?: number;
  marketingEndMonth?: number;
  contractYear?: number;
  contractMonth?: number;
  settlementYear?: number;
  settlementMonth?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialSellerNumber?: string;
  initialOwnerName?: string;
  initialPropertyAddress?: string;
  initialAssessPrice?: number; // 円
}

// ─────────────────────────────────────────
// 日付計算
// ─────────────────────────────────────────
function calcDates() {
  const now = new Date();
  const sy = now.getMonth() >= 11 ? now.getFullYear() + 1 : now.getFullYear();
  const sm = now.getMonth() >= 11 ? 1 : now.getMonth() + 2;
  const cy = sm + 3 > 12 ? sy + 1 : sy;
  const cm = sm + 3 > 12 ? (sm + 3) - 12 : sm + 3;
  const sety = cm + 1 > 12 ? cy + 1 : cy;
  const setm = cm + 1 > 12 ? (cm + 1) - 12 : cm + 1;
  const ms = sm + 1 > 12 ? 1 : sm + 1;
  const me = sm + 2 > 12 ? (sm + 2) - 12 : sm + 2;
  const my = ms < sm ? sy + 1 : sy;
  return { sy, sm, cy, cm, sety, setm, ms, me, my };
}

// ─────────────────────────────────────────
// DB変換
// ─────────────────────────────────────────
function convertDb(seller: Record<string, unknown>, pl: Record<string, unknown> | null): Partial<SaleScheduleData> {
  const { sy, sm, cy, cm, sety, setm, ms, me, my } = calcDates();
  const listRaw = (pl?.listing_price as number | null) || (pl?.sales_price as number | null) || null;
  const assessRaw = (seller?.valuation_amount_1 as number | null) || (seller?.valuation_amount_2 as number | null) || null;
  return {
    propertyNo: (seller?.seller_number as string) || '',
    ownerName: (seller?.name as string) || '',
    propertyAddress: (seller?.property_address as string) || '',
    assessPrice: assessRaw ? Math.round(assessRaw / 10000) : undefined,
    listPrice: listRaw ? Math.round(listRaw / 10000) : undefined,
    startYear: sy, startMonth: sm,
    marketingYear: my, marketingStartMonth: ms, marketingEndMonth: me,
    contractYear: cy, contractMonth: cm,
    settlementYear: sety, settlementMonth: setm,
  };
}

// ─────────────────────────────────────────
// 様の重複防止
// ─────────────────────────────────────────
function withSama(name: string): string {
  const n = name.trim();
  if (!n) return '';
  return n.endsWith('様') ? n : `${n}　様`;
}

// ─────────────────────────────────────────
// 数値フォーマット
// ─────────────────────────────────────────
const fmtNum = (v?: number) => v != null ? v.toLocaleString() : '';

// ─────────────────────────────────────────
// A4 HTML生成（背景画像 + 絶対座標テキスト）
// ─────────────────────────────────────────
function buildA4Html(d: SaleScheduleData): string {
  // 物件所在地のフォントサイズ（長さに応じて段階縮小、位置は変えない）
  const addrLen = (d.propertyAddress || '').length;
  const addrFontSize = addrLen > 36 ? '6.5pt' : addrLen > 26 ? '7.5pt' : '8.5pt';

  // 売主名（様付き）
  const ownerDisplay = withSama(d.ownerName || '');

  // 販売活動期間
  const marketingStr = (d.marketingStartMonth && d.marketingEndMonth)
    ? `${d.marketingStartMonth}月〜${d.marketingEndMonth}月`
    : '';

  // フィールド生成ヘルパー（完全固定座標）
  const f = (
    content: string,
    left: number, top: number,
    width: number, height: number,
    fontSize: string, fontWeight: number,
    color: string, textAlign: string,
    lineHeight = '1.2',
    extra = ''
  ) => `<div style="
    position:absolute;
    left:${left}mm; top:${top}mm;
    width:${width}mm; height:${height}mm;
    font-size:${fontSize}; font-weight:${fontWeight}; color:${color};
    text-align:${textAlign}; line-height:${lineHeight};
    overflow:hidden; white-space:nowrap;
    ${extra}
  ">${content}</div>`;

  // 物件所在地のみ折り返しあり
  const addrField = `<div style="
    position:absolute;
    left:49mm; top:42.5mm;
    width:148mm; height:10mm;
    font-size:${addrFontSize}; font-weight:600; color:#1a1a1a;
    text-align:left; line-height:1.35;
    overflow:hidden;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
    word-break:break-all;
  ">${d.propertyAddress || ''}</div>`;

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>売却スケジュール</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 210mm; height: 297mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-family: 'Noto Sans JP','Hiragino Kaku Gothic Pro','Meiryo',sans-serif;
  }
  .a4-page {
    position: relative;
    width: 210mm;
    height: 297mm;
    overflow: hidden;
  }
  .bg {
    position: absolute;
    inset: 0;
    width: 210mm;
    height: 297mm;
    object-fit: fill;
    z-index: 0;
  }
  .layer {
    position: absolute;
    inset: 0;
    width: 210mm;
    height: 297mm;
    z-index: 10;
  }
</style>
</head><body>
<div class="a4-page">

  <!-- ■ 背景テンプレート（変更禁止） -->
  <img class="bg"
    src="/sale-schedule/illustrations/template.png"
    alt="" />

  <!-- ■ 動的テキストレイヤー（座標固定・値のみ差し替え） -->
  <div class="layer">

    <!-- 物件番号  left:49mm top:30.5mm w:100mm h:6mm fs:9pt fw:600 -->
    ${f(d.propertyNo || '', 49, 30.5, 100, 6, '9pt', 600, '#1a1a1a', 'left')}

    <!-- 売主名    left:49mm top:36.5mm w:100mm h:6mm fs:9pt fw:600 -->
    ${f(ownerDisplay, 49, 36.5, 100, 6, '9pt', 600, '#1a1a1a', 'left')}

    <!-- 物件所在地 left:49mm top:42.5mm w:148mm h:10mm fs:可変 fw:600 （折り返し2行） -->
    ${addrField}

    <!-- 売出価格  left:74mm top:67mm w:60mm h:9mm fs:18pt fw:900 color:GOLD -->
    ${f(fmtNum(d.listPrice), 74, 67, 60, 9, '18pt', 900, '#C99A3D', 'left', '1.0')}

    <!-- STEP1 年  left:34mm top:73mm w:22mm h:5mm fs:7.5pt fw:700 color:NAVY -->
    ${f(d.startYear ? `${d.startYear}年` : '', 34, 73, 22, 5, '7.5pt', 700, '#061D3B', 'center')}

    <!-- STEP1 月  left:30mm top:78.5mm w:28mm h:9mm fs:15pt fw:900 color:GOLD -->
    ${f(d.startMonth ? `${d.startMonth}月` : '', 30, 78.5, 28, 9, '15pt', 900, '#C99A3D', 'center', '1.0')}

    <!-- STEP2 年  left:27mm top:124mm w:28mm h:5mm fs:7pt fw:700 color:NAVY -->
    ${f(d.marketingYear ? `${d.marketingYear}年` : '', 27, 124, 28, 5, '7pt', 700, '#061D3B', 'center')}

    <!-- STEP2 月〜月  left:20mm top:129mm w:40mm h:9mm fs:12pt fw:900 color:GOLD -->
    ${f(marketingStr, 20, 129, 40, 9, '12pt', 900, '#C99A3D', 'center', '1.0')}

    <!-- 最低価格  left:74mm top:160mm w:60mm h:8mm fs:16pt fw:900 color:GOLD -->
    ${f(fmtNum(d.minimumPrice), 74, 160, 60, 8, '16pt', 900, '#C99A3D', 'left', '1.0')}

    <!-- STEP3 年  left:34mm top:167mm w:22mm h:5mm fs:7.5pt fw:700 color:NAVY -->
    ${f(d.contractYear ? `${d.contractYear}年` : '', 34, 167, 22, 5, '7.5pt', 700, '#061D3B', 'center')}

    <!-- STEP3 月  left:30mm top:172mm w:28mm h:9mm fs:15pt fw:900 color:GOLD -->
    ${f(d.contractMonth ? `${d.contractMonth}月` : '', 30, 172, 28, 9, '15pt', 900, '#C99A3D', 'center', '1.0')}

    <!-- STEP4 年  left:34mm top:198mm w:22mm h:5mm fs:7.5pt fw:700 color:NAVY -->
    ${f(d.settlementYear ? `${d.settlementYear}年` : '', 34, 198, 22, 5, '7.5pt', 700, '#061D3B', 'center')}

    <!-- STEP4 月中旬  left:25mm top:203mm w:36mm h:8mm fs:11pt fw:900 color:GOLD -->
    ${f(d.settlementMonth ? `${d.settlementMonth}月中旬` : '', 25, 203, 36, 8, '11pt', 900, '#C99A3D', 'center', '1.0')}

  </div>
</div>
</body></html>`;
}

// ─────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────
export const SaleScheduleModal: React.FC<Props> = ({
  open, onClose,
  initialSellerNumber = '',
  initialOwnerName = '',
  initialPropertyAddress = '',
  initialAssessPrice,
}) => {
  const NAVY = '#061D3B';
  const { sy, sm, cy, cm, sety, setm, ms, me, my } = calcDates();

  const [searchNo, setSearchNo] = useState(initialSellerNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SaleScheduleData>({
    propertyNo: initialSellerNumber,
    ownerName: initialOwnerName,
    propertyAddress: initialPropertyAddress,
    assessPrice: initialAssessPrice ? Math.round(initialAssessPrice / 10000) : undefined,
    listPrice: undefined,
    minimumPrice: undefined,
    startYear: sy, startMonth: sm,
    marketingYear: my, marketingStartMonth: ms, marketingEndMonth: me,
    contractYear: cy, contractMonth: cm,
    settlementYear: sety, settlementMonth: setm,
  });

  const handleSearch = useCallback(async () => {
    if (!searchNo.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/api/sellers/by-number/${searchNo.trim().toUpperCase()}`);
      let pl: Record<string, unknown> | null = null;
      try {
        const pr = await api.get(`/api/property-listings/${searchNo.trim().toUpperCase()}`);
        pl = pr.data?.property || pr.data || null;
      } catch { /* property_listings なし */ }
      setData(prev => ({ ...prev, ...convertDb(res.data, pl) }));
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || '売主番号が見つかりませんでした');
    } finally { setLoading(false); }
  }, [searchNo]);

  const setNum = (field: keyof SaleScheduleData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setData(p => ({ ...p, [field]: v === '' ? undefined : Number(v) }));
  };
  const setStr = (field: keyof SaleScheduleData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setData(p => ({ ...p, [field]: e.target.value }));
  };

  const handlePrint = useCallback(() => {
    const html = buildA4Html(data);
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) { alert('ポップアップブロックを解除してください。'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 600);
  }, [data]);

  const previewHtml = buildA4Html(data);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { maxHeight: '96vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" fontWeight="bold">売却スケジュール資料生成</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 2 }}>
        {/* 検索 */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
          <TextField label="売主番号" size="small" value={searchNo}
            onChange={e => setSearchNo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="例: FI737" sx={{ width: 180 }} />
          <Button variant="contained" size="small"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
            onClick={handleSearch} disabled={loading}>
            物件情報取得
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          {/* 左：編集フォーム */}
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: NAVY }}>物件情報</Typography>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="物件番号" value={data.propertyNo} onChange={setStr('propertyNo')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="売主様氏名" value={data.ownerName}
                  onChange={setStr('ownerName')} helperText="「様」は自動で付きます" />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="物件所在地" value={data.propertyAddress}
                  onChange={setStr('propertyAddress')} multiline rows={2} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="売出価格（万円）" type="number"
                  value={data.listPrice ?? ''} onChange={setNum('listPrice')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="最低売却価格（万円）" type="number"
                  value={data.minimumPrice ?? ''} onChange={setNum('minimumPrice')} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, mb: 1, color: NAVY }}>STEP1 売り出し開始</Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="年" type="number" value={data.startYear ?? ''} onChange={setNum('startYear')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="月" type="number" value={data.startMonth ?? ''}
                  inputProps={{ min: 1, max: 12 }} onChange={setNum('startMonth')} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1.5, mb: 1, color: NAVY }}>STEP2 販売活動強化</Typography>
            <Grid container spacing={1}>
              <Grid item xs={4}>
                <TextField fullWidth size="small" label="年" type="number" value={data.marketingYear ?? ''} onChange={setNum('marketingYear')} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth size="small" label="開始月" type="number" value={data.marketingStartMonth ?? ''}
                  inputProps={{ min: 1, max: 12 }} onChange={setNum('marketingStartMonth')} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth size="small" label="終了月" type="number" value={data.marketingEndMonth ?? ''}
                  inputProps={{ min: 1, max: 12 }} onChange={setNum('marketingEndMonth')} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1.5, mb: 1, color: NAVY }}>STEP3 売買契約</Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="年" type="number" value={data.contractYear ?? ''} onChange={setNum('contractYear')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="月" type="number" value={data.contractMonth ?? ''}
                  inputProps={{ min: 1, max: 12 }} onChange={setNum('contractMonth')} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1.5, mb: 1, color: NAVY }}>STEP4 決済・引渡し</Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="年" type="number" value={data.settlementYear ?? ''} onChange={setNum('settlementYear')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="月" type="number" value={data.settlementMonth ?? ''}
                  inputProps={{ min: 1, max: 12 }} onChange={setNum('settlementMonth')} />
              </Grid>
            </Grid>
          </Grid>

          {/* 右：A4プレビュー（iframe原寸） */}
          <Grid item xs={12} md={8}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: NAVY }}>
              プレビュー（A4）※ 座標は微調整可能
            </Typography>
            <Box sx={{
              border: '1px solid #ccc', borderRadius: 1,
              overflow: 'hidden', height: 640,
              background: '#f0f0f0',
            }}>
              <iframe
                srcDoc={previewHtml}
                title="売却スケジュールプレビュー"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit">閉じる</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}
          sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#082447' } }}>
          印刷 / PDF保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaleScheduleModal;
