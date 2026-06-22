import React from 'react';
import { Box, Typography } from '@mui/material';

// ============================================================
// 型定義
// ============================================================

interface FundingPlanSheetProps {
  propertyAddress?: string;
  propertyPrice?: number | null;
  propertyType?: string; // 種別（マンション判定に使用）
  printDate?: string;
  propertyNumber?: string;
}

// ============================================================
// 計算ヘルパー
// ============================================================

/** 印紙代（売買契約書貼付） */
function calcInshiDai(price: number): number {
  if (price <= 1_000_000) return 500;
  if (price <= 5_000_000) return 1_000;
  if (price <= 10_000_000) return 5_000;
  if (price <= 50_000_000) return 10_000;
  return 30_000;
}

/** 所有権移転・抵当権設定費用等 */
function calcShoyukenIten(price: number): number {
  return price >= 10_000_000 ? 300_000 : 200_000;
}

/** 仲介手数料 */
function calcChukaiTesuryo(price: number): number {
  if (price <= 8_000_000) return 330_000;
  return Math.round((price * 0.03 + 60_000) * 1.1);
}

/** 火災保険料・地震保険料 */
function calcKasaiHoken(propertyType?: string): number {
  if (propertyType && propertyType.includes('マンション')) return 200_000;
  return 300_000;
}

/** 銀行金消契約印紙代（固定） */
const GINKO_INSHI = 22_000;

/** 銀行融資事務手数料（固定） */
const GINKO_JIMU = 220_000;

/** 月額返済額（元利均等返済） */
function calcMonthlyPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12 / 100;
  const n = years * 12;
  if (r === 0) return Math.round(principal / n);
  return Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

/** カンマ区切り */
function fmt(n: number): string {
  return n.toLocaleString('ja-JP');
}

/** 今日の日付 YYYY/MM/DD */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================================
// スタイル定数
// ============================================================

const FONT = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';

const cellSx = {
  border: '1px solid #000',
  px: 1,
  py: 0.5,
  fontSize: '9pt',
};

// ============================================================
// メインコンポーネント
// ============================================================

const FundingPlanSheet = React.forwardRef<HTMLDivElement, FundingPlanSheetProps>(
  ({ propertyAddress, propertyPrice, propertyType, printDate, propertyNumber }, ref) => {
    const price = propertyPrice || 0;
    const today = printDate || todayStr();
    const isFI = (propertyNumber || '').toUpperCase().includes('FI');
    const footerText = isFI
      ? '株式会社くじら不動産　福岡市中央区舞鶴3－1－10　TEL:092-401-5331'
      : '㈱いふう　大分市舞鶴町1-3-30　TEL:097-533-2022　MAIL: tenant@ifoo-oita.com';

    // 諸経費内訳
    const inshi = calcInshiDai(price);
    const shoyuken = calcShoyukenIten(price);
    const chukai = calcChukaiTesuryo(price);
    const kasai = calcKasaiHoken(propertyType);
    // 固定資産税・都市計画税の清算金 → 実費（表示のみ）
    const shokeihi = inshi + shoyuken + chukai + kasai + GINKO_INSHI + GINKO_JIMU;

    // 購入費用概算
    const total = price + shokeihi;

    // 借入金額 = 総額（物件価格＋諸経費）
    const borrowing = total;

    // 月額返済額
    const monthly_hendo = calcMonthlyPayment(borrowing, 0.95, 35);
    const monthly_flat = calcMonthlyPayment(borrowing, 1.30, 35);

    return (
      <Box
        ref={ref}
        sx={{
          width: '210mm',
          minHeight: '297mm',
          p: '10mm 15mm',
          bgcolor: '#fff',
          fontFamily: FONT,
          fontSize: '9pt',
          color: '#000',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          '@media print': {
            width: '210mm',
            minHeight: '297mm',
            p: '10mm 15mm',
            margin: 0,
          },
        }}
      >
        {/* タイトルボックス */}
        <Box sx={{ border: '2px solid #000', textAlign: 'center', py: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '14pt', fontWeight: 'bold', fontFamily: FONT }}>
            資金計画書《概算》
          </Typography>
        </Box>

        {/* 作成日 + 物件住所 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0 }}>
          <Typography sx={{ fontSize: '9pt' }}>
            作成日：　{today}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '10pt', mb: 1.5, borderBottom: '1px solid #000', pb: 0.5 }}>
          {propertyAddress || ''}
        </Typography>

        {/* ===== 購入費用（概算）テーブル ===== */}
        <Box sx={{ border: '2px solid #000', mb: 2 }}>
          {/* ヘッダー */}
          <Box sx={{ bgcolor: '#d9d9d9', textAlign: 'center', py: 0.8, borderBottom: '1px solid #000' }}>
            <Typography sx={{ fontSize: '11pt', fontWeight: 'bold', fontFamily: FONT }}>
              購入費用（概算）
            </Typography>
          </Box>

          {/* 物件価格 */}
          <Box sx={{ display: 'flex', borderBottom: '1px solid #000' }}>
            <Box sx={{ width: '40%', ...cellSx, bgcolor: '#f2f2f2', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '10pt', fontWeight: 'bold', fontFamily: FONT }}>物件価格</Typography>
            </Box>
            <Box sx={{ flex: 1, ...cellSx, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
              <Typography sx={{ fontSize: '11pt', fontWeight: 'bold', fontFamily: FONT }}>{fmt(price)}</Typography>
              <Typography sx={{ fontSize: '9pt', fontFamily: FONT }}>円</Typography>
            </Box>
          </Box>

          {/* 諸経費 */}
          <Box sx={{ display: 'flex', borderBottom: '1px solid #000' }}>
            <Box sx={{ width: '40%', ...cellSx, bgcolor: '#f2f2f2', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '10pt', fontWeight: 'bold', fontFamily: FONT }}>諸経費</Typography>
            </Box>
            <Box sx={{ flex: 1, ...cellSx, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
              <Typography sx={{ fontSize: '11pt', fontWeight: 'bold', fontFamily: FONT }}>{fmt(shokeihi)}</Typography>
              <Typography sx={{ fontSize: '9pt', fontFamily: FONT }}>円</Typography>
            </Box>
          </Box>

          {/* 総額 */}
          <Box sx={{ display: 'flex' }}>
            <Box sx={{ width: '40%', ...cellSx, bgcolor: '#f2f2f2', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '10pt', fontWeight: 'bold', fontFamily: FONT }}>総額</Typography>
            </Box>
            <Box sx={{ flex: 1, ...cellSx, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
              <Typography sx={{ fontSize: '11pt', fontWeight: 'bold', fontFamily: FONT }}>{fmt(total)}</Typography>
              <Typography sx={{ fontSize: '9pt', fontFamily: FONT }}>円</Typography>
            </Box>
          </Box>
        </Box>

        {/* ===== 住宅ローン 変動金利 ===== */}
        <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', mb: 0.3, fontFamily: FONT }}>
          【住宅ローン】★変動金利
        </Typography>
        <LoanTable
          lender="大分銀行"
          years={35}
          borrowing={borrowing}
          rate={0.95}
          monthly={monthly_hendo}
        />

        {/* ===== 住宅ローン フラット35 ===== */}
        <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', mt: 1.5, mb: 0.3, fontFamily: FONT }}>
          【住宅ローン】★フラット35（固定金利）
        </Typography>
        <LoanTable
          lender="ARUHI"
          years={35}
          borrowing={borrowing}
          rate={1.30}
          monthly={monthly_flat}
        />

        {/* ===== 諸経費内訳テーブル ===== */}
        <Box sx={{ border: '1px solid #000', mt: 2, flex: 1 }}>
          {/* ヘッダー行 */}
          <Box sx={{ display: 'flex', bgcolor: '#d9d9d9', borderBottom: '1px solid #000' }}>
            <Box sx={{ flex: 2, ...cellSx, textAlign: 'center', fontWeight: 'bold' }}>
              <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', fontFamily: FONT }}>内訳</Typography>
            </Box>
            <Box sx={{ flex: 1, ...cellSx, textAlign: 'center', fontWeight: 'bold' }}>
              <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', fontFamily: FONT }}>金額（概算）</Typography>
            </Box>
            <Box sx={{ flex: 1.5, ...cellSx, textAlign: 'center', fontWeight: 'bold' }}>
              <Typography sx={{ fontSize: '9pt', fontWeight: 'bold', fontFamily: FONT }}>備考</Typography>
            </Box>
          </Box>

          {/* 印紙代 */}
          <DetailRow
            label="印紙代（売買契約書貼付）"
            amount={fmt(inshi)}
            note=""
          />

          {/* 所有権移転 */}
          <DetailRow
            label="所有権移転等"
            amount={fmt(shoyuken)}
            note="評価額によって異なります"
          />

          {/* 仲介手数料 */}
          <DetailRow
            label="仲介手数料"
            amount={fmt(chukai)}
            note="●801万円以上（3%+6万×消費税）&#10;●800万円以下（33万円）"
          />

          {/* 固定資産税 */}
          <DetailRow
            label="固定資産税・都市計画税の清算金"
            amount="実費"
            note="引渡日で按分します"
          />

          {/* 火災保険 */}
          <DetailRow
            label="火災保険料・地震保険料"
            amount={fmt(kasai)}
            note="プランによって異なります"
          />

          {/* 銀行金消契約印紙代 */}
          <DetailRow
            label="銀行金消契約印紙代"
            amount={fmt(GINKO_INSHI)}
            note="住宅ローンの契約書に貼る印紙です"
          />

          {/* 銀行融資事務手数料 */}
          <DetailRow
            label="銀行融資事務手数料"
            amount={fmt(GINKO_JIMU)}
            note="各銀行により異なります"
          />

          {/* 空行 */}
          <Box sx={{ display: 'flex', borderBottom: '1px solid #000', minHeight: '24px' }}>
            <Box sx={{ flex: 2, ...cellSx }} />
            <Box sx={{ flex: 1, ...cellSx }} />
            <Box sx={{ flex: 1.5, ...cellSx }} />
          </Box>

          {/* 諸経費合計 */}
          <Box sx={{ display: 'flex' }}>
            <Box sx={{ flex: 2, ...cellSx, fontWeight: 'bold' }}>
              <Typography sx={{ fontSize: '10pt', fontWeight: 'bold', fontFamily: FONT }}>
                諸経費合計（概算）
              </Typography>
            </Box>
            <Box sx={{ flex: 1, ...cellSx, textAlign: 'right', fontWeight: 'bold' }}>
              <Typography sx={{ fontSize: '10pt', fontWeight: 'bold', fontFamily: FONT }}>
                {fmt(shokeihi)}
              </Typography>
            </Box>
            <Box sx={{ flex: 1.5, ...cellSx }}>
              <Typography sx={{ fontSize: '7.5pt', fontFamily: FONT, whiteSpace: 'pre-wrap' }}>
                *物件価格以外にかかる{'\n'}費用です
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* フッター */}
        <Box sx={{ mt: 1, pt: 0.5, borderTop: '1px solid #000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '8pt', fontFamily: FONT }}>
            {footerText}
          </Typography>
          <Typography sx={{ fontSize: '7pt', color: '#666', fontFamily: FONT }}>
            info→3
          </Typography>
        </Box>
      </Box>
    );
  }
);

FundingPlanSheet.displayName = 'FundingPlanSheet';

// ============================================================
// サブコンポーネント: ローンテーブル
// ============================================================

function LoanTable({
  lender,
  years,
  borrowing,
  rate,
  monthly,
}: {
  lender: string;
  years: number;
  borrowing: number;
  rate: number;
  monthly: number;
}) {
  const FONT = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';
  const cellSx = { border: '1px solid #000', px: 1, py: 0.5, fontSize: '9pt' };

  return (
    <Box sx={{ border: '1px solid #000' }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', bgcolor: '#f2f2f2', borderBottom: '1px solid #000' }}>
        {['借入先', '借入期間（年）', '借入金額', '金利', '月額返済額', 'ボーナス返済（2回）'].map((h) => (
          <Box key={h} sx={{ flex: 1, ...cellSx, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '8pt', fontWeight: 'bold', fontFamily: FONT }}>{h}</Typography>
          </Box>
        ))}
      </Box>
      {/* データ行 */}
      <Box sx={{ display: 'flex' }}>
        <Box sx={{ flex: 1, ...cellSx }}>
          <Typography sx={{ fontSize: '9pt', fontFamily: FONT }}>{lender}</Typography>
        </Box>
        <Box sx={{ flex: 1, ...cellSx, textAlign: 'right' }}>
          <Typography sx={{ fontSize: '9pt', fontFamily: FONT }}>{years}</Typography>
        </Box>
        <Box sx={{ flex: 1, ...cellSx, textAlign: 'right' }}>
          <Typography sx={{ fontSize: '9pt', fontFamily: FONT }}>{borrowing.toLocaleString()}</Typography>
        </Box>
        <Box sx={{ flex: 1, ...cellSx, textAlign: 'right' }}>
          <Typography sx={{ fontSize: '9pt', fontFamily: FONT }}>{rate.toFixed(2)}%</Typography>
        </Box>
        <Box sx={{ flex: 1, ...cellSx, textAlign: 'right' }}>
          <Typography sx={{ fontSize: '9pt', fontFamily: FONT }}>{monthly.toLocaleString()}</Typography>
        </Box>
        <Box sx={{ flex: 1, ...cellSx, textAlign: 'right' }}>
          <Typography sx={{ fontSize: '9pt', fontFamily: FONT }}>50000</Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ============================================================
// サブコンポーネント: 内訳行
// ============================================================

function DetailRow({
  label,
  amount,
  note,
}: {
  label: string;
  amount: string;
  note: string;
}) {
  const FONT = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';
  const cellSx = { border: '1px solid #000', px: 1, py: 0.5 };

  return (
    <Box sx={{ display: 'flex', borderBottom: '1px solid #000' }}>
      <Box sx={{ flex: 2, ...cellSx }}>
        <Typography sx={{ fontSize: '9pt', fontFamily: FONT }}>{label}</Typography>
      </Box>
      <Box sx={{ flex: 1, ...cellSx, textAlign: 'right' }}>
        <Typography sx={{ fontSize: '9pt', fontFamily: FONT }}>{amount}</Typography>
      </Box>
      <Box sx={{ flex: 1.5, ...cellSx }}>
        <Typography sx={{ fontSize: '7.5pt', fontFamily: FONT, whiteSpace: 'pre-wrap' }}>{note}</Typography>
      </Box>
    </Box>
  );
}

export default FundingPlanSheet;
