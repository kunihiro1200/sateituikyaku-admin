import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  InputAdornment,
  MenuItem,
  IconButton,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { pageDataCache, CACHE_KEYS, sellerDetailCacheKey } from '../store/pageDataCache';
import {
  StatusCategory,
  filterSellersByCategory,
  getUniqueAssignees,
} from '../utils/sellerStatusFilters';
import { formatInquiryDate } from '../utils/inquiryDateFormatter';
import PageNavigation from '../components/PageNavigation';
import { SyncNotification, SyncNotificationData } from '../components/SyncNotification';
import { useAutoSync } from '../hooks/useAutoSync';
import { useSellerStatus } from '../hooks/useSellerStatus';
import { useSellerPresenceSubscribe, formatPresenceLabel } from '../hooks/useSellerPresence';
import SellerStatusBadges from '../components/SellerStatusBadges';
import SellerStatusSidebar from '../components/SellerStatusSidebar';
import { SECTION_COLORS } from '../theme/sectionColors';
import { formatCurrentStatusDetailed } from '../utils/propertyStatusFormatter';

interface Seller {
  id: string;
  sellerNumber?: string;
  name: string;
  address: string;
  phoneNumber: string;
  email?: string;
  status: string;
  confidence?: string;
  nextCallDate?: string;
  createdAt: string;
  lastCallDate?: string;
  inquirySource?: string;
  inquiryDate?: string;
  inquiryDetailedDatetime?: string;
  inquiryYear?: number;
  inquirySite?: string;
  site?: string;
  confidenceLevel?: string;
  firstCallerInitials?: string;
  isUnreachable?: boolean;
  propertyAddress?: string;
  propertyType?: string;
  valuationAmount1?: number;
  visitAssignee?: string;
  visitAssigneeInitials?: string;
  currentStatus?: string;
  phoneContactPerson?: string;
  lastCalledAt?: string;
}

const statusLabels: Record<string, string> = {
  following_up: '追客中',
  appointment_scheduled: '訪問査定予定',
  visited: '訪問済み',
  contracted: '契約済み',
  lost: '失注',
};

const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning'> = {
  following_up: 'warning',
  appointment_scheduled: 'secondary',
  visited: 'default',
  contracted: 'success',
  lost: 'error',
};

// スプレッドシートから同期された日本語の状況値の色を判定
const getStatusColor = (status: string | null | undefined): 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' => {
  // nullまたはundefinedの場合はデフォルトを返す
  if (!status) {
    return 'default';
  }
  
  // 既存のenumベースの色があればそれを使用
  if (statusColors[status]) {
    return statusColors[status];
  }
  
  // 日本語の値の場合、キーワードで判定
  if (status.includes('専任') || status.includes('一般媒介')) return 'success';
  if (status.includes('他決')) return 'warning';
  if (status.includes('追客')) return 'error';
  if (status.includes('訪問')) return 'secondary';
  if (status.includes('失注')) return 'error';
  if (status.includes('契約')) return 'success';
  
  return 'default';
};

/**
 * 売主ステータスセルコンポーネント
 * useSellerStatusフックを使用してステータスを計算し、バッジで表示
 */
function SellerStatusCell({ seller }: { seller: any }) {
  const statuses = useSellerStatus(seller);
  return <SellerStatusBadges statuses={statuses} size="small" />;
}

export default function SellersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [sellers, setSellers] = useState<Seller[]>([]);
  // キャッシュがあれば初期ローディングをスキップ（コールドスタート対策）
  const _defaultCacheKey = `${CACHE_KEYS.SELLERS_LIST}:${JSON.stringify({ page: 1, pageSize: 50, sortBy: 'inquiry_date', sortOrder: 'desc' })}`;
  const [loading, setLoading] = useState(!pageDataCache.get(_defaultCacheKey));
  
  // サイドバー用のカテゴリカウント（APIから直接取得）
  const [sidebarCounts, setSidebarCounts] = useState<{
    todayCall: number;
    todayCallWithInfo: number;
    todayCallAssigned: number;
    visitDayBefore: number;
    visitCompleted: number;
    unvaluated: number;
    mailingPending: number;
    todayCallNotStarted: number;
    pinrichEmpty: number;
    visitAssignedCounts?: Record<string, number>;
    todayCallAssignedCounts?: Record<string, number>;
    todayCallWithInfoLabels?: string[];
    todayCallWithInfoLabelCounts?: Record<string, number>;
  }>({
    todayCall: 0,
    todayCallWithInfo: 0,
    todayCallAssigned: 0,
    visitDayBefore: 0,
    visitCompleted: 0,
    unvaluated: 0,
    mailingPending: 0,
    todayCallNotStarted: 0,
    pinrichEmpty: 0,
    visitAssignedCounts: {},
    todayCallAssignedCounts: {},
    todayCallWithInfoLabels: [],
    todayCallWithInfoLabelCounts: {},
  });
  const [sidebarLoading, setSidebarLoading] = useState(!pageDataCache.get(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS));
  // 担当者イニシャル一覧（スタッフスプレッドシートから取得）
  const [assigneeInitials, setAssigneeInitials] = useState<string[]>([]);  
  // ページ状態をsessionStorageから復元
  const [page, setPage] = useState(() => {
    const saved = sessionStorage.getItem('sellersPage');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = sessionStorage.getItem('sellersRowsPerPage');
    return saved ? parseInt(saved, 10) : 50;
  });
  
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Phase 1 filters
  const [confidenceLevelFilter, setConfidenceLevelFilter] = useState('');
  const [inquirySiteFilter, setInquirySiteFilter] = useState('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('');
  const [statusFilterValue, setStatusFilterValue] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Status category filter
  const [selectedCategory, setSelectedCategory] = useState<StatusCategory>(() => {
    // 通話モードページから戻ってきた場合、sessionStorageからカテゴリを復元
    const savedCategory = sessionStorage.getItem('selectedStatusCategory');
    if (savedCategory) {
      sessionStorage.removeItem('selectedStatusCategory'); // 一度使ったら削除
      return savedCategory as StatusCategory;
    }
    return 'all';
  });

  // サイドバー展開時の全件データ（カテゴリ展開時にAPIから取得）
  const [expandedCategorySellers, setExpandedCategorySellers] = useState<Record<string, any[]>>({});
  const [expandedCategoryLoading, setExpandedCategoryLoading] = useState<Record<string, boolean>>({});

  // 自動同期の通知データ
  const [syncNotificationData, setSyncNotificationData] = useState<SyncNotificationData | null>(null);
  const [syncError, setSyncError] = useState<{ message: string; recoverable: boolean } | null>(null);

  // ページ状態が変更されたらsessionStorageに保存
  useEffect(() => {
    sessionStorage.setItem('sellersPage', page.toString());
  }, [page]);

  useEffect(() => {
    sessionStorage.setItem('sellersRowsPerPage', rowsPerPage.toString());
  }, [rowsPerPage]);

  // スクロール位置を復元（売主IDベース）
  useEffect(() => {
    const selectedSellerId = sessionStorage.getItem('selectedSellerId');
    if (selectedSellerId && sellers.length > 0) {
      setTimeout(() => {
        // 売主IDに対応する行を探す
        const targetRow = document.querySelector(`[data-seller-id="${selectedSellerId}"]`);
        if (targetRow) {
          // 行の位置を取得して、少し上にオフセットしてスクロール
          const rowPosition = targetRow.getBoundingClientRect().top + window.scrollY;
          const offset = 100; // ヘッダー分のオフセット
          window.scrollTo({
            top: rowPosition - offset,
            behavior: 'smooth'
          });
        } else {
          // 行が見つからない場合は、保存されたスクロール位置を使用
          const savedScrollPosition = sessionStorage.getItem('sellersScrollPosition');
          if (savedScrollPosition) {
            window.scrollTo(0, parseInt(savedScrollPosition, 10));
          }
        }
        // クリーンアップ
        sessionStorage.removeItem('selectedSellerId');
        sessionStorage.removeItem('sellersScrollPosition');
      }, 100);
    }
  }, [sellers]);

  // 自動同期フックを使用
  const { isSyncing } = useAutoSync({
    thresholdMinutes: 5,
    enabled: true,
    onSyncComplete: (result) => {
      // データが更新された場合、通知を表示してリストを再取得
      if (result.hasChanges) {
        setSyncNotificationData({
          recordsAdded: result.recordsAdded,
          recordsUpdated: result.recordsUpdated,
          recordsDeleted: result.recordsDeleted,
          hasChanges: true,
        });
        // 売主リストキャッシュを無効化してから再取得
        pageDataCache.invalidate(CACHE_KEYS.SELLERS_LIST);
        fetchSellers();
        fetchSidebarCounts(true); // サイドバーカウントも更新（キャッシュ無効化）
      }
    },
    onSyncError: (error) => {
      console.error('Auto sync error:', error);
    },
  });

  // プレゼンス購読（他のユーザーがどの売主ページを開いているかをリアルタイム取得）
  const { presenceState } = useSellerPresenceSubscribe();

  // カテゴリ別の売主数をカウント（APIから取得したカウントを使用）
  // useMemoで最適化：sidebarCountsまたはtotalが変更された時のみ再計算
  const categoryCounts = useMemo(() => {
    console.log('[SellersPage] categoryCounts recalculated');
    return {
      ...sidebarCounts,
      all: total, // ページネーション前の全体件数を使用
    };
  }, [sidebarCounts, total]);

  // カテゴリ選択ハンドラー（useCallbackで最適化）
  const handleCategorySelect = useCallback((category: StatusCategory) => {
    setSelectedCategory(category);
    setPage(0); // カテゴリが変わったらページを0にリセット
  }, []);

  // カテゴリ展開ハンドラー（useCallbackで最適化）
  const handleCategoryExpand = useCallback((category: string) => {
    fetchExpandedCategorySellers(category);
  }, [expandedCategoryLoading]);

  // サイドバー用のカテゴリカウントを取得（APIから直接取得、キャッシュ付き）
  const fetchSidebarCounts = async (forceRefresh = false) => {
    console.log('[SellersPage] fetchSidebarCounts called, forceRefresh:', forceRefresh);
    // キャッシュが有効な場合はキャッシュを使用
    if (!forceRefresh) {
      const cached = pageDataCache.get(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS);
      if (cached) {
        console.log('[SellersPage] Using cached sidebar counts');
        setSidebarCounts(cached as any);
        setSidebarLoading(false);
        return;
      }
    }
    try {
      console.log('[SellersPage] Fetching sidebar counts from API');
      setSidebarLoading(true);
      const response = await api.get('/api/sellers/sidebar-counts');
      console.log('[SellersPage] Sidebar counts fetched:', response.data);
      setSidebarCounts(response.data);
      pageDataCache.set(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS, response.data, 15 * 60 * 1000);
    } catch (error) {
      console.error('Failed to fetch sidebar counts:', error);
      // エラー時はカウントを0にリセット
      setSidebarCounts({
        todayCall: 0,
        todayCallWithInfo: 0,
        todayCallAssigned: 0,
        visitDayBefore: 0,
        visitCompleted: 0,
        unvaluated: 0,
        mailingPending: 0,
        todayCallNotStarted: 0,
        pinrichEmpty: 0,
      });
    } finally {
      setSidebarLoading(false);
    }
  };

  // 担当者イニシャル一覧を取得（DBから直接取得、キャッシュ付き）
  const fetchAssigneeInitials = async () => {
    // キャッシュが有効な場合はキャッシュを使用
    const cached = pageDataCache.get<string[]>(CACHE_KEYS.SELLERS_ASSIGNEE_INITIALS);
    if (cached) {
      setAssigneeInitials(cached);
      return;
    }
    try {
      const response = await api.get('/api/sellers/assignee-initials');
      const initials = response.data.initials || [];
      setAssigneeInitials(initials);
      pageDataCache.set(CACHE_KEYS.SELLERS_ASSIGNEE_INITIALS, initials, 10 * 60 * 1000);
    } catch (error: any) {
      console.error('[fetchAssigneeInitials] Failed:', error?.response?.status, error?.response?.data || error?.message);
    }
  };

  // カテゴリ展開時に全件データを取得（カウントと展開リストのずれを解消）
  const fetchExpandedCategorySellers = async (category: string) => {
    // ローディング中は重複リクエストしない
    if (expandedCategoryLoading[category]) return;

    // キャッシュがあればそれを使用（空配列は除く：カウントと不一致の場合に再取得できるよう）
    const cacheKey = `sidebar_expanded:${category}`;
    const cached = pageDataCache.get<any[]>(cacheKey);
    if (cached && cached.length > 0) {
      setExpandedCategorySellers(prev => ({ ...prev, [category]: cached }));
      return;
    }

    setExpandedCategoryLoading(prev => ({ ...prev, [category]: true }));
    try {
      const params: any = { page: 1, pageSize: 9999, sortBy: 'inquiry_date', sortOrder: 'desc' };
      // visitAssigned:Y / todayCallAssigned:Y 形式のカテゴリはそのまま渡す
      params.statusCategory = category;
      const response = await api.get('/api/sellers', { params });
      const data = response.data.data || [];
      setExpandedCategorySellers(prev => ({ ...prev, [category]: data }));
      // 5分キャッシュ（1件以上の場合のみキャッシュ）
      if (data.length > 0) {
        pageDataCache.set(cacheKey, data, 15 * 60 * 1000);
      }
    } catch (error) {
      console.error('Failed to fetch expanded category sellers:', error);
      setExpandedCategorySellers(prev => ({ ...prev, [category]: [] }));
    } finally {
      setExpandedCategoryLoading(prev => ({ ...prev, [category]: false }));
    }
  };

  // 初回ロード時とキャッシュ無効化時にサイドバーカウントを即座に取得
  useEffect(() => {
    console.log('[SellersPage] Component mounted or cache invalidated');
    const cached = pageDataCache.get(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS);
    if (!cached) {
      console.log('[SellersPage] No cache found, fetching sidebar counts immediately');
      fetchSidebarCounts(true);
    } else {
      console.log('[SellersPage] Using cached sidebar counts');
      setSidebarCounts(cached as any);
    }
    fetchAssigneeInitials();
  }, []);

  // ページに戻ってきた時にサイドバーカウントを再取得（キャッシュが無効化されている場合）
  useEffect(() => {
    // /sellers ページに戻ってきたときのみ実行
    if (location.pathname === '/' || location.pathname === '/sellers') {
      const cached = pageDataCache.get(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS);
      if (!cached) {
        console.log('[SellersPage] Returned to sellers page, cache invalidated, fetching sidebar counts immediately');
        fetchSidebarCounts(true);
      }
    }
  }, [location.pathname]);

  // ウィンドウフォーカス時にもチェック（タブ切り替え時など）
  useEffect(() => {
    const handleFocus = () => {
      // キャッシュが無効化されている場合のみ再取得
      const cached = pageDataCache.get(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS);
      if (!cached) {
        fetchSidebarCounts(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    fetchSellers();
  }, [page, rowsPerPage, confidenceLevelFilter, inquirySiteFilter, propertyTypeFilter, statusFilterValue, selectedCategory]);

  const fetchSellers = async () => {
    try {
      const params: any = {
        page: page + 1,
        pageSize: rowsPerPage,
        sortBy: 'inquiry_date',
        sortOrder: 'desc',
      };
      
      // Add Phase 1 filters
      if (confidenceLevelFilter) {
        params.confidenceLevel = confidenceLevelFilter;
      }
      if (inquirySiteFilter) {
        params.inquirySite = inquirySiteFilter;
      }
      if (propertyTypeFilter) {
        params.propertyType = propertyTypeFilter;
      }
      if (statusFilterValue) {
        params.statusFilter = statusFilterValue;
      }
      
      // サイドバーカテゴリフィルター
      if (selectedCategory && selectedCategory !== 'all') {
        params.statusCategory = selectedCategory;
      }

      // キャッシュキー（パラメータを含む）
      const cacheKey = `${CACHE_KEYS.SELLERS_LIST}:${JSON.stringify(params)}`;

      // キャッシュが有効な場合はローディングなしで即座に表示
      const cached = pageDataCache.get<{ data: Seller[]; total: number }>(cacheKey);
      if (cached) {
        setSellers(cached.data);
        setTotal(cached.total);
        setLoading(false); // キャッシュヒット時はローディングを解除
        // バックグラウンドで最新データを取得してキャッシュを更新
        api.get('/api/sellers', { params }).then((response) => {
          setSellers(response.data.data);
          setTotal(response.data.total);
          pageDataCache.set(cacheKey, { data: response.data.data, total: response.data.total }, 15 * 60 * 1000);
        }).catch((err) => console.error('Background sellers refresh failed:', err));
        return;
      }

      // キャッシュなしの場合のみローディング表示
      setLoading(true);
      const response = await api.get('/api/sellers', { params });
      setSellers(response.data.data);
      setTotal(response.data.total);
      // 15分間キャッシュ（コールドスタート対策）
      pageDataCache.set(cacheKey, { data: response.data.data, total: response.data.total }, 15 * 60 * 1000);
    } catch (error) {
      console.error('Failed to fetch sellers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    // 全角数字を半角に変換
    const normalizedQuery = searchQuery.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    );
    if (!normalizedQuery.trim()) {
      fetchSellers();
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/api/sellers/search', {
        params: { q: normalizedQuery },
      });
      setSellers(response.data);
      setTotal(response.data.length);
    } catch (error) {
      console.error('Failed to search sellers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // バックエンドでフィルタリングするため、sellersをそのまま使用
  const filteredSellers = sellers;

  // 売主番号コピー用の状態
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // 売主番号をクリップボードにコピーする関数
  const handleCopySellerNumber = async (sellerNumber: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 行クリックによるページ遷移を防止
    try {
      await navigator.clipboard.writeText(sellerNumber);
      setSnackbarMessage(`${sellerNumber} をコピーしました`);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('クリップボードへのコピーに失敗しました:', error);
    }
  };

  return (
    <Container maxWidth="xl" sx={isMobile ? { overflowX: 'hidden', px: 1 } : {}}>
      {/* 自動同期通知 */}
      <SyncNotification
        data={syncNotificationData}
        onClose={() => setSyncNotificationData(null)}
        position="top"
      />

      {/* エラー通知 */}
      {syncError && (
        <SyncNotification
          type="error"
          message={syncError.message}
          details={syncError.recoverable ? 'リトライ可能なエラーです。もう一度お試しください。' : undefined}
          onClose={() => setSyncError(null)}
        />
      )}

      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.seller.main }}>
            売主リスト
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant="outlined"
              onClick={async () => {
                if (!window.confirm('スタッフ管理シートからemployeesテーブルに同期しますか？')) return;
                try {
                  const token = localStorage.getItem('session_token');
                  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/staff-sync`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                  });
                  const result = await response.json();
                  if (response.ok) {
                    alert(`同期完了しました。ページをリロードします。`);
                    // 従業員キャッシュをクリア
                    localStorage.removeItem('employees_cache');
                    // ページをリロード
                    window.location.reload();
                  } else {
                    const errorMsg = result.error?.code === 'QUOTA_EXCEEDED' 
                      ? result.error.message 
                      : `同期失敗: ${result.error?.message || 'エラーが発生しました'}`;
                    alert(errorMsg);
                  }
                } catch (error: any) {
                  alert(`エラー: ${error.message}`);
                }
              }}
            >
              スタッフ同期
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/settings')}
            >
              設定
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/sellers/new')}
            >
              新規登録
            </Button>
          </Box>
        </Box>

        {/* ページナビゲーション */}
        <PageNavigation
          onNavigate={(path) => {
            if (path === '/') {
              // 売主リストボタンが押されたらフィルターをリセット
              setSelectedCategory('all');
              setPage(0);
              sessionStorage.removeItem('selectedStatusCategory');
            }
            navigate(path);
          }}
        />

        {/* モバイル：ステータスサイドバーをアコーディオンで表示 */}
        {isMobile && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body1" fontWeight="bold">ステータスフィルター</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1 }}>
              <SellerStatusSidebar
                categoryCounts={categoryCounts}
                selectedCategory={selectedCategory}
                onCategorySelect={handleCategorySelect}
                onCategoryExpand={handleCategoryExpand}
                isCallMode={false}
                sellers={sellers}
                expandedCategorySellers={expandedCategorySellers}
                expandedCategoryLoading={expandedCategoryLoading}
                loading={sidebarLoading}
                assigneeInitials={assigneeInitials}
              />
            </AccordionDetails>
          </Accordion>
        )}

        {/* サイドバーとメインコンテンツのレイアウト */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* 左側サイドバー - デスクトップのみ・カテゴリ未選択時のみ表示 */}
          {!isMobile && selectedCategory === 'all' && (
            <SellerStatusSidebar
              categoryCounts={categoryCounts}
              selectedCategory={selectedCategory}
              onCategorySelect={handleCategorySelect}
              onCategoryExpand={handleCategoryExpand}
              isCallMode={false}
              sellers={sellers}
              expandedCategorySellers={expandedCategorySellers}
              expandedCategoryLoading={expandedCategoryLoading}
              loading={sidebarLoading}
              assigneeInitials={assigneeInitials}
            />
          )}

          {/* メインコンテンツ */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* カテゴリ選択中の場合、上部にカテゴリ名と戻るボタンを表示 */}
            {selectedCategory !== 'all' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSelectedCategory('all');
                    setPage(0);
                  }}
                >
                  ← 全件表示
                </Button>
                <Typography variant="body1" fontWeight="bold">
                  {selectedCategory === 'visitDayBefore' ? '①訪問日前日' :
                   selectedCategory === 'visitCompleted' ? '②訪問済み' :
                   selectedCategory === 'todayCall' ? '③当日TEL分' :
                   selectedCategory === 'todayCallWithInfo' ? '当日TEL（内容）' :
                   selectedCategory === 'unvaluated' ? '⑤未査定' :
                   selectedCategory === 'mailingPending' ? '⑥査定（郵送）' :
                   selectedCategory === 'todayCallNotStarted' ? '⑦当日TEL_未着手' :
                   selectedCategory === 'pinrichEmpty' ? '⑧Pinrich空欄' :
                   selectedCategory === 'exclusive' ? '専任' :
                   selectedCategory === 'general' ? '一般' :
                   selectedCategory === 'visitOtherDecision' ? '訪問後他決' :
                   selectedCategory === 'unvisitedOtherDecision' ? '未訪問他決' :
                   typeof selectedCategory === 'string' && selectedCategory.startsWith('visitAssigned:') ? `担当（${selectedCategory.replace('visitAssigned:', '')}）` :
                   typeof selectedCategory === 'string' && selectedCategory.startsWith('todayCallAssigned:') ? `当日TEL(${selectedCategory.replace('todayCallAssigned:', '')})` :
                   selectedCategory}
                </Typography>
                <Chip label={`${total}件`} size="small" color="primary" />
              </Box>
            )}

        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: showFilters ? 2 : 0 }}>
            <TextField
              sx={isMobile ? { flex: 1 } : { width: '50%' }}
              fullWidth={isMobile}
              placeholder="名前、住所、電話番号、物件住所で検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  // 全角数字を半角に変換してから検索
                  const normalized = searchQuery.replace(/[０-９]/g, (c) =>
                    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
                  );
                  setSearchQuery(normalized);
                  handleSearch();
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {searchQuery && (
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearchQuery('');
                          fetchSellers();
                        }}
                        aria-label="検索をクリア"
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    )}
                    <Button onClick={() => {
                      // 全角数字を半角に変換してから検索
                      const normalized = searchQuery.replace(/[０-９]/g, (c) =>
                        String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
                      );
                      setSearchQuery(normalized);
                      handleSearch();
                    }}>検索</Button>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              フィルタ
            </Button>
          </Box>
          
          {showFilters && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                select
                label="確度"
                value={confidenceLevelFilter}
                onChange={(e) => setConfidenceLevelFilter(e.target.value)}
                sx={{ minWidth: 180 }}
                size="small"
              >
                <MenuItem value="">全て</MenuItem>
                <MenuItem value="A">A（売る気あり）</MenuItem>
                <MenuItem value="B">B（売る気あるがまだ先の話）</MenuItem>
                <MenuItem value="B'">B'（売る気は全く無い）</MenuItem>
                <MenuItem value="C">C（電話が繋がらない）</MenuItem>
                <MenuItem value="D">D（再建築不可）</MenuItem>
                <MenuItem value="E">E（収益物件）</MenuItem>
                <MenuItem value="ダブり">ダブり（重複している）</MenuItem>
              </TextField>
              
              <TextField
                select
                label="サイト"
                value={inquirySiteFilter}
                onChange={(e) => setInquirySiteFilter(e.target.value)}
                sx={{ minWidth: 130 }}
                size="small"
              >
                <MenuItem value="">全て</MenuItem>
                <MenuItem value="ウ">ウ</MenuItem>
                <MenuItem value="ビ">ビ</MenuItem>
                <MenuItem value="H">H</MenuItem>
                <MenuItem value="お">お</MenuItem>
                <MenuItem value="Y">Y</MenuItem>
                <MenuItem value="す">す</MenuItem>
                <MenuItem value="a">a</MenuItem>
                <MenuItem value="L">L</MenuItem>
                <MenuItem value="エ">エ</MenuItem>
                <MenuItem value="近所">近所</MenuItem>
                <MenuItem value="チ">チ</MenuItem>
                <MenuItem value="P">P</MenuItem>
                <MenuItem value="紹">紹</MenuItem>
                <MenuItem value="リ">リ</MenuItem>
                <MenuItem value="買">買</MenuItem>
                <MenuItem value="HP">HP</MenuItem>
                <MenuItem value="知合">知合</MenuItem>
                <MenuItem value="at-homeの掲載を見て">at-homeの掲載を見て</MenuItem>
                <MenuItem value="2件目以降査定">2件目以降査定</MenuItem>
                <MenuItem value="ロープレ">ロープレ</MenuItem>
              </TextField>

              <TextField
                select
                label="種別"
                value={propertyTypeFilter}
                onChange={(e) => setPropertyTypeFilter(e.target.value)}
                sx={{ minWidth: 130 }}
                size="small"
              >
                <MenuItem value="">全て</MenuItem>
                <MenuItem value="土地">土地</MenuItem>
                <MenuItem value="戸建">戸建</MenuItem>
                <MenuItem value="マンション">マンション</MenuItem>
                <MenuItem value="事業用">事業用</MenuItem>
              </TextField>

              <TextField
                select
                label="状況（当社）"
                value={statusFilterValue}
                onChange={(e) => setStatusFilterValue(e.target.value)}
                sx={{ minWidth: 160 }}
                size="small"
              >
                <MenuItem value="">全て</MenuItem>
                <MenuItem value="追客中">追客中</MenuItem>
                <MenuItem value="追客不要(未訪問）">追客不要(未訪問）</MenuItem>
                <MenuItem value="除外済追客不要">除外済追客不要</MenuItem>
                <MenuItem value="除外後追客中">除外後追客中</MenuItem>
                <MenuItem value="専任媒介">専任媒介</MenuItem>
                <MenuItem value="一般媒介">一般媒介</MenuItem>
                <MenuItem value="リースバック（専任）">リースバック（専任）</MenuItem>
                <MenuItem value="他決→追客">他決→追客</MenuItem>
                <MenuItem value="他決→追客不要">他決→追客不要</MenuItem>
                <MenuItem value="他決→専任">他決→専任</MenuItem>
                <MenuItem value="他決→一般">他決→一般</MenuItem>
                <MenuItem value="専任→他社専任">専任→他社専任</MenuItem>
                <MenuItem value="一般→他決">一般→他決</MenuItem>
                <MenuItem value="他社買取">他社買取</MenuItem>
                <MenuItem value="訪問後（担当付）追客不要">訪問後（担当付）追客不要</MenuItem>
              </TextField>
              
              <Button
                variant="text"
                onClick={() => {
                  setConfidenceLevelFilter('');
                  setInquirySiteFilter('');
                  setPropertyTypeFilter('');
                  setStatusFilterValue('');
                }}
                size="small"
              >
                フィルタをクリア
              </Button>
            </Box>
          )}
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

        {/* モバイル：カードリスト表示 */}
        {isMobile ? (
          <Box>
            {loading ? (
              <Typography align="center" sx={{ py: 4, fontSize: '14px' }}>読み込み中...</Typography>
            ) : filteredSellers.length === 0 ? (
              <Typography align="center" sx={{ py: 4, fontSize: '14px' }}>売主が見つかりませんでした</Typography>
            ) : (
              filteredSellers.map((seller: any) => (
                <Card
                  key={seller.id}
                  data-seller-id={seller.id}
                  onClick={() => {
                    sessionStorage.setItem('sellersScrollPosition', window.scrollY.toString());
                    sessionStorage.setItem('selectedSellerId', seller.id);
                    pageDataCache.set(sellerDetailCacheKey(seller.id), seller, 30 * 1000);
                    const categoryParam = selectedCategory && selectedCategory !== 'all' ? `?category=${encodeURIComponent(selectedCategory)}` : '';
                    navigate(`/sellers/${seller.id}/call${categoryParam}`);
                  }}
                  sx={{
                    mb: 1,
                    cursor: 'pointer',
                    minHeight: 44,
                    '&:hover': { bgcolor: 'grey.50' },
                  }}
                >
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                      <Box
                        onClick={(e) => seller.sellerNumber && handleCopySellerNumber(seller.sellerNumber, e)}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          cursor: seller.sellerNumber ? 'pointer' : 'default',
                        }}
                      >
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          sx={{ color: SECTION_COLORS.seller.main, fontSize: '14px' }}
                        >
                          {seller.sellerNumber || '-'}
                        </Typography>
                        {seller.sellerNumber && (
                          <ContentCopyIcon
                            sx={{ fontSize: 14, color: SECTION_COLORS.seller.main }}
                          />
                        )}
                      </Box>
                      <Chip
                        label={statusLabels[seller.status] || seller.status || '-'}
                        color={getStatusColor(seller.status)}
                        size="small"
                        sx={{ fontSize: '12px', height: 22 }}
                      />
                    </Box>
                    <Typography
                      variant="body1"
                      fontWeight="bold"
                      sx={{ fontSize: '14px', mb: 0.5 }}
                    >
                      {seller.name || '-'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontSize: '14px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {seller.propertyAddress || '-'}
                      </Typography>
                      {seller.propertyType && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          {seller.propertyType}
                        </Typography>
                      )}
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: '14px' }}
                    >
                      次電:{' '}
                      {seller.nextCallDate
                        ? new Date(seller.nextCallDate).toLocaleDateString('ja-JP')
                        : '-'}
                    </Typography>
                  </CardContent>
                </Card>
              ))
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
        <TableContainer component={Paper}>
          <Table sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 100 }}>売主番号</TableCell>
                <TableCell sx={{ width: 120 }}>名前</TableCell>
                <TableCell sx={{ width: 60 }}>対応中</TableCell>
                <TableCell sx={{ width: 90 }}>最終電話</TableCell>
                <TableCell sx={{ width: 90 }}>反響日付</TableCell>
                <TableCell sx={{ width: 90 }}>次電日</TableCell>
                <TableCell sx={{ width: 200 }}>物件所在地</TableCell>
                <TableCell sx={{ width: 60 }}>種別</TableCell>
                <TableCell sx={{ width: 90 }}>査定額</TableCell>
                <TableCell sx={{ width: 60 }}>営担</TableCell>
                <TableCell sx={{ width: 90 }}>訪問日</TableCell>
                <TableCell sx={{ width: 120 }}>状況（当社）</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : filteredSellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    売主が見つかりませんでした
                  </TableCell>
                </TableRow>
              ) : (
                filteredSellers.map((seller: any) => (
                  <TableRow 
                    key={seller.id} 
                    hover
                    onClick={() => {
                      // スクロール位置と売主IDを保存
                      sessionStorage.setItem('sellersScrollPosition', window.scrollY.toString());
                      sessionStorage.setItem('selectedSellerId', seller.id);
                      // 一覧で取得済みの売主データをキャッシュに保存（通話モードページのプリフェッチ用）
                      // CallModePage.tsx でこのキャッシュを使えば /api/sellers/:id の待ち時間をゼロにできる
                      pageDataCache.set(sellerDetailCacheKey(seller.id), seller, 30 * 1000); // 30秒TTL
                      const categoryParam = selectedCategory && selectedCategory !== 'all' ? `?category=${encodeURIComponent(selectedCategory)}` : '';
                      navigate(`/sellers/${seller.id}/call${categoryParam}`);
                    }}
                    sx={{ cursor: 'pointer' }}
                    data-seller-id={seller.id}
                  >
                    <TableCell>
                      <Box
                        onClick={(e) => seller.sellerNumber && handleCopySellerNumber(seller.sellerNumber, e)}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          cursor: seller.sellerNumber ? 'pointer' : 'default',
                          '&:hover .copy-icon': { visibility: 'visible' },
                        }}
                      >
                        <Typography variant="body2" fontWeight="bold" sx={{ color: SECTION_COLORS.seller.main }}>
                          {seller.sellerNumber || '-'}
                        </Typography>
                        {seller.sellerNumber && (
                          <ContentCopyIcon
                            className="copy-icon"
                            sx={{ fontSize: 14, color: SECTION_COLORS.seller.main, visibility: 'hidden' }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{seller.name}</TableCell>
                    <TableCell>
                      {seller.sellerNumber && (() => {
                        const active = (presenceState[seller.sellerNumber] || [])
                          .filter(r => {
                            const enteredAt = new Date(r.entered_at).getTime();
                            return Date.now() - enteredAt < 30 * 60 * 1000;
                          });
                        if (active.length === 0) return '-';
                        return (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {active.map((r, i) => {
                              // 名字の1文字目を取得（漢字・英字どちらも対応）
                              const initial = r.user_name ? r.user_name.charAt(0) : '?';
                              return (
                                <Box
                                  key={i}
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    bgcolor: 'error.main',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    flexShrink: 0,
                                  }}
                                  title={r.user_name}
                                >
                                  {initial}
                                </Box>
                              );
                            })}
                          </Box>
                        );
                      })()}
                    </TableCell>

                    <TableCell>
                      {seller.lastCalledAt ? (() => {
                        const d = new Date(seller.lastCalledAt);
                        const m = d.getMonth() + 1;
                        const day = d.getDate();
                        const hh = String(d.getHours()).padStart(2, '0');
                        const mm = String(d.getMinutes()).padStart(2, '0');
                        return (
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                            {m}/{day} {hh}:{mm}
                          </Typography>
                        );
                      })() : '-'}
                    </TableCell>

                    <TableCell>
                      {formatInquiryDate(seller)}
                    </TableCell>
                    <TableCell>
                      {seller.nextCallDate
                        ? new Date(seller.nextCallDate).toLocaleDateString('ja-JP')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {seller.propertyAddress || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{seller.propertyType || '-'}</TableCell>
                    <TableCell>
                      {seller.valuationAmount1
                        ? `${Math.round(seller.valuationAmount1 / 10000).toLocaleString()}万円`
                        : '-'}
                    </TableCell>
                    <TableCell>{seller.visitAssigneeInitials || seller.visitAssignee || '-'}</TableCell>
                    <TableCell>
                      {seller.visitDate
                        ? new Date(seller.visitDate).toLocaleDateString('ja-JP')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabels[seller.status] || seller.status}
                        color={getStatusColor(seller.status)}
                        size="small"
                      />
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
        )}
          </Box>
        </Box>
      </Box>
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
