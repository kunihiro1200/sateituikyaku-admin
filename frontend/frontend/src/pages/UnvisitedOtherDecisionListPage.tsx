/**
 * UnvisitedOtherDecisionListPage - 未訪問他決 月別一覧ページ
 * 
 * 営業担当が空欄（外す含む）でステータスが他決→追客 or 他決→追客不要の売主を月別に表示
 * 売主ごとにAI敗因分析＆対策提案を表示
 * 対策欄が編集可能でDB保存できる
 */
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, CircularProgress, Alert, Button, TextField,
  Snackbar, IconButton, Divider, LinearProgress,
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
}

interface MonthlyGroup {
  yearMonth: string;
  label: string;
  count: number;
  sellers: UnvisitedSeller[];
}

interface AiResult {
  sellerNumber: string;
  summary: string;
  whyLost: string;
  countermeasure: string;
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
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/sellers/unvisited-other-decision-monthly-summary');
        const summary: MonthlyGroup[] = res.data?.summary || [];
        setMonthlyData(summary);

        const cm: Record<string, string> = {};
        for (const group of summary) {
          for (const seller of group.sellers) {
            cm[seller.id] = seller.otherDecisionCountermeasure || '';
          }
        }
        setCountermeasures(cm);

        // 表示対象の月のAI分析を自動実行
        const targetGroups = targetMonth ? summary.filter(g => g.yearMonth === targetMonth) : summary;
        const allSellers = targetGroups.flatMap(g => g.sellers);
        if (allSellers.length > 0) {
          fetchAiAnalysis(allSellers);
        }
      } catch (err: any) {
        setError(err?.response?.data?.error || 'データ取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const fetchAiAnalysis = async (sellers: UnvisitedSeller[]) => {
    setAiLoading(true);
    try {
      const res = await api.post('/api/sellers/unvisited-other-decision-ai-analysis', { sellers });
      const analyses: AiResult[] = res.data?.analyses || [];
      const map: Record<string, AiResult> = {};
      for (const a of analyses) {
        map[a.sellerNumber] = a;
      }
      setAiResults(map);
    } catch {
      // エラーは無視（UIにはAI欄が空で表示されるだけ）
    } finally {
      setAiLoading(false);
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

  const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
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
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: { xs: 1, sm: 2, md: 3 } }}>
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
          各案件ごとにAIが敗因と対策を分析します。
        </Typography>
      </Paper>

      {aiLoading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress color="secondary" sx={{ borderRadius: 1, height: 3 }} />
          <Typography variant="caption" sx={{ color: '#7b1fa2', mt: 0.5, display: 'block' }}>
            AI分析中...
          </Typography>
        </Box>
      )}

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
              <Chip
                label={`${group.count}件`}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.3)', color: 'white', fontWeight: 'bold' }}
              />
            </Box>

            {/* 案件一覧 */}
            <Paper sx={{ borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
              {group.sellers.map((seller, idx) => {
                const ai = aiResults[seller.sellerNumber];
                return (
                  <Box key={seller.id}>
                    {idx > 0 && <Divider sx={{ borderColor: '#ffccbc' }} />}
                    <Box sx={{ p: 1.5, '&:hover': { bgcolor: '#fafafa' } }}>
                      {/* 1行目: 売主番号 / 売主名 / ステータス / 日付 */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          onClick={() => window.open(`/sellers/${seller.id}/call`, '_blank', 'noopener,noreferrer')}
                          sx={{ textTransform: 'none', p: '0 4px', minWidth: 'auto', fontSize: '0.85rem', fontWeight: 'bold', color: '#1565c0' }}
                          endIcon={<OpenInNewIcon sx={{ fontSize: '0.7rem !important' }} />}
                        >
                          {seller.sellerNumber}
                        </Button>
                        {seller.name && (
                          <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                            {seller.name}
                          </Typography>
                        )}
                        <Chip
                          label={seller.status}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor: seller.status === '他決→追客' ? '#ef5350' : '#b71c1c',
                            color: 'white',
                          }}
                        />
                        <Typography variant="caption" sx={{ color: '#666', ml: 'auto' }}>
                          他決日: {formatDate(seller.contractYearMonth)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>
                          次電日: {formatDate(seller.nextCallDate)}
                        </Typography>
                      </Box>

                      {/* 物件住所 */}
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#333', mb: 0.5, pl: 0.5 }}>
                        📍 {seller.propertyAddress || '住所なし'}
                      </Typography>

                      {/* 競合名、理由 */}
                      {seller.competitorNameAndReason && (
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#c62828', mb: 0.5, pl: 0.5 }}>
                          🏢 {seller.competitorNameAndReason}
                        </Typography>
                      )}

                      {/* コメント */}
                      {seller.comments && (
                        <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#555', mb: 0.5, pl: 0.5, whiteSpace: 'pre-wrap' }}>
                          💬 {stripHtml(seller.comments)}
                        </Typography>
                      )}

                      {/* AI分析（売主番号ごと） */}
                      {ai && (
                        <Box sx={{ mt: 1, p: 1, bgcolor: '#f3e5f5', borderRadius: 1, border: '1px solid #e1bee7' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <AutoAwesomeIcon sx={{ fontSize: '0.9rem', color: '#7b1fa2' }} />
                            <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#4a148c' }}>
                              AI分析
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#333', mb: 0.3 }}>
                            <strong>要約:</strong> {ai.summary}
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#c62828', mb: 0.3 }}>
                            <strong>敗因:</strong> {ai.whyLost}
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#1b5e20' }}>
                            <strong>対策:</strong> {ai.countermeasure}
                          </Typography>
                        </Box>
                      )}
                      {aiLoading && !ai && (
                        <Box sx={{ mt: 1, p: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#9e9e9e' }}>AI分析中...</Typography>
                        </Box>
                      )}

                      {/* 対策欄（手動入力） */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1, pl: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#bf360c', fontWeight: 'bold', mt: 0.8, whiteSpace: 'nowrap' }}>
                          対策メモ:
                        </Typography>
                        <TextField
                          size="small"
                          multiline
                          maxRows={4}
                          value={countermeasures[seller.id] || ''}
                          onChange={(e) => setCountermeasures(prev => ({ ...prev, [seller.id]: e.target.value }))}
                          placeholder="対策を入力..."
                          sx={{
                            flex: 1,
                            '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 },
                            '& .MuiOutlinedInput-root': { bgcolor: '#fff8e1' },
                          }}
                        />
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleSave(seller.id)}
                          disabled={savingIds.has(seller.id)}
                          sx={{ mt: 0.3 }}
                        >
                          {savingIds.has(seller.id) ? (
                            <CircularProgress size={16} />
                          ) : (
                            <SaveIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Paper>
          </Box>
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
