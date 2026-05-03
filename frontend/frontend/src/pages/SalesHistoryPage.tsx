import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Container,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import api from '../services/api';

interface SalesHistoryItem {
  propertyType: string;
  settlementDate: string;
  address: string;
  displayAddress: string;
  landArea: string;
  buildingArea: string;
  salesPrice: string;
  atbbStatus: string;
}

interface SalesHistoryResponse {
  results: SalesHistoryItem[];
  address: string;
  searchKeyword: string;
  sellerPropertyType: string;
}

export default function SalesHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SalesHistoryResponse | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<SalesHistoryResponse>(`/api/sellers/${id}/sales-history`);
        setData(res.data);
      } catch (err: any) {
        setError(err?.response?.data?.error || '売買実績の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const formatPrice = (price: string | number): string => {
    if (!price) return '-';
    const num = typeof price === 'number' ? price : parseFloat(String(price).replace(/[,，円￥\s]/g, ''));
    if (isNaN(num)) return String(price);
    // 万円単位で表示
    if (num >= 10000) {
      return `${Math.round(num / 10000).toLocaleString()}万円`;
    }
    return `${num.toLocaleString()}万円`;
  };

  const formatArea = (area: string | number): string => {
    if (!area) return '-';
    const num = typeof area === 'number' ? area : parseFloat(String(area).replace(/[,，㎡\s]/g, ''));
    if (isNaN(num)) return String(area);
    return `${num.toLocaleString()}㎡`;
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    // YYYY/MM/DD or YYYY-MM-DD
    const match = String(dateStr).match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (match) {
      return `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`;
    }
    return String(dateStr);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* ヘッダー */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Button
          startIcon={<ArrowBack />}
          variant="outlined"
          onClick={() => navigate(-1)}
          size="small"
        >
          戻る
        </Button>
        <Typography variant="h6" fontWeight="bold">
          売買実績
        </Typography>
        {data && (
          <Typography variant="body2" color="text.secondary">
            検索住所：{data.searchKeyword}
            {data.sellerPropertyType && `　種別：${data.sellerPropertyType}`}
          </Typography>
        )}
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2, alignSelf: 'center' }}>物件スプシから実績を取得中...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && data && (
          <>
            {data.results.length === 0 ? (
              <Alert severity="info">
                「{data.searchKeyword}」に該当する売買実績が見つかりませんでした。
              </Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {data.results.length}件の実績が見つかりました
                </Typography>
                <TableContainer component={Paper} elevation={2}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#1a237e' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>種別</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>決済日</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>所在地</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>土地面積</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>建物面積</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>売買価格</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>状態</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.results.map((item, index) => (
                        <TableRow
                          key={index}
                          sx={{
                            '&:nth-of-type(odd)': { bgcolor: '#f5f5f5' },
                            '&:hover': { bgcolor: '#e3f2fd' },
                          }}
                        >
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Chip
                              label={item.propertyType || '-'}
                              size="small"
                              sx={{
                                bgcolor:
                                  item.propertyType?.includes('マ') ? '#7b1fa2' :
                                  item.propertyType === '戸建' || item.propertyType === '戸' || item.propertyType?.includes('戸建') ? '#1565c0' :
                                  item.propertyType === '土' || item.propertyType === '土地' ? '#2e7d32' :
                                  '#616161',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.7rem',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {item.settlementDate ? formatDate(item.settlementDate) : '-'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {item.address || '-'}
                            </Typography>
                            {item.displayAddress && item.displayAddress !== item.address && (
                              <Typography variant="caption" color="text.secondary">
                                {item.displayAddress}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {item.landArea ? formatArea(item.landArea) : '-'}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {item.buildingArea ? formatArea(item.buildingArea) : '-'}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                            {item.salesPrice ? formatPrice(item.salesPrice) : '-'}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {item.atbbStatus ? (
                              <Chip
                                label={item.atbbStatus}
                                size="small"
                                color={item.atbbStatus === '成約済み' ? 'default' : 'success'}
                                sx={{
                                  fontWeight: 'bold',
                                  fontSize: '0.7rem',
                                }}
                              />
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </>
        )}
      </Container>
    </Box>
  );
}
