/**
 * サービス資料生成モーダル
 *
 * 印刷方式は SaleScheduleModal と同じパターン：
 * 1. モーダルを開いた時点で全サービス画像を fetch → base64 data URL に変換
 * 2. 印刷ボタン押下時に base64 を埋め込んだ HTML を生成
 * 3. 非表示 iframe の srcdoc に設定し iframe.onload で print()
 *    → srcdoc + iframe は document.write/window.open と異なりブラウザ制限を受けない
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Divider, IconButton, Checkbox,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon } from '@mui/icons-material';

// ─────────────────────────────────────────
// サービス項目定義
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
// 画像を base64 data URL に変換（SaleScheduleModal と同じ方式）
// ─────────────────────────────────────────
function loadImageAsBase64(url: string): Promise<string> {
  return fetch(url)
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => '');
}

// ─────────────────────────────────────────
// A4 印刷 HTML 生成
// base64 images を直接 src に埋め込む → srcdoc iframe 内で確実に表示
// ─────────────────────────────────────────
function buildPrintHtml(
  title: string,
  ownerName: string,
  propertyAddress: string,
  selectedItems: ServiceItem[],
  isFI: boolean,
  images: Record<string, string>,
): string {
  const accentColor = isFI ? '#1B3A6B' : '#00695C';
  const lightBg     = isFI ? '#EBF0F9' : '#E8F5E9';

  // カードエリア計算
  // A4(297mm) - 余白(20mm) - ヘッダー(22mm) - 物件情報(13mm) - フッター(6mm) = 236mm
  const n       = selectedItems.length;
  const gapMm   = 2;
  const labelMm = 7;
  const cardMm  = Math.floor((236 - (n - 1) * gapMm) / Math.max(n, 1));
  const imgMm   = Math.max(cardMm - labelMm, 8);

  const cardsHtml = selectedItems.map((item) => {
    const src = images[item.id] || '';
    return `
<div style="display:flex;flex-direction:column;border:1px solid #dde;border-left:4px solid ${accentColor};border-radius:3px;overflow:hidden;background:#fff;">
  <div style="width:100%;height:${imgMm}mm;overflow:hidden;background:#f5f7fa;">
    ${src ? `<img src="${src}" alt="${item.label}" style="width:100%;height:auto;display:block;" />` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-size:9pt;">${item.label}</div>`}
  </div>
  <div style="font-size:8pt;font-weight:700;color:${accentColor};padding:1.5mm 3mm;background:${lightBg};white-space:nowrap;">${item.label}</div>
</div>`;
  }).join(`<div style="height:${gapMm}mm;"></div>`);

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<style>
@page{size:A4 portrait;margin:0;}
*{box-sizing:border-box;margin:0;padding:0;}
body{
  font-family:'Noto Sans JP','ヒラギノ角ゴ Pro W3','メイリオ',Meiryo,sans-serif;
  background:#fff;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
</style>
</head><body>
<div style="width:210mm;min-height:297mm;padding:10mm 12mm;display:flex;flex-direction:column;background:#fff;">

  <!-- ヘッダー -->
  <div style="background:${accentColor};border-radius:5px;padding:5mm 10mm;color:#fff;margin-bottom:4mm;position:relative;overflow:hidden;">
    <div style="font-size:7pt;letter-spacing:0.15em;color:rgba(255,255,255,0.65);margin-bottom:1.5mm;">Seller Support Services</div>
    <div style="font-size:17pt;font-weight:700;letter-spacing:0.04em;">${title}</div>
  </div>

  <!-- 物件情報 -->
  <div style="background:${lightBg};border-radius:4px;padding:3mm 7mm;margin-bottom:4mm;display:flex;flex-direction:column;gap:1mm;">
    ${ownerName ? `<div style="display:flex;gap:4mm;align-items:baseline;"><span style="font-size:7pt;color:${accentColor};font-weight:600;min-width:18mm;white-space:nowrap;">お客様氏名</span><span style="font-size:9pt;color:#222;font-weight:500;">${ownerName} 様</span></div>` : ''}
    ${propertyAddress ? `<div style="display:flex;gap:4mm;align-items:baseline;"><span style="font-size:7pt;color:${accentColor};font-weight:600;min-width:18mm;white-space:nowrap;">物件所在地</span><span style="font-size:9pt;color:#222;font-weight:500;">${propertyAddress}</span></div>` : ''}
  </div>

  <!-- サービスカード（横1列） -->
  <div style="display:flex;flex-direction:column;flex:1;">
    ${cardsHtml}
  </div>

  <!-- フッター -->
  <div style="margin-top:3mm;border-top:1px solid #ddd;padding-top:2mm;text-align:center;font-size:6.5pt;color:#aaa;">
    ※ 内容・条件の詳細については担当スタッフまでお問い合わせください。
  </div>
</div>
</body></html>`;
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
  // 全画像の base64 data URL（SaleScheduleModal と同じ方式でプリロード）
  const [images, setImages] = useState<Record<string, string>>({});

  // モーダルを開いたタイミングで全画像をプリロード
  useEffect(() => {
    if (!open) return;
    (async () => {
      const entries = await Promise.all(
        SERVICE_ITEMS.map(async (item) => {
          const data = await loadImageAsBase64(`/sale-schedule/illustrations/${item.id}.png`);
          return [item.id, data] as [string, string];
        }),
      );
      setImages(Object.fromEntries(entries));
    })();
  }, [open]);

  const toggleItem = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleAll = () => {
    const allChecked = SERVICE_ITEMS.every((item) => checked[item.id]);
    setChecked(Object.fromEntries(SERVICE_ITEMS.map((item) => [item.id, !allChecked])));
  };

  const selectedItems = SERVICE_ITEMS.filter((item) => checked[item.id]);
  const allChecked    = SERVICE_ITEMS.every((item) => checked[item.id]);

  /**
   * SaleScheduleModal と同じ印刷方式：
   * - 非表示 iframe を作成して srcdoc に HTML を設定
   * - iframe.onload で print() を呼ぶ
   * - 3秒後に iframe を除去
   */
  const handlePrint = useCallback(() => {
    if (selectedItems.length === 0) return;
    const html = buildPrintHtml(title, ownerName, propertyAddress, selectedItems, isFI, images);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;visibility:hidden;';
    iframe.srcdoc = html;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('印刷エラー:', e);
      }
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
      }, 3000);
    };
    document.body.appendChild(iframe);
  }, [selectedItems, title, ownerName, propertyAddress, isFI, images]);

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
                display: 'flex', alignItems: 'center', gap: 1.5,
                border: `2px solid ${checked[item.id] ? accentColor : '#ddd'}`,
                borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer',
                bgcolor: checked[item.id] ? lightBg : '#fff',
                transition: 'border-color 0.15s', p: 0.5,
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
