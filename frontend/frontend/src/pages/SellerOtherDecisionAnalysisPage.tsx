import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import api from '../services/api';

interface OtherDecisionCase {
  id: string;
  sellerNumber: string;
  propertyAddress: string;
  status: string;
  decisionDate: string | null;
  competitors: string[];
  factors: string[];
  reason: string;
  visitAssignee: string;
  isCurrentSeller: boolean;
}

interface AssigneeStats {
  name: string;
  monthLabel: string;
  monthCount: number;
  totalCount: number;
}

interface SellerInfo {
  id: string;
  sellerNumber: string;
  propertyAddress: string;
  status: string;
  decisionDate: string | null;
  visitAssignee: string | null;
}

interface AnalysisData {
  seller: SellerInfo;
  assigneeStats: AssigneeStats | null;
  sameMonthCases: OtherDecisionCase[];
  aiAnalysis: string;
}

// ステータスに応じた色
const STATUS_COLORS: Record<string, string> = {
  '他決→追客': '#ef5350',
  '他決→追客不要': '#b71c1c',
  '他決→専任': '#e65100',
  '他決→一般': '#f57c00',
  '一般→他決': '#c62828',
  '専任→他社専任': '#6a1b9a',
};

export default function SellerOtherDecisionAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisData | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchAnalysis();
  }, [id]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/sellers/${id}/other-decision-analysis`);
      setData(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '－';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/sellers/${id}/call`)} sx={{ mt: 2 }}>
          通話モードに戻る
        </Button>
      </Box>
    );
  }

  if (!data) return null;

  const { seller, assigneeStats, sameMonthCases, aiAnalysis } = data;

  if (!seller.decisionDate || !seller.visitAssignee) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/sellers/${id}/call`)} sx={{ mb: 2 }} variant="outlined" size="small">
          通話モードに戻る
        </Button>
        <Alert severity="info">
          専任（他決）決定日または営業担当（営担）が登録されていないため、分析を表示できません。
          <br />通話モードページで「専任（他決）決定日」と「営担」を入力してください。
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* 戻るボタン */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/sellers/${id}/call`)}
        sx={{ mb: 2 }}
        variant="outlined"
        size="small"
      >
        通話モードに戻る
      </Button>

      {/* ヘッダー */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#fce4ec', borderLeft: '4px solid #e53935' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <TrendingDownIcon sx={{ color: '#e53935' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            他決分析
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">営業担当</Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#e53935' }}>
              {seller.visitAssignee}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">対象月</Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {assigneeStats?.monthLabel}
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto', textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">今月の他決件数</Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#c62828' }}>
              {assigneeStats?.monthCount ?? 0}<Typography component="span" variant="body2">件</Typography>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              通算 {assigneeStats?.totalCount ?? 0}件
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* AI分析 */}
      {aiAnalysis && (
        <Card sx={{ mb: 3, bgcolor: '#fff3e0', border: '1px solid #ffb74d' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#e65100' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#bf360c' }}>
                AI分析：{seller.visitAssignee}の他決パターンと改善ポイント
              </Typography>
              <Chip label="スタッフ共有用" size="small" sx={{ bgcolor: '#e65100', color: '#fff', ml: 1 }} />
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {aiAnalysis}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* 同月他決案件テーブル */}
      {sameMonthCases.length === 0 ? (
        <Alert severity="info">
          {assigneeStats?.monthLabel}に{seller.visitAssignee}が担当した他決案件が見つかりません。
        </Alert>
      ) : (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            📋 {assigneeStats?.monthLabel}　{seller.visitAssignee}の他決案件一覧（{sameMonthCases.length}件）
          </Typography>
          <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#e53935' }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 80 }}>売主番号</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>物件住所</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 110 }}>ステータス</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 100 }}>他決日</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>競合</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>他決要因</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>競合名・理由詳細</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sameMonthCases.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    sx={{
                      bgcolor: row.isCurrentSeller
                        ? '#ffcdd2'
                        : idx % 2 === 0 ? '#fff' : '#fafafa',
                      '&:hover': { bgcolor: '#fce4ec' },
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/sellers/${row.id}/call`)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: row.isCurrentSeller ? 'bold' : 'normal', fontSize: '0.8rem' }}>
                          {row.sellerNumber}
                        </Typography>
                        {row.isCurrentSeller && (
                          <Chip label="この案件" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#e53935', color: '#fff' }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', maxWidth: 180 }}>
                      {row.propertyAddress || '未登録'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.status}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          bgcolor: STATUS_COLORS[row.status] || '#757575',
                          color: '#fff',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {formatDate(row.decisionDate)}
                    </TableCell>
                    <TableCell>
                      {row.competitors.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {row.competitors.map((c) => (
                            <Chip key={c} label={c} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#e3f2fd' }} />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">－</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.factors.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {row.factors.map((f) => (
                            <Chip key={f} label={f} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#fce4ec' }} />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">－</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', maxWidth: 200 }}>
                      {row.reason || <Typography variant="caption" color="text.secondary">－</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            ※ 行をクリックすると各売主の通話モードページに移動します。赤い行が現在の売主です。
          </Typography>
        </>
      )}
    </Box>
  );
}
