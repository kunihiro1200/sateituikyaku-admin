import { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import api from '../services/api';

/**
 * 売却サポートページ「全体分析」ダッシュボード。
 * ・このURL自体へのアクセス数（トークンのaccess_count合計）
 * ・セクション別アクセス数（査定額/査定根拠/ざっくり手残り/詳細手残り/スケジュール/PWA保存クリック）
 * ・福岡（FI）/大分（FI以外）/全体（合計）の3列で比較できるようにする
 */
const SECTION_LABELS: Record<string, string> = {
  valuation: '査定額',
  valuation_breakdown: '査定根拠',
  net_proceeds_rough: 'ざっくり手残り',
  net_proceeds_detailed: '詳細手残り',
  schedule: '売却スケジュール',
  pwa_install: 'この査定ページを保存（クリック数）',
};

interface AnalyticsSummary {
  totalUrlAccessCount: { all: number; fukuoka: number; oita: number };
  sectionViewCounts: Record<string, { all: number; fukuoka: number; oita: number }>;
}

export default function SellerPortalAnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/seller-portal/admin/analytics-summary');
        setSummary(res.data);
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || '取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
        売却サポートページ：全体分析
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        全売主の売却サポートページ（/portal/:token）へのアクセス状況を、福岡（FI）/大分（FI以外）/全体で比較できます。
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && summary && (
        <>
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
              このURL自体のアクセス数
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              各売主の専用URLへのアクセス回数の合計（同一売主が複数トークンを持つ場合は合算）
            </Typography>
            <SummaryTable
              rows={[{ label: '専用URLへのアクセス数', ...summary.totalUrlAccessCount }]}
            />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
              セクション別アクセス数
            </Typography>
            <SummaryTable
              rows={Object.entries(summary.sectionViewCounts).map(([key, counts]) => ({
                label: SECTION_LABELS[key] ?? key,
                ...counts,
              }))}
            />
          </Paper>
        </>
      )}
    </Box>
  );
}

function SummaryTable({ rows }: { rows: Array<{ label: string; all: number; fukuoka: number; oita: number }> }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>項目</TableCell>
          <TableCell align="right">全体（福岡＋大分）</TableCell>
          <TableCell align="right">福岡（FI）</TableCell>
          <TableCell align="right">大分（FI以外）</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell>{row.label}</TableCell>
            <TableCell align="right">
              <Typography fontWeight="bold">{row.all.toLocaleString()}</Typography>
            </TableCell>
            <TableCell align="right">{row.fukuoka.toLocaleString()}</TableCell>
            <TableCell align="right">{row.oita.toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
