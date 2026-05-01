// NearbyMapModal - Google Maps JS API Places library でクライアント側から直接取得
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
import api from '../services/api';

// ---- 型定義 ----
interface PlaceItem { name: string; vicinity: string; lat: number; lng: number; rating?: number; distance: number; }
interface PlaceCategory { type: string; label: string; icon: string; }
interface NearbyData { center: { lat: number; lng: number }; radius: number; categories: PlaceCategory[]; places: Record<string, PlaceItem[]>; }
interface NearbyMapModalProps { open: boolean; onClose: () => void; googleMapUrl?: string | null; address?: string; propertyNumber?: string; propertyType?: string; }

// ---- カテゴリ定義 ----
const CATEGORIES: PlaceCategory[] = [
  { type: 'supermarket',       label: 'スーパー',           icon: '🛒' },
  { type: 'convenience_store', label: 'コンビニ',           icon: '🏪' },
  { type: 'school',            label: '小学校・中学校',     icon: '🏫' },
  { type: 'kindergarten',      label: '幼稚園・保育園',     icon: '🎒' },
  { type: 'hospital',          label: '病院・クリニック',   icon: '🏥' },
  { type: 'pharmacy',          label: '薬局・ドラッグストア', icon: '💊' },
  { type: 'bank',              label: '銀行・ATM',          icon: '🏦' },
  { type: 'post_office',       label: '郵便局',             icon: '📮' },
  { type: 'park',              label: '公園',               icon: '🌳' },
  { type: 'restaurant',        label: 'レストラン',         icon: '🍽️' },
  { type: 'train_station',     label: '駅',                 icon: '🚉' },
  { type: 'bus_station',       label: 'バス停',             icon: '🚌' },
];

// ---- カテゴリ別カラー ----
const COLORS: Record<string, string> = {
  supermarket: '#e53935', convenience_store: '#c62828',
  school: '#1565c0', kindergarten: '#0277bd',
  hospital: '#2e7d32', pharmacy: '#00695c',
  bank: '#e65100', post_office: '#bf360c',
  park: '#33691e', restaurant: '#6a1b9a',
  train_station: '#283593', bus_station: '#37474f',
};

// ---- Haversine距離計算 ----
function calcDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ---- Google Map URL から座標を抽出 ----
async function extractCoords(url: string, apiBase: string): Promise<{ lat: number; lng: number } | null> {
  if (!url) return null;
  try {
    let resolved = url;
    if (url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
      const resp = await fetch(`${apiBase}/api/url-redirect/resolve?url=${encodeURIComponent(url)}`);
      if (resp.ok) { const d = await resp.json(); resolved = d.redirectedUrl || url; }
    }
    const patterns = [/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/, /\/search\/(-?\d+\.?\d*),\+?(-?\d+\.?\d*)/, /\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/, /\/@(-?\d+\.?\d*),(-?\d+\.?\d*),/];
    for (const p of patterns) { const m = resolved.match(p); if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }; }
    return null;
  } catch { return null; }
}

// ---- Places API（クライアント側）で施設を取得 ----
function fetchPlacesForCategory(
  service: google.maps.places.PlacesService,
  center: google.maps.LatLng,
  radius: number,
  category: PlaceCategory
): Promise<PlaceItem[]> {
  return new Promise((resolve) => {
    const request: google.maps.places.PlaceSearchRequest = {
      location: center,
      radius,
      type: category.type as any,
      language: 'ja' as any,
    };
    service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const items: PlaceItem[] = results.slice(0, 5).map((r) => ({
          name: r.name || '',
          vicinity: r.vicinity || '',
          lat: r.geometry?.location?.lat() || 0,
          lng: r.geometry?.location?.lng() || 0,
          rating: r.rating,
          distance: calcDist(center.lat(), center.lng(), r.geometry?.location?.lat() || 0, r.geometry?.location?.lng() || 0),
        })).sort((a, b) => a.distance - b.distance);
        resolve(items);
      } else {
        resolve([]);
      }
    });
  });
}

// ---- SVGラベルアイコン ----
function makeLabelIconUrl(label: string, color: string, emoji: string): string {
  const dn = label.length > 10 ? label.slice(0, 10) + '…' : label;
  const text = `${emoji} ${dn}`;
  const w = Math.max(72, text.length * 7.5 + 14);
  const h = 24; const ah = 7; const th = h + ah;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${th}"><rect x="0" y="0" width="${w}" height="${h}" rx="5" ry="5" fill="${color}" opacity="0.93"/><text x="${w/2}" y="16" font-family="'Noto Sans JP','Hiragino Sans','Meiryo',sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle">${text}</text><polygon points="${w/2-5},${h} ${w/2+5},${h} ${w/2},${th}" fill="${color}" opacity="0.93"/></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// ---- 物件マーカー ----
function makePropertyIconUrl(): string {
  const w = 46; const h = 18; const ah = 6; const th = h + ah;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${th}"><rect x="0" y="0" width="${w}" height="${h}" rx="4" ry="4" fill="#d32f2f" opacity="0.97"/><text x="${w/2}" y="12" font-family="'Noto Sans JP','Hiragino Sans','Meiryo',sans-serif" font-size="9" font-weight="bold" fill="white" text-anchor="middle">&#x1F4CD;&#x7269;&#x4EF6;</text><polygon points="${w/2-4},${h} ${w/2+4},${h} ${w/2},${th}" fill="#d32f2f" opacity="0.97"/></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// ---- HTML エスケープ ----
function esc(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ---- 施設リストHTML（印刷用） ----
function buildListHtml(data: NearbyData): string {
  const html = data.categories.map((cat) => {
    const places = data.places[cat.type] || [];
    if (places.length === 0) return '';
    const color = COLORS[cat.type] || '#757575';
    const rows = places.map((p) =>
      `<tr><td class="n">${esc(p.name)}</td><td class="a">${esc(p.vicinity)}</td><td class="d">約${p.distance}m</td><td class="r">${p.rating ? `★${p.rating}` : ''}</td></tr>`
    ).join('');
    return `<div class="cb"><div class="ch" style="background:${color};">${cat.icon} ${cat.label}（${places.length}件）</div><table><tbody>${rows}</tbody></table></div>`;
  }).join('');
  return html || '<p class="nd">この圏内に施設が見つかりませんでした</p>';
}

// ---- PDF印刷（iframe srcdoc方式） ----
function doPrint(address: string, d1: NearbyData | null, d2: NearbyData | null) {
  const l1 = d1 ? buildListHtml(d1) : '<p class="nd">データなし</p>';
  const l2 = d2 ? buildListHtml(d2) : '<p class="nd">データなし</p>';
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/><title>近隣環境マップ</title>
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

  const old = document.getElementById('nbp-frame');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'nbp-frame';
  iframe.setAttribute('srcdoc', html);
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;visibility:hidden;';
  document.body.appendChild(iframe);
  iframe.onload = () => {
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (e) { console.error(e); }
      setTimeout(() => iframe.remove(), 5000);
    }, 300);
  };
}

// ---- マーカー描画 ----
function drawMarkers(map: google.maps.Map, data: NearbyData, address: string, iw: google.maps.InfoWindow, ref: React.MutableRefObject<google.maps.Marker[]>) {
  ref.current.forEach((m) => m.setMap(null));
  ref.current = [];
  const propW = 46; const propH = 24;
  ref.current.push(new google.maps.Marker({ position: data.center, map, title: address || '物件', zIndex: 2000, icon: { url: makePropertyIconUrl(), anchor: new google.maps.Point(propW / 2, propH), scaledSize: new google.maps.Size(propW, propH) } }));
  data.categories.forEach((cat) => {
    const color = COLORS[cat.type] || '#757575';
    (data.places[cat.type] || []).forEach((place, idx) => {
      if (!place.lat || !place.lng) return;
      const dn = place.name.length > 10 ? place.name.slice(0, 10) + '…' : place.name;
      const text = `${cat.icon} ${dn}`;
      const iw2 = Math.max(72, text.length * 7.5 + 14);
      const ih = 31;
      const marker = new google.maps.Marker({ position: { lat: place.lat, lng: place.lng }, map, title: `${place.name} (${place.distance}m)`, zIndex: 1000 - idx, icon: { url: makeLabelIconUrl(place.name, color, cat.icon), anchor: new google.maps.Point(iw2 / 2, ih), scaledSize: new google.maps.Size(iw2, ih) } });
      marker.addListener('click', () => {
        iw.setContent(`<div style="font-size:12px;padding:5px 8px;min-width:160px;line-height:1.6;font-family:'Hiragino Sans','Meiryo',sans-serif;"><div style="font-weight:bold;font-size:13px;margin-bottom:3px;">${cat.icon} ${place.name}</div><div style="color:#555;font-size:11px;">${place.vicinity}</div><div style="color:#1565c0;font-weight:bold;margin-top:4px;">物件から約 ${place.distance}m</div>${place.rating ? `<div style="color:#e65100;">★ ${place.rating}</div>` : ''}</div>`);
        iw.open(map, marker);
      });
      ref.current.push(marker);
    });
  });
}

// ---- メインコンポーネント ----
const NearbyMapModal: React.FC<NearbyMapModalProps> = ({ open, onClose, googleMapUrl, address }) => {
  const { isLoaded } = useGoogleMaps();
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [data1, setData1] = useState<NearbyData | null>(null);
  const [data2, setData2] = useState<NearbyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  const map1Ref = useRef<google.maps.Map | null>(null);
  const map2Ref = useRef<google.maps.Map | null>(null);
  const mk1 = useRef<google.maps.Marker[]>([]);
  const mk2 = useRef<google.maps.Marker[]>([]);
  const iw1 = useRef<google.maps.InfoWindow | null>(null);
  const iw2 = useRef<google.maps.InfoWindow | null>(null);
  // Places service は地図インスタンスが必要なので ref で保持
  const svc1 = useRef<google.maps.places.PlacesService | null>(null);
  const svc2 = useRef<google.maps.places.PlacesService | null>(null);

  // ---- 座標取得 ----
  useEffect(() => {
    if (!open || !googleMapUrl) return;
    setCoords(null); setData1(null); setData2(null);
    extractCoords(googleMapUrl, apiBase).then((c) => { if (c) setCoords(c); });
  }, [open, googleMapUrl, apiBase]);

  // ---- Places API で施設取得（地図ロード後に呼ぶ） ----
  const fetchForMap = useCallback(async (
    service: google.maps.places.PlacesService,
    center: { lat: number; lng: number },
    radius: number,
    setter: (d: NearbyData) => void
  ) => {
    const latLng = new google.maps.LatLng(center.lat, center.lng);
    const placesMap: Record<string, PlaceItem[]> = {};
    await Promise.all(
      CATEGORIES.map(async (cat) => {
        const items = await fetchPlacesForCategory(service, latLng, radius, cat);
        placesMap[cat.type] = items;
      })
    );
    setter({ center, radius, categories: CATEGORIES, places: placesMap });
  }, []);

  // ---- 1km地図ロード ----
  const onMap1Load = useCallback((map: google.maps.Map) => {
    map1Ref.current = map;
    iw1.current = new google.maps.InfoWindow();
    svc1.current = new google.maps.places.PlacesService(map);
    if (coords) {
      setLoading(true);
      fetchForMap(svc1.current, coords, 1000, (d) => { setData1(d); setLoading(false); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  // ---- 2km地図ロード ----
  const onMap2Load = useCallback((map: google.maps.Map) => {
    map2Ref.current = map;
    iw2.current = new google.maps.InfoWindow();
    svc2.current = new google.maps.places.PlacesService(map);
    if (coords) {
      fetchForMap(svc2.current, coords, 2000, (d) => setData2(d));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  // ---- データ更新時にマーカー再描画 ----
  useEffect(() => { if (map1Ref.current && data1 && iw1.current) drawMarkers(map1Ref.current, data1, address || '', iw1.current, mk1); }, [data1, address]);
  useEffect(() => { if (map2Ref.current && data2 && iw2.current) drawMarkers(map2Ref.current, data2, address || '', iw2.current, mk2); }, [data2, address]);

  // ---- 再取得 ----
  const refetch = useCallback(() => {
    if (!coords) return;
    setData1(null); setData2(null); setError(null);
    if (svc1.current) { setLoading(true); fetchForMap(svc1.current, coords, 1000, (d) => { setData1(d); setLoading(false); }); }
    if (svc2.current) fetchForMap(svc2.current, coords, 2000, (d) => setData2(d));
  }, [coords, fetchForMap]);

  // ---- 閉じる ----
  const handleClose = () => {
    mk1.current.forEach((m) => m.setMap(null)); mk2.current.forEach((m) => m.setMap(null));
    mk1.current = []; mk2.current = [];
    iw1.current?.close(); iw2.current?.close();
    iw1.current = null; iw2.current = null;
    map1Ref.current = null; map2Ref.current = null;
    svc1.current = null; svc2.current = null;
    setCoords(null); setData1(null); setData2(null); setError(null); setTab(0);
    onClose();
  };

  const cur = tab === 0 ? data1 : data2;
  const c1 = data1 ? Object.values(data1.places).reduce((s, a) => s + a.length, 0) : 0;
  const c2 = data2 ? Object.values(data2.places).reduce((s, a) => s + a.length, 0) : 0;
  const hasData = !!(data1 || data2);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth PaperProps={{ sx: { height: '92vh', display: 'flex', flexDirection: 'column' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <MapIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">近隣MAP</Typography>
          {address && <Typography variant="body2" color="text.secondary">{address}</Typography>}
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
        {loading && <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}><CircularProgress size={32} /><Typography>施設を検索中...</Typography></Box>}
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

        {coords && isLoaded && (
          <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
            {/* 地図（左65%） */}
            <Box sx={{ flex: '1 1 65%', borderRadius: 1, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: 0 }}>
              <Box sx={{ display: tab === 0 ? 'block' : 'none', width: '100%', height: '100%' }}>
                <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={coords} zoom={14} options={{ zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: true, clickableIcons: false }} onLoad={onMap1Load} />
              </Box>
              <Box sx={{ display: tab === 1 ? 'block' : 'none', width: '100%', height: '100%' }}>
                <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={coords} zoom={13} options={{ zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: true, clickableIcons: false }} onLoad={onMap2Load} />
              </Box>
            </Box>

            {/* 施設リスト（右35%） */}
            <Box sx={{ flex: '0 0 35%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {cur ? (
                <>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ px: 0.5 }}>
                    半径{(cur.radius / 1000).toFixed(0)}km圏内の施設
                  </Typography>
                  {cur.categories.map((cat) => {
                    const places = cur.places[cat.type] || [];
                    if (places.length === 0) return null;
                    const color = COLORS[cat.type] || '#757575';
                    return (
                      <Paper key={cat.type} variant="outlined" sx={{ p: 0.75, borderLeft: `3px solid ${color}`, flexShrink: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Typography fontSize={13}>{cat.icon}</Typography>
                          <Typography variant="caption" fontWeight="bold" sx={{ color, fontSize: '11px' }}>{cat.label}</Typography>
                          <Chip label={places.length} size="small" sx={{ ml: 'auto', height: 15, fontSize: '9px' }} />
                        </Box>
                        <List dense disablePadding>
                          {places.map((place, idx) => (
                            <ListItem key={idx} disablePadding sx={{ py: 0 }}>
                              <ListItemText
                                primary={<Typography variant="caption" sx={{ fontWeight: idx === 0 ? 'bold' : 'normal', display: 'block', fontSize: '11px' }}>{place.name}</Typography>}
                                secondary={<Typography variant="caption" color="text.secondary" sx={{ fontSize: '9px' }}>約{place.distance}m{place.rating ? `　★${place.rating}` : ''}</Typography>}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Paper>
                    );
                  })}
                </>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary">{loading ? '検索中...' : '地図を読み込み中...'}</Typography>
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
        <Button variant="contained" color="primary" startIcon={<PrintIcon />} onClick={() => doPrint(address || '', data1, data2)} disabled={!hasData || loading}>
          PDFで印刷（A4・1枚）
        </Button>
        <Button variant="outlined" onClick={handleClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NearbyMapModal;
