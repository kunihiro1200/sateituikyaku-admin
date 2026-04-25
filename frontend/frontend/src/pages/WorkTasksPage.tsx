import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Badge,
  Snackbar,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Search as SearchIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import api from '../services/api';
import WorkTaskDetailModal from '../components/WorkTaskDetailModal';
import { WorkTask, getStatusCategories, filterTasksByStatus, calculateTaskStatus, getCategoryGroupColor } from '../utils/workTaskStatusUtils';
import PageNavigation from '../components/PageNavigation';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';

/**
 * カテゴリーキー文字列からタブインデックスを返す
 * - 「媒介」で始まる → 0（媒介契約タブ）
 * - 「サイト」で始まる → 1（サイト登録タブ）
 * - 「売買契約」「決済」「要台帳」で始まる → 2（契約決済タブ）
 * - それ以外（「all」含む）・null・空文字 → 0
 */
function getInitialTabIndexFromCategory(category: string | null): number {
  if (!category) return 0;
  const label = category.startsWith('status:') ? category.slice('status:'.length) : category;
  if (label.startsWith('媒介')) return 0;
  if (label.startsWith('サイト')) return 1;
  if (
    label.startsWith('売買契約') ||
    label.startsWith('決済') ||
    label.startsWith('要台帳')
  ) return 2;
  return 0;
}

export default function WorkTasksPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [allWorkTasks, setAllWorkTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPropertyNumber, setSelectedPropertyNumber] = useState<string | null>(null);
  const [selectedTaskData, setSelectedTaskData] = useState<WorkTask | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [initialTabIndex, setInitialTabIndex] = useState(0);

  const handleCopyPropertyNumber = async (propertyNumber: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(propertyNumber);
      setSnackbarMessage(`${propertyNumber} をコピーしました`);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('クリップボードへのコピーに失敗しました:', error);
    }
  };

  const handleRowClick = (task: WorkTask) => {
    setSelectedPropertyNumber(task.property_number);
    setSelectedTaskData(task);
    setInitialTabIndex(getInitialTabIndexFromCategory(selectedCategory));
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedPropertyNumber(null);
    setSelectedTaskData(null);
  };

  useEffect(() => {
    fetchAllWorkTasks();
  }, []);

  const fetchAllWorkTasks = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = pageDataCache.get<WorkTask[]>(CACHE_KEYS.WORK_TASKS);
      if (cached) {
        setAllWorkTasks(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      const response = await api.get('/api/work-tasks', {
        params: {
          limit: 1000,
          offset: 0,
          orderBy: 'created_at',
          orderDirection: 'desc',
        },
      });
      const data = response.data.data || [];
      pageDataCache.set(CACHE_KEYS.WORK_TASKS, data);
      setAllWorkTasks(data);
    } catch (error) {
      console.error('Failed to fetch work tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusCategories = useMemo(() => {
    return getStatusCategories(allWorkTasks);
  }, [allWorkTasks]);

  // allWorkTasksが更新された後、selectedCategoryが存在しなくなった場合は'all'にリセット
  // （モーダルで条件変更・保存後にステータスが変わり、カテゴリーキーが変わる場合に対応）
  useEffect(() => {
    if (selectedCategory === 'all') return;
    const exists = statusCategories.some(cat => cat.key === selectedCategory);
    if (!exists) {
      setSelectedCategory('all');
      setPage(0);
    }
  }, [statusCategories, selectedCategory]);

  const filteredTasks = useMemo(() => {
    let tasks = filterTasksByStatus(allWorkTasks, selectedCategory);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      tasks = tasks.filter(t =>
        t.property_number?.toLowerCase().includes(query) ||
        t.property_address?.toLowerCase().includes(query) ||
        t.seller_name?.toLowerCase().includes(query)
      );
    }
    return tasks;
  }, [allWorkTasks, selectedCategory, searchQuery]);

  const paginatedTasks = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredTasks.slice(start, start + rowsPerPage);
  }, [filteredTasks, page, rowsPerPage]);

  const total = filteredTasks.length;

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCategoryChange = (key: string) => {
    setSelectedCategory(key);
    setPage(0);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('ja-JP');
    } catch {
      return dateStr;
    }
  };

  // サイドバーリスト（共通）
  const sidebarList = (
    <List dense>
      {statusCategories.map((cat, idx) => {
        const prevLabel = idx > 0 ? statusCategories[idx - 1].label : '';
        const showDivider =
          (prevLabel.startsWith('サイト') || prevLabel.startsWith('サイト登録')) &&
          (cat.label.startsWith('契約後司法書士') || cat.label.startsWith('金種表') || cat.label.startsWith('売買契約'));
        return (
          <React.Fragment key={cat.key}>
            {showDivider && <Box sx={{ my: 0.5, borderTop: '2px solid #bdbdbd' }} />}
            <ListItemButton
              selected={selectedCategory === cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              sx={{
                py: 0.5,
                backgroundColor: getCategoryGroupColor(cat.label),
                '&:hover': {
                  backgroundColor: getCategoryGroupColor(cat.label),
                  filter: 'brightness(0.95)',
                },
                '&.Mui-selected': { backgroundColor: 'action.selected' },
                '&.Mui-selected:hover': { backgroundColor: 'action.selected' },
              }}
            >
              <ListItemText
                primary={cat.label}
                primaryTypographyProps={{
                  variant: cat.isDeadlineTomorrow ? 'body1' : 'body2',
                  sx: {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: (cat.isUrgent || cat.isDeadlinePast) ? 'error.main' : 'text.primary',
                    fontWeight: (cat.isUrgent || cat.isDeadlinePast || cat.isDeadlineTomorrow) ? 'bold' : 'normal',
                  },
                }}
                secondary={cat.siteDeadline ? `締め日: ${cat.siteDeadline}` : cat.deadline ? `締め日: ${cat.deadline}` : undefined}
                secondaryTypographyProps={{
                  variant: 'caption',
                  color: cat.isDeadlinePast ? 'error' : 'text.secondary',
                }}
              />
              <Badge
                badgeContent={cat.count}
                color={cat.isUrgent ? 'error' : 'primary'}
                max={999}
                sx={{ ml: 1 }}
              />
            </ListItemButton>
          </React.Fragment>
        );
      })}
    </List>
  );

  return (
    <Container maxWidth="xl" sx={isMobile ? { overflowX: 'hidden', px: 1, py: 2 } : { py: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>業務依頼</Typography>

      <PageNavigation />

      {/* モバイル：アコーディオンでカテゴリ選択 */}
      {isMobile && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" fontWeight="bold">
              業務リスト
              {selectedCategory !== 'all' && (
                <Chip
                  label={statusCategories.find(c => c.key === selectedCategory)?.label || selectedCategory}
                  size="small"
                  sx={{ ml: 1, fontSize: '11px', height: 20 }}
                />
              )}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {sidebarList}
          </AccordionDetails>
        </Accordion>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* デスクトップ：左サイドバー */}
        {!isMobile && (
          <Paper sx={{ width: 280, flexShrink: 0 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
              <Typography variant="subtitle1" fontWeight="bold">業務リスト</Typography>
            </Box>
            {sidebarList}
          </Paper>
        )}

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* 検索バー */}
          <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search 業務リスト（物件番号、所在、売主）"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Paper>

          {/* 上部ページネーション（デスクトップのみ） */}
          {!isMobile && (
            <Box sx={{ mb: 2 }}>
              <Paper>
                <TablePagination
                  rowsPerPageOptions={[25, 50, 100]}
                  component="div"
                  count={total}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelRowsPerPage="表示件数:"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
                />
              </Paper>
            </Box>
          )}

          {/* モバイル：カードリスト */}
          {isMobile ? (
            <Box>
              {loading ? (
                <Typography align="center" sx={{ py: 4, fontSize: '14px' }}>読み込み中...</Typography>
              ) : paginatedTasks.length === 0 ? (
                <Typography align="center" sx={{ py: 4, fontSize: '14px' }}>業務データが見つかりませんでした</Typography>
              ) : (
                paginatedTasks.map((task) => {
                  const status = calculateTaskStatus(task);
                  return (
                    <Card
                      key={task.id}
                      onClick={() => task.property_number && handleRowClick(task)}
                      sx={{ mb: 1, cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        {/* 1行目：物件番号 + ステータス */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Box
                            onClick={(e) => task.property_number && handleCopyPropertyNumber(task.property_number, e)}
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: task.property_number ? 'pointer' : 'default' }}
                          >
                            <Typography variant="body2" fontWeight="bold" color="primary" sx={{ fontSize: '13px' }}>
                              {task.property_number || '-'}
                            </Typography>
                            {task.property_number && (
                              <ContentCopyIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                            )}
                          </Box>
                          {status && (
                            <Chip
                              label={status}
                              size="small"
                              color={status.includes('未') || status.includes('要') ? 'warning' : 'default'}
                              sx={{ fontSize: '11px', height: 20, maxWidth: 160, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                            />
                          )}
                        </Box>
                        {/* 2行目：物件所在 */}
                        <Typography variant="body2" sx={{ fontSize: '13px', mb: 0.25 }}>
                          {task.property_address || '-'}
                        </Typography>
                        {/* 3行目：売主・営業担当 */}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="caption" color="text.secondary">
                            売主: {task.seller_name || '-'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            担当: {task.sales_assignee || '-'}
                          </Typography>
                        </Box>
                        {/* 4行目：媒介形態・締め日 */}
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                          {task.mediation_type && (
                            <Chip label={task.mediation_type} size="small" sx={{ fontSize: '11px', height: 18 }} />
                          )}
                          {task.mediation_deadline && (
                            <Typography variant="caption" color="text.secondary">
                              媒介締め日: {formatDate(task.mediation_deadline)}
                            </Typography>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })
              )}
              {/* モバイル下部ページネーション */}
              <Paper sx={{ mt: 1 }}>
                <TablePagination
                  rowsPerPageOptions={[25, 50, 100]}
                  component="div"
                  count={total}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelRowsPerPage="件数:"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
                />
              </Paper>
            </Box>
          ) : (
            /* デスクトップ：テーブル表示 */
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell>物件番号</TableCell>
                    <TableCell>物件所在</TableCell>
                    <TableCell>売主</TableCell>
                    <TableCell>営業担当</TableCell>
                    <TableCell>種別</TableCell>
                    <TableCell>媒介形態</TableCell>
                    <TableCell>媒介締め日</TableCell>
                    <TableCell>媒介完了</TableCell>
                    <TableCell>媒介備考</TableCell>
                    <TableCell>ステータス</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">読み込み中...</TableCell>
                    </TableRow>
                  ) : paginatedTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">業務データが見つかりませんでした</TableCell>
                    </TableRow>
                  ) : (
                    paginatedTasks.map((task) => {
                      const status = calculateTaskStatus(task);
                      return (
                        <TableRow
                          key={task.id}
                          hover
                          onClick={() => task.property_number && handleRowClick(task)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <Box
                              onClick={(e) => task.property_number && handleCopyPropertyNumber(task.property_number, e)}
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                cursor: task.property_number ? 'pointer' : 'default',
                                '&:hover .copy-icon': { visibility: 'visible' },
                              }}
                            >
                              <Typography variant="body2" color="primary" fontWeight="bold">
                                {task.property_number || '-'}
                              </Typography>
                              {task.property_number && (
                                <ContentCopyIcon
                                  className="copy-icon"
                                  sx={{ fontSize: 14, visibility: 'hidden', color: 'text.secondary' }}
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>{task.property_address || '-'}</TableCell>
                          <TableCell>{task.seller_name || '-'}</TableCell>
                          <TableCell>{task.sales_assignee || '-'}</TableCell>
                          <TableCell>{task.property_type || '-'}</TableCell>
                          <TableCell>
                            {task.mediation_type ? (
                              <Chip label={task.mediation_type} size="small" color="default" />
                            ) : '-'}
                          </TableCell>
                          <TableCell>{formatDate(task.mediation_deadline)}</TableCell>
                          <TableCell>{formatDate(task.mediation_completed)}</TableCell>
                          <TableCell>{task.mediation_notes || '-'}</TableCell>
                          <TableCell>
                            {status && (
                              <Chip
                                label={status}
                                size="small"
                                color={status.includes('未') || status.includes('要') ? 'warning' : 'default'}
                                sx={{ maxWidth: 200, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={total}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="表示件数:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
              />
            </TableContainer>
          )}
        </Box>
      </Box>

      <WorkTaskDetailModal
        open={modalOpen}
        onClose={handleModalClose}
        propertyNumber={selectedPropertyNumber}
        initialData={selectedTaskData}
        onUpdate={() => fetchAllWorkTasks(true)}
        initialTabIndex={initialTabIndex}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}
