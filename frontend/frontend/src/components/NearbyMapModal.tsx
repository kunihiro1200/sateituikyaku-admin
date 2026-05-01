// NearbyMapModal - 地図1枚 + タブで半径切り替え
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, CircularProgress, Alert,
  Chip, Divider, IconButton, Tooltip,
  List, ListItem, ListItemText, Paper, Tab, Tabs,
} from '@mui/material';
import {
  Close as CloseIcon, Print as PrintIcon,
  Map as MapIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';

// ---- 型定義 ----
interface PlaceItem {
  name: string; vicinity: string;
  lat: number; lng: number;
  rating?: number; distance: number;
}
interface NearbyData {
  radius: number;
  places: Record<string, PlaceItem[]>;
}
interface NearbyMapModalProps {
  open: boolean; onClose: () => void;
  googleMapUrl?: string | null; address?: string;
  propertyNumber?: string; propertyType?: string;
}

// ---- カテゴリ定義 ----
const CATS = [
  { type: 'supermarket',       label: 'スーパー',             icon: '🛒' },
  { type: 'convenience_store', label: 'コンビニ',             icon: '🏪' },
  { type: 'school',            label: '小学校・中学校',       icon: '🏫' },
  { type: 'kindergarten',      label: '幼稚園・保育園',       icon: '🎒' },
  { type: 'hospital',          label: '病院・クリニック',     icon: '🏥' },
  { type: 'pharmacy',          label: '薬局・ドラッグストア', icon: '💊' },
  { type: 'bank',              label: '銀行・ATM',            icon: '🏦' },
  { type: 'post_office',       label: '郵便局',               icon: '📮' },
  { type: 'park',              label: '公園',                 icon: '🌳' },
  { type: 'restaurant',        label: 'レストラン',           icon: '🍽️' },
  { type: 'train_station',     label: '駅',                   icon: '🚉' },
  { type: 'bus_station',       label: 'バス停',               icon: '🚌' },
];

const COLORS: Record<string, string> = {
  supermarket: '#e53935', convenience_store: '#c62828',
  school: '#1565c0', kindergarten: '#0277bd',
  hospital: '#2e7d32', pharmacy: '#00695c',
  bank: '#e65100', post_office: '#bf360c',
  park: '#33691e', restaurant: '#6a1b9a',
  train_station: '#283593', bus_station: '#37474f',
};

// ---- 距離計算 ----
function dist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ---- URL から座標抽出 ----
async function extractCoords(url: string, apiBase: string): Promise<{ lat: number; lng: number } | null> {
  if (!url) return null;
  try {
    let s = url;
    if (s.includes('goo.gl') || s.includes('maps.app.goo.gl')) {
      const r = await fetch(`${apiBase}/api/url-redirect/resolve?url=${encodeURIComponent(s)}`);
      if (r.ok) { const d = await r.json(); s = d.redirectedUrl || s; }
    }
    for (const p of [
      /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /\/search\/(-?\d+\.?\d*),\+?(-?\d+\.?\d*)/,
      /\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /\/@(-?\d+\.?\d*),(-?\d+\.?\d*),/,
    ]) { const m = s.match(p); if (m) return { lat: +m[1], lng: +m[2] }; }
    return null;
  } catch { return null; }
}

// ---- Places API で1カテゴリ取得 ----
function searchCategory(
  svc: google.maps.places.PlacesService,
  center: google.maps.LatLng,
  radius: number,
  type: string,
): Promise<PlaceItem[]> {
  return new Promise((resolve) => {
    svc.nearbySearch(
      { location: center, radius, type: type as any },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
          resolve(
            results.slice(0, 5).map((r) => ({
              name: r.name || '',
              vicinity: r.vicinity || '',
              lat: r.geometry?.location?.lat() ?? 0,
              lng: r.geometry?.location?.lng() ?? 0,
              rating: r.rating,
              distance: dist(
                center.lat(), center.lng(),
                r.geometry?.location?.lat() ?? 0,
                r.geometry?.location?.lng() ?? 0,
              ),
            })).sort((a, b) => a.distance - b.distance)
          );
        } else {
          resolve([]);
        }
      }
    );
  });
}

// ---- 全カテゴリ取得 ----
async function fetchAll(
  svc: google.maps.places.PlacesService,
  center: { lat: number; lng: number },
  radius: number,
): Promise<NearbyData> {
  const ll = new google.maps.LatLng(center.lat, center.lng);
  const entries = await Promise.all(
    CATS.map(async (cat) => [cat.type, await searchCategory(svc, ll, radius, cat.type)] as const)
  );
  return { radius, places: Object.fromEntries(entries) };
}

// ---- SVG ラベルアイコン ----
function labelIcon(name: string, color: string, emoji: string) {
  const dn = name.length > 10 ? name.slice(0, 10) + '…' : name;
  const txt = `${emoji} ${dn}`;
  const w = Math.max(76, txt.length * 7.5 + 16);
  const h = 24; const ah = 7;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + ah}">
    <rect width="${w}" height="${h}" rx="5" fill="${color}" opacity=".93"/>
    <text x="${w / 2}" y="16" font-family="'Hiragino Sans','Meiryo',sans-serif"
      font-size="10" font-weight="bold" fill="white" text-anchor="middle">${txt}</text>
    <polygon points="${w / 2 - 5},${h} ${w / 2 + 5},${h} ${w / 2},${h + ah}" fill="${color}" opacity=".93"/>
  </svg>`;
  return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w, h: h + ah };
}

// ---- 物件マーカー ----
function propIcon() {
  const w = 46; const h = 18; const ah = 6;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + ah}">
    <rect width="${w}" height="${h}" rx="4" fill="#d32f2f" opacity=".97"/>
    <text x="${w / 2}" y="12" font-family="'Hiragino Sans','Meiryo',sans-serif"
      font-size="9" font-weight="bold" fill="white" text-anchor="middle">📍物件</text>
    <polygon points="${w / 2 - 4},${h} ${w / 2 + 4},${h} ${w / 2},${h + ah}" fill="#d32f2f" opacity=".97"/>
  </svg>`;
  return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w, h: h + ah };
}

// ---- マーカー描画 ----
function drawMarkers(
  map: google.maps.Map,
  data: NearbyData,
  center: { lat: number; lng: number },
  address: string,
  iw: google.maps.InfoWindow,
  ref: React.MutableRefObject<google.maps.Marker[]>,
) {
  ref.current.forEach((m) => m.setMap(null));
  ref.current = [];

  const pi = propIcon();
  ref.current.push(new google.maps.Marker({
    position: center, map, title: address || '物件', zIndex: 2000,
    icon: { url: pi.url, anchor: new google.maps.Point(pi.w / 2, pi.h), scaledSize: new google.maps.Size(pi.w, pi.h) },
  }));

  CATS.forEach((cat) => {
    const color = COLORS[cat.type] || '#757575';
    (data.places[cat.type] || []).forEach((p, idx) => {
      if (!p.lat || !p.lng) return;
      const ic = labelIcon(p.name, color, cat.icon);
      const mk = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng }, map,
        title: `${p.name} (${p.distance}m)`,
        zIndex: 1000 - idx,
        icon: { url: ic.url, anchor: new google.maps.Point(ic.w / 2, ic.h), scaledSize: new google.maps.Size(ic.w, ic.h) },
      });
      mk.addListener('click', () => {
        iw.setContent(`<div style="font-size:12px;padding:5px 8px;min-width:160px;line-height:1.6;font-family:'Hiragino Sans','Meiryo',sans-serif;">
          <b style="font-size:13px;">${cat.icon} ${p.name}</b><br/>
          <span style="color:#555;font-size:11px;">${p.vicinity}</span><br/>
          <span style="color:#1565c0;font-weight:bold;">物件から約 ${p.distance}m</span>
          ${p.rating ? `<br/><span style="color:#e65100;">★ ${p.rating}</span>` : ''}
        </div>`);
        iw.open(map, mk);
      });
      ref.current.push(mk);
    });
  });
}

// ---- HTML エスケープ ----
function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ---- 施設リスト HTML（印刷用） ----
function listHtml(data: NearbyData): string {
  const rows = CATS.map((cat) => {
    const ps = data.places[cat.type] || [];
    if (!ps.length) return '';
    const color = COLORS[cat.type] || '#757575';
    const trs = ps.map((p) =>
      `<tr><td class="n">${esc(p.name)}</td><td class="a">${esc(p.vicinity)}</td><td class="d">約${p.distance}m</td><td class="r">${p.rating ? `★${p.rating}` : ''}</td></tr>`
    ).join('');
    return `<div class="cb"><div class="ch" style="background:${color}">${cat.icon} ${cat.label}（${ps.length}件）</div><table><tbody>${trs}</tbody></table></div>`;
  }).join('');
  return rows || '<p class="nd">この圏内に施設が見つかりませんでした</p>';
}

// ---- PDF 印刷（新しいウィンドウ） ----
// srcdoc/iframeはブラウザによって動作が不安定なため、
// Blob URL + 新しいウィンドウ方式に変更
function doPrint(address: string, d1: NearbyData | null, d2: NearbyData | null) {
  const l1 = d1 ? listHtml(d1) : '<p class="nd">データなし</p>';
  const l2 = d2 ? listHtml(d2) : '<p class="nd">データなし</p>';

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
<title>近隣環境マップ</title>
<style>
@page{size:A4 portrait;margin:10mm 12mm;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Hiragino Sans','Meiryo','Yu Gothic',sans-serif;font-size:9px;color:#111;}
h1{font-size:13px;color:#1565c0;margin-bottom:2px;}
.sub{font-size:8px;color:#555;margin-bottom:5px;}
hr{border:none;border-top:2px solid #1565c0;margin:4px 0 8px;}
.cols{display:flex;gap:8px;}
.col{flex:1;min-width:0;}
.ct{font-size:10px;font-weight:bold;color:white;padding:3px 7px;border-radius:3px;margin-bottom:5px;}
.c1{background:#1565c0;}.c2{background:#2e7d32;}
.cb{margin-bottom:5px;break-inside:avoid;}
.ch{color:white;padding:2px 6px;border-radius:2px;font-size:9px;font-weight:bold;margin-bottom:2px;}
table{width:100%;border-collapse:collapse;}
.n{padding:1px 4px;font-size:9px;border-bottom:1px solid #eee;}
.a{padding:1px 4px;font-size:8px;color:#555;border-bottom:1px solid #eee;}
.d{padding:1px 4px;font-size:9px;color:#1565c0;text-align:right;border-bottom:1px solid #eee;white-space:nowrap;}
.r{padding:1px 4px;font-size:8px;color:#e65100;border-bottom:1px solid #eee;}
.nd{font-size:9px;color:#999;padding:4px;}
</style></head><body>
<h1>近隣環境マップ</h1>
<div class="sub">${esc(address)}</div><hr/>
<div class="cols">
  <div class="col"><div class="ct c1">&#x1F535; 半径1km圏内の施設</div>${l1}</div>
  <div class="col"><div class="ct c2">&#x1F7E2; 半径2km圏内の施設</div>${l2}</div>
</div>
</body></html>`;

  // Blob URL 方式（srcdocより確実）
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      setTimeout(() => {
        win.print();
        setTimeout(() => { win.close(); URL.revokeObjectURL(url); }, 2000);
      }, 500);
    };
  } else {
    // ポップアップブロック時のフォールバック：リンクをクリック
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

// ---- メインコンポーネント ----
const NearbyMapModal: React.FC<NearbyMapModalProps> = ({ open, onClose, googleMapUrl, address }) => {
  const { isLoaded } = useGoogleMaps();
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [data1, setData1] = useState<NearbyData | null>(null);
  const [data2, setData2] = useState<NearbyData | null>(null);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [tab, setTab] = useState(0);

  const mapRef = useRef<google.maps.Map | null>(null);
  const svcRef = useRef<google.maps.places.PlacesService | null>(null);
  const iwRef = useRef<google.maps.InfoWindow | null>(null);
  const mkRef = useRef<google.maps.Marker[]>([]);
  // coordsRef: onMapLoadWithCoords のクロージャ問題を回避するため、常に最新の coords を保持
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // ---- 座標取得 ----
  useEffect(() => {
    if (!open || !googleMapUrl) return;
    setCoords(null); setData1(null); setData2(null);
    coordsRef.current = null;
    extractCoords(googleMapUrl, apiBase).then((c) => { if (c) { coordsRef.current = c; setCoords(c); } });
  }, [open, googleMapUrl, apiBase]);

  // ---- 地図ロード ----
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    iwRef.current = new google.maps.InfoWindow();
    svcRef.current = new google.maps.places.PlacesService(map);
  }, []);

  // ---- 座標確定 & サービス準備後に取得 ----
  useEffect(() => {
    if (!coords || !svcRef.current) return;
    runFetch(coords);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  // 地図ロード後に coords が既にある場合
  // coordsRef を使うことで、useCallback のクロージャ問題（古い coords を参照する問題）を回避
  const onMapLoadWithCoords = useCallback((map: google.maps.Map) => {
    onMapLoad(map);
    // 少し待ってから coordsRef.current（常に最新）を参照して施設取得
    setTimeout(() => {
      if (svcRef.current && coordsRef.current) runFetch(coordsRef.current);
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runFetch = useCallback(async (c: { lat: number; lng: number }) => {
    if (!svcRef.current) return;
    const svc = svcRef.current;
    setLoading1(true); setLoading2(true);
    // 1km と 2km を並列取得
    const [d1, d2] = await Promise.all([
      fetchAll(svc, c, 1000),
      fetchAll(svc, c, 2000),
    ]);
    setData1(d1); setLoading1(false);
    setData2(d2); setLoading2(false);
  }, []);

  // ---- タブ切り替え時にマーカー更新 ----
  useEffect(() => {
    if (!mapRef.current || !iwRef.current || !coords) return;
    const data = tab === 0 ? data1 : data2;
    if (!data) return;
    // ズームも切り替え
    mapRef.current.setZoom(tab === 0 ? 14 : 13);
    drawMarkers(mapRef.current, data, coords, address || '', iwRef.current, mkRef);
  }, [tab, data1, data2, coords, address]);

  // ---- 再取得 ----
  const refetch = useCallback(() => {
    if (!coords || !svcRef.current) return;
    setData1(null); setData2(null);
    runFetch(coords);
  }, [coords, runFetch]);

  // ---- 閉じる ----
  const handleClose = () => {
    mkRef.current.forEach((m) => m.setMap(null)); mkRef.current = [];
    iwRef.current?.close(); iwRef.current = null;
    mapRef.current = null; svcRef.current = null;
    setCoords(null); setData1(null); setData2(null); setTab(0);
    onClose();
  };

  const loading = loading1 || loading2;
  const cur = tab === 0 ? data1 : data2;
  const c1 = data1 ? Object.values(data1.places).reduce((s, a) => s + a.length, 0) : 0;
  const c2 = data2 ? Object.values(data2.places).reduce((s, a) => s + a.length, 0) : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth
      PaperProps={{ sx: { height: '92vh', display: 'flex', flexDirection: 'column' } }}>

      {/* ヘッダー */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <MapIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">近隣MAP</Typography>
          {address && <Typography variant="body2" color="text.secondary">{address}</Typography>}
          {loading && <CircularProgress size={16} sx={{ ml: 1 }} />}
        </Box>
        <IconButton onClick={handleClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <Divider />

      {/* タブ */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <span>🔵 半径1km</span>
              {c1 > 0 && <Chip label={`${c1}件`} size="small" sx={{ height: 18, fontSize: '10px' }} />}
              {loading1 && <CircularProgress size={12} />}
            </Box>
          } />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <span>🟢 半径2km</span>
              {c2 > 0 && <Chip label={`${c2}件`} size="small" sx={{ height: 18, fontSize: '10px' }} />}
              {loading2 && <CircularProgress size={12} />}
            </Box>
          } />
        </Tabs>
      </Box>

      <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 2 }}>
        {!coords && !loading && (
          <Alert severity="warning">Google Map URLから座標を取得できませんでした。</Alert>
        )}

        {coords && isLoaded && (
          <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>

            {/* 地図（左65%）- 1枚だけ、常時表示 */}
            <Box sx={{ flex: '1 1 65%', borderRadius: 1, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: 0 }}>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={coords}
                zoom={14}
                options={{
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: true,
                  clickableIcons: false,
                }}
                onLoad={onMapLoadWithCoords}
              />
            </Box>

            {/* 施設リスト（右35%） */}
            <Box sx={{ flex: '0 0 35%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {loading && !cur && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2">施設を検索中...</Typography>
                </Box>
              )}
              {cur && (
                <>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ px: 0.5 }}>
                    半径{(cur.radius / 1000).toFixed(0)}km圏内の施設
                  </Typography>
                  {CATS.map((cat) => {
                    const places = cur.places[cat.type] || [];
                    if (!places.length) return null;
                    const color = COLORS[cat.type] || '#757575';
                    return (
                      <Paper key={cat.type} variant="outlined" sx={{ p: 0.75, borderLeft: `3px solid ${color}`, flexShrink: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Typography fontSize={13}>{cat.icon}</Typography>
                          <Typography variant="caption" fontWeight="bold" sx={{ color, fontSize: '11px' }}>{cat.label}</Typography>
                          <Chip label={places.length} size="small" sx={{ ml: 'auto', height: 15, fontSize: '9px' }} />
                        </Box>
                        <List dense disablePadding>
                          {places.map((p, i) => (
                            <ListItem key={i} disablePadding sx={{ py: 0 }}>
                              <ListItemText
                                primary={<Typography variant="caption" sx={{ fontWeight: i === 0 ? 'bold' : 'normal', display: 'block', fontSize: '11px' }}>{p.name}</Typography>}
                                secondary={<Typography variant="caption" color="text.secondary" sx={{ fontSize: '9px' }}>約{p.distance}m{p.rating ? `　★${p.rating}` : ''}</Typography>}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Paper>
                    );
                  })}
                </>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        <Tooltip title="施設情報を再取得します">
          <span>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refetch}
              disabled={loading || !coords} size="small">再取得</Button>
          </span>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained" color="primary" startIcon={<PrintIcon />}
          onClick={() => doPrint(address || '', data1, data2)}
          disabled={(!data1 && !data2) || loading}
        >
          PDFで印刷（A4・1枚）
        </Button>
        <Button variant="outlined" onClick={handleClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NearbyMapModal;
