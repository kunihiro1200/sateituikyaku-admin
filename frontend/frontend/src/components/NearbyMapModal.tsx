// NearbyMapModal - バックエンド経由でPlaces API取得
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

const COLORS: Record<string, string> = {
  supermarket: '#e53935', convenience_store: '#c62828',
  school: '#1565c0', kindergarten: '#0277bd',
  hospital: '#2e7d32', pharmacy: '#00695c',
  bank: '#e65100', post_office: '#bf360c',
  park: '#33691e', restaurant: '#6a1b9a',
  train_station: '#283593', bus_station: '#37474f',
};

// ---- URL から座標抽出 ----
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

// ---- テキストラベル付きSVGマーカー（常時表示） ----
function makeTextMarker(name: string, color: string): { url: string; w: number; h: number } {
  // 最大12文字に制限
  const label = name.length > 12 ? name.slice(0, 12) + '…' : name;
  const charW = 7.5;
  const w = Math.max(60, label.length * charW + 16);
  const h = 22;
  const ah = 6; // 矢印の高さ
  const totalH = h + ah;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalH}">
    <rect x="0" y="0" width="${w}" height="${h}" rx="4" ry="4" fill="${color}" opacity="0.92"/>
    <text x="${w/2}" y="15" font-family="'Hiragino Sans','Meiryo','Yu Gothic',sans-serif"
      font-size="10" font-weight="bold" fill="white" text-anchor="middle">${label}</text>
    <polygon points="${w/2-5},${h} ${w/2+5},${h} ${w/2},${totalH}" fill="${color}" opacity="0.92"/>
  </svg>`;
  return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w, h: totalH };
}

// ---- 物件マーカー（大きく目立つ） ----
function makePropertyMarker(): { url: string; w: number; h: number } {
  const w = 60; const h = 26; const ah = 8; const totalH = h + ah;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalH}">
    <rect x="0" y="0" width="${w}" height="${h}" rx="5" ry="5" fill="#d32f2f"/>
    <text x="${w/2}" y="18" font-family="'Hiragino Sans','Meiryo','Yu Gothic',sans-serif"
      font-size="12" font-weight="bold" fill="white" text-anchor="middle">📍 物件</text>
    <polygon points="${w/2-6},${h} ${w/2+6},${h} ${w/2},${totalH}" fill="#d32f2f"/>
  </svg>`;
  return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w, h: totalH };
}

// ---- マーカー描画（テキスト常時表示） ----
function drawMarkers(
  map: google.maps.Map,
  data: NearbyData,
  iw: google.maps.InfoWindow,
  ref: React.MutableRefObject<google.maps.Marker[]>
) {
  ref.current.forEach((m) => m.setMap(null)); ref.current = [];

  // 物件マーカー（大きく目立つ）
  const pm = makePropertyMarker();
  ref.current.push(new google.maps.Marker({
    position: data.center, map, title: '物件', zIndex: 3000,
    icon: { url: pm.url, anchor: new google.maps.Point(pm.w / 2, pm.h), scaledSize: new google.maps.Size(pm.w, pm.h) },
  }));

  // 施設マーカー（テキスト常時表示）
  data.categories.forEach((cat) => {
    const color = COLORS[cat.type] || '#757575';
    (data.places[cat.type] || []).forEach((p, idx) => {
      if (!p.lat || !p.lng) return;
      const ic = makeTextMarker(p.name, color);
      const mk = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng }, map,
        title: `${p.name} (${p.distance}m)`,
        zIndex: 1000 - idx,
        icon: { url: ic.url, anchor: new google.maps.Point(ic.w / 2, ic.h), scaledSize: new google.maps.Size(ic.w, ic.h) },
      });
      // クリックで詳細表示（距離・評価）
      mk.addListener('click', () => {
        iw.setContent(`<div style="font-size:12px;padding:5px 8px;min-width:160px;line-height:1.6;"><b>${cat.icon} ${p.name}</b><br/><span style="color:#555;font-size:11px;">${p.vicinity}</span><br/><span style="color:#1565c0;font-weight:bold;">物件から約 ${p.distance}m</span>${p.rating ? `<br/><span style="color:#e65100;">★ ${p.rating}</span>` : ''}</div>`);
        iw.open(map, mk);
      });
      ref.current.push(mk);
    });
  });
}

// ---- HTML エスケープ ----
function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ---- Static Maps URL生成（PDF用地図画像） ----
function buildStaticMapUrl(data: NearbyData, apiKey: string): string {
  const { center, radius } = data;
  // ズームレベルを半径から計算
  const zoom = radius <= 1000 ? 14 : 13;
  const size = '600x300';

  // マーカーを追加（物件 + 施設）
  const markers: string[] = [];

  // 物件マーカー（赤・大）
  markers.push(`markers=color:red%7Csize:large%7C${center.lat},${center.lng}`);

  // 施設マーカー（カテゴリ別色）
  const colorMap: Record<string, string> = {
    supermarket: 'red', convenience_store: 'red',
    school: 'blue', kindergarten: 'blue',
    hospital: 'green', pharmacy: 'green',
    bank: 'orange', post_office: 'orange',
    park: 'green', restaurant: 'purple',
    train_station: 'blue', bus_station: 'gray',
  };

  data.categories.forEach((cat) => {
    const places = data.places[cat.type] || [];
    const color = colorMap[cat.type] || 'gray';
    places.slice(0, 3).forEach((p) => {
      if (p.lat && p.lng) {
        markers.push(`markers=color:${color}%7Clabel:${encodeURIComponent(cat.icon.slice(0, 1))}%7C${p.lat},${p.lng}`);
      }
    });
  });

  const params = [
    `center=${center.lat},${center.lng}`,
    `zoom=${zoom}`,
    `size=${size}`,
    `language=ja`,
    `key=${apiKey}`,
    ...markers,
  ].join('&');

  return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
}

// ---- 施設リストHTML（印刷用） ----
function listHtml(data: NearbyData): string {
  const rows = data.categories.map((cat) => {
    const ps = data.places[cat.type] || []; if (!ps.length) return '';
    const color = COLORS[cat.type] || '#757575';
    const trs = ps.map((p) => `<tr><td class="n">${esc(p.name)}</td><td class="d">約${p.distance}m</td>${p.rating ? `<td class="r">★${p.rating}</td>` : '<td></td>'}</tr>`).join('');
    return `<div class="cb"><div class="ch" style="background:${color}">${cat.icon} ${cat.label}（${ps.length}件）</div><table><tbody>${trs}</tbody></table></div>`;
  }).join('');
  return rows || '<p class="nd">この圏内に施設が見つかりませんでした</p>';
}

// ---- PDF印刷（地図画像 + 施設リスト） ----
function doPrint(address: string, d1: NearbyData | null, d2: NearbyData | null) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const l1 = d1 ? listHtml(d1) : '<p class="nd">データなし</p>';
  const l2 = d2 ? listHtml(d2) : '<p class="nd">データなし</p>';
  const map1Url = d1 ? buildStaticMapUrl(d1, apiKey) : '';
  const map2Url = d2 ? buildStaticMapUrl(d2, apiKey) : '';

  const old = document.getElementById('nbp-root'); if (old) old.remove();
  const oldSt = document.getElementById('nbp-style'); if (oldSt) oldSt.remove();

  const st = document.createElement('style'); st.id = 'nbp-style';
  st.textContent = `@media print{
    body>*:not(#nbp-root){display:none!important;}
    #nbp-root{display:block!important;position:fixed!important;top:0!important;left:0!important;
      width:100%!important;background:white!important;z-index:999999!important;
      padding:8mm 10mm!important;font-family:'Hiragino Sans','Meiryo',sans-serif!important;
      font-size:9px!important;color:#111!important;
      -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
    #nbp-root h1{font-size:13px;color:#1565c0;margin-bottom:2px;}
    #nbp-root .sub{font-size:8px;color:#555;margin-bottom:5px;}
    #nbp-root hr{border:none;border-top:2px solid #1565c0;margin:3px 0 6px;}
    #nbp-root .maps{display:flex;gap:6px;margin-bottom:6px;}
    #nbp-root .map-block{flex:1;text-align:center;}
    #nbp-root .map-block img{width:100%;border:1px solid #ddd;border-radius:3px;}
    #nbp-root .map-label{font-size:9px;font-weight:bold;margin-bottom:2px;}
    #nbp-root .cols{display:flex;gap:8px;}
    #nbp-root .col{flex:1;min-width:0;}
    #nbp-root .ct{font-size:10px;font-weight:bold;color:white;padding:2px 6px;border-radius:3px;margin-bottom:4px;}
    #nbp-root .c1{background:#1565c0!important;}
    #nbp-root .c2{background:#2e7d32!important;}
    #nbp-root .cb{margin-bottom:4px;break-inside:avoid;}
    #nbp-root .ch{color:white!important;padding:1px 5px;border-radius:2px;font-size:8px;font-weight:bold;margin-bottom:1px;}
    #nbp-root table{width:100%;border-collapse:collapse;}
    #nbp-root .n{padding:1px 3px;font-size:8px;border-bottom:1px solid #eee;}
    #nbp-root .d{padding:1px 3px;font-size:8px;color:#1565c0;text-align:right;border-bottom:1px solid #eee;white-space:nowrap;}
    #nbp-root .r{padding:1px 3px;font-size:8px;color:#e65100;border-bottom:1px solid #eee;}
    #nbp-root .nd{font-size:8px;color:#999;padding:3px;}
  }`;
  document.head.appendChild(st);

  const div = document.createElement('div'); div.id = 'nbp-root'; div.style.display = 'none';
  div.innerHTML = `
    <h1>近隣環境マップ</h1>
    <div class="sub">${esc(address)}</div>
    <hr/>
    <div class="maps">
      ${map1Url ? `<div class="map-block"><div class="map-label" style="color:#1565c0">🔵 半径1km</div><img src="${map1Url}" alt="1km地図"/></div>` : ''}
      ${map2Url ? `<div class="map-block"><div class="map-label" style="color:#2e7d32">🟢 半径2km</div><img src="${map2Url}" alt="2km地図"/></div>` : ''}
    </div>
    <div class="cols">
      <div class="col"><div class="ct c1">🔵 半径1km圏内の施設</div>${l1}</div>
      <div class="col"><div class="ct c2">🟢 半径2km圏内の施設</div>${l2}</div>
    </div>`;
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
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  const mapRef = useRef<google.maps.Map | null>(null);
  const iwRef = useRef<google.maps.InfoWindow | null>(null);
  const mkRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!open || !googleMapUrl) return;
    setCoords(null); setData1(null); setData2(null); setError(null);
    extractCoords(googleMapUrl, apiBase).then((c) => { if (c) setCoords(c); });
  }, [open, googleMapUrl, apiBase]);

  const doFetch = useCallback(async (c: { lat: number; lng: number }) => {
    setLoading(true); setError(null);
    try {
      const [r1, r2] = await Promise.all([
        api.get('/api/nearby-map/places', { params: { lat: c.lat, lng: c.lng, radius: 1000 } }),
        api.get('/api/nearby-map/places', { params: { lat: c.lat, lng: c.lng, radius: 2000 } }),
      ]);
      setData1(r1.data);
      setData2(r2.data);
    } catch (e: any) {
      setError(e.response?.data?.error || '施設の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!coords) return;
    doFetch(coords);
  }, [coords, doFetch]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    iwRef.current = new google.maps.InfoWindow();
  }, []);

  useEffect(() => {
    if (!mapRef.current || !iwRef.current) return;
    const data = tab === 0 ? data1 : data2;
    if (!data) return;
    mapRef.current.setZoom(tab === 0 ? 14 : 13);
    drawMarkers(mapRef.current, data, iwRef.current, mkRef);
  }, [tab, data1, data2]);

  const handleClose = () => {
    mkRef.current.forEach((m) => m.setMap(null)); mkRef.current = [];
    iwRef.current?.close(); iwRef.current = null;
    mapRef.current = null;
    setCoords(null); setData1(null); setData2(null); setLoading(false); setError(null); setTab(0);
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
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

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
                  {cur.categories.map((cat) => {
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
              {!loading && !cur && !error && (
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
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => coords && doFetch(coords)} disabled={loading || !coords} size="small">再取得</Button>
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
