import { useState, useEffect, useRef } from 'react';
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
  Container,
  Divider,
} from '@mui/material';
import { ArrowBack, Print as PrintIcon } from '@mui/icons-material';
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

interface NearbyPropertyItem extends SalesHistoryItem {
  distanceKm: number;
}

interface SalesHistoryResponse {
  results: SalesHistoryItem[];
  address: string;
  searchKeyword: string;
  sellerPropertyType: string;
}

interface NearbyPropertiesResponse {
  results: NearbyPropertyItem[];
  address: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  error?: string;
}

export default function SalesHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SalesHistoryResponse | null>(null);

  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyData, setNearbyData] = useState<NearbyPropertiesResponse | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  // 売買実績（住所キーワード検索）
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

  // 近隣物件（半径1km・ジオコーディング）
  useEffect(() => {
    if (!id) return;
    const fetchNearby = async () => {
      try {
        setNearbyLoading(true);
        setNearbyError(null);
        const res = await api.get<NearbyPropertiesResponse>(`/api/sellers/${id}/nearby-properties`);
        setNearbyData(res.data);
      } catch (err: any) {
        setNearbyError(err?.response?.data?.error || '近隣物件の取得に失敗しました');
      } finally {
        setNearbyLoading(false);
      }
    };
    fetchNearby();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const formatPrice = (price: string | number): string => {
    if (!price) return '-';
    const num = typeof price === 'number' ? price : parseFloat(String(price).replace(/[,，円￥\s]/g, ''));
    if (isNaN(num)) return String(price);
    if (num >= 10000) return `${Math.round(num / 10000).toLocaleString()}万円`;
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
    const match = String(dateStr).match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (match) return `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`;
    return String(dateStr);
  };

  const typeColor = (type: string): string => {
    if (type?.includes('マ')) return '#7b1fa2';
    if (type === '戸建' || type === '戸' || type?.includes('戸建')) return '#1565c0';
    if (type === '土' || type === '土地') return '#2e7d32';
    return '#616161';
  };

  // 共通テーブル（売買実績・近隣物件で使い回し）
  const renderTable = (items: (SalesHistoryItem | NearbyPropertyItem)[], showDistance = false) => (
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
            {showDistance && (
              <TableCell sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>距離</TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, index) => (
            <TableRow
              key={index}
              sx={{
                '&:nth-of-type(odd)': { bgcolor: '#f5f5f5' },
                '&:hover': { bgcolor: '#e3f2fd' },
              }}
            >
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <span className="type-badge" style={{ backgroundColor: typeColor(item.propertyType) }}>
                  {item.propertyType || '-'}
                </span>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {item.settlementDate ? formatDate(item.settlementDate) : '-'}
              </TableCell>
              <TableCell>
                <Typography variant="body2">{item.address || '-'}</Typography>
                {item.displayAddress && item.displayAddress !== item.address && (
                  <Typography variant="caption" color="text.secondary">{item.displayAddress}</Typography>
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
                  <span
                    className="status-badge"
                    style={{
                      backgroundColor: item.atbbStatus === '成約済み' ? '#e0e0e0' : '#e8f5e9',
                      color: item.atbbStatus === '成約済み' ? '#424242' : '#2e7d32',
                      border: `1px solid ${item.atbbStatus === '成約済み' ? '#bdbdbd' : '#a5d6a7'}`,
                    }}
                  >
                    {item.atbbStatus}
                  </span>
                ) : '-'}
              </TableCell>
              {showDistance && (
                <TableCell sx={{ whiteSpace: 'nowrap', color: '#1565c0', fontWeight: 'bold' }}>
                  {(item as NearbyPropertyItem).distanceKm != null
                    ? `${(item as NearbyPropertyItem).distanceKm.toFixed(2)}km`
                    : '-'}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const hasPrintContent =
    (data && data.results.length > 0) || (nearbyData && nearbyData.results.length > 0);

  return (
    <>
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { margin: 0; padding: 0; }
          .print-area { padding: 16px; }
          @page { size: A4 landscape; margin: 12mm; }
          .type-badge, .status-badge {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
        @media screen {
          .print-only { display: none; }
        }
        .type-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          color: white;
          white-space: nowrap;
        }
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          white-space: nowrap;
        }
      `}</style>

      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* ヘッダー（画面表示のみ） */}
        <Box
          className="no-print"
          sx={{
            px: 2, py: 1.5,
            borderBottom: 1, borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex', alignItems: 'center', gap: 2,
          }}
        >
          <Button startIcon={<ArrowBack />} variant="outlined" onClick={() => navigate(-1)} size="small">
            戻る
          </Button>
          <Typography variant="h6" fontWeight="bold">売買実績</Typography>
          {data && (
            <Typography variant="body2" color="text.secondary">
              検索住所：{data.searchKeyword}
              {data.sellerPropertyType && `　種別：${data.sellerPropertyType}`}
            </Typography>
          )}
          {hasPrintContent && (
            <Button
              startIcon={<PrintIcon />}
              variant="contained"
              onClick={handlePrint}
              size="small"
              sx={{ ml: 'auto', bgcolor: '#37474f', '&:hover': { bgcolor: '#263238' } }}
            >
              印刷
            </Button>
          )}
        </Box>

        {/* 印刷用ヘッダー（印刷時のみ表示） */}
        <Box className="print-only" sx={{ px: 2, pt: 2, pb: 1, borderBottom: '2px solid #1a237e' }}>
          <Typography variant="h5" fontWeight="bold" sx={{ color: '#1a237e' }}>
            株式会社いふう　{data?.address || ''}　近隣エリアの売買実績
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            検索キーワード：{data?.searchKeyword}　／　件数：{data?.results.length}件
          </Typography>
        </Box>

        <Container maxWidth="xl" sx={{ py: 3 }} className="print-area" ref={printRef}>

          {/* ── 売買実績セクション ── */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={24} />
              <Typography sx={{ ml: 2, alignSelf: 'center' }}>売買実績を取得中...</Typography>
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }} className="no-print">{error}</Alert>
          ) : data && (
            <>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                📋 近隣エリアの売買実績（住所キーワード検索）
              </Typography>
              {data.results.length === 0 ? (
                <Alert severity="info" sx={{ mb: 3 }} className="no-print">
                  「{data.searchKeyword}」に該当する売買実績が見つかりませんでした。
                </Alert>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} className="no-print">
                    {data.results.length}件
                  </Typography>
                  {renderTable(data.results, false)}
                </>
              )}
            </>
          )}

          <Divider sx={{ my: 4 }} />

          {/* ── 半径1km以内の近隣物件セクション ── */}
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
            📍 半径1km以内の物件（近い順）
          </Typography>

          {nearbyLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', py: 4 }}>
              <CircularProgress size={24} />
              <Typography sx={{ ml: 2 }}>座標変換・距離計算中（しばらくお待ちください）...</Typography>
            </Box>
          ) : nearbyError ? (
            <Alert severity="warning" className="no-print">{nearbyError}</Alert>
          ) : nearbyData && (
            <>
              {nearbyData.error && (
                <Alert severity="warning" sx={{ mb: 2 }} className="no-print">{nearbyData.error}</Alert>
              )}
              {nearbyData.results.length === 0 ? (
                <Alert severity="info" className="no-print">
                  半径1km以内に該当する物件が見つかりませんでした。
                </Alert>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} className="no-print">
                    {nearbyData.results.length}件（半径{nearbyData.radiusKm}km以内・近い順）
                  </Typography>
                  {renderTable(nearbyData.results, true)}
                </>
              )}
            </>
          )}

        </Container>
      </Box>
    </>
  );
}
