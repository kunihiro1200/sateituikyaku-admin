import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  List,
  ListItemButton,
  ListItemText,
  Divider,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Add as AddIcon } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
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

export default function SalesMeetingAgendaPage() {
  const navigate = useNavigate();
  const color = SECTION_COLORS.sharedItems;
  const employee = useAuthStore((state) => state.employee);

  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  // 新規作成フォーム
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/sales-meeting-agenda');
      setItems(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch agenda items:', error);
      setApiError('議題の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setApiError('タイトルを入力してください');
      return;
    }
    setSaving(true);
    setApiError('');
    try {
      await api.post('/api/sales-meeting-agenda', {
        title,
        content,
        assignee,
        due_date: dueDate || null,
        created_by: employee?.name || '',
      });
      setTitle('');
      setContent('');
      setAssignee('');
      setDueDate('');
      setShowForm(false);
      fetchItems();
    } catch (error: any) {
      setApiError(error.response?.data?.error || '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const activeItems = items.filter((i) => !i.completed);
  const completedItems = items.filter((i) => i.completed);

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/shared-items')} sx={{ color: color.main }}>
            戻る
          </Button>
          <Typography variant="h5" fontWeight="bold" sx={{ color: color.main }}>
            議題
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowForm((prev) => !prev)}
          sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark } }}
        >
          新規作成
        </Button>
      </Box>

      {apiError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApiError('')}>{apiError}</Alert>
      )}

      {showForm && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>新規議題</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">タイトル * （例：2026年7月決定事項）</Typography>
              <TextField
                fullWidth
                size="small"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                sx={{ mt: 0.5 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">内容</Typography>
              <TextField
                fullWidth
                multiline
                minRows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                sx={{ mt: 0.5 }}
              />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">誰が</Typography>
              <TextField
                fullWidth
                size="small"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                sx={{ mt: 0.5 }}
              />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">いつまで</Typography>
              <TextField
                fullWidth
                type="date"
                size="small"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mt: 0.5 }}
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setShowForm(false)} disabled={saving}>キャンセル</Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={saving}
              sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark } }}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {saving ? '作成中...' : '作成'}
            </Button>
          </Box>
        </Paper>
      )}

      {loading ? (
        <Typography>読み込み中...</Typography>
      ) : (
        <>
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
              <Typography variant="subtitle1" fontWeight="bold">未完了（{activeItems.length}）</Typography>
            </Box>
            <List disablePadding>
              {activeItems.length === 0 ? (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">未完了の議題はありません</Typography>
                </Box>
              ) : (
                activeItems.map((item, idx) => (
                  <Box key={item.id}>
                    {idx > 0 && <Divider />}
                    <ListItemButton onClick={() => navigate(`/shared-items/sales-meeting-agenda/${item.id}`)}>
                      <ListItemText
                        primary={item.title}
                        secondary={
                          <>
                            {item.assignee && `担当: ${item.assignee}　`}
                            {item.due_date && `期限: ${item.due_date}`}
                          </>
                        }
                      />
                    </ListItemButton>
                  </Box>
                ))
              )}
            </List>
          </Paper>

          <Paper>
            <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
              <Typography variant="subtitle1" fontWeight="bold">完了（{completedItems.length}）</Typography>
            </Box>
            <List disablePadding>
              {completedItems.length === 0 ? (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">完了した議題はありません</Typography>
                </Box>
              ) : (
                completedItems.map((item, idx) => (
                  <Box key={item.id}>
                    {idx > 0 && <Divider />}
                    <ListItemButton onClick={() => navigate(`/shared-items/sales-meeting-agenda/${item.id}`)}>
                      <ListItemText
                        primary={item.title}
                        secondary={
                          <>
                            {item.assignee && `担当: ${item.assignee}　`}
                            {item.due_date && `期限: ${item.due_date}`}
                          </>
                        }
                      />
                      <Chip label="完了" size="small" color="success" />
                    </ListItemButton>
                  </Box>
                ))
              )}
            </List>
          </Paper>
        </>
      )}
    </Container>
  );
}
