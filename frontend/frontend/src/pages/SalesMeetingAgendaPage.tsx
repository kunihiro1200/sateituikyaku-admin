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
  IconButton,
  Divider,
  Collapse,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Add as AddIcon, Delete as DeleteIcon, CheckCircle as CheckCircleIcon, RadioButtonUnchecked as RadioButtonUncheckedIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { SECTION_COLORS } from '../theme/sectionColors';

interface Todo {
  id: string;
  year_month: string;
  content: string;
  assignee: string | null;
  due_date: string | null;
  remarks: string | null;
  completed: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

interface Staff {
  name: string;
  initials: string;
  is_active: boolean;
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
  const [staffList, setStaffList] = useState<Staff[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 新規TODO入力
  const [newTodoContent, setNewTodoContent] = useState('');
  const [newTodoAssignee, setNewTodoAssignee] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [newTodoRemarks, setNewTodoRemarks] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);

  // TODO編集（展開中のTODO ID、編集フィールド）
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [savingTodoId, setSavingTodoId] = useState<string | null>(null);

  useEffect(() => {
    fetchMonths();
    fetchStaff();
    fetchAllTodos();
  }, []);

  useEffect(() => {
    fetchAgendaText(selectedMonth);
  }, [selectedMonth]);

  const fetchMonths = async () => {
    try {
      const response = await api.get('/api/sales-meeting-agenda/months');
      setExistingMonths(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch months:', error);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await api.get('/api/shared-items/staff');
      setStaffList(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    }
  };

  // TODOは対象月に関係なく全件取得（要件：完了していないものは月に関わらず全て表示）
  const fetchAllTodos = useCallback(async () => {
    try {
      const response = await api.get('/api/sales-meeting-agenda/todos/all');
      setTodos(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch todos:', error);
      setApiError(error.response?.data?.error || error.message || 'TODOの取得に失敗しました');
    }
  }, []);

  // 議題本文のみ対象月で切り替える
  const fetchAgendaText = useCallback(async (ym: string) => {
    try {
      setLoading(true);
      setApiError('');
      const response = await api.get(`/api/sales-meeting-agenda/${ym}`);
      const data = response.data.data;
      setAgendaText(data.agenda_text || '');
      setInitialAgendaText(data.agenda_text || '');
    } catch (error: any) {
      console.error('Failed to fetch agenda text:', error);
      setApiError(error.response?.data?.error || error.message || '議題の取得に失敗しました');
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
      setApiError(error.response?.data?.error || error.message || '議題の保存に失敗しました');
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
        remarks: newTodoRemarks,
        created_by: employee?.name || '',
      });
      setTodos((prev) => [...prev, response.data.data]);
      setNewTodoContent('');
      setNewTodoAssignee('');
      setNewTodoDueDate('');
      setNewTodoRemarks('');
      fetchMonths();
    } catch (error: any) {
      console.error('Failed to add todo:', error);
      setApiError(error.response?.data?.error || error.message || 'TODOの追加に失敗しました');
    } finally {
      setAddingTodo(false);
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    setApiError('');
    try {
      const response = await api.post(`/api/sales-meeting-agenda/todos/${todo.id}/complete`, {
        completed: !todo.completed,
      });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? response.data.data : t)));
    } catch (error: any) {
      setApiError(error.response?.data?.error || error.message || '完了状態の更新に失敗しました');
    }
  };

  const handleDeleteTodo = async (id: string) => {
    setApiError('');
    try {
      await api.delete(`/api/sales-meeting-agenda/todos/${id}`);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (error: any) {
      setApiError(error.response?.data?.error || error.message || 'TODOの削除に失敗しました');
    }
  };

  const handleExpandTodo = (todo: Todo) => {
    if (expandedTodoId === todo.id) {
      setExpandedTodoId(null);
      return;
    }
    setExpandedTodoId(todo.id);
    setEditContent(todo.content);
    setEditAssignee(todo.assignee || '');
    setEditDueDate(todo.due_date || '');
    setEditRemarks(todo.remarks || '');
  };

  const handleSaveTodoEdit = async (id: string) => {
    setSavingTodoId(id);
    setApiError('');
    try {
      const response = await api.put(`/api/sales-meeting-agenda/todos/${id}`, {
        content: editContent,
        assignee: editAssignee,
        due_date: editDueDate || null,
        remarks: editRemarks,
      });
      setTodos((prev) => prev.map((t) => (t.id === id ? response.data.data : t)));
      setExpandedTodoId(null);
    } catch (error: any) {
      setApiError(error.response?.data?.error || error.message || 'TODOの保存に失敗しました');
    } finally {
      setSavingTodoId(null);
    }
  };

  const monthOptions = generateMonthOptions(existingMonths);
  const hasAgendaChanges = agendaText !== initialAgendaText;
  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  const renderTodoItem = (todo: Todo) => {
    const isExpanded = expandedTodoId === todo.id;
    return (
      <Box key={todo.id} sx={{ border: '1px solid #eee', borderRadius: 1, mb: 1, opacity: todo.completed ? 0.7 : 1, overflow: 'hidden' }}>
        <Box
          onClick={(e) => {
            e.stopPropagation();
            handleExpandTodo(todo);
          }}
          role="button"
          tabIndex={0}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            p: 1.5,
            minHeight: 48,
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': { bgcolor: '#fafafa' },
          }}
        >
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleToggleTodo(todo); }}
            sx={{ mr: 1, mt: 0.25, color: todo.completed ? '#4caf50' : color.main, flexShrink: 0 }}
            title={todo.completed ? '未完了に戻す' : '完了にする'}
          >
            {todo.completed ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ textDecoration: todo.completed ? 'line-through' : 'none', whiteSpace: 'pre-wrap' }}>
              {todo.content}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {todo.assignee && `担当: ${todo.assignee}　`}
              {todo.due_date && `期限: ${todo.due_date}`}
            </Typography>
            {todo.remarks && (
              <Typography variant="caption" color="text.secondary" display="block">
                備考: {todo.remarks}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0, ml: 1 }}>
            {todo.completed && <Chip label="完了" size="small" color="success" />}
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleExpandTodo(todo); }} title="編集">
              {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteTodo(todo.id); }} title="削除">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Collapse in={isExpanded}>
          <Box sx={{ p: 2, pt: 0 }}>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">TODO内容</Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  sx={{ mt: 0.5 }}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="text.secondary">誰が</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  sx={{ mt: 0.5 }}
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value=""><em>未指定</em></MenuItem>
                  {staffList.map((s) => (
                    <MenuItem key={s.name} value={s.name}>{s.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="text.secondary">いつまで</Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mt: 0.5 }}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">備考</Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  size="small"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  sx={{ mt: 0.5 }}
                />
              </Grid>
              <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                <Button
                  size="small"
                  variant={todo.completed ? 'outlined' : 'contained'}
                  color={todo.completed ? 'inherit' : 'success'}
                  onClick={() => handleToggleTodo(todo)}
                  startIcon={todo.completed ? <RadioButtonUncheckedIcon /> : <CheckCircleIcon />}
                >
                  {todo.completed ? '未完了に戻す' : '完了にする'}
                </Button>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={() => setExpandedTodoId(null)}>キャンセル</Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => handleSaveTodoEdit(todo.id)}
                    disabled={savingTodoId === todo.id || !editContent.trim()}
                    sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark } }}
                    startIcon={savingTodoId === todo.id ? <CircularProgress size={14} color="inherit" /> : undefined}
                  >
                    {savingTodoId === todo.id ? '保存中...' : '保存'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Box>
    );
  };

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

      {/* 議題本文（対象月で切り替わる） */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, color: color.main }}>
          {monthOptions.find((o) => o.value === selectedMonth)?.label || selectedMonth} 議題
        </Typography>
        {loading ? (
          <Typography variant="body2" color="text.secondary">読み込み中...</Typography>
        ) : (
          <>
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
          </>
        )}
      </Paper>

      {/* TODOリスト（月に関係なく全件表示） */}
      <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>TODO</Typography>

            {/* 新規TODO入力 */}
            <Grid container spacing={1} sx={{ mb: 1 }}>
              <Grid item xs={12} sm={5}>
                <Typography variant="caption" color="text.secondary">TODO内容</Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  size="small"
                  placeholder="TODOを入力"
                  value={newTodoContent}
                  onChange={(e) => setNewTodoContent(e.target.value)}
                  sx={{ mt: 0.5 }}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">誰が</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={newTodoAssignee}
                  onChange={(e) => setNewTodoAssignee(e.target.value)}
                  sx={{ mt: 0.5 }}
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value=""><em>未指定</em></MenuItem>
                  {staffList.map((s) => (
                    <MenuItem key={s.name} value={s.name}>{s.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">いつまで</Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={newTodoDueDate}
                  onChange={(e) => setNewTodoDueDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mt: 0.5 }}
                />
              </Grid>
              <Grid item xs={12} sm={1} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleAddTodo}
                  disabled={addingTodo || !newTodoContent.trim()}
                  sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark }, height: 40 }}
                >
                  {addingTodo ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">備考</Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  size="small"
                  placeholder="備考（任意）"
                  value={newTodoRemarks}
                  onChange={(e) => setNewTodoRemarks(e.target.value)}
                  sx={{ mt: 0.5 }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ mt: 2, mb: 1 }} />

            {/* 未完了TODO */}
            <List disablePadding>
              {activeTodos.length === 0 && completedTodos.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  TODOはありません
                </Typography>
              ) : (
                activeTodos.map(renderTodoItem)
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
                  {completedTodos.map(renderTodoItem)}
                </List>
              </>
            )}
      </Paper>
    </Container>
  );
}
