import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, CheckCircle as CheckCircleIcon, RadioButtonUnchecked as RadioButtonUncheckedIcon } from '@mui/icons-material';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';

interface AgendaItem {
  id: string;
  title: string;
  content: string | null;
  assignee: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export default function SalesMeetingAgendaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const color = SECTION_COLORS.sharedItems;

  const [item, setItem] = useState<AgendaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [initialTitle, setInitialTitle] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [initialAssignee, setInitialAssignee] = useState('');
  const [initialDueDate, setInitialDueDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    fetchItem();
  }, [id]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/sales-meeting-agenda/${id}`);
      const data = response.data.data;
      setItem(data);
      setTitle(data.title || '');
      setContent(data.content || '');
      setAssignee(data.assignee || '');
      setDueDate(data.due_date || '');
      setInitialTitle(data.title || '');
      setInitialContent(data.content || '');
      setInitialAssignee(data.assignee || '');
      setInitialDueDate(data.due_date || '');
    } catch (error) {
      console.error('Failed to fetch agenda item:', error);
      setApiError('議題の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges =
    title !== initialTitle ||
    content !== initialContent ||
    assignee !== initialAssignee ||
    dueDate !== initialDueDate;

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    setApiError('');
    setSaveSuccess(false);
    try {
      await api.put(`/api/sales-meeting-agenda/${item.id}`, {
        title,
        content,
        assignee,
        due_date: dueDate || null,
      });
      setInitialTitle(title);
      setInitialContent(content);
      setInitialAssignee(assignee);
      setInitialDueDate(dueDate);
      setSaveSuccess(true);
    } catch (error: any) {
      setApiError(error.response?.data?.error || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async () => {
    if (!item) return;
    setCompleting(true);
    setApiError('');
    try {
      const response = await api.post(`/api/sales-meeting-agenda/${item.id}/complete`, {
        completed: !item.completed,
      });
      setItem(response.data.data);
    } catch (error: any) {
      setApiError(error.response?.data?.error || '完了状態の更新に失敗しました');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography>読み込み中...</Typography>
      </Container>
    );
  }

  if (!item) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography>議題が見つかりませんでした</Typography>
        <Button onClick={() => navigate('/shared-items/sales-meeting-agenda')} sx={{ mt: 2 }}>戻る</Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/shared-items/sales-meeting-agenda')} sx={{ color: color.main }}>
            議題一覧に戻る
          </Button>
          <Typography variant="h5" fontWeight="bold" sx={{ color: color.main }}>
            議題詳細
          </Typography>
          {item.completed && <Chip label="完了" color="success" size="small" />}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={item.completed ? 'outlined' : 'contained'}
            color={item.completed ? 'inherit' : 'success'}
            onClick={handleToggleComplete}
            disabled={completing}
            startIcon={completing ? <CircularProgress size={16} color="inherit" /> : (item.completed ? <RadioButtonUncheckedIcon /> : <CheckCircleIcon />)}
          >
            {completing ? '更新中...' : item.completed ? '未完了に戻す' : '完了'}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark } }}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </Box>
      </Box>

      {apiError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApiError('')}>{apiError}</Alert>
      )}
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess(false)}>保存しました</Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">タイトル</Typography>
            <TextField
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ mt: 1, '& .MuiInputBase-input': { fontWeight: 'bold', color: color.main } }}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">内容</Typography>
            <TextField
              fullWidth
              multiline
              minRows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              sx={{ mt: 1 }}
            />
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">誰が</Typography>
            <TextField
              fullWidth
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              sx={{ mt: 1 }}
            />
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">いつまで</Typography>
            <TextField
              fullWidth
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mt: 1 }}
            />
          </Grid>
          {item.completed_at && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                完了日時: {new Date(item.completed_at).toLocaleString('ja-JP')}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>
    </Container>
  );
}
