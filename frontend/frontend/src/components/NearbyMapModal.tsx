import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Print as PrintIcon,
  Map as MapIcon,
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';
import api from '../services/api';

// ---- 型定義 ----

interface PlaceItem {
  name: string;
  vicinity: string;
  lat: number;
  lng: number;
  rating?: number;
  distance: number;
}

interface PlaceCategory {
  type: string;
  label: string;
  icon: string;
}

interface NearbyData {
  center: { lat: number; lng: number };
  radius: number;
  categories: PlaceCategory[];
  places: Record<string, PlaceItem[]>;
}

interface NearbyMapModalProps {
  open: boolean;
  onClose: () => void;
  googleMapUrl?: string | null;
  address?: string;
  propertyNumber?: string;
  propertyType?: string;
}

// ---- マーカーカラー（カテゴリ別） ----
const CATEGORY_COLORS: Record<string, string> = {
  supermarket: '#e53935',
  convenience_store: '#e53935',
  school: '#1e88e5',
  kindergarten: '#1e88e5',
  hospital: '#43a047',
  pharmacy: '#43a047',
  bank: '#fb8c00',
  post_office: '#fb8c00',
  park: '#00897b',
  restaurant: '#8e24aa',
  train_station: '#3949ab',
  bus_station: '#3949ab',
};

// ---- Google Map URL から座標を抽出 ----
async function extractCoords(url: string, apiBase: string): Promise<{ lat: number; lng: number } | null> {
  if (!url) return null;
  try {
    let resolved = url;
    if (url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
      const resp = await fetch(`${apiBase}/api/url-redirect/resolve?url=${encodeURIComponent(url)}`);
      if (resp.ok) {
        const data = await resp.json();
        resolved = data.redirectedUrl || url;
      }
    }
    const patterns = [
      /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /\/search\/(-?\d+\.?\d*),\+?(-?\d+\.?\d*)/,
      /\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /\/@(-?\d+\.?\d*),(-?\d+\.?\d*),/,
    ];
    for (const p of patterns) {
      const m = resolved.match(p);
      if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    }
    return null;
  } catch {
    return null;
  }
}

// ---- メインコンポーネント ----

const NearbyMapModal: React.FC<NearbyMapModalProps> = ({
  open,
  onClose,
  googleMapUrl,
  address,
  propertyNumber,
  propertyType,
}) => {
  const { isLoaded: isMapLoaded } = useGoogleMaps();
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyData, setNearbyData] = useState<NearbyData | null>(null);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [errorPlaces, setErrorPlaces] = useState<string | null>(null);
  const [errorImage, setErrorImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // 座標取得
  useEffect(() => {
    if (!open) return;
    if (!googleMapUrl) return;
    extractCoords(googleMapUrl, apiBase).then((c) => {
      if (c) setCoords(c);
    });
  }, [open, googleMapUrl, apiBase]);

  // 近隣施設取得
  useEffect(() => {
    if (!open || !coords) return;
    fetchNearbyPlaces();
  }, [open, coords]);

  const fetchNearbyPlaces = useCallback(async () => {
    if (!coords) return;
    setLoadingPlaces(true);
    setErrorPlaces(null);
    try {
      const resp = await api.get('/api/nearby-map/places', {
        params: { lat: coords.lat, lng: coords.lng, radius: 2000 },
      });
      setNearbyData(resp.data);
    } catch (err: any) {
      setErrorPlaces(err.response?.data?.error || '近隣施設の取得に失敗しました');
    } finally {
      setLoadingPlaces(false);
    }
  }, [coords]);

  // AI画像生成
  const generateAiImage = useCallback(async () => {
    if (!nearbyData) return;
    setLoadingImage(true);
    setErrorImage(null);
    try {
      const resp = await api.post('/api/nearby-map/generate-image', {
        address: address || '',
        places: nearbyData.places,
        propertyType: propertyType || '',
      });
      setAiImageUrl(resp.data.imageUrl);
      setActiveTab(1); // AI画像タブに切り替え
    } catch (err: any) {
      setErrorImage(err.response?.data?.error || 'AI画像生成に失敗しました');
    } finally {
      setLoadingImage(false);
    }
  }, [nearbyData, address, propertyType]);

  // マップにマーカーを追加
  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (!nearbyData) return;
      addMarkers(map, nearbyData);
    },
    [nearbyData]
  );

  const addMarkers = (map: google.maps.Map, data: NearbyData) => {
    // 既存マーカーを削除
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // 物件マーカー（中心）
    const centerMarker = new google.maps.Marker({
      position: data.center,
      map,
      title: address || '物件',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#f44336',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 3,
      },
      zIndex: 1000,
    });
    markersRef.current.push(centerMarker);

    // 施設マーカー
    data.categories.forEach((cat) => {
      const places = data.places[cat.type] || [];
      places.forEach((place) => {
        if (!place.lat || !place.lng) return;
        const marker = new google.maps.Marker({
          position: { lat: place.lat, lng: place.lng },
          map,
          title: `${place.name} (${place.distance}m)`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: CATEGORY_COLORS[cat.type] || '#757575',
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          label: {
            text: cat.icon,
            fontSize: '14px',
          },
        });
        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="font-size:13px;padding:4px 8px;"><b>${place.name}</b><br/>${place.vicinity}<br/><span style="color:#666">${place.distance}m</span></div>`,
        });
        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
        markersRef.current.push(marker);
      });
    });
  };

  // nearbyDataが変わったらマーカーを更新
  useEffect(() => {
    if (mapRef.current && nearbyData) {
      addMarkers(mapRef.current, nearbyData);
    }
  }, [nearbyData]);

  // PDF印刷
  const handlePrint = () => {
    window.print();
  };

  // モーダルを閉じるときにリセット
  const handleClose = () => {
    setCoords(null);
    setNearbyData(null);
    setAiImageUrl(null);
    setErrorPlaces(null);
    setErrorImage(null);
    setActiveTab(0);
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    mapRef.current = null;
    onClose();
  };

  const hasCoords = !!coords;
  const hasPlaces = !!nearbyData;

  return (
    <>
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #nearby-map-print-area,
          #nearby-map-print-area * { visibility: visible !important; }
          #nearby-map-print-area {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            padding: 16px !important;
            background: white !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '90vh', display: 'flex', flexDirection: 'column' } }}
      >
        {/* ヘッダー */}
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MapIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              近隣MAP
            </Typography>
            {address && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {address}
              </Typography>
            )}
          </Box>
          <IconButton onClick={handleClose} size="small" className="no-print">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        {/* タブ */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }} className="no-print">
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label="地図・施設一覧" />
            <Tab label="AI生成マップ画像" disabled={!aiImageUrl && !loadingImage} />
          </Tabs>
        </Box>

        <DialogContent sx={{ flex: 1, overflow: 'auto', p: 2 }} id="nearby-map-print-area" ref={printRef}>
          {/* 座標が取得できない場合 */}
          {!hasCoords && !loadingPlaces && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Google Map URLから座標を取得できませんでした。URLが正しく設定されているか確認してください。
            </Alert>
          )}

          {/* タブ0: 地図 + 施設一覧 */}
          {activeTab === 0 && (
            <Box>
              {/* 印刷用タイトル */}
              <Box sx={{ display: 'none', '@media print': { display: 'block' }, mb: 2 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  近隣環境マップ
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {address} ／ 半径2km圏内の施設
                </Typography>
                <Divider sx={{ my: 1 }} />
              </Box>

              {/* Google Map */}
              {hasCoords && isMapLoaded && (
                <Box sx={{ width: '100%', height: 400, borderRadius: 1, overflow: 'hidden', mb: 2 }}>
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={coords!}
                    zoom={14}
                    options={{
                      zoomControl: true,
                      streetViewControl: false,
                      mapTypeControl: false,
                      fullscreenControl: true,
                    }}
                    onLoad={handleMapLoad}
                  />
                </Box>
              )}

              {/* ローディング */}
              {loadingPlaces && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                  <Typography sx={{ ml: 2 }}>近隣施設を検索中...</Typography>
                </Box>
              )}

              {/* エラー */}
              {errorPlaces && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errorPlaces}
                </Alert>
              )}

              {/* 施設一覧 */}
              {hasPlaces && nearbyData && (
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                    近隣施設一覧（半径{(nearbyData.radius / 1000).toFixed(1)}km圏内）
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
                      gap: 1.5,
                    }}
                  >
                    {nearbyData.categories.map((cat) => {
                      const places = nearbyData.places[cat.type] || [];
                      if (places.length === 0) return null;
                      return (
                        <Paper key={cat.type} variant="outlined" sx={{ p: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                            <Typography fontSize={18}>{cat.icon}</Typography>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {cat.label}
                            </Typography>
                            <Chip label={places.length} size="small" sx={{ ml: 'auto' }} />
                          </Box>
                          <List dense disablePadding>
                            {places.map((place, idx) => (
                              <ListItem key={idx} disablePadding sx={{ py: 0.25 }}>
                                <ListItemText
                                  primary={
                                    <Typography variant="body2" noWrap>
                                      {place.name}
                                    </Typography>
                                  }
                                  secondary={
                                    <Typography variant="caption" color="text.secondary">
                                      {place.distance}m
                                      {place.rating ? ` ★${place.rating}` : ''}
                                    </Typography>
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Paper>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* タブ1: AI生成画像 */}
          {activeTab === 1 && (
            <Box>
              {loadingImage && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
                  <CircularProgress size={48} />
                  <Typography>AIが近隣環境マップを生成中です...</Typography>
                  <Typography variant="caption" color="text.secondary">
                    ※ 生成には30〜60秒かかる場合があります
                  </Typography>
                </Box>
              )}
              {errorImage && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errorImage}
                </Alert>
              )}
              {aiImageUrl && !loadingImage && (
                <Box>
                  {/* 印刷用タイトル */}
                  <Box sx={{ display: 'none', '@media print': { display: 'block' }, mb: 2 }}>
                    <Typography variant="h5" fontWeight="bold" gutterBottom>
                      近隣環境マップ（AI生成）
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {address}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <img
                      src={aiImageUrl}
                      alt="近隣環境マップ（AI生成）"
                      style={{ maxWidth: '100%', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      ※ この画像はAIが生成したイメージです。実際の地図とは異なる場合があります。
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        {/* フッターボタン */}
        <Divider />
        <DialogActions sx={{ px: 2, py: 1.5, gap: 1, flexWrap: 'wrap' }} className="no-print">
          {/* AI画像生成ボタン */}
          {hasPlaces && (
            <Tooltip title="OpenAI DALL-E 3 で近隣環境のイラストマップを生成します">
              <span>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={loadingImage ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                  onClick={generateAiImage}
                  disabled={loadingImage || loadingPlaces}
                >
                  {loadingImage ? 'AI生成中...' : 'AI画像を生成'}
                </Button>
              </span>
            </Tooltip>
          )}

          {/* 再取得ボタン */}
          {hasCoords && (
            <Tooltip title="近隣施設情報を再取得します">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchNearbyPlaces}
                  disabled={loadingPlaces}
                  size="small"
                >
                  再取得
                </Button>
              </span>
            </Tooltip>
          )}

          <Box sx={{ flex: 1 }} />

          {/* PDF印刷ボタン */}
          <Button
            variant="contained"
            color="primary"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            disabled={!hasPlaces && !aiImageUrl}
          >
            PDFで印刷
          </Button>

          <Button variant="outlined" onClick={handleClose}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NearbyMapModal;
