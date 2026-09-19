import React from 'react';

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

    // フィールド行（純粋なHTML/CSS）
    const FieldRow = ({ label, value }: { label: string; value?: string }) => (
      <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '5mm', gap: '4mm' }}>
        <span style={{
          fontSize: '16pt',
          fontWeight: 600,
          minWidth: '5.5em',
          flexShrink: 0,
          color: '#333',
          lineHeight: 1.5,
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        <div style={{
          flex: 1,
          borderBottom: '1.5px solid #444',
          paddingBottom: '1mm',
          minHeight: '9mm',
          overflow: 'hidden',
        }}>
          <span style={{ fontSize: '16pt', fontWeight: 400, lineHeight: 1.5 }}>
            {value || '\u00a0'}
          </span>
        </div>
      </div>
    );

    return (
      <div
        ref={ref}
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '14mm 16mm',
          backgroundColor: '#fff',
          fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
          color: '#000',
          boxSizing: 'border-box',
        }}
      >
        {/* 印刷時スタイル上書き */}
        <style>{`
          @media print {
            #commission-discount-sheet-inner {
              width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            #commission-discount-sheet-inner * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}</style>

        {/* 日付 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4mm' }}>
          <span style={{ fontSize: '13pt', color: '#444' }}>{dateDisplay}</span>
        </div>

        {/* タイトル */}
        <div style={{
          fontSize: '22pt',
          fontWeight: 'bold',
          textAlign: 'center',
          letterSpacing: '0.25em',
          marginBottom: '8mm',
          borderBottom: '2.5px solid #000',
          paddingBottom: '3mm',
        }}>
          仲介手数料　割引申請書
        </div>

        {/* 物件情報 */}
        <div style={{
          border: '1.5px solid #555',
          borderRadius: '3px',
          padding: '6mm 8mm 3mm',
          marginBottom: '6mm',
        }}>
          <div style={{ fontSize: '13pt', fontWeight: 700, color: '#555', marginBottom: '5mm' }}>
            ▍ 物件情報
          </div>
          <FieldRow label="物件番号" value={propertyNumber} />
          <FieldRow label="物件住所" value={propertyAddress} />
          <FieldRow label="売主名" value={sellerName} />
          <FieldRow label="営業担当" value={salesAssignee} />
          <div style={{ marginBottom: '2mm' }}>
            <FieldRow label="媒介形態" value={mediationType} />
          </div>
        </div>

        {/* 割引理由 */}
        <div style={{
          border: '1.5px solid #555',
          borderRadius: '3px',
          padding: '6mm 8mm',
          marginBottom: '6mm',
        }}>
          <div style={{ fontSize: '13pt', fontWeight: 700, color: '#555', marginBottom: '4mm' }}>
            ▍ 仲介手数料割引理由
          </div>
          <div style={{
            border: '1px solid #bbb',
            borderRadius: '2px',
            minHeight: '55mm',
            padding: '4mm 6mm',
            backgroundColor: '#fafafa',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
            boxSizing: 'border-box',
          }}>
            <span style={{ fontSize: '15pt', lineHeight: 1.9, color: '#111' }}>
              {discountReason || ''}
            </span>
          </div>
        </div>

        {/* 上長確認サイン */}
        <div style={{
          border: '1.5px solid #555',
          borderRadius: '3px',
          padding: '6mm 8mm 8mm',
        }}>
          <div style={{ fontSize: '13pt', fontWeight: 700, color: '#555', marginBottom: '5mm' }}>
            ▍ 上長確認サイン
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: '80mm',
              height: '32mm',
              border: '1.5px solid #888',
              borderRadius: '3px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: '3mm',
              backgroundColor: '#fff',
              boxSizing: 'border-box',
            }}>
              <span style={{ fontSize: '12pt', color: '#666' }}>上長確認サイン（自筆）</span>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div style={{ marginTop: '3mm', textAlign: 'center' }}>
          <span style={{ fontSize: '12pt', color: '#888' }}>
            株式会社威風　／　株式会社くじら不動産
          </span>
        </div>
      </div>
    );
  }
);

CommissionDiscountSheet.displayName = 'CommissionDiscountSheet';

export default CommissionDiscountSheet;
