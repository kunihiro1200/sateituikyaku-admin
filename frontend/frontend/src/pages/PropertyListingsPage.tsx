import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  TableSortLabel,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Badge,
  Checkbox,
  Button,
  Link,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery,
  Snackbar,
} from '@mui/material';
import { Search as SearchIcon, ClearAll as ClearAllIcon, Clear as ClearIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import api from '../services/api';
import PropertyListingDetailModal from '../components/PropertyListingDetailModal';
import PageNavigation from '../components/PageNavigation';
import BuyerIndicator from '../components/BuyerIndicator';
import { InquiryResponseButton } from '../components/InquiryResponseButton';
import PropertySidebarStatus from '../components/PropertySidebarStatus';
import { getDisplayStatus } from '../utils/atbbStatusDisplayMapper';
import { SECTION_COLORS } from '../theme/sectionColors';
import { calculatePropertyStatus, createWorkTaskMap, isPrivateStatus, getAtbbStatusColor } from '../utils/propertyListingStatusUtils';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';

// 全角→半角の正規化（NFKC）+ 小文字化
const normalizeText = (text: string): string =>
  text.normalize('NFKC').toLowerCase();

interface PropertyListing {
  id: string;
  property_number?: string;
  sidebar_status?: string;
  sales_assignee?: string;
  property_type?: string;
  address?: string;
  display_address?: string;
  seller_name?: string;
  seller_email?: string;
  seller_phone?: string;
  seller_contact?: string;
  buyer_name?: string;
  contract_date?: string;
  settlement_date?: string;
  price?: number;
  storage_location?: string;
  atbb_status?: string;
  confirmation?: '未' | '済';
  private_mail_delivery?: string;
  [key: string]: any;
}

interface WorkTask {
  property_number: string;
  publish_scheduled_date: string | null;
  [key: string]: any;
}

export default function PropertyListingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [allListings, setAllListings] = useState<PropertyListing[]>([]);
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarStatus, setSidebarStatus] = useState<string | null>(null);
  const [selectedPropertyNumber, setSelectedPropertyNumber] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // スマホ時のアコーディオン開閉状態
  const [mobileAccordionExpanded, setMobileAccordionExpanded] = useState(false);
  const [buyerCounts, setBuyerCounts] = useState<Record<string, number>>({});
  const [highConfidenceProperties, setHighConfidenceProperties] = useState<Set<string>>(new Set());
  const [selectedPropertyNumbers, setSelectedPropertyNumbers] = useState<Set<string>>(new Set());
  const [lastFilter, setLastFilter] = useState<'sidebar' | 'search' | null>(null);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const isFetchingRef = useRef(false); // 二重フェッチ防止フラグ
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // ソート用state
  type PropertySortKey = 'property_number' | 'sales_assignee' | 'property_type' | 'address' | 'display_address' | 'seller_name' | 'atbb_status' | 'buyer_name' | 'contract_date' | 'settlement_date' | 'price';
  const [sortBy, setSortBy] = useState<PropertySortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: PropertySortKey) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(0);
  };

  // 状態を復元
  useEffect(() => {
    const savedState = location.state as any;
    if (savedState) {
      if (savedState.page !== undefined) setPage(savedState.page);
      if (savedState.rowsPerPage !== undefined) setRowsPerPage(savedState.rowsPerPage);
      if (savedState.searchQuery !== undefined) setSearchQuery(savedState.searchQuery);
      if (savedState.sidebarStatus !== undefined) setSidebarStatus(savedState.sidebarStatus);
    }
  }, [location.state]);

  // 初回マウント時のデータ取得
  useEffect(() => {
    fetchAllData();
  }, []);

  // sessionStorageフラグをチェック（ページ遷移時）
  useEffect(() => {
    const needsRefresh = sessionStorage.getItem('propertyListingsNeedsRefresh');
    if (needsRefresh === 'true') {
      sessionStorage.removeItem('propertyListingsNeedsRefresh');
      fetchAllData(true); // キャッシュをクリアして再取得
    }
  }, [location.pathname]);

  // confirmation更新イベントをリッスン
  useEffect(() => {
    const handleConfirmationUpdate = (event: CustomEvent) => {
      const { propertyNumber, confirmation } = event.detail;
      
      console.log('[PropertyListingsPage] confirmation更新イベント受信:', { propertyNumber, confirmation });
      
      // ローカルステートを即座に更新
      setAllListings(prevListings => {
        const updated = prevListings.map(listing => 
          listing.property_number === propertyNumber 
            ? { ...listing, confirmation } 
            : listing
        );
        
        console.log('[PropertyListingsPage] ローカルステート更新後:', {
          物件数: updated.length,
          未完了: updated.filter(l => l.confirmation === '未').length
        });
        
        return updated;
      });
      
      // キャッシュも無効化
      pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS);
      console.log('[PropertyListingsPage] キャッシュ無効化完了');
    };

    window.addEventListener('propertyConfirmationUpdated', handleConfirmationUpdate as EventListener);
    
    return () => {
      window.removeEventListener('propertyConfirmationUpdated', handleConfirmationUpdate as EventListener);
    };
  }, []);

  // privateMailDelivery更新イベントをリッスン
  useEffect(() => {
    const handlePrivateMailDeliveryUpdate = (event: CustomEvent) => {
      const { propertyNumber, value } = event.detail;
      setAllListings(prevListings =>
        prevListings.map(listing =>
          listing.property_number === propertyNumber
            ? { ...listing, private_mail_delivery: value }
            : listing
        )
      );
      pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS);
    };

    window.addEventListener('privateMailDeliveryUpdated', handlePrivateMailDeliveryUpdate as EventListener);
    return () => {
      window.removeEventListener('privateMailDeliveryUpdated', handlePrivateMailDeliveryUpdate as EventListener);
    };
  }, []);

  // 値下げ予約日更新イベントをリッスン
  useEffect(() => {
    const handlePriceReductionUpdate = (event: CustomEvent) => {
      const { propertyNumber, priceReductionScheduledDate } = event.detail;
      setAllListings(prevListings =>
        prevListings.map(listing =>
          listing.property_number === propertyNumber
            ? { ...listing, price_reduction_scheduled_date: priceReductionScheduledDate }
            : listing
        )
      );
      pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS);
    };
    window.addEventListener('propertyPriceReductionUpdated', handlePriceReductionUpdate as EventListener);
    return () => {
      window.removeEventListener('propertyPriceReductionUpdated', handlePriceReductionUpdate as EventListener);
    };
  }, []);

  // 一般媒介非公開（仮）更新イベントをリッスン
  useEffect(() => {
    const handleGeneralMediationPrivateUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ propertyNumber: string; value: string }>;
      const { propertyNumber, value } = customEvent.detail;
      setAllListings(prev => prev.map(l =>
        l.property_number === propertyNumber
          ? { ...l, general_mediation_private: value }
          : l
      ));
    };
    window.addEventListener('generalMediationPrivateUpdated', handleGeneralMediationPrivateUpdated);
    return () => {
      window.removeEventListener('generalMediationPrivateUpdated', handleGeneralMediationPrivateUpdated);
    };
  }, []);

  const fetchAllData = async (forceRefresh = false) => {
    // 二重フェッチ防止（キャッシュヒット時は除く）
    if (isFetchingRef.current && !forceRefresh) return;

    // キャッシュが有効な場合はAPIを叩かない
    if (!forceRefresh) {
      const cached = pageDataCache.get<PropertyListing[]>(CACHE_KEYS.PROPERTY_LISTINGS);
      if (cached) {
        console.log('[PropertyListingsPage] キャッシュからデータを取得:', {
          件数: cached.length,
          未完了: cached.filter(l => l.confirmation === '未').length
        });
        setAllListings(cached);
        setIsLoadingAll(false);
        setLoading(false);
        // キャッシュヒット時も業務依頼データは取得する（workTaskMapが空にならないように）
        try {
          const workTasksRes = await api.get('/api/work-tasks', { params: { limit: 5000 } });
          const workTasksData = Array.isArray(workTasksRes.data?.data) ? workTasksRes.data.data : [];
          setWorkTasks(workTasksData);
        } catch (e) {
          console.error('業務依頼データ取得エラー（キャッシュ時）:', e);
        }
        return;
      }
    }

    isFetchingRef.current = true;

    try {
      setLoading(true);
      setIsLoadingAll(true); // フェッチ開始時に必ずtrueにリセット

      const allListingsData: PropertyListing[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;
      let isFirstBatch = true;

      console.log('物件データを取得中...');

      while (hasMore) {
        const listingsRes = await api.get('/api/property-listings', {
          params: { limit, offset, orderBy: 'distribution_date', orderDirection: 'desc' },
        });

        const fetchedData = listingsRes.data.data || [];
        allListingsData.push(...fetchedData);

        console.log(`取得: ${offset + 1}～${offset + fetchedData.length}件 / 合計${listingsRes.data.total}件`);

        // 最初のバッチを取得したら即座に表示（ローディングを解除）
        if (isFirstBatch) {
          isFirstBatch = false;
          setAllListings([...allListingsData]);
          setLoading(false);
        }

        if (fetchedData.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
          // バックグラウンドで残りを取得しながら随時更新
          setAllListings([...allListingsData]);
        }
      }

      // 業務依頼データを取得
      console.log('業務依頼データを取得中...');
      const workTasksRes = await api.get('/api/work-tasks', { params: { limit: 5000 } });
      const workTasksData = Array.isArray(workTasksRes.data?.data) ? workTasksRes.data.data : [];
      setWorkTasks(workTasksData);
      console.log('✅ 業務依頼データ取得成功:', { 件数: workTasksData.length });

      // キャッシュに保存（5分間有効）
      pageDataCache.set(CACHE_KEYS.PROPERTY_LISTINGS, allListingsData, 5 * 60 * 1000);
      // allListingsとisLoadingAllを同時に更新することでRenderを1回にまとめる
      setAllListings(allListingsData);
      setIsLoadingAll(false);

      console.log('[PropertyListingsPage] APIからデータを取得:', {
        物件数: allListingsData.length,
        未完了: allListingsData.filter(l => l.confirmation === '未').length
      });

      console.log('✅ データ取得成功:', { 物件数: allListingsData.length });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // workTaskMapを作成（useMemoで最適化）
  const workTaskMap = useMemo(() => {
    return createWorkTaskMap(workTasks);
  }, [workTasks]);

  // フィルタリング（全件読み込み完了前は検索を適用しない）
  const filteredListings = useMemo(() => {
    if (isLoadingAll && searchQuery.trim()) return [];
    let listings = allListings;

    // サイドバーと検索は排他的（後から操作した方がもう一方をクリアするため、両方独立適用でOK）
    if (sidebarStatus && sidebarStatus !== 'all') {
      if (sidebarStatus === '未完了') {
        // 「未完了」：confirmation === '未' の物件をフィルタリング
        listings = listings.filter(l => l.confirmation === '未');
      } else if (sidebarStatus === '要値下げ') {
        // 「要値下げ」はDBのsidebar_statusに保存されないため、calculatePropertyStatusで判定
        listings = listings.filter(l => calculatePropertyStatus(l as any).key === 'price_reduction_due');
      } else if (sidebarStatus.startsWith('未報告')) {
        // 「未報告」または「未報告{担当者イニシャル}」：calculatePropertyStatusで動的に判定
        console.log('[未報告フィルター] sidebarStatus:', sidebarStatus);
        listings = listings.filter(l => {
          const status = calculatePropertyStatus(l as any, workTaskMap);
          // デバッグログ: ラベルの比較
          if (status.key === 'unreported') {
            console.log('[未報告フィルター] 物件:', l.property_number, 'ラベル:', status.label, '一致:', status.label === sidebarStatus);
          }
          // スペースを除去して比較（「未報告 林」と「未報告林」を同一視）
          const normalizedStatusLabel = status.label.replace(/\s+/g, '');
          const normalizedSidebarStatus = sidebarStatus.replace(/\s+/g, '');
          return normalizedStatusLabel === normalizedSidebarStatus;
        });
      } else if (sidebarStatus === '本日公開予定') {
        // 「本日公開予定」: calculatePropertyStatusで判定のみ（動的判定を優先）
        // DBのsidebar_statusが'本日公開予定'でもATBB状況が'公開中'に変わっていれば除外する
        listings = listings.filter(l =>
          calculatePropertyStatus(l as any, workTaskMap).key === 'today_publish'
        );
      } else if (sidebarStatus === 'SUUMO URL　要登録') {
        // 「SUUMO URL 要登録」は動的判定（DBのsidebar_statusに依存しない）
        listings = listings.filter(l => calculatePropertyStatus(l as any, workTaskMap).key === 'suumo_required');
      } else if (sidebarStatus === 'レインズ登録＋SUUMO URL 要登録') {
        // 「レインズ登録＋SUUMO URL 要登録」は動的判定（DBのsidebar_statusに依存しない）
        listings = listings.filter(l => calculatePropertyStatus(l as any, workTaskMap).key === 'reins_suumo_required');
      } else if (['Y専任公開中', '麻専任公開中', '久専任公開中', 'U専任公開中', '林・専任公開中', '林専任公開中', 'K専任公開中', 'R専任公開中', 'I専任公開中'].includes(sidebarStatus)) {
        // 担当者別専任公開中：sidebar_statusが一致するか、古いデータ('専任・公開中')でsales_assigneeが一致するものを含む
        const assigneeMap: Record<string, string[]> = {
          'Y専任公開中': ['山本'], '麻専任公開中': ['麻生'], '久専任公開中': ['久', '久米'],
          'U専任公開中': ['裏'], '林・専任公開中': ['林'], 'K専任公開中': ['国広'],
          '林専任公開中': ['林田'], 'R専任公開中': ['木村'], 'I専任公開中': ['角井'],
        };
        const targetAssignees = assigneeMap[sidebarStatus] || [];
        listings = listings.filter(l =>
          l.sidebar_status === sidebarStatus ||
          (l.sidebar_status === '専任・公開中' && targetAssignees.includes(l.sales_assignee || '')) ||
          // sidebar_statusが「未報告 X」形式で担当者が一致する物件も含める
          ((l.sidebar_status || '').replace(/\s+/g, '').startsWith('未報告') &&
            l.atbb_status === '専任・公開中' && targetAssignees.includes(l.sales_assignee || ''))
        );
      } else if (sidebarStatus === '非公開予定（確認後）') {
        // 「非公開予定（確認後）」: calculatePropertyStatus() の結果で判定（カウントとの一致を保証）
        listings = listings.filter(l => calculatePropertyStatus(l as any, workTaskMap).key === 'private_pending');
      } else if (sidebarStatus === '非公開（配信メール）要') {
        // 「非公開（配信メール）要」: atbb_status === '非公開（配信メールのみ）' かつ private_mail_delivery === '未'
        listings = listings.filter(l =>
          l.atbb_status === '非公開（配信メールのみ）' && l.private_mail_delivery === '未'
        );
      } else {
        listings = listings.filter(l => l.sidebar_status === sidebarStatus);
      }
    }
    if (searchQuery.trim()) {
      const query = normalizeText(searchQuery);
      listings = listings.filter(l =>
        (l.property_number ? normalizeText(l.property_number) : '').includes(query) ||
        (l.address ? normalizeText(l.address) : '').includes(query) ||
        (l.display_address ? normalizeText(l.display_address) : '').includes(query) ||
        (l.seller_name ? normalizeText(l.seller_name) : '').includes(query) ||
        (l.seller_email ? normalizeText(l.seller_email) : '').includes(query) ||
        (l.seller_phone ? normalizeText(l.seller_phone) : '').includes(query) ||
        (l.seller_contact ? normalizeText(l.seller_contact) : '').includes(query) ||
        (l.buyer_name ? normalizeText(l.buyer_name) : '').includes(query) ||
        (l.property_type ? normalizeText(l.property_type) : '').includes(query) ||
        (l.price != null ? normalizeText(String(l.price)) === query : false)
      );
    }

    // ソート: 非公開物件を後ろに配置し、同一ステータス内は公開日（distribution_date）降順
    const isExclusivePublicStatus = ['Y専任公開中', '麻専任公開中', '久専任公開中', 'U専任公開中', '林・専任公開中', '林専任公開中', 'K専任公開中', 'R専任公開中', 'I専任公開中'].includes(sidebarStatus || '');
    listings = listings.sort((a, b) => {
      const aIsPrivate = isPrivateStatus(a.atbb_status);
      const bIsPrivate = isPrivateStatus(b.atbb_status);
      
      // 非公開ステータスが異なる場合、非公開を後ろに
      if (aIsPrivate !== bIsPrivate) {
        return aIsPrivate ? 1 : -1;
      }
      
      // 専任公開中（担当者別）の場合は公開日（distribution_date）降順でソート
      if (isExclusivePublicStatus) {
        const aDate = a.distribution_date ? new Date(a.distribution_date).getTime() : 0;
        const bDate = b.distribution_date ? new Date(b.distribution_date).getTime() : 0;
        return bDate - aDate;
      }
      
      // その他は元の順序を維持（公開日の新しい順）
      return 0;
    });

    return listings;
  }, [allListings, sidebarStatus, searchQuery, workTaskMap]);

  // ユーザーソートを適用したリスト
  const sortedListings = useMemo(() => {
    if (!sortBy) return filteredListings;
    return [...filteredListings].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortBy) {
        case 'property_number':
          aVal = a.property_number || '';
          bVal = b.property_number || '';
          break;
        case 'sales_assignee':
          aVal = a.sales_assignee || '';
          bVal = b.sales_assignee || '';
          break;
        case 'property_type':
          aVal = a.property_type || '';
          bVal = b.property_type || '';
          break;
        case 'address':
          aVal = a.address || '';
          bVal = b.address || '';
          break;
        case 'display_address':
          aVal = a.display_address || '';
          bVal = b.display_address || '';
          break;
        case 'seller_name':
          aVal = a.seller_name || '';
          bVal = b.seller_name || '';
          break;
        case 'atbb_status':
          aVal = a.atbb_status || '';
          bVal = b.atbb_status || '';
          break;
        case 'buyer_name':
          aVal = a.buyer_name || '';
          bVal = b.buyer_name || '';
          break;
        case 'contract_date':
          aVal = a.contract_date || '';
          bVal = b.contract_date || '';
          break;
        case 'settlement_date':
          aVal = a.settlement_date || '';
          bVal = b.settlement_date || '';
          break;
        case 'price':
          aVal = a.price ?? 0;
          bVal = b.price ?? 0;
          break;
      }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal), 'ja');
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredListings, sortBy, sortOrder]);

  const paginatedListings = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedListings.slice(start, start + rowsPerPage);
  }, [sortedListings, page, rowsPerPage]);

  const prevPropertyNumbersRef = useRef<string>('');

  // 買主カウントを取得
  useEffect(() => {
    const fetchBuyerCounts = async () => {
      const propertyNumbers = paginatedListings
        .map(l => l.property_number)
        .filter(Boolean) as string[];

      const propertyNumbersKey = propertyNumbers.sort().join(',');

      if (propertyNumbersKey === prevPropertyNumbersRef.current) return;
      prevPropertyNumbersRef.current = propertyNumbersKey;

      if (propertyNumbers.length > 0) {
        try {
          const response = await api.get('/api/property-listings/buyer-counts/batch', {
            params: { propertyNumbers: propertyNumbers.join(',') }
          });
          setBuyerCounts(prevCounts => ({ ...prevCounts, ...response.data }));
        } catch (error) {
          console.error('Failed to fetch buyer counts:', error);
        }
      }
    };

    fetchBuyerCounts();
  }, [paginatedListings]);

  // 高確度買主を持つ物件リストを取得
  useEffect(() => {
    const fetchHighConfidenceProperties = async () => {
      try {
        const response = await api.get('/api/property-listings/high-confidence-buyers/list');
        setHighConfidenceProperties(new Set(response.data));
      } catch (error) {
        console.error('Failed to fetch high confidence properties:', error);
      }
    };
    fetchHighConfidenceProperties();
  }, []);

  const handleRowClick = (propertyNumber: string) => {
    console.log('[handleRowClick] called with:', propertyNumber);

    // 状態を保存（全ての遷移で共通）
    const currentState = {
      page,
      rowsPerPage,
      searchQuery,
      sidebarStatus,
      lastFilter,
    };
    sessionStorage.setItem('propertyListState', JSON.stringify(currentState));

    // 「未報告」カテゴリー選択中は報告ページへ直接遷移
    if (sidebarStatus && sidebarStatus.startsWith('未報告')) {
      console.log('[handleRowClick] 報告ページへ直接遷移');
      navigate(`/property-listings/${propertyNumber}/report`, {
        state: { fromUnreported: true, sidebarStatus },
      });
      return;
    }

    // 「レインズ登録＋SUUMO URL 要登録」カテゴリー選択中はレインズ登録ページへ直接遷移
    if (sidebarStatus === 'レインズ登録＋SUUMO URL 要登録') {
      console.log('[handleRowClick] レインズ登録ページへ直接遷移');
      navigate(`/property-listings/${propertyNumber}/reins-registration`);
      return;
    }

    // その他は物件詳細ページへ遷移
    console.log('[handleRowClick] navigating to:', `/property-listings/${propertyNumber}`);
    navigate(`/property-listings/${propertyNumber}`);
  };

  const handleSelectProperty = (propertyNumber: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelected = new Set(selectedPropertyNumbers);
    if (newSelected.has(propertyNumber)) {
      newSelected.delete(propertyNumber);
    } else {
      newSelected.add(propertyNumber);
    }
    setSelectedPropertyNumbers(newSelected);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const allPropertyNumbers = new Set(
        paginatedListings.map(l => l.property_number).filter(Boolean) as string[]
      );
      setSelectedPropertyNumbers(allPropertyNumbers);
    } else {
      setSelectedPropertyNumbers(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedPropertyNumbers(new Set());
  };

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

  const selectedProperties = useMemo(() => {
    return allListings.filter(l =>
      l.property_number && selectedPropertyNumbers.has(l.property_number)
    );
  }, [allListings, selectedPropertyNumbers]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('ja-JP');
    } catch {
      return dateStr;
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return '-';
    return `${(price / 10000).toLocaleString()}万円`;
  };

  return (
    <Container maxWidth="xl" sx={isMobile ? { overflowX: 'hidden', px: 1, py: 2 } : { py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isMobile ? 1 : 2, flexDirection: { xs: 'row', sm: 'row' }, gap: 1 }}>
        <Typography variant={isMobile ? 'subtitle1' : 'h5'} fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>物件リスト</Typography>

      </Box>

      <PageNavigation />

      <Box sx={{ display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
        {/* 左サイドバー - サイドバーステータス */}
        {/* モバイル：ステータスサイドバーをアコーディオンで表示 */}
        {isMobile && (
          <Accordion
            expanded={mobileAccordionExpanded}
            onChange={(_, expanded) => setMobileAccordionExpanded(expanded)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={
                sidebarStatus && sidebarStatus !== 'all'
                  ? { bgcolor: `${SECTION_COLORS.property.main}15` }
                  : {}
              }
            >
              <Typography variant="body1" fontWeight="bold">
                ステータスフィルター
                {sidebarStatus && sidebarStatus !== 'all' && (
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ ml: 1, color: SECTION_COLORS.property.main }}
                  >
                    ({sidebarStatus})
                  </Typography>
                )}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1 }}>
              <PropertySidebarStatus
                key={`sidebar-mobile-${allListings.length}-${allListings.filter(l => l.confirmation === '未').length}-${allListings.filter(l => l.private_mail_delivery === '未').length}`}
                listings={allListings}
                selectedStatus={sidebarStatus}
                onStatusChange={(status) => {
                  setSidebarStatus(status);
                  setSearchQuery('');
                  setLastFilter('sidebar');
                  setPage(0);
                  setMobileAccordionExpanded(false);
                }}
                workTaskMap={workTaskMap}
              />
            </AccordionDetails>
          </Accordion>
        )}

        {/* デスクトップ：サイドバー形式 */}
        {!isMobile && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <PropertySidebarStatus
            key={`sidebar-${allListings.length}-${allListings.filter(l => l.confirmation === '未').length}-${allListings.filter(l => l.private_mail_delivery === '未').length}`}
            listings={allListings}
            selectedStatus={sidebarStatus}
            onStatusChange={(status) => { setSidebarStatus(status); setSearchQuery(''); setLastFilter('sidebar'); setPage(0); }}
            workTaskMap={workTaskMap}
          />
        </Box>
        )}

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="物件番号、所在地、売主、売主電話番号、買主、種別で検索"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSidebarStatus(null); setLastFilter('search'); setPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {isLoadingAll && searchQuery.trim() ? (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', whiteSpace: 'nowrap' }}>検索中...</Typography>
                    ) : (
                      <SearchIcon />
                    )}
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => { setSearchQuery(''); setPage(0); }}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Paper>

          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Paper sx={{ flex: 1 }}>
              <TablePagination
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={filteredListings.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                labelRowsPerPage="表示件数:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
              />
            </Paper>

            {selectedPropertyNumbers.size > 0 && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: SECTION_COLORS.property.main }}>
                  {selectedPropertyNumbers.size}件選択中
                </Typography>
                <Button size="small" startIcon={<ClearAllIcon />} onClick={handleClearSelection}>
                  選択解除
                </Button>
                <InquiryResponseButton
                  selectedProperties={selectedProperties}
                  onSuccess={() => { handleClearSelection(); }}
                />
              </Box>
            )}
          </Box>

          <TableContainer component={Paper} sx={isMobile ? { display: 'none' } : {}}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={
                        selectedPropertyNumbers.size > 0 &&
                        selectedPropertyNumbers.size < paginatedListings.filter(l => l.property_number).length
                      }
                      checked={
                        paginatedListings.filter(l => l.property_number).length > 0 &&
                        selectedPropertyNumbers.size === paginatedListings.filter(l => l.property_number).length
                      }
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'property_number'}
                      direction={sortBy === 'property_number' ? sortOrder : 'asc'}
                      onClick={() => handleSort('property_number')}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                    >
                      物件番号
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'sales_assignee'}
                      direction={sortBy === 'sales_assignee' ? sortOrder : 'asc'}
                      onClick={() => handleSort('sales_assignee')}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                    >
                      担当
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'property_type'}
                      direction={sortBy === 'property_type' ? sortOrder : 'asc'}
                      onClick={() => handleSort('property_type')}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                    >
                      種別
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'address'}
                      direction={sortBy === 'address' ? sortOrder : 'asc'}
                      onClick={() => handleSort('address')}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                    >
                      所在地
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'display_address'}
                      direction={sortBy === 'display_address' ? sortOrder : 'asc'}
                      onClick={() => handleSort('display_address')}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                    >
                      住居表示
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'seller_name'}
                      direction={sortBy === 'seller_name' ? sortOrder : 'asc'}
                      onClick={() => handleSort('seller_name')}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                    >
                      売主
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'atbb_status'}
                      direction={sortBy === 'atbb_status' ? sortOrder : 'asc'}
                      onClick={() => handleSort('atbb_status')}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                    >
                      ATBB状況
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'buyer_name'}
                      direction={sortBy === 'buyer_name' ? sortOrder : 'asc'}
                      onClick={() => handleSort('buyer_name')}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                    >
                      買主
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'contract_date'}
                      direction={sortBy === 'contract_date' ? sortOrder : 'asc'}
                      onClick={() => handleSort('contract_date')}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                    >
                      契約日
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'settlement_date'}
                      direction={sortBy === 'settlement_date' ? sortOrder : 'asc'}
                      onClick={() => handleSort('settlement_date')}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                    >
                      決済日
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'price'}
                      direction={sortBy === 'price' ? sortOrder : 'asc'}
                      onClick={() => handleSort('price')}
                      sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                    >
                      売買価格
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center">読み込み中...</TableCell>
                  </TableRow>
                ) : paginatedListings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center">
                      {isLoadingAll && searchQuery.trim() ? '検索中...' : '物件データが見つかりませんでした'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedListings.map((listing) => {
                    const isSelected = listing.property_number ? selectedPropertyNumbers.has(listing.property_number) : false;
                    return (
                      <TableRow
                        key={listing.id}
                        hover
                        onClick={() => listing.property_number && handleRowClick(listing.property_number)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: isSelected
                            ? 'action.selected'
                            : isPrivateStatus(listing.atbb_status)
                              ? 'rgba(0, 0, 0, 0.04)'
                              : 'inherit'
                        }}
                      >
                        <TableCell padding="checkbox" onClick={(e) => { e.stopPropagation(); listing.property_number && handleSelectProperty(listing.property_number, e); }}>
                          <Checkbox checked={isSelected} />
                        </TableCell>
                        <TableCell>
                          <Box
                            onClick={(e) => listing.property_number && handleCopyPropertyNumber(listing.property_number, e)}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                              cursor: listing.property_number ? 'pointer' : 'default',
                              '&:hover .copy-icon': { visibility: 'visible' },
                            }}
                          >
                            <Typography variant="body2" sx={{ color: SECTION_COLORS.property.main }} fontWeight="bold">
                              {listing.property_number || '-'}
                            </Typography>
                            {listing.property_number && (
                              <ContentCopyIcon
                                className="copy-icon"
                                sx={{ fontSize: 14, color: SECTION_COLORS.property.main, visibility: 'hidden' }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>{listing.sales_assignee || '-'}</TableCell>
                        <TableCell>
                          {listing.property_type && <Chip label={listing.property_type} size="small" />}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {listing.address || listing.display_address || '-'}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {listing.display_address || '-'}
                        </TableCell>
                        <TableCell>{listing.seller_name || '-'}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ color: getAtbbStatusColor(listing.atbb_status), fontWeight: 500 }}
                          >
                            {getDisplayStatus(listing.atbb_status) || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {listing.property_number && (
                            <BuyerIndicator
                              propertyNumber={listing.property_number}
                              buyerCount={buyerCounts[listing.property_number]}
                              hasHighConfidence={highConfidenceProperties.has(listing.property_number)}
                            />
                          )}
                        </TableCell>
                        <TableCell>{formatDate(listing.contract_date)}</TableCell>
                        <TableCell>{formatDate(listing.settlement_date)}</TableCell>
                        <TableCell>{formatPrice(listing.price)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[25, 50, 100]}
              component="div"
              count={filteredListings.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              labelRowsPerPage="表示件数:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
            />
          </TableContainer>

          {/* モバイル：カードリスト表示 */}
          {isMobile && (
            <Box>
              {loading ? (
                <Typography align="center" sx={{ py: 4, fontSize: '14px' }}>読み込み中...</Typography>
              ) : paginatedListings.length === 0 ? (
                <Typography align="center" sx={{ py: 4, fontSize: '14px' }}>
                  {isLoadingAll && searchQuery.trim() ? '検索中...' : '物件データが見つかりませんでした'}
                </Typography>
              ) : (
                paginatedListings.map((listing) => {
                  const propertyStatus = calculatePropertyStatus(listing as any, workTaskMap);
                  return (
                    <Card
                      key={listing.id}
                      onClick={() => listing.property_number && handleRowClick(listing.property_number)}
                      sx={{
                        mb: 1,
                        cursor: 'pointer',
                        minHeight: 44,
                        bgcolor: isPrivateStatus(listing.atbb_status)
                          ? 'rgba(0, 0, 0, 0.04)'
                          : 'inherit',
                        '&:hover': { bgcolor: 'grey.50' },
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                          <Box
                            onClick={(e) => listing.property_number && handleCopyPropertyNumber(listing.property_number, e)}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                              cursor: listing.property_number ? 'pointer' : 'default',
                            }}
                          >
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              sx={{ color: SECTION_COLORS.property.main, fontSize: '14px' }}
                            >
                              {listing.property_number || '-'}
                            </Typography>
                            {listing.property_number && (
                              <ContentCopyIcon
                                sx={{ fontSize: 14, color: SECTION_COLORS.property.main }}
                              />
                            )}
                          </Box>
                          <Chip
                            label={propertyStatus.label}
                            size="small"
                            sx={{ height: 22, fontSize: '12px', bgcolor: propertyStatus.color, color: '#fff' }}
                          />
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '14px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: 0.5,
                          }}
                        >
                          {listing.address || listing.display_address || '-'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          {listing.property_type && (
                            <Chip label={listing.property_type} size="small" sx={{ height: 20, fontSize: '12px' }} />
                          )}
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontSize: '14px' }}
                          >
                            {formatPrice(listing.price)}
                          </Typography>
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
                  count={filteredListings.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                  labelRowsPerPage="件数:"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
                />
              </Paper>
            </Box>
          )}
        </Box>
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <PropertyListingDetailModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedPropertyNumber(null); }}
        propertyNumber={selectedPropertyNumber}
        onUpdate={() => fetchAllData(true)}
      />
    </Container>
  );
}
