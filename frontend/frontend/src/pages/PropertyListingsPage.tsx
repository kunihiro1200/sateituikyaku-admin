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
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Search as SearchIcon, ClearAll as ClearAllIcon, Clear as ClearIcon } from '@mui/icons-material';
import api from '../services/api';
import PropertyListingDetailModal from '../components/PropertyListingDetailModal';
import PageNavigation from '../components/PageNavigation';
import BuyerIndicator from '../components/BuyerIndicator';
import { InquiryResponseButton } from '../components/InquiryResponseButton';
import PublicUrlCell from '../components/PublicUrlCell';
import PropertySidebarStatus from '../components/PropertySidebarStatus';
import { getDisplayStatus } from '../utils/atbbStatusDisplayMapper';
import { SECTION_COLORS } from '../theme/sectionColors';
import { calculatePropertyStatus } from '../utils/propertyListingStatusUtils';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';

interface PropertyListing {
  id: string;
  property_number?: string;
  sidebar_status?: string;
  sales_assignee?: string;
  property_type?: string;
  address?: string;
  display_address?: string;
  seller_name?: string;
  buyer_name?: string;
  contract_date?: string;
  settlement_date?: string;
  price?: number;
  storage_location?: string;
  atbb_status?: string;
  [key: string]: any;
}

export default function PropertyListingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [allListings, setAllListings] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarStatus, setSidebarStatus] = useState<string | null>(null);
  const [selectedPropertyNumber, setSelectedPropertyNumber] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // スマホ時のアコーディオン開閉状態
  const [mobileStatusOpen, setMobileStatusOpen] = useState(false);
  const [buyerCounts, setBuyerCounts] = useState<Record<string, number>>({});
  const [highConfidenceProperties, setHighConfidenceProperties] = useState<Set<string>>(new Set());
  const [selectedPropertyNumbers, setSelectedPropertyNumbers] = useState<Set<string>>(new Set());
  const [lastFilter, setLastFilter] = useState<'sidebar' | 'search' | null>(null);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const isFetchingRef = useRef(false); // 二重フェッチ防止フラグ

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

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async (forceRefresh = false) => {
    // 二重フェッチ防止（キャッシュヒット時は除く）
    if (isFetchingRef.current && !forceRefresh) return;

    // キャッシュが有効な場合はAPIを叩かない
    if (!forceRefresh) {
      const cached = pageDataCache.get<PropertyListing[]>(CACHE_KEYS.PROPERTY_LISTINGS);
      if (cached) {
        setAllListings(cached);
        setIsLoadingAll(false);
        setLoading(false);
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

      // キャッシュに保存（5分間有効）
      pageDataCache.set(CACHE_KEYS.PROPERTY_LISTINGS, allListingsData, 5 * 60 * 1000);
      // allListingsとisLoadingAllを同時に更新することでRenderを1回にまとめる
      setAllListings(allListingsData);
      setIsLoadingAll(false);

      console.log('✅ データ取得成功:', { 物件数: allListingsData.length });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // フィルタリング（全件読み込み完了前は検索を適用しない）
  const filteredListings = useMemo(() => {
    if (isLoadingAll && searchQuery.trim()) return [];
    let listings = allListings;

    // サイドバーと検索は排他的（後から操作した方がもう一方をクリアするため、両方独立適用でOK）
    if (sidebarStatus && sidebarStatus !== 'all') {
      if (sidebarStatus === '要値下げ') {
        // 「要値下げ」はDBのsidebar_statusに保存されないため、calculatePropertyStatusで判定
        listings = listings.filter(l => calculatePropertyStatus(l as any).key === 'price_reduction_due');
      } else if (['Y専任公開中', '生・専任公開中', '久・専任公開中', 'U専任公開中', '林・専任公開中', 'K専任公開中', 'R専任公開中', 'I専任公開中'].includes(sidebarStatus)) {
        // 担当者別専任公開中：sidebar_statusが一致するか、古いデータ('専任・公開中')でsales_assigneeが一致するものを含む
        const assigneeMap: Record<string, string> = {
          'Y専任公開中': '山本', '生・専任公開中': '生野', '久・専任公開中': '久',
          'U専任公開中': '裏', '林・専任公開中': '林', 'K専任公開中': '国広',
          'R専任公開中': '木村', 'I専任公開中': '角井',
        };
        const targetAssignee = assigneeMap[sidebarStatus];
        listings = listings.filter(l =>
          l.sidebar_status === sidebarStatus ||
          (l.sidebar_status === '専任・公開中' && l.sales_assignee === targetAssignee)
        );
      } else {
        listings = listings.filter(l => l.sidebar_status === sidebarStatus);
      }
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      listings = listings.filter(l =>
        l.property_number?.toLowerCase().includes(query) ||
        l.address?.toLowerCase().includes(query) ||
        l.seller_name?.toLowerCase().includes(query) ||
        l.buyer_name?.toLowerCase().includes(query)
      );
    }

    return listings;
  }, [allListings, sidebarStatus, searchQuery]);

  const paginatedListings = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredListings.slice(start, start + rowsPerPage);
  }, [filteredListings, page, rowsPerPage]);

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

    // 「未報告」カテゴリー選択中は報告ページへ直接遷移
    if (sidebarStatus && sidebarStatus.startsWith('未報告')) {
      navigate(`/property-listings/${propertyNumber}/report`);
      return;
    }

    const currentState = {
      page,
      rowsPerPage,
      searchQuery,
      sidebarStatus,
      lastFilter,
    };
    sessionStorage.setItem('propertyListState', JSON.stringify(currentState));
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
        {/* スマホ時：ステータス・担当者フィルターボタン */}
        {isMobile && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              variant={sidebarStatus && sidebarStatus !== 'all' ? 'contained' : 'outlined'}
              onClick={() => setMobileStatusOpen(!mobileStatusOpen)}
              sx={{ fontSize: '0.75rem', py: 0.5, color: sidebarStatus && sidebarStatus !== 'all' ? '#fff' : SECTION_COLORS.property.main, borderColor: SECTION_COLORS.property.main, bgcolor: sidebarStatus && sidebarStatus !== 'all' ? SECTION_COLORS.property.main : undefined }}
            >
              ステータス {mobileStatusOpen ? '▲' : '▼'}
            </Button>
          </Box>
        )}
      </Box>

      <PageNavigation />

      <Box sx={{ display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
        {/* 左サイドバー - サイドバーステータス */}
        {/* スマホ時はアコーディオンで表示 */}
        {isMobile ? (
          <Box sx={{ width: '100%', mb: 1 }}>
            {mobileStatusOpen && (
              <Paper sx={{ mb: 1, p: 1 }}>
                <PropertySidebarStatus
                  listings={allListings}
                  selectedStatus={sidebarStatus}
                  onStatusChange={(status) => { setSidebarStatus(status); setSearchQuery(''); setLastFilter('sidebar'); setPage(0); setMobileStatusOpen(false); }}
                />
              </Paper>
            )}
          </Box>
        ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <PropertySidebarStatus
            listings={allListings}
            selectedStatus={sidebarStatus}
            onStatusChange={(status) => { setSidebarStatus(status); setSearchQuery(''); setLastFilter('sidebar'); setPage(0); }}
          />
        </Box>
        )}

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search 物件（物件番号、所在地、売主、買主）"
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
                  <TableCell>物件番号</TableCell>
                  <TableCell>担当</TableCell>
                  <TableCell>種別</TableCell>
                  <TableCell>所在地</TableCell>
                  <TableCell>売主</TableCell>
                  <TableCell>ATBB状況</TableCell>
                  <TableCell>買主</TableCell>
                  <TableCell>契約日</TableCell>
                  <TableCell>決済日</TableCell>
                  <TableCell>売買価格</TableCell>
                  <TableCell>公開URL</TableCell>
                  <TableCell>格納先URL</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center">読み込み中...</TableCell>
                  </TableRow>
                ) : paginatedListings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center">
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
                        sx={{ cursor: 'pointer', bgcolor: isSelected ? 'action.selected' : 'inherit' }}
                      >
                        <TableCell padding="checkbox" onClick={(e) => { e.stopPropagation(); listing.property_number && handleSelectProperty(listing.property_number, e); }}>
                          <Checkbox checked={isSelected} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: SECTION_COLORS.property.main }} fontWeight="bold">
                            {listing.property_number || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{listing.sales_assignee || '-'}</TableCell>
                        <TableCell>
                          {listing.property_type && <Chip label={listing.property_type} size="small" />}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {listing.address || listing.display_address || '-'}
                        </TableCell>
                        <TableCell>{listing.seller_name || '-'}</TableCell>
                        <TableCell>{getDisplayStatus(listing.atbb_status) || '-'}</TableCell>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <PublicUrlCell propertyNumber={listing.property_number} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {listing.storage_location ? (
                            <Link
                              href={listing.storage_location}
                              target="_blank"
                              rel="noopener noreferrer"
                              underline="hover"
                              sx={{ fontSize: '0.875rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                            >
                              Google Drive
                            </Link>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
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
                  const propertyStatus = calculatePropertyStatus(listing as any);
                  return (
                    <Card
                      key={listing.id}
                      onClick={() => listing.property_number && handleRowClick(listing.property_number)}
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
                            sx={{ color: SECTION_COLORS.property.main, fontSize: '14px' }}
                          >
                            {listing.property_number || '-'}
                          </Typography>
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

      <PropertyListingDetailModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedPropertyNumber(null); }}
        propertyNumber={selectedPropertyNumber}
        onUpdate={() => fetchAllData(true)}
      />
    </Container>
  );
}
