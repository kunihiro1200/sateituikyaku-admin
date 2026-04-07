import { useState, useEffect, useRef } from 'react';
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
  Button,
  CircularProgress,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Search as SearchIcon, Sync as SyncIcon, Clear as ClearIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import PageNavigation from '../components/PageNavigation';
import BuyerStatusSidebar, { BuyerWithStatus } from '../components/BuyerStatusSidebar';
import { SECTION_COLORS } from '../theme/sectionColors';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';

interface Buyer {
  id: string;
  buyer_number: string;
  name: string;
  phone_number: string;
  email: string;
  property_number: string;
  latest_status: string;
  initial_assignee: string;
  follow_up_assignee: string;
  inquiry_confidence: string;
  reception_date: string;
  next_call_date: string;
  desired_area: string;
  desired_property_type: string;
  calculated_status?: string;
  status_color?: string;
  property_address?: string;
  property_type?: string;
  atbb_status?: string;
  property_sales_assignee?: string;
}

// 全角英数字・スペースを半角に変換
function normalizeSearch(str: string): string {
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    .trim();
}

export default function BuyersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  // キャッシュがあれば初期ローディングをスキップ
  const [loading, setLoading] = useState(!pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS));
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [selectedCalculatedStatus, setSelectedCalculatedStatus] = useState<string | null>(initialStatus);

  // サイドバーのカテゴリキーを日本語の表示名に変換するマッピング
  const categoryKeyToDisplayName: Record<string, string> = {
    'viewingDayBefore': '内覧日前日',
    'visitCompleted': '内覧済み',
    'todayCall': '当日TEL',
    'todayCallWithInfo': '当日TEL（内容）',
    'threeCallUnchecked': '3回架電未',
    'inquiryEmailUnanswered': '問合メール未対応',
    'brokerInquiry': '業者問合せあり',
    'generalViewingSellerContactPending': '一般媒介_内覧後売主連絡未',
    'viewingPromotionRequired': '要内覧促進客',
    'pinrichUnregistered': 'ピンリッチ未登録',
    'unvaluated': '未査定',
    'mailingPending': '査定（郵送）',
    'todayCallNotStarted': '当日TEL_未着手',
    'pinrichEmpty': 'Pinrich空欄',
    'todayCallAssigned': '当日TEL（担当）',
    'visitAssigned': '担当',
    'exclusive': '専任',
    'general': '一般',
    'visitOtherDecision': '内覧後他決',
    'unvisitedOtherDecision': '未内覧他決',
  };

  // キャッシュから初期データを取得
  const cachedData = pageDataCache.get<{ categoryCounts: any; buyers: BuyerWithStatus[]; normalStaffInitials: string[] }>(CACHE_KEYS.BUYERS_WITH_STATUS);
  // 全買主データ（フロントキャッシュ）
  const allBuyersWithStatusRef = useRef<BuyerWithStatus[]>(cachedData?.buyers ?? []);
  // サイドバーデータ読み込み済みフラグ
  const sidebarLoadedRef = useRef<boolean>(!!cachedData);
  // テーブル再描画用のトリガー
  const [dataReady, setDataReady] = useState(!!cachedData);
  // サイドバー表示用カウント（BuyersPage が管理して prop で渡す）
  const [sidebarCounts, setSidebarCounts] = useState<any>(cachedData?.categoryCounts ?? null);
  const [sidebarNormalStaffInitials, setSidebarNormalStaffInitials] = useState<string[]>(cachedData?.normalStaffInitials ?? []);
  const [sidebarLoading, setSidebarLoading] = useState(!cachedData);

  // 検索入力のdebounce（300ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;

    const fetchBuyers = async () => {
      try {
        // サイドバーデータ読み込み済みの場合はフロント側でフィルタリング（APIコール不要）
        // キャッシュヒット時はsetLoading(true)をスキップして画面のちらつきを防ぐ
        // ただし、全件データ未取得時でもselectedCalculatedStatusが指定されている場合はAPIにフィルタパラメータを渡す
        if (sidebarLoadedRef.current && allBuyersWithStatusRef.current.length > 0) {
          let filtered = selectedCalculatedStatus !== null
            ? allBuyersWithStatusRef.current.filter(b => {
                // 担当者別カテゴリ（assigned:Y, todayCallAssigned:I など）の処理
                if (selectedCalculatedStatus.startsWith('assigned:')) {
                  const assignee = selectedCalculatedStatus.replace('assigned:', '');
                  // バックエンドと同じロジック: follow_up_assignee が一致、または follow_up_assignee が空で initial_assignee が一致
                  const matches = (
                    b.follow_up_assignee === assignee ||
                    (!b.follow_up_assignee && b.initial_assignee === assignee)
                  );
                  
                  return matches;
                } else if (selectedCalculatedStatus.startsWith('todayCallAssigned:')) {
                  const assignee = selectedCalculatedStatus.replace('todayCallAssigned:', '');
                  // バックエンドと同じロジック: follow_up_assignee が一致 AND next_call_date が今日以前
                  // 🚨 重要：タイムゾーン問題を回避するため、JST（日本時間）で今日の日付を取得
                  const now = new Date();
                  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
                  const jstTime = new Date(now.getTime() + JST_OFFSET_MS);
                  const todayStr = jstTime.toISOString().split('T')[0];  // JST日付（YYYY-MM-DD）
                  const nextCallDateStr = b.next_call_date ? b.next_call_date.substring(0, 10) : null;
                  
                  const matches = (
                    b.follow_up_assignee === assignee &&
                    nextCallDateStr !== null &&
                    nextCallDateStr <= todayStr
                  );
                  
                  return matches;
                } else {
                  // サイドバーのカテゴリキーを日本語の表示名に変換
                  const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
                  
                  // バックエンドのcalculated_statusは既に日本語（例: "内覧日前日", "担当(Y)", "当日TEL(Y)"）
                  // フィルタリングは日本語の表示名で直接比較
                  const matches = b.calculated_status === displayName;
                  
                  return matches;
                }
              })
            : [...allBuyersWithStatusRef.current];

          // 検索フィルタ
          if (debouncedSearch) {
            const s = normalizeSearch(debouncedSearch).toLowerCase();
            const isBuyerNumber = /^\d{4,5}$/.test(s);
            filtered = filtered.filter(b => {
              if (isBuyerNumber) return (b.buyer_number || '') === s;
              return (
                (b.buyer_number || '').toLowerCase().includes(s) ||
                (b.name || '').toLowerCase().includes(s) ||
                (b.phone_number || '').toLowerCase().includes(s) ||
                (b.property_number || '').toLowerCase().includes(s)
              );
            });
          }

          // ソート（受付日降順）
          filtered.sort((a, b) => {
            if (!a.reception_date && !b.reception_date) return 0;
            if (!a.reception_date) return 1;
            if (!b.reception_date) return -1;
            return b.reception_date.localeCompare(a.reception_date);
          });

          const totalCount = filtered.length;
          const offset = page * rowsPerPage;
          const paged = filtered.slice(offset, offset + rowsPerPage);

          if (!cancelled) {
            setBuyers(paged as any[]);
            setTotal(totalCount);
            setLoading(false);
          }
          return;
        }

        // サイドバー未ロード時: まず最初の50件を即座に表示（プログレッシブローディング）
        setLoading(true);
        const quickParams: any = {
          page: 1,
          limit: 50,
          sortBy: 'reception_date',
          sortOrder: 'desc',
        };
        if (debouncedSearch) quickParams.search = normalizeSearch(debouncedSearch);
        
        // 全件データ未取得時でもselectedCalculatedStatusが指定されている場合はAPIにフィルタパラメータを渡す
        if (selectedCalculatedStatus) {
          // カテゴリキーを日本語表示名に変換してからAPIに渡す
          const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
          quickParams.calculatedStatus = displayName;
        }

        // 最初の50件を即座に表示
        const quickRes = await api.get('/api/buyers', { params: quickParams });
        if (!cancelled) {
          setBuyers(quickRes.data.data || []);
          setTotal(quickRes.data.total || 0);
          setLoading(false);
        }

        // 初回ロード時：サイドバーカウントのみを高速取得（Requirements 5.1: 5秒以内）
        if (!sidebarLoadedRef.current) {
          const fetchStartTime = Date.now();
          
          // ステップ1: サイドバーカウントを高速取得（300ms程度）
          api.get('/api/buyers/sidebar-counts')
            .then((sidebarRes) => {
              if (cancelled) return;
              
              const sidebarDuration = Date.now() - fetchStartTime;
              console.log(`[INFO] Sidebar counts fetched in ${sidebarDuration}ms`);  // Requirements 5.1
              
              // Requirements 5.2: 5秒超過時の警告ログ
              if (sidebarDuration > 5000) {
                console.warn(`[WARN] Sidebar fetch took ${sidebarDuration}ms (> 5000ms)`);
              }
              
              const sidebarResult = sidebarRes.data;
              
              // サイドバーのカウントを即座に更新（高速表示）
              setSidebarCounts(sidebarResult.categoryCounts);
              setSidebarNormalStaffInitials(sidebarResult.normalStaffInitials || []);
              setSidebarLoading(false);
              sidebarLoadedRef.current = true;
              
              console.log('[INFO] Sidebar displayed. Starting background fetch for full buyers data...');
              
              // ステップ2: 全件データをバックグラウンドで非同期取得（23秒かかるがサイドバー表示をブロックしない）
              const bgFetchStartTime = Date.now();
              api.get('/api/buyers/status-categories-with-buyers')
                .then((buyersRes) => {
                  if (cancelled) return;
                  
                  const bgFetchDuration = Date.now() - bgFetchStartTime;
                  console.log(`[INFO] Background buyers data fetched in ${bgFetchDuration}ms`);
                  
                  const buyersResult = buyersRes.data as {
                    categories: any[];
                    buyers: BuyerWithStatus[];
                    normalStaffInitials: string[];
                  };
                  
                  console.log('[BuyersPage] 🔍 buyersResult.buyers サンプル（最初の3件）:');
                  buyersResult.buyers.slice(0, 3).forEach(b => {
                    console.log(`  - ${b.buyer_number}: calculated_status="${b.calculated_status}", follow_up_assignee="${b.follow_up_assignee}", next_call_date="${b.next_call_date}"`);
                  });
                  
                  // キャッシュデータを構築
                  const cacheData = {
                    categoryCounts: sidebarResult.categoryCounts,
                    buyers: buyersResult.buyers,
                    normalStaffInitials: sidebarResult.normalStaffInitials || buyersResult.normalStaffInitials || []
                  };
                  
                  // 10分間キャッシュ（バックエンドキャッシュTTLと統一）
                  pageDataCache.set(CACHE_KEYS.BUYERS_WITH_STATUS, cacheData, 10 * 60 * 1000);
                  
                  // テーブルも全件データで更新
                  allBuyersWithStatusRef.current = buyersResult.buyers;
                  setDataReady(prev => !prev); // トリガー更新
                  
                  console.log('[INFO] Background fetch completed. Table data updated.');
                })
                .catch((err) => {
                  console.error('[ERROR] Background buyers fetch failed:', err);  // Requirements 5.3
                  console.error('[ERROR] Stack trace:', (err as Error).stack);  // Requirements 5.3
                });
            })
            .catch((err) => {
              console.error('[ERROR] Sidebar fetch failed:', err);  // Requirements 5.3
              console.error('[ERROR] Stack trace:', (err as Error).stack);  // Requirements 5.3
              setSidebarLoading(false);
            });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[ERROR] Failed to fetch buyers:', error);
          console.error('[ERROR] Stack trace:', (error as Error).stack);
          // APIエラー時のフォールバック処理: 空配列を設定
          setBuyers([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBuyers();
    return () => { cancelled = true; };
  }, [page, rowsPerPage, debouncedSearch, selectedCalculatedStatus, refetchTrigger]);

  // キャッシュヒット時: サイドバーカテゴリを初期化（useEffect で一度だけ実行）
  // ※ cachedData がある場合は state 初期値で設定済みなので追加処理不要

  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post('/api/buyers/sync');
      pageDataCache.invalidate(CACHE_KEYS.BUYERS_STATS);
      pageDataCache.invalidate(CACHE_KEYS.BUYERS_WITH_STATUS); // 買主ステータスキャッシュも無効化
      // サイドバーキャッシュをリセット
      allBuyersWithStatusRef.current = [];
      sidebarLoadedRef.current = false;
      setSidebarCounts(null);
      setSidebarNormalStaffInitials([]);
      setSidebarLoading(true);
      setDataReady(false);
      setRefetchTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleRowClick = (buyerId: string) => {
    // selectedCalculatedStatusはカテゴリキー（例: 'visitDayBefore'）なので、日本語表示名に変換して比較
    const displayName = categoryKeyToDisplayName[selectedCalculatedStatus || ''] || selectedCalculatedStatus;
    if (displayName === '内覧日前日') {
      navigate(`/buyers/${buyerId}/viewing-result`);
    } else {
      navigate(`/buyers/${buyerId}`);
    }
  };

  const extractConfidencePrefix = (confidence: string | null | undefined) => {
    if (!confidence) return '-';
    const match = confidence.match(/^([A-Z]+)/);
    return match ? match[1] : confidence;
  };

  const formatAtbbStatus = (atbbStatus: string | null | undefined) => {
    if (!atbbStatus) return '-';
    if (atbbStatus.includes('専任') && atbbStatus.includes('公開中')) return '専任';
    if (atbbStatus.includes('一般') && atbbStatus.includes('公開中')) return '一般';
    return atbbStatus;
  };

  const getDisplayConfidence = (buyer: Buyer) => {
    if (buyer.latest_status) {
      return {
        label: extractConfidencePrefix(buyer.latest_status),
        sx: { bgcolor: SECTION_COLORS.buyer.dark, color: '#fff' },
      };
    }
    if (buyer.inquiry_confidence) {
      return {
        label: extractConfidencePrefix(buyer.inquiry_confidence),
        sx: { bgcolor: SECTION_COLORS.buyer.light, color: '#fff' },
      };
    }
    return null;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('ja-JP');
    } catch {
      return dateStr;
    }
  };

  return (
    <Container maxWidth="xl" sx={isMobile ? { overflowX: 'hidden', px: 1, py: 2 } : { py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.buyer.main }}>買主リスト</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/buyers/other-company-distribution')}
            sx={{
              borderColor: SECTION_COLORS.buyer.main,
              color: SECTION_COLORS.buyer.main,
              '&:hover': {
                borderColor: SECTION_COLORS.buyer.dark,
                backgroundColor: `${SECTION_COLORS.buyer.main}15`,
              },
            }}
          >
            他社物件新着配信
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/buyers/new')}
            sx={{
              backgroundColor: SECTION_COLORS.buyer.main,
              '&:hover': { backgroundColor: SECTION_COLORS.buyer.dark },
            }}
          >
            新規作成
          </Button>
          <Button
            variant="outlined"
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
            onClick={handleSync}
            disabled={syncing}
            sx={{
              borderColor: SECTION_COLORS.buyer.main,
              color: SECTION_COLORS.buyer.main,
              '&:hover': {
                borderColor: SECTION_COLORS.buyer.dark,
                backgroundColor: `${SECTION_COLORS.buyer.main}15`,
              },
            }}
          >
            {syncing ? '同期中...' : 'スプレッドシートから同期'}
          </Button>
        </Box>
      </Box>

      <Box sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        bgcolor: 'background.default',
        pb: 1,
        pt: 0,
      }}>
        <PageNavigation />

      </Box>

      {/* モバイル：ステータスサイドバーをアコーディオンで表示 */}
      {isMobile && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body1" fontWeight="bold">ステータスフィルター</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1 }}>
            <BuyerStatusSidebar
              selectedStatus={selectedCalculatedStatus}
              onStatusSelect={(status) => { setSelectedCalculatedStatus(status); setPage(0); }}
              totalCount={total}
              categoryCounts={sidebarCounts}
              normalStaffInitials={sidebarNormalStaffInitials}
              loading={sidebarLoading}
            />
          </AccordionDetails>
        </Accordion>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* 左サイドバー（ステータスのみ）- デスクトップのみ */}
        {!isMobile && (
          <Paper sx={{ width: 220, flexShrink: 0, alignSelf: 'flex-start', maxHeight: 'none', overflow: 'visible' }}>
            <BuyerStatusSidebar
              selectedStatus={selectedCalculatedStatus}
              onStatusSelect={(status) => { setSelectedCalculatedStatus(status); setPage(0); }}
              totalCount={total}
              categoryCounts={sidebarCounts}
              normalStaffInitials={sidebarNormalStaffInitials}
              loading={sidebarLoading}
            />
          </Paper>
        )}

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField
              size="small"
              placeholder="検索（買主番号、氏名、電話番号、物件番号）"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              sx={isMobile ? { width: '100%' } : { width: '50%' }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <ClearIcon
                      fontSize="small"
                      sx={{ cursor: 'pointer', color: 'text.secondary' }}
                      onClick={() => { setSearchQuery(''); setPage(0); }}
                    />
                  </InputAdornment>
                ) : null,
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
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
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
              ) : buyers.length === 0 ? (
                <Typography align="center" sx={{ py: 4, fontSize: '14px' }}>買主データが見つかりませんでした</Typography>
              ) : (
                buyers.map((buyer) => {
                  const displayConfidence = getDisplayConfidence(buyer);
                  return (
                    <Card
                      key={buyer.buyer_number}
                      onClick={() => handleRowClick(buyer.buyer_number)}
                      sx={{
                        mb: 1,
                        cursor: 'pointer',
                        minHeight: 44,
                        '&:hover': { bgcolor: 'grey.50' },
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{ color: SECTION_COLORS.buyer.main, fontSize: '14px' }}
                          >
                            {buyer.buyer_number || '-'}
                          </Typography>
                          {displayConfidence && (
                            <Chip
                              label={displayConfidence.label}
                              size="small"
                              sx={{ height: 22, fontSize: '12px', ...displayConfidence.sx }}
                            />
                          )}
                        </Box>
                        <Typography
                          variant="body1"
                          fontWeight="bold"
                          sx={{ fontSize: '14px', mb: 0.5 }}
                        >
                          {buyer.name || '-'}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            fontSize: '14px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: 0.5,
                          }}
                        >
                          {buyer.desired_area || '-'}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontSize: '14px' }}
                        >
                          次電: {formatDate(buyer.next_call_date)}
                        </Typography>
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
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
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
                  <TableCell>買主番号</TableCell>
                  <TableCell>氏名</TableCell>
                  <TableCell>物件所在地</TableCell>
                  <TableCell>物件担当</TableCell>
                  <TableCell>種別</TableCell>
                  <TableCell>atbb_status</TableCell>
                  <TableCell>確度</TableCell>
                  <TableCell>受付日</TableCell>
                  <TableCell>次電日</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">読み込み中...</TableCell>
                  </TableRow>
                ) : buyers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">買主データが見つかりませんでした</TableCell>
                  </TableRow>
                ) : (
                  buyers.map((buyer) => {
                    const displayConfidence = getDisplayConfidence(buyer);
                    return (
                      <TableRow
                        key={buyer.buyer_number}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleRowClick(buyer.buyer_number)}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: SECTION_COLORS.buyer.main }}>
                            {buyer.buyer_number || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{buyer.name || '-'}</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {buyer.property_address || '-'}
                        </TableCell>
                        <TableCell>{buyer.property_sales_assignee || '-'}</TableCell>
                        <TableCell>{buyer.property_type || '-'}</TableCell>
                        <TableCell>{formatAtbbStatus(buyer.atbb_status)}</TableCell>
                        <TableCell>
                          {displayConfidence && (
                            <Chip
                              label={displayConfidence.label}
                              size="small"
                              sx={{ height: 20, fontSize: '0.75rem', ...displayConfidence.sx }}
                            />
                          )}
                        </TableCell>
                        <TableCell>{formatDate(buyer.reception_date)}</TableCell>
                        <TableCell>{formatDate(buyer.next_call_date)}</TableCell>
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
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              labelRowsPerPage="表示件数:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
            />
          </TableContainer>
          )}
        </Box>
      </Box>
    </Container>
  );
}
