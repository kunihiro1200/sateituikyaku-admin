import { useState, useEffect, useMemo } from 'react';
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
  IconButton,
  Button,
  ListItemButton,
  ListItemText,
  Badge,
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon, Add as AddIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import PageNavigation from '../components/PageNavigation';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';
import { SECTION_COLORS } from '../theme/sectionColors';

interface SharedItem {
  id: string;
  sharing_location: string;  // D列「共有場」
  sharing_date: string | null;  // P列「共有日」
  staff_not_shared: string | null;  // S列「共有できていない」
  confirmation_date: string | null;  // 確認日
  [key: string]: any;  // その他のカラム
}

export default function SharedItemsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sharedItemsColor = SECTION_COLORS.sharedItems;
  const [allSharedItems, setAllSharedItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(
    (location.state as { restoreLocation?: string | null })?.restoreLocation ?? null
  );
  // 未確認フィルター用スタッフ名（null = 未確認フィルターなし）
  const [selectedUnconfirmedStaff, setSelectedUnconfirmedStaff] = useState<string | null>(null);

  useEffect(() => {
    fetchAllSharedItems();
  }, []);

  const fetchAllSharedItems = async (forceRefresh = false) => {
    // キャッシュが有効な場合はAPIを叩かない
    if (!forceRefresh) {
      const cached = pageDataCache.get<SharedItem[]>(CACHE_KEYS.SHARED_ITEMS);
      if (cached) {
        setAllSharedItems(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      const response = await api.get('/api/shared-items', {
        params: {
          limit: 1000,
          offset: 0,
          orderBy: 'created_at',
          orderDirection: 'desc',
        },
      });
      const data = response.data.data || [];
      // キャッシュに保存（3分間有効）
      pageDataCache.set(CACHE_KEYS.SHARED_ITEMS, data);
      setAllSharedItems(data);
    } catch (error) {
      console.error('Failed to fetch shared items:', error);
    } finally {
      setLoading(false);
    }
  };

  // 検索フィルタリング（日付降順ソート）
  const filteredItems = useMemo(() => {
    let items = allSharedItems;

    // 未確認スタッフフィルター
    if (selectedUnconfirmedStaff) {
      items = items.filter(
        (item) =>
          item.staff_not_shared &&
          !item.confirmation_date &&
          String(item.staff_not_shared)
            .split(/[,、，]/)
            .map((s) => s.trim())
            .includes(selectedUnconfirmedStaff)
      );
    } else if (selectedLocation) {
      // 共有場フィルター
      items = items.filter(item => (item.sharing_location || '') === selectedLocation);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item =>
        Object.values(item).some(value =>
          value && String(value).toLowerCase().includes(query)
        )
      );
    }

    // 日付降順ソート（共有日 → 日付 の優先順）
    return [...items].sort((a, b) => {
      const dateA = a['共有日'] || a['日付'] || '';
      const dateB = b['共有日'] || b['日付'] || '';
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [allSharedItems, searchQuery, selectedLocation, selectedUnconfirmedStaff]);

  // サイドバー用カテゴリー集計（出現順を維持）
  const locationCategories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const item of allSharedItems) {
      const loc = item.sharing_location || '';
      if (loc) {
        seen.set(loc, (seen.get(loc) || 0) + 1);
      }
    }
    return Array.from(seen.entries()).map(([label, count]) => ({ label, count }));
  }, [allSharedItems]);

  // 「●●＿未確認」カテゴリー集計
  // staff_not_shared に値があり confirmation_date が空のアイテムをスタッフ名ごとに集計
  const unconfirmedCategories = useMemo(() => {
    const staffMap = new Map<string, number>();
    for (const item of allSharedItems) {
      if (item.staff_not_shared && !item.confirmation_date) {
        // カンマ区切りで複数スタッフが入っている場合に対応
        const staffNames = String(item.staff_not_shared)
          .split(/[,、，]/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const name of staffNames) {
          staffMap.set(name, (staffMap.get(name) || 0) + 1);
        }
      }
    }
    return Array.from(staffMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ja'))
      .map(([name, count]) => ({ label: `${name}＿未確認`, staffName: name, count }));
  }, [allSharedItems]);

  // ページネーション用
  const paginatedItems = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  const total = filteredItems.length;

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRowClick = (id: string) => {
    navigate(`/shared-items/${id}`, {
      state: { fromLocation: selectedLocation },
    });
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ color: sharedItemsColor.main }}>
          共有（社内共有事項管理）
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/shared-items/new')}
          sx={{
            bgcolor: sharedItemsColor.main,
            '&:hover': { bgcolor: sharedItemsColor.dark },
          }}
        >
          新規作成
        </Button>
      </Box>
      
      {/* ページナビゲーション */}
      <PageNavigation />

      {/* サイドバー＋メインコンテンツ */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        {/* サイドバー */}
        <Paper sx={{ width: 200, flexShrink: 0, alignSelf: 'flex-start' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="subtitle1" fontWeight="bold">共有場</Typography>
          </Box>
          {/* All */}
          <ListItemButton
            selected={!selectedLocation && !selectedUnconfirmedStaff}
            onClick={() => { setSelectedLocation(null); setSelectedUnconfirmedStaff(null); setPage(0); }}
            sx={{ py: 1 }}
          >
            <ListItemText
              primary="All"
              primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold' }}
              sx={{ flex: 1, minWidth: 0 }}
            />
            <Badge
              badgeContent={allSharedItems.length}
              sx={{
                ml: 1,
                '& .MuiBadge-badge': { backgroundColor: sharedItemsColor.main, color: '#fff' }
              }}
              max={9999}
            />
          </ListItemButton>
          {/* 未確認カテゴリー */}
          {unconfirmedCategories.length > 0 && (
            <>
              <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  未確認
                </Typography>
              </Box>
              {unconfirmedCategories.map(({ label, staffName, count }) => (
                <ListItemButton
                  key={label}
                  selected={selectedUnconfirmedStaff === staffName}
                  onClick={() => { setSelectedUnconfirmedStaff(staffName); setSelectedLocation(null); setPage(0); }}
                  sx={{
                    py: 1,
                    borderLeft: '4px solid #f44336',
                    '&.Mui-selected': {
                      backgroundColor: '#f4433615',
                    },
                    '&:hover': {
                      backgroundColor: '#f4433610',
                    },
                  }}
                >
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{ variant: 'body2', color: '#d32f2f' }}
                    sx={{ flex: 1, minWidth: 0, mr: 1 }}
                  />
                  <Badge
                    badgeContent={count}
                    sx={{
                      ml: 1,
                      '& .MuiBadge-badge': { backgroundColor: '#f44336', color: '#fff' }
                    }}
                    max={9999}
                  />
                </ListItemButton>
              ))}
              <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  共有場
                </Typography>
              </Box>
            </>
          )}
          {/* 共有場カテゴリー */}
          {locationCategories.map(({ label, count }) => (
            <ListItemButton
              key={label}
              selected={selectedLocation === label && !selectedUnconfirmedStaff}
              onClick={() => { setSelectedLocation(label); setSelectedUnconfirmedStaff(null); setPage(0); }}
              sx={{
                py: 1,
                borderLeft: `4px solid ${sharedItemsColor.main}`,
                '&.Mui-selected': {
                  backgroundColor: `${sharedItemsColor.main}15`,
                },
                '&:hover': {
                  backgroundColor: `${sharedItemsColor.main}10`,
                },
              }}
            >
              <ListItemText
                primary={label}
                primaryTypographyProps={{ variant: 'body2' }}
                sx={{ flex: 1, minWidth: 0, mr: 1 }}
              />
              <Badge
                badgeContent={count}
                sx={{
                  ml: 1,
                  '& .MuiBadge-badge': { backgroundColor: sharedItemsColor.main, color: '#fff' }
                }}
                max={9999}
              />
            </ListItemButton>
          ))}
        </Paper>

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* 検索バー */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search 共有リスト（全フィールド検索）"
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
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSearchQuery('');
                      setPage(0);
                    }}
                  >
                    <ClearIcon />
                  </IconButton>
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
              <TableRow sx={{ bgcolor: `${sharedItemsColor.light}20` }}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>ID</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>入力者</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>共有日</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>項目</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>タイトル</TableCell>
                <TableCell>内容</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>画像1</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>画像2</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>画像3</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>画像4</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>日付</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>打ち合わせ内容</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    共有データが見つかりませんでした
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item) => (
                  <TableRow 
                    key={item.id} 
                    hover 
                    onClick={() => handleRowClick(item.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold" sx={{ color: sharedItemsColor.main }}>
                        {item.id || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{item['入力者'] || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(item['共有日'] || item.sharing_date)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{item['項目'] || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{item['タイトル'] || '-'}</TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item['内容'] || '-'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{item['画像1'] ? '✓' : '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{item['画像2'] ? '✓' : '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{item['画像3'] ? '✓' : '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{item['画像4'] ? '✓' : '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(item['日付'])}</TableCell>
                    <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item['打ち合わせ内容'] || '-'}
                    </TableCell>
                  </TableRow>
                ))
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
    </Container>
  );
}
