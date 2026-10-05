import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Divider, IconButton,
  Checkbox,
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
// 印刷用HTML生成
// ─────────────────────────────────────────
function generatePrintHtml(
  title: string,
  ownerName: string,
  propertyAddress: string,
  selectedItems: ServiceItem[],
  isFI: boolean,
  baseUrl: string,
): string {
  const accentColor = isFI ? '#1B3A6B' : '#00695C';
  const lightBg     = isFI ? '#EBF0F9' : '#E8F5E9';

  // 全体の縦スペース計算
  // A4 = 297mm, 余白上下10mm, ヘッダー20mm, 物件情報12mm, フッター5mm
  // カードエリア = 297 - 20 - 20 - 12 - 5 = 240mm
  // n枚 × (画像 + ラベル) + (n-1) × gap で収める
  const n = selectedItems.length;
  // 1枚あたり高さ(mm) 画像+ラベル: gap=2mm込みで算出
  const totalArea  = 235;
  const gapTotal   = Math.max(0, n - 1) * 2;
  const cardHeight = Math.floor((totalArea - gapTotal) / Math.max(n, 1));
  const imgHeight  = Math.max(cardHeight - 7, 10); // ラベル7mm分引く

  const cardsHtml = selectedItems.map((item) => {
    const imgSrc = `${baseUrl}/sale-schedule/illustrations/${item.id}.png`;
    return `
      <div class="service-card">
        <div class="img-wrap">
          <img src="${imgSrc}" alt="${item.label}" />
        </div>
        <div class="card-label">${item.label}</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <base href="${baseUrl}/">
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
    /* 画像コンテナ: 高さ固定 + 上部を表示 */
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

  <script>
    // 画像がすべてロードされてから印刷ダイアログを開く
    (function() {
      function printWhenReady() {
        var imgs = document.querySelectorAll('img');
        var total = imgs.length;
        if (total === 0) { window.print(); return; }
        var done = 0;
        function onDone() {
          done++;
          if (done >= total) { setTimeout(function() { window.print(); }, 150); }
        }
        imgs.forEach(function(img) {
          if (img.complete && img.naturalWidth > 0) { onDone(); }
          else {
            img.addEventListener('load',  onDone);
            img.addEventListener('error', onDone);
          }
        });
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', printWhenReady);
      } else {
        printWhenReady();
      }
    })();
  </script>
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

  // チェック状態（デフォルト全選択）
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(SERVICE_ITEMS.map((item) => [item.id, true])),
  );

  const toggleItem = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleAll = () => {
    const allChecked = SERVICE_ITEMS.every((item) => checked[item.id]);
    setChecked(Object.fromEntries(SERVICE_ITEMS.map((item) => [item.id, !allChecked])));
  };

  const selectedItems = SERVICE_ITEMS.filter((item) => checked[item.id]);
  const allChecked    = SERVICE_ITEMS.every((item) => checked[item.id]);

  const handlePrint = () => {
    if (selectedItems.length === 0) return;
    const baseUrl = window.location.origin;
    const html = generatePrintHtml(title, ownerName, propertyAddress, selectedItems, isFI, baseUrl);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
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

        {/* 横1列リスト（サムネイル + ラベル） */}
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
              {/* サムネイル */}
              <Box
                component="img"
                src={`${imgBase}/${item.id}.png`}
                alt={item.label}
                sx={{ width: 72, height: 48, objectFit: 'cover', objectPosition: 'top', borderRadius: 1, flexShrink: 0 }}
              />
              {/* ラベル */}
              <Typography variant="body2" sx={{ flex: 1, fontWeight: checked[item.id] ? 700 : 400, color: checked[item.id] ? accentColor : 'text.secondary' }}>
                {item.label}
              </Typography>
              {/* チェックボックス */}
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
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          disabled={selectedItems.length === 0}
          sx={{ bgcolor: accentColor, '&:hover': { bgcolor: isFI ? '#142d55' : '#00564f' } }}
        >
          印刷プレビュー（{selectedItems.length}件）
        </Button>
      </DialogActions>
    </Dialog>
  );
}
