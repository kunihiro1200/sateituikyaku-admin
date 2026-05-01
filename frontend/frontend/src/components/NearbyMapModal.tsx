import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, CircularProgress, Alert,
  Chip, Divider, IconButton, Tooltip,
  List, ListItem, ListItemText, Paper, Tab, Tabs,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon, Map as MapIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';

// ---- 型定義 ----
interface PlaceItem { name: string; vicinity: string; lat: number; lng: number; rating?: number; distance: number; }
interface NearbyData { radius: number; places: Record<string, PlaceItem[]>; }
interface NearbyMapModalProps { open: boolean; onClose: () => void; googleMapUrl?: string | null; address?: string; propertyNumber?: string; propertyType?: string; }

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

function calcDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function extractCoords(url: string, apiBase: string): Promise<{ lat: number; lng: number } | null> {
  if (!url) return null;
  try {
    let s = url;
    if (s.includes('goo.gl') || s.includes('maps.app.goo.gl')) {
      const r = await fetch(`${apiBase}/api/url-redirect/resolve?url=${encodeURIComponent(s)}`);
      if (r.ok) { const d = await r.json(); s = d.redirectedUrl || s; }
    }
    for (const p of [/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/, /\/search\/(-?\d+\.?\d*),\+?(-?\d+\.?\d*)/, /\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/, /\/@(-?\d+\.?\d*),(-?\d+\.?\d*),/]) {
      const m = s.match(p); if (m) return { lat: +m[1], lng: +m[2] };
    }
    return null;
  } catch { return null; }
}

// Places API で1カテゴリ検索（タイムアウト付き）
function searchOne(svc: google.maps.places.PlacesService, ll: google.maps.LatLng, radius: number, type: string): Promise<PlaceItem[]> {
  return new Promise((resolve) => {
    // 10秒でタイムアウト
    const timer = setTimeout(() => resolve([]), 10000);
    svc.nearbySearch({ location: ll, radius, type: type as any }, (results, status) => {
      clearTimeout(timer);
      if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
        resolve(results.slice(0, 5).map((r) => ({
          name: r.name || '',
          vicinity: r.vicinity || '',
          lat: r.geometry?.location?.lat() ?? 0,
          lng: r.geometry?.location?.lng() ?? 0,
          rating: r.rating,
          distance: calcDist(ll.lat(), ll.lng(), r.geometry?.location?.lat() ?? 0, r.geometry?.location?.lng() ?? 0),
        })).sort((a, b) => a.distance - b.distance));
      } else {
        resolve([]);
      }
    });
  });
}

async function fetchAll(svc: google.maps.places.PlacesService, center: { lat: number; lng: number }, radius: number): Promise<NearbyData> {
  const ll = new google.maps.LatLng(center.lat, center.lng);
  // 順番に実行（並列だとPlaces APIのレート制限に引っかかる可能性）
  const places: Record<string, PlaceItem[]> = {};
  for (const cat of CATS) {
    places[cat.type] = await searchOne(svc, ll, radius, cat.type);
  }
  return { radius, places };
}

function labelIcon(name: string, color: string, emoji: string) {
  const dn = name.length > 10 ? name.slice(0, 10) + '…' : name;
  const txt = `${emoji} ${dn}`;
  const w = Math.max(76, txt.length * 7.5 + 16); const h = 24; const ah = 7;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h+ah}"><rect width="${w}" height="${h}" rx="5" fill="${color}" opacity=".93"/><text x="${w/2}" y="16" font-family="'Hiragino Sans','Meiryo',sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle">${txt}</text><polygon points="${w/2-5},${h} ${w/2+5},${h} ${w/2},${h+ah}" fill="${color}" opacity=".93"/></svg>`;
  return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w, h: h + ah };
}

function drawMarkers(map: google.maps.Map, data: NearbyData, center: { lat: number; lng: number }, address: string, iw: google.maps.InfoWindow, ref: React.MutableRefObject<google.maps.Marker[]>) {
  ref.current.forEach((m) => m.setMap(null)); ref.current = [];
  // 物件マーカー（シンプルな赤丸）
  const centerMk = new google.maps.Marker({
    position: center, map, title: address || '物件', zIndex: 2000,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#d32f2f', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
  });
  const centerLabel = new google.maps.InfoWindow({ content: `<b style="color:#d32f2f;">📍 物件</b>` });
  centerLabel.open(map, centerMk);
  ref.current.push(centerMk);

  CATS.forEach((cat) => {
    const color = COLORS[cat.type] || '#757575';
    (data.places[cat.type] || []).forEach((p, idx) => {
      if (!p.lat || !p.lng) return;
      const ic = labelIcon(p.name, color, cat.icon);
      const mk = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng }, map,
        title: `${p.name} (${p.distance}m)`, zIndex: 1000 - idx,
        icon: { url: ic.url, anchor: new google.maps.Point(ic.w / 2, ic.h), scaledSize: new google.maps.Size(ic.w, ic.h) },
      });
      mk.addListener('click', () => {
        iw.setContent(`<div style="font-size:12px;padding:5px 8px;min-width:160px;line-height:1.6;"><b>${cat.icon} ${p.name}</b><br/><span style="color:#555;font-size:11px;">${p.vicinity}</span><br/><span style="color:#1565c0;font-weight:bold;">物件から約 ${p.distance}m</span>${p.rating ? `<br/><span style="color:#e65100;">★ ${p.rating}</span>` : ''}</div>`);
        iw.open(map, mk);
      });
      ref.current.push(mk);
    });
  });
}

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function listHtml(data: NearbyData): string {
  const rows = CATS.map((cat) => {
    const ps = data.places[cat.type] || []; if (!ps.length) return '';
    const color = COLORS[cat.type] || '#757575';
    const trs = ps.map((p) => `<tr><td class="n">${esc(p.name)}</td><td class="a">${esc(p.vicinity)}</td><td class="d">約${p.distance}m</td><td class="r">${p.rating ? `★${p.rating}` : ''}</td></tr>`).join('');
    return `<div class="cb"><div class="ch" style="background:${color}">${cat.icon} ${cat.label}（${ps.length}件）</div><table><tbody>${trs}</tbody></table></div>`;
  }).join('');
  return rows || '<p class="nd">この圏内に施設が見つかりませんでした</p>';
}

function doPrint(address: string, d1: NearbyData | null, d2: NearbyData | null) {
  const l1 = d1 ? listHtml(d1) : '<p class="nd">データなし</p>';
  const l2 = d2 ? listHtml(d2) : '<p class="nd">データなし</p>';
  const old = document.getElementById('nbp-root'); if (old) old.remove();
  const oldSt = document.getElementById('nbp-style'); if (oldSt) oldSt.remove();
  const st = document.createElement('style'); st.id = 'nbp-style';
  st.textContent = `@media print{body>*:not(#nbp-root){display:none!important;}#nbp-root{display:block!important;position:fixed!important;top:0!important;left:0!important;width:100%!important;background:white!important;z-index:999999!important;padding:10mm 12mm!important;font-family:'Hiragino Sans','Meiryo',sans-serif!important;font-size:9px!important;color:#111!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}#nbp-root h1{font-size:13px;color:#1565c0;margin-bottom:2px;}#nbp-root .sub{font-size:8px;color:#555;margin-bottom:5px;}#nbp-root hr{border:none;border-top:2px solid #1565c0;margin:4px 0 8px;}#nbp-root .cols{display:flex;gap:8px;}#nbp-root .col{flex:1;min-width:0;}#nbp-root .ct{font-size:10px;font-weight:bold;color:white;padding:3px 7px;border-radius:3px;margin-bottom:5px;}#nbp-root .c1{background:#1565c0!important;}#nbp-root .c2{background:#2e7d32!important;}#nbp-root .cb{margin-bottom:5px;break-inside:avoid;}#nbp-root .ch{color:white!important;padding:2px 6px;border-radius:2px;font-size:9px;font-weight:bold;margin-bottom:2px;}#nbp-root table{width:100%;border-collapse:collapse;}#nbp-root .n{padding:1px 4px;font-size:9px;border-bottom:1px solid #eee;}#nbp-root .a{padding:1px 4px;font-size:8px;color:#555;border-bottom:1px solid #eee;}#nbp-root .d{padding:1px 4px;font-size:9px;color:#1565c0;text-align:right;border-bottom:1px solid #eee;white-space:nowrap;}#nbp-root .r{padding:1px 4px;font-size:8px;color:#e65100;border-bottom:1px solid #eee;}#nbp-root .nd{font-size:9px;color:#999;padding:4px;}}`;
  document.head.appendChild(st);
  const div = document.createElement('div'); div.id = 'nbp-root'; div.style.display = 'none';
  div.innerHTML = `<h1>近隣環境マップ</h1><div class="sub">${esc(address)}</div><hr/><div class="cols"><div class="col"><div class="ct c1">🔵 半径1km圏内の施設</div>${l1}</div><div class="col"><div class="ct c2">🟢 半径2km圏内の施設</div>${l2}</div></div>`;
  document.body.appendChild(div);
  window.print();
  setTimeout(() => { div.remove(); st.remove(); }, 3000);
}

// ---- メインコンポーネント ----
const NearbyMapModal: React.FC<NearbyMapModalProps> = ({ open, onClose, googleMapUrl, address }) => {
  const { isLoaded } = useGoogleMaps();
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [data1, setData1] = useState<NearbyData | null>(null);
  const [data2, setData2] = useState<NearbyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);

  // refで管理（stateにしない）
  const mapRef = useRef<google.maps.Map | null>(null);
  const svcRef = useRef<google.maps.places.PlacesService | null>(null);
  const iwRef = useRef<google.maps.InfoWindow | null>(null);
  const mkRef = useRef<google.maps.Marker[]>([]);
  const isFetchingRef = useRef(false); // 二重実行防止

  // ---- 座標取得 ----
  useEffect(() => {
    if (!open || !googleMapUrl) return;
    setCoords(null); setData1(null); setData2(null);
    isFetchingRef.current = false;
    extractCoords(googleMapUrl, apiBase).then((c) => { if (c) setCoords(c); });
  }, [open, googleMapUrl, apiBase]);

  // ---- 施設取得（地図ロード後に呼ぶ） ----
  const doFetch = useCallback(async (svc: google.maps.places.PlacesService, c: { lat: number; lng: number }) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    try {
      // 1km取得
      const d1 = await fetchAll(svc, c, 1000);
      setData1(d1);
      // 2km取得
      const d2 = await fetchAll(svc, c, 2000);
      setData2(d2);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // ---- 地図ロード ----
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    iwRef.current = new google.maps.InfoWindow();
    const svc = new google.maps.places.PlacesService(map);
    svcRef.current = svc;
    // coordsが既にある場合はすぐ取得開始
    if (coords) {
      doFetch(svc, coords);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, doFetch]);

  // ---- 座標確定後、地図が既にロード済みなら取得開始 ----
  useEffect(() => {
    if (!coords || !svcRef.current || isFetchingRef.current) return;
    doFetch(svcRef.current, coords);
  }, [coords, doFetch]);

  // ---- タブ切り替え・データ更新時にマーカー再描画 ----
  useEffect(() => {
    if (!mapRef.current || !iwRef.current || !coords) return;
    const data = tab === 0 ? data1 : data2;
    if (!data) return;
    mapRef.current.setZoom(tab === 0 ? 14 : 13);
    drawMarkers(mapRef.current, data, coords, address || '', iwRef.current, mkRef);
  }, [tab, data1, data2, coords, address]);

  // ---- 再取得 ----
  const refetch = useCallback(() => {
    if (!coords || !svcRef.current) return;
    isFetchingRef.current = false;
    setData1(null); setData2(null);
    doFetch(svcRef.current, coords);
  }, [coords, doFetch]);

  // ---- 閉じる ----
  const handleClose = () => {
    mkRef.current.forEach((m) => m.setMap(null)); mkRef.current = [];
    iwRef.current?.close(); iwRef.current = null;
    mapRef.current = null; svcRef.current = null;
    isFetchingRef.current = false;
    setCoords(null); setData1(null); setData2(null); setLoading(false); setTab(0);
    onClose();
  };

  const cur = tab === 0 ? data1 : data2;
  const c1 = data1 ? Object.values(data1.places).reduce((s, a) => s + a.length, 0) : 0;
  const c2 = data2 ? Object.values(data2.places).reduce((s, a) => s + a.length, 0) : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth PaperProps={{ sx: { height: '92vh', display: 'flex', flexDirection: 'column' } }}>
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

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><span>🔵 半径1km</span>{c1 > 0 && <Chip label={`${c1}件`} size="small" sx={{ height: 18, fontSize: '10px' }} />}</Box>} />
          <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><span>🟢 半径2km</span>{c2 > 0 && <Chip label={`${c2}件`} size="small" sx={{ height: 18, fontSize: '10px' }} />}</Box>} />
        </Tabs>
      </Box>

      <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 2 }}>
        {!coords && !loading && <Alert severity="warning">Google Map URLから座標を取得できませんでした。</Alert>}

        {coords && isLoaded && (
          <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
            <Box sx={{ flex: '1 1 65%', borderRadius: 1, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: 0 }}>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={coords}
                zoom={14}
                options={{ zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: true, clickableIcons: false }}
                onLoad={onMapLoad}
              />
            </Box>

            <Box sx={{ flex: '0 0 35%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {loading && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2">施設を検索中...</Typography>
                </Box>
              )}
              {!loading && cur && (
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
              {!loading && !cur && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary">地図を読み込み中...</Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        <Tooltip title="施設情報を再取得します">
          <span>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refetch} disabled={loading || !coords} size="small">再取得</Button>
          </span>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" color="primary" startIcon={<PrintIcon />}
          onClick={() => doPrint(address || '', data1, data2)}
          disabled={(!data1 && !data2) || loading}>
          PDFで印刷（A4・1枚）
        </Button>
        <Button variant="outlined" onClick={handleClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NearbyMapModal;
