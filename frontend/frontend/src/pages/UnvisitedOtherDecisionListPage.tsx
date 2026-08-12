/**
 * UnvisitedOtherDecisionListPage - 未訪問他決 月別一覧ページ
 * 
 * 営業担当が空欄（外す含む）でステータスが他決→追客 or 他決→追客不要の売主を月別に表示
 * コメントは「【以下自動転記」の前まで表示
 * 売主追客ログを全件表示
 * 売主ごとにAI敗因分析ボタンあり
 * 対策欄が編集可能でDB保存できる
 */
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, CircularProgress, Alert, Button, TextField,
  Snackbar, IconButton, Divider, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import api from '../services/api';

interface UnvisitedSeller {
  id: string;
  sellerNumber: string;
  propertyAddress: string;
  name: string;
  comments: string;
  status: string;
  competitorNameAndReason: string;
  nextCallDate: string | null;
  contractYearMonth: string | null;
  otherDecisionCountermeasure: string;
  inquiryDate: string | null;
  valuationAmount1: number | null;
  valuationAmount2: number | null;
  valuationAmount3: number | null;
  valuationAssignee: string;
  aiAnalysis?: { summary: string; whyLost: string; countermeasure: string } | null;
}

interface MonthlyGroup {
  yearMonth: string;
  label: string;
  count: number;
  sellers: UnvisitedSeller[];
}

interface AiResult {
  summary: string;
  whyLost: string;
  countermeasure: string;
}

interface FollowUpLog {
  date: string;
  comment: string;
  assigneeFirstHalf: string;
  assigneeSecondHalf: string;
}

export default function UnvisitedOtherDecisionListPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetMonth = searchParams.get('month');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyGroup[]>([]);
  const [countermeasures, setCountermeasures] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  // AI分析（売主番号→結果）
  const [aiResults, setAiResults] = useState<Record<string, AiResult>>({});
  const [aiLoadingIds, setAiLoadingIds] = useState<Set<string>>(new Set());

  // 追客ログ（売主番号→ログ配列）
  const [followUpLogs, setFollowUpLogs] = useState<Record<string, FollowUpLog[]>>({});
  const [logsLoadingIds, setLogsLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/sellers/unvisited-other-decision-monthly-summary');
        const summary: MonthlyGroup[] = res.data?.summary || [];
        setMonthlyData(summary);

        const cm: Record<string, string> = {};
        const savedAi: Record<string, AiResult> = {};
        for (const group of summary) {
          for (const seller of group.sellers) {
            cm[seller.id] = seller.otherDecisionCountermeasure || '';
            if (seller.aiAnalysis) {
              savedAi[seller.sellerNumber] = seller.aiAnalysis;
            }
          }
        }
        setCountermeasures(cm);
        setAiResults(savedAi);

        // 表示対象の売主全員の追客ログを取得
        const targetGroups = targetMonth ? summary.filter(g => g.yearMonth === targetMonth) : summary;
        for (const group of targetGroups) {
          for (const seller of group.sellers) {
            fetchFollowUpLogs(seller.sellerNumber);
          }
        }
      } catch (err: any) {
        setError(err?.response?.data?.error || 'データ取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 追客ログを取得
  const fetchFollowUpLogs = async (sellerNumber: string) => {
    setLogsLoadingIds(prev => new Set(prev).add(sellerNumber));
    try {
      const res = await api.get(`/api/sellers/${sellerNumber}/follow-up-logs/history`);
      const logs: FollowUpLog[] = (res.data?.data || []).map((log: any) => ({
        date: log.date,
        comment: log.comment || '',
        assigneeFirstHalf: log.assigneeFirstHalf || '',
        assigneeSecondHalf: log.assigneeSecondHalf || '',
      }));
      setFollowUpLogs(prev => ({ ...prev, [sellerNumber]: logs }));
    } catch {
      // 追客ログ取得失敗は無視
    } finally {
      setLogsLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(sellerNumber);
        return next;
      });
    }
  };

  // AI分析を実行
  const fetchAiForSeller = async (seller: UnvisitedSeller) => {
    const key = seller.sellerNumber;
    setAiLoadingIds(prev => new Set(prev).add(key));
    try {
      const res = await api.get('/api/sellers/unvisited-other-decision-monthly-summary', {
        params: { ai: 'true', sellerNumber: seller.sellerNumber },
      });
      const aiResult = res.data?.aiResult;
      if (aiResult) {
        setAiResults(prev => ({ ...prev, [key]: aiResult }));
      } else {
        setSnackbar({ open: true, message: 'AI分析結果を取得できませんでした' });
      }
    } catch {
      setSnackbar({ open: true, message: 'AI分析に失敗しました。再度お試しください。' });
    } finally {
      setAiLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleSave = async (sellerId: string) => {
    try {
      setSavingIds(prev => new Set(prev).add(sellerId));
      await api.put(`/api/sellers/${sellerId}/unvisited-other-decision-countermeasure`, {
        countermeasure: countermeasures[sellerId] || '',
      });
      setSnackbar({ open: true, message: '対策を保存しました' });
    } catch {
      setSnackbar({ open: true, message: '保存に失敗しました' });
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(sellerId);
        return next;
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '－';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  // コメントからHTMLタグ除去し「【以下自動転記」の前まで表示（改行は保持）
  const truncateComment = (html: string) => {
    if (!html) return '';
    // <div>, <br>, <p> を改行に変換してからタグ除去
    const withLineBreaks = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<div[^>]*>/gi, '')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const cutIdx = withLineBreaks.indexOf('【以下自動転記');
    if (cutIdx > 0) return withLineBreaks.substring(0, cutIdx).trim();
    return withLineBreaks;
  };

  const displayData = targetMonth
    ? monthlyData.filter(g => g.yearMonth === targetMonth)
    : monthlyData;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sellers')} sx={{ mt: 2 }}>
          売主リストに戻る
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 1, sm: 2, md: 3 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/sellers')}
        sx={{ mb: 2 }}
        variant="outlined"
        size="small"
      >
        売主リストに戻る
      </Button>

      <Paper sx={{ p: 2, mb: 3, bgcolor: '#fff3e0', borderLeft: '4px solid #ff5722' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#bf360c' }}>
          🚫 未訪問他決 一覧
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          営業担当が未設定（外す含む）で、他決→追客 または 他決→追客不要 の売主を月別に表示。
        </Typography>
      </Paper>

      {displayData.length === 0 ? (
        <Alert severity="info">該当するデータがありません</Alert>
      ) : (
        displayData.map((group) => (
          <Box key={group.yearMonth} sx={{ mb: 4 }}>
            {/* 月ヘッダー */}
            <Box sx={{ bgcolor: '#ff5722', color: 'white', px: 2, py: 1, borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                【未訪問他決】{group.label}
              </Typography>
              <Chip label={`${group.count}件`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.3)', color: 'white', fontWeight: 'bold' }} />
            </Box>

            {/* テーブル */}
            <TableContainer component={Paper} sx={{ borderRadius: '0 0 4px 4px', boxShadow: 'none', border: '1px solid #ffccbc', borderTop: 'none' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#fff3e0', fontWeight: 'bold', fontSize: '0.78rem', color: '#bf360c', whiteSpace: 'nowrap', borderBottom: '2px solid #ff8a65' } }}>
                    <TableCell>売主番号</TableCell>
                    <TableCell>氏名</TableCell>
                    <TableCell>物件住所</TableCell>
                    <TableCell>ステータス</TableCell>
                    <TableCell>反響日</TableCell>
                    <TableCell>他決日</TableCell>
                    <TableCell>次電日</TableCell>
                    <TableCell>査定額</TableCell>
                    <TableCell>競合・理由</TableCell>
                    <TableCell sx={{ minWidth: 200 }}>コメント</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.sellers.map((seller) => {
                    const commentText = truncateComment(seller.comments);
                    return (
                      <TableRow key={seller.id} hover sx={{ '&:hover': { bgcolor: '#fff8e1' }, verticalAlign: 'top' }}>
                        {/* 売主番号 */}
                        <TableCell sx={{ whiteSpace: 'nowrap', py: 1 }}>
                          <Button
                            size="small"
                            onClick={() => window.open(`/sellers/${seller.id}/call`, '_blank', 'noopener,noreferrer')}
                            sx={{ textTransform: 'none', p: '0 4px', minWidth: 'auto', fontSize: '0.82rem', fontWeight: 'bold', color: '#1565c0' }}
                            endIcon={<OpenInNewIcon sx={{ fontSize: '0.65rem !important' }} />}
                          >
                            {seller.sellerNumber}
                          </Button>
                        </TableCell>
                        {/* 氏名 */}
                        <TableCell sx={{ fontSize: '0.82rem', fontWeight: 'bold', whiteSpace: 'nowrap', py: 1 }}>
                          {seller.name || '－'}
                        </TableCell>
                        {/* 物件住所 */}
                        <TableCell sx={{ fontSize: '0.78rem', py: 1 }}>
                          {seller.propertyAddress || '－'}
                        </TableCell>
                        {/* ステータス */}
                        <TableCell sx={{ whiteSpace: 'nowrap', py: 1 }}>
                          <Chip
                            label={seller.status}
                            size="small"
                            sx={{ height: 20, fontSize: '0.68rem', bgcolor: seller.status === '他決→追客' ? '#ef5350' : '#b71c1c', color: 'white' }}
                          />
                        </TableCell>
                        {/* 反響日 */}
                        <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap', py: 1 }}>{formatDate(seller.inquiryDate)}</TableCell>
                        {/* 他決日 */}
                        <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap', py: 1 }}>{formatDate(seller.contractYearMonth)}</TableCell>
                        {/* 次電日 */}
                        <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap', py: 1 }}>{formatDate(seller.nextCallDate)}</TableCell>
                        {/* 査定額 */}
                        <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap', py: 1 }}>
                          {[seller.valuationAmount1, seller.valuationAmount2, seller.valuationAmount3]
                            .filter(v => v)
                            .map(v => `${Math.round(v! / 10000)}万円`)
                            .join(' / ') || '－'}
                        </TableCell>
                        {/* 競合・理由 */}
                        <TableCell sx={{ fontSize: '0.75rem', py: 1 }}>
                          {seller.competitorNameAndReason || '－'}
                        </TableCell>
                        {/* コメント */}
                        <TableCell sx={{ fontSize: '0.75rem', py: 1, maxWidth: 300, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {commentText || '－'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))
      )}

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />
    </Box>
  );
}
