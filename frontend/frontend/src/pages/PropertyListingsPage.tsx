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
  Divider,
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
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [sidebarStatus, setSidebarStatus] = useState<string | null>(null);
  const [selectedPropertyNumber, setSelectedPropertyNumber] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [buyerCounts, setBuyerCounts] = useState<Record<string, number>>({});
  const [highConfidenceProperties, setHighConfidenceProperties] = useState<Set<string>>(new Set());
  const [selectedPropertyNumbers, setSelectedPropertyNumbers] = useState<Set<string>>(new Set());
  const [lastFilter, setLastFilter] = useState<'sidebar' | 'search' | null>(null);
  const [isLoadingAll, setIsLoadingAll] = useState(true);

  // 状態を復元
  useEffect(() => {
    const savedState = location.state as any;
    if (savedState) {
      if (savedState.page !== undefined) setPage(savedState.page);
      if (savedState.rowsPerPage !== undefined) setRowsPerPage(savedState.rowsPerPage);
      if (savedState.searchQuery !== undefined) setSearchQuery(savedState.searchQuery);
      if (savedState.selectedAssignee !== undefined) setSelectedAssignee(savedState.selectedAssignee);
      if (savedState.sidebarStatus !== undefined) setSidebarStatus(savedState.sidebarStatus);
    }
  }, [location.state]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async (forceRefresh = false) => {
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

    try {
      setLoading(true);

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
      setAllListings(allListingsData);
      setIsLoadingAll(false);

      console.log('✅ データ取得成功:', { 物件数: allListingsData.length });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 担当者別カウント
  const assigneeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allListings.length };
    allListings.forEach(listing => {
      const key = listing.sales_assignee || '未設定';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [allListings]);

  // フィルタリング
  const filteredListings = useMemo(() => {
    let listings = allListings;

    // 担当者フィルター（常に適用）
    if (selectedAssignee && selectedAssignee !== 'all') {
      listings = listings.filter(l =>
        selectedAssignee === '未設定'
          ? !l.sales_assignee
          : l.sales_assignee === selectedAssignee
      );
    }

    // サイドバーと検索は排他的（後から操作した方がもう一方をクリアするため、両方独立適用でOK）
    if (sidebarStatus && sidebarStatus !== 'all') {
      if (sidebarStatus === '要値下げ') {
        // 「要値下げ」はDBのsidebar_statusに保存されないため、calculatePropertyStatusで判定
        listings = listings.filter(l => calculatePropertyStatus(l as any).key === 'price_reduction_due');
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
  }, [allListings, selectedAssignee, sidebarStatus, searchQuery]);

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
    const currentState = {
      page,
      rowsPerPage,
      searchQuery,
      selectedAssignee,
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

  // サイドバー用の担当者リスト
  const assigneeList = useMemo(() => {
    const list = [{ key: 'all', label: 'All', count: assigneeCounts.all }];
    Object.entries(assigneeCounts)
      .filter(([key]) => key !== 'all')
      .sort((a, b) => b[1] - a[1])
      .forEach(([key, count]) => {
        list.push({ key, label: key, count });
      });
    return list;
  }, [assigneeCounts]);

  return (
    <Container maxWidth="xl" sx={isMobile ? { overflowX: 'hidden', px: 1, py: 2 } : { py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>物件リスト</Typography>
      </Box>

      <PageNavigation />

      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* 左サイドバー - サイドバーステータス（デスクトップのみ） */}
        <Box sx={{ display: isMobile ? 'none' : 'flex', flexDirection: 'column', gap: 2 }}>
          <PropertySidebarStatus
            listings={allListings}
            selectedStatus={sidebarStatus}
            onStatusChange={(status) => { setSidebarStatus(status); setSearchQuery(''); setLastFilter('sidebar'); setPage(0); }}
          />

          {/* 担当者フィルター */}
          <Paper sx={{ width: 220, flexShrink: 0 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
              <Typography variant="subtitle1" fontWeight="bold">担当者</Typography>
            </Box>
            <List dense sx={{ maxHeight: 'calc(50vh - 100px)', overflow: 'auto' }}>
              {assigneeList.map((item) => (
                <ListItemButton
                  key={item.key}
                  selected={selectedAssignee === item.key || (!selectedAssignee && item.key === 'all')}
                  onClick={() => { setSelectedAssignee(item.key === 'all' ? null : item.key); setPage(0); }}
                  sx={{ py: 0.5 }}
                >
                  <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
                  <Badge
                    badgeContent={item.count}
                    max={9999}
                    sx={{
                      ml: 1,
                      '& .MuiBadge-badge': {
                        backgroundColor: SECTION_COLORS.property.main,
                        color: SECTION_COLORS.property.contrastText,
                      },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Box>

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={isLoadingAll ? "読み込み中... 完了後に検索できます" : "Search 物件（物件番号、所在地、売主、買主）"}
              value={searchQuery}
              disabled={isLoadingAll}
              onChange={(e) => { setSearchQuery(e.target.value); setSidebarStatus(null); setLastFilter('search'); setPage(0); }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
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
                    <TableCell colSpan={12} align="center">物件データが見つかりませんでした</TableCell>
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
                <Typography align="center" sx={{ py: 4, fontSize: '14px' }}>物件データが見つかりませんでした</Typography>
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
