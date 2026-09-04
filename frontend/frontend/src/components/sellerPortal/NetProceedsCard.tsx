import { useEffect, useState } from 'react';
import { Paper, Typography, Box, Button, CircularProgress, Badge } from '@mui/material';
import { sellerPortalApi, ValuationSummary } from '../../services/sellerPortalApi';
import DetailedProceedsWizard from './DetailedProceedsWizard';
import ProceedsTable, { ProceedsTableRow } from './ProceedsTable';

interface RoughRow {
  priceYen: number;
  brokerageFee: number;
  stampDuty: number;
  netProceeds: number;
}

/**
 * 「売却したらいくら残る？」カード。
 * ① ざっくり手残り（自動表示、仲介手数料・印紙代のみ差し引き）
 * ② その他の詳細な費用も確認（ステップ式ウィザードへ）
 */
export default function NetProceedsCard({
  token,
  valuation,
  sellerNumber,
  savedDetailedAnswers,
  hasUnreadReply,
  onAskQuestion,
}: {
  token: string;
  valuation: ValuationSummary | null;
  sellerNumber: string;
  savedDetailedAnswers?: Record<string, any> | null;
  /** スタッフからこの相談元への未読返信があるか（あれば質問ボタンに赤丸を表示する） */
  hasUnreadReply?: boolean;
  onAskQuestion: () => void;
}) {
  const [rows, setRows] = useState<RoughRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const tableRows: ProceedsTableRow[] = rows.map((row) => ({
    priceYen: row.priceYen,
    netProceeds: row.netProceeds,
    details: [
      { label: '仲介手数料', value: row.brokerageFee },
      { label: '印紙代', value: row.stampDuty },
    ],
  }));

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

  return (
    <Paper sx={{ p: 2.5, borderRadius: 3 }} elevation={0} variant="outlined">
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

      <Button
        fullWidth
        variant="outlined"
        sx={{ mt: 2 }}
        onClick={() => setWizardOpen(true)}
      >
        その他費用も差し引く
      </Button>

      <Badge color="error" variant="dot" invisible={!hasUnreadReply} sx={{ mt: 1 }}>
        <Button size="small" variant="text" onClick={onAskQuestion}>
          この手残りについて相談する
        </Button>
      </Badge>

      <DetailedProceedsWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        token={token}
        valuation={valuation}
        sellerNumber={sellerNumber}
        savedAnswers={savedDetailedAnswers as any}
      />
    </Paper>
  );
}
