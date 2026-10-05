import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Divider, IconButton,
  Checkbox,
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

  const toggleItem = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleAll = () => {
    const allChecked = SERVICE_ITEMS.every((item) => checked[item.id]);
    setChecked(Object.fromEntries(SERVICE_ITEMS.map((item) => [item.id, !allChecked])));
  };

  const selectedItems = SERVICE_ITEMS.filter((item) => checked[item.id]);
  const allChecked    = SERVICE_ITEMS.every((item) => checked[item.id]);

  /**
   * 印刷プレビューを開く。
   * データを sessionStorage に保存し、専用の印刷ページを新タブで開く。
   * 画像は専用ページの React コンテキストで通常通り読み込まれるため確実に表示される。
   */
  const handlePrint = () => {
    if (selectedItems.length === 0) return;
    const storageKey = `service-print-${Date.now()}`;
    // localStorage はタブ間で共有されるため、新タブでも読み取れる
    localStorage.setItem(storageKey, JSON.stringify({
      sellerNumber,
      ownerName,
      propertyAddress,
      items: selectedItems.map((i) => i.id),
    }));
    window.open(`/service-support-print?key=${storageKey}`, '_blank');
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

        {/* 横1列リスト（サムネイル + ラベル + チェックボックス） */}
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
              <Typography
                variant="body2"
                sx={{ flex: 1, fontWeight: checked[item.id] ? 700 : 400, color: checked[item.id] ? accentColor : 'text.secondary' }}
              >
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
