/**
 * サービス資料生成モーダル
 *
 * 印刷方式：
 *   メインページの DOM に印刷コンテナを直接追加（通常の DOM → 画像キャッシュが利く）
 *   @media print で印刷コンテナ以外を非表示にする CSS を注入し、
 *   印刷完了後（afterprint）に DOM を元に戻す。
 *   モーダルで既にサムネイルが読み込まれているためキャッシュから即表示。
 *
 * 保存方式：
 *   seller_attached_document2 テーブルの tokuten_* カラムに保存・読み込みする。
 *   モーダルが開くたびに DB から最新値を取得し、チェック変更時に即座に保存する。
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Divider, IconButton, Checkbox,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon } from '@mui/icons-material';
import api from '../services/api';

// ─────────────────────────────────────────
// サービス項目定義
// ─────────────────────────────────────────
interface ServiceItem { id: string; label: string; tokutenKey: string; }

const SERVICE_ITEMS: ServiceItem[] = [
  { id: 'cleaning',   label: '室内クリーニング',                     tokutenKey: 'tokuten_cleaning'      },
  { id: 'garden',     label: '庭の除草、草刈り',                     tokutenKey: 'tokuten_garden'        },
  { id: 'wallpaper',  label: 'クロスの張替え',                       tokutenKey: 'tokuten_wallpaper'     },
  { id: 'removal',    label: '残置物撤去',                           tokutenKey: 'tokuten_removal'       },
  { id: 'warranty',   label: '設備の1年間無償保証',                  tokutenKey: 'tokuten_warranty'      },
  { id: 'commission', label: '最低価格を下回った場合 仲介手数料２％', tokutenKey: 'tokuten_fee_discount'  },
  { id: 'bridge',     label: 'つなぎ融資',                           tokutenKey: 'tokuten_bridge_loan'   },
  { id: 'key',        label: '鍵交換',                               tokutenKey: 'tokuten_key_exchange'  },
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
  sellerId: string;
  sellerNumber: string;
  ownerName: string;
  propertyAddress: string;
}

// ─────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────
export default function ServiceSupportModal({ open, onClose, sellerId, sellerNumber, ownerName, propertyAddress }: Props) {
  const isFI   = sellerNumber.toUpperCase().startsWith('FI');
  const title  = isFI ? 'くじら不動産の売却サポート' : 'いふうの売却サポート';
  const accent = isFI ? '#1B3A6B' : '#00695C';
  const light  = isFI ? '#EBF0F9' : '#E8F5E9';

  // チェック状態
  const [checked, setChecked] = useState<Record<string,boolean>>(
    Object.fromEntries(SERVICE_ITEMS.map(i => [i.id, false])),
  );
  // 初回ロード中は保存しない
  const isLoadingRef = useRef(true);

  // ─────────────────────────────────────────
  // モーダルが開くたびに DB から最新値を取得
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!open || !sellerId) return;
    isLoadingRef.current = true;
    setChecked(Object.fromEntries(SERVICE_ITEMS.map(i => [i.id, false])));
    api.get(`/api/sellers/${sellerId}/attached-document2`)
      .then(res => {
        const d = res.data || {};
        setChecked(Object.fromEntries(SERVICE_ITEMS.map(i => [i.id, !!d[i.tokutenKey]])));
      })
      .catch(() => {})
      .finally(() => { isLoadingRef.current = false; });
  }, [open, sellerId]);

  // ─────────────────────────────────────────
  // checked が変わったら DB に保存（初回ロード時を除く）
  // tokuten専用PATCHで他フィールドを上書きしない
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!sellerId || isLoadingRef.current) return;
    const payload: Record<string, boolean> = {};
    for (const item of SERVICE_ITEMS) {
      payload[item.tokutenKey] = !!checked[item.id];
    }
    api.patch(`/api/sellers/${sellerId}/attached-document2/tokuten`, payload)
      .catch((err) => console.error('tokuten save error:', err));
  }, [checked, sellerId]);

  const toggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = () => {
    const all = SERVICE_ITEMS.every(i => checked[i.id]);
    setChecked(Object.fromEntries(SERVICE_ITEMS.map(i => [i.id, !all])));
  };

  const selected   = SERVICE_ITEMS.filter(i => checked[i.id]);
  const allChecked = SERVICE_ITEMS.every(i => checked[i.id]);

  /**
   * 印刷処理
   */
  const handlePrint = useCallback(() => {
    if (selected.length === 0) return;

    const origin = window.location.origin;
    const accent = isFI ? '#1B3A6B' : '#00695C';
    const light  = isFI ? '#EBF0F9' : '#E8F5E9';
    const n = selected.length;

    const colGap = 3;
    const rowGap = 3;

    // 2枚ずつ行に分ける
    const rows: typeof selected[] = [];
    for (let i = 0; i < n; i += 2) rows.push(selected.slice(i, i + 2));

    const rowsHtml = rows.map(row => `
<div style="display:flex;gap:${colGap}mm;margin-bottom:${rowGap}mm;">
  ${row.map(it => `
  <div style="flex:1;display:flex;flex-direction:column;border:1px solid #dde;border-left:4px solid ${accent};border-radius:3px;overflow:hidden;">
    <img src="${origin}/sale-schedule/illustrations/${it.id}.png"
         alt="${esc(it.label)}"
         style="width:100%;height:auto;display:block;" />
    <div style="font-size:10pt;font-weight:700;color:${accent};padding:1.5mm 3mm;background:${light};">${esc(it.label)}</div>
  </div>`).join('')}
  ${row.length < 2 ? `<div style="flex:1;"></div>` : ''}
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
<div style="width:210mm;padding:8mm 12mm;box-sizing:border-box;">
  <div style="background:${accent};border-radius:5px;padding:4mm 10mm;color:#fff;margin-bottom:3mm;">
    <div style="font-size:8pt;letter-spacing:.15em;color:rgba(255,255,255,.65);margin-bottom:1mm;">Seller Support Services</div>
    <div style="font-size:20pt;font-weight:700;">${esc(title)}</div>
  </div>
  <div style="background:${light};border-radius:4px;padding:2.5mm 7mm;margin-bottom:3mm;">
    ${ownerName ? `<div style="display:flex;gap:4mm;align-items:baseline;margin-bottom:0.5mm;"><span style="font-size:8pt;color:${accent};font-weight:600;min-width:18mm;">お客様氏名</span><span style="font-size:11pt;">${esc(ownerName)} 様</span></div>` : ''}
    ${propertyAddress ? `<div style="display:flex;gap:4mm;align-items:baseline;"><span style="font-size:8pt;color:${accent};font-weight:600;min-width:18mm;">物件所在地</span><span style="font-size:11pt;">${esc(propertyAddress)}</span></div>` : ''}
    <div style="margin-top:2.5mm;padding-top:2mm;border-top:1px solid rgba(0,0,0,0.1);font-size:8pt;color:#555;font-style:italic;">
      ※ こちらの無料サービスは弊社の専任媒介での特典となります
    </div>
  </div>
  ${rowsHtml}
  <div style="border-top:1px solid #ddd;padding-top:2mm;text-align:center;font-size:7pt;color:#aaa;">
    ※ 内容・条件の詳細については担当スタッフまでお問い合わせください。
  </div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

    // Blob URLで開くことでポップアップではなく正規タブとして開く（親ウィンドウをブロックしない）
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000); // 1分後にクリーンアップ
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
        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt:1.5, pb:1 }}>
        <>
            <Typography variant="caption" color="text.secondary" sx={{ display:'block', mb:1.5 }}>
              印刷に含めるサービスを選択してください（選択状態は自動保存されます）
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
          </>
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
