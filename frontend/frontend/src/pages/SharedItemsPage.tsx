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
  Collapse,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon, Add as AddIcon, ExpandLess, ExpandMore, OpenInNew as OpenInNewIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import PageNavigation from '../components/PageNavigation';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';
import { useSharedItemPresenceSubscribe } from '../hooks/useListPresence';
import PresenceChips from '../components/PresenceChips';
import { SECTION_COLORS } from '../theme/sectionColors';
import CallRankingDisplay from '../components/CallRankingDisplay';

// 営業会議スプレッドシートURL
const SALES_MEETING_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1i_fRAdBKnM3Mctb4g_jdpo1rFgRqH7pxUn9DPIF39eY/edit?gid=738163181#gid=738163181';
// 営業会議Chat URL
const SALES_MEETING_CHAT_URL = 'https://mail.google.com/mail/u/0/#chat/space/AAQAouqL-7E';

// 営業_資料 Google Driveフォルダリンク
const SALES_MATERIALS_LINKS = [
  { label: 'いふう_定番', url: 'https://drive.google.com/drive/u/0/folders/169D4GRvkJd4S8AkwpfLqrGZU3NGiawDp' },
  { label: 'くじら_定番', url: 'https://drive.google.com/drive/u/0/folders/1FwlNVedSK3s-S6lAj1Z7pUpkBT1RBNXy' },
  { label: 'くじら_物件別', url: 'https://drive.google.com/drive/u/0/folders/1R9JOYuZfGMuwDI-t12rbcTmkIzyqeBEj' },
];

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
  // プレゼンス購読（誰が今どの共有項目を開いて作業しているか）
  const { presenceState } = useSharedItemPresenceSubscribe();
  const [allSharedItems, setAllSharedItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(
    (location.state as { restoreLocation?: string | null })?.restoreLocation ?? null
  );
  // 未確認フィルター用スタッフ名（null = 未確認フィルターなし）
  const [selectedUnconfirmedStaff, setSelectedUnconfirmedStaff] = useState<string | null>(null);
  // 削除ダイアログ用
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetItem, setDeleteTargetItem] = useState<SharedItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 専任媒介・月別サマリー（担当者別）
  const [exclusiveMonthlySummary, setExclusiveMonthlySummary] = useState<
    Record<string, { yearMonth: string; label: string; count: number; sellerIds: string[] }[]>
  >({});
  // 他決・月別サマリー（担当者別）
  const [otherDecisionMonthlySummary, setOtherDecisionMonthlySummary] = useState<
    Record<string, { yearMonth: string; label: string; count: number; sellerIds: string[] }[]>
  >({});
  // 営業会議〜他決分析セクションの展開state（営業会議クリックで一括開閉、デフォルトは閉じた状態）
  const [salesMeetingSectionExpanded, setSalesMeetingSectionExpanded] = useState(false);
  // 営業_資料セクションの展開state
  const [salesMaterialsExpanded, setSalesMaterialsExpanded] = useState(false);
  // 専任月別セクション専用の展開state
  const [exclusiveExpandedMonth, setExclusiveExpandedMonth] = useState<string | null>(null);
  // 他決月別セクション専用の展開state
  const [otherDecisionExpandedMonth, setOtherDecisionExpandedMonth] = useState<string | null>(null);
  // 業務会議セクションの展開state
  const [businessMeetingSectionExpanded, setBusinessMeetingSectionExpanded] = useState(false);
  // 業務会議ランキングダイアログ
  const [visitRankingDialogOpen, setVisitRankingDialogOpen] = useState(false);
  const [visitRankingYearlyDialogOpen, setVisitRankingYearlyDialogOpen] = useState(false);
  const [callTrackingRankingDialogOpen, setCallTrackingRankingDialogOpen] = useState(false);
  const [callRankingDialogOpen, setCallRankingDialogOpen] = useState(false);
  const [callRankingYearlyDialogOpen, setCallRankingYearlyDialogOpen] = useState(false);
  // 買主電話ランキングダイアログ
  const [buyerCallRankingDialogOpen, setBuyerCallRankingDialogOpen] = useState(false);
  const [buyerCallRankingYearlyDialogOpen, setBuyerCallRankingYearlyDialogOpen] = useState(false);

  useEffect(() => {
    fetchAllSharedItems();
  }, []);

  // 専任媒介・月別サマリーを取得（初回のみ）
  useEffect(() => {
    let cancelled = false;
    const fetchSummary = async () => {
      try {
        const res = await api.get('/api/sellers/exclusive-monthly-summary');
        if (!cancelled) setExclusiveMonthlySummary(res.data?.summary || {});
      } catch (e) {
        // サイドバーのオプション機能なのでエラーは無視
      }
    };
    fetchSummary();
    return () => { cancelled = true; };
  }, []);

  // 他決・月別サマリーを取得（初回のみ）
  useEffect(() => {
    let cancelled = false;
    const fetchOtherDecisionSummary = async () => {
      try {
        const res = await api.get('/api/sellers/other-decision-monthly-summary');
        if (!cancelled) setOtherDecisionMonthlySummary(res.data?.summary || {});
      } catch (e) {
        // エラーは無視
      }
    };
    fetchOtherDecisionSummary();
    return () => { cancelled = true; };
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
      setFetchError(null);
      const response = await api.get('/api/shared-items', {
        params: {
          limit: 1000,
          offset: 0,
          orderBy: 'created_at',
          orderDirection: 'desc',
        },
        timeout: 30000, // 30秒タイムアウト（Vercelコールドスタート対策）
      });
      const data = response.data.data || [];
      // キャッシュに保存（3分間有効）
      pageDataCache.set(CACHE_KEYS.SHARED_ITEMS, data);
      setAllSharedItems(data);
    } catch (error: any) {
      console.error('Failed to fetch shared items:', error);
      setFetchError('共有データの取得に失敗しました。再読み込みしてください。');
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

  // 削除ハンドラー
  const handleDeleteClick = (e: React.MouseEvent, item: SharedItem) => {
    e.stopPropagation(); // 行クリック（詳細遷移）を防止
    setDeleteTargetItem(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetItem) return;
    setDeleting(true);
    try {
      await api.delete(`/api/shared-items/${deleteTargetItem.id}`);
      pageDataCache.invalidate(CACHE_KEYS.SHARED_ITEMS);
      setDeleteDialogOpen(false);
      setDeleteTargetItem(null);
      // リストを再読み込み
      await fetchAllSharedItems(true);
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(error.response?.data?.error || '削除に失敗しました。もう一度お試しください。');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeleteTargetItem(null);
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
          {locationCategories
            .filter(({ label }) => label !== '契約率チーム' && label !== '物件数チーム' && label !== '事務会議')
            .map(({ label, count }) => (
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
          {/* 営業会議ヘッダー（クリックで「他決分析」までの全体を開閉） */}
          <Box sx={{ mt: 0.5, pt: 0.5, bgcolor: '#f3e5f5', borderRadius: 1, px: 0.5, pb: 0.5 }}>
            <ListItemButton
              onClick={() => setSalesMeetingSectionExpanded((prev) => !prev)}
              sx={{
                py: 1,
                borderRadius: 1,
                '&:hover': { backgroundColor: '#e1bee7' },
              }}
            >
              <ListItemText
                primary="営業会議"
                primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold', color: '#6a1b9a' }}
                sx={{ flex: 1, minWidth: 0 }}
              />
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(SALES_MEETING_SPREADSHEET_URL, '_blank', 'noopener,noreferrer');
                }}
                sx={{ p: 0.25, mr: 0.25 }}
              >
                <OpenInNewIcon sx={{ fontSize: '1rem', color: '#8e24aa' }} />
              </IconButton>
              {salesMeetingSectionExpanded ? (
                <ExpandLess sx={{ color: '#8e24aa' }} />
              ) : (
                <ExpandMore sx={{ color: '#8e24aa' }} />
              )}
            </ListItemButton>
          </Box>

          <Collapse in={salesMeetingSectionExpanded}>
          {/* 営業会議グループ（紫背景・クリックでスプレッドシートへ） */}
          <Box sx={{ mt: 0.5, pt: 0.5, bgcolor: '#f3e5f5', borderRadius: 1, px: 0.5, pb: 0.5 }}>
            <ListItemButton
              onClick={() => window.open(SALES_MEETING_CHAT_URL, '_blank', 'noopener,noreferrer')}
              sx={{
                py: 1,
                pl: 3,
                borderRadius: 1,
                '&:hover': { backgroundColor: '#e1bee7' },
              }}
            >
              <ListItemText
                primary="営業会議Chat"
                primaryTypographyProps={{ variant: 'body2', color: '#6a1b9a' }}
                sx={{ flex: 1, minWidth: 0 }}
              />
              <OpenInNewIcon sx={{ fontSize: '0.9rem', color: '#8e24aa', ml: 0.5 }} />
            </ListItemButton>
            <ListItemButton
              onClick={() => navigate('/shared-items/sales-meeting-agenda')}
              sx={{
                py: 1,
                pl: 3,
                borderRadius: 1,
                '&:hover': { backgroundColor: '#e1bee7' },
              }}
            >
              <ListItemText
                primary="議題"
                primaryTypographyProps={{ variant: 'body2', color: '#6a1b9a' }}
                sx={{ flex: 1, minWidth: 0 }}
              />
            </ListItemButton>
            {locationCategories
              .filter(({ label }) => label === '契約率チーム' || label === '物件数チーム')
              .map(({ label, count }) => (
              <ListItemButton
                key={label}
                selected={selectedLocation === label && !selectedUnconfirmedStaff}
                onClick={() => { setSelectedLocation(label); setSelectedUnconfirmedStaff(null); setPage(0); }}
                sx={{
                  py: 1,
                  pl: 3,
                  borderLeft: '4px solid #8e24aa',
                  '&.Mui-selected': {
                    backgroundColor: '#8e24aa15',
                  },
                  '&:hover': {
                    backgroundColor: '#8e24aa10',
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
                    '& .MuiBadge-badge': { backgroundColor: '#8e24aa', color: '#fff' }
                  }}
                  max={9999}
                />
              </ListItemButton>
            ))}
          </Box>

          {/* 営業_資料グループ（緑背景・クリックでGoogle Driveへ） */}
          <Box sx={{ mt: 0.5, pt: 0.5, bgcolor: '#e8f5e9', borderRadius: 1, px: 0.5, pb: salesMaterialsExpanded ? 0.5 : 0 }}>
            <ListItemButton
              onClick={() => setSalesMaterialsExpanded((prev) => !prev)}
              sx={{
                py: 1,
                borderRadius: 1,
                '&:hover': { backgroundColor: '#c8e6c9' },
              }}
            >
              <ListItemText
                primary="営業_資料"
                primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold', color: '#2e7d32' }}
                sx={{ flex: 1, minWidth: 0 }}
              />
              {salesMaterialsExpanded ? (
                <ExpandLess sx={{ color: '#2e7d32' }} />
              ) : (
                <ExpandMore sx={{ color: '#2e7d32' }} />
              )}
            </ListItemButton>
            <Collapse in={salesMaterialsExpanded}>
              {SALES_MATERIALS_LINKS.map(({ label, url }) => (
                <ListItemButton
                  key={label}
                  disabled={!url}
                  onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
                  sx={{
                    py: 1,
                    pl: 3,
                    borderRadius: 1,
                    '&:hover': { backgroundColor: '#c8e6c9' },
                  }}
                >
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{ variant: 'body2', color: url ? '#2e7d32' : 'text.disabled' }}
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                  {url ? (
                    <OpenInNewIcon sx={{ fontSize: '0.9rem', color: '#43a047', ml: 0.5 }} />
                  ) : (
                    <Typography variant="caption" color="text.disabled">未設定</Typography>
                  )}
                </ListItemButton>
              ))}
            </Collapse>
          </Box>

          {/* 【専任媒介】月別分析セクション（2026年5月以降） */}
          {(() => {
            const allMonths = new Map<string, { label: string; yearMonth: string; entries: { assignee: string; count: number; sellerIds: string[] }[] }>();
            Object.entries(exclusiveMonthlySummary).forEach(([assignee, months]) => {
              months.forEach(({ yearMonth, label, count, sellerIds }) => {
                if (!allMonths.has(yearMonth)) {
                  allMonths.set(yearMonth, { label, yearMonth, entries: [] });
                }
                allMonths.get(yearMonth)!.entries.push({ assignee, count, sellerIds });
              });
            });

            if (allMonths.size === 0) return null;

            const sortedMonths = Array.from(allMonths.values()).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));

            return (
              <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'orange', bgcolor: '#fff8f0', borderRadius: 1, px: 0.5 }}>
                <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', color: '#e65100', fontWeight: 'bold', fontSize: '0.75rem' }}>
                  ── 専任媒介 取得分析 ──
                </Typography>
                {sortedMonths.map(({ yearMonth, label, entries }) => {
                  const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
                  const isExpanded = exclusiveExpandedMonth === yearMonth;
                  return (
                    <Box key={yearMonth}>
                      <Button
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation();
                          setExclusiveExpandedMonth(isExpanded ? null : yearMonth);
                        }}
                        sx={{
                          justifyContent: 'space-between',
                          textAlign: 'left',
                          fontSize: '0.85rem',
                          py: 1,
                          px: 1.5,
                          color: isExpanded ? 'white' : '#e65100',
                          bgcolor: isExpanded ? '#ff6d00' : 'transparent',
                          borderRadius: isExpanded ? '4px 4px 0 0' : 1,
                          '&:hover': { bgcolor: isExpanded ? '#ff6d00' : '#fff3e0' },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>【専任媒介】{label}</span>
                          <Chip
                            label={totalCount}
                            size="small"
                            sx={{
                              height: 20, fontSize: '0.7rem',
                              bgcolor: isExpanded ? 'rgba(255,255,255,0.3)' : '#fff3e0',
                              color: isExpanded ? 'white' : '#e65100',
                              fontWeight: 'bold',
                            }}
                          />
                        </Box>
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </Button>
                      <Collapse in={isExpanded}>
                        <Box sx={{ bgcolor: '#fff8f0', border: 1, borderColor: '#ffb74d', borderTop: 0, borderRadius: '0 0 4px 4px' }}>
                          {(() => {
                            // 「次へ」ナビゲーション用：この月の担当者を上から順番につないだキュー
                            const queueStr = entries.map(e => `${e.sellerIds[0]}:${e.assignee}`).join('|');
                            return entries.map(({ assignee, count, sellerIds }, idx) => (
                            <Button
                              key={assignee}
                              fullWidth
                              onClick={() => {
                                if (sellerIds.length > 0) {
                                  window.open(`/sellers/${sellerIds[0]}/exclusive-analysis?from=shared-items&queue=${encodeURIComponent(queueStr)}&qi=${idx}`, '_blank', 'noopener,noreferrer');
                                }
                              }}
                              sx={{
                                justifyContent: 'space-between',
                                textAlign: 'left',
                                fontSize: '0.82rem',
                                py: 0.75,
                                pl: 3,
                                pr: 1.5,
                                color: '#bf360c',
                                '&:hover': { bgcolor: '#ffe0b2' },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>📊 {assignee}（{count}件）</span>
                              </Box>
                              <Chip
                                label="分析"
                                size="small"
                                sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#ff6d00', color: 'white' }}
                              />
                            </Button>
                            ));
                          })()}
                        </Box>
                      </Collapse>
                    </Box>
                  );
                })}
              </Box>
            );
          })()}

          {/* 【他決】月別分析セクション（2026年5月以降） */}
          {(() => {
            const allMonths = new Map<string, { label: string; yearMonth: string; entries: { assignee: string; count: number; sellerIds: string[] }[] }>();
            Object.entries(otherDecisionMonthlySummary).forEach(([assignee, months]) => {
              months.forEach(({ yearMonth, label, count, sellerIds }) => {
                if (!allMonths.has(yearMonth)) {
                  allMonths.set(yearMonth, { label, yearMonth, entries: [] });
                }
                allMonths.get(yearMonth)!.entries.push({ assignee, count, sellerIds });
              });
            });

            if (allMonths.size === 0) return null;

            const sortedMonths = Array.from(allMonths.values()).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));

            return (
              <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: '#ef9a9a', bgcolor: '#fff5f5', borderRadius: 1, px: 0.5 }}>
                <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', color: '#c62828', fontWeight: 'bold', fontSize: '0.75rem' }}>
                  ── 他決 分析 ──
                </Typography>
                {sortedMonths.map(({ yearMonth, label, entries }) => {
                  const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
                  const isExpanded = otherDecisionExpandedMonth === yearMonth;
                  return (
                    <Box key={yearMonth}>
                      <Button
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation();
                          setOtherDecisionExpandedMonth(isExpanded ? null : yearMonth);
                        }}
                        sx={{
                          justifyContent: 'space-between',
                          textAlign: 'left',
                          fontSize: '0.85rem',
                          py: 1,
                          px: 1.5,
                          color: isExpanded ? 'white' : '#c62828',
                          bgcolor: isExpanded ? '#e53935' : 'transparent',
                          borderRadius: isExpanded ? '4px 4px 0 0' : 1,
                          '&:hover': { bgcolor: isExpanded ? '#e53935' : '#ffebee' },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>【他決】{label}</span>
                          <Chip
                            label={totalCount}
                            size="small"
                            sx={{
                              height: 20, fontSize: '0.7rem',
                              bgcolor: isExpanded ? 'rgba(255,255,255,0.3)' : '#ffebee',
                              color: isExpanded ? 'white' : '#c62828',
                              fontWeight: 'bold',
                            }}
                          />
                        </Box>
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </Button>
                      <Collapse in={isExpanded}>
                        <Box sx={{ bgcolor: '#fff5f5', border: 1, borderColor: '#ef9a9a', borderTop: 0, borderRadius: '0 0 4px 4px' }}>
                          {(() => {
                            // 「次へ」ナビゲーション用：この月の担当者を上から順番につないだキュー
                            const queueStr = entries.map(e => `${e.sellerIds[0]}:${e.assignee}`).join('|');
                            return entries.map(({ assignee, count, sellerIds }, idx) => (
                            <Button
                              key={assignee}
                              fullWidth
                              onClick={() => {
                                if (sellerIds.length > 0) {
                                  window.open(`/sellers/${sellerIds[0]}/other-decision-analysis?from=shared-items&queue=${encodeURIComponent(queueStr)}&qi=${idx}`, '_blank', 'noopener,noreferrer');
                                }
                              }}
                              sx={{
                                justifyContent: 'space-between',
                                textAlign: 'left',
                                fontSize: '0.82rem',
                                py: 0.75,
                                pl: 3,
                                pr: 1.5,
                                color: '#b71c1c',
                                '&:hover': { bgcolor: '#ffcdd2' },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>📉 {assignee}（{count}件）</span>
                              </Box>
                              <Chip
                                label="分析"
                                size="small"
                                sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#e53935', color: 'white' }}
                              />
                            </Button>
                            ));
                          })()}
                        </Box>
                      </Collapse>
                    </Box>
                  );
                })}
              </Box>
            );
          })()}
          </Collapse>

          {/* 事務会議セクション（展開式・ランキング表示付き） */}
          <Box sx={{ mt: 0.5, pt: 0.5, bgcolor: '#e3f2fd', borderRadius: 1, px: 0.5, pb: 0.5 }}>
            <ListItemButton
              onClick={() => setBusinessMeetingSectionExpanded((prev) => !prev)}
              sx={{
                py: 1,
                borderRadius: 1,
                '&:hover': { backgroundColor: '#bbdefb' },
              }}
            >
              <ListItemText
                primary="事務会議"
                primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold', color: '#1565c0' }}
                sx={{ flex: 1, minWidth: 0 }}
              />
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open('https://docs.google.com/spreadsheets/d/1Lzv0q8JS1FsDpWaiQiHfNUo2DP2irSvdyNzVCszBz9o/edit?gid=1131908438#gid=1131908438', '_blank', 'noopener,noreferrer');
                }}
                sx={{ p: 0.25, mr: 0.25 }}
              >
                <OpenInNewIcon sx={{ fontSize: '1rem', color: '#1565c0' }} />
              </IconButton>
              <Badge
                badgeContent={locationCategories.find(({ label }) => label === '事務会議')?.count || 0}
                sx={{
                  ml: 1,
                  '& .MuiBadge-badge': { backgroundColor: '#1565c0', color: '#fff' }
                }}
                max={9999}
              />
              {businessMeetingSectionExpanded ? (
                <ExpandLess sx={{ color: '#1565c0', ml: 0.5 }} />
              ) : (
                <ExpandMore sx={{ color: '#1565c0', ml: 0.5 }} />
              )}
            </ListItemButton>
            <Collapse in={businessMeetingSectionExpanded}>
              {/* 事務会議の共有データ表示 */}
              <ListItemButton
                selected={selectedLocation === '事務会議' && !selectedUnconfirmedStaff}
                onClick={() => { setSelectedLocation('事務会議'); setSelectedUnconfirmedStaff(null); setPage(0); }}
                sx={{
                  py: 0.75,
                  pl: 3,
                  borderRadius: 1,
                  borderLeft: '4px solid #1565c0',
                  '&.Mui-selected': { backgroundColor: '#1565c015' },
                  '&:hover': { backgroundColor: '#bbdefb' },
                }}
              >
                <ListItemText
                  primary="共有データ一覧"
                  primaryTypographyProps={{ variant: 'body2', color: '#1565c0' }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
              </ListItemButton>
              {/* 経理スプレッドシートリンク */}
              <ListItemButton
                onClick={() => window.open('https://docs.google.com/spreadsheets/d/1M9uVzHWD2ipzoY5Om3h3a2-_uQa9D_UGhpB5U4_nyRc/edit?gid=1071753477#gid=1071753477', '_blank', 'noopener,noreferrer')}
                sx={{ py: 0.75, pl: 3, borderRadius: 1, '&:hover': { backgroundColor: '#bbdefb' } }}
              >
                <ListItemText
                  primary="経理"
                  primaryTypographyProps={{ variant: 'body2', fontSize: '0.8rem', color: '#1565c0' }}
                />
                <OpenInNewIcon sx={{ fontSize: '0.9rem', color: '#1565c0', ml: 0.5 }} />
              </ListItemButton>
              {/* ランキング表示ボタン */}
              <Box sx={{ px: 1, pt: 1, pb: 0.5 }}>
                <Typography variant="caption" sx={{ px: 0.5, color: '#1565c0', fontWeight: 'bold' }}>
                  🏆 売主ランキング
                </Typography>
              </Box>
              <ListItemButton
                onClick={() => setVisitRankingDialogOpen(true)}
                sx={{ py: 0.75, pl: 3, borderRadius: 1, '&:hover': { backgroundColor: '#bbdefb' } }}
              >
                <ListItemText
                  primary="訪問予約者月間ランキング"
                  primaryTypographyProps={{ variant: 'body2', fontSize: '0.8rem', color: '#1565c0' }}
                />
              </ListItemButton>
              <ListItemButton
                onClick={() => setVisitRankingYearlyDialogOpen(true)}
                sx={{ py: 0.75, pl: 3, borderRadius: 1, '&:hover': { backgroundColor: '#bbdefb' } }}
              >
                <ListItemText
                  primary="訪問予約者年間ランキング"
                  primaryTypographyProps={{ variant: 'body2', fontSize: '0.8rem', color: '#1565c0' }}
                />
              </ListItemButton>
              <ListItemButton
                onClick={() => setCallTrackingRankingDialogOpen(true)}
                sx={{ py: 0.75, pl: 3, borderRadius: 1, '&:hover': { backgroundColor: '#bbdefb' } }}
              >
                <ListItemText
                  primary="追客電話月間ランキング"
                  primaryTypographyProps={{ variant: 'body2', fontSize: '0.8rem', color: '#1565c0' }}
                />
              </ListItemButton>
              <ListItemButton
                onClick={() => setCallRankingDialogOpen(true)}
                sx={{ py: 0.75, pl: 3, borderRadius: 1, '&:hover': { backgroundColor: '#bbdefb' } }}
              >
                <ListItemText
                  primary="1番電話月間ランキング"
                  primaryTypographyProps={{ variant: 'body2', fontSize: '0.8rem', color: '#1565c0' }}
                />
              </ListItemButton>
              <ListItemButton
                onClick={() => setCallRankingYearlyDialogOpen(true)}
                sx={{ py: 0.75, pl: 3, borderRadius: 1, '&:hover': { backgroundColor: '#bbdefb' } }}
              >
                <ListItemText
                  primary="1番電話年間累計ランキング"
                  primaryTypographyProps={{ variant: 'body2', fontSize: '0.8rem', color: '#1565c0' }}
                />
              </ListItemButton>
              {/* 買主電話ランキング */}
              <Box sx={{ px: 1, pt: 1, pb: 0.5 }}>
                <Typography variant="caption" sx={{ px: 0.5, color: '#2e7d32', fontWeight: 'bold' }}>
                  🏆 買主ランキング
                </Typography>
              </Box>
              <ListItemButton
                onClick={() => setBuyerCallRankingDialogOpen(true)}
                sx={{ py: 0.75, pl: 3, borderRadius: 1, '&:hover': { backgroundColor: '#bbdefb' } }}
              >
                <ListItemText
                  primary="買主 月間電話ランキング"
                  primaryTypographyProps={{ variant: 'body2', fontSize: '0.8rem', color: '#2e7d32' }}
                />
              </ListItemButton>
              <ListItemButton
                onClick={() => setBuyerCallRankingYearlyDialogOpen(true)}
                sx={{ py: 0.75, pl: 3, borderRadius: 1, '&:hover': { backgroundColor: '#bbdefb' } }}
              >
                <ListItemText
                  primary="買主 年間電話ランキング"
                  primaryTypographyProps={{ variant: 'body2', fontSize: '0.8rem', color: '#2e7d32' }}
                />
              </ListItemButton>
            </Collapse>
          </Box>

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
                <TableCell sx={{ whiteSpace: 'nowrap', width: 40 }}></TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>ID</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>作業中</TableCell>
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
                  <TableCell colSpan={14} align="center">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : fetchError ? (
                <TableRow>
                  <TableCell colSpan={14} align="center">
                    <Typography color="error" variant="body2" sx={{ mb: 1 }}>{fetchError}</Typography>
                    <Button size="small" variant="outlined" onClick={() => fetchAllSharedItems(true)}>
                      再読み込み
                    </Button>
                  </TableCell>
                </TableRow>
              ) : paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} align="center">
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
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => handleDeleteClick(e, item)}
                        sx={{ '&:hover': { bgcolor: '#ffebee' } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold" sx={{ color: sharedItemsColor.main }}>
                        {item.id || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <PresenceChips presenceState={presenceState} itemKey={item.id} emptyPlaceholder="-" />
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

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>共有データの削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            以下のデータを削除しますか？この操作は元に戻せません。
          </DialogContentText>
          {deleteTargetItem && (
            <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="body2"><strong>ID:</strong> {deleteTargetItem.id}</Typography>
              <Typography variant="body2"><strong>タイトル:</strong> {deleteTargetItem['タイトル'] || '-'}</Typography>
              <Typography variant="body2"><strong>入力者:</strong> {deleteTargetItem['入力者'] || '-'}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            キャンセル
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? '削除中...' : '削除する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 訪問予約者月間ランキングダイアログ */}
      <Dialog open={visitRankingDialogOpen} onClose={() => setVisitRankingDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          🏆 訪問予約者月間ランキング
        </DialogTitle>
        <DialogContent>
          <CallRankingDisplay
            key={visitRankingDialogOpen ? 'open' : 'closed'}
            title="訪問予約者月間ランキング"
            endpoint="/api/sellers/visit-ranking"
            showAcquisitionRate={true}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVisitRankingDialogOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 訪問予約者年間ランキングダイアログ */}
      <Dialog open={visitRankingYearlyDialogOpen} onClose={() => setVisitRankingYearlyDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          🏆 訪問予約者年間ランキング
        </DialogTitle>
        <DialogContent>
          <CallRankingDisplay
            key={visitRankingYearlyDialogOpen ? 'open' : 'closed'}
            title="訪問予約者年間ランキング"
            endpoint="/api/sellers/visit-ranking-yearly"
            yearlyMode={true}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVisitRankingYearlyDialogOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 追客電話月間ランキングダイアログ */}
      <Dialog open={callTrackingRankingDialogOpen} onClose={() => setCallTrackingRankingDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          🏆 追客電話月間ランキング
        </DialogTitle>
        <DialogContent>
          <CallRankingDisplay
            key={callTrackingRankingDialogOpen ? 'open' : 'closed'}
            title="追客電話月間ランキング"
            endpoint="/api/sellers/call-tracking-ranking"
            showMonthSelector={true}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCallTrackingRankingDialogOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 1番電話月間ランキングダイアログ */}
      <Dialog open={callRankingDialogOpen} onClose={() => setCallRankingDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          🏆 1番電話月間ランキング
        </DialogTitle>
        <DialogContent>
          <CallRankingDisplay
            key={callRankingDialogOpen ? 'open' : 'closed'}
            showMonthSelector={true}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCallRankingDialogOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 1番電話年間累計ランキングダイアログ */}
      <Dialog open={callRankingYearlyDialogOpen} onClose={() => setCallRankingYearlyDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          🏆 1番電話年間累計ランキング
        </DialogTitle>
        <DialogContent>
          <CallRankingDisplay
            key={callRankingYearlyDialogOpen ? 'open' : 'closed'}
            title="1番電話年間累計ランキング"
            endpoint="/api/sellers/call-ranking-yearly"
            yearlyMode={true}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCallRankingYearlyDialogOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 買主月間電話ランキングダイアログ */}
      <Dialog open={buyerCallRankingDialogOpen} onClose={() => setBuyerCallRankingDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          🏆 買主 月間電話ランキング
        </DialogTitle>
        <DialogContent>
          <CallRankingDisplay
            key={buyerCallRankingDialogOpen ? 'open' : 'closed'}
            title="月間電話ランキング"
            endpoint="/api/buyers/call-ranking"
            showMonthSelector={true}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuyerCallRankingDialogOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 買主年間電話ランキングダイアログ */}
      <Dialog open={buyerCallRankingYearlyDialogOpen} onClose={() => setBuyerCallRankingYearlyDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          🏆 買主 年間電話ランキング
        </DialogTitle>
        <DialogContent>
          <CallRankingDisplay
            key={buyerCallRankingYearlyDialogOpen ? 'open' : 'closed'}
            title="年間電話ランキング"
            endpoint="/api/buyers/call-ranking-yearly"
            yearlyMode={true}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuyerCallRankingYearlyDialogOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
