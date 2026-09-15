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

    // ラベル行：幅固定せず flex で自然に広がる
    const FieldRow = ({ label, value }: { label: string; value?: string }) => (
      <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: '5mm', gap: '4mm' }}>
        <Typography
          sx={{
            fontSize: '14pt',
            fontWeight: 600,
            minWidth: '5.5em',
            flexShrink: 0,
            color: '#333',
            lineHeight: 1.4,
          }}
        >
          {label}
        </Typography>
        <Box sx={{ flex: 1, borderBottom: '1.5px solid #444', pb: '1mm', minHeight: '8mm' }}>
          <Typography sx={{ fontSize: '14pt', fontWeight: 400, lineHeight: 1.4 }}>
            {value || '\u00a0'}
          </Typography>
        </Box>
      </Box>
    );

    return (
      <Box
        ref={ref}
        sx={{
          // 画面表示用は 210mm 固定
          width: '210mm',
          minHeight: '297mm',
          p: '15mm 18mm 12mm',
          bgcolor: '#fff',
          fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
          color: '#000',
          boxSizing: 'border-box',
          // 印刷時：幅を 100% にしてブラウザの印刷領域に合わせる
          '@media print': {
            width: '100%',
            minHeight: 'auto',
            p: '0',
            margin: '0',
          },
        }}
      >
        {/* 日付 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: '5mm' }}>
          <Typography sx={{ fontSize: '11pt', color: '#444' }}>{dateDisplay}</Typography>
        </Box>

        {/* タイトル */}
        <Typography
          sx={{
            fontSize: '22pt',
            fontWeight: 'bold',
            textAlign: 'center',
            letterSpacing: '0.3em',
            mb: '9mm',
            borderBottom: '3px solid #000',
            pb: '4mm',
          }}
        >
          仲介手数料　割引申請書
        </Typography>

        {/* 物件情報 */}
        <Box sx={{ border: '2px solid #555', borderRadius: '4px', p: '6mm 8mm 3mm', mb: '8mm' }}>
          <Typography sx={{ fontSize: '11pt', fontWeight: 700, color: '#555', mb: '5mm' }}>
            ▍ 物件情報
          </Typography>
          <FieldRow label="物件番号" value={propertyNumber} />
          <FieldRow label="物件住所" value={propertyAddress} />
          <FieldRow label="売主名" value={sellerName} />
          <FieldRow label="営業担当" value={salesAssignee} />
          <Box sx={{ mb: 0 }}>
            <FieldRow label="媒介形態" value={mediationType} />
          </Box>
        </Box>

        {/* 割引理由 */}
        <Box sx={{ border: '2px solid #555', borderRadius: '4px', p: '6mm 8mm', mb: '8mm' }}>
          <Typography sx={{ fontSize: '11pt', fontWeight: 700, color: '#555', mb: '4mm' }}>
            ▍ 仲介手数料割引理由
          </Typography>
          <Box
            sx={{
              border: '1.5px solid #bbb',
              borderRadius: '3px',
              minHeight: '85mm',
              p: '4mm 5mm',
              bgcolor: '#fafafa',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            }}
          >
            <Typography sx={{ fontSize: '13pt', lineHeight: 2.0, color: '#111' }}>
              {discountReason || ''}
            </Typography>
          </Box>
        </Box>

        {/* 上長確認サイン */}
        <Box sx={{ border: '2px solid #555', borderRadius: '4px', p: '6mm 8mm 8mm' }}>
          <Typography sx={{ fontSize: '11pt', fontWeight: 700, color: '#555', mb: '6mm' }}>
            ▍ 上長確認サイン
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                width: '75mm',
                height: '42mm',
                border: '1.5px solid #888',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                pb: '3mm',
                bgcolor: '#fff',
              }}
            >
              <Typography sx={{ fontSize: '10pt', color: '#666' }}>上長確認サイン（自筆）</Typography>
            </Box>
          </Box>
        </Box>

        {/* フッター */}
        <Box sx={{ mt: '8mm', textAlign: 'center' }}>
          <Typography sx={{ fontSize: '10pt', color: '#888' }}>
            株式会社威風　／　株式会社くじら不動産
          </Typography>
        </Box>
      </Box>
    );
  }
);

CommissionDiscountSheet.displayName = 'CommissionDiscountSheet';

export default CommissionDiscountSheet;
