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
  TableSortLabel,
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
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  FormControl,
  OutlinedInput,
  InputLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  Sync as SyncIcon,
  PushPin as PushPinIcon,
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
  comments?: string;
  exclusionAction?: string;
}

/**
 * exclusionAction の値を省略表示に変換する
 * 「除外日に不通であれば除外」→「不通であれば除」
 * 「除外日になにもせず除外」→「なにもせず除」
 */
function formatExclusionAction(action: string | null | undefined): string | null {
  if (!action) return null;
  if (action.includes('不通')) return '不通であれば除';
  if (action.includes('なにもせず') || action.includes('何もせず')) return 'なにもせず除';
  return null;
}

/**
 * コメント文字列から年齢を抽出する
 * 「年齢: XX」「年齢：XX」「★年齢XX」など、コロンあり・なし両方に対応
 */
function extractAgeFromComments(comments: string | null | undefined): string | null {
  if (!comments) return null;
  // HTMLタグを除去してプレーンテキストに変換
  const plainText = comments.replace(/<[^>]*>/g, '');
  // コロンあり: 「年齢: 35」「年齢：35」
  // コロンなし: 「★年齢35」「年齢35」
  const match = plainText.match(/年齢[：:]?\s*(\d+)/);
  return match ? `${match[1]}歳` : null;
}

/**
 * 希望連絡時間の文字列から曜日部分を圧縮する
 * 例: 「月曜日、火曜日、水曜日、木曜日、金曜日 10:00〜22:00」→「平日 10:00〜22:00」
 * 例: 「月曜日、火曜日、水曜日、木曜日、金曜日、土曜日、日曜日」→「毎日」
 * 例: 「土曜日、日曜日 午後」→「土日 午後」
 */
function compressContactTime(value: string): string {
  if (!value) return value;

  // 「全て」「毎日」「いつでも」が含まれる場合
  if (/全て|毎日|いつでも|いつでも/.test(value)) {
    const timeOnly = value.replace(/全て|毎日|いつでも/g, '').replace(/[、,，\s]+/g, ' ').trim();
    return timeOnly ? `毎日 ${timeOnly}` : '毎日';
  }

  // 曜日の正規化（「月曜日」→「月」など）
  const dayMap: Record<string, string> = {
    '月曜日': '月', '火曜日': '火', '水曜日': '水', '木曜日': '木',
    '金曜日': '金', '土曜日': '土', '日曜日': '日',
    '月曜': '月', '火曜': '火', '水曜': '水', '木曜': '木',
    '金曜': '金', '土曜': '土', '日曜': '日',
  };

  // 含まれる曜日を検出
  const weekdays = ['月', '火', '水', '木', '金'];
  const weekend = ['土', '日'];
  const allDays = [...weekdays, ...weekend];

  // 値の中に含まれる曜日を収集
  let normalized = value;
  for (const [long, short] of Object.entries(dayMap)) {
    normalized = normalized.replace(new RegExp(long, 'g'), short);
  }

  const foundDays = allDays.filter(d => normalized.includes(d));

  // 曜日以外の部分（時間帯など）を抽出
  let remainder = normalized;
  for (const d of allDays) {
    remainder = remainder.replace(new RegExp(d, 'g'), '');
  }
  remainder = remainder.replace(/[、,，・\s]+/g, ' ').trim();

  let dayLabel = '';
  const hasAllWeekdays = weekdays.every(d => foundDays.includes(d));
  const hasWeekend = weekend.every(d => foundDays.includes(d));

  if (hasAllWeekdays && hasWeekend) {
    dayLabel = '毎日';
  } else if (hasAllWeekdays) {
    dayLabel = '平日';
    // 土日が個別にある場合は追加
    const extraDays = weekend.filter(d => foundDays.includes(d));
    if (extraDays.length > 0) dayLabel += extraDays.join('');
  } else if (foundDays.length > 0) {
    dayLabel = foundDays.join('');
  }

  const parts = [dayLabel, remainder].filter(Boolean);
  const result = parts.join(' ') || value;

  // 時刻フォーマット変換: 「10:00」「10：00」→「10時」（分が00の場合）、「10:30」→「10時半」
  return result
    .replace(/(\d{1,2})[：:]00/g, '$1時')
    .replace(/(\d{1,2})[：:]30/g, '$1時半')
    .replace(/(\d{1,2})[：:](\d{2})/g, '$1時$2分');
}

/**
 * コメント文字列から希望連絡時間を抽出する
 * 「希望連絡時間: XX」「★希望連絡時間：XX」の形式に対応
 */
function extractContactTimeFromComments(comments: string | null | undefined): string | null {
  if (!comments) return null;
  const plainText = comments.replace(/<[^>]*>/g, '');
  const match = plainText.match(/希望連絡時間[：:]\s*([^\n\r]+)/);
  const value = match ? match[1].trim() : null;
  if (!value) return null;
  return compressContactTime(value);
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
    // 福岡（FI）専用カウント
    fi_todayCall?: number;
    fi_todayCallNotStarted?: number;
    fi_todayCallWithInfo?: number;
    fi_unvaluated?: number;
    fi_todayCallWithInfoLabelCounts?: Record<string, number>;
    visitThankYouPendingCounts?: Record<string, number>;
    visitPreparationPending?: number;
    sellerPortalAttention?: number;
    sellerPortalScheduleAttention?: number;
    fi_sellerPortalAttention?: number;
    fi_sellerPortalScheduleAttention?: number;
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
    fi_todayCall: 0,
    fi_todayCallNotStarted: 0,
    fi_todayCallWithInfo: 0,
    fi_unvaluated: 0,
    fi_todayCallWithInfoLabelCounts: {},
    visitThankYouPendingCounts: {},
    visitPreparationPending: 0,
  });
  const [sidebarLoading, setSidebarLoading] = useState(!pageDataCache.get(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS));
  // 担当者イニシャル一覧（スタッフスプレッドシートから取得）
  const [assigneeInitials, setAssigneeInitials] = useState<string[]>([]);
  // ログインユーザーのイニシャル（一時フィルタのデフォルトラベル生成用）
  const [myInitials, setMyInitials] = useState<string>('');  
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
  // fetchSellers の競合状態（古いリクエストが後から解決して新しいフィルター結果を上書きする）を防ぐための連番
  const fetchSellersRequestIdRef = useRef(0);
  
  // ソート状態
  const [sortBy, setSortBy] = useState<string>('inquiry_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Phase 1 filters（複数選択対応：string[]）
  const [confidenceLevelFilter, setConfidenceLevelFilter] = useState<string[]>([]);
  const [inquirySiteFilter, setInquirySiteFilter] = useState<string[]>([]);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string[]>([]);
  const [statusFilterValue, setStatusFilterValue] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  // 地域フィルター（大分/福岡）：複数選択対応
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  // 日付フィルター（反響日付）
  const [inquiryDateFromFilter, setInquiryDateFromFilter] = useState('');
  const [inquiryDateToFilter, setInquiryDateToFilter] = useState('');
  // 状況（売主）フィルター（複数選択対応）
  const [currentStatusFilterValue, setCurrentStatusFilterValue] = useState<string[]>([]);
  // 査定額フィルター（万円単位）
  const [valuationAmountMinFilter, setValuationAmountMinFilter] = useState('');
  const [valuationAmountMaxFilter, setValuationAmountMaxFilter] = useState('');
  // 次電日フィルター：モード（以降/ぴったり/以前）と日付
  const [nextCallDateMode, setNextCallDateMode] = useState<'' | 'onOrAfter' | 'exact' | 'onOrBefore'>('');
  const [nextCallDateValue, setNextCallDateValue] = useState('');
  // 営業担当フィルター（visit_assignee、複数選択対応）
  const [visitAssigneeFilter, setVisitAssigneeFilter] = useState<string[]>([]);
  // 町名フィルター（物件住所の部分一致検索用）
  const [townNameFilter, setTownNameFilter] = useState('');
  // サイドバー一時追加フィルター
  const [sidebarTempFilters, setSidebarTempFilters] = useState<Array<{
    id: string;
    label: string;
    createdBy: string;
    filters: Record<string, any>;
  }>>([]);
  const [tempFilterDialogOpen, setTempFilterDialogOpen] = useState(false);
  const [tempFilterLabel, setTempFilterLabel] = useState('');
  const [tempFilterSaving, setTempFilterSaving] = useState(false);
  const [selectedTempFilterId, setSelectedTempFilterId] = useState<string | null>(() => {
    // 通話モードページから戻ってきた場合、sessionStorageから一時フィルターIDを復元
    const savedTempFilterId = sessionStorage.getItem('selectedTempFilterId');
    if (savedTempFilterId) {
      sessionStorage.removeItem('selectedTempFilterId'); // 一度使ったら削除
      return savedTempFilterId;
    }
    return null;
  });
  
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
        // 売主リストキャッシュを無効化（次のfetchSellersで最新データを取得する）
        // ⚠️ fetchSellers()を直接呼ぶとstaleなクロージャのフィルター値を使う可能性があるため呼ばない
        pageDataCache.invalidate(CACHE_KEYS.SELLERS_LIST);
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
    setSearchQuery(''); // 検索クエリをクリア（後から操作したサイドバーを優先）
    setPage(0); // カテゴリが変わったらページを0にリセット
    // フィルタをリセット（カテゴリフィルタと追加フィルタの競合を防ぐ）
    setConfidenceLevelFilter([]);
    setInquirySiteFilter([]);
    setPropertyTypeFilter([]);
    setStatusFilterValue([]);
    setRegionFilter([]);
    setInquiryDateFromFilter('');
    setInquiryDateToFilter('');
    setCurrentStatusFilterValue([]);
    setValuationAmountMinFilter('');
    setValuationAmountMaxFilter('');
    setNextCallDateMode('');
    setNextCallDateValue('');
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
      pageDataCache.set(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS, response.data, 1 * 60 * 1000);
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

  // ログインユーザーのイニシャルを取得
  const fetchMyInitials = async () => {
    try {
      const response = await api.get('/api/employees/initials-by-email');
      if (response.data?.initials) {
        setMyInitials(response.data.initials);
      }
    } catch (error: any) {
      console.error('[fetchMyInitials] Failed:', error?.response?.status, error?.response?.data || error?.message);
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

  // サイドバー一時追加フィルターの一覧を取得
  const fetchSidebarTempFilters = async () => {
    try {
      const response = await api.get('/api/sellers/sidebar-temp-filters');
      setSidebarTempFilters(response.data.filters || []);
    } catch (error) {
      console.error('Failed to fetch sidebar temp filters:', error);
    }
  };

  // 現在のフィルター条件をサイドバーに一時追加として保存
  const handleSaveTempFilter = async () => {
    if (!tempFilterLabel.trim()) return;
    setTempFilterSaving(true);
    try {
      const filtersToSave: Record<string, any> = {};
      if (regionFilter.length > 0) filtersToSave.region = regionFilter;
      if (confidenceLevelFilter.length > 0) filtersToSave.confidenceLevel = confidenceLevelFilter;
      if (inquirySiteFilter.length > 0) filtersToSave.inquirySite = inquirySiteFilter;
      if (propertyTypeFilter.length > 0) filtersToSave.propertyType = propertyTypeFilter;
      if (statusFilterValue.length > 0) filtersToSave.statusFilter = statusFilterValue;
      if (currentStatusFilterValue.length > 0) filtersToSave.currentStatusFilter = currentStatusFilterValue;
      if (inquiryDateFromFilter) filtersToSave.inquiryDateFrom = inquiryDateFromFilter;
      if (inquiryDateToFilter) filtersToSave.inquiryDateTo = inquiryDateToFilter;
      if (valuationAmountMinFilter) filtersToSave.valuationAmountMin = parseFloat(valuationAmountMinFilter);
      if (valuationAmountMaxFilter) filtersToSave.valuationAmountMax = parseFloat(valuationAmountMaxFilter);
      if (nextCallDateMode && nextCallDateValue) {
        if (nextCallDateMode === 'onOrAfter') filtersToSave.nextCallDateFrom = nextCallDateValue;
        else if (nextCallDateMode === 'onOrBefore') filtersToSave.nextCallDateTo = nextCallDateValue;
        else if (nextCallDateMode === 'exact') {
          filtersToSave.nextCallDateFrom = nextCallDateValue;
          filtersToSave.nextCallDateTo = nextCallDateValue;
        }
      }
      if (visitAssigneeFilter.length > 0) filtersToSave.visitAssignee = visitAssigneeFilter;
      // 町名フィルター（物件住所の部分一致検索用）
      if (townNameFilter.trim()) filtersToSave.townName = townNameFilter.trim();
      // 検索バーの内容も保存（物件住所・売主名などのキーワード検索用）
      if (searchQuery.trim()) filtersToSave.searchQuery = searchQuery.trim();

      const response = await api.post('/api/sellers/sidebar-temp-filters', {
        label: tempFilterLabel.trim(),
        filters: filtersToSave,
      });
      setSidebarTempFilters(prev => [...prev, response.data]);
      setTempFilterDialogOpen(false);
      setTempFilterLabel('');
      setSnackbarMessage(`「${response.data.label}」をサイドバーに追加しました`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Failed to save temp filter:', error);
      setSnackbarMessage('サイドバーへの追加に失敗しました');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setTempFilterSaving(false);
    }
  };

  // サイドバー一時追加フィルターを削除
  const handleDeleteTempFilter = async (id: string) => {
    try {
      await api.delete(`/api/sellers/sidebar-temp-filters/${id}`);
      setSidebarTempFilters(prev => prev.filter(f => f.id !== id));
      if (selectedTempFilterId === id) {
        setSelectedTempFilterId(null);
        setSelectedCategory('all');
      }
    } catch (error) {
      console.error('Failed to delete temp filter:', error);
      setSnackbarMessage('削除に失敗しました');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // サイドバーの一時追加フィルターを選択（対応するフィルター条件を適用）
  const handleSelectTempFilter = useCallback((tempFilter: { id: string; filters: Record<string, any> }) => {
    // 既存フィルターをリセット
    setConfidenceLevelFilter([]);
    setInquirySiteFilter([]);
    setPropertyTypeFilter([]);
    setStatusFilterValue([]);
    setRegionFilter([]);
    setInquiryDateFromFilter('');
    setInquiryDateToFilter('');
    setCurrentStatusFilterValue([]);
    setValuationAmountMinFilter('');
    setValuationAmountMaxFilter('');
    setNextCallDateMode('');
    setNextCallDateValue('');
    setVisitAssigneeFilter([]);
    setTownNameFilter(''); // 町名フィルターもリセット

    const f = tempFilter.filters || {};
    // フィルター値を配列に正規化（単一値も配列に変換）
    const toArr = (v: any): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v.filter(Boolean);
      return [String(v)];
    };
    if (f.region) setRegionFilter(toArr(f.region));
    if (f.confidenceLevel) setConfidenceLevelFilter(toArr(f.confidenceLevel));
    if (f.inquirySite) setInquirySiteFilter(toArr(f.inquirySite));
    if (f.propertyType) setPropertyTypeFilter(toArr(f.propertyType));
    if (f.statusFilter) setStatusFilterValue(toArr(f.statusFilter));
    if (f.currentStatusFilter) setCurrentStatusFilterValue(toArr(f.currentStatusFilter));
    if (f.inquiryDateFrom) setInquiryDateFromFilter(f.inquiryDateFrom);
    if (f.inquiryDateTo) setInquiryDateToFilter(f.inquiryDateTo);
    if (f.valuationAmountMin !== undefined) setValuationAmountMinFilter(String(f.valuationAmountMin));
    if (f.valuationAmountMax !== undefined) setValuationAmountMaxFilter(String(f.valuationAmountMax));
    if (f.nextCallDateFrom && f.nextCallDateTo && f.nextCallDateFrom === f.nextCallDateTo) {
      setNextCallDateMode('exact');
      setNextCallDateValue(f.nextCallDateFrom);
    } else if (f.nextCallDateFrom) {
      setNextCallDateMode('onOrAfter');
      setNextCallDateValue(f.nextCallDateFrom);
    } else if (f.nextCallDateTo) {
      setNextCallDateMode('onOrBefore');
      setNextCallDateValue(f.nextCallDateTo);
    }
    if (f.visitAssignee) setVisitAssigneeFilter(toArr(f.visitAssignee));
    // 町名フィルターを復元
    if (f.townName) setTownNameFilter(f.townName);

    setSelectedTempFilterId(tempFilter.id);
    setSelectedCategory('all'); // サイドバーの固定カテゴリとは独立させる
    setSearchQuery('');
    setPage(0);
    // 一時フィルターを選択したらキャッシュをクリアして確実に最新データを取得する
    pageDataCache.invalidate(CACHE_KEYS.SELLERS_LIST);
  }, []);

  // 初回ロード時とキャッシュ無効化時にサイドバーカウントを即座に取得
  useEffect(() => {
    console.log('[SellersPage] Component mounted or cache invalidated');
    console.log('[SellersPage] location.search:', location.search);
    
    const cached = pageDataCache.get(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS);
    if (!cached) {
      console.log('[SellersPage] No cache found, fetching sidebar counts immediately');
      fetchSidebarCounts(true);
    } else {
      console.log('[SellersPage] Using cached sidebar counts');
      setSidebarCounts(cached as any);
    }
    fetchAssigneeInitials();
    fetchMyInitials();
    fetchSidebarTempFilters();
    
    // 買主マッチング用URLパラメータをチェック
    const searchParams = new URLSearchParams(location.search);
    const buyerMatchingNumber = searchParams.get('buyerMatching');
    console.log('[SellersPage] buyerMatching param:', buyerMatchingNumber);
    
    if (buyerMatchingNumber) {
      console.log('[SellersPage] Buyer matching detected:', buyerMatchingNumber);
      // 買主マッチングの場合、マッチした売主を取得
      fetch(`/api/buyers/${buyerMatchingNumber}/match-candidates`)
        .then(res => {
          console.log('[SellersPage] Match candidates response status:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('[SellersPage] Match candidates data:', data);
          if (data.sellers && data.sellers.length === 1) {
            // 1件だけの場合は通話モードに自動遷移
            const seller = data.sellers[0];
            const sellerId = seller.id || seller.seller_id;
            console.log('[SellersPage] Navigating to call mode:', sellerId);
            navigate(`/sellers/${sellerId}/call`);
          } else {
            console.log('[SellersPage] Multiple or zero matches, showing list');
          }
          // 0件または複数件の場合は何もしない（通常の売主リストを表示）
        })
        .catch(error => {
          console.error('[SellersPage] Buyer matching error:', error);
          // エラーの場合は何もしない（通常の売主リストを表示）
        });
    }
  }, [location.search, navigate]);

  // 一時フィルターIDが復元された場合、sidebarTempFiltersロード後にフィルター条件を適用
  useEffect(() => {
    if (selectedTempFilterId && sidebarTempFilters.length > 0) {
      const tf = sidebarTempFilters.find(f => f.id === selectedTempFilterId);
      if (tf) {
        handleSelectTempFilter(tf);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarTempFilters]);

  // ページに戻ってきた時にサイドバーカウントを再取得（常に最新を取得）
  useEffect(() => {
    // /sellers ページに戻ってきたときのみ実行
    if (location.pathname === '/' || location.pathname === '/sellers') {
      // 売主詳細ページで更新があった場合にカウントが古くなるため、
      // 戻ってきた時は常にキャッシュを無効化して再取得する
      console.log('[SellersPage] Returned to sellers page, refreshing sidebar counts');
      pageDataCache.invalidate(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS);
      fetchSidebarCounts(true);
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

  // 10分ごとにサイドバーカウントを自動更新（DB負荷軽減のため1分→10分に変更）
  useEffect(() => {
    const interval = setInterval(() => {
      pageDataCache.invalidate(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS);
      fetchSidebarCounts(true);
    }, 10 * 60 * 1000); // 10分
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchSellers();
  }, [page, rowsPerPage, confidenceLevelFilter, inquirySiteFilter, propertyTypeFilter, statusFilterValue, regionFilter, inquiryDateFromFilter, inquiryDateToFilter, currentStatusFilterValue, valuationAmountMinFilter, valuationAmountMaxFilter, nextCallDateMode, nextCallDateValue, visitAssigneeFilter, townNameFilter, selectedCategory, sortBy, sortOrder]);

  const fetchSellers = async () => {
    // このリクエストの連番を発行（後から解決した古いリクエストの結果を無視するため）
    const requestId = ++fetchSellersRequestIdRef.current;
    try {
      const params: any = {
        page: page + 1,
        pageSize: rowsPerPage,
        sortBy: sortBy,
        sortOrder: sortOrder,
      };
      
      // Add Phase 1 filters
      if (confidenceLevelFilter.length > 0) {
        params.confidenceLevel = confidenceLevelFilter;
      }
      if (inquirySiteFilter.length > 0) {
        params.inquirySite = inquirySiteFilter;
      }
      if (propertyTypeFilter.length > 0) {
        params.propertyType = propertyTypeFilter;
      }
      if (statusFilterValue.length > 0) {
        params.statusFilter = statusFilterValue;
      }
      if (regionFilter.length > 0) {
        params.region = regionFilter;
      }
      if (inquiryDateFromFilter) {
        params.inquiryDateFrom = inquiryDateFromFilter;
      }
      if (inquiryDateToFilter) {
        params.inquiryDateTo = inquiryDateToFilter;
      }
      if (currentStatusFilterValue.length > 0) {
        params.currentStatusFilter = currentStatusFilterValue;
      }
      if (valuationAmountMinFilter) {
        params.valuationAmountMin = parseFloat(valuationAmountMinFilter);
      }
      if (valuationAmountMaxFilter) {
        params.valuationAmountMax = parseFloat(valuationAmountMaxFilter);
      }
      // 次電日フィルター：モードに応じてFrom/Toを設定（ぴったりの場合は同日をFrom/Toに設定）
      if (nextCallDateMode && nextCallDateValue) {
        if (nextCallDateMode === 'onOrAfter') {
          params.nextCallDateFrom = nextCallDateValue;
        } else if (nextCallDateMode === 'onOrBefore') {
          params.nextCallDateTo = nextCallDateValue;
        } else if (nextCallDateMode === 'exact') {
          params.nextCallDateFrom = nextCallDateValue;
          params.nextCallDateTo = nextCallDateValue;
        }
      }
      
      // サイドバーカテゴリフィルター
      if (selectedCategory && selectedCategory !== 'all') {
        params.statusCategory = selectedCategory;
      }
      if (visitAssigneeFilter.length > 0) {
        params.visitAssignee = visitAssigneeFilter;
      }
      // 町名フィルター（物件住所の部分一致検索用）
      if (townNameFilter.trim()) {
        params.townName = townNameFilter.trim();
      }

      // キャッシュキー（パラメータを含む）
      const cacheKey = `${CACHE_KEYS.SELLERS_LIST}:${JSON.stringify(params)}`;

      // visitThankYouPending:xxx カテゴリはメール送信後に即座に消えるべきのためキャッシュを使わない
      const isVisitThankYouCategory = typeof params.statusCategory === 'string' && params.statusCategory.startsWith('visitThankYouPending:');

      // キャッシュが有効な場合はローディングなしで即座に表示
      const cached = !isVisitThankYouCategory ? pageDataCache.get<{ data: Seller[]; total: number }>(cacheKey) : null;
      if (cached) {
        // 古いリクエストの場合は state を更新しない（後から発行された新しいフィルター条件のリクエストを優先）
        if (requestId === fetchSellersRequestIdRef.current) {
          setSellers(cached.data);
          setTotal(cached.total);
          setLoading(false); // キャッシュヒット時はローディングを解除
        }
        // バックグラウンドで最新データを取得してキャッシュを更新
        api.get('/api/sellers', { params }).then((response) => {
          // このリクエストがまだ最新の場合のみ画面に反映する（競合状態対策）
          if (requestId === fetchSellersRequestIdRef.current) {
            setSellers(response.data.data);
            setTotal(response.data.total);
          }
          // fi:xxx / visitThankYouPending:xxx カテゴリは都度最新を取得するためキャッシュしない
          const isFiCategory = typeof params.statusCategory === 'string' && params.statusCategory.startsWith('fi:');
          const isVisitThankYouCategory = typeof params.statusCategory === 'string' && params.statusCategory.startsWith('visitThankYouPending:');
          if (!isFiCategory && !isVisitThankYouCategory) {
            pageDataCache.set(cacheKey, { data: response.data.data, total: response.data.total }, 15 * 60 * 1000);
          }
        }).catch((err) => console.error('Background sellers refresh failed:', err));
        return;
      }

      // キャッシュなしの場合のみローディング表示
      setLoading(true);
      const response = await api.get('/api/sellers', { params });
      // このリクエストがまだ最新の場合のみ画面に反映する（競合状態対策：古いリクエストが後から解決して
      // 新しいフィルター結果を上書きしてしまう問題を防ぐ）
      if (requestId === fetchSellersRequestIdRef.current) {
        setSellers(response.data.data);
        setTotal(response.data.total);
      }
      // fi:xxx / visitThankYouPending:xxx カテゴリは都度最新を取得するためキャッシュしない
      // それ以外は15分間キャッシュ（コールドスタート対策）
      const isFiCategoryNoCache = typeof params.statusCategory === 'string' && params.statusCategory.startsWith('fi:');
      const isVisitThankYouCategoryNoCache = typeof params.statusCategory === 'string' && params.statusCategory.startsWith('visitThankYouPending:');
      if (!isFiCategoryNoCache && !isVisitThankYouCategoryNoCache) {
        pageDataCache.set(cacheKey, { data: response.data.data, total: response.data.total }, 15 * 60 * 1000);
      }
    } catch (error) {
      console.error('Failed to fetch sellers:', error);
    } finally {
      if (requestId === fetchSellersRequestIdRef.current) {
        setLoading(false);
      }
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

    // サイドバーカテゴリをリセット（後から操作した検索を優先）
    setSelectedCategory('all');
    setPage(0);

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
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');

  // 転記ステップ1（メール→スプシ）用の状態
  const [step1Syncing, setStep1Syncing] = useState(false);
  // 転記ステップ2（スプシ→DB）用の状態
  const [step2Syncing, setStep2Syncing] = useState(false);

  // ステップ1: メール→売主リストスプシ（GAS実行）
  const handleStep1Sync = async () => {
    setStep1Syncing(true);
    setSnackbarMessage('メール→スプシ転記中... GASを実行しています');
    setSnackbarSeverity('info');
    setSnackbarOpen(true);
    try {
      const res = await api.post('/api/sellers/manual-sync-step1');
      if (res.data?.timeout) {
        setSnackbarMessage('GASがタイムアウトしました。スプレッドシートを確認してから「スプシ→DB転記」を実行してください。');
        setSnackbarSeverity('warning');
      } else {
        setSnackbarMessage(res.data?.message || 'メール→スプシの転記が完了しました');
        setSnackbarSeverity('success');
      }
      setSnackbarOpen(true);
    } catch (err: any) {
      const resData = err?.response?.data;
      if (resData?.timeout) {
        setSnackbarMessage('GASがタイムアウトしました。スプレッドシートを確認してから「スプシ→DB転記」を実行してください。');
        setSnackbarSeverity('warning');
      } else {
        setSnackbarMessage(resData?.error || 'メール転記中にエラーが発生しました');
        setSnackbarSeverity('error');
      }
      setSnackbarOpen(true);
    } finally {
      setStep1Syncing(false);
    }
  };

  // ステップ2: スプシ→DB転記
  const handleStep2Sync = async () => {
    setStep2Syncing(true);
    setSnackbarMessage('スプシ→DB転記中...');
    setSnackbarSeverity('info');
    setSnackbarOpen(true);
    try {
      const res = await api.post('/api/sellers/manual-sync-step2');
      setSnackbarMessage(res.data?.message || 'DBへの転記が完了しました');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      // データを再取得
      pageDataCache.invalidate(CACHE_KEYS.SELLERS_LIST);
      pageDataCache.invalidate(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS);
      fetchSellers();
      setTimeout(() => fetchSidebarCounts(true), 1000);
    } catch (err: any) {
      const resData = err?.response?.data;
      if (resData?.timeout) {
        setSnackbarMessage('DB転記がタイムアウトしました。しばらく待ってからもう一度実行してください。');
        setSnackbarSeverity('warning');
      } else {
        setSnackbarMessage(resData?.error || 'DB転記中にエラーが発生しました');
        setSnackbarSeverity('error');
      }
      setSnackbarOpen(true);
    } finally {
      setStep2Syncing(false);
    }
  };

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
              variant="contained"
              color="primary"
              size="small"
              startIcon={step1Syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={handleStep1Sync}
              disabled={step1Syncing || step2Syncing}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {step1Syncing ? 'メール→スプシ転記中...' : 'メール→スプシ'}
            </Button>
            <Button
              variant="contained"
              color="secondary"
              size="small"
              startIcon={step2Syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={handleStep2Sync}
              disabled={step1Syncing || step2Syncing}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {step2Syncing ? 'スプシ→DB転記中...' : 'スプシ→DB'}
            </Button>
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
                visitThankYouPendingCounts={sidebarCounts.visitThankYouPendingCounts}
                tempFilters={sidebarTempFilters}
                selectedTempFilterId={selectedTempFilterId}
                onTempFilterSelect={handleSelectTempFilter}
                onTempFilterDelete={handleDeleteTempFilter}
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
              visitThankYouPendingCounts={sidebarCounts.visitThankYouPendingCounts}
              tempFilters={sidebarTempFilters}
              selectedTempFilterId={selectedTempFilterId}
              onTempFilterSelect={handleSelectTempFilter}
              onTempFilterDelete={handleDeleteTempFilter}
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
                   typeof selectedCategory === 'string' && selectedCategory.startsWith('unvisitedOtherDecision:') ? (() => {
                     const ym = selectedCategory.replace('unvisitedOtherDecision:', '');
                     const [y, m] = ym.split('-');
                     return `未訪問他決【${y}年${parseInt(m)}月】`;
                   })() :
                   typeof selectedCategory === 'string' && selectedCategory.startsWith('visitAssigned:') ? `担当（${selectedCategory.replace('visitAssigned:', '')}）` :
                   typeof selectedCategory === 'string' && selectedCategory.startsWith('todayCallAssigned:') ? `当日TEL(${selectedCategory.replace('todayCallAssigned:', '')})` :
                   typeof selectedCategory === 'string' && selectedCategory === 'fi:todayCall' ? '福岡 当日TEL分' :
                   typeof selectedCategory === 'string' && selectedCategory === 'fi:todayCallNotStarted' ? '福岡 当日TEL_未着手' :
                   typeof selectedCategory === 'string' && selectedCategory === 'fi:todayCallWithInfo' ? '福岡 当日TEL（内容）' :
                   typeof selectedCategory === 'string' && selectedCategory === 'fi:unvaluated' ? '福岡 未査定' :
                   typeof selectedCategory === 'string' && selectedCategory.startsWith('fi:todayCallWithInfo:') ? `福岡 ${selectedCategory.replace('fi:todayCallWithInfo:', '')}` :
                   selectedCategory}
                </Typography>
                <Chip label={`${total}件`} size="small" color="primary" />
              </Box>
            )}

            {/* 一時追加フィルター選択中の場合、上部にラベルと戻るボタンを表示 */}
            {selectedTempFilterId && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSelectedTempFilterId(null);
                    setConfidenceLevelFilter([]);
                    setInquirySiteFilter([]);
                    setPropertyTypeFilter([]);
                    setStatusFilterValue([]);
                    setRegionFilter([]);
                    setInquiryDateFromFilter('');
                    setInquiryDateToFilter('');
                    setCurrentStatusFilterValue([]);
                    setValuationAmountMinFilter('');
                    setValuationAmountMaxFilter('');
                    setNextCallDateMode('');
                    setNextCallDateValue('');
                    setPage(0);
                  }}
                >
                  ← 全件表示
                </Button>
                <PushPinIcon fontSize="small" color="action" />
                <Typography variant="body1" fontWeight="bold">
                  {sidebarTempFilters.find(f => f.id === selectedTempFilterId)?.label}
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
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* 地域（複数選択） */}
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>地域</InputLabel>
                <Select
                  multiple
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(typeof e.target.value === 'string' ? [e.target.value] : e.target.value as string[])}
                  input={<OutlinedInput label="地域" />}
                  renderValue={(selected) => selected.map((v) => v === 'oita' ? '大分' : '福岡').join(', ')}
                >
                  <MenuItem value="oita">大分</MenuItem>
                  <MenuItem value="fukuoka">福岡</MenuItem>
                </Select>
              </FormControl>

              {/* 地名・町名フィルター（物件住所の部分一致検索用） */}
              <TextField
                label="地名・町名"
                value={townNameFilter}
                onChange={(e) => setTownNameFilter(e.target.value)}
                placeholder="例: 石垣"
                sx={{ minWidth: 150 }}
                size="small"
              />

              {/* 確度（複数選択） */}
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>確度</InputLabel>
                <Select
                  multiple
                  value={confidenceLevelFilter}
                  onChange={(e) => setConfidenceLevelFilter(typeof e.target.value === 'string' ? [e.target.value] : e.target.value as string[])}
                  input={<OutlinedInput label="確度" />}
                  renderValue={(selected) => selected.join(', ')}
                >
                  <MenuItem value="A">A（売る気あり）</MenuItem>
                  <MenuItem value="B">B（売る気あるがまだ先の話）</MenuItem>
                  <MenuItem value="B'">B'（売る気は全く無い）</MenuItem>
                  <MenuItem value="C">C（電話が繋がらない）</MenuItem>
                  <MenuItem value="D">D（再建築不可）</MenuItem>
                  <MenuItem value="E">E（収益物件）</MenuItem>
                  <MenuItem value="ダブり">ダブり（重複している）</MenuItem>
                </Select>
              </FormControl>

              {/* サイト（複数選択） */}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>サイト</InputLabel>
                <Select
                  multiple
                  value={inquirySiteFilter}
                  onChange={(e) => setInquirySiteFilter(typeof e.target.value === 'string' ? [e.target.value] : e.target.value as string[])}
                  input={<OutlinedInput label="サイト" />}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {['ウ','ビ','H','お','Y','す','a','L','エ','近所','チ','P','紹','リ','買','HP','知合','at-homeの掲載を見て','2件目以降査定','ロープレ','ア','ガ'].map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* 種別（複数選択） */}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>種別</InputLabel>
                <Select
                  multiple
                  value={propertyTypeFilter}
                  onChange={(e) => setPropertyTypeFilter(typeof e.target.value === 'string' ? [e.target.value] : e.target.value as string[])}
                  input={<OutlinedInput label="種別" />}
                  renderValue={(selected) => selected.join(', ')}
                >
                  <MenuItem value="土地">土地</MenuItem>
                  <MenuItem value="戸建">戸建</MenuItem>
                  <MenuItem value="マンション">マンション</MenuItem>
                  <MenuItem value="事業用">事業用</MenuItem>
                </Select>
              </FormControl>

              {/* 状況（当社）（複数選択） */}
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>状況（当社）</InputLabel>
                <Select
                  multiple
                  value={statusFilterValue}
                  onChange={(e) => setStatusFilterValue(typeof e.target.value === 'string' ? [e.target.value] : e.target.value as string[])}
                  input={<OutlinedInput label="状況（当社）" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((v) => <Chip key={v} label={v} size="small" />)}
                    </Box>
                  )}
                >
                  {['追客中','追客不要(未訪問）','除外済追客不要','除外後追客中','専任媒介','一般媒介','リースバック（専任）','他決→追客','他決→追客不要','他決→専任','他決→一般','専任→他社専任','一般→他決','他社買取','訪問後（担当付）追客不要'].map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* 状況（売主）（複数選択） */}
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>状況（売主）</InputLabel>
                <Select
                  multiple
                  value={currentStatusFilterValue}
                  onChange={(e) => setCurrentStatusFilterValue(typeof e.target.value === 'string' ? [e.target.value] : e.target.value as string[])}
                  input={<OutlinedInput label="状況（売主）" />}
                  renderValue={(selected) => selected.join(', ')}
                >
                  <MenuItem value="居住中">居住中</MenuItem>
                  <MenuItem value="空き家">空き家</MenuItem>
                  <MenuItem value="賃貸中">賃貸中</MenuItem>
                  <MenuItem value="古屋あり">古屋あり</MenuItem>
                  <MenuItem value="更地">更地</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="反響日付（From）"
                type="date"
                value={inquiryDateFromFilter}
                onChange={(e) => setInquiryDateFromFilter(e.target.value)}
                sx={{ minWidth: 160 }}
                size="small"
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="反響日付（To）"
                type="date"
                value={inquiryDateToFilter}
                onChange={(e) => setInquiryDateToFilter(e.target.value)}
                sx={{ minWidth: 160 }}
                size="small"
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="査定額 下限（万円）"
                type="number"
                value={valuationAmountMinFilter}
                onChange={(e) => setValuationAmountMinFilter(e.target.value)}
                sx={{ minWidth: 150 }}
                size="small"
              />

              <TextField
                label="査定額 上限（万円）"
                type="number"
                value={valuationAmountMaxFilter}
                onChange={(e) => setValuationAmountMaxFilter(e.target.value)}
                sx={{ minWidth: 150 }}
                size="small"
              />

              <TextField
                select
                label="次電日"
                value={nextCallDateMode}
                onChange={(e) => setNextCallDateMode(e.target.value as '' | 'onOrAfter' | 'exact' | 'onOrBefore')}
                sx={{ minWidth: 130 }}
                size="small"
              >
                <MenuItem value="">全て</MenuItem>
                <MenuItem value="onOrAfter">以降</MenuItem>
                <MenuItem value="exact">ぴったり</MenuItem>
                <MenuItem value="onOrBefore">以前</MenuItem>
              </TextField>

              <TextField
                label="次電日 日付"
                type="date"
                value={nextCallDateValue}
                onChange={(e) => setNextCallDateValue(e.target.value)}
                sx={{ minWidth: 160 }}
                size="small"
                disabled={!nextCallDateMode}
                InputLabelProps={{ shrink: true }}
              />

              {/* 営業担当（複数選択） */}
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>営業担当</InputLabel>
                <Select
                  multiple
                  value={visitAssigneeFilter}
                  onChange={(e) => setVisitAssigneeFilter(typeof e.target.value === 'string' ? [e.target.value] : e.target.value as string[])}
                  input={<OutlinedInput label="営業担当" />}
                  renderValue={(selected) => selected.join(', ')}
                >
                  <MenuItem value="__none__">（なし）</MenuItem>
                  {assigneeInitials.map((initial) => (
                    <MenuItem key={initial} value={initial}>{initial}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Button
                variant="text"
                onClick={() => {
                  setConfidenceLevelFilter([]);
                  setInquirySiteFilter([]);
                  setPropertyTypeFilter([]);
                  setStatusFilterValue([]);
                  setRegionFilter([]);
                  setInquiryDateFromFilter('');
                  setInquiryDateToFilter('');
                  setCurrentStatusFilterValue([]);
                  setValuationAmountMinFilter('');
                  setValuationAmountMaxFilter('');
                  setNextCallDateMode('');
                  setNextCallDateValue('');
                  setVisitAssigneeFilter([]);
                  setTownNameFilter(''); // 町名フィルターもクリア
                  setSelectedTempFilterId(null);
                }}
                size="small"
              >
                フィルタをクリア
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<PushPinIcon fontSize="small" />}
                onClick={() => {
                  // デフォルトラベルを生成（選択した全フィルタを含める）
                  const labelParts: string[] = [];
                  
                  // 1. イニシャル（ログインユーザー）← 最初
                  if (myInitials) {
                    labelParts.push(myInitials);
                  }
                  
                  // 2. 地域（大分/福岡）
                  if (regionFilter.length === 1) {
                    labelParts.push(regionFilter[0] === 'oita' ? '大分' : '福岡');
                  } else if (regionFilter.length === 2) {
                    labelParts.push('大分・福岡');
                  }
                  
                  // 3. 地名・町名
                  if (townNameFilter.trim()) {
                    labelParts.push(townNameFilter.trim());
                  }
                  
                  // 4. 種別（マンション、戸建て、土地など）
                  if (propertyTypeFilter.length > 0) {
                    labelParts.push(propertyTypeFilter.join('・'));
                  }
                  
                  // 5. 確度
                  if (confidenceLevelFilter.length > 0) {
                    labelParts.push(`確度${confidenceLevelFilter.join('・')}`);
                  }
                  
                  // 6. サイト
                  if (inquirySiteFilter.length > 0) {
                    labelParts.push(inquirySiteFilter.join('・'));
                  }
                  
                  // 7. 状況（当社）
                  if (statusFilterValue.length > 0) {
                    labelParts.push(statusFilterValue.join('・'));
                  }
                  
                  // 8. 状況（売主）
                  if (currentStatusFilterValue.length > 0) {
                    labelParts.push(`売主${currentStatusFilterValue.join('・')}`);
                  }
                  
                  // 9. 反響日付
                  if (inquiryDateFromFilter || inquiryDateToFilter) {
                    if (inquiryDateFromFilter && inquiryDateToFilter) {
                      labelParts.push(`${inquiryDateFromFilter}～${inquiryDateToFilter}`);
                    } else if (inquiryDateFromFilter) {
                      labelParts.push(`${inquiryDateFromFilter}以降`);
                    } else if (inquiryDateToFilter) {
                      labelParts.push(`～${inquiryDateToFilter}`);
                    }
                  }
                  
                  // 10. 査定額
                  if (valuationAmountMinFilter || valuationAmountMaxFilter) {
                    if (valuationAmountMinFilter && valuationAmountMaxFilter) {
                      labelParts.push(`${valuationAmountMinFilter}～${valuationAmountMaxFilter}万`);
                    } else if (valuationAmountMinFilter) {
                      labelParts.push(`${valuationAmountMinFilter}万以上`);
                    } else if (valuationAmountMaxFilter) {
                      labelParts.push(`～${valuationAmountMaxFilter}万`);
                    }
                  }
                  
                  // 11. 次電日
                  if (nextCallDateMode && nextCallDateValue) {
                    const modeLabel = nextCallDateMode === 'onOrAfter' ? '以降' : nextCallDateMode === 'exact' ? '' : '以前';
                    labelParts.push(`次電${nextCallDateValue}${modeLabel}`);
                  }
                  
                  // 12. 営業担当
                  if (visitAssigneeFilter.length > 0) {
                    labelParts.push(`営担${visitAssigneeFilter.join('・')}`);
                  }
                  
                  // デフォルトラベルを設定
                  setTempFilterLabel(labelParts.join(' '));
                  setTempFilterDialogOpen(true);
                }}
              >
                サイドバーに一時追加
              </Button>
            </Box>
          )}
        </Paper>

        {/* サイドバー一時追加フィルター保存ダイアログ */}
        <Dialog open={tempFilterDialogOpen} onClose={() => setTempFilterDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>サイドバーに一時追加</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              現在設定中のフィルター条件をサイドバーにカテゴリーとして追加します。誰が追加したか分かるよう、名前を含めてください（例:「福岡・空家K」）。
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="サイドバー表示名"
              placeholder="例: 福岡・空家K"
              value={tempFilterLabel}
              onChange={(e) => setTempFilterLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tempFilterLabel.trim() && !tempFilterSaving) {
                  handleSaveTempFilter();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTempFilterDialogOpen(false)}>キャンセル</Button>
            <Button
              variant="contained"
              disabled={!tempFilterLabel.trim() || tempFilterSaving}
              onClick={handleSaveTempFilter}
            >
              {tempFilterSaving ? '追加中...' : '追加する'}
            </Button>
          </DialogActions>
        </Dialog>

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
                    const tempFilterParam = selectedTempFilterId
                      ? (categoryParam ? '&' : '?') + `tempFilterId=${encodeURIComponent(selectedTempFilterId)}&tempFilterLabel=${encodeURIComponent(sidebarTempFilters.find(f => f.id === selectedTempFilterId)?.label || '')}`
                      : '';
                    const hasParam = categoryParam || tempFilterParam;
                    const sortParam = `${hasParam ? '&' : '?'}sortBy=${encodeURIComponent(sortBy)}&sortOrder=${encodeURIComponent(sortOrder)}`;
                    // 営業担当フィルターが適用中の場合、通話モードのNEXTボタンにも同じ絞り込みを反映させる
                    const vaParam = visitAssigneeFilter.length === 1 ? `&visitAssignee=${encodeURIComponent(visitAssigneeFilter[0])}` : '';
                    navigate(`/sellers/${seller.id}/call${categoryParam}${tempFilterParam}${sortParam}${vaParam}`);
                  }}
                  sx={{
                    mb: 1,
                    cursor: 'pointer',
                    minHeight: 44,
                    ...(seller.exclusiveOtherDecisionMeeting === '完了'
                      ? {
                          bgcolor: '#eeeeee',
                          '&:hover': { bgcolor: '#e0e0e0' },
                        }
                      : seller.exclusiveOtherDecisionMeetingNote && seller.exclusiveOtherDecisionMeetingNote.trim() !== ''
                      ? {
                          bgcolor: '#fce4ec',
                          '&:hover': { bgcolor: '#f8bbd0' },
                        }
                      : seller.otherDecisionCountermeasure && seller.otherDecisionCountermeasure.trim() !== ''
                      ? {
                          bgcolor: '#e3f2fd',
                          '&:hover': { bgcolor: '#bbdefb' },
                        }
                      : {
                          '&:hover': { bgcolor: 'grey.50' },
                        }),
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
                    {seller.phoneNumber && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontSize: '13px', mb: 0.5 }}
                      >
                        {seller.phoneNumber}
                      </Typography>
                    )}
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
                <TableCell sx={{ width: 80 }}>年齢/連絡時間/確度</TableCell>
                <TableCell sx={{ width: 60 }}>対応中</TableCell>
                <TableCell sx={{ width: 90 }}>最終電話</TableCell>
                <TableCell sx={{ width: 90 }}>反響日付</TableCell>
                <TableCell sx={{ width: 90, cursor: 'pointer' }}>
                  <TableSortLabel
                    active={sortBy === 'next_call_date'}
                    direction={sortBy === 'next_call_date' ? sortOrder : 'asc'}
                    onClick={() => {
                      if (sortBy === 'next_call_date') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('next_call_date');
                        setSortOrder('asc');
                      }
                      setPage(0);
                    }}
                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                  >
                    次電日
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: 200 }}>物件所在地</TableCell>
                <TableCell sx={{ width: 60 }}>種別</TableCell>
                <TableCell sx={{ width: 90 }}>査定額</TableCell>
                <TableCell sx={{ width: 40 }}>サイト</TableCell>
                <TableCell sx={{ width: 60 }}>営担</TableCell>
                <TableCell sx={{ width: 90, cursor: 'pointer' }}>
                  <TableSortLabel
                    active={sortBy === 'visit_date'}
                    direction={sortBy === 'visit_date' ? sortOrder : 'asc'}
                    onClick={() => {
                      if (sortBy === 'visit_date') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('visit_date');
                        setSortOrder('asc');
                      }
                      setPage(0);
                    }}
                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                  >
                    訪問日
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: 120 }}>状況（当社）</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={14} align="center">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : filteredSellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} align="center">
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
                      const tempFilterParam = selectedTempFilterId
                        ? (categoryParam ? '&' : '?') + `tempFilterId=${encodeURIComponent(selectedTempFilterId)}&tempFilterLabel=${encodeURIComponent(sidebarTempFilters.find(f => f.id === selectedTempFilterId)?.label || '')}`
                        : '';
                      const hasParam = categoryParam || tempFilterParam;
                      const sortParam = `${hasParam ? '&' : '?'}sortBy=${encodeURIComponent(sortBy)}&sortOrder=${encodeURIComponent(sortOrder)}`;
                      // 営業担当フィルターが適用中の場合、通話モードのNEXTボタンにも同じ絞り込みを反映させる
                      const vaParam = visitAssigneeFilter.length === 1 ? `&visitAssignee=${encodeURIComponent(visitAssigneeFilter[0])}` : '';
                      navigate(`/sellers/${seller.id}/call${categoryParam}${tempFilterParam}${sortParam}${vaParam}`);
                    }}
                    sx={{
                      cursor: 'pointer',
                      ...(seller.exclusiveOtherDecisionMeeting === '完了'
                        ? {
                            bgcolor: '#eeeeee',
                            '&:hover': { bgcolor: '#e0e0e0' },
                          }
                        : seller.exclusiveOtherDecisionMeetingNote && seller.exclusiveOtherDecisionMeetingNote.trim() !== ''
                        ? {
                            bgcolor: '#fce4ec',
                            '&:hover': { bgcolor: '#f8bbd0' },
                          }
                        : seller.otherDecisionCountermeasure && seller.otherDecisionCountermeasure.trim() !== ''
                        ? {
                            bgcolor: '#e3f2fd',
                            '&:hover': { bgcolor: '#bbdefb' },
                          }
                        : {}),
                    }}
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
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                        <Typography variant="body2">{seller.name}</Typography>
                        {seller.phoneNumber && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                            {seller.phoneNumber}
                          </Typography>
                        )}
                        {(seller.status || '').includes('→') ? (
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.75rem',
                              color: 'error.main',
                              fontWeight: 'bold',
                            }}
                          >
                            {seller.status}
                          </Typography>
                        ) : (
                          formatExclusionAction(seller.exclusionAction) && !(seller.status || '').includes('除外後追客中') && (
                            <Chip
                              label={formatExclusionAction(seller.exclusionAction)}
                              size="small"
                              sx={{
                                fontSize: '0.65rem',
                                height: 18,
                                bgcolor: (seller.exclusionAction || '').includes('不通') ? '#ff9800' : '#e53935',
                                color: 'white',
                                '& .MuiChip-label': { px: 0.8 },
                              }}
                            />
                          )
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                        {extractAgeFromComments(seller.comments) && (() => {
                          const ageText = extractAgeFromComments(seller.comments)!;
                          const ageNum = parseInt(ageText);
                          const isElderly = !isNaN(ageNum) && ageNum >= 65;
                          return (
                            <Typography
                              variant="body2"
                              sx={{
                                fontSize: isElderly ? '0.85rem' : '0.75rem',
                                whiteSpace: 'nowrap',
                                fontWeight: isElderly ? 'bold' : 'normal',
                              }}
                            >
                              {ageText}
                            </Typography>
                          );
                        })()}
                        {extractContactTimeFromComments(seller.comments) && (
                          <Typography variant="body2" sx={{ fontSize: '0.7rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                            {extractContactTimeFromComments(seller.comments)}
                          </Typography>
                        )}
                        {(seller.confidenceLevel || seller.confidence) && (
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.7rem',
                              whiteSpace: 'nowrap',
                              fontWeight: 'bold',
                              color: (() => {
                                const c = seller.confidenceLevel || seller.confidence || '';
                                if (c === 'A') return '#d32f2f'; // 赤
                                if (c === 'B') return '#f57c00'; // オレンジ
                                if (c === 'C') return '#388e3c'; // 緑
                                if (c === 'D') return '#757575'; // グレー
                                return 'text.secondary';
                              })(),
                            }}
                          >
                            確度{seller.confidenceLevel || seller.confidence}
                          </Typography>
                        )}
                        {!extractAgeFromComments(seller.comments) && !extractContactTimeFromComments(seller.comments) && !(seller.confidenceLevel || seller.confidence) && (
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>-</Typography>
                        )}
                      </Box>
                    </TableCell>
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
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                        {seller.propertyType && (
                          <Typography variant="body2">{seller.propertyType}</Typography>
                        )}
                        {(seller.currentStatus || '').includes('空') && (
                          <Chip
                            label="空"
                            size="small"
                            sx={{
                              fontSize: '0.65rem',
                              height: 18,
                              bgcolor: '#e3f2fd',
                              color: '#1565c0',
                              '& .MuiChip-label': { px: 0.8 },
                            }}
                          />
                        )}
                        {!seller.propertyType && !(seller.currentStatus || '').includes('空') && '-'}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {seller.valuationAmount1
                        ? `${Math.round(seller.valuationAmount1 / 10000).toLocaleString()}万円`
                        : '-'}
                    </TableCell>
                    <TableCell>{seller.site || seller.inquirySite || '-'}</TableCell>
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
        autoHideDuration={snackbarSeverity === 'info' ? null : 4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}
