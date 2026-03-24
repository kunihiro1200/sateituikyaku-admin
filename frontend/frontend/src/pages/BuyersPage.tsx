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
} from '@mui/material';
import { Search as SearchIcon, Sync as SyncIcon, Clear as ClearIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
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
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [selectedCalculatedStatus, setSelectedCalculatedStatus] = useState<string | null>(null);

  // サイドバーから取得した全買主データ（フロントキャッシュ）
  // 初期値：pageDataCacheにキャッシュがあれば即座にロード済みとして扱う
  const cachedData = pageDataCache.get<{ categories: any[]; buyers: BuyerWithStatus[]; normalStaffInitials: string[] }>(CACHE_KEYS.BUYERS_WITH_STATUS);
  const allBuyersWithStatusRef = useRef<BuyerWithStatus[]>(cachedData?.buyers ?? []);
  // sidebarLoadedをrefで管理（stateにするとonBuyersLoaded呼び出しのたびにfetchBuyersが再実行される）
  const sidebarLoadedRef = useRef<boolean>(!!cachedData);
  // テーブル再描画用のトリガー（サイドバーデータ取得完了時のみ更新）
  const [dataReady, setDataReady] = useState(!!cachedData);

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
            ? allBuyersWithStatusRef.current.filter(b => b.calculated_status === selectedCalculatedStatus)
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

        // サイドバー未ロード時のみAPIから取得（初回表示用）
        setLoading(true);
        const params: any = {
          page: page + 1,
          limit: rowsPerPage,
          sortBy: 'reception_date',
          sortOrder: 'desc',
        };
        if (debouncedSearch) params.search = normalizeSearch(debouncedSearch);

        const res = await api.get('/api/buyers', { params });
        if (!cancelled) {
          setBuyers(res.data.data || []);
          setTotal(res.data.total || 0);
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

  const handleBuyersLoaded = (buyers: BuyerWithStatus[]) => {
    allBuyersWithStatusRef.current = buyers;
    if (!sidebarLoadedRef.current) {
      // 初回ロード時のみdataReadyをtrueにしてfetchBuyersをトリガー
      sidebarLoadedRef.current = true;
      setDataReady(true);
    }
    // 既にロード済みの場合はrefのみ更新（再レンダリング不要）
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post('/api/buyers/sync');
      pageDataCache.invalidate(CACHE_KEYS.BUYERS_STATS);
      pageDataCache.invalidate(CACHE_KEYS.BUYERS_WITH_STATUS); // 買主ステータスキャッシュも無効化
      // サイドバーキャッシュをリセット
      allBuyersWithStatusRef.current = [];
      sidebarLoadedRef.current = false;
      setDataReady(false);
      setRefetchTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleRowClick = (buyerId: string) => {
    navigate(`/buyers/${buyerId}`);
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
    <Container maxWidth="xl" sx={{ py: 3 }}>
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

      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* 左サイドバー（ステータスのみ） */}
        <Paper sx={{ width: 220, flexShrink: 0, alignSelf: 'flex-start', maxHeight: 'none', overflow: 'visible' }}>
          <BuyerStatusSidebar
            selectedStatus={selectedCalculatedStatus}
            onStatusSelect={(status) => { setSelectedCalculatedStatus(status); setPage(0); }}
            totalCount={total}
            onBuyersLoaded={handleBuyersLoaded}
          />
        </Paper>

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField
              size="small"
              placeholder="検索（買主番号、氏名、電話番号、物件番号）"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              sx={{ width: '50%' }}
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
        </Box>
      </Box>
    </Container>
  );
}
