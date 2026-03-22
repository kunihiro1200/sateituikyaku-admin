import { useState, useEffect } from 'react';
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
import { Search as SearchIcon, Sync as SyncIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import PageNavigation from '../components/PageNavigation';
import BuyerStatusSidebar from '../components/BuyerStatusSidebar';
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

export default function BuyersPage() {
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCalculatedStatus, setSelectedCalculatedStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchBuyers();
  }, [page, rowsPerPage, searchQuery, selectedCalculatedStatus]);

  const fetchBuyers = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: page + 1,
        limit: rowsPerPage,
        sortBy: 'reception_date',
        sortOrder: 'desc',
      };
      if (searchQuery) params.search = searchQuery;

      if (selectedCalculatedStatus !== null) {
        params.withStatus = 'true';
        params.calculatedStatus = selectedCalculatedStatus;
      }

      const res = await api.get('/api/buyers', { params });
      setBuyers(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post('/api/buyers/sync');
      pageDataCache.invalidate(CACHE_KEYS.BUYERS_STATS);
      await fetchBuyers();
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

      <PageNavigation />

      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* 左サイドバー（ステータスのみ） */}
        <Paper sx={{ width: 220, flexShrink: 0, alignSelf: 'flex-start' }}>
          <BuyerStatusSidebar
            selectedStatus={selectedCalculatedStatus}
            onStatusSelect={(status) => { setSelectedCalculatedStatus(status); setPage(0); }}
            totalCount={total}
          />
        </Paper>

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="検索（買主番号、氏名、電話番号、物件番号）"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
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
                  <TableCell>担当</TableCell>
                  <TableCell>確度</TableCell>
                  <TableCell>受付日</TableCell>
                  <TableCell>次電日</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">読み込み中...</TableCell>
                  </TableRow>
                ) : buyers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">買主データが見つかりませんでした</TableCell>
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
                        <TableCell>{buyer.follow_up_assignee || buyer.initial_assignee || '-'}</TableCell>
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
