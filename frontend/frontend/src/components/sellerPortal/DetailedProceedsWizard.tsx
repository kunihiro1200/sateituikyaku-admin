import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, RadioGroup, Radio, FormControlLabel, TextField, Alert,
} from '@mui/material';
import { ValuationSummary } from '../../services/sellerPortalApi';
import { calculateDetailedProceeds, DetailedProceedsAnswers, DetailedProceedsResult } from './detailedProceedsCalculator';

type YesNoUnknown = 'yes' | 'no' | 'unknown';
type Answers = DetailedProceedsAnswers;

/**
 * 詳細な手残り計算のステップ式Q&Aウィザード（質問のみを担当するモーダル）。
 * 一度に大量の項目を表示せず、1問ずつ回答してもらい、回答によって不要な質問を省略する。
 * 既存の calcTransferTax（backend/src/utils/proceedsCalculator.ts）と同じ入力形式に合わせる。
 *
 * 🚨 計算結果はこのモーダルの中に表示しない。計算が終わったら onCompleted で呼び出し元
 * （NetProceedsCard）に結果を渡し、モーダルを閉じてカード内に埋め込み表示する。
 * これにより、モーダルを閉じても結果がページ内に残り続ける（以前は閉じるたびに結果が消えていた）。
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
  initialAnswers,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  valuation: ValuationSummary | null;
  sellerNumber: string;
  /** 前回保存済みの回答（known_facts.detailed_proceeds_answers）。あれば初期値として復元する */
  initialAnswers?: Answers | null;
  /** 計算完了時に呼ばれる。呼び出し元でこの結果をカード内に埋め込み表示する */
  onCompleted: (result: DetailedProceedsResult, answers: Answers) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initialAnswers ?? {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLand = valuation?.propertyType === 'land';
  const currentYear = new Date().getFullYear();

  // 3000万円特別控除の適用判定（名義人が本人 かつ、現在居住中、または住まなくなってから3年以内）
  const moveOutYearNum = answers.moveOutYear ? parseInt(answers.moveOutYear, 10) : undefined;
  const withinThreeYearsOfMoveOut = moveOutYearNum !== undefined && currentYear <= moveOutYearNum + 3;
  const qualifiesForSpecialDeduction =
    answers.isOwner === 'yes' && (answers.isResident === 'yes' || withinThreeYearsOfMoveOut);

  // 3000万円の控除額は、取得費が不明（売却価格の5%とみなす）でも大抵の価格帯で課税所得を吸収できる。
  // 物件価格が高額（チャレンジ価格が5000万円超）の場合のみ、控除を超える可能性があるため取得費を確認する。
  const maxPriceYen = valuation?.maximumPrice ?? 0;
  const isHighValueProperty = maxPriceYen > 50_000_000;
  const skipAcquisitionCostQuestion = qualifiesForSpecialDeduction && !isHighValueProperty;

  const steps: Array<{
    key: keyof Answers;
    question: string;
    render: () => JSX.Element;
    skip?: () => boolean;
  }> = [
    {
      key: 'hasLoan',
      question: '住宅ローンは残っていますか？（抵当権抹消費用・ローン残高の計算のため）',
      render: () => (
        <>
          <YesNo value={answers.hasLoan} onChange={(v) => setAnswers({ ...answers, hasLoan: v })} />
          {answers.hasLoan === 'unknown' && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              ローンの有無が確認できないため、抵当権が設定されているものとして（不利な側で）抹消費用を計算します。ローンが完済済みであることが確認できれば、手残り額は多くなる可能性があります。
            </Alert>
          )}
        </>
      ),
    },
    {
      key: 'loanBalanceMan',
      question: '現在のローン残高はいくらですか？（万円）',
      skip: () => answers.hasLoan !== 'yes', // 「不明」の場合は残高を聞かず、抹消費用のみ不利側で計算する
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
      question: '物件の名義人はご自身ですか？（居住用財産の3,000万円特別控除が使えるかの判定のため）',
      render: () => (
        <>
          <YesNo value={answers.isOwner} onChange={(v) => setAnswers({ ...answers, isOwner: v })} />
          {answers.isOwner === 'unknown' && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              名義人がご本人と確認できないため、居住用財産の3,000万円特別控除は適用せずに計算します。名義人がご本人であることが確認できれば、譲渡所得税が大幅に軽減される可能性があります。
            </Alert>
          )}
        </>
      ),
    },
    {
      key: 'isResident',
      question: '現在、この物件に居住していますか？（居住用財産の3,000万円特別控除が使えるかの判定のため）',
      skip: () => answers.isOwner !== 'yes',
      render: () => (
        <>
          <YesNo value={answers.isResident} onChange={(v) => setAnswers({ ...answers, isResident: v })} />
          {answers.isResident === 'unknown' && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              居住状況が確認できないため、居住用財産の3,000万円特別控除は適用せずに計算します。現在お住まいである場合や、住民票の移動から3年以内である場合は、控除が適用され譲渡所得税が大幅に軽減される可能性があります。
            </Alert>
          )}
        </>
      ),
    },
    {
      key: 'moveOutYear',
      question: 'この家の住民票を移したのは何年ですか？（住まなくなってから3年以内かどうかで、3,000万円特別控除が使えるかを判定するため）',
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
      question: '購入時の売買契約書等は残っていますか？（実際の購入価格が分かれば、譲渡所得税の計算が正確になるため）',
      skip: () => skipAcquisitionCostQuestion,
      render: () => (
        <>
          <RadioGroup
            value={answers.acquisitionKnown ?? ''}
            onChange={(e) => setAnswers({ ...answers, acquisitionKnown: e.target.value as any })}
          >
            <FormControlLabel value="yes" control={<Radio />} label="残っている（取得費が分かる）" />
            <FormControlLabel value="no" control={<Radio />} label="残っていない・分からない" />
          </RadioGroup>
          {answers.acquisitionKnown === 'no' && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              購入価格が分からないため、売却価格の5%を購入価格とみなして（不利な側で）譲渡所得税を計算します。売買契約書等が見つかって購入価格が分かれば、譲渡所得税は大幅に安くなる可能性がありますので、お探しください。
            </Alert>
          )}
        </>
      ),
    },
    {
      key: 'acquisitionCostMan',
      question: '購入価格（取得費）はいくらでしたか？（万円）（譲渡所得税の計算のため）',
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
      question: '物件を購入したのは何年ですか？（建物の減価償却費を計算するため）',
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
      const result = await calculateDetailedProceeds(token, sellerNumber, valuation, answers);
      onCompleted(result, answers);
      setStep(0);
      onClose();
    } catch (err: any) {
      setError(err.message || '計算に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>詳しい手残り計算</DialogTitle>
      <DialogContent>
        {current && (
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

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={loading || !isAnswered(current, answers)}
        >
          {loading ? '計算中...' : step < visibleSteps.length - 1 ? '次へ' : '計算する'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function isAnswered(step: { key: keyof Answers } | undefined, answers: Answers): boolean {
  if (!step) return false;
  const v = answers[step.key];
  return v !== undefined && v !== '';
}

function YesNo({ value, onChange }: { value?: YesNoUnknown; onChange: (v: YesNoUnknown) => void }) {
  return (
    <RadioGroup value={value ?? ''} onChange={(e) => onChange(e.target.value as YesNoUnknown)}>
      <FormControlLabel value="yes" control={<Radio />} label="はい" />
      <FormControlLabel value="no" control={<Radio />} label="いいえ" />
      <FormControlLabel value="unknown" control={<Radio />} label="不明" />
    </RadioGroup>
  );
}
