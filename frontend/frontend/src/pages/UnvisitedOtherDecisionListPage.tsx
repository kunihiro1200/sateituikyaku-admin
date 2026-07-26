/**
 * UnvisitedOtherDecisionListPage - 未訪問他決 月別一覧ページ
 * 
 * 営業担当が空欄（外す含む）でステータスが他決→追客 or 他決→追客不要の売主を月別に表示
 * 対策欄が編集可能でDB保存できる
 */
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Alert, Button, TextField,
  Snackbar, IconButton, Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
}

interface MonthlyGroup {
  yearMonth: string;
  label: string;
  count: number;
  sellers: UnvisitedSeller[];
}

export default function UnvisitedOtherDecisionListPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetMonth = searchParams.get('month'); // YYYY-MM形式

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyGroup[]>([]);
  const [countermeasures, setCountermeasures] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/sellers/unvisited-other-decision-monthly-summary');
        const summary: MonthlyGroup[] = res.data?.summary || [];
        setMonthlyData(summary);

        // 対策の初期値をセット
        const cm: Record<string, string> = {};
        for (const group of summary) {
          for (const seller of group.sellers) {
            cm[seller.id] = seller.otherDecisionCountermeasure || '';
          }
        }
        setCountermeasures(cm);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'データ取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async (sellerId: string) => {
    try {
      setSavingIds(prev => new Set(prev).add(sellerId));
      await api.put(`/api/sellers/${sellerId}/unvisited-other-decision-countermeasure`, {
        countermeasure: countermeasures[sellerId] || '',
      });
      setSnackbar({ open: true, message: '対策を保存しました' });
    } catch (err: any) {
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

  // 表示するデータ（特定月が指定されている場合はフィルタ）
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
          営業担当が未設定（外す含む）で、他決→追客 または 他決→追客不要 の売主を月別に表示しています。
          対策欄は編集・保存ができます。
        </Typography>
      </Paper>

      {displayData.length === 0 ? (
        <Alert severity="info">該当するデータがありません</Alert>
      ) : (
        displayData.map((group) => (
          <Paper key={group.yearMonth} sx={{ mb: 3, overflow: 'hidden' }}>
            <Box sx={{ bgcolor: '#ff5722', color: 'white', px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                【未訪問他決】{group.label}
              </Typography>
              <Chip
                label={`${group.count}件`}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.3)', color: 'white', fontWeight: 'bold' }}
              />
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#fbe9e7' }}>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>他決日</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>売主番号</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>物件住所</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>売主名</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>コメント</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>ステータス</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>競合名、理由</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>次電日</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap', minWidth: 200 }}>対策</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap' }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.sellers.map((seller) => (
                    <TableRow key={seller.id} hover>
                      <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {formatDate(seller.contractYearMonth)}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        <Tooltip title="売主詳細を開く">
                          <Button
                            size="small"
                            onClick={() => window.open(`/sellers/${seller.id}/call`, '_blank', 'noopener,noreferrer')}
                            sx={{ textTransform: 'none', p: 0, minWidth: 'auto', fontSize: '0.8rem', fontWeight: 'bold' }}
                            endIcon={<OpenInNewIcon sx={{ fontSize: '0.7rem !important' }} />}
                          >
                            {seller.sellerNumber}
                          </Button>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {seller.propertyAddress || '－'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {seller.name || '－'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Tooltip title={seller.comments || ''}>
                          <span>{seller.comments || '－'}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        <Chip
                          label={seller.status}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            bgcolor: seller.status === '他決→追客' ? '#ef5350' : '#b71c1c',
                            color: 'white',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Tooltip title={seller.competitorNameAndReason || ''}>
                          <span>{seller.competitorNameAndReason || '－'}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {formatDate(seller.nextCallDate)}
                      </TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        <TextField
                          size="small"
                          multiline
                          maxRows={3}
                          value={countermeasures[seller.id] || ''}
                          onChange={(e) => setCountermeasures(prev => ({ ...prev, [seller.id]: e.target.value }))}
                          placeholder="対策を入力..."
                          sx={{
                            width: '100%',
                            '& .MuiInputBase-input': { fontSize: '0.75rem' },
                            '& .MuiOutlinedInput-root': { bgcolor: 'white' },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleSave(seller.id)}
                          disabled={savingIds.has(seller.id)}
                        >
                          {savingIds.has(seller.id) ? (
                            <CircularProgress size={16} />
                          ) : (
                            <SaveIcon fontSize="small" />
                          )}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ))
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />
    </Box>
  );
}
