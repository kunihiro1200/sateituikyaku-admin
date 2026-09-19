import React from 'react';
import { Box, Typography } from '@mui/material';

// ============================================================
// 型定義
// ============================================================

interface CommissionDiscountSheetProps {
  printDate?: string;
  propertyNumber?: string;
  propertyAddress?: string;
  sellerName?: string;
  salesAssignee?: string;
  mediationType?: string;
  discountReason?: string;
}

// ============================================================
// メインコンポーネント
// ============================================================

const CommissionDiscountSheet = React.forwardRef<HTMLDivElement, CommissionDiscountSheetProps>(
  (
    {
      printDate,
      propertyNumber,
      propertyAddress,
      sellerName,
      salesAssignee,
      mediationType,
      discountReason,
    },
    ref
  ) => {
    const formatDate = (dateStr?: string): string => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr.replace(/\//g, '-'));
        if (isNaN(d.getTime())) return dateStr;
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      } catch {
        return dateStr;
      }
    };

    const dateDisplay = formatDate(printDate);

    const FieldRow = ({ label, value }: { label: string; value?: string }) => (
      <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: '4mm', gap: '4mm' }}>
        <Typography
          sx={{
            fontSize: '13pt',
            fontWeight: 600,
            minWidth: '5.5em',
            flexShrink: 0,
            color: '#333',
            lineHeight: 1.5,
          }}
        >
          {label}
        </Typography>
        <Box sx={{ flex: 1, borderBottom: '1.5px solid #444', pb: '1mm', minHeight: '8mm' }}>
          <Typography sx={{ fontSize: '13pt', fontWeight: 400, lineHeight: 1.5 }}>
            {value || '\u00a0'}
          </Typography>
        </Box>
      </Box>
    );

    return (
      <Box
        ref={ref}
        sx={{
          // 画面プレビュー用：210mm固定
          width: '210mm',
          minHeight: '297mm',
          p: '14mm 16mm',
          bgcolor: '#fff',
          fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
          color: '#000',
          boxSizing: 'border-box',
          // 印刷時：@pageのmarginに任せてwidth/paddingはリセット
          '@media print': {
            width: '100%',
            minHeight: 'auto',
            p: '0',
            margin: '0',
          },
        }}
      >
        {/* 日付 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: '4mm' }}>
          <Typography sx={{ fontSize: '12pt', color: '#444' }}>{dateDisplay}</Typography>
        </Box>

        {/* タイトル */}
        <Typography
          sx={{
            fontSize: '20pt',
            fontWeight: 'bold',
            textAlign: 'center',
            letterSpacing: '0.25em',
            mb: '7mm',
            borderBottom: '2.5px solid #000',
            pb: '3mm',
          }}
        >
          仲介手数料　割引申請書
        </Typography>

        {/* 物件情報 */}
        <Box sx={{ border: '1.5px solid #555', borderRadius: '3px', p: '5mm 8mm 2mm', mb: '6mm' }}>
          <Typography sx={{ fontSize: '12pt', fontWeight: 700, color: '#555', mb: '4mm' }}>
            ▍ 物件情報
          </Typography>
          <FieldRow label="物件番号" value={propertyNumber} />
          <FieldRow label="物件住所" value={propertyAddress} />
          <FieldRow label="売主名" value={sellerName} />
          <FieldRow label="営業担当" value={salesAssignee} />
          <Box sx={{ mb: '2mm' }}>
            <FieldRow label="媒介形態" value={mediationType} />
          </Box>
        </Box>

        {/* 割引理由 */}
        <Box sx={{ border: '1.5px solid #555', borderRadius: '3px', p: '5mm 8mm', mb: '6mm' }}>
          <Typography sx={{ fontSize: '12pt', fontWeight: 700, color: '#555', mb: '3mm' }}>
            ▍ 仲介手数料割引理由
          </Typography>
          <Box
            sx={{
              border: '1px solid #bbb',
              borderRadius: '2px',
              minHeight: '85mm',
              p: '4mm 6mm',
              bgcolor: '#fafafa',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            }}
          >
            <Typography sx={{ fontSize: '13pt', lineHeight: 1.9, color: '#111' }}>
              {discountReason || ''}
            </Typography>
          </Box>
        </Box>

        {/* 上長確認サイン */}
        <Box sx={{ border: '1.5px solid #555', borderRadius: '3px', p: '5mm 8mm 7mm' }}>
          <Typography sx={{ fontSize: '12pt', fontWeight: 700, color: '#555', mb: '5mm' }}>
            ▍ 上長確認サイン
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                width: '80mm',
                height: '45mm',
                border: '1.5px solid #888',
                borderRadius: '3px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                pb: '3mm',
                bgcolor: '#fff',
              }}
            >
              <Typography sx={{ fontSize: '11pt', color: '#666' }}>上長確認サイン（自筆）</Typography>
            </Box>
          </Box>
        </Box>

        {/* フッター */}
        <Box sx={{ mt: '6mm', textAlign: 'center' }}>
          <Typography sx={{ fontSize: '11pt', color: '#888' }}>
            株式会社威風　／　株式会社くじら不動産
          </Typography>
        </Box>
      </Box>
    );
  }
);

CommissionDiscountSheet.displayName = 'CommissionDiscountSheet';

export default CommissionDiscountSheet;
