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
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Print as PrintIcon,
  Map as MapIcon,
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

// ---- カテゴリ別カラー ----
const CATEGORY_COLORS: Record<string, string> = {
  supermarket:       '#e53935', // 赤
  convenience_store: '#e53935',
  school:            '#1e88e5', // 青
  kindergarten:      '#039be5',
  hospital:          '#43a047', // 緑
  pharmacy:          '#00897b',
  bank:              '#fb8c00', // オレンジ
  post_office:       '#f4511e',
  park:              '#558b2f', // 深緑
  restaurant:        '#8e24aa', // 紫
  train_station:     '#3949ab', // 紺
  bus_station:       '#546e7a',
};

// ---- Google Map URL から座標を抽出 ----
async function extractCoords(
  url: string,
  apiBase: string
): Promise<{ lat: number; lng: number } | null> {
  if (!url) return null;
  try {
    let resolved = url;
    if (url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
      const resp = await fetch(
        `${apiBase}/api/url-redirect/resolve?url=${encodeURIComponent(url)}`
      );
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

// ---- カスタムHTMLマーカーを作成（施設名ラベル付き吹き出し） ----
function createCustomMarker(
  map: google.maps.Map,
  position: google.maps.LatLngLiteral,
  label: string,
  color: string,
  icon: string,
  subText: string
): google.maps.marker.AdvancedMarkerElement | google.maps.Marker {
  // AdvancedMarkerElement が使えるか確認
  if (
    google.maps.marker &&
    google.maps.marker.AdvancedMarkerElement
  ) {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
    `;

    // 吹き出し本体
    const bubble = document.createElement('div');
    bubble.style.cssText = `
      background: ${color};
      color: white;
      padding: 3px 7px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
      white-space: nowrap;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      line-height: 1.4;
      text-align: center;
    `;
    bubble.textContent = `${icon} ${label}`;
    bubble.title = `${label}\n${subText}`;

    // 三角形の矢印
    const arrow = document.createElement('div');
    arrow.style.cssText = `
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 7px solid ${color};
      margin-top: -1px;
    `;

    container.appendChild(bubble);
    container.appendChild(arrow);

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      content: container,
      title: label,
    });
    return marker;
  }

  // フォールバック: 通常Marker + InfoWindow
  const marker = new google.maps.Marker({
    position,
    map,
    title: label,
    label: {
      text: `${icon}${label.length > 8 ? label.slice(0, 8) + '…' : label}`,
      color: 'white',
      fontSize: '10px',
      fontWeight: 'bold',
    },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2,
    },
  });
  return marker;
}

// ---- メインコンポーネント ----

const NearbyMapModal: React.FC<NearbyMapModalProps> = ({
  open,
  onClose,
  googleMapUrl,
  address,
}) => {
  const { isLoaded: isMapLoaded } = useGoogleMaps();
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyData, setNearbyData] = useState<NearbyData | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [errorPlaces, setErrorPlaces] = useState<string | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  // AdvancedMarkerElement と Marker の両方に対応
  const markersRef = useRef<Array<google.maps.marker.AdvancedMarkerElement | google.maps.Marker>>([]);
  // 物件中心マーカー（通常Marker）
  const centerMarkerRef = useRef<google.maps.Marker | null>(null);
  // InfoWindow（クリック時）
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // ---- 座標取得 ----
  useEffect(() => {
    if (!open || !googleMapUrl) return;
    setCoords(null);
    extractCoords(googleMapUrl, apiBase).then((c) => {
      if (c) setCoords(c);
    });
  }, [open, googleMapUrl, apiBase]);

  // ---- 近隣施設取得 ----
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

  // ---- マーカーをすべて削除 ----
  const clearMarkers = () => {
    markersRef.current.forEach((m) => {
      if ('setMap' in m) {
        (m as google.maps.Marker).setMap(null);
      } else if ('map' in m) {
        (m as google.maps.marker.AdvancedMarkerElement).map = null;
      }
    });
    markersRef.current = [];
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setMap(null);
      centerMarkerRef.current = null;
    }
  };

  // ---- マップロード時 ----
  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();
      if (nearbyData) renderMarkers(map, nearbyData);
    },
    [nearbyData]
  );

  // ---- nearbyData が変わったらマーカー更新 ----
  useEffect(() => {
    if (mapRef.current && nearbyData) {
      renderMarkers(mapRef.current, nearbyData);
    }
  }, [nearbyData]);

  const renderMarkers = (map: google.maps.Map, data: NearbyData) => {
    clearMarkers();

    // 物件マーカー（赤い大きな丸）
    const center = new google.maps.Marker({
      position: data.center,
      map,
      title: address || '物件',
      zIndex: 1000,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: '#f44336',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 3,
      },
    });
    // 物件ラベル（InfoWindow常時表示の代わりにラベル）
    const propertyLabel = new google.maps.Marker({
      position: data.center,
      map,
      zIndex: 1001,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="28">
            <rect rx="6" ry="6" width="80" height="24" fill="#f44336" opacity="0.95"/>
            <text x="40" y="17" font-family="sans-serif" font-size="11" font-weight="bold"
              fill="white" text-anchor="middle">📍 物件</text>
          </svg>
        `),
        anchor: new google.maps.Point(40, 36),
      },
    });
    centerMarkerRef.current = center;
    markersRef.current.push(propertyLabel);

    // 施設マーカー
    data.categories.forEach((cat) => {
      const places = data.places[cat.type] || [];
      const color = CATEGORY_COLORS[cat.type] || '#757575';

      places.forEach((place) => {
        if (!place.lat || !place.lng) return;

        const marker = createCustomMarker(
          map,
          { lat: place.lat, lng: place.lng },
          place.name,
          color,
          cat.icon,
          `${place.vicinity} (${place.distance}m)`
        );

        // クリックでInfoWindow表示
        const clickHandler = () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(`
              <div style="font-size:13px;padding:6px 10px;min-width:160px;line-height:1.6;">
                <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">
                  ${cat.icon} ${place.name}
                </div>
                <div style="color:#555;">${place.vicinity}</div>
                <div style="color:#1976d2;font-weight:bold;margin-top:4px;">
                  物件から約 ${place.distance}m
                </div>
                ${place.rating ? `<div style="color:#f57c00;">★ ${place.rating}</div>` : ''}
              </div>
            `);
            if ('setMap' in marker) {
              infoWindowRef.current.open(map, marker as google.maps.Marker);
            } else {
              infoWindowRef.current.setPosition({ lat: place.lat, lng: place.lng });
              infoWindowRef.current.open(map);
            }
          }
        };

        if ('addListener' in marker) {
          (marker as google.maps.Marker).addListener('click', clickHandler);
        } else {
          (marker as google.maps.marker.AdvancedMarkerElement).addEventListener('click', clickHandler);
        }

        markersRef.current.push(marker);
      });
    });
  };

  // ---- PDF印刷 ----
  const handlePrint = () => {
    window.print();
  };

  // ---- モーダルを閉じる ----
  const handleClose = () => {
    clearMarkers();
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }
    mapRef.current = null;
    setCoords(null);
    setNearbyData(null);
    setErrorPlaces(null);
    onClose();
  };

  const hasCoords = !!coords;
  const hasPlaces = !!nearbyData;

  // 施設の総件数
  const totalPlaces = nearbyData
    ? Object.values(nearbyData.places).reduce((sum, arr) => sum + arr.length, 0)
    : 0;

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
        PaperProps={{
          sx: { height: '92vh', display: 'flex', flexDirection: 'column' },
        }}
      >
        {/* ヘッダー */}
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <MapIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              近隣MAP
            </Typography>
            {address && (
              <Typography variant="body2" color="text.secondary">
                {address}
              </Typography>
            )}
            {hasPlaces && (
              <Chip
                label={`${totalPlaces}件の施設`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
          <IconButton onClick={handleClose} size="small" className="no-print">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent
          sx={{ flex: 1, overflow: 'auto', p: 2 }}
          id="nearby-map-print-area"
        >
          {/* 印刷用タイトル */}
          <Box
            sx={{
              display: 'none',
              '@media print': { display: 'block' },
              mb: 2,
            }}
          >
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              近隣環境マップ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {address} ／ 半径2km圏内の施設
            </Typography>
            <Divider sx={{ my: 1 }} />
          </Box>

          {/* 座標が取得できない場合 */}
          {!hasCoords && !loadingPlaces && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Google Map URLから座標を取得できませんでした。URLが正しく設定されているか確認してください。
            </Alert>
          )}

          {/* ローディング */}
          {loadingPlaces && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4, gap: 2 }}>
              <CircularProgress size={28} />
              <Typography>近隣施設を検索中...</Typography>
            </Box>
          )}

          {/* エラー */}
          {errorPlaces && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorPlaces}
            </Alert>
          )}

          {/* Google Map（大きめ表示） */}
          {hasCoords && isMapLoaded && (
            <Box
              sx={{
                width: '100%',
                height: 600, // スクショ相当の大きさ
                borderRadius: 1,
                overflow: 'hidden',
                mb: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={coords!}
                zoom={15}
                options={{
                  zoomControl: true,
                  streetViewControl: true,
                  mapTypeControl: false,
                  fullscreenControl: true,
                  mapId: 'DEMO_MAP_ID', // AdvancedMarkerElement に必要
                }}
                onLoad={handleMapLoad}
              />
            </Box>
          )}

          {/* 施設一覧（地図の下） */}
          {hasPlaces && nearbyData && (
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
                近隣施設一覧（半径{(nearbyData.radius / 1000).toFixed(1)}km圏内）
              </Typography>

              {/* 凡例 */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                {nearbyData.categories.map((cat) => {
                  const count = (nearbyData.places[cat.type] || []).length;
                  if (count === 0) return null;
                  const color = CATEGORY_COLORS[cat.type] || '#757575';
                  return (
                    <Chip
                      key={cat.type}
                      label={`${cat.icon} ${cat.label} ${count}件`}
                      size="small"
                      sx={{
                        bgcolor: color,
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '11px',
                      }}
                    />
                  );
                })}
              </Box>

              {/* カテゴリ別リスト */}
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
                  const color = CATEGORY_COLORS[cat.type] || '#757575';
                  return (
                    <Paper
                      key={cat.type}
                      variant="outlined"
                      sx={{ p: 1.5, borderLeft: `4px solid ${color}` }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mb: 0.75,
                        }}
                      >
                        <Typography fontSize={16}>{cat.icon}</Typography>
                        <Typography
                          variant="subtitle2"
                          fontWeight="bold"
                          sx={{ color }}
                        >
                          {cat.label}
                        </Typography>
                        <Chip
                          label={places.length}
                          size="small"
                          sx={{ ml: 'auto', height: 18, fontSize: '10px' }}
                        />
                      </Box>
                      <List dense disablePadding>
                        {places.map((place, idx) => (
                          <ListItem key={idx} disablePadding sx={{ py: 0.2 }}>
                            <ListItemText
                              primary={
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: idx === 0 ? 'bold' : 'normal' }}
                                >
                                  {place.name}
                                </Typography>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  約{place.distance}m
                                  {place.rating ? `　★${place.rating}` : ''}
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
        </DialogContent>

        {/* フッター */}
        <Divider />
        <DialogActions
          sx={{ px: 2, py: 1.5, gap: 1 }}
          className="no-print"
        >
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

          {/* PDF印刷 */}
          <Button
            variant="contained"
            color="primary"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            disabled={!hasPlaces}
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
