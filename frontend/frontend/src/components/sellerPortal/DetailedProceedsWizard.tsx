import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, RadioGroup, Radio, FormControlLabel, TextField, Alert,
} from '@mui/material';
import { sellerPortalApi, ValuationSummary } from '../../services/sellerPortalApi';
import ProceedsTable, { ProceedsTableRow } from './ProceedsTable';

type Answers = {
  hasLoan?: 'yes' | 'no'; // 住宅ローン残高の有無＝抵当権の有無として扱う（重複質問を避ける）
  loanBalanceMan?: string;
  isOwner?: 'yes' | 'no'; // 名義人が売主本人かどうか（3000万円特別控除の要件）
  isResident?: 'yes' | 'no'; // 現在居住しているか（3000万円特別控除の要件）
  moveOutYear?: string; // 居住していない場合、住民票を移した年（3年以内かどうかの判定用）
  acquisitionKnown?: 'yes' | 'no';
  acquisitionCostMan?: string;
  purchaseYear?: string;
};

/**
 * 詳細な手残り計算のステップ式Q&Aウィザード。
 * 一度に大量の項目を表示せず、1問ずつ回答してもらい、回答によって不要な質問を省略する。
 * 既存の calcTransferTax（backend/src/utils/proceedsCalculator.ts）と同じ入力形式に合わせる。
 *
 * 質問設計の方針：
 * - 「住宅ローンが残っている」＝「抵当権が設定されている」として1つの質問に統合する
 *   （別々に聞くと同じ内容を二重に確認することになるため）
 * - 3000万円特別控除（居住用財産の譲渡）は、名義人が本人かつ
 *   ①現在居住している、または②居住していないが住民票の移動から3年以内、のいずれかで適用対象とする
 */
export default function DetailedProceedsWizard({
  open,
  onClose,
  token,
  valuation,
  sellerNumber,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  valuation: ValuationSummary | null;
  sellerNumber: string;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [rows, setRows] = useState<any[] | null>(null);
  const [specialDeductionApplied, setSpecialDeductionApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLand = valuation?.propertyType === 'land';
  const currentYear = new Date().getFullYear();

  const steps: Array<{
    key: keyof Answers;
    question: string;
    render: () => JSX.Element;
    skip?: () => boolean;
  }> = [
    {
      key: 'hasLoan',
      question: '住宅ローンは残っていますか？',
      render: () => (
        <YesNo value={answers.hasLoan} onChange={(v) => setAnswers({ ...answers, hasLoan: v })} />
      ),
    },
    {
      key: 'loanBalanceMan',
      question: '現在のローン残高はいくらですか？（万円）',
      skip: () => answers.hasLoan !== 'yes',
      render: () => (
        <TextField
          fullWidth
          type="number"
          placeholder="例: 1200"
          value={answers.loanBalanceMan ?? ''}
          onChange={(e) => setAnswers({ ...answers, loanBalanceMan: e.target.value })}
        />
      ),
    },
    {
      key: 'isOwner',
      question: '物件の名義人はご自身ですか？',
      render: () => (
        <YesNo value={answers.isOwner} onChange={(v) => setAnswers({ ...answers, isOwner: v })} />
      ),
    },
    {
      key: 'isResident',
      question: '現在、この物件に居住していますか？',
      render: () => (
        <YesNo value={answers.isResident} onChange={(v) => setAnswers({ ...answers, isResident: v })} />
      ),
    },
    {
      key: 'moveOutYear',
      question: 'この家の住民票を移したのは何年ですか？',
      skip: () => answers.isResident !== 'no',
      render: () => (
        <TextField
          fullWidth
          type="number"
          placeholder="例: 2023"
          value={answers.moveOutYear ?? ''}
          onChange={(e) => setAnswers({ ...answers, moveOutYear: e.target.value })}
        />
      ),
    },
    {
      key: 'acquisitionKnown',
      question: '購入時の売買契約書等は残っていますか？（取得費が分かるか）',
      render: () => (
        <RadioGroup
          value={answers.acquisitionKnown ?? ''}
          onChange={(e) => setAnswers({ ...answers, acquisitionKnown: e.target.value as any })}
        >
          <FormControlLabel value="yes" control={<Radio />} label="残っている（取得費が分かる）" />
          <FormControlLabel value="no" control={<Radio />} label="残っていない・分からない" />
        </RadioGroup>
      ),
    },
    {
      key: 'acquisitionCostMan',
      question: '購入価格（取得費）はいくらでしたか？（万円）',
      skip: () => answers.acquisitionKnown !== 'yes',
      render: () => (
        <TextField
          fullWidth
          type="number"
          placeholder="例: 2500"
          value={answers.acquisitionCostMan ?? ''}
          onChange={(e) => setAnswers({ ...answers, acquisitionCostMan: e.target.value })}
        />
      ),
    },
    {
      key: 'purchaseYear',
      question: '物件を購入したのは何年ですか？',
      skip: () => answers.acquisitionKnown !== 'yes' || isLand,
      render: () => (
        <TextField
          fullWidth
          type="number"
          placeholder="例: 2015"
          value={answers.purchaseYear ?? ''}
          onChange={(e) => setAnswers({ ...answers, purchaseYear: e.target.value })}
        />
      ),
    },
  ];

  const visibleSteps = steps.filter((s) => !s.skip?.());
  const current = visibleSteps[step];

  const handleNext = async () => {
    if (step < visibleSteps.length - 1) {
      setStep(step + 1);
      return;
    }
    await submit();
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      // 住宅ローン残高あり＝抵当権あり として扱う（別途「抵当権の有無」は聞かない）
      const hasMortgage = answers.hasLoan === 'yes';
      const isFiSeller = sellerNumber.trim().toUpperCase().includes('FI');
      const mortgageReleaseFee = hasMortgage ? (isFiSeller ? 50_000 : 30_000) : 0;
      const loanBalance = answers.hasLoan === 'yes' ? Math.round(parseFloat(answers.loanBalanceMan || '0') * 10_000) : 0;

      const mode: 'unknown' | 'known' = answers.acquisitionKnown === 'yes' ? 'known' : 'unknown';

      // 3000万円特別控除（居住用財産の譲渡）の適用判定：
      // 名義人が本人 かつ、①現在居住している、または②住まなくなってから3年目の年末までに売却する場合に適用
      const moveOutYear = answers.moveOutYear ? parseInt(answers.moveOutYear, 10) : undefined;
      const withinThreeYearsOfMoveOut = moveOutYear !== undefined && currentYear <= moveOutYear + 3;
      const canApplySpecialDeduction =
        answers.isOwner === 'yes' && (answers.isResident === 'yes' || withinThreeYearsOfMoveOut);
      setSpecialDeductionApplied(canApplySpecialDeduction);

      await sellerPortalApi.saveKnownFacts(token, {
        has_loan: answers.hasLoan === 'yes',
        loan_balance: loanBalance,
        is_owner: answers.isOwner === 'yes',
        is_resident: answers.isResident === 'yes',
        move_out_year: moveOutYear ?? null,
        special_deduction_applied: canApplySpecialDeduction,
      });

      const res = await sellerPortalApi.getDetailedProceeds(token, {
        loanBalance,
        mortgageReleaseFee,
        transferTax: {
          mode,
          acquisitionCost: answers.acquisitionCostMan ? Math.round(parseFloat(answers.acquisitionCostMan) * 10_000) : undefined,
          purchaseYear: answers.purchaseYear ? parseInt(answers.purchaseYear, 10) : undefined,
          specialDeduction: canApplySpecialDeduction ? 30_000_000 : 0,
        },
      });
      setRows(res.rows);
    } catch (err: any) {
      setError(err.message || '計算に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(0);
    setAnswers({});
    setRows(null);
    setSpecialDeductionApplied(false);
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>詳しい手残り計算</DialogTitle>
      <DialogContent>
        {!rows && current && (
          <Box sx={{ py: 1 }}>
            <Typography variant="caption" color="text.secondary">
              質問 {step + 1} / {visibleSteps.length}
            </Typography>
            <Typography variant="body1" fontWeight="bold" sx={{ my: 1.5 }}>
              {current.question}
            </Typography>
            {current.render()}
          </Box>
        )}

        {rows && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              仲介手数料・印紙代・ローン残高・抵当権抹消費用・譲渡所得税を差し引く
            </Typography>
            {specialDeductionApplied && (
              <Alert severity="success" sx={{ mb: 1.5 }}>
                居住用財産の3,000万円特別控除の対象として、譲渡所得税を計算しています。
              </Alert>
            )}
            <ProceedsTable
              rows={rows.map(
                (row): ProceedsTableRow => ({
                  priceYen: row.priceYen,
                  netProceeds: row.netProceeds,
                  details: [
                    { label: '仲介手数料', value: row.brokerageFee },
                    { label: '印紙代', value: row.stampDuty },
                    { label: 'ローン残高', value: row.loanBalance },
                    { label: '抵当権抹消費用', value: row.mortgageReleaseFee },
                    { label: '譲渡所得税概算', value: row.transferTax },
                  ],
                })
              )}
            />
            <Alert severity="info" sx={{ mt: 2 }}>
              こちらは概算です。実際の税額については税理士・税務署等への確認が必要です。
            </Alert>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>閉じる</Button>
        {!rows && (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={loading || !isAnswered(current, answers)}
          >
            {loading ? '計算中...' : step < visibleSteps.length - 1 ? '次へ' : '計算する'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function isAnswered(step: { key: keyof Answers } | undefined, answers: Answers): boolean {
  if (!step) return false;
  const v = answers[step.key];
  return v !== undefined && v !== '';
}

function YesNo({ value, onChange }: { value?: 'yes' | 'no'; onChange: (v: 'yes' | 'no') => void }) {
  return (
    <RadioGroup value={value ?? ''} onChange={(e) => onChange(e.target.value as 'yes' | 'no')}>
      <FormControlLabel value="yes" control={<Radio />} label="はい" />
      <FormControlLabel value="no" control={<Radio />} label="いいえ" />
    </RadioGroup>
  );
}
