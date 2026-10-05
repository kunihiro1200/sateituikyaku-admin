import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Divider, IconButton,
  Checkbox,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon } from '@mui/icons-material';

// ─────────────────────────────────────────
// サービス項目定義
// id がそのまま /sale-schedule/illustrations/{id}.png のファイル名
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

  // 列数 / 行あたり高さを件数に応じて調整
  const cols   = selectedItems.length <= 2 ? 1
               : selectedItems.length <= 4 ? 2
               : selectedItems.length <= 6 ? 2
               : 3; // 7件は3列
  const colPct = cols === 1 ? '100%' : cols === 2 ? 'calc(50% - 3mm)' : 'calc(33.333% - 3mm)';

  const cardsHtml = selectedItems.map((item) => {
    const imgSrc = `${baseUrl}/sale-schedule/illustrations/${item.id}.png`;
    return `
      <div class="service-card">
        <img class="card-img" src="${imgSrc}" alt="${item.label}" />
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
    @page {
      size: A4 portrait;
      margin: 0;
    }
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
      padding: 7mm 10mm;
      color: #fff;
      margin-bottom: 5mm;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -15mm; right: -8mm;
      width: 50mm; height: 50mm;
      border-radius: 50%;
      background: rgba(255,255,255,0.07);
    }
    .header-label {
      font-size: 7.5pt;
      letter-spacing: 0.15em;
      color: rgba(255,255,255,0.7);
      margin-bottom: 2mm;
    }
    .header-title {
      font-size: 20pt;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    /* ── 物件情報 ── */
    .property-box {
      background: ${lightBg};
      border-radius: 4px;
      padding: 3.5mm 7mm;
      margin-bottom: 5mm;
      display: flex;
      flex-direction: column;
      gap: 1.5mm;
    }
    .property-row { display: flex; align-items: baseline; gap: 4mm; }
    .property-key {
      font-size: 7.5pt;
      color: ${accentColor};
      font-weight: 600;
      white-space: nowrap;
      min-width: 18mm;
    }
    .property-val { font-size: 9.5pt; color: #222; font-weight: 500; }

    /* ── サービスカードグリッド ── */
    .cards-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 3mm;
      flex: 1;
    }
    .service-card {
      width: ${colPct};
      display: flex;
      flex-direction: column;
      border: 1px solid #ddd;
      border-radius: 4px;
      overflow: hidden;
      background: #fff;
    }
    .card-img {
      width: 100%;
      display: block;
      object-fit: cover;
    }
    .card-label {
      font-size: 8.5pt;
      font-weight: 700;
      color: ${accentColor};
      text-align: center;
      padding: 2mm 2mm;
      background: ${lightBg};
      line-height: 1.4;
    }

    /* ── フッター ── */
    .footer {
      margin-top: 4mm;
      border-top: 1px solid #ddd;
      padding-top: 3mm;
      text-align: center;
      font-size: 7pt;
      color: #999;
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

    <div class="cards-grid">
      ${cardsHtml}
    </div>

    <div class="footer">
      ※ 内容・条件の詳細については担当スタッフまでお問い合わせください。
    </div>
  </div>
  <script>
    window.addEventListener('load', function() { window.print(); });
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
  const isFI = sellerNumber.toUpperCase().startsWith('FI');
  const title = isFI ? 'くじら不動産の売却サポート' : 'いふうの売却サポート';
  const accentColor = isFI ? '#1B3A6B' : '#00695C';
  const lightBg     = isFI ? '#EBF0F9' : '#E8F5E9';

  // チェック状態（デフォルト全選択）
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(SERVICE_ITEMS.map((item) => [item.id, true])),
  );

  const toggleItem = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
          <Typography variant="caption" color="text.secondary">
            資料生成 — サービス
          </Typography>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, color: accentColor, mt: 0.25 }}>
            {title}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
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

        {/* カードグリッドで各項目を表示 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {SERVICE_ITEMS.map((item) => (
            <Box
              key={item.id}
              onClick={() => toggleItem(item.id)}
              sx={{
                border: `2px solid ${checked[item.id] ? accentColor : '#ddd'}`,
                borderRadius: 1.5,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: checked[item.id] ? `0 0 0 1px ${accentColor}22` : 'none',
                position: 'relative',
                bgcolor: checked[item.id] ? lightBg : '#fff',
              }}
            >
              {/* 画像 */}
              <Box
                component="img"
                src={`${imgBase}/${item.id}.png`}
                alt={item.label}
                sx={{ width: '100%', display: 'block', objectFit: 'cover' }}
              />
              {/* ラベル + チェックボックス */}
              <Box sx={{ display: 'flex', alignItems: 'center', px: 0.75, py: 0.5, gap: 0.5 }}>
                <Checkbox
                  size="small"
                  checked={checked[item.id]}
                  onChange={() => toggleItem(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ p: 0.25, color: accentColor, '&.Mui-checked': { color: accentColor } }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1.3, fontWeight: checked[item.id] ? 700 : 400 }}>
                  {item.label}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} size="small" color="inherit">
          閉じる
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          disabled={selectedItems.length === 0}
          sx={{
            bgcolor: accentColor,
            '&:hover': { bgcolor: isFI ? '#142d55' : '#00564f' },
          }}
        >
          印刷プレビュー（{selectedItems.length}件）
        </Button>
      </DialogActions>
    </Dialog>
  );
}
