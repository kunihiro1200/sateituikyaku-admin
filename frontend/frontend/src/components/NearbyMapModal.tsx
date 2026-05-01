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
  supermarket:       '#e53935',
  convenience_store: '#c62828',
  school:            '#1565c0',
  kindergarten:      '#0277bd',
  hospital:          '#2e7d32',
  pharmacy:          '#00695c',
  bank:              '#e65100',
  post_office:       '#bf360c',
  park:              '#33691e',
  restaurant:        '#6a1b9a',
  train_station:     '#283593',
  bus_station:       '#37474f',
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

// ---- SVGアイコンURLを生成（施設名ラベル付き吹き出し） ----
function makeLabelIconUrl(label: string, color: string, emoji: string): string {
  // 表示名を最大10文字に制限
  const displayName = label.length > 10 ? label.slice(0, 10) + '…' : label;
  const text = `${emoji} ${displayName}`;
  // 文字数に応じて幅を調整
  const width = Math.max(80, text.length * 8 + 16);
  const height = 28;
  const arrowH = 8;
  const totalH = height + arrowH;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="6" ry="6"
      fill="${color}" opacity="0.95"/>
    <text x="${width / 2}" y="18" font-family="'Noto Sans JP','Hiragino Sans','Meiryo',sans-serif"
      font-size="11" font-weight="bold" fill="white" text-anchor="middle">${text}</text>
    <polygon points="${width / 2 - 6},${height} ${width / 2 + 6},${height} ${width / 2},${totalH}"
      fill="${color}" opacity="0.95"/>
  </svg>`;

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// ---- 物件マーカー用SVG ----
function makePropertyIconUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="36">
    <rect x="0" y="0" width="90" height="28" rx="6" ry="6" fill="#d32f2f" opacity="0.97"/>
    <text x="45" y="19" font-family="'Noto Sans JP','Hiragino Sans','Meiryo',sans-serif"
      font-size="12" font-weight="bold" fill="white" text-anchor="middle">📍 物件</text>
    <polygon points="39,28 51,28 45,36" fill="#d32f2f" opacity="0.97"/>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// ---- 印刷用HTMLを生成して別ウィンドウで印刷 ----
function printNearbyMap(address: string, nearbyData: NearbyData) {
  const categoryColors = CATEGORY_COLORS;

  // カテゴリ別リストのHTML
  const listHtml = nearbyData.categories
    .map((cat) => {
      const places = nearbyData.places[cat.type] || [];
      if (places.length === 0) return '';
      const color = categoryColors[cat.type] || '#757575';
      const rows = places
        .map(
          (p) =>
            `<tr>
              <td style="padding:3px 6px;font-size:11px;">${p.name}</td>
              <td style="padding:3px 6px;font-size:11px;color:#555;">${p.vicinity}</td>
              <td style="padding:3px 6px;font-size:11px;color:#1565c0;text-align:right;">約${p.distance}m</td>
              ${p.rating ? `<td style="padding:3px 6px;font-size:11px;color:#e65100;">★${p.rating}</td>` : '<td></td>'}
            </tr>`
        )
        .join('');
      return `
        <div style="margin-bottom:12px;break-inside:avoid;">
          <div style="background:${color};color:white;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:bold;margin-bottom:4px;">
            ${cat.icon} ${cat.label}（${places.length}件）
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:3px 6px;font-size:11px;text-align:left;border-bottom:1px solid #ddd;">施設名</th>
                <th style="padding:3px 6px;font-size:11px;text-align:left;border-bottom:1px solid #ddd;">住所</th>
                <th style="padding:3px 6px;font-size:11px;text-align:right;border-bottom:1px solid #ddd;">距離</th>
                <th style="padding:3px 6px;font-size:11px;border-bottom:1px solid #ddd;">評価</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>近隣環境マップ - ${address}</title>
  <style>
    @page { size: A4; margin: 12mm 15mm; }
    body { font-family: 'Noto Sans JP','Hiragino Sans','Meiryo',sans-serif; margin:0; padding:0; }
    h1 { font-size:16px; margin:0 0 4px; }
    .subtitle { font-size:11px; color:#555; margin-bottom:12px; }
    .divider { border:none; border-top:2px solid #1565c0; margin:8px 0 12px; }
  </style>
</head>
<body>
  <h1>近隣環境マップ</h1>
  <div class="subtitle">${address} ／ 半径${(nearbyData.radius / 1000).toFixed(1)}km圏内の施設</div>
  <hr class="divider"/>
  ${listHtml}
  <script>window.onload = function(){ window.print(); window.close(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=900');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
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
  const markersRef = useRef<google.maps.Marker[]>([]);
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
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }, []);

  // ---- マップロード時 ----
  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();
      if (nearbyData) renderMarkers(map, nearbyData);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // 物件マーカー（中心）
    const centerMarker = new google.maps.Marker({
      position: data.center,
      map,
      title: address || '物件',
      zIndex: 2000,
      icon: {
        url: makePropertyIconUrl(),
        anchor: new google.maps.Point(45, 36),
      },
    });
    markersRef.current.push(centerMarker);

    // 施設マーカー（カテゴリ別ラベル付き）
    data.categories.forEach((cat) => {
      const places = data.places[cat.type] || [];
      const color = CATEGORY_COLORS[cat.type] || '#757575';

      places.forEach((place, idx) => {
        if (!place.lat || !place.lng) return;

        const iconUrl = makeLabelIconUrl(place.name, color, cat.icon);
        // 文字数に応じた幅
        const displayName = place.name.length > 10 ? place.name.slice(0, 10) + '…' : place.name;
        const text = `${cat.icon} ${displayName}`;
        const iconWidth = Math.max(80, text.length * 8 + 16);
        const iconHeight = 36; // height + arrowH

        const marker = new google.maps.Marker({
          position: { lat: place.lat, lng: place.lng },
          map,
          title: `${place.name} (${place.distance}m)`,
          zIndex: 1000 - idx,
          icon: {
            url: iconUrl,
            anchor: new google.maps.Point(iconWidth / 2, iconHeight),
            scaledSize: new google.maps.Size(iconWidth, iconHeight),
          },
        });

        // クリックでInfoWindow
        marker.addListener('click', () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(`
              <div style="font-size:13px;padding:6px 10px;min-width:180px;line-height:1.7;font-family:'Noto Sans JP','Hiragino Sans','Meiryo',sans-serif;">
                <div style="font-weight:bold;font-size:14px;margin-bottom:4px;color:#111;">
                  ${cat.icon} ${place.name}
                </div>
                <div style="color:#555;font-size:12px;">${place.vicinity}</div>
                <div style="color:#1565c0;font-weight:bold;margin-top:6px;">
                  物件から約 <span style="font-size:15px;">${place.distance}</span>m
                </div>
                ${place.rating ? `<div style="color:#e65100;margin-top:2px;">★ ${place.rating}</div>` : ''}
              </div>
            `);
            infoWindowRef.current.open(map, marker);
          }
        });

        markersRef.current.push(marker);
      });
    });
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

  const totalPlaces = nearbyData
    ? Object.values(nearbyData.places).reduce((sum, arr) => sum + arr.length, 0)
    : 0;

  return (
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
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}
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
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ flex: 1, overflow: 'auto', p: 2 }}>
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

        {/* 地図 + 施設リスト（横並び） */}
        {hasCoords && isMapLoaded && (
          <Box sx={{ display: 'flex', gap: 2, height: 600 }}>
            {/* Google Map（左側・大きめ） */}
            <Box
              sx={{
                flex: '1 1 65%',
                borderRadius: 1,
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                minWidth: 0,
              }}
            >
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={coords!}
                zoom={13}  // 2km圏内が全部見えるズームレベル
                options={{
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: true,
                  clickableIcons: false, // 既存のGoogleアイコンクリックを無効化
                }}
                onLoad={handleMapLoad}
              />
            </Box>

            {/* 施設リスト（右側パネル） */}
            <Box
              sx={{
                flex: '0 0 35%',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              {hasPlaces && nearbyData ? (
                <>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ px: 0.5 }}>
                    半径{(nearbyData.radius / 1000).toFixed(1)}km圏内の施設
                  </Typography>
                  {nearbyData.categories.map((cat) => {
                    const places = nearbyData.places[cat.type] || [];
                    if (places.length === 0) return null;
                    const color = CATEGORY_COLORS[cat.type] || '#757575';
                    return (
                      <Paper
                        key={cat.type}
                        variant="outlined"
                        sx={{ p: 1, borderLeft: `4px solid ${color}`, flexShrink: 0 }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                          <Typography fontSize={14}>{cat.icon}</Typography>
                          <Typography variant="caption" fontWeight="bold" sx={{ color }}>
                            {cat.label}
                          </Typography>
                          <Chip
                            label={places.length}
                            size="small"
                            sx={{ ml: 'auto', height: 16, fontSize: '10px' }}
                          />
                        </Box>
                        <List dense disablePadding>
                          {places.map((place, idx) => (
                            <ListItem key={idx} disablePadding sx={{ py: 0.1 }}>
                              <ListItemText
                                primary={
                                  <Typography
                                    variant="caption"
                                    sx={{ fontWeight: idx === 0 ? 'bold' : 'normal', display: 'block' }}
                                  >
                                    {place.name}
                                  </Typography>
                                }
                                secondary={
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px' }}>
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
                </>
              ) : (
                !loadingPlaces && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Typography variant="body2" color="text.secondary">
                      施設情報を読み込み中...
                    </Typography>
                  </Box>
                )
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      {/* フッター */}
      <Divider />
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
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

        {/* PDF印刷（別ウィンドウで印刷 → print.cssの影響を受けない） */}
        <Button
          variant="contained"
          color="primary"
          startIcon={<PrintIcon />}
          onClick={() => nearbyData && printNearbyMap(address || '', nearbyData)}
          disabled={!hasPlaces}
        >
          PDFで印刷
        </Button>

        <Button variant="outlined" onClick={handleClose}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NearbyMapModal;
