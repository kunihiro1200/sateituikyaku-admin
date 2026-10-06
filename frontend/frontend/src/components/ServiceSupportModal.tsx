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
// A4 印刷コンテンツ生成（HTML ボディ部分のみ）
// ※ img src は /... の通常パス — メインページ DOM なので確実に読み込まれる
// ─────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildPrintBody(
  title: string,
  ownerName: string,
  propertyAddress: string,
  items: ServiceItem[],
  isFI: boolean,
): string {
  const accent = isFI ? '#1B3A6B' : '#00695C';
  const light  = isFI ? '#EBF0F9' : '#E8F5E9';

  const n     = items.length;
  const gap   = 2;   // mm between cards
  const lblH  = 7;   // label height mm
  const avail = 236; // total card area mm
  const card  = Math.floor((avail - (n - 1) * gap) / Math.max(n, 1));
  const imgH  = Math.max(card - lblH, 8);

  const cards = items.map(it => `
<div style="display:flex;flex-direction:column;border:1px solid #dde;
            border-left:4px solid ${accent};border-radius:3px;
            overflow:hidden;margin-bottom:${gap}mm;">
  <div style="width:100%;height:${imgH}mm;overflow:hidden;background:#f5f7fa;">
    <img src="/sale-schedule/illustrations/${it.id}.png"
         alt="${esc(it.label)}"
         style="width:100%;height:auto;display:block;" />
  </div>
  <div style="font-size:8pt;font-weight:700;color:${accent};
              padding:1.5mm 3mm;background:${light};">${esc(it.label)}</div>
</div>`).join('');

  return `
<div style="font-family:'ヒラギノ角ゴ Pro W3','メイリオ',Meiryo,sans-serif;
            width:210mm;padding:10mm 12mm;box-sizing:border-box;background:#fff;">
  <!-- ヘッダー -->
  <div style="background:${accent};border-radius:5px;padding:5mm 10mm;
              color:#fff;margin-bottom:4mm;">
    <div style="font-size:7pt;letter-spacing:.15em;color:rgba(255,255,255,.65);
                margin-bottom:1.5mm;">Seller Support Services</div>
    <div style="font-size:17pt;font-weight:700;">${esc(title)}</div>
  </div>
  <!-- 物件情報 -->
  <div style="background:${light};border-radius:4px;padding:3mm 7mm;margin-bottom:4mm;">
    ${ownerName ? `<div style="font-size:9pt;margin-bottom:1mm;"><span style="font-size:7pt;color:${accent};font-weight:600;min-width:18mm;display:inline-block;">お客様氏名</span>${esc(ownerName)} 様</div>` : ''}
    ${propertyAddress ? `<div style="font-size:9pt;"><span style="font-size:7pt;color:${accent};font-weight:600;min-width:18mm;display:inline-block;">物件所在地</span>${esc(propertyAddress)}</div>` : ''}
  </div>
  <!-- サービスカード -->
  ${cards}
  <!-- フッター -->
  <div style="border-top:1px solid #ddd;padding-top:2mm;
              text-align:center;font-size:6.5pt;color:#aaa;">
    ※ 内容・条件の詳細については担当スタッフまでお問い合わせください。
  </div>
</div>`;
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

  const [checked, setChecked] = useState<Record<string,boolean>>(
    Object.fromEntries(SERVICE_ITEMS.map(i => [i.id, true])),
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

    // ① A4 コンテンツを DOM に注入
    const container = document.createElement('div');
    container.id = 'svc-print';
    container.innerHTML = buildPrintBody(title, ownerName, propertyAddress, selected, isFI);
    document.body.appendChild(container);

    // ② 印刷用 CSS 注入
    const style = document.createElement('style');
    style.id = 'svc-print-style';
    style.textContent = `
      @page { size: A4 portrait; margin: 0; }
      #svc-print { display: none; }
      @media print {
        body { visibility: hidden !important; }
        #svc-print { visibility: visible !important;
                     display: block !important;
                     position: fixed !important;
                     top: 0 !important; left: 0 !important; }
        #svc-print * { visibility: visible !important; }
      }
    `;
    document.head.appendChild(style);

    // ③ クリーンアップ関数
    const cleanup = () => {
      try { document.body.removeChild(container); }  catch {}
      try { document.head.removeChild(style); } catch {}
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 10000); // afterprint が発火しない場合の安全弁

    // ④ 画像ロード完了後に print()
    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    const total = imgs.length;

    if (total === 0) {
      window.print();
      return;
    }

    let done = 0;
    const onDone = () => {
      done++;
      if (done >= total) window.print();
    };

    imgs.forEach(img => {
      if (img.complete && img.naturalWidth > 0) {
        onDone();                          // キャッシュ済み → 即完了
      } else {
        img.addEventListener('load',  onDone, { once: true });
        img.addEventListener('error', onDone, { once: true }); // エラーでも進める
      }
    });
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
