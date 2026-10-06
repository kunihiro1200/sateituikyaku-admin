/**
 * サービス資料生成モーダル
 *
 * 印刷方式：
 * - iframe.srcdoc に HTML を設定する（SaleScheduleModal と同じ方式）
 * - srcdoc iframe の origin は親ページと同じになるため、
 *   /sale-schedule/illustrations/xxx.png は base64 変換不要で直接読み込める
 * - iframe の load イベントは img の読み込み完了後に発火するため
 *   そのタイミングで print() を呼ぶだけでよい
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Divider, IconButton, Checkbox,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon } from '@mui/icons-material';

interface ServiceItem { id: string; label: string; }

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
// A4 HTML 生成
// ※ srcdoc iframe 内では相対パス(/...)が解決できないため
//   window.location.origin を付けた絶対URLを使う
// ─────────────────────────────────────────
function buildPrintHtml(
  title: string,
  ownerName: string,
  propertyAddress: string,
  items: ServiceItem[],
  isFI: boolean,
  origin: string,   // window.location.origin
): string {
  const accent = isFI ? '#1B3A6B' : '#00695C';
  const light  = isFI ? '#EBF0F9' : '#E8F5E9';

  const n      = items.length;
  const gap    = 2;
  const label  = 7;
  const avail  = 236; // mm
  const card   = Math.floor((avail - (n - 1) * gap) / Math.max(n, 1));
  const imgH   = Math.max(card - label, 8);

  const cards = items.map(it => `
<div style="display:flex;flex-direction:column;border:1px solid #dde;border-left:4px solid ${accent};border-radius:3px;overflow:hidden;">
  <div style="width:100%;height:${imgH}mm;overflow:hidden;background:#f5f7fa;">
    <img src="${origin}/sale-schedule/illustrations/${it.id}.png" alt="${it.label}"
         style="width:100%;height:auto;display:block;" />
  </div>
  <div style="font-size:8pt;font-weight:700;color:${accent};padding:1.5mm 3mm;background:${light};">${it.label}</div>
</div>
<div style="height:${gap}mm;"></div>`).join('');

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<base href="${origin}/">
<style>
@page{size:A4 portrait;margin:0;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'ヒラギノ角ゴ Pro W3','メイリオ',Meiryo,sans-serif;
     -webkit-print-color-adjust:exact;print-color-adjust:exact;}
</style>
</head><body>
<div style="width:210mm;min-height:297mm;padding:10mm 12mm;display:flex;flex-direction:column;">

  <div style="background:${accent};border-radius:5px;padding:5mm 10mm;color:#fff;margin-bottom:4mm;">
    <div style="font-size:7pt;letter-spacing:.15em;color:rgba(255,255,255,.65);margin-bottom:1.5mm;">Seller Support Services</div>
    <div style="font-size:17pt;font-weight:700;">${title}</div>
  </div>

  <div style="background:${light};border-radius:4px;padding:3mm 7mm;margin-bottom:4mm;">
    ${ownerName     ? `<div style="display:flex;gap:4mm;font-size:9pt;"><span style="font-size:7pt;color:${accent};font-weight:600;min-width:18mm;">お客様氏名</span>${ownerName} 様</div>` : ''}
    ${propertyAddress ? `<div style="display:flex;gap:4mm;font-size:9pt;margin-top:1mm;"><span style="font-size:7pt;color:${accent};font-weight:600;min-width:18mm;">物件所在地</span>${propertyAddress}</div>` : ''}
  </div>

  <div style="flex:1;">${cards}</div>

  <div style="margin-top:3mm;border-top:1px solid #ddd;padding-top:2mm;text-align:center;font-size:6.5pt;color:#aaa;">
    ※ 内容・条件の詳細については担当スタッフまでお問い合わせください。
  </div>
</div>
</body></html>`;
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  sellerNumber: string;
  ownerName: string;
  propertyAddress: string;
}

export default function ServiceSupportModal({ open, onClose, sellerNumber, ownerName, propertyAddress }: Props) {
  const isFI    = sellerNumber.toUpperCase().startsWith('FI');
  const title   = isFI ? 'くじら不動産の売却サポート' : 'いふうの売却サポート';
  const accent  = isFI ? '#1B3A6B' : '#00695C';
  const light   = isFI ? '#EBF0F9' : '#E8F5E9';

  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(SERVICE_ITEMS.map(i => [i.id, true])),
  );

  const toggle    = (id: string) => setChecked(p => ({ ...p, [id]: !p[id] }));
  const toggleAll = () => {
    const all = SERVICE_ITEMS.every(i => checked[i.id]);
    setChecked(Object.fromEntries(SERVICE_ITEMS.map(i => [i.id, !all])));
  };

  const selected  = SERVICE_ITEMS.filter(i => checked[i.id]);
  const allChecked = SERVICE_ITEMS.every(i => checked[i.id]);

  const handlePrint = useCallback(() => {
    if (selected.length === 0) return;

    const html = buildPrintHtml(title, ownerName, propertyAddress, selected, isFI, window.location.origin);

    // 非表示 iframe に srcdoc で注入し、load 完了後に print()
    // srcdoc iframe は親と同一 origin になるため /sale-schedule/... の画像が読める
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;visibility:hidden;';
    iframe.srcdoc = html;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('[ServiceSupportModal] print error:', e);
      }
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 3000);
    };
    document.body.appendChild(iframe);
  }, [selected, title, ownerName, propertyAddress, isFI]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">資料生成 — サービス</Typography>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, color: accent, mt: 0.25 }}>{title}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 1.5, pb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          印刷に含めるサービスを選択してください
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pb: 1, borderBottom: '1px solid #eee', cursor: 'pointer' }} onClick={toggleAll}>
          <Checkbox size="small" checked={allChecked}
            indeterminate={!allChecked && SERVICE_ITEMS.some(i => checked[i.id])}
            onChange={toggleAll} onClick={e => e.stopPropagation()}
            sx={{ p: 0.5, color: accent, '&.Mui-checked,&.MuiCheckbox-indeterminate': { color: accent } }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>すべて選択</Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {SERVICE_ITEMS.map(item => (
            <Box key={item.id} onClick={() => toggle(item.id)} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              border: `2px solid ${checked[item.id] ? accent : '#ddd'}`,
              borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer',
              bgcolor: checked[item.id] ? light : '#fff',
              transition: 'border-color 0.15s', p: 0.5,
            }}>
              <Box component="img"
                src={`/sale-schedule/illustrations/${item.id}.png`}
                alt={item.label}
                sx={{ width: 72, height: 48, objectFit: 'cover', objectPosition: 'top', borderRadius: 1, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: checked[item.id] ? 700 : 400, color: checked[item.id] ? accent : 'text.secondary' }}>
                {item.label}
              </Typography>
              <Checkbox size="small" checked={checked[item.id]}
                onChange={() => toggle(item.id)} onClick={e => e.stopPropagation()}
                sx={{ p: 0.5, color: accent, '&.Mui-checked': { color: accent } }} />
            </Box>
          ))}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} size="small" color="inherit">閉じる</Button>
        <Button variant="contained" size="small" startIcon={<PrintIcon />}
          onClick={handlePrint} disabled={selected.length === 0}
          sx={{ bgcolor: accent, '&:hover': { bgcolor: isFI ? '#142d55' : '#00564f' } }}>
          印刷プレビュー（{selected.length}件）
        </Button>
      </DialogActions>
    </Dialog>
  );
}
