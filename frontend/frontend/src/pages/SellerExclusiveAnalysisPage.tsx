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
  TextField,
  Snackbar,
  Skeleton,
  LinearProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import QuizIcon from '@mui/icons-material/Quiz';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import api from '../services/api';

interface ExclusiveCase {
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
  exclusiveDecisionDate: string | null;
  visitAssignee: string | null;
  exclusiveOtherDecisionMeeting: string | null;
}

interface AiQuestion { id: string; question: string; }
interface QaAnswer { questionId: string; answer: string; }
interface QaRecord {
  id: string; seller_id: string; assignee: string; target_month: string;
  ai_questions: AiQuestion[]; answers: QaAnswer[]; is_published: boolean;
}

interface AnalysisData {
  seller: SellerInfo;
  assigneeStats: AssigneeStats | null;
  sameMonthCases: ExclusiveCase[];
  aiAnalysis: string;
}

export default function SellerExclusiveAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 段階的ロード：データ取得とAI分析を分離
  const [dataLoading, setDataLoading] = useState(true);   // テーブル・ヘッダー用
  const [aiLoading, setAiLoading] = useState(true);       // AI分析用（別途取得）
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');

  // QA関連state
  const [qa, setQa] = useState<QaRecord | null>(null);
  const [qaGenerating, setQaGenerating] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  useEffect(() => {
    if (!id) return;

    // ① まずAIなしで即座にデータ取得（案件テーブル・ヘッダーを先に表示）
    const fetchData = async () => {
      try {
        setDataLoading(true);
        const res = await api.get(`/api/sellers/${id}/exclusive-analysis?skipAi=true`);
        setData(res.data);
      } catch (err: any) {
        setError(err?.response?.data?.error?.message || 'データの取得に失敗しました');
      } finally {
        setDataLoading(false);
      }
    };

    // ② AI分析は並行して別途取得（時間がかかる処理）
    const fetchAi = async () => {
      try {
        setAiLoading(true);
        const res = await api.get(`/api/sellers/${id}/exclusive-analysis`);
        setAiAnalysis(res.data.aiAnalysis || '');
      } catch (err) {
        // AI分析失敗はサイレントに処理
      } finally {
        setAiLoading(false);
      }
    };

    // QA取得
    const fetchQa = async () => {
      try {
        const res = await api.get(`/api/sellers/${id}/exclusive-analysis/qa`);
        if (res.data.qa) {
          setQa(res.data.qa);
          const map: Record<string, string> = {};
          (res.data.qa.answers || []).forEach((a: QaAnswer) => { map[a.questionId] = a.answer; });
          setAnswers(map);
        }
      } catch (err) { /* 無視 */ }
    };

    fetchData();
    fetchAi();
    fetchQa();
  }, [id]);

  const handleGenerateQuestions = async () => {
    if (!data) return;
    try {
      setQaGenerating(true);
      const res = await api.post(`/api/sellers/${id}/exclusive-analysis/qa/generate`, {
        sameMonthCases: data.sameMonthCases,
        assigneeStats: data.assigneeStats,
      });
      setQa(res.data.qa);
      const map: Record<string, string> = {};
      (res.data.qa.answers || []).forEach((a: QaAnswer) => { map[a.questionId] = a.answer; });
      setAnswers(prev => ({ ...map, ...prev }));
      setSnackbar({ open: true, message: 'AI質問を生成しました' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.error || '質問の生成に失敗しました' });
    } finally {
      setQaGenerating(false);
    }
  };

  const handleSaveAnswers = async () => {
    if (!qa) return;
    try {
      setSaving(true);
      const answersArray = (qa.ai_questions || []).map(q => ({ questionId: q.id, answer: answers[q.id] || '' }));
      const res = await api.put(`/api/sellers/${id}/exclusive-analysis/qa/answer`, { answers: answersArray });
      setQa(res.data.qa);
      setSnackbar({ open: true, message: '回答を保存しました' });
    } catch {
      setSnackbar({ open: true, message: '保存に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '－';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  // エラー時
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

  const seller = data?.seller;
  const assigneeStats = data?.assigneeStats;
  const sameMonthCases = data?.sameMonthCases || [];

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* 全体プログレスバー：どちらかまだ読み込み中なら表示 */}
      {(dataLoading || aiLoading) && (
        <LinearProgress
          sx={{ mb: 1, borderRadius: 1, height: 3 }}
          color="warning"
        />
      )}

      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/sellers/${id}/call`)}
        sx={{ mb: 2 }}
        variant="outlined"
        size="small"
      >
        通話モードに戻る
      </Button>

      {/* ヘッダー：データ取得中はスケルトン表示 */}
      {dataLoading ? (
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#fff3e0', borderLeft: '4px solid #ff6d00' }}>
          <Skeleton variant="text" width={200} height={32} />
          <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
            <Skeleton variant="text" width={80} height={48} />
            <Skeleton variant="text" width={120} height={48} />
            <Box sx={{ ml: 'auto' }}>
              <Skeleton variant="text" width={60} height={56} />
            </Box>
          </Box>
        </Paper>
      ) : seller ? (
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#fff3e0', borderLeft: '4px solid #ff6d00' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <EmojiEventsIcon sx={{ color: '#ff6d00' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>専任媒介取得分析</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">営業担当</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff6d00' }}>{seller.visitAssignee}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">対象月</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{assigneeStats?.monthLabel}</Typography>
            </Box>
            <Box sx={{ ml: 'auto', textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">今月の専任取得</Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#e65100' }}>
                {assigneeStats?.monthCount ?? 0}<Typography component="span" variant="body2">件</Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary">通算 {assigneeStats?.totalCount ?? 0}件</Typography>
            </Box>
          </Box>
        </Paper>
      ) : null}

      {/* AI分析：取得中はスケルトン、完了後にフェードイン */}
      {aiLoading ? (
        <Card sx={{ mb: 3, bgcolor: '#f3e5f5', border: '1px solid #ce93d8' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AutoAwesomeIcon sx={{ color: '#9c27b0' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#6a1b9a' }}>
                AI分析を生成中...
              </Typography>
              <CircularProgress size={16} sx={{ ml: 1, color: '#9c27b0' }} />
            </Box>
            <Skeleton variant="text" width="95%" />
            <Skeleton variant="text" width="88%" />
            <Skeleton variant="text" width="92%" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="85%" />
          </CardContent>
        </Card>
      ) : aiAnalysis ? (
        <Card sx={{ mb: 3, bgcolor: '#f3e5f5', border: '1px solid #ce93d8', animation: 'fadeIn 0.5s ease-in', '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(-8px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#9c27b0' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#6a1b9a' }}>
                AI分析：{seller?.visitAssignee}の強みと専任取得の秘訣
              </Typography>
              <Chip label="他スタッフへ共有" size="small" sx={{ bgcolor: '#9c27b0', color: '#fff', ml: 1 }} />
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{aiAnalysis}</Typography>
          </CardContent>
        </Card>
      ) : null}

      {/* QAセクション */}
      {!dataLoading && seller && (
        <Card sx={{ mb: 3, bgcolor: '#e8f5e9', border: '1px solid #81c784' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <QuizIcon sx={{ color: '#2e7d32' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1b5e20' }}>
                {seller.visitAssignee}への質問（他スタッフ学習用）
              </Typography>
              <Chip label="担当者記入欄" size="small" sx={{ bgcolor: '#2e7d32', color: '#fff', ml: 1 }} />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              AIが専任取得の成功要因を深掘りする質問を自動生成します。{seller.visitAssignee}さんが回答を記入すると、他スタッフの学習コンテンツになります。
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {!qa?.ai_questions?.length ? (
              <Button
                variant="contained"
                startIcon={qaGenerating ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
                onClick={handleGenerateQuestions}
                disabled={qaGenerating || sameMonthCases.length === 0}
                sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
              >
                {qaGenerating ? 'AIが質問を生成中...' : 'AIが質問を生成する'}
              </Button>
            ) : (
              <Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {qa.ai_questions.map((q, idx) => (
                    <Box key={q.id}>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Chip label={`Q${idx + 1}`} size="small" sx={{ bgcolor: '#43a047', color: '#fff', fontWeight: 'bold', minWidth: 36 }} />
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1b5e20', lineHeight: 1.5 }}>{q.question}</Typography>
                      </Box>
                      <TextField
                        fullWidth multiline minRows={2} maxRows={6} size="small"
                        placeholder={`${seller.visitAssignee}さんの回答を入力...`}
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', '&:hover fieldset': { borderColor: '#43a047' }, '&.Mui-focused fieldset': { borderColor: '#2e7d32' } } }}
                      />
                    </Box>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                  <Button variant="contained" startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} onClick={handleSaveAnswers} disabled={saving} sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}>
                    {saving ? '保存中...' : '回答を保存'}
                  </Button>
                  <Button variant="outlined" size="small" startIcon={qaGenerating ? <CircularProgress size={14} /> : <RefreshIcon />} onClick={handleGenerateQuestions} disabled={qaGenerating} sx={{ borderColor: '#2e7d32', color: '#2e7d32' }}>
                    質問を再生成
                  </Button>
                  {qa.answers?.some((a: QaAnswer) => a.answer) && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => navigate(`/sellers/${id}/exclusive-analysis/summary`)}
                      sx={{ bgcolor: '#9c27b0', '&:hover': { bgcolor: '#6a1b9a' }, ml: 'auto' }}
                    >
                      ✨ 要約ページを見る
                    </Button>
                  )}
                </Box>
                {qa.answers?.some((a: QaAnswer) => a.answer) && (
                  <Alert severity="success" sx={{ mt: 2 }} icon={false}>
                    <Typography variant="caption">回答保存済み</Typography>
                  </Alert>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* 案件テーブル */}
      {dataLoading ? (
        <Box>
          <Skeleton variant="text" width={300} height={28} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" height={200} />
        </Box>
      ) : sameMonthCases.length === 0 ? (
        <Alert severity="info">{assigneeStats?.monthLabel}に{seller?.visitAssignee}が取得した専任媒介案件が見つかりません。</Alert>
      ) : (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            📋 {assigneeStats?.monthLabel}　{seller?.visitAssignee}の専任取得案件一覧（{sameMonthCases.length}件）
          </Typography>
          <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#ff6d00' }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 80 }}>売主番号</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>物件住所</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 100 }}>決定日</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 160 }}>ステータス／競合／専任取得要因</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>競合名・理由詳細</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sameMonthCases.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    sx={{ bgcolor: row.isCurrentSeller ? '#fff9c4' : idx % 2 === 0 ? '#fff' : '#fafafa', '&:hover': { bgcolor: '#fff3e0' }, cursor: 'pointer' }}
                    onClick={() => navigate(`/sellers/${row.id}/call`)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: row.isCurrentSeller ? 'bold' : 'normal', fontSize: '0.8rem' }}>{row.sellerNumber}</Typography>
                        {row.isCurrentSeller && <Chip label="この案件" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#ff6d00', color: '#fff' }} />}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', maxWidth: 200 }}>{row.propertyAddress || '未登録'}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatDate(row.decisionDate)}</TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {/* ステータス */}
                      <Chip
                        label={row.status}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: row.status === '専任媒介' ? '#e8f5e9' :
                                   row.status === '他決→専任' ? '#fff3e0' :
                                   row.status === 'リースバック（専任）' ? '#e3f2fd' : '#f5f5f5',
                          color: row.status === '専任媒介' ? '#2e7d32' :
                                 row.status === '他決→専任' ? '#e65100' :
                                 row.status === 'リースバック（専任）' ? '#1565c0' : '#333',
                          fontWeight: 'bold',
                        }}
                      />
                      {/* 競合 */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {row.competitors.length > 0
                          ? row.competitors.map(c => <Chip key={c} label={c} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#e3f2fd' }} />)
                          : <Typography variant="caption" color="text.secondary">競合：－</Typography>}
                      </Box>
                      {/* 専任取得要因 */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {row.factors.length > 0
                          ? row.factors.map(f => <Chip key={f} label={f} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f3e5f5' }} />)
                          : <Typography variant="caption" color="text.secondary">要因：－</Typography>}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', verticalAlign: 'top' }}>
                      {row.reason || <Typography variant="caption" color="text.secondary">－</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            ※ 行をクリックすると各売主の通話モードページに移動します。
          </Typography>
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
