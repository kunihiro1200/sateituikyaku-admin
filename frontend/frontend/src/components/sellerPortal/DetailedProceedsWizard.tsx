import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, RadioGroup, Radio, FormControlLabel, TextField, Alert,
} from '@mui/material';
import { sellerPortalApi, ValuationSummary } from '../../services/sellerPortalApi';

const fmtMan = (yen: number) => `${Math.round(yen / 10000).toLocaleString()}万円`;

type Answers = {
  hasLoan?: 'yes' | 'no';
  loanBalanceMan?: string;
  hasMortgage?: 'yes' | 'no';
  isResident?: 'yes' | 'no';
  isInherited?: 'yes' | 'no';
  acquisitionKnown?: 'yes' | 'no' | 'unknown';
  acquisitionCostMan?: string;
  purchaseYear?: string;
};

/**
 * 詳細な手残り計算のステップ式Q&Aウィザード。
 * 一度に大量の項目を表示せず、1問ずつ回答してもらい、回答によって不要な質問を省略する。
 * 既存の calcTransferTax（backend/src/utils/proceedsCalculator.ts）と同じ入力形式に合わせる。
 */
export default function DetailedProceedsWizard({
  open,
  onClose,
  token,
  valuation,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  valuation: ValuationSummary | null;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLand = valuation?.propertyType === 'land';

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
      key: 'hasMortgage',
      question: '物件に抵当権は設定されていますか？',
      render: () => (
        <YesNo value={answers.hasMortgage} onChange={(v) => setAnswers({ ...answers, hasMortgage: v })} />
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
      key: 'isInherited',
      question: '相続した物件ですか？',
      render: () => (
        <YesNo value={answers.isInherited} onChange={(v) => setAnswers({ ...answers, isInherited: v })} />
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
      const mortgageReleaseFee = answers.hasMortgage === 'yes' ? 30_000 : 0;
      const loanBalance = answers.hasLoan === 'yes' ? Math.round(parseFloat(answers.loanBalanceMan || '0') * 10_000) : 0;

      let mode: 'unknown' | 'known' | 'none' = 'none';
      if (answers.hasMortgage === 'yes' || loanBalance > 0) {
        mode = answers.acquisitionKnown === 'yes' ? 'known' : 'unknown';
      } else if (answers.acquisitionKnown === 'yes') {
        mode = 'known';
      } else if (answers.acquisitionKnown === 'no') {
        mode = 'unknown';
      }

      // 3000万円特別控除：居住用かつ相続でない場合、要件を満たす可能性がある旨を概算に反映する
      // （要件確認は必須ではないため、ここでは「適用できる可能性がある」場合のみ概算に含める）
      const mayApplySpecialDeduction = answers.isResident === 'yes' && answers.isInherited !== 'yes';

      await sellerPortalApi.saveKnownFacts(token, {
        has_loan: answers.hasLoan === 'yes',
        loan_balance: loanBalance,
        has_mortgage: answers.hasMortgage === 'yes',
        is_resident: answers.isResident === 'yes',
        is_inherited: answers.isInherited === 'yes',
      });

      const res = await sellerPortalApi.getDetailedProceeds(token, {
        loanBalance,
        mortgageReleaseFee,
        transferTax: {
          mode,
          acquisitionCost: answers.acquisitionCostMan ? Math.round(parseFloat(answers.acquisitionCostMan) * 10_000) : undefined,
          purchaseYear: answers.purchaseYear ? parseInt(answers.purchaseYear, 10) : undefined,
          specialDeduction: mayApplySpecialDeduction ? 30_000_000 : 0,
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
            {rows.map((row) => (
              <Box key={row.priceYen} sx={{ py: 1, borderBottom: '1px solid #eee' }}>
                <Typography variant="body2">{fmtMan(row.priceYen)}で売却の場合</Typography>
                <Typography variant="body1" fontWeight="bold" color="primary">
                  詳細な手残り: {fmtMan(row.netProceeds)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  仲介手数料 {row.brokerageFee.toLocaleString()}円 / 印紙代 {row.stampDuty.toLocaleString()}円 / ローン残高 {row.loanBalance.toLocaleString()}円 / 抵当権抹消費用 {row.mortgageReleaseFee.toLocaleString()}円 / 譲渡所得税概算 {row.transferTax.toLocaleString()}円
                </Typography>
              </Box>
            ))}
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
