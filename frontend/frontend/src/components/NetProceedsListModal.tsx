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
  mode: 'unknown' | 'known' | 'none' | 'unknown_mortgage' | 'none_mortgage';
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

  if (input.mode === 'none' || input.mode === 'none_mortgage') {
    return { taxAmount: 0, taxableGain: 0, acquisitionCostUsed: 0, holdingYears: 0, isLongTerm: false, depreciationAmount: 0, buildingAcquisitionCost: 0 };
  }

  const landRatio = input.landRatio ?? 0.3;
  const buildingRatio = input.buildingRatio ?? 0.7;

  let acquisitionCostUsed: number;
  let depreciationAmount = 0;
  let buildingAcquisitionCost = 0;
  let holdingYears = 0;

  if (input.mode === 'unknown' || input.mode === 'unknown_mortgage') {
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
  const isLongTerm = holdingYears > 5 || input.mode === 'unknown' || input.mode === 'unknown_mortgage';
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
  initialPropertyType?: string; // 種別（正規化済み: 'land', 'apartment', 'detached_house' 等）
  initialSellerNumber?: string; // 売主番号（例: FI00001, AA00001）
  /** 「→売却スケジュール」ボタンクリック時に呼ばれるコールバック */
  onOpenSaleSchedule?: () => void;
  /** 「→送付状」ボタンクリック時に呼ばれるコールバック */
  onOpenSouhu?: () => void;
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
  initialPropertyType,
  initialSellerNumber = '',
  onOpenSaleSchedule,
  onOpenSouhu,
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

  // 抵当権抹消：taxMode='unknown_mortgage'（取得費不明・抵当権抹消費用あり）のときのみtrue

  // 種別が土地かどうか（土地は建物がないため築年数・減価償却不要）
  const isLand = initialPropertyType === 'land' || (initialPropertyType || '').includes('土');

  // テンプレート画像をBase64でキャッシュ（srcDoc内で外部画像が読めない問題の対策）
  const [imgCache, setImgCache] = useState<Record<string, string>>({});
  React.useEffect(() => {
    const templates = [
      'template2.png', 'template3.png', 'template4.png',
      'template2_oita.png', 'template3_oita.png', 'template4_oita.png',
      'template2_teitou.png', 'template2_oita_teitou.png',
      'template3_teitou_direct.png', 'template3_oita_teitou_direct.png',
    ];
    templates.forEach(name => {
      const url = `/sale-schedule/illustrations/${name}`;
      fetch(url)
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload = () => setImgCache(prev => ({ ...prev, [name]: reader.result as string }));
          reader.readAsDataURL(blob);
        })
        .catch(() => {});
    });
  }, []);

  // 譲渡所得税
  const [taxMode, setTaxMode] = useState<'unknown' | 'known' | 'none' | 'unknown_mortgage' | 'none_mortgage'>('none');
  const [acquisitionCostMan, setAcquisitionCostMan] = useState('');
  const [purchaseYear, setPurchaseYear] = useState('');

  // 抵当権抹消費用：taxMode='unknown_mortgage'（取得費不明・抵当権抹消費用あり）／'none_mortgage'（なし・抵当権抹消費用あり）のときのみtrue
  const hasMortgage = taxMode === 'unknown_mortgage' || taxMode === 'none_mortgage';
  // 抵当権抹消費用の金額：売主番号がFIを含む場合は5万円、含まない場合は3万円
  const isFiSeller = initialSellerNumber.trim().toUpperCase().includes('FI');
  const mortgageReleaseFee = isFiSeller ? 50_000 : 30_000;

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
      const mortgageRelease = hasMortgage ? mortgageReleaseFee : 0;
      const { taxAmount } = calcTransferTax({
        mode: taxMode,
        salePrice: priceYen,
        acquisitionCost: acquisitionCostMan ? parseFloat(acquisitionCostMan) * 10_000 : undefined,
        // 土地は建物なし・減価償却不要のため purchaseYear を渡さない（長期前提）
        purchaseYear: (!isLand && purchaseYear) ? parseInt(purchaseYear) : undefined,
        saleYear: new Date().getFullYear(),
      });
      const netProceeds = priceYen - brokerageFee - stampDuty - mortgageRelease - taxAmount;
      return { priceYen, brokerageFee, stampDuty, mortgageRelease, transferTax: taxAmount, netProceeds };
    });
  }, [maxPriceMan, minPriceMan, hasMortgage, mortgageReleaseFee, taxMode, acquisitionCostMan, purchaseYear, isLand]);

  // 税計算の詳細（代表値: 最高額で表示）
  const taxDetail = useMemo(() => {
    if (taxMode === 'none' || taxMode === 'none_mortgage' || !maxPriceMan) return null;
    const maxYen = parseFloat(maxPriceMan) * 10_000 || 0;
    if (maxYen <= 0) return null;
    return calcTransferTax({
      mode: taxMode,
      salePrice: maxYen,
      acquisitionCost: acquisitionCostMan ? parseFloat(acquisitionCostMan) * 10_000 : undefined,
      // 土地は建物なし・減価償却不要のため purchaseYear を渡さない
      purchaseYear: (!isLand && purchaseYear) ? parseInt(purchaseYear) : undefined,
      saleYear: new Date().getFullYear(),
    });
  }, [taxMode, maxPriceMan, acquisitionCostMan, purchaseYear, isLand]);

  const fmtMan = (yen: number, approx = false) => {
    const man = yen / 10_000;
    const str = Number.isInteger(man) ? `${man.toLocaleString()}万円` : `${man.toFixed(2)}万円`;
    return approx ? `約${str}` : str;
  };

  // 現在のtaxMode・sellerNumberに対応するテンプレートファイル名を返す
  const getTemplateName = (mode: typeof taxMode, sellerNum: string) => {
    const isOitaMode = sellerNum.trim().length > 0 && !sellerNum.trim().toUpperCase().startsWith('FI');
    const sfx = isOitaMode ? '_oita' : '';
    if (mode === 'unknown_mortgage') return `template2${sfx}_teitou.png`;
    if (mode === 'none_mortgage') return isOitaMode ? 'template3_oita_teitou_direct.png' : 'template3_teitou_direct.png';
    return mode === 'none' ? `template3${sfx}.png`
      : mode === 'known' ? `template4${sfx}.png`
      : `template2${sfx}.png`;
  };

  const handlePrint = () => {
    const tplName = getTemplateName(taxMode, initialSellerNumber);
    const html = buildNetProceedsHtml({
      ownerName, propertyAddress, rows, hasMortgage, taxMode,
      acquisitionCostMan, purchaseYear, taxDetail,
      sellerNumber: initialSellerNumber,
      baseUrl: window.location.origin,
      templateDataUrl: imgCache[tplName],
      fmtMan: (yen: number, approx = false) => {
        const man = yen / 10_000;
        const str = Number.isInteger(man) ? `${man.toLocaleString()}万円` : `${man.toFixed(2)}万円`;
        return approx ? `約${str}` : str;
      },
      debug: false,
    });
    // 非表示iframeで印刷（margin:0が確実に適用される）
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:210mm;height:297mm;border:none;opacity:0;pointer-events:none;z-index:-1;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 2000);
    }, 800);
  };

  const [debugMode, setDebugMode] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<'idle'|'saving'|'saved'|'error'>('idle');

  // モーダルが開いたとき、DBに保存済みデータがあれば読み込む
  React.useEffect(() => {
    if (!open || !initialSellerNumber) return;
    (async () => {
      try {
        const { default: api } = await import('../services/api');
        const res = await api.get(`/api/document-drafts/${initialSellerNumber}/net_proceeds`);
        if (res.data?.data) {
          const d = res.data.data;
          if (d.maxPriceMan) setMaxPriceMan(d.maxPriceMan);
          if (d.minPriceMan) setMinPriceMan(d.minPriceMan);
          if (d.taxMode) setTaxMode(d.taxMode);
          if (d.acquisitionCostMan) setAcquisitionCostMan(d.acquisitionCostMan);
          if (d.purchaseYear) setPurchaseYear(d.purchaseYear);
        }
      } catch {
        // 保存データなし → 初期値のまま
      }
    })();
  }, [open, initialSellerNumber]);

  const handleSave = async () => {
    if (!initialSellerNumber) return;
    setSaveStatus('saving');
    try {
      const { default: api } = await import('../services/api');
      await api.post(`/api/document-drafts/${initialSellerNumber}/net_proceeds`, {
        data: { maxPriceMan, minPriceMan, taxMode, acquisitionCostMan, purchaseYear },
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {onOpenSaleSchedule && (
              <Button
                size="small"
                variant="outlined"
                color="primary"
                onClick={() => { onClose(); onOpenSaleSchedule(); }}
                sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              >
                → 売却スケジュール
              </Button>
            )}
            {onOpenSouhu && (
              <Button
                size="small"
                variant="outlined"
                color="primary"
                onClick={() => { onClose(); onOpenSouhu(); }}
                sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              >
                → 送付状
              </Button>
            )}
            <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
          </Box>
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

              {/* 抵当権抹消チェックボックス：不要のため削除済み */}

              {/* 譲渡所得税 */}
              <FormControl component="fieldset">
                <FormLabel sx={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY, mb: 0.5 }}>
                  譲渡所得税
                </FormLabel>
                <RadioGroup value={taxMode} onChange={e => setTaxMode(e.target.value as typeof taxMode)}>
                  <FormControlLabel value="none" control={<Radio size="small" />} label="なし" />
                  <FormControlLabel value="unknown" control={<Radio size="small" />}
                    label={<Typography variant="body2">あり ─ 取得費不明（売価の5%で計算）</Typography>} />
                  <FormControlLabel value="unknown_mortgage" control={<Radio size="small" />}
                    label={<Typography variant="body2">あり ─ 取得費不明・抵当権抹消費用あり</Typography>} />
                  <FormControlLabel value="none_mortgage" control={<Radio size="small" />}
                    label={<Typography variant="body2">なし・抵当権抹消費用あり</Typography>} />
                  <FormControlLabel value="known" control={<Radio size="small" />}
                    label={<Typography variant="body2">あり ─ 取得費明確</Typography>} />
                </RadioGroup>
              </FormControl>

              {taxMode === 'known' && (
                <Grid container spacing={1} sx={{ mt: 0.5 }}>
                  <Grid item xs={isLand ? 12 : 6}>
                    <TextField fullWidth size="small" label="取得費（万円）*" type="number"
                      required
                      error={!acquisitionCostMan}
                      helperText={!acquisitionCostMan ? '必須入力です' : ''}
                      value={acquisitionCostMan} onChange={e => setAcquisitionCostMan(e.target.value)} />
                  </Grid>
                  {!isLand && (
                    <Grid item xs={6}>
                      <TextField fullWidth size="small" label="購入年（例:2010）*" type="number"
                        required
                        error={!purchaseYear}
                        helperText={!purchaseYear ? '必須入力です' : ''}
                        value={purchaseYear} onChange={e => setPurchaseYear(e.target.value)} />
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <Alert severity="info" sx={{ fontSize: '0.7rem', py: 0 }}>
                      {isLand
                        ? '土地は建物がないため減価償却はありません。5年超所有: 長期譲渡所得税率20.315%。'
                        : '土地:建物＝3:7で按分。建物は木造(0.046)で減価償却。5年超所有: 長期譲渡所得税率20.315%。'}
                    </Alert>
                  </Grid>
                </Grid>
              )}

              {taxDetail && (
                <Box sx={{ mt: 1, p: 1.5, bgcolor: BG_LIGHT, borderRadius: 1, border: `1px solid ${NAVY}22` }}>
                  <Typography variant="caption" fontWeight="bold" color={NAVY}>
                    譲渡所得税 計算根拠（査定最高額ベース）
                  </Typography>
                  {(taxMode === 'unknown' || taxMode === 'unknown_mortgage') && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      取得費: {fmtMan(taxDetail.acquisitionCostUsed)}（売価×5%）<br />
                      課税譲渡所得: {fmtMan(taxDetail.taxableGain)}<br />
                      税率: {taxDetail.isLongTerm ? '20.315%（長期）' : '39.63%（短期）'}<br />
                      {taxMode === 'unknown_mortgage' && <>抵当権抹消費用: 5万円<br /></>}
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
                    sellerNumber: initialSellerNumber,
                    baseUrl: window.location.origin,
                    templateDataUrl: imgCache[getTemplateName(taxMode, initialSellerNumber)],
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
          <Button variant="outlined" onClick={handleSave} disabled={saveStatus === 'saving'}
            color={saveStatus === 'saved' ? 'success' : saveStatus === 'error' ? 'error' : 'primary'}>
            {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '✓ 保存済み' : saveStatus === 'error' ? '保存失敗' : '保存'}
          </Button>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}
            disabled={taxMode === 'known' && (!acquisitionCostMan || (!isLand && !purchaseYear))}>
            印刷
          </Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}
            disabled={taxMode === 'known' && (!acquisitionCostMan || (!isLand && !purchaseYear))}
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
  taxMode: 'unknown' | 'known' | 'none' | 'unknown_mortgage' | 'none_mortgage';
  acquisitionCostMan: string;
  purchaseYear: string;
  taxDetail: ReturnType<typeof calcTransferTax> | null;
  fmtMan: (yen: number, approx?: boolean) => string;
  debug: boolean;
  sellerNumber?: string; // 売主番号（FI で始まらない場合は _oita テンプレートを使用）
  baseUrl?: string;      // srcDoc内でのベースURL（window.location.origin）
  templateDataUrl?: string; // Base64エンコードされた背景画像（srcDoc内で外部URL不可のため）
}

function buildNetProceedsHtml(p: BuildHtmlParams): string {
  const { ownerName, propertyAddress, debug, fmtMan } = p;

  // 売主名（「様」重複防止してから付与）
  const ownerDisplay = ownerName.trim().replace(/[\s　]*様\s*$/, '') + ' 様';

  // テンプレート切り替え：
  // taxMode='unknown'(取得費不明) → template2
  // taxMode='unknown_mortgage'(取得費不明・抵当権抹消費用あり) → template2_teitou
  // taxMode='none'(なし) → template3
  // taxMode='known'(取得費明確) → template4
  // 売主番号が FI で始まらない場合は _oita サフィックスのテンプレートを使用
  // ※ 売主番号が未設定（空）の場合は通常テンプレート（FI扱い）
  const sellerNum = (p.sellerNumber || '').trim().toUpperCase();
  const isOita = sellerNum.length > 0 && !sellerNum.startsWith('FI');
  const suffix = isOita ? '_oita' : '';
  const templateName = p.taxMode === 'unknown_mortgage'
    ? `template2${suffix}_teitou.png?v=20260815a`
    : p.taxMode === 'none_mortgage'
    ? (isOita ? 'template3_oita_teitou_direct.png?v=20260816a' : 'template3_teitou_direct.png?v=20260816a')
    : p.taxMode === 'none'
    ? `template3${suffix}.png?v=20260807c`
    : p.taxMode === 'known'
    ? `template4${suffix}.png?v=20260807a`
    : `template2${suffix}.png?v=20260807f`;
  // srcDoc内のiframeはoriginを引き継がないため絶対URLで指定
  const templateFile = `${p.baseUrl || ''}/sale-schedule/illustrations/${templateName}`;
  // Base64データがあればそちらを優先（srcDoc内での外部画像読み込み問題の対策）
  const templateSrc = p.templateDataUrl || templateFile;

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>手残りリスト</title>
<base href="${p.baseUrl || ''}/" />
<style>
  @page{size:A4 portrait;margin:0;}
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{width:210mm;height:297mm;margin:0 !important;padding:0 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;
    font-family:'Noto Sans JP','Hiragino Kaku Gothic Pro','Meiryo',sans-serif;}
  .a4{position:relative;width:210mm;height:297mm;overflow:hidden;}
  .bg{position:absolute;left:0;top:0;width:210mm;height:297mm;object-fit:fill;z-index:0;}
  .layer{position:absolute;left:0;top:0;width:210mm;height:297mm;z-index:10;}
</style>
</head><body>
<div class="a4">
  <img class="bg" src="${templateSrc}" alt="" />
  <div class="layer">
    ${debug ? buildNpDebugGrid() : ''}

    <!-- ① 物件所在地（確定済み・変更禁止） -->
    ${npBox(46, (p.taxMode === 'none' || p.taxMode === 'none_mortgage') ? 37 : p.taxMode === 'known' ? 32 : 38, 144, 7, propertyAddress || '', 13.5, 600, '#1a1a1a', debug, 'propertyAddress',
      'justify-content:flex-start;padding-left:1mm;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;align-items:flex-start;')}

    <!-- ② 売主名（確定済み・変更禁止） -->
    ${npBox(46, p.taxMode === 'known' ? 43 : 47, 104, 7, ownerDisplay, 14, 600, '#1a1a1a', debug, 'ownerName', 'justify-content:flex-start;padding-left:1mm;')}

    <!-- ③〜⑧ 表（行ごとにY座標固定・X座標共通） -->
    <!-- 行間: 7mm固定 / 列X座標確定済み -->
    <!-- ※ unknown_mortgage(template2_teitou)・none_mortgage(template3_teitou_direct)は座位未確定のため
         それぞれ最も近いモード(unknown/none)と同じ座標を暫定使用。
         プレビューのデバッグモードで実際のテンプレート画像とズレていないか確認し、必要に応じて調整すること。 -->
    ${((p.taxMode === 'none' || p.taxMode === 'none_mortgage') ? p.rows.slice(0, 9) : p.taxMode === 'known' ? p.rows.slice(0, 12) : p.rows.slice(0, 9)).map((row, i) => {
      // template2(取得費不明) / template2_teitou(取得費不明・抵当権抹消費用あり): baseTop=180, 行間9mm
      // template3(なし) / template3_teitou_direct(なし・抵当権抹消費用あり): baseTop=155(-1mm上), 行間10mm(+1mm)
      // template4(取得費明確): baseTop=146, 1-2行目9mm・3-4行目8mm・5行目以降9mm
      const baseTop = (p.taxMode === 'unknown' || p.taxMode === 'unknown_mortgage') ? 180 : (p.taxMode === 'none' || p.taxMode === 'none_mortgage') ? 155 : 146;
      const rowInterval = p.taxMode === 'known'
        ? (i < 2 ? 9 : i < 4 ? 8 : 9)
        : (p.taxMode === 'none' || p.taxMode === 'none_mortgage') ? 10 : 9;
      // template4: 累積オフセットで正確に計算
      // i=0:+0, i=1:+9, i=2:+17, i=3:+25, i=4:+34, i=5:+43, ...
      const rowTop = p.taxMode === 'known'
        ? (() => {
            if (i === 0) return baseTop;
            if (i === 1) return baseTop + 9;
            if (i === 2) return baseTop + 17;
            if (i === 3) return baseTop + 25;
            return baseTop + 25 + (i - 3) * 9; // 5行目(i=4)以降は9mm間隔
          })()
        : baseTop + i * rowInterval;
      const rowH = 7;
      const fmtM = p.fmtMan;
      const acqCost = (p.taxMode === 'unknown' || p.taxMode === 'unknown_mortgage')
        ? Math.round(row.priceYen * 0.05)
        : 0;
      // template3のみ仲介手数料50mm、印紙代111mm / template4は仲介手数料45mm、印紙代91mm
      // unknown_mortgage(template2_teitou)・none_mortgage(template3_teitou_direct)は「抵当権抹消費用」列を
      // 印紙代の左側に挿入するため他モードより列幅を詰める
      const brokerageLeft = (p.taxMode === 'none' || p.taxMode === 'none_mortgage') ? 50 : p.taxMode === 'known' ? 45 : p.taxMode === 'unknown_mortgage' ? 38 : 40;
      const mortgageLeft  = p.taxMode === 'none_mortgage' ? 98 : 77; // 印紙代の左側（none_mortgageは+10mm+2mm右にずらし済み）
      const stampLeft     = p.taxMode === 'none_mortgage' ? 125 : p.taxMode === 'none' ? 111 : p.taxMode === 'known' ? 95 : p.taxMode === 'unknown_mortgage' ? 97 : 74;
      const acqCostLeft   = p.taxMode === 'unknown_mortgage' ? 115 : 94;
      // template3のみ譲渡所得税+4mm / template4は手残り金額+2mm / unknown_mortgageは+2mm・フォント1段階小さく
      const transferTaxLeft = p.taxMode === 'none' ? 135 : p.taxMode === 'unknown_mortgage' ? 138 : 131;
      const transferTaxFontSize = p.taxMode === 'unknown_mortgage' ? 11 : 12;
      const netProceedsLeft = p.taxMode === 'known' ? 163 : p.taxMode === 'unknown_mortgage' ? 164 : 161;
      const hasMortgageCol = p.taxMode === 'unknown_mortgage' || p.taxMode === 'none_mortgage';
      const hasTaxCols = p.taxMode !== 'none' && p.taxMode !== 'none_mortgage';
      return [
        npBox(  6, rowTop, p.taxMode === 'unknown_mortgage' ? 30 : 32, rowH, fmtM(row.priceYen),     12, 600, '#1a1a1a', debug, i===0?'売却価格':''),
        npBox(brokerageLeft, rowTop, p.taxMode === 'unknown_mortgage' ? 28 : 32, rowH, fmtM(row.brokerageFee), 12, 600, '#1a1a1a', debug, i===0?'仲介手数料':''),
        // unknown_mortgage/none_mortgage(抵当権抹消費用あり)のみ抵当権抹消費用列を印紙代の左側に表示
        hasMortgageCol ? npBox(mortgageLeft, rowTop, 18, rowH, fmtM(row.mortgageRelease), 12, 600, '#1a1a1a', debug, i===0?'抵当権抹消':'') : '',
        npBox(stampLeft,     rowTop, p.taxMode === 'unknown_mortgage' ? 16 : 18, rowH, fmtM(row.stampDuty),    12, 600, '#1a1a1a', debug, i===0?'印紙代':''),
        // template3(none/none_mortgage)は取得費・譲渡所得税列なし
        (p.taxMode === 'unknown' || p.taxMode === 'unknown_mortgage') ? npBox( acqCostLeft, rowTop, p.taxMode === 'unknown_mortgage' ? 22 : 28, rowH, acqCost > 0 ? fmtM(acqCost) : '', 12, 600, '#1a1a1a', debug, i===0?'取得費':'') : '',
        p.taxMode === 'known'   ? npBox( 94, rowTop, 28, rowH, '', 12, 600, '#1a1a1a', debug, '') : '',
        hasTaxCols ? npBox(transferTaxLeft, rowTop, 30, rowH, fmtM(row.transferTax, true), transferTaxFontSize, 600, '#1a1a1a', debug, i===0?'譲渡所得税':'') : '',
        npBox(netProceedsLeft, rowTop, 42, rowH, fmtM(row.netProceeds),  13, 900, '#c0392b', debug, i===0?'手残り金額':''),
      ].join('');
    }).join('')}

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
  taxMode: 'unknown' | 'known' | 'none' | 'unknown_mortgage' | 'none_mortgage';
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
    : taxMode === 'none_mortgage' ? 'なし（抵当権抹消費用あり）'
    : taxMode === 'unknown' ? 'あり（取得費不明・売価の5%）'
    : taxMode === 'unknown_mortgage' ? 'あり（取得費不明・売価の5%・抵当権抹消費用あり）'
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
