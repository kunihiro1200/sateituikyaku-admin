import { useEffect, useState } from 'react';
import { Paper, Typography, Box, Button, CircularProgress, Collapse, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { sellerPortalApi, ValuationSummary } from '../../services/sellerPortalApi';
import DetailedProceedsWizard from './DetailedProceedsWizard';

const fmtMan = (yen: number) => `${Math.round(yen / 10000).toLocaleString()}万円`;

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
  onAskQuestion,
}: {
  token: string;
  valuation: ValuationSummary | null;
  onAskQuestion: () => void;
}) {
  const [rows, setRows] = useState<RoughRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

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
        仲介手数料・印紙代を差し引いたざっくりの手残り額です
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!loading &&
        rows.map((row, idx) => (
          <Box key={row.priceYen} sx={{ borderBottom: idx < rows.length - 1 ? '1px solid #eee' : 'none' }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, cursor: 'pointer' }}
              onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
            >
              <Typography variant="body2">{fmtMan(row.priceYen)}で売却</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body1" fontWeight="bold" color="primary">
                  手残り {fmtMan(row.netProceeds)}
                </Typography>
                <IconButton size="small" sx={{ transform: expandedIndex === idx ? 'rotate(180deg)' : 'none' }}>
                  <ExpandMoreIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            <Collapse in={expandedIndex === idx}>
              <Box sx={{ pb: 1.5, pl: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  仲介手数料: {row.brokerageFee.toLocaleString()}円
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  印紙代: {row.stampDuty.toLocaleString()}円
                </Typography>
              </Box>
            </Collapse>
          </Box>
        ))}

      <Button
        fullWidth
        variant="outlined"
        sx={{ mt: 2 }}
        onClick={() => setWizardOpen(true)}
      >
        その他の費用も含めて詳しく計算する
      </Button>

      <Button size="small" variant="text" onClick={onAskQuestion} sx={{ mt: 1 }}>
        この手残りについて相談する
      </Button>

      <DetailedProceedsWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        token={token}
        valuation={valuation}
      />
    </Paper>
  );
}
