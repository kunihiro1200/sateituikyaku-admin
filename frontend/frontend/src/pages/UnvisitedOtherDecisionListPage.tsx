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
  Snackbar, IconButton, Divider,
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

  // コメントからHTMLタグ除去し「【以下自動転記」の前まで表示
  const truncateComment = (html: string) => {
    if (!html) return '';
    const plain = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').trim();
    const cutIdx = plain.indexOf('【以下自動転記');
    if (cutIdx > 0) return plain.substring(0, cutIdx).trim();
    return plain;
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
        </Typography>
      </Paper>

      {displayData.length === 0 ? (
        <Alert severity="info">該当するデータがありません</Alert>
      ) : (
        displayData.map((group) => (
          <Box key={group.yearMonth} sx={{ mb: 4 }}>
            <Box sx={{ bgcolor: '#ff5722', color: 'white', px: 2, py: 1, borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                【未訪問他決】{group.label}
              </Typography>
              <Chip label={`${group.count}件`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.3)', color: 'white', fontWeight: 'bold' }} />
            </Box>

            <Paper sx={{ borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
              {group.sellers.map((seller, idx) => {
                const ai = aiResults[seller.sellerNumber];
                const isAiLoading = aiLoadingIds.has(seller.sellerNumber);
                const logs = followUpLogs[seller.sellerNumber] || [];
                const isLogsLoading = logsLoadingIds.has(seller.sellerNumber);
                const commentText = truncateComment(seller.comments);

                return (
                  <Box key={seller.id}>
                    {idx > 0 && <Divider sx={{ borderColor: '#ffccbc' }} />}
                    <Box sx={{ p: 1.5, '&:hover': { bgcolor: '#fafafa' } }}>
                      {/* ヘッダー行 */}
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
                          <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{seller.name}</Typography>
                        )}
                        <Chip label={seller.status} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: seller.status === '他決→追客' ? '#ef5350' : '#b71c1c', color: 'white' }} />
                        <Typography variant="caption" sx={{ color: '#666', ml: 'auto' }}>反響日: {formatDate(seller.inquiryDate)}</Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>他決日: {formatDate(seller.contractYearMonth)}</Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>次電日: {formatDate(seller.nextCallDate)}</Typography>
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

                      {/* コメント（【以下自動転記】の前まで） */}
                      {commentText && (
                        <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#555', mb: 0.5, pl: 0.5, whiteSpace: 'pre-wrap' }}>
                          💬 {commentText}
                        </Typography>
                      )}

                      {/* 売主追客ログ */}
                      {isLogsLoading ? (
                        <Box sx={{ pl: 0.5, mb: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#9e9e9e' }}>追客ログ読込中...</Typography>
                        </Box>
                      ) : logs.length > 0 && (
                        <Box sx={{ mt: 0.5, pl: 0.5, mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#1565c0', display: 'block', mb: 0.3 }}>
                            📞 追客ログ（{logs.length}件）
                          </Typography>
                          <Box sx={{ pl: 1, borderLeft: '2px solid #bbdefb', maxHeight: 200, overflow: 'auto' }}>
                            {logs.map((log, i) => (
                              <Box key={i} sx={{ mb: 0.3 }}>
                                <Typography variant="caption" sx={{ color: '#333', fontSize: '0.72rem' }}>
                                  <strong>{formatDate(log.date)}</strong>
                                  {(log.assigneeFirstHalf || log.assigneeSecondHalf) && (
                                    <span style={{ color: '#1565c0' }}> [{log.assigneeFirstHalf}{log.assigneeSecondHalf && `/${log.assigneeSecondHalf}`}]</span>
                                  )}
                                  {log.comment && ` ${log.comment}`}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* AI分析ボタン & 結果 */}
                      <Box sx={{ mt: 1, pl: 0.5 }}>
                        {!ai && !isAiLoading && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AutoAwesomeIcon sx={{ fontSize: '0.9rem !important' }} />}
                            onClick={() => fetchAiForSeller(seller)}
                            sx={{ fontSize: '0.75rem', color: '#7b1fa2', borderColor: '#ce93d8', py: 0.3 }}
                          >
                            AI分析
                          </Button>
                        )}
                        {isAiLoading && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={14} sx={{ color: '#7b1fa2' }} />
                            <Typography variant="caption" sx={{ color: '#7b1fa2' }}>分析中...</Typography>
                          </Box>
                        )}
                        {ai && (
                          <Box sx={{ p: 1, bgcolor: '#f3e5f5', borderRadius: 1, border: '1px solid #e1bee7' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                              <AutoAwesomeIcon sx={{ fontSize: '0.85rem', color: '#7b1fa2' }} />
                              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#4a148c' }}>AI分析</Typography>
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
                      </Box>

                      {/* 対策メモ */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1, pl: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#bf360c', fontWeight: 'bold', mt: 0.8, whiteSpace: 'nowrap' }}>対策メモ:</Typography>
                        <TextField
                          size="small"
                          multiline
                          maxRows={4}
                          value={countermeasures[seller.id] || ''}
                          onChange={(e) => setCountermeasures(prev => ({ ...prev, [seller.id]: e.target.value }))}
                          placeholder="対策を入力..."
                          sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 }, '& .MuiOutlinedInput-root': { bgcolor: '#fff8e1' } }}
                        />
                        <IconButton size="small" color="primary" onClick={() => handleSave(seller.id)} disabled={savingIds.has(seller.id)} sx={{ mt: 0.3 }}>
                          {savingIds.has(seller.id) ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
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

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />
    </Box>
  );
}
