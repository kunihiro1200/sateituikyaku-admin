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
import { api } from '../utils/api';

// 月別データの型
interface MonthlyData {
  yearMonth: string;
  label: string;
  decisionDate: string | null;
  competitors: string[];
  factors: string[];
  reason: string;
  assignees: string[];
}

// 売主情報の型
interface SellerInfo {
  id: string;
  sellerNumber: string;
  name: string;
  propertyAddress: string;
  status: string;
  exclusiveDecisionDate: string | null;
  visitAssignee: string | null;
  visitValuationAcquirer: string | null;
  exclusiveOtherDecisionMeeting: string | null;
}

interface AnalysisData {
  seller: SellerInfo;
  monthlyData: MonthlyData[];
  aiSummary: string;
}

export default function SellerExclusiveAnalysisPage() {
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
      const response = await api.get(`/api/sellers/${id}/exclusive-analysis`);
      setData(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 専任決定日のフォーマット
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
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/sellers/${id}/call`)}
          sx={{ mt: 2 }}
        >
          通話モードに戻る
        </Button>
      </Box>
    );
  }

  if (!data) return null;

  const { seller, monthlyData, aiSummary } = data;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, sm: 3 } }}>
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

      {/* 売主情報ヘッダー */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#fff3e0', borderLeft: '4px solid #ff6d00' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
          🏠 専任媒介分析レポート
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">売主番号</Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{seller.sellerNumber}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">物件住所</Typography>
            <Typography variant="body2">{seller.propertyAddress || '未登録'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">ステータス</Typography>
            <Chip
              label={seller.status}
              size="small"
              sx={{ bgcolor: '#ff6d00', color: '#fff', fontWeight: 'bold', ml: 0.5 }}
            />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">専任決定日</Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {formatDate(seller.exclusiveDecisionDate)}
            </Typography>
          </Box>
          {seller.visitAssignee && (
            <Box>
              <Typography variant="caption" color="text.secondary">営担</Typography>
              <Typography variant="body2">{seller.visitAssignee}</Typography>
            </Box>
          )}
          {seller.exclusiveOtherDecisionMeeting && (
            <Box>
              <Typography variant="caption" color="text.secondary">専任他決打合せ</Typography>
              <Chip
                label={seller.exclusiveOtherDecisionMeeting}
                size="small"
                color={seller.exclusiveOtherDecisionMeeting === '完了' ? 'success' : 'default'}
                sx={{ ml: 0.5 }}
              />
            </Box>
          )}
        </Box>
      </Paper>

      {/* AIまとめ */}
      {aiSummary && (
        <Card sx={{ mb: 3, bgcolor: '#f3e5f5', border: '1px solid #ce93d8' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#9c27b0' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#6a1b9a' }}>
                AIまとめ（次の担当者への引き継ぎ）
              </Typography>
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {aiSummary}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* 月別テーブル */}
      {monthlyData.length === 0 ? (
        <Alert severity="info">
          専任（他決）決定日が登録されていないため、月別データを表示できません。
          <br />
          通話モードページで「専任（他決）決定日」を入力してください。
        </Alert>
      ) : (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            📅 月別データ（専任決定日 {formatDate(seller.exclusiveDecisionDate)} から）
          </Typography>
          <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
            <Table size="small" sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#ff6d00' }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 90 }}>月</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 110 }}>決定日</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>競合</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>専任他決要因</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>競合名・理由</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 80 }}>担当</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlyData.map((row, idx) => {
                  // 専任決定月は強調表示
                  const isDecisionMonth = !!row.decisionDate;
                  return (
                    <TableRow
                      key={row.yearMonth}
                      sx={{
                        bgcolor: isDecisionMonth
                          ? '#fff3e0'
                          : idx % 2 === 0 ? '#fff' : '#fafafa',
                        '&:hover': { bgcolor: '#fff9c4' },
                      }}
                    >
                      <TableCell sx={{ fontWeight: isDecisionMonth ? 'bold' : 'normal' }}>
                        {row.label}
                        {isDecisionMonth && (
                          <Chip
                            label="決定"
                            size="small"
                            sx={{
                              ml: 0.5,
                              height: 16,
                              fontSize: '0.65rem',
                              bgcolor: '#ff6d00',
                              color: '#fff',
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {row.decisionDate ? formatDate(row.decisionDate) : '－'}
                      </TableCell>
                      <TableCell>
                        {row.competitors.length > 0 ? (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {row.competitors.map((c) => (
                              <Chip
                                key={c}
                                label={c}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#e3f2fd' }}
                              />
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
                              <Chip
                                key={f}
                                label={f}
                                size="small"
                                sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f3e5f5' }}
                              />
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">－</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', maxWidth: 200 }}>
                        {row.reason || <Typography variant="caption" color="text.secondary">－</Typography>}
                      </TableCell>
                      <TableCell>
                        {row.assignees.length > 0 ? (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {row.assignees.map((a) => (
                              <Chip
                                key={a}
                                label={a}
                                size="small"
                                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#e8f5e9' }}
                              />
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">－</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            ※ 担当者はアクティビティログから自動取得。競合・要因・理由は専任決定月のデータです。
          </Typography>
        </>
      )}
    </Box>
  );
}
