import React from 'react';
import { Box, Typography } from '@mui/material';

// ============================================================
// 型定義
// ============================================================

interface PurchaseApplicationPrintSheetProps {
  propertyAddress?: string;
  propertyPrice?: number | null;
}

// ============================================================
// ヘルパー関数
// ============================================================

function formatPriceWithComma(price?: number | null): string {
  if (!price) return '';
  // DBの価格は円単位で保存されているのでそのままカンマ区切りにする
  return price.toLocaleString('ja-JP');
}

// ============================================================
// メインコンポーネント
// ============================================================

const PurchaseApplicationPrintSheet = React.forwardRef<HTMLDivElement, PurchaseApplicationPrintSheetProps>(
  ({ propertyAddress, propertyPrice }, ref) => {
    const priceDisplay = formatPriceWithComma(propertyPrice);

    return (
      <Box
        ref={ref}
        sx={{
          width: '210mm',
          minHeight: '297mm',
          p: '15mm 20mm',
          bgcolor: '#fff',
          fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
          fontSize: '10pt',
          color: '#000',
          boxSizing: 'border-box',
          position: 'relative',
          '@media print': {
            width: '210mm',
            minHeight: '297mm',
            p: '15mm 20mm',
            margin: 0,
          },
        }}
      >
        {/* 10万円キャンペーンチェックボックス（1500万超のみ） */}
        {(Number(propertyPrice) || 0) > 15000000 && (
          <Box sx={{ position: 'absolute', top: '8mm', right: '14mm', fontSize: '16pt' }}>
            ☐
          </Box>
        )}
        {/* タイトル */}
        <Typography
          sx={{
            fontSize: '18pt',
            fontWeight: 'bold',
            textAlign: 'center',
            mb: 2,
            textDecoration: 'underline',
            textUnderlineOffset: '4px',
          }}
        >
          買付申込書
        </Typography>

        {/* 日付 */}
        <Box sx={{ textAlign: 'right', mb: 3 }}>
          <Typography sx={{ fontSize: '10pt' }}>
            {'　　　　'}年{'　　　'}月{'　　　'}日
          </Typography>
        </Box>

        {/* 申込者情報テーブル */}
        <Box sx={{ mb: 3, border: '1px solid #000' }}>
          <TableRow label="住所" value="" />
          <TableRow label="□借家　□持ち家（売却ご予定　ある・なし）" value="" isSubRow />
          <TableRow label="連絡先電話番号" value="" />
          <TableRow label="メールアドレス" value="" />
          <TableRow label="契約名義人氏名" value="" />
          <TableRow label="勤務先" value="" />
          <TableRowSplit leftLabel="勤続年数" rightLabel="年収" isLastRow />
        </Box>

        {/* 仲介業者情報 */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: '9pt' }}>
            仲介業者：株式会社いふう
          </Typography>
          <Typography sx={{ fontSize: '9pt', pl: 6 }}>
            大分市舞鶴町1-3-30
          </Typography>
          <Typography sx={{ fontSize: '9pt', pl: 6 }}>
            TEL：097-533-2022
          </Typography>
        </Box>

        {/* 宣言文 */}
        <Typography sx={{ fontSize: '10pt', mb: 2 }}>
          私は、下記不動産を、下記の条件にて購入したく、買い付けることを証明致します。
        </Typography>

        {/* 記 */}
        <Typography sx={{ fontSize: '10pt', textAlign: 'center', mb: 2 }}>
          記
        </Typography>

        {/* 1. 物件 */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 2, pl: 1 }}>
          <Typography sx={{ fontSize: '10pt', minWidth: '80px' }}>
            １，物件
          </Typography>
          <Box sx={{ flex: 1, borderBottom: '1px solid #000', pb: 0.5, ml: 2, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '12pt', fontWeight: 'bold' }}>
              {propertyAddress || ''}
            </Typography>
          </Box>
        </Box>

        {/* 2. 条件 */}
        <Box sx={{ pl: 1, mb: 2 }}>
          <Typography sx={{ fontSize: '10pt', mb: 1 }}>
            ２，条件
          </Typography>

          {/* 購入価格 */}
          <Box sx={{ display: 'flex', alignItems: 'baseline', pl: 6, mb: 1.5 }}>
            <Typography sx={{ fontSize: '10pt', minWidth: '80px' }}>
              購入価格
            </Typography>
            <Box sx={{ flex: 1, borderBottom: '1px solid #000', pb: 0.5, mx: 1, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '12pt', fontWeight: 'bold' }}>
                {priceDisplay}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '10pt' }}>円</Typography>
          </Box>

          {/* 手付金 */}
          <Box sx={{ display: 'flex', alignItems: 'baseline', pl: 6, mb: 1.5 }}>
            <Typography sx={{ fontSize: '10pt', minWidth: '80px' }}>
              手付金
            </Typography>
            <Box sx={{ flex: 1, borderBottom: '1px solid #000', pb: 0.5, mx: 1 }}>
              <Typography sx={{ fontSize: '12pt' }}>&nbsp;</Typography>
            </Box>
            <Typography sx={{ fontSize: '10pt' }}>円</Typography>
          </Box>

          {/* 契約日・決済日 */}
          <Box sx={{ display: 'flex', alignItems: 'baseline', pl: 6, mb: 1.5, gap: 2 }}>
            <Typography sx={{ fontSize: '10pt' }}>
              契約日（仮）
            </Typography>
            <Box sx={{ borderBottom: '1px solid #000', width: '40px', textAlign: 'center' }}>
              &nbsp;
            </Box>
            <Typography sx={{ fontSize: '10pt' }}>月</Typography>
            <Box sx={{ borderBottom: '1px solid #000', width: '40px', textAlign: 'center' }}>
              &nbsp;
            </Box>
            <Typography sx={{ fontSize: '10pt' }}>日</Typography>
            <Typography sx={{ fontSize: '10pt', ml: 2 }}>
              決済日（仮）
            </Typography>
            <Box sx={{ borderBottom: '1px solid #000', width: '40px', textAlign: 'center' }}>
              &nbsp;
            </Box>
            <Typography sx={{ fontSize: '10pt' }}>月</Typography>
            <Box sx={{ borderBottom: '1px solid #000', width: '40px', textAlign: 'center' }}>
              &nbsp;
            </Box>
            <Typography sx={{ fontSize: '10pt' }}>日</Typography>
          </Box>
        </Box>

        {/* 3. 支払い方法 */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', pl: 1, mb: 2 }}>
          <Typography sx={{ fontSize: '10pt', minWidth: '100px' }}>
            ３，支払い方法
          </Typography>
          <Typography sx={{ fontSize: '10pt', ml: 4 }}>
            □ 銀行融資{'　　　　　　　'}□ 自己資金
          </Typography>
        </Box>

        {/* 4. 有効期限 */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', pl: 1, mb: 2 }}>
          <Typography sx={{ fontSize: '10pt', minWidth: '100px' }}>
            ４，有効期限
          </Typography>
          <Typography sx={{ fontSize: '10pt', ml: 4 }}>
            本書の有効期間は　提出日より　<strong>２週間</strong>　といたします。
          </Typography>
        </Box>

        {/* 5. 火災保険の見積もり */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', pl: 1, mb: 2 }}>
          <Typography sx={{ fontSize: '10pt', minWidth: '140px' }}>
            ５，火災保険の見積もり
          </Typography>
          <Typography sx={{ fontSize: '10pt', ml: 2 }}>
            希望する　・　希望しない
          </Typography>
        </Box>

        {/* 6. その他条件 */}
        <Box sx={{ pl: 1, mb: 2 }}>
          <Typography sx={{ fontSize: '10pt', mb: 1 }}>
            ６，その他条件
          </Typography>
        </Box>

        {/* 条件説明ボックス */}
        <Box sx={{ border: '1px solid #000', p: 1.5, fontSize: '8.5pt', lineHeight: 1.6 }}>
          <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', mb: 0.5 }}>
            ☐ 契約日について
          </Typography>
          <Typography sx={{ fontSize: '8.5pt', mb: 1 }}>
            買付証明書を提出した日から2週間以内に契約日を協議のうえ決定し、
            契約締結に向けて誠意をもって進めるものとします。
            また、融資を受ける場合は、買付証明書提出後すぐに金融機関へローンの仮審査の手続きを
            開始するものとします。
          </Typography>

          <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', mb: 0.5 }}>
            ☐ 買付後のキャンセルについて
          </Typography>
          <Typography sx={{ fontSize: '8.5pt', mb: 1 }}>
            買付証明書に記載された条件に基づき、金額等の条件交渉が成立した場合、
            正当な理由なく一方的に買付証明書を撤回することはできないものとします。
          </Typography>

          <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', mb: 0.5 }}>
            ☐ 住宅ローン特約について
          </Typography>
          <Typography sx={{ fontSize: '8.5pt', mb: 1 }}>
            本売買契約は、住宅ローン特約付きの契約として締結するものとします。
            （住宅ローン審査が否認となった場合には、契約を白紙解除できる特約を付します。）
          </Typography>

          <Typography sx={{ fontSize: '8pt', color: '#333', mt: 1 }}>
            ※本申込は購入意思を示すものであり、先に他のお客様より申込が入っている場合には、
            2番手以降での受付となる可能性があることをあらかじめご了承ください。
          </Typography>
        </Box>
      </Box>
    );
  }
);

PurchaseApplicationPrintSheet.displayName = 'PurchaseApplicationPrintSheet';

// ============================================================
// テーブル行コンポーネント
// ============================================================

function TableRow({
  label,
  value,
  suffix,
  isSubRow,
  isLastRow,
}: {
  label: string;
  value: string;
  suffix?: string;
  isSubRow?: boolean;
  isLastRow?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: isLastRow ? 'none' : '1px solid #000',
        minHeight: '32px',
      }}
    >
      <Box
        sx={{
          width: isSubRow ? '100%' : '140px',
          px: 1,
          py: 0.5,
          borderRight: isSubRow ? 'none' : '1px solid #000',
          fontSize: '9pt',
        }}
      >
        <Typography sx={{ fontSize: '9pt' }}>{label}</Typography>
      </Box>
      {!isSubRow && (
        <Box sx={{ flex: 1, px: 1, py: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '10pt' }}>{value}</Typography>
          {suffix && (
            <Typography sx={{ fontSize: '9pt', color: '#333' }}>{suffix}</Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

function TableRowSplit({
  leftLabel,
  rightLabel,
  isLastRow,
}: {
  leftLabel: string;
  rightLabel: string;
  isLastRow?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: isLastRow ? 'none' : '1px solid #000',
        minHeight: '32px',
      }}
    >
      {/* 左ラベル: 勤続年数 */}
      <Box
        sx={{
          width: '140px',
          px: 1,
          py: 0.5,
          borderRight: '1px solid #000',
          fontSize: '9pt',
        }}
      >
        <Typography sx={{ fontSize: '9pt' }}>{leftLabel}</Typography>
      </Box>
      {/* 左記入欄 */}
      <Box sx={{ flex: 1, px: 1, py: 0.5, borderRight: '1px solid #000', minHeight: '32px' }}>
      </Box>
      {/* 右ラベル: 年収 */}
      <Box
        sx={{
          width: '80px',
          px: 1,
          py: 0.5,
          borderRight: '1px solid #000',
          fontSize: '9pt',
        }}
      >
        <Typography sx={{ fontSize: '9pt' }}>{rightLabel}</Typography>
      </Box>
      {/* 右記入欄 */}
      <Box sx={{ flex: 1, px: 1, py: 0.5, minHeight: '32px' }}>
      </Box>
    </Box>
  );
}

export default PurchaseApplicationPrintSheet;
