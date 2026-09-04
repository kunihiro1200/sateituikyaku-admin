import { useEffect, useState } from 'react';
import { Paper, Typography, Box, Button, CircularProgress, Alert } from '@mui/material';
import { sellerPortalApi, ValuationSummary } from '../../services/sellerPortalApi';
import DetailedProceedsWizard from './DetailedProceedsWizard';
import ProceedsTable, { ProceedsTableRow } from './ProceedsTable';
import InlineChatSection from './InlineChatSection';
import { calculateDetailedProceeds, DetailedProceedsAnswers, DetailedProceedsResult } from './detailedProceedsCalculator';

interface RoughRow {
  priceYen: number;
  brokerageFee: number;
  stampDuty: number;
  netProceeds: number;
}

/**
 * 「売却したらいくら残る？」カード。
 * ① ざっくり手残り（自動表示、仲介手数料・印紙代のみ差し引き）
 * ② 詳細な手残り（質問に一度答えれば、以降はページを開くたびにこのカード内に自動表示される）
 *
 * 🚨 以前は詳細な手残りの結果を DetailedProceedsWizard モーダルの中に表示していたため、
 * モーダルを閉じると結果が消え、次回開くたびに毎回同じ質問からやり直しになっていた
 * （回答自体はDBに保存されていたが、表示側が復元をモーダルの再訪時にしか行わなかったための不具合）。
 * 今回、結果表示をこのカードに移し、savedDetailedAnswers があればページ表示時に自動で計算・表示する。
 */
export default function NetProceedsCard({
  token,
  valuation,
  sellerNumber,
  savedDetailedAnswers,
  hasUnreadReply,
  onMessagesRead,
}: {
  token: string;
  valuation: ValuationSummary | null;
  sellerNumber: string;
  savedDetailedAnswers?: DetailedProceedsAnswers | null;
  /** スタッフからこの相談元への未読返信があるか（あれば赤丸を表示する） */
  hasUnreadReply?: boolean;
  onMessagesRead?: () => void;
}) {
  const [rows, setRows] = useState<RoughRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const [detailedResult, setDetailedResult] = useState<DetailedProceedsResult | null>(null);
  const [detailedAnswers, setDetailedAnswers] = useState<DetailedProceedsAnswers | null>(null);
  const [detailedLoading, setDetailedLoading] = useState(false);
  const [detailedError, setDetailedError] = useState('');

  const tableRows: ProceedsTableRow[] = rows.map((row) => ({
    priceYen: row.priceYen,
    netProceeds: row.netProceeds,
    details: [
      { label: '仲介手数料', value: row.brokerageFee },
      { label: '印紙代', value: row.stampDuty },
    ],
  }));

  const detailedTableRows: ProceedsTableRow[] = (detailedResult?.rows ?? []).map(
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
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await sellerPortalApi.getRoughProceeds(token);
        setRows(res.rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // 前回の回答が保存済みであれば、質問し直さずページ表示時に自動で詳細手残りを計算・表示する
  useEffect(() => {
    if (!savedDetailedAnswers || Object.keys(savedDetailedAnswers).length === 0) return;
    setDetailedLoading(true);
    calculateDetailedProceeds(token, sellerNumber, valuation, savedDetailedAnswers)
      .then((result) => {
        setDetailedResult(result);
        setDetailedAnswers(savedDetailedAnswers);
      })
      .catch((err) => setDetailedError(err.message || '計算に失敗しました'))
      .finally(() => setDetailedLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleWizardCompleted = (result: DetailedProceedsResult, answers: DetailedProceedsAnswers) => {
    setDetailedResult(result);
    setDetailedAnswers(answers);
    setDetailedError('');
  };

  return (
    <Paper sx={{ p: 2.5, borderRadius: 3, bgcolor: '#E8F5E9' }} elevation={0} variant="outlined">
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
        売却したらいくら残る？
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        仲介手数料・印紙代のみ差し引く
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!loading && <ProceedsTable rows={tableRows} />}

      {detailedLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {detailedError && <Alert severity="error" sx={{ mt: 1.5 }}>{detailedError}</Alert>}

      {!detailedLoading && detailedResult && (
        <Box sx={{ mt: 2.5 }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5 }}>
            詳しい手残り
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            仲介手数料・印紙代・ローン残高・抵当権抹消費用・譲渡所得税を差し引く
          </Typography>
          {detailedResult.qualifiesForSpecialDeduction && (
            <Alert severity="success" sx={{ mb: 1.5 }}>
              居住用財産の3,000万円特別控除の対象として、譲渡所得税を計算しています。
            </Alert>
          )}
          <ProceedsTable rows={detailedTableRows} />
          <Alert severity="info" sx={{ mt: 1.5 }}>
            こちらは概算です。実際の税額については税理士・税務署等への確認が必要です。
          </Alert>
          <Button size="small" sx={{ mt: 1 }} onClick={() => setWizardOpen(true)}>
            回答をやり直す
          </Button>
        </Box>
      )}

      {!detailedLoading && !detailedResult && (
        <Button
          fullWidth
          variant="outlined"
          sx={{ mt: 2 }}
          onClick={() => setWizardOpen(true)}
        >
          その他費用も差し引く
        </Button>
      )}

      <InlineChatSection
        token={token}
        contextTag="net_proceeds"
        label="この手残りについて相談する"
        hasUnreadReply={hasUnreadReply}
        onMessagesRead={onMessagesRead}
        bgColor="#D7EDD9"
      />

      <DetailedProceedsWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        token={token}
        valuation={valuation}
        sellerNumber={sellerNumber}
        initialAnswers={detailedAnswers}
        onCompleted={handleWizardCompleted}
      />
    </Paper>
  );
}
