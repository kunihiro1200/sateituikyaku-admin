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
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
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
  // カテゴリーキーは "status:ステータス文字列" 形式のため、プレフィックスを除去して判定
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
    // キャッシュが有効な場合はAPIを叩かない
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
      // 全件取得してフロントエンドでフィルタリング
      const response = await api.get('/api/work-tasks', {
        params: {
          limit: 1000,
          offset: 0,
          orderBy: 'created_at',
          orderDirection: 'desc',
        },
      });
      const data = response.data.data || [];
      // キャッシュに保存（3分間有効）
      pageDataCache.set(CACHE_KEYS.WORK_TASKS, data);
      setAllWorkTasks(data);
    } catch (error) {
      console.error('Failed to fetch work tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // ステータスカテゴリを計算（0件は除外）
  const statusCategories = useMemo(() => {
    return getStatusCategories(allWorkTasks);
  }, [allWorkTasks]);

  // 選択されたカテゴリでフィルタリング
  const filteredTasks = useMemo(() => {
    let tasks = filterTasksByStatus(allWorkTasks, selectedCategory);
    
    // 検索クエリでさらにフィルタリング
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

  // ページネーション用
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
    setPage(0); // カテゴリ変更時はページをリセット
  };

  // 日付フォーマット
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('ja-JP');
    } catch {
      return dateStr;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>業務依頼</Typography>

      {/* ページナビゲーション */}
      <PageNavigation />

      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* 左サイドバー */}
        <Paper sx={{ width: 280, flexShrink: 0 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="subtitle1" fontWeight="bold">
              業務リスト
            </Typography>
          </Box>
          <List dense>
            {statusCategories.map((cat, idx) => {
              // サイト系の最後（サイト登録要確認）と売買契約系の最初（契約後司法書士連絡未 or 売買契約）の間に区切り線
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
                      '&.Mui-selected': {
                        backgroundColor: 'action.selected',
                      },
                      '&.Mui-selected:hover': {
                        backgroundColor: 'action.selected',
                      },
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
                        }
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
        </Paper>

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1 }}>
          {/* 検索バー */}
          <Paper sx={{ p: 2, mb: 2 }}>
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

          {/* 上部ページネーション */}
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

          {/* テーブル */}
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
                    <TableCell colSpan={9} align="center">
                      読み込み中...
                    </TableCell>
                  </TableRow>
                ) : paginatedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      業務データが見つかりませんでした
                    </TableCell>
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
        </Box>
      </Box>

      {/* 詳細モーダル */}
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
