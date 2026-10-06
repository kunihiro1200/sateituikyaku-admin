/**
 * サービス資料生成モーダル
 *
 * 印刷方式：
 *   メインページの DOM に印刷コンテナを直接追加 → window.print()
 *   （iframe / 新ウィンドウはいずれも画像読み込み制約があるため使わない）
 *
 *   @media print で印刷コンテナ以外を非表示にする CSS を注入し、
 *   印刷完了後（afterprint）に DOM を元に戻す。
 *   モーダルで既にサムネイルが読み込まれているためキャッシュから即表示。
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Divider, IconButton, Checkbox,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon } from '@mui/icons-material';

// ─────────────────────────────────────────
// サービス項目定義
// ─────────────────────────────────────────
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
// HTMLエスケープ
// ─────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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

// ─────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────
export default function ServiceSupportModal({ open, onClose, sellerNumber, ownerName, propertyAddress }: Props) {
  const isFI   = sellerNumber.toUpperCase().startsWith('FI');
  const title  = isFI ? 'くじら不動産の売却サポート' : 'いふうの売却サポート';
  const accent = isFI ? '#1B3A6B' : '#00695C';
  const light  = isFI ? '#EBF0F9' : '#E8F5E9';

  // デフォルトは全未選択（通常3件程度を選ぶため）
  const [checked, setChecked] = useState<Record<string,boolean>>(
    Object.fromEntries(SERVICE_ITEMS.map(i => [i.id, false])),
  );

  const toggle    = (id: string) => setChecked(p => ({ ...p, [id]: !p[id] }));
  const toggleAll = () => {
    const all = SERVICE_ITEMS.every(i => checked[i.id]);
    setChecked(Object.fromEntries(SERVICE_ITEMS.map(i => [i.id, !all])));
  };

  const selected   = SERVICE_ITEMS.filter(i => checked[i.id]);
  const allChecked = SERVICE_ITEMS.every(i => checked[i.id]);

  /**
   * 印刷処理
   * ─────────────────────────────────────────────────────────────────
   * 手順:
   *   1. A4 コンテンツを body に直接追加（通常の DOM → 画像キャッシュが利く）
   *   2. @media print CSS を注入（他要素を非表示、A4 コンテナのみ表示）
   *   3. 画像がすべてロードされたら window.print()
   *   4. afterprint / timeout で DOM をクリーンアップ
   * ─────────────────────────────────────────────────────────────────
   */
  const handlePrint = useCallback(() => {
    if (selected.length === 0) return;

    const origin = window.location.origin;
    const accent = isFI ? '#1B3A6B' : '#00695C';
    const light  = isFI ? '#EBF0F9' : '#E8F5E9';
    const n = selected.length;

    // ── A4 縦スペース計算（4枚1ページに収める）──
    // 297mm - 余白(16) - ヘッダー(14) - 物件情報(9) - フッター(4) - ギャップ合計 - ラベル合計
    const padMm  = 8;   // 上下余白
    const hdrMm  = 14;  // ヘッダー
    const propMm = 9;   // 物件情報
    const ftrMm  = 4;   // フッター
    const gapMm  = 2;   // カード間ギャップ
    const lblMm  = 7;   // ラベル高さ
    const avail  = 297 - padMm*2 - hdrMm - propMm - ftrMm
                   - (n-1)*gapMm - n*lblMm;
    const imgH   = Math.max(Math.floor(avail / n), 10);

    // object-fit:cover で画像を上端基準にトリミング（切れる部分を最小化）
    const cards = selected.map(it => `
<div style="display:flex;flex-direction:column;border:1px solid #dde;
            border-left:4px solid ${accent};border-radius:3px;
            overflow:hidden;margin-bottom:${gapMm}mm;">
  <img src="${origin}/sale-schedule/illustrations/${it.id}.png"
       alt="${esc(it.label)}"
       style="width:100%;height:${imgH}mm;object-fit:cover;object-position:top center;display:block;" />
  <div style="font-size:10pt;font-weight:700;color:${accent};
              padding:1.5mm 4mm;background:${light};">${esc(it.label)}</div>
</div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<style>
@page{size:A4 portrait;margin:0;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'ヒラギノ角ゴ Pro W3','メイリオ',Meiryo,sans-serif;
     -webkit-print-color-adjust:exact;print-color-adjust:exact;}
</style>
</head><body>
<div style="width:210mm;padding:${padMm}mm 12mm;box-sizing:border-box;">
  <div style="background:${accent};border-radius:5px;padding:4mm 10mm;color:#fff;margin-bottom:3mm;">
    <div style="font-size:8pt;letter-spacing:.15em;color:rgba(255,255,255,.65);margin-bottom:1mm;">Seller Support Services</div>
    <div style="font-size:20pt;font-weight:700;">${esc(title)}</div>
  </div>
  <div style="background:${light};border-radius:4px;padding:2.5mm 7mm;margin-bottom:3mm;">
    ${ownerName ? `<div style="display:flex;gap:4mm;align-items:baseline;margin-bottom:0.5mm;"><span style="font-size:8pt;color:${accent};font-weight:600;min-width:18mm;">お客様氏名</span><span style="font-size:11pt;">${esc(ownerName)} 様</span></div>` : ''}
    ${propertyAddress ? `<div style="display:flex;gap:4mm;align-items:baseline;"><span style="font-size:8pt;color:${accent};font-weight:600;min-width:18mm;">物件所在地</span><span style="font-size:11pt;">${esc(propertyAddress)}</span></div>` : ''}
  </div>
  ${cards}
  <div style="border-top:1px solid #ddd;padding-top:2mm;text-align:center;font-size:7pt;color:#aaa;margin-top:2mm;">
    ※ 内容・条件の詳細については担当スタッフまでお問い合わせください。
  </div>
</div>
</body></html>`;

    // srcdoc iframe はアプリのグローバル print.css と完全に独立したドキュメント
    // opacity:0.01 で実質不可視だが描画されるため画像が確実にロードされる
    const iframe = document.createElement('iframe');
    iframe.style.cssText = [
      'position:fixed', 'top:0', 'left:0',
      'width:210mm', 'height:297mm',
      'border:none', 'opacity:0.01',
      'z-index:-9999', 'pointer-events:none',
    ].join(';');
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

  // ─────────────────────────────────────────
  // モーダル UI
  // ─────────────────────────────────────────
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', pb:1 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">資料生成 — サービス</Typography>
          <Typography variant="h6" sx={{ fontSize:'1rem', fontWeight:700, color:accent, mt:0.25 }}>
            {title}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt:1.5, pb:1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display:'block', mb:1.5 }}>
          印刷に含めるサービスを選択してください
          {selected.length > 0 && (
            <Box component="span" sx={{ ml:1, color: selected.length <= 4 ? 'success.main' : 'warning.main', fontWeight:600 }}>
              （{selected.length}件 ／ {selected.length <= 4 ? '1ページ' : '2ページ'}）
            </Box>
          )}
        </Typography>

        {/* 全選択 */}
        <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1, pb:1,
                   borderBottom:'1px solid #eee', cursor:'pointer' }}
             onClick={toggleAll}>
          <Checkbox size="small" checked={allChecked}
            indeterminate={!allChecked && SERVICE_ITEMS.some(i => checked[i.id])}
            onChange={toggleAll} onClick={e => e.stopPropagation()}
            sx={{ p:0.5, color:accent, '&.Mui-checked,&.MuiCheckbox-indeterminate':{ color:accent } }} />
          <Typography variant="body2" sx={{ fontWeight:600 }}>すべて選択</Typography>
        </Box>

        {/* サービス一覧（横1列） */}
        <Box sx={{ display:'flex', flexDirection:'column', gap:0.75 }}>
          {SERVICE_ITEMS.map(item => (
            <Box key={item.id} onClick={() => toggle(item.id)} sx={{
              display:'flex', alignItems:'center', gap:1.5,
              border:`2px solid ${checked[item.id] ? accent : '#ddd'}`,
              borderRadius:1.5, overflow:'hidden', cursor:'pointer',
              bgcolor:checked[item.id] ? light : '#fff',
              transition:'border-color 0.15s', p:0.5,
            }}>
              {/* サムネイル（読み込みでキャッシュに乗る） */}
              <Box component="img"
                src={`/sale-schedule/illustrations/${item.id}.png`}
                alt={item.label}
                sx={{ width:72, height:48, objectFit:'cover', objectPosition:'top',
                      borderRadius:1, flexShrink:0 }} />
              <Typography variant="body2"
                sx={{ flex:1, fontWeight:checked[item.id] ? 700 : 400,
                      color:checked[item.id] ? accent : 'text.secondary' }}>
                {item.label}
              </Typography>
              <Checkbox size="small" checked={checked[item.id]}
                onChange={() => toggle(item.id)} onClick={e => e.stopPropagation()}
                sx={{ p:0.5, color:accent, '&.Mui-checked':{ color:accent } }} />
            </Box>
          ))}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px:2, py:1.5, gap:1 }}>
        <Button onClick={onClose} size="small" color="inherit">閉じる</Button>
        <Button variant="contained" size="small" startIcon={<PrintIcon />}
          onClick={handlePrint} disabled={selected.length === 0}
          sx={{ bgcolor:accent, '&:hover':{ bgcolor:isFI ? '#142d55' : '#00564f' } }}>
          印刷プレビュー（{selected.length}件）
        </Button>
      </DialogActions>
    </Dialog>
  );
}
