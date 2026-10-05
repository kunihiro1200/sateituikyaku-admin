import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Divider, IconButton,
  Checkbox, CircularProgress,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon } from '@mui/icons-material';

// ─────────────────────────────────────────
// サービス項目定義
// id = /sale-schedule/illustrations/{id}.png のファイル名
// ─────────────────────────────────────────
interface ServiceItem {
  id: string;
  label: string;
}

const SERVICE_ITEMS: ServiceItem[] = [
  { id: 'cleaning',   label: '室内クリーニング' },
  { id: 'garden',     label: '庭の除草、草刈り' },
  { id: 'wallpaper',  label: 'クロスの張替え' },
  { id: 'removal',    label: '残置物撤去' },
  { id: 'warranty',   label: '設備の1年間無償保証' },
  { id: 'commission', label: '最低価格を下回った場合 仲介手数料２％' },
  { id: 'bridge',     label: 'つなぎ融資' },
];

// ─────────────────────────────────────────
// 画像をbase64 data URLに変換
// 新しいウィンドウでもネットワーク参照なしで確実に表示できる
// ─────────────────────────────────────────
async function fetchAsBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface ServiceSupportModalProps {
  open: boolean;
  onClose: () => void;
  sellerNumber: string;
  ownerName: string;
  propertyAddress: string;
}

// ─────────────────────────────────────────
// 印刷用HTML生成（imageMap はbase64 data URL）
// ─────────────────────────────────────────
function generatePrintHtml(
  title: string,
  ownerName: string,
  propertyAddress: string,
  selectedItems: ServiceItem[],
  isFI: boolean,
  imageMap: Record<string, string>,
): string {
  const accentColor = isFI ? '#1B3A6B' : '#00695C';
  const lightBg     = isFI ? '#EBF0F9' : '#E8F5E9';

  // A4縦スペースに収まるよう画像高さを計算
  // 使えるカードエリア: 297mm - 上下余白(20mm) - ヘッダー(20mm) - 物件情報(12mm) - フッター(5mm) = 240mm
  // n枚 × (画像高さ + ラベル7mm) + (n-1) × gap(2mm)
  const n = selectedItems.length;
  const totalArea  = 240;
  const gapTotal   = Math.max(0, n - 1) * 2;
  const cardHeight = Math.floor((totalArea - gapTotal) / Math.max(n, 1));
  const imgHeight  = Math.max(cardHeight - 7, 8);

  const cardsHtml = selectedItems.map((item) => {
    const src = imageMap[item.id] || '';
    return `
      <div class="service-card">
        ${src
          ? `<div class="img-wrap"><img src="${src}" alt="${item.label}" /></div>`
          : `<div class="img-placeholder">${item.label}</div>`
        }
        <div class="card-label">${item.label}</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans JP','ヒラギノ角ゴ Pro W3','メイリオ',Meiryo,sans-serif;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 10mm 12mm 10mm 12mm;
      display: flex;
      flex-direction: column;
    }

    /* ── ヘッダー ── */
    .header {
      background: ${accentColor};
      border-radius: 5px;
      padding: 5mm 10mm;
      color: #fff;
      margin-bottom: 4mm;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -12mm; right: -6mm;
      width: 40mm; height: 40mm;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
    }
    .header-label {
      font-size: 7pt;
      letter-spacing: 0.15em;
      color: rgba(255,255,255,0.65);
      margin-bottom: 1.5mm;
    }
    .header-title {
      font-size: 17pt;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    /* ── 物件情報 ── */
    .property-box {
      background: ${lightBg};
      border-radius: 4px;
      padding: 3mm 7mm;
      margin-bottom: 4mm;
      display: flex;
      flex-direction: column;
      gap: 1mm;
    }
    .property-row { display: flex; align-items: baseline; gap: 4mm; }
    .property-key {
      font-size: 7pt;
      color: ${accentColor};
      font-weight: 600;
      white-space: nowrap;
      min-width: 18mm;
    }
    .property-val { font-size: 9pt; color: #222; font-weight: 500; }

    /* ── カード（横1列） ── */
    .cards-list {
      display: flex;
      flex-direction: column;
      gap: 2mm;
      flex: 1;
    }
    .service-card {
      display: flex;
      flex-direction: column;
      border: 1px solid #dde;
      border-left: 4px solid ${accentColor};
      border-radius: 3px;
      overflow: hidden;
      background: #fff;
    }
    .img-wrap {
      width: 100%;
      height: ${imgHeight}mm;
      overflow: hidden;
      background: #f5f7fa;
    }
    .img-wrap img {
      width: 100%;
      height: auto;
      display: block;
    }
    .img-placeholder {
      width: 100%;
      height: ${imgHeight}mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f7fa;
      font-size: 9pt;
      color: #999;
    }
    .card-label {
      font-size: 8pt;
      font-weight: 700;
      color: ${accentColor};
      padding: 1.5mm 3mm;
      background: ${lightBg};
      white-space: nowrap;
    }

    /* ── フッター ── */
    .footer {
      margin-top: 3mm;
      border-top: 1px solid #ddd;
      padding-top: 2mm;
      text-align: center;
      font-size: 6.5pt;
      color: #aaa;
    }
    @media print {
      html, body { width: 210mm; height: 297mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-label">Seller Support Services</div>
      <div class="header-title">${title}</div>
    </div>

    <div class="property-box">
      ${ownerName ? `<div class="property-row"><span class="property-key">お客様氏名</span><span class="property-val">${ownerName} 様</span></div>` : ''}
      ${propertyAddress ? `<div class="property-row"><span class="property-key">物件所在地</span><span class="property-val">${propertyAddress}</span></div>` : ''}
    </div>

    <div class="cards-list">
      ${cardsHtml}
    </div>

    <div class="footer">※ 内容・条件の詳細については担当スタッフまでお問い合わせください。</div>
  </div>
  <script>window.print();</script>
</body>
</html>`;
}

// ─────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────
export default function ServiceSupportModal({
  open,
  onClose,
  sellerNumber,
  ownerName,
  propertyAddress,
}: ServiceSupportModalProps) {
  const isFI        = sellerNumber.toUpperCase().startsWith('FI');
  const title       = isFI ? 'くじら不動産の売却サポート' : 'いふうの売却サポート';
  const accentColor = isFI ? '#1B3A6B' : '#00695C';
  const lightBg     = isFI ? '#EBF0F9' : '#E8F5E9';

  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(SERVICE_ITEMS.map((item) => [item.id, true])),
  );
  const [printing, setPrinting] = useState(false);

  const toggleItem = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleAll = () => {
    const allChecked = SERVICE_ITEMS.every((item) => checked[item.id]);
    setChecked(Object.fromEntries(SERVICE_ITEMS.map((item) => [item.id, !allChecked])));
  };

  const selectedItems = SERVICE_ITEMS.filter((item) => checked[item.id]);
  const allChecked    = SERVICE_ITEMS.every((item) => checked[item.id]);

  const handlePrint = async () => {
    if (selectedItems.length === 0) return;
    setPrinting(true);
    try {
      // 選択された画像をbase64で並列取得（同一オリジンなので確実に取得できる）
      const entries = await Promise.all(
        selectedItems.map(async (item) => {
          const dataUrl = await fetchAsBase64(`/sale-schedule/illustrations/${item.id}.png`);
          return [item.id, dataUrl] as [string, string];
        }),
      );
      const imageMap: Record<string, string> = Object.fromEntries(entries);

      const html = generatePrintHtml(title, ownerName, propertyAddress, selectedItems, isFI, imageMap);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
      }
    } finally {
      setPrinting(false);
    }
  };

  const imgBase = '/sale-schedule/illustrations';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">資料生成 — サービス</Typography>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, color: accentColor, mt: 0.25 }}>
            {title}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 1.5, pb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          印刷に含めるサービスを選択してください
        </Typography>

        {/* 全選択トグル */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pb: 1, borderBottom: '1px solid #eee', cursor: 'pointer' }}
          onClick={toggleAll}
        >
          <Checkbox
            size="small"
            checked={allChecked}
            indeterminate={!allChecked && SERVICE_ITEMS.some((item) => checked[item.id])}
            onChange={toggleAll}
            onClick={(e) => e.stopPropagation()}
            sx={{ p: 0.5, color: accentColor, '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: accentColor } }}
          />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>すべて選択</Typography>
        </Box>

        {/* 横1列リスト */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {SERVICE_ITEMS.map((item) => (
            <Box
              key={item.id}
              onClick={() => toggleItem(item.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                border: `2px solid ${checked[item.id] ? accentColor : '#ddd'}`,
                borderRadius: 1.5,
                overflow: 'hidden',
                cursor: 'pointer',
                bgcolor: checked[item.id] ? lightBg : '#fff',
                transition: 'border-color 0.15s',
                p: 0.5,
              }}
            >
              <Box
                component="img"
                src={`${imgBase}/${item.id}.png`}
                alt={item.label}
                sx={{ width: 72, height: 48, objectFit: 'cover', objectPosition: 'top', borderRadius: 1, flexShrink: 0 }}
              />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: checked[item.id] ? 700 : 400, color: checked[item.id] ? accentColor : 'text.secondary' }}>
                {item.label}
              </Typography>
              <Checkbox
                size="small"
                checked={checked[item.id]}
                onChange={() => toggleItem(item.id)}
                onClick={(e) => e.stopPropagation()}
                sx={{ p: 0.5, color: accentColor, '&.Mui-checked': { color: accentColor } }}
              />
            </Box>
          ))}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} size="small" color="inherit">閉じる</Button>
        <Button
          variant="contained"
          size="small"
          startIcon={printing ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
          onClick={handlePrint}
          disabled={selectedItems.length === 0 || printing}
          sx={{ bgcolor: accentColor, '&:hover': { bgcolor: isFI ? '#142d55' : '#00564f' } }}
        >
          {printing ? '画像読み込み中...' : `印刷プレビュー（${selectedItems.length}件）`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
