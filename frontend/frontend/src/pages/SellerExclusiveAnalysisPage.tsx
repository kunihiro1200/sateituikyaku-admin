import { useEffect, useState, useCallback } from 'react';
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
  FormControlLabel,
  Switch,
  Snackbar,
  IconButton,
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

interface AiQuestion {
  id: string;
  question: string;
}

interface QaAnswer {
  questionId: string;
  answer: string;
}

interface QaRecord {
  id: string;
  seller_id: string;
  assignee: string;
  target_month: string;
  ai_questions: AiQuestion[];
  answers: QaAnswer[];
  is_published: boolean;
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisData | null>(null);

  // QA関連state
  const [qa, setQa] = useState<QaRecord | null>(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaGenerating, setQaGenerating] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  useEffect(() => {
    if (!id) return;
    fetchAnalysis();
    fetchQa();
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

  const fetchQa = async () => {
    try {
      setQaLoading(true);
      const response = await api.get(`/api/sellers/${id}/exclusive-analysis/qa`);
      if (response.data.qa) {
        setQa(response.data.qa);
        // 回答をstateに反映
        const answerMap: Record<string, string> = {};
        (response.data.qa.answers || []).forEach((a: QaAnswer) => {
          answerMap[a.questionId] = a.answer;
        });
        setAnswers(answerMap);
        setIsPublished(response.data.qa.is_published);
      }
    } catch (err) {
      // QAがなければ空のまま
    } finally {
      setQaLoading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!data) return;
    try {
      setQaGenerating(true);
      const response = await api.post(`/api/sellers/${id}/exclusive-analysis/qa/generate`, {
        sameMonthCases: data.sameMonthCases,
        assigneeStats: data.assigneeStats,
      });
      setQa(response.data.qa);
      // 既存回答を保持
      const answerMap: Record<string, string> = {};
      (response.data.qa.answers || []).forEach((a: QaAnswer) => {
        answerMap[a.questionId] = a.answer;
      });
      setAnswers(prev => ({ ...answerMap, ...prev }));
      setSnackbar({ open: true, message: 'AI質問を生成しました', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.error || '質問の生成に失敗しました', severity: 'error' });
    } finally {
      setQaGenerating(false);
    }
  };

  const handleSaveAnswers = async () => {
    if (!qa) return;
    try {
      setSaving(true);
      const answersArray: QaAnswer[] = (qa.ai_questions || []).map(q => ({
        questionId: q.id,
        answer: answers[q.id] || '',
      }));
      const response = await api.put(`/api/sellers/${id}/exclusive-analysis/qa/answer`, {
        answers: answersArray,
        isPublished,
      });
      setQa(response.data.qa);
      setSnackbar({ open: true, message: '回答を保存しました', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
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

  if (!seller.exclusiveDecisionDate || !seller.visitAssignee) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/sellers/${id}/call`)} sx={{ mb: 2 }} variant="outlined" size="small">
          通話モードに戻る
        </Button>
        <Alert severity="info">
          専任（他決）決定日または営業担当（営担）が登録されていないため、分析を表示できません。
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: { xs: 2, sm: 3 } }}>
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

      {/* AIによる強み分析 */}
      {aiAnalysis && (
        <Card sx={{ mb: 3, bgcolor: '#f3e5f5', border: '1px solid #ce93d8' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#9c27b0' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#6a1b9a' }}>
                AI分析：{seller.visitAssignee}の強みと専任取得の秘訣
              </Typography>
              <Chip label="他スタッフへ共有" size="small" sx={{ bgcolor: '#9c27b0', color: '#fff', ml: 1 }} />
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{aiAnalysis}</Typography>
          </CardContent>
        </Card>
      )}

      {/* ===== AIインタビューQAセクション ===== */}
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

          {/* 質問生成ボタン */}
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
              {/* 質問と回答フィールド */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {qa.ai_questions.map((q, idx) => (
                  <Box key={q.id}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <Chip
                        label={`Q${idx + 1}`}
                        size="small"
                        sx={{ bgcolor: '#43a047', color: '#fff', fontWeight: 'bold', minWidth: 36 }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1b5e20', lineHeight: 1.5 }}>
                        {q.question}
                      </Typography>
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={6}
                      size="small"
                      placeholder={`${seller.visitAssignee}さんの回答を入力...`}
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#fff',
                          '&:hover fieldset': { borderColor: '#43a047' },
                          '&.Mui-focused fieldset': { borderColor: '#2e7d32' },
                        },
                      }}
                    />
                  </Box>
                ))}
              </Box>

              {/* 公開スイッチと保存ボタン */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      color="success"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      他スタッフに公開する
                      {isPublished && <Chip label="公開中" size="small" sx={{ ml: 1, bgcolor: '#2e7d32', color: '#fff', height: 18, fontSize: '0.65rem' }} />}
                    </Typography>
                  }
                />
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                  onClick={handleSaveAnswers}
                  disabled={saving}
                  sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
                >
                  {saving ? '保存中...' : '回答を保存'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={qaGenerating ? <CircularProgress size={14} /> : <RefreshIcon />}
                  onClick={handleGenerateQuestions}
                  disabled={qaGenerating}
                  sx={{ borderColor: '#2e7d32', color: '#2e7d32' }}
                >
                  質問を再生成
                </Button>
              </Box>

              {/* 保存済み表示 */}
              {qa.answers?.some((a: QaAnswer) => a.answer) && (
                <Alert severity="success" sx={{ mt: 2 }} icon={false}>
                  <Typography variant="caption">
                    最終保存済み · {qa.is_published ? '他スタッフに公開中' : '非公開（自分のみ）'}
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 同月取得案件テーブル */}
      {sameMonthCases.length === 0 ? (
        <Alert severity="info">
          {assigneeStats?.monthLabel}に{seller.visitAssignee}が取得した専任媒介案件が見つかりません。
        </Alert>
      ) : (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            📋 {assigneeStats?.monthLabel}　{seller.visitAssignee}の専任取得案件一覧（{sameMonthCases.length}件）
          </Typography>
          <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#ff6d00' }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 80 }}>売主番号</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>物件住所</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 100 }}>決定日</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>競合</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>専任取得要因</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>競合名・理由詳細</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sameMonthCases.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    sx={{
                      bgcolor: row.isCurrentSeller ? '#fff9c4' : idx % 2 === 0 ? '#fff' : '#fafafa',
                      '&:hover': { bgcolor: '#fff3e0' },
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
                          <Chip label="この案件" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#ff6d00', color: '#fff' }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', maxWidth: 200 }}>{row.propertyAddress || '未登録'}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatDate(row.decisionDate)}</TableCell>
                    <TableCell>
                      {row.competitors.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {row.competitors.map((c) => (
                            <Chip key={c} label={c} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#e3f2fd' }} />
                          ))}
                        </Box>
                      ) : <Typography variant="caption" color="text.secondary">－</Typography>}
                    </TableCell>
                    <TableCell>
                      {row.factors.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {row.factors.map((f) => (
                            <Chip key={f} label={f} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f3e5f5' }} />
                          ))}
                        </Box>
                      ) : <Typography variant="caption" color="text.secondary">－</Typography>}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', maxWidth: 220 }}>
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

      {/* スナックバー */}
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
