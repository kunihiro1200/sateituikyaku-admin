/**
 * 手残りリスト資料生成モーダル
 * - 査定額の最高額から100万単位で最低価格まで表示
 * - 仲介手数料・印紙代・抵当権抹消・譲渡所得税を計算
 * - A4縦テンプレート固定・AI画像生成禁止
 */
import React, { useState, useMemo, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, Box, Typography,
  Divider, IconButton, FormControlLabel, Checkbox,
  RadioGroup, Radio, FormControl, FormLabel,
  Alert, Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Print as PrintIcon,
  PictureAsPdf as PdfIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

// ─────────────────────────────────────────
// 計算関数
// ─────────────────────────────────────────

/** 仲介手数料（税込）: 800万以下→33万円、それ以外→売買価格×3%+6万×1.1 */
export const calcBrokerageFee = (priceYen: number): number => {
  if (priceYen <= 8_000_000) return 330_000;
  return Math.round((priceYen * 0.03 + 60_000) * 1.1);
};

/** 売買契約書印紙代（軽減税率適用後の現行額） */
export const calcStampDuty = (priceYen: number): number => {
  if (priceYen <= 100_000) return 200;
  if (priceYen <= 500_000) return 200;
  if (priceYen <= 1_000_000) return 500;
  if (priceYen <= 5_000_000) return 1_000;
  if (priceYen <= 10_000_000) return 5_000;
  if (priceYen <= 50_000_000) return 10_000;
  if (priceYen <= 100_000_000) return 30_000;
  if (priceYen <= 500_000_000) return 60_000;
  if (priceYen <= 1_000_000_000) return 160_000;
  return 320_000;
};

/** 減価償却費計算（建物部分）
 * 木造: 耐用年数22年（0.046）、RC: 47年（0.022）、軽量鉄骨: 27年（0.038）
 * デフォルトは木造
 */
const DEPRECIATION_RATE_WOOD = 0.046;

/** 譲渡所得税計算 */
export interface TransferTaxInput {
  mode: 'unknown' | 'known' | 'none';
  salePrice: number;         // 円
  acquisitionCost?: number;  // 円（取得費明確の場合）
  purchaseYear?: number;     // 購入年（建物減価償却計算用）
  saleYear?: number;         // 売却年（所有期間計算用）
  landRatio?: number;        // 土地割合 0~1（デフォルト0.3）
  buildingRatio?: number;    // 建物割合（デフォルト0.7）
}

export const calcTransferTax = (input: TransferTaxInput): {
  taxAmount: number;
  taxableGain: number;
  acquisitionCostUsed: number;
  holdingYears: number;
  isLongTerm: boolean;
  depreciationAmount: number;
  buildingAcquisitionCost: number;
} => {
  const currentYear = new Date().getFullYear();
  const saleYear = input.saleYear ?? currentYear;

  if (input.mode === 'none') {
    return { taxAmount: 0, taxableGain: 0, acquisitionCostUsed: 0, holdingYears: 0, isLongTerm: false, depreciationAmount: 0, buildingAcquisitionCost: 0 };
  }

  const landRatio = input.landRatio ?? 0.3;
  const buildingRatio = input.buildingRatio ?? 0.7;

  let acquisitionCostUsed: number;
  let depreciationAmount = 0;
  let buildingAcquisitionCost = 0;
  let holdingYears = 0;

  if (input.mode === 'unknown') {
    // 取得費不明: 売買価格の5%
    acquisitionCostUsed = Math.round(input.salePrice * 0.05);
  } else {
    // 取得費明確: 建物部分を減価償却
    const totalCost = input.acquisitionCost ?? 0;
    buildingAcquisitionCost = Math.round(totalCost * buildingRatio);
    const purchaseYear = input.purchaseYear ?? (saleYear - 10);
    holdingYears = saleYear - purchaseYear;
    // 建物減価償却: 取得価額 × 0.9 × 償却率 × 経過年数
    depreciationAmount = Math.round(buildingAcquisitionCost * 0.9 * DEPRECIATION_RATE_WOOD * Math.max(holdingYears, 1));
    const buildingBookValue = Math.max(buildingAcquisitionCost - depreciationAmount, Math.round(buildingAcquisitionCost * 0.05));
    const landCost = Math.round(totalCost * landRatio);
    acquisitionCostUsed = landCost + buildingBookValue;
  }

  // 譲渡所得 = 売買価格 - 取得費 - 仲介手数料（譲渡費用）
  const transferExpense = calcBrokerageFee(input.salePrice);
  const gain = input.salePrice - acquisitionCostUsed - transferExpense;
  const taxableGain = Math.max(gain, 0);

  // 所有期間（取得費明確の場合のみ正確に計算）
  if (input.mode === 'known' && input.purchaseYear) {
    holdingYears = saleYear - input.purchaseYear;
  }
  const isLongTerm = holdingYears > 5 || input.mode === 'unknown';
  // 長期: 20.315%、短期: 39.63%
  const taxRate = isLongTerm ? 0.20315 : 0.3963;
  const taxAmount = Math.round(taxableGain * taxRate);

  return { taxAmount, taxableGain, acquisitionCostUsed, holdingYears, isLongTerm, depreciationAmount, buildingAcquisitionCost };
};

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────
export interface NetProceedsRow {
  priceYen: number;
  brokerageFee: number;
  stampDuty: number;
  mortgageRelease: number;  // 抵当権抹消費用
  transferTax: number;      // 譲渡所得税
  netProceeds: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialOwnerName?: string;
  initialPropertyAddress?: string;
  initialMaxPrice?: number;   // 円
  initialMinPrice?: number;   // 円
}

// ─────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────
export const NetProceedsListModal: React.FC<Props> = ({
  open, onClose,
  initialOwnerName = '',
  initialPropertyAddress = '',
  initialMaxPrice,
  initialMinPrice,
}) => {
  const NAVY = '#061D3B';
  const GOLD = '#C99A3D';
  const BG_LIGHT = '#F6F7F9';

  // ── 入力状態 ──
  const [ownerName, setOwnerName] = useState(initialOwnerName);
  const [propertyAddress, setPropertyAddress] = useState(initialPropertyAddress);
  const [maxPriceMan, setMaxPriceMan] = useState(
    initialMaxPrice ? Math.round(initialMaxPrice / 10_000).toString() : ''
  );
  const [minPriceMan, setMinPriceMan] = useState(
    initialMinPrice ? Math.round(initialMinPrice / 10_000).toString() : ''
  );

  // 抵当権抹消
  const [hasMortgage, setHasMortgage] = useState(true);

  // 譲渡所得税
  const [taxMode, setTaxMode] = useState<'unknown' | 'known' | 'none'>('unknown');
  const [acquisitionCostMan, setAcquisitionCostMan] = useState('');
  const [purchaseYear, setPurchaseYear] = useState('');

  const previewRef = useRef<HTMLDivElement>(null);

  // モーダルが開くたびに初期値を同期
  React.useEffect(() => {
    if (open) {
      setOwnerName(initialOwnerName);
      setPropertyAddress(initialPropertyAddress);
      setMaxPriceMan(initialMaxPrice ? Math.round(initialMaxPrice / 10_000).toString() : '');
      setMinPriceMan(initialMinPrice ? Math.round(initialMinPrice / 10_000).toString() : '');
    }
  }, [open, initialOwnerName, initialPropertyAddress, initialMaxPrice, initialMinPrice]);

  // ── 計算 ──
  const rows = useMemo((): NetProceedsRow[] => {
    const maxYen = parseFloat(maxPriceMan) * 10_000 || 0;
    const minYen = parseFloat(minPriceMan) * 10_000 || 0;
    if (maxYen <= 0) return [];
    const step = 1_000_000; // 100万刻み
    const prices: number[] = [];
    for (let p = maxYen; p >= (minYen > 0 ? minYen : maxYen - step * 9); p -= step) {
      prices.push(p);
    }
    if (minYen > 0 && prices[prices.length - 1] > minYen) prices.push(minYen);

    return prices.map(priceYen => {
      const brokerageFee = calcBrokerageFee(priceYen);
      const stampDuty = calcStampDuty(priceYen);
      const mortgageRelease = hasMortgage ? 50_000 : 0;
      const { taxAmount } = calcTransferTax({
        mode: taxMode,
        salePrice: priceYen,
        acquisitionCost: acquisitionCostMan ? parseFloat(acquisitionCostMan) * 10_000 : undefined,
        purchaseYear: purchaseYear ? parseInt(purchaseYear) : undefined,
        saleYear: new Date().getFullYear(),
      });
      const netProceeds = priceYen - brokerageFee - stampDuty - mortgageRelease - taxAmount;
      return { priceYen, brokerageFee, stampDuty, mortgageRelease, transferTax: taxAmount, netProceeds };
    });
  }, [maxPriceMan, minPriceMan, hasMortgage, taxMode, acquisitionCostMan, purchaseYear]);

  // 税計算の詳細（代表値: 最高額で表示）
  const taxDetail = useMemo(() => {
    if (taxMode === 'none' || !maxPriceMan) return null;
    const maxYen = parseFloat(maxPriceMan) * 10_000 || 0;
    if (maxYen <= 0) return null;
    return calcTransferTax({
      mode: taxMode,
      salePrice: maxYen,
      acquisitionCost: acquisitionCostMan ? parseFloat(acquisitionCostMan) * 10_000 : undefined,
      purchaseYear: purchaseYear ? parseInt(purchaseYear) : undefined,
      saleYear: new Date().getFullYear(),
    });
  }, [taxMode, maxPriceMan, acquisitionCostMan, purchaseYear]);

  const fmtMan = (yen: number, approx = false) => {
    const man = yen / 10_000;
    const str = Number.isInteger(man) ? `${man.toLocaleString()}万円` : `${man.toFixed(2)}万円`;
    return approx ? `約${str}` : str;
  };

  const handlePrint = () => {
    const html = buildNetProceedsHtml({
      ownerName, propertyAddress, rows, hasMortgage, taxMode,
      acquisitionCostMan, purchaseYear, taxDetail,
      fmtMan: (yen: number, approx = false) => {
        const man = yen / 10_000;
        const str = Number.isInteger(man) ? `${man.toLocaleString()}万円` : `${man.toFixed(2)}万円`;
        return approx ? `約${str}` : str;
      },
      debug: false,
    });
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) { alert('ポップアップブロックを解除してください。'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 600);
  };

  const [debugMode, setDebugMode] = React.useState(true);

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #net-proceeds-print, #net-proceeds-print * { visibility: visible !important; }
          #net-proceeds-print {
            position: fixed !important;
            left: 0 !important; top: 0 !important;
            width: 210mm !important; margin: 0 !important; padding: 0 !important;
            box-shadow: none !important;
          }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth
        PaperProps={{ sx: { maxHeight: '96vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" fontWeight="bold">手残りリスト 資料生成</Typography>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 2 }}>
          <Grid container spacing={2}>
            {/* 左：入力フォーム */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: NAVY }}>物件情報</Typography>
              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="売主様氏名" value={ownerName}
                    onChange={e => setOwnerName(e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="物件所在地" value={propertyAddress}
                    onChange={e => setPropertyAddress(e.target.value)} multiline rows={2} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="査定最高額（万円）" type="number"
                    value={maxPriceMan} onChange={e => setMaxPriceMan(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="最低価格（万円）" type="number"
                    value={minPriceMan} onChange={e => setMinPriceMan(e.target.value)}
                    helperText="空欄=最高額から9段階" />
                </Grid>
              </Grid>

              <Divider sx={{ my: 1.5 }} />

              {/* 抵当権抹消 */}
              <FormControlLabel
                control={<Checkbox checked={hasMortgage} onChange={e => setHasMortgage(e.target.checked)}
                  sx={{ color: NAVY }} />}
                label={<Typography variant="body2" fontWeight="bold">抵当権抹消費用あり（5万円）</Typography>}
              />

              <Divider sx={{ my: 1.5 }} />

              {/* 譲渡所得税 */}
              <FormControl component="fieldset">
                <FormLabel sx={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY, mb: 0.5 }}>
                  譲渡所得税
                </FormLabel>
                <RadioGroup value={taxMode} onChange={e => setTaxMode(e.target.value as typeof taxMode)}>
                  <FormControlLabel value="none" control={<Radio size="small" />} label="なし" />
                  <FormControlLabel value="unknown" control={<Radio size="small" />}
                    label={<Typography variant="body2">あり ─ 取得費不明（売価の5%で計算）</Typography>} />
                  <FormControlLabel value="known" control={<Radio size="small" />}
                    label={<Typography variant="body2">あり ─ 取得費明確</Typography>} />
                </RadioGroup>
              </FormControl>

              {taxMode === 'known' && (
                <Grid container spacing={1} sx={{ mt: 0.5 }}>
                  <Grid item xs={6}>
                    <TextField fullWidth size="small" label="取得費（万円）" type="number"
                      value={acquisitionCostMan} onChange={e => setAcquisitionCostMan(e.target.value)} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField fullWidth size="small" label="購入年（例:2010）" type="number"
                      value={purchaseYear} onChange={e => setPurchaseYear(e.target.value)} />
                  </Grid>
                  <Grid item xs={12}>
                    <Alert severity="info" sx={{ fontSize: '0.7rem', py: 0 }}>
                      土地:建物＝3:7で按分。建物は木造(0.046)で減価償却。
                      5年超所有: 長期譲渡所得税率20.315%。
                    </Alert>
                  </Grid>
                </Grid>
              )}

              {taxDetail && (
                <Box sx={{ mt: 1, p: 1.5, bgcolor: BG_LIGHT, borderRadius: 1, border: `1px solid ${NAVY}22` }}>
                  <Typography variant="caption" fontWeight="bold" color={NAVY}>
                    譲渡所得税 計算根拠（査定最高額ベース）
                  </Typography>
                  {taxMode === 'unknown' && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      取得費: {fmtMan(taxDetail.acquisitionCostUsed)}（売価×5%）<br />
                      課税譲渡所得: {fmtMan(taxDetail.taxableGain)}<br />
                      税率: {taxDetail.isLongTerm ? '20.315%（長期）' : '39.63%（短期）'}<br />
                      <strong>概算税額: {fmtMan(taxDetail.taxAmount, true)}</strong>
                    </Typography>
                  )}
                  {taxMode === 'known' && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      減価償却: {fmtMan(taxDetail.depreciationAmount)}<br />
                      取得費（減価償却後）: {fmtMan(taxDetail.acquisitionCostUsed)}<br />
                      所有期間: 約{taxDetail.holdingYears}年
                      （{taxDetail.isLongTerm ? '長期' : '短期'}）<br />
                      課税譲渡所得: {fmtMan(taxDetail.taxableGain)}<br />
                      <strong>概算税額: {fmtMan(taxDetail.taxAmount, true)}</strong>
                    </Typography>
                  )}
                </Box>
              )}
            </Grid>

            {/* 右：iframeプレビュー */}
            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: NAVY }}>
                  プレビュー（A4）
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color={debugMode ? 'error' : 'text.secondary'}>
                    {debugMode ? '🔴 デバッグON' : 'デバッグOFF'}
                  </Typography>
                  <input type="checkbox" checked={debugMode} onChange={e => setDebugMode(e.target.checked)} />
                </Box>
              </Box>
              <Box sx={{
                width: 550, height: 660,
                overflow: 'hidden', border: '2px solid #ccc',
                borderRadius: 1, background: '#666',
                position: 'relative',
              }}>
                <iframe
                  srcDoc={buildNetProceedsHtml({
                    ownerName, propertyAddress, rows, hasMortgage, taxMode,
                    acquisitionCostMan, purchaseYear, taxDetail,
                    fmtMan: (yen: number, approx = false) => {
                      const man = yen / 10_000;
                      const str = Number.isInteger(man) ? `${man.toLocaleString()}万円` : `${man.toFixed(2)}万円`;
                      return approx ? `約${str}` : str;
                    },
                    debug: debugMode,
                  })}
                  title="手残りリストプレビュー"
                  style={{
                    position: 'absolute', left: 0, top: 0,
                    width: `${210 * 3.7795}px`,
                    height: `${297 * 3.7795}px`,
                    border: 'none',
                    transformOrigin: 'top left',
                    transform: `scale(${Math.min(550 / (210 * 3.7795), 660 / (297 * 3.7795))})`,
                    background: '#fff',
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
          <Button onClick={onClose} color="inherit">閉じる</Button>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>印刷</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}
            sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#082447' } }}>
            PDF保存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ─────────────────────────────────────────
// デバッググリッド生成
// ─────────────────────────────────────────
function buildNpDebugGrid(): string {
  let html = '';
  for (let x = 0; x <= 210; x += 5) {
    const c = x % 10 === 0 ? 'rgba(255,0,0,0.35)' : 'rgba(255,100,100,0.18)';
    html += `<div style="position:absolute;left:${x}mm;top:0;width:0;height:297mm;border-left:1px solid ${c};pointer-events:none;"></div>`;
    if (x % 10 === 0 && x > 0)
      html += `<div style="position:absolute;left:${x+0.3}mm;top:0.5mm;font-size:4.5pt;color:red;opacity:0.7;">${x}</div>`;
  }
  for (let y = 0; y <= 297; y += 5) {
    const c = y % 10 === 0 ? 'rgba(255,0,0,0.35)' : 'rgba(255,100,100,0.18)';
    html += `<div style="position:absolute;left:0;top:${y}mm;width:210mm;height:0;border-top:1px solid ${c};pointer-events:none;"></div>`;
    if (y % 10 === 0 && y > 0)
      html += `<div style="position:absolute;left:0.3mm;top:${y+0.3}mm;font-size:4.5pt;color:red;opacity:0.7;">${y}</div>`;
  }
  return html;
}

// ─────────────────────────────────────────
// overlay BOX生成（デバッグ時は赤枠）
// ─────────────────────────────────────────
function npBox(
  left: number, top: number, w: number, h: number,
  content: string, fontSize: number, fontWeight: number, color: string,
  debug: boolean, label = '', extraStyle = ''
): string {
  const dbg = debug
    ? `outline:2px solid red;background:rgba(255,0,0,0.08);`
    : '';
  const lbl = debug && label
    ? `<div style="position:absolute;top:0;left:0;font-size:4pt;color:red;line-height:1;">${label}</div>`
    : '';
  return `<div style="position:absolute;left:${left}mm;top:${top}mm;width:${w}mm;height:${h}mm;
    display:flex;align-items:center;justify-content:center;
    font-size:${fontSize}pt;font-weight:${fontWeight};color:${color};
    white-space:nowrap;overflow:hidden;box-sizing:border-box;${dbg}${extraStyle}">
    ${lbl}${content}
  </div>`;
}

// ─────────────────────────────────────────
// A4 HTML生成（背景画像 + overlay）
// ─────────────────────────────────────────
interface BuildHtmlParams {
  ownerName: string;
  propertyAddress: string;
  rows: NetProceedsRow[];
  hasMortgage: boolean;
  taxMode: 'unknown' | 'known' | 'none';
  acquisitionCostMan: string;
  purchaseYear: string;
  taxDetail: ReturnType<typeof calcTransferTax> | null;
  fmtMan: (yen: number, approx?: boolean) => string;
  debug: boolean;
}

function buildNetProceedsHtml(p: BuildHtmlParams): string {
  const { ownerName, propertyAddress, debug, fmtMan } = p;

  // 売主名（「様」重複防止）
  const ownerDisplay = ownerName.trim().replace(/[\s　]*様\s*$/, '');

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>手残りリスト</title>
<style>
  @page{size:A4 portrait;margin:0;}
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{width:210mm;height:297mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;
    font-family:'Noto Sans JP','Hiragino Kaku Gothic Pro','Meiryo',sans-serif;}
  .a4{position:relative;width:210mm;height:297mm;overflow:hidden;}
  .bg{position:absolute;left:0;top:0;width:210mm;height:297mm;object-fit:fill;z-index:0;}
  .layer{position:absolute;left:0;top:0;width:210mm;height:297mm;z-index:10;}
</style>
</head><body>
<div class="a4">
  <img class="bg" src="/sale-schedule/illustrations/template2.png?v=20260807c" alt="" />
  <div class="layer">
    ${debug ? buildNpDebugGrid() : ''}

    <!-- ① 物件所在地（確定済み・変更禁止） -->
    ${npBox(46, 38, 144, 7, propertyAddress || '', 11.5, 600, '#1a1a1a', debug, 'propertyAddress',
      'justify-content:flex-start;padding-left:1mm;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;align-items:flex-start;')}

    <!-- ② 売主名（確定済み・変更禁止） -->
    ${npBox(46, 47, 104, 7, ownerDisplay, 12, 600, '#1a1a1a', debug, 'ownerName', 'justify-content:flex-start;padding-left:1mm;')}

    <!-- ③〜⑧ 表1行目（仮座標・位置合わせ中） -->
    <!-- 列X座標（仮）: 売却価格|仲介手数料|印紙代|取得費|譲渡所得税|手残り金額 -->
    <!-- 行1のY座標(仮): top≈122mm -->
    ${p.rows.length > 0 ? (() => {
      const row = p.rows[0];
      const rowTop = 157;
      const rowH = 7;
      const fmtM = p.fmtMan;
      const acqCost = p.taxMode !== 'none' && p.taxDetail ? p.taxDetail.acquisitionCostUsed : 0;
      return [
        npBox(  6, rowTop, 32, rowH, fmtM(row.priceYen),     8, 600, '#1a1a1a', debug, '売却価格'),
        npBox( 40, rowTop, 32, rowH, fmtM(row.brokerageFee), 8, 600, '#1a1a1a', debug, '仲介手数料'),
        npBox( 74, rowTop, 18, rowH, fmtM(row.stampDuty),    8, 600, '#1a1a1a', debug, '印紙代'),
        npBox( 94, rowTop, 28, rowH, acqCost > 0 ? fmtM(acqCost) : '―', 8, 600, '#1a1a1a', debug, '取得費'),
        npBox(127, rowTop, 30, rowH, p.taxMode !== 'none' ? fmtM(row.transferTax, true) : '―', 8, 600, '#1a1a1a', debug, '譲渡所得税'),
        npBox(159, rowTop, 42, rowH, fmtM(row.netProceeds),  9, 900, '#c0392b', debug, '手残り金額'),
      ].join('');
    })() : ''}

  </div>
</div>
</body></html>`;
}

// ─────────────────────────────────────────
// A4 プレビューコンポーネント（旧・保持）
// ─────────────────────────────────────────
interface A4Props {
  ownerName: string;
  propertyAddress: string;
  rows: NetProceedsRow[];
  hasMortgage: boolean;
  taxMode: 'unknown' | 'known' | 'none';
  acquisitionCostMan: string;
  purchaseYear: string;
  taxDetail: ReturnType<typeof calcTransferTax> | null;
  fmtMan: (yen: number, approx?: boolean) => string;
  navy: string;
  gold: string;
  bgLight: string;
}

const NetProceedsA4 = React.forwardRef<HTMLDivElement, A4Props>((props, ref) => {
  const { ownerName, propertyAddress, rows, hasMortgage, taxMode, taxDetail, fmtMan, navy, gold, bgLight } = props;

  const a4: React.CSSProperties = {
    width: '210mm', minHeight: '297mm', maxHeight: '297mm',
    background: '#fff',
    fontFamily: "'Noto Sans JP','Hiragino Kaku Gothic Pro','Meiryo',sans-serif",
    fontSize: '8.5pt', color: '#1a1a1a',
    boxSizing: 'border-box', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    printColorAdjust: 'exact',
    WebkitPrintColorAdjust: 'exact',
  } as React.CSSProperties;

  const fmtStamp = (yen: number) => {
    if (yen >= 10000) return `${yen / 10000}万円`;
    return `${yen.toLocaleString()}円`;
  };

  const taxModeLabel = taxMode === 'none' ? 'なし'
    : taxMode === 'unknown' ? 'あり（取得費不明・売価の5%）'
    : `あり（取得費明確）`;

  return (
    <div id="net-proceeds-print" ref={ref} style={a4}>
      {/* HEADER */}
      <div style={{ background: navy, color: '#fff', padding: '6mm 10mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '18pt', fontWeight: 900, color: gold, letterSpacing: '0.05em' }}>手残りリスト</div>
          <div style={{ fontSize: '6.5pt', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            くじら不動産 ｜ 概算シミュレーション
          </div>
        </div>
        {taxMode !== 'none' && (
          <div style={{ background: gold, color: '#fff', borderRadius: 4, padding: '3mm 4mm', fontSize: '6.5pt', maxWidth: '65mm', lineHeight: 1.5, fontWeight: 600 }}>
            {taxMode === 'unknown' ? '取得費不明の場合で計算した概算の手残り金額です。' : '取得費明確で計算した概算の手残り金額です。'}
            <br />売買契約書が残っており、取得費が明確な場合はその金額を教えて頂ければ再計算いたします。
          </div>
        )}
      </div>

      {/* 物件・売主 */}
      <div style={{ padding: '3mm 10mm', display: 'flex', gap: '6mm', flexShrink: 0, borderBottom: `1px solid ${navy}22` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
          <div style={{ background: navy, color: '#fff', padding: '1mm 3mm', borderRadius: 2, fontSize: '7.5pt', fontWeight: 700, whiteSpace: 'nowrap' }}>物　件</div>
          <div style={{ fontSize: '8.5pt', fontWeight: 500 }}>{propertyAddress || '―'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
          <div style={{ background: navy, color: '#fff', padding: '1mm 3mm', borderRadius: 2, fontSize: '7.5pt', fontWeight: 700, whiteSpace: 'nowrap' }}>売主名</div>
          <div style={{ fontSize: '8.5pt', fontWeight: 500 }}>{ownerName ? `${ownerName} 様` : '―'}</div>
        </div>
      </div>

      {/* 計算条件帯 */}
      <div style={{ padding: '2.5mm 10mm', background: bgLight, display: 'flex', gap: '6mm', flexShrink: 0, borderBottom: `1px solid ${navy}22` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '7pt', fontWeight: 700, color: navy, borderBottom: `1px solid ${gold}`, paddingBottom: 2, marginBottom: 3 }}>計算条件</div>
          <div style={{ fontSize: '6.5pt', lineHeight: 1.8 }}>
            ・仲介手数料：売買価格×3%＋6万円に消費税（800万以下は税込33万円）<br />
            ・譲渡所得税：{taxModeLabel}{taxMode === 'unknown' ? '（5年以上所有：長期譲渡所得税率20.315%）' : ''}<br />
            ・売買契約書の印紙代（売買価格に応じた額）<br />
            {hasMortgage && '・抵当権抹消費用：5万円'}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '7pt', fontWeight: 700, color: navy, borderBottom: `1px solid ${gold}`, paddingBottom: 2, marginBottom: 3 }}>仲介手数料の計算式</div>
          <div style={{ fontSize: '6.5pt', lineHeight: 1.8 }}>
            （売買価格×3%＋6万円）×1.1（消費税10%）<br />
            {rows.length > 0 && (
              <>【例】{fmtMan(rows[0].priceYen)}の場合<br />
              （{fmtMan(rows[0].priceYen)}×3%＋6万円）×1.1＝<span style={{ fontWeight: 700 }}>{fmtMan(rows[0].brokerageFee)}</span></>
            )}
          </div>
        </div>
        {taxMode !== 'none' && taxDetail && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '7pt', fontWeight: 700, color: navy, borderBottom: `1px solid ${gold}`, paddingBottom: 2, marginBottom: 3 }}>
              譲渡所得税の計算式（{taxMode === 'unknown' ? '取得費不明の場合' : '取得費明確の場合'}）
            </div>
            <div style={{ fontSize: '6.5pt', lineHeight: 1.8 }}>
              ①取得費（{taxMode === 'unknown' ? '売価×5%' : '取得費－減価償却'}）<br />
              &nbsp;&nbsp;{rows.length > 0 && `${fmtMan(rows[0].priceYen)} × 5% = ${fmtMan(taxDetail.acquisitionCostUsed)}`}<br />
              ②課税譲渡所得<br />
              &nbsp;&nbsp;{rows.length > 0 && fmtMan(rows[0].priceYen)} − {fmtMan(taxDetail.acquisitionCostUsed)} − {fmtMan(rows[0]?.brokerageFee ?? 0)}<br />
              &nbsp;&nbsp;= <span style={{ fontWeight: 700 }}>{fmtMan(taxDetail.taxableGain)}</span><br />
              ③{taxDetail.isLongTerm ? '長期' : '短期'}譲渡所得税（{taxDetail.isLongTerm ? '20.315%' : '39.63%'}）<br />
              &nbsp;&nbsp;<span style={{ fontWeight: 700 }}>約{fmtMan(taxDetail.taxAmount)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 注意書き（取得費不明の場合） */}
      {taxMode === 'unknown' && (
        <div style={{ margin: '2mm 10mm', padding: '2mm 3mm', background: '#fffbeb', border: `1px solid ${gold}`, borderRadius: 3, fontSize: '6pt', lineHeight: 1.6, flexShrink: 0 }}>
          <span style={{ fontWeight: 700 }}>【取得費不明の場合の譲渡所得税について】</span><br />
          上記の譲渡所得税は、取得費が不明な場合に売買価格の5%を取得費として計算した場合の金額です。<br />
          売買契約書が残っており、取得費が明確な場合はこれより税金が安くなります。<br />
          <span style={{ color: '#c0392b', fontWeight: 700 }}>取得費の金額を教えて頂ければ、再計算いたします。</span>
        </div>
      )}

      {/* テーブル */}
      <div style={{ padding: '0 10mm', flex: 1, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
          <thead>
            <tr style={{ background: navy, color: '#fff' }}>
              <th style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, border: `1px solid ${navy}` }}>売却価格（税込）</th>
              <th style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, border: `1px solid ${navy}` }}>仲介手数料（税込）</th>
              <th style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, border: `1px solid ${navy}` }}>印紙代</th>
              {hasMortgage && <th style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, border: `1px solid ${navy}` }}>抵当権抹消</th>}
              {taxMode !== 'none' && <th style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, border: `1px solid ${navy}` }}>譲渡所得税（概算）</th>}
              <th style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, border: `1px solid ${navy}`, background: gold, color: '#fff' }}>手残り金額（概算）</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '8px', color: '#999' }}>査定最高額を入力してください</td></tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : bgLight }}>
                  <td style={{ padding: '3px 8px', textAlign: 'right', border: `1px solid ${navy}33` }}>{fmtMan(row.priceYen)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', border: `1px solid ${navy}33` }}>{fmtMan(row.brokerageFee)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', border: `1px solid ${navy}33` }}>{fmtStamp(row.stampDuty)}</td>
                  {hasMortgage && <td style={{ padding: '3px 8px', textAlign: 'right', border: `1px solid ${navy}33` }}>5万円</td>}
                  {taxMode !== 'none' && <td style={{ padding: '3px 8px', textAlign: 'right', border: `1px solid ${navy}33` }}>{fmtMan(row.transferTax, true)}</td>}
                  <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 700, fontSize: '9pt', color: gold, border: `1px solid ${navy}33`, background: '#fffbf0' }}>{fmtMan(row.netProceeds)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 注釈 */}
      <div style={{ padding: '2mm 10mm', fontSize: '6pt', color: '#666', lineHeight: 1.8, flexShrink: 0 }}>
        ※上記は概算です。実際の金額は契約条件や諸費用により変動する場合があります。<br />
        ※譲渡所得税、抵当権抹消費用、住宅ローン残債などは差し引いていません。<br />
        ※印紙代：5千万円以下は1万円、5千万円超は3万円で計算しています。
      </div>

      {/* FOOTER */}
      <div style={{ background: navy, color: '#fff', padding: '4mm 10mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '9pt', fontWeight: 800, color: gold }}>くじら不動産</div>
          <div style={{ fontSize: '6pt', color: 'rgba(255,255,255,0.7)' }}>誠実なサポートで、安心の売却を。</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11pt', fontWeight: 900, color: gold }}>092-401-5331</div>
          <div style={{ fontSize: '6pt', color: 'rgba(255,255,255,0.7)' }}>営業時間 10:00〜18:00</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '7pt', color: 'rgba(255,255,255,0.85)' }}>福岡市中央区舞鶴3-1-10</div>
          <div style={{ fontSize: '6pt', color: 'rgba(255,255,255,0.6)' }}>tenant@ifoo-oita.com</div>
        </div>
      </div>
    </div>
  );
});
NetProceedsA4.displayName = 'NetProceedsA4';

export default NetProceedsListModal;
