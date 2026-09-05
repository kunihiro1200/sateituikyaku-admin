import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert,
  Table, TableBody, TableCell, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, Link, Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import api from '../services/api';

/**
 * 売却サポートページ「全体分析」ダッシュボード。
 * 行をクリックすると、そのセクションにアクセスした売主番号・専用URL・アクセス回数の一覧が開く。
 */
const SECTION_LABELS: Record<string, string> = {
  url_access: '専用URLへのアクセス数',
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

interface DetailRow {
  sellerNumber: string;
  activeUrl: string | null;
  viewCount: number;
}

export default function SellerPortalAnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 詳細ダイアログ
  const [detailSection, setDetailSection] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

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

  const openDetail = async (section: string) => {
    setDetailSection(section);
    setDetail([]);
    setDetailError('');
    setDetailLoading(true);
    try {
      const res = await api.get('/api/seller-portal/admin/analytics-detail', { params: { section } });
      setDetail(res.data.detail || []);
    } catch (err: any) {
      setDetailError(err?.response?.data?.error || err.message || '取得に失敗しました');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
        売却サポートページ：全体分析
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        全売主の売却サポートページへのアクセス状況を、福岡（FI）/大分（FI以外）/全体で比較できます。
        <strong>行をクリックすると売主番号・URLの一覧が表示されます。</strong>
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, p: 1.5, bgcolor: '#fff8e1', borderRadius: 1 }}>
        ※ セクション別アクセス数はマイグレーション実行（2026/9/6）以降のアクセスのみ集計されます。それ以前のアクセスは記録されていません。
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
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              このURL自体のアクセス数
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              有効な専用URLへのアクセス回数の合計（失効済みトークンは除外）
            </Typography>
            <SummaryTable
              rows={[{ label: '専用URLへのアクセス数', key: 'url_access', ...summary.totalUrlAccessCount }]}
              onRowClick={openDetail}
            />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              セクション別アクセス数
            </Typography>
            <SummaryTable
              rows={Object.entries(summary.sectionViewCounts).map(([key, counts]) => ({
                label: SECTION_LABELS[key] ?? key,
                key,
                ...counts,
              }))}
              onRowClick={openDetail}
            />
          </Paper>
        </>
      )}

      {/* 詳細ダイアログ */}
      <Dialog open={!!detailSection} onClose={() => setDetailSection(null)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {detailSection ? SECTION_LABELS[detailSection] ?? detailSection : ''}の詳細
          <IconButton size="small" onClick={() => setDetailSection(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {detailLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          )}
          {detailError && <Alert severity="error">{detailError}</Alert>}
          {!detailLoading && !detailError && detail.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              該当するデータがありません。
            </Typography>
          )}
          {!detailLoading && !detailError && detail.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>売主番号</TableCell>
                  <TableCell>{detailSection === 'url_access' ? 'アクセス回数' : 'アクセス回数'}</TableCell>
                  <TableCell>専用URL</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detail.map((row) => (
                  <TableRow key={row.sellerNumber}>
                    <TableCell>
                      <Chip label={row.sellerNumber} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">{row.viewCount.toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell>
                      {row.activeUrl ? (
                        <Link href={row.activeUrl} target="_blank" rel="noopener noreferrer" sx={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                          {row.activeUrl}
                        </Link>
                      ) : (
                        <Typography variant="caption" color="text.disabled">URLなし</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailSection(null)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function SummaryTable({
  rows,
  onRowClick,
}: {
  rows: Array<{ label: string; key: string; all: number; fukuoka: number; oita: number }>;
  onRowClick: (key: string) => void;
}) {
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
          <TableRow
            key={row.key}
            hover
            onClick={() => onRowClick(row.key)}
            sx={{ cursor: 'pointer' }}
          >
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
