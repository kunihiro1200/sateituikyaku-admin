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
  Tab,
  Tabs,
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

// ---- SVGラベルアイコン（施設名付き吹き出し） ----
function makeLabelIconUrl(label: string, color: string, emoji: string): string {
  const displayName = label.length > 10 ? label.slice(0, 10) + '…' : label;
  const text = `${emoji} ${displayName}`;
  const width = Math.max(72, text.length * 7.5 + 14);
  const h = 24;
  const arrowH = 7;
  const totalH = h + arrowH;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}">
    <rect x="0" y="0" width="${width}" height="${h}" rx="5" ry="5" fill="${color}" opacity="0.93"/>
    <text x="${width / 2}" y="16" font-family="'Noto Sans JP','Hiragino Sans','Meiryo',sans-serif"
      font-size="10" font-weight="bold" fill="white" text-anchor="middle">${text}</text>
    <polygon points="${width / 2 - 5},${h} ${width / 2 + 5},${h} ${width / 2},${totalH}"
      fill="${color}" opacity="0.93"/>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// ---- 物件マーカー（小さめ） ----
function makePropertyIconUrl(): string {
  // 元の半分サイズ: 45×18
  const w = 46;
  const h = 18;
  const arrowH = 6;
  const totalH = h + arrowH;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalH}">
    <rect x="0" y="0" width="${w}" height="${h}" rx="4" ry="4" fill="#d32f2f" opacity="0.97"/>
    <text x="${w / 2}" y="12" font-family="'Noto Sans JP','Hiragino Sans','Meiryo',sans-serif"
      font-size="9" font-weight="bold" fill="white" text-anchor="middle">📍物件</text>
    <polygon points="${w / 2 - 4},${h} ${w / 2 + 4},${h} ${w / 2},${totalH}"
      fill="#d32f2f" opacity="0.97"/>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// ---- 施設リストHTML（印刷用） ----
function buildListHtml(nearbyData: NearbyData, radiusLabel: string): string {
  return nearbyData.categories
    .map((cat) => {
      const places = nearbyData.places[cat.type] || [];
      if (places.length === 0) return '';
      const color = CATEGORY_COLORS[cat.type] || '#757575';
      const rows = places
        .map(
          (p) =>
            `<tr>
              <td style="padding:2px 5px;font-size:10px;border-bottom:1px solid #eee;">${p.name}</td>
              <td style="padding:2px 5px;font-size:9px;color:#555;border-bottom:1px solid #eee;">${p.vicinity}</td>
              <td style="padding:2px 5px;font-size:10px;color:#1565c0;text-align:right;border-bottom:1px solid #eee;white-space:nowrap;">約${p.distance}m</td>
              <td style="padding:2px 5px;font-size:9px;color:#e65100;border-bottom:1px solid #eee;">${p.rating ? `★${p.rating}` : ''}</td>
            </tr>`
        )
        .join('');
      return `<div style="margin-bottom:6px;break-inside:avoid;">
        <div style="background:${color};color:white;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:bold;margin-bottom:2px;">
          ${cat.icon} ${cat.label}（${places.length}件）
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join('');
}

// ---- PDF印刷：隠しiframeで印刷（ポップアップブロック回避） ----
function printNearbyMapBothRadii(
  address: string,
  data1km: NearbyData | null,
  data2km: NearbyData | null
) {
  const list1 = data1km ? buildListHtml(data1km, '1km') : '<p style="color:#999;font-size:11px;">データなし</p>';
  const list2 = data2km ? buildListHtml(data2km, '2km') : '<p style="color:#999;font-size:11px;">データなし</p>';

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>近隣環境マップ</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Noto Sans JP','Hiragino Sans','Meiryo',sans-serif;
      margin: 0; padding: 0; font-size: 10px; color: #111;
    }
    h1 { font-size: 14px; margin: 0 0 2px; color: #1565c0; }
    .subtitle { font-size: 9px; color: #555; margin-bottom: 6px; }
    .divider { border: none; border-top: 2px solid #1565c0; margin: 4px 0 8px; }
    .columns { display: flex; gap: 10px; }
    .col { flex: 1; min-width: 0; }
    .col-title {
      font-size: 12px; font-weight: bold; color: white;
      padding: 3px 8px; border-radius: 4px; margin-bottom: 6px;
    }
    .col-1km { background: #1565c0; }
    .col-2km { background: #2e7d32; }
  </style>
</head>
<body>
  <h1>近隣環境マップ</h1>
  <div class="subtitle">${address}</div>
  <hr class="divider"/>
  <div class="columns">
    <div class="col">
      <div class="col-title col-1km">🔵 半径1km圏内の施設</div>
      ${list1}
    </div>
    <div class="col">
      <div class="col-title col-2km">🟢 半径2km圏内の施設</div>
      ${list2}
    </div>
  </div>
</body>
</html>`;

  // 隠しiframeで印刷（ポップアップブロックを回避）
  const existingFrame = document.getElementById('nearby-print-frame');
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'nearby-print-frame';
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  // フォント読み込み待ち後に印刷
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Print failed:', e);
    }
    // 印刷後にiframeを削除
    setTimeout(() => iframe.remove(), 3000);
  }, 600);
}

// ---- マーカーを地図に描画 ----
function renderMarkersOnMap(
  map: google.maps.Map,
  data: NearbyData,
  address: string,
  infoWindow: google.maps.InfoWindow,
  markersRef: React.MutableRefObject<google.maps.Marker[]>
) {
  // 既存マーカー削除
  markersRef.current.forEach((m) => m.setMap(null));
  markersRef.current = [];

  // 物件マーカー（小さめ）
  const propW = 46;
  const propH = 24; // totalH
  const centerMarker = new google.maps.Marker({
    position: data.center,
    map,
    title: address || '物件',
    zIndex: 2000,
    icon: {
      url: makePropertyIconUrl(),
      anchor: new google.maps.Point(propW / 2, propH),
      scaledSize: new google.maps.Size(propW, propH),
    },
  });
  markersRef.current.push(centerMarker);

  // 施設マーカー
  data.categories.forEach((cat) => {
    const places = data.places[cat.type] || [];
    const color = CATEGORY_COLORS[cat.type] || '#757575';

    places.forEach((place, idx) => {
      if (!place.lat || !place.lng) return;

      const displayName = place.name.length > 10 ? place.name.slice(0, 10) + '…' : place.name;
      const text = `${cat.icon} ${displayName}`;
      const iconWidth = Math.max(72, text.length * 7.5 + 14);
      const iconHeight = 31; // h(24) + arrowH(7)

      const marker = new google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map,
        title: `${place.name} (${place.distance}m)`,
        zIndex: 1000 - idx,
        icon: {
          url: makeLabelIconUrl(place.name, color, cat.icon),
          anchor: new google.maps.Point(iconWidth / 2, iconHeight),
          scaledSize: new google.maps.Size(iconWidth, iconHeight),
        },
      });

      marker.addListener('click', () => {
        infoWindow.setContent(`
          <div style="font-size:12px;padding:5px 8px;min-width:160px;line-height:1.6;
            font-family:'Noto Sans JP','Hiragino Sans','Meiryo',sans-serif;">
            <div style="font-weight:bold;font-size:13px;margin-bottom:3px;">
              ${cat.icon} ${place.name}
            </div>
            <div style="color:#555;font-size:11px;">${place.vicinity}</div>
            <div style="color:#1565c0;font-weight:bold;margin-top:4px;">
              物件から約 ${place.distance}m
            </div>
            ${place.rating ? `<div style="color:#e65100;">★ ${place.rating}</div>` : ''}
          </div>
        `);
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
    });
  });
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
  const [data1km, setData1km] = useState<NearbyData | null>(null);
  const [data2km, setData2km] = useState<NearbyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0); // 0=1km, 1=2km

  // 各タブ用のマップ・マーカー ref
  const map1Ref = useRef<google.maps.Map | null>(null);
  const map2Ref = useRef<google.maps.Map | null>(null);
  const markers1Ref = useRef<google.maps.Marker[]>([]);
  const markers2Ref = useRef<google.maps.Marker[]>([]);
  const infoWindow1Ref = useRef<google.maps.InfoWindow | null>(null);
  const infoWindow2Ref = useRef<google.maps.InfoWindow | null>(null);

  // ---- 座標取得 ----
  useEffect(() => {
    if (!open || !googleMapUrl) return;
    setCoords(null);
    extractCoords(googleMapUrl, apiBase).then((c) => {
      if (c) setCoords(c);
    });
  }, [open, googleMapUrl, apiBase]);

  // ---- 1km・2km 同時取得 ----
  useEffect(() => {
    if (!open || !coords) return;
    fetchBothRadii();
  }, [open, coords]);

  const fetchBothRadii = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    setError(null);
    try {
      const [resp1, resp2] = await Promise.all([
        api.get('/api/nearby-map/places', { params: { lat: coords.lat, lng: coords.lng, radius: 1000 } }),
        api.get('/api/nearby-map/places', { params: { lat: coords.lat, lng: coords.lng, radius: 2000 } }),
      ]);
      setData1km(resp1.data);
      setData2km(resp2.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '近隣施設の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [coords]);

  // ---- マップ1km ロード ----
  const handleMap1Load = useCallback(
    (map: google.maps.Map) => {
      map1Ref.current = map;
      infoWindow1Ref.current = new google.maps.InfoWindow();
      if (data1km) renderMarkersOnMap(map, data1km, address || '', infoWindow1Ref.current, markers1Ref);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data1km]
  );

  // ---- マップ2km ロード ----
  const handleMap2Load = useCallback(
    (map: google.maps.Map) => {
      map2Ref.current = map;
      infoWindow2Ref.current = new google.maps.InfoWindow();
      if (data2km) renderMarkersOnMap(map, data2km, address || '', infoWindow2Ref.current, markers2Ref);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data2km]
  );

  // ---- データ更新時にマーカー再描画 ----
  useEffect(() => {
    if (map1Ref.current && data1km && infoWindow1Ref.current) {
      renderMarkersOnMap(map1Ref.current, data1km, address || '', infoWindow1Ref.current, markers1Ref);
    }
  }, [data1km]);

  useEffect(() => {
    if (map2Ref.current && data2km && infoWindow2Ref.current) {
      renderMarkersOnMap(map2Ref.current, data2km, address || '', infoWindow2Ref.current, markers2Ref);
    }
  }, [data2km]);

  // ---- モーダルを閉じる ----
  const handleClose = () => {
    markers1Ref.current.forEach((m) => m.setMap(null));
    markers2Ref.current.forEach((m) => m.setMap(null));
    markers1Ref.current = [];
    markers2Ref.current = [];
    infoWindow1Ref.current?.close();
    infoWindow2Ref.current?.close();
    infoWindow1Ref.current = null;
    infoWindow2Ref.current = null;
    map1Ref.current = null;
    map2Ref.current = null;
    setCoords(null);
    setData1km(null);
    setData2km(null);
    setError(null);
    setActiveTab(0);
    onClose();
  };

  const hasCoords = !!coords;
  const hasData = !!(data1km || data2km);
  const currentData = activeTab === 0 ? data1km : data2km;

  const count1 = data1km ? Object.values(data1km.places).reduce((s, a) => s + a.length, 0) : 0;
  const count2 = data2km ? Object.values(data2km.places).reduce((s, a) => s + a.length, 0) : 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{ sx: { height: '92vh', display: 'flex', flexDirection: 'column' } }}
    >
      {/* ヘッダー */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <MapIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">近隣MAP</Typography>
          {address && (
            <Typography variant="body2" color="text.secondary">{address}</Typography>
          )}
        </Box>
        <IconButton onClick={handleClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <Divider />

      {/* タブ（1km / 2km） */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>🔵 半径1km</span>
                {count1 > 0 && <Chip label={`${count1}件`} size="small" sx={{ height: 18, fontSize: '10px' }} />}
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>🟢 半径2km</span>
                {count2 > 0 && <Chip label={`${count2}件`} size="small" sx={{ height: 18, fontSize: '10px' }} />}
              </Box>
            }
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 2 }}>
        {/* エラー・ローディング */}
        {!hasCoords && !loading && (
          <Alert severity="warning">
            Google Map URLから座標を取得できませんでした。URLが正しく設定されているか確認してください。
          </Alert>
        )}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
            <CircularProgress size={32} />
            <Typography>1km・2km圏内の施設を検索中...</Typography>
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}

        {/* 地図 + 施設リスト（横並び） */}
        {hasCoords && isMapLoaded && !loading && (
          <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>

            {/* Google Map（左65%） */}
            <Box sx={{ flex: '1 1 65%', borderRadius: 1, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: 0 }}>
              {/* 1km地図 */}
              <Box sx={{ display: activeTab === 0 ? 'block' : 'none', width: '100%', height: '100%' }}>
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={coords!}
                  zoom={14}
                  options={{ zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: true, clickableIcons: false }}
                  onLoad={handleMap1Load}
                />
              </Box>
              {/* 2km地図 */}
              <Box sx={{ display: activeTab === 1 ? 'block' : 'none', width: '100%', height: '100%' }}>
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={coords!}
                  zoom={13}
                  options={{ zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: true, clickableIcons: false }}
                  onLoad={handleMap2Load}
                />
              </Box>
            </Box>

            {/* 施設リスト（右35%） */}
            <Box sx={{ flex: '0 0 35%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {currentData ? (
                <>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ px: 0.5 }}>
                    半径{(currentData.radius / 1000).toFixed(0)}km圏内の施設
                  </Typography>
                  {currentData.categories.map((cat) => {
                    const places = currentData.places[cat.type] || [];
                    if (places.length === 0) return null;
                    const color = CATEGORY_COLORS[cat.type] || '#757575';
                    return (
                      <Paper key={cat.type} variant="outlined" sx={{ p: 0.75, borderLeft: `3px solid ${color}`, flexShrink: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Typography fontSize={13}>{cat.icon}</Typography>
                          <Typography variant="caption" fontWeight="bold" sx={{ color, fontSize: '11px' }}>
                            {cat.label}
                          </Typography>
                          <Chip label={places.length} size="small" sx={{ ml: 'auto', height: 15, fontSize: '9px' }} />
                        </Box>
                        <List dense disablePadding>
                          {places.map((place, idx) => (
                            <ListItem key={idx} disablePadding sx={{ py: 0 }}>
                              <ListItemText
                                primary={
                                  <Typography variant="caption" sx={{ fontWeight: idx === 0 ? 'bold' : 'normal', display: 'block', fontSize: '11px' }}>
                                    {place.name}
                                  </Typography>
                                }
                                secondary={
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '9px' }}>
                                    約{place.distance}m{place.rating ? `　★${place.rating}` : ''}
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
                !loading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Typography variant="body2" color="text.secondary">データを読み込み中...</Typography>
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
        <Tooltip title="1km・2km両方の施設情報を再取得します">
          <span>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchBothRadii} disabled={loading || !hasCoords} size="small">
              再取得
            </Button>
          </span>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {/* PDF印刷（隠しiframe方式 → ポップアップブロック回避、A4 1枚） */}
        <Button
          variant="contained"
          color="primary"
          startIcon={<PrintIcon />}
          onClick={() => printNearbyMapBothRadii(address || '', data1km, data2km)}
          disabled={!hasData}
        >
          PDFで印刷（A4・1枚）
        </Button>

        <Button variant="outlined" onClick={handleClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NearbyMapModal;
