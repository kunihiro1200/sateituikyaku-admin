import React from 'react';
import { Box, Typography } from '@mui/material';

// ============================================================
// 型定義
// ============================================================

interface CommissionDiscountSheetProps {
  /** 印刷日（YYYY-MM-DD形式） */
  printDate?: string;
  /** 物件番号 */
  propertyNumber?: string;
  /** 物件住所 */
  propertyAddress?: string;
  /** 売主名 */
  sellerName?: string;
  /** 担当名（営業担当） */
  salesAssignee?: string;
  /** 媒介形態 */
  mediationType?: string;
  /** 仲介手数料割引理由 */
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
    // 日付の表示フォーマット（YYYY-MM-DD → YYYY年MM月DD日）
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

    // ラベル行コンポーネント
    const FieldRow = ({
      label,
      value,
      labelWidth = '120px',
    }: {
      label: string;
      value?: string;
      labelWidth?: string;
    }) => (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          mb: '10px',
          gap: '8px',
        }}
      >
        <Typography
          sx={{
            fontSize: '10pt',
            fontWeight: 600,
            minWidth: labelWidth,
            flexShrink: 0,
            color: '#333',
          }}
        >
          {label}
        </Typography>
        <Box
          sx={{
            flex: 1,
            borderBottom: '1.5px solid #333',
            pb: '2px',
            minHeight: '22px',
          }}
        >
          <Typography sx={{ fontSize: '11pt', fontWeight: 500 }}>{value || '\u00a0'}</Typography>
        </Box>
      </Box>
    );

    return (
      <Box
        ref={ref}
        sx={{
          width: '210mm',
          minHeight: '297mm',
          p: '16mm 18mm 14mm',
          bgcolor: '#fff',
          fontFamily:
            '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", "Yu Gothic", sans-serif',
          fontSize: '10pt',
          color: '#000',
          boxSizing: 'border-box',
          '@media print': {
            width: '210mm',
            minHeight: '297mm',
            p: '16mm 18mm 14mm',
            margin: 0,
          },
        }}
      >
        {/* ===== ヘッダー：日付＋タイトル ===== */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: '4mm' }}>
          <Typography sx={{ fontSize: '9.5pt', color: '#444' }}>
            {dateDisplay && `${dateDisplay}`}
          </Typography>
        </Box>

        <Typography
          sx={{
            fontSize: '18pt',
            fontWeight: 'bold',
            textAlign: 'center',
            letterSpacing: '0.25em',
            mb: '8mm',
            borderBottom: '2.5px solid #000',
            pb: '3mm',
          }}
        >
          仲介手数料　割引申請書
        </Typography>

        {/* ===== 物件情報セクション ===== */}
        <Box
          sx={{
            border: '1.5px solid #555',
            borderRadius: '4px',
            p: '5mm 6mm',
            mb: '7mm',
          }}
        >
          <Typography
            sx={{
              fontSize: '9pt',
              fontWeight: 700,
              color: '#555',
              mb: '4mm',
              letterSpacing: '0.05em',
            }}
          >
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

        {/* ===== 割引理由セクション ===== */}
        <Box
          sx={{
            border: '1.5px solid #555',
            borderRadius: '4px',
            p: '5mm 6mm',
            mb: '8mm',
          }}
        >
          <Typography
            sx={{
              fontSize: '9pt',
              fontWeight: 700,
              color: '#555',
              mb: '3mm',
              letterSpacing: '0.05em',
            }}
          >
            ▍ 仲介手数料割引理由
          </Typography>

          {/* 理由テキストエリア */}
          <Box
            sx={{
              border: '1px solid #aaa',
              borderRadius: '3px',
              minHeight: '60mm',
              p: '3mm 4mm',
              bgcolor: '#fafafa',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            }}
          >
            <Typography sx={{ fontSize: '10.5pt', lineHeight: 1.9, color: '#111' }}>
              {discountReason || ''}
            </Typography>
          </Box>
        </Box>

        {/* ===== 上長確認サインセクション ===== */}
        <Box
          sx={{
            border: '1.5px solid #555',
            borderRadius: '4px',
            p: '5mm 6mm',
          }}
        >
          <Typography
            sx={{
              fontSize: '9pt',
              fontWeight: 700,
              color: '#555',
              mb: '5mm',
              letterSpacing: '0.05em',
            }}
          >
            ▍ 上長確認サイン
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            {/* サイン枠（1つのみ） */}
            <Box
              sx={{
                width: '60mm',
                border: '1px solid #888',
                borderRadius: '4px',
                height: '32mm',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                pb: '2mm',
                bgcolor: '#fff',
              }}
            >
              <Typography sx={{ fontSize: '8.5pt', color: '#666' }}>上長確認サイン（自筆）</Typography>
            </Box>
          </Box>
        </Box>

        {/* ===== フッター ===== */}
        <Box sx={{ mt: '6mm', textAlign: 'center' }}>
          <Typography sx={{ fontSize: '8pt', color: '#888' }}>
            株式会社威風　／　株式会社くじら不動産
          </Typography>
        </Box>
      </Box>
    );
  }
);

CommissionDiscountSheet.displayName = 'CommissionDiscountSheet';

export default CommissionDiscountSheet;
