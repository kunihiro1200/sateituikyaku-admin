import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  IconButton,
  Divider,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { SECTION_COLORS } from '../theme/sectionColors';

interface Todo {
  id: string;
  year_month: string;
  content: string;
  assignee: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

// 月選択肢を生成（過去12ヵ月〜未来3ヵ月の範囲＋DBにある月）
function generateMonthOptions(existingMonths: string[]): { value: string; label: string }[] {
  const now = new Date();
  const monthsSet = new Set<string>(existingMonths);
  for (let offset = -12; offset <= 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return Array.from(monthsSet)
    .sort((a, b) => b.localeCompare(a))
    .map((ym) => {
      const [y, m] = ym.split('-');
      return { value: ym, label: `${y}年${parseInt(m)}月` };
    });
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function SalesMeetingAgendaPage() {
  const navigate = useNavigate();
  const color = SECTION_COLORS.sharedItems;
  const employee = useAuthStore((state) => state.employee);

  const [existingMonths, setExistingMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth());
  const [agendaText, setAgendaText] = useState('');
  const [initialAgendaText, setInitialAgendaText] = useState('');
  const [todos, setTodos] = useState<Todo[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 新規TODO入力
  const [newTodoContent, setNewTodoContent] = useState('');
  const [newTodoAssignee, setNewTodoAssignee] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);

  useEffect(() => {
    fetchMonths();
  }, []);

  useEffect(() => {
    fetchMonthData(selectedMonth);
  }, [selectedMonth]);

  const fetchMonths = async () => {
    try {
      const response = await api.get('/api/sales-meeting-agenda/months');
      setExistingMonths(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch months:', error);
    }
  };

  const fetchMonthData = useCallback(async (ym: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/sales-meeting-agenda/${ym}`);
      const data = response.data.data;
      setAgendaText(data.agenda_text || '');
      setInitialAgendaText(data.agenda_text || '');
      setTodos(data.todos || []);
    } catch (error) {
      console.error('Failed to fetch month data:', error);
      setApiError('議題の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveAgenda = async () => {
    setSaving(true);
    setApiError('');
    setSaveSuccess(false);
    try {
      await api.put(`/api/sales-meeting-agenda/${selectedMonth}`, { agenda_text: agendaText });
      setInitialAgendaText(agendaText);
      setSaveSuccess(true);
      fetchMonths();
    } catch (error: any) {
      setApiError(error.response?.data?.error || '議題の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTodo = async () => {
    if (!newTodoContent.trim()) return;
    setAddingTodo(true);
    setApiError('');
    try {
      const response = await api.post(`/api/sales-meeting-agenda/${selectedMonth}/todos`, {
        content: newTodoContent,
        assignee: newTodoAssignee,
        due_date: newTodoDueDate || null,
        created_by: employee?.name || '',
      });
      setTodos((prev) => [...prev, response.data.data]);
      setNewTodoContent('');
      setNewTodoAssignee('');
      setNewTodoDueDate('');
      fetchMonths();
    } catch (error: any) {
      setApiError(error.response?.data?.error || 'TODOの追加に失敗しました');
    } finally {
      setAddingTodo(false);
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    try {
      const response = await api.post(`/api/sales-meeting-agenda/todos/${todo.id}/complete`, {
        completed: !todo.completed,
      });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? response.data.data : t)));
    } catch (error: any) {
      setApiError(error.response?.data?.error || '完了状態の更新に失敗しました');
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await api.delete(`/api/sales-meeting-agenda/todos/${id}`);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (error: any) {
      setApiError(error.response?.data?.error || 'TODOの削除に失敗しました');
    }
  };

  const monthOptions = generateMonthOptions(existingMonths);
  const hasAgendaChanges = agendaText !== initialAgendaText;
  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

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
      </Box>

      {apiError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApiError('')}>{apiError}</Alert>
      )}
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess(false)}>保存しました</Alert>
      )}

      {/* 月選択プルダウン */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">対象月</Typography>
        <TextField
          select
          fullWidth
          size="small"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          sx={{ mt: 0.5 }}
        >
          {monthOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
      </Paper>

      {loading ? (
        <Typography>読み込み中...</Typography>
      ) : (
        <>
          {/* 議題本文 */}
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, color: color.main }}>
              {monthOptions.find((o) => o.value === selectedMonth)?.label || selectedMonth} 議題
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={6}
              value={agendaText}
              onChange={(e) => setAgendaText(e.target.value)}
              placeholder="決定事項・議題を入力してください"
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: `${color.light}10` } }}
            />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleSaveAgenda}
                disabled={saving || !hasAgendaChanges}
                sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark } }}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {saving ? '保存中...' : '議題を保存'}
              </Button>
            </Box>
          </Paper>

          {/* TODOリスト */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>TODO</Typography>

            {/* 新規TODO入力 */}
            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="TODOを入力"
                  value={newTodoContent}
                  onChange={(e) => setNewTodoContent(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(); }}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="誰が"
                  value={newTodoAssignee}
                  onChange={(e) => setNewTodoAssignee(e.target.value)}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={newTodoDueDate}
                  onChange={(e) => setNewTodoDueDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={1}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleAddTodo}
                  disabled={addingTodo || !newTodoContent.trim()}
                  sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark }, height: '100%' }}
                >
                  <AddIcon />
                </Button>
              </Grid>
            </Grid>

            <Divider sx={{ mb: 1 }} />

            {/* 未完了TODO */}
            <List disablePadding>
              {activeTodos.length === 0 && completedTodos.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  TODOはありません
                </Typography>
              ) : (
                activeTodos.map((todo) => (
                  <ListItem
                    key={todo.id}
                    secondaryAction={
                      <IconButton edge="end" size="small" onClick={() => handleDeleteTodo(todo.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox
                        edge="start"
                        checked={false}
                        onChange={() => handleToggleTodo(todo)}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={todo.content}
                      secondary={
                        <>
                          {todo.assignee && `担当: ${todo.assignee}　`}
                          {todo.due_date && `期限: ${todo.due_date}`}
                        </>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>

            {/* 完了済みTODO */}
            {completedTodos.length > 0 && (
              <>
                <Box sx={{ mt: 2, mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    完了済み（{completedTodos.length}）
                  </Typography>
                </Box>
                <List disablePadding>
                  {completedTodos.map((todo) => (
                    <ListItem
                      key={todo.id}
                      secondaryAction={
                        <IconButton edge="end" size="small" onClick={() => handleDeleteTodo(todo.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          edge="start"
                          checked={true}
                          onChange={() => handleToggleTodo(todo)}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={todo.content}
                        secondary={
                          <>
                            {todo.assignee && `担当: ${todo.assignee}　`}
                            {todo.due_date && `期限: ${todo.due_date}`}
                          </>
                        }
                        sx={{ textDecoration: 'line-through', color: 'text.disabled' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Paper>
        </>
      )}
    </Container>
  );
}
