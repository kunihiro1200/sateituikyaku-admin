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
    'visitDayBefore': '内覧日前日',  // ✅ 買主用（バックエンドと一致）
    'visitCompleted': '内覧済み',    // ✅ 買主用（バックエンドと一致）
    'todayCall': '当日TEL',
    'todayCallWithInfo': '当日TEL（内容）',
    'unvaluated': '未査定',
    'mailingPending': '査定（郵送）',
    'todayCallNotStarted': '当日TEL_未着手',
    'pinrichEmpty': 'Pinrich空欄',
    'todayCallAssigned': '当日TEL（担当）',
    'visitAssigned': '担当',  // ✅ 買主用（バックエンドと一致）
    'exclusive': '専任',
    'general': '一般',
    'visitOtherDecision': '内覧後他決',  // ✅ 買主用（バックエンドと一致）
    'unvisitedOtherDecision': '未内覧他決',  // ✅ 買主用（バックエンドと一致）
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
        if (sidebarLoadedRef.current && allBuyersWithStatusRef.current.length > 0) {
          let filtered = selectedCalculatedStatus !== null
            ? allBuyersWithStatusRef.current.filter(b => {
                // サイドバーのカテゴリキーを日本語の表示名に変換
                const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
                
                // 完全一致または部分一致（担当者別カテゴリ対応）
                // 例: displayName = "担当" の場合、"担当(林)" や "担当(Y)" にマッチ
                // 例: displayName = "内覧日前日" の場合、"内覧日前日" に完全一致
                const matches = b.calculated_status === displayName || b.calculated_status?.startsWith(displayName + '(');
                return matches;
              })
            : [...allBuyersWithStatusRef.current];


          console.log('[BuyersPage] filtered.length:', filtered.length);

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

        // 最初の50件を即座に表示
        const quickRes = await api.get('/api/buyers', { params: quickParams });
        if (!cancelled) {
          setBuyers(quickRes.data.data || []);
          setTotal(quickRes.data.total || 0);
          setLoading(false);
        }

        // バックグラウンドでサイドバーカウントと全件データを並列取得
        if (!sidebarLoadedRef.current) {
          Promise.all([
            api.get('/api/buyers/sidebar-counts'),
            api.get('/api/buyers/status-categories-with-buyers')
          ]).then(([sidebarRes, buyersRes]) => {
            if (cancelled) return;
            const sidebarResult = sidebarRes.data;
            const buyersResult = buyersRes.data as {
              categories: any[];
              buyers: BuyerWithStatus[];
              normalStaffInitials: string[];
            };
            
            // キャッシュデータを構築
            const cacheData = {
              categoryCounts: sidebarResult, // APIから直接categoryCounts形式で返される
              buyers: buyersResult.buyers,
              normalStaffInitials: buyersResult.normalStaffInitials || []
            };
            
            // 10分間キャッシュ（バックエンドキャッシュTTLと統一）
            pageDataCache.set(CACHE_KEYS.BUYERS_WITH_STATUS, cacheData, 10 * 60 * 1000);
            
            // サイドバーのカウントを更新（高速エンドポイントから取得）
            setSidebarCounts(sidebarResult);
            setSidebarNormalStaffInitials(buyersResult.normalStaffInitials || []);
            setSidebarLoading(false);
            
            // テーブルも全件データで更新
            allBuyersWithStatusRef.current = buyersResult.buyers;
            sidebarLoadedRef.current = true;
            setDataReady(prev => !prev); // トリガー更新
          }).catch((err) => {
            console.error('Background fetch failed:', err);
            setSidebarLoading(false);
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch buyers:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBuyers();
    return () => { cancelled = true; };
  }, [page, rowsPerPage, debouncedSearch, selectedCalculatedStatus, refetchTrigger, dataReady]);

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
    if (selectedCalculatedStatus === '内覧日前日') {
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
