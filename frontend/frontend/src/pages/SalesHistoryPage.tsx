import { useState, useEffect, useRef, useCallback } from 'react';
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
import { GoogleMap, Circle, Marker } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';
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
  lat?: number;
  lng?: number;
}

// 統合テーブル用（距離はオプション）
interface MergedItem extends SalesHistoryItem {
  distanceKm?: number;
  lat?: number;
  lng?: number;
  source: 'keyword' | 'nearby';
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
  const { isLoaded: isMapLoaded } = useGoogleMaps();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SalesHistoryResponse | null>(null);

  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyData, setNearbyData] = useState<NearbyPropertiesResponse | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  // 地図用
  const [selectedItem, setSelectedItem] = useState<MergedItem | null>(null);
  const onMapLoad = useCallback((_m: google.maps.Map) => {}, []);
  const onMapUnmount = useCallback(() => {}, []);

  useEffect(() => {
    if (!id) return;
    api.get<SalesHistoryResponse>(`/api/sellers/${id}/sales-history`)
      .then(res => setData(res.data))
      .catch(err => setError(err?.response?.data?.error || '売買実績の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setNearbyLoading(true);
    api.get<NearbyPropertiesResponse>(`/api/sellers/${id}/nearby-properties`)
      .then(res => setNearbyData(res.data))
      .catch(err => setNearbyError(err?.response?.data?.error || '近隣物件の取得に失敗しました'))
      .finally(() => setNearbyLoading(false));
  }, [id]);

  // 2つのリストを統合（重複除去：addressが同じものはnearbyを優先）
  const mergedItems: MergedItem[] = (() => {
    const keywordItems: MergedItem[] = (data?.results || []).map(item => ({
      ...item,
      source: 'keyword' as const,
    }));
    const nearbyItems: MergedItem[] = (nearbyData?.results || []).map(item => ({
      ...item,
      source: 'nearby' as const,
    }));

    // nearbyのアドレスセット（重複除去用）
    const nearbyAddresses = new Set(nearbyItems.map(i => i.address.trim()));

    // keywordのうちnearbyに含まれないものだけ追加
    const uniqueKeyword = keywordItems.filter(i => !nearbyAddresses.has(i.address.trim()));

    // 統合：nearbyを先頭（距離順）、その後keywordのみ
    return [...nearbyItems, ...uniqueKeyword];
  })();

  const handlePrint = () => window.print();

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

  // マーカー色：状態に応じて変える
  const markerColor = (atbbStatus: string, isSelected: boolean): string => {
    if (isSelected) return '#ff6f00'; // 選択中：オレンジ
    if (atbbStatus === '成約済み') return '#9e9e9e'; // 成約済み：グレー
    if (atbbStatus === '現在募集中') return '#1565c0'; // 募集中：青
    return '#1565c0'; // デフォルト：青
  };

  const hasPrintContent = mergedItems.length > 0;

  return (
    <>
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
        @media screen { .print-only { display: none; } }
        .type-badge {
          display: inline-block; padding: 2px 8px; border-radius: 12px;
          font-size: 12px; font-weight: bold; color: white; white-space: nowrap;
        }
        .status-badge {
          display: inline-block; padding: 2px 8px; border-radius: 12px;
          font-size: 12px; font-weight: bold; white-space: nowrap;
        }
      `}</style>

      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* 画面ヘッダー */}
        <Box className="no-print" sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBack />} variant="outlined" onClick={() => navigate(-1)} size="small">戻る</Button>
          <Typography variant="h6" fontWeight="bold">売買実績</Typography>
          {data && (
            <Typography variant="body2" color="text.secondary">
              検索住所：{data.searchKeyword}{data.sellerPropertyType && `　種別：${data.sellerPropertyType}`}
            </Typography>
          )}
          {hasPrintContent && (
            <Button startIcon={<PrintIcon />} variant="contained" onClick={handlePrint} size="small"
              sx={{ ml: 'auto', bgcolor: '#37474f', '&:hover': { bgcolor: '#263238' } }}>
              印刷
            </Button>
          )}
        </Box>

        {/* 印刷用ヘッダー */}
        <Box className="print-only" sx={{ px: 2, pt: 2, pb: 1, borderBottom: '2px solid #1a237e' }}>
          <Typography variant="h5" fontWeight="bold" sx={{ color: '#1a237e' }}>
            株式会社いふう　{data?.address || ''}　近隣エリアの売買実績
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            件数：{mergedItems.length}件
          </Typography>
        </Box>

        <Container maxWidth="xl" sx={{ py: 3 }} className="print-area" ref={printRef}>

          {/* ── 地図 ── */}
          {nearbyLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', py: 3 }} className="no-print">
              <CircularProgress size={20} />
              <Typography sx={{ ml: 2, fontSize: '0.85rem' }} color="text.secondary">
                半径1km以内の物件を座標計算中...
              </Typography>
            </Box>
          ) : nearbyData?.lat && nearbyData?.lng && isMapLoaded ? (
            <>
              {/* 画面表示用インタラクティブ地図 */}
              <Box className="no-print" sx={{ display: 'flex', gap: 2, mb: 3, height: 420 }}>
                {/* 地図 */}
                <Box sx={{ flex: '0 0 62%', borderRadius: 2, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={{ lat: nearbyData.lat, lng: nearbyData.lng }}
                    zoom={15}
                    onLoad={onMapLoad}
                    onUnmount={onMapUnmount}
                    options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                  >
                    {/* 中心マーカー */}
                    <Marker
                      position={{ lat: nearbyData.lat, lng: nearbyData.lng }}
                      icon={{ path: google.maps.SymbolPath.CIRCLE, fillColor: '#d32f2f', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 13 }}
                      title={nearbyData.address}
                      zIndex={9999}
                    />
                    {/* 半径1kmの赤い円 */}
                    <Circle
                      center={{ lat: nearbyData.lat, lng: nearbyData.lng }}
                      radius={nearbyData.radiusKm * 1000}
                      options={{ strokeColor: '#d32f2f', strokeOpacity: 0.9, strokeWeight: 2, fillColor: '#ef9a9a', fillOpacity: 0.15 }}
                    />
                    {/* 近隣物件マーカー（実際の座標） */}
                    {nearbyData.results.map((item, idx) => {
                      if (!item.lat || !item.lng) return null;
                      const isSelected = selectedItem?.address === item.address;
                      return (
                        <Marker
                          key={idx}
                          position={{ lat: item.lat, lng: item.lng }}
                          icon={{ path: google.maps.SymbolPath.CIRCLE, fillColor: markerColor(item.atbbStatus, isSelected), fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: isSelected ? 11 : 9 }}
                          title={item.address}
                          onClick={() => setSelectedItem(isSelected ? null : { ...item, source: 'nearby' })}
                          zIndex={isSelected ? 999 : idx}
                        />
                      );
                    })}
                  </GoogleMap>
                </Box>
                {/* 地図右側：近隣物件リスト */}
                <Box sx={{ flex: 1, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: 'background.paper' }}>
                  <Box sx={{ p: 1.5, borderBottom: '1px solid #e0e0e0', bgcolor: '#1a237e' }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: 'white' }}>
                      半径{nearbyData.radiusKm}km以内　{nearbyData.results.length}件（近い順）
                    </Typography>
                  </Box>
                  {nearbyData.results.map((item, idx) => {
                    const isSelected = selectedItem?.address === item.address;
                    return (
                      <Box key={idx} onClick={() => setSelectedItem(isSelected ? null : { ...item, source: 'nearby' })}
                        sx={{ p: 1.2, borderBottom: '1px solid #f0f0f0', cursor: 'pointer', bgcolor: isSelected ? '#e3f2fd' : 'transparent', '&:hover': { bgcolor: '#f5f5f5' } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3 }}>
                          <span className="type-badge" style={{ backgroundColor: typeColor(item.propertyType), fontSize: '11px', padding: '1px 6px' }}>
                            {item.propertyType || '-'}
                          </span>
                          <Typography variant="caption" sx={{ color: '#1565c0', fontWeight: 'bold' }}>
                            {item.distanceKm.toFixed(2)}km
                          </Typography>
                          {item.atbbStatus && (
                            <span className="status-badge" style={{ fontSize: '11px', padding: '1px 6px', backgroundColor: item.atbbStatus === '成約済み' ? '#e0e0e0' : '#e8f5e9', color: item.atbbStatus === '成約済み' ? '#424242' : '#2e7d32', border: `1px solid ${item.atbbStatus === '成約済み' ? '#bdbdbd' : '#a5d6a7'}` }}>
                              {item.atbbStatus}
                            </span>
                          )}
                        </Box>
                        <Typography variant="body2" sx={{ fontSize: '0.77rem' }}>{item.address || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.settlementDate ? formatDate(item.settlementDate) : ''}
                          {item.salesPrice ? `　${formatPrice(item.salesPrice)}` : ''}
                          {item.landArea ? `　土地${formatArea(item.landArea)}` : ''}
                          {item.buildingArea ? `　建物${formatArea(item.buildingArea)}` : ''}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {/* 印刷用：Static Maps API画像（円をpathで近似） */}
              {(() => {
                const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
                const lat = nearbyData.lat!;
                const lng = nearbyData.lng!;
                const center = `${lat},${lng}`;

                // 1km円を36角形で近似（pathパラメータ）
                const R = 6371; // 地球半径km
                const radiusKm = nearbyData.radiusKm;
                const points: string[] = [];
                for (let i = 0; i <= 36; i++) {
                  const angle = (i * 10) * (Math.PI / 180);
                  const dLat = (radiusKm / R) * (180 / Math.PI) * Math.cos(angle);
                  const dLng = (radiusKm / R) * (180 / Math.PI) * Math.sin(angle) / Math.cos(lat * Math.PI / 180);
                  points.push(`${(lat + dLat).toFixed(6)},${(lng + dLng).toFixed(6)}`);
                }
                const circlePath = `path=color:0xff000099%7Cweight:3%7Cfillcolor:0xff000022%7C${points.join('%7C')}`;

                // 中心マーカー（赤・大）
                const centerMarker = `markers=color:red%7Csize:mid%7Clabel:★%7C${center}`;

                // 近隣物件マーカー（成約済み→gray、それ以外→blue）
                const nearbyMarkers = nearbyData.results
                  .filter(item => item.lat && item.lng)
                  .map(item => {
                    const color = item.atbbStatus === '成約済み' ? 'gray' : 'blue';
                    return `markers=color:${color}%7Csize:small%7C${item.lat},${item.lng}`;
                  })
                  .join('&');

                const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=15&size=640x480&scale=2&${circlePath}&${centerMarker}&${nearbyMarkers ? nearbyMarkers + '&' : ''}key=${apiKey}`;

                return (
                  <Box className="print-only" sx={{ mb: 3, textAlign: 'center' }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: '#1a237e' }}>
                      📍 半径{radiusKm}kmマップ（★赤：対象物件　●青：募集中　●グレー：成約済み）
                    </Typography>
                    <img
                      src={staticUrl}
                      alt="近隣物件マップ"
                      style={{ display: 'block', width: '100%', maxWidth: 720, margin: '0 auto', border: '1px solid #e0e0e0', borderRadius: 4 }}
                    />
                  </Box>
                );
              })()}
            </>
          ) : null}

          <Divider sx={{ my: 2 }} />

          {/* ── 統合テーブル ── */}
          {(loading || nearbyLoading) ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={24} />
              <Typography sx={{ ml: 2, alignSelf: 'center' }}>データ取得中...</Typography>
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }} className="no-print">{error}</Alert>
          ) : (
            <>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                📋 近隣エリアの売買実績
                {nearbyData && ` （半径${nearbyData.radiusKm}km以内含む）`}
              </Typography>

              {mergedItems.length === 0 ? (
                <Alert severity="info">該当する売買実績が見つかりませんでした。</Alert>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} className="no-print">
                    {mergedItems.length}件
                    {nearbyData && `（うち半径${nearbyData.radiusKm}km以内：${nearbyData.results.length}件）`}
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
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>距離</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {mergedItems.map((item, index) => (
                          <TableRow key={index}
                            sx={{ '&:nth-of-type(odd)': { bgcolor: '#f5f5f5' }, '&:hover': { bgcolor: '#e3f2fd' } }}>
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
                                <span className="status-badge" style={{ backgroundColor: item.atbbStatus === '成約済み' ? '#e0e0e0' : '#e8f5e9', color: item.atbbStatus === '成約済み' ? '#424242' : '#2e7d32', border: `1px solid ${item.atbbStatus === '成約済み' ? '#bdbdbd' : '#a5d6a7'}` }}>
                                  {item.atbbStatus}
                                </span>
                              ) : '-'}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', color: item.distanceKm != null ? '#1565c0' : 'text.secondary', fontWeight: item.distanceKm != null ? 'bold' : 'normal' }}>
                              {item.distanceKm != null ? `${item.distanceKm.toFixed(2)}km` : '-'}
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
    </>
  );
}
