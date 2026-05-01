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

// 飲食店・薬局・バス停を除外したカテゴリ
const DISPLAY_CATS = new Set([
  'supermarket', 'convenience_store', 'school', 'kindergarten',
  'hospital', 'bank', 'post_office', 'park', 'train_station',
]);

const COLORS: Record<string, string> = {
  supermarket: '#e53935', convenience_store: '#c62828',
  school: '#1565c0', kindergarten: '#0277bd',
  hospital: '#2e7d32',
  bank: '#e65100', post_office: '#bf360c',
  park: '#33691e',
  train_station: '#283593',
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

// ---- テキストラベル付きSVGマーカー ----
function makeTextMarker(name: string, color: string): { url: string; w: number; h: number } {
  const raw = name.length > 14 ? name.slice(0, 14) + '…' : name;
  const label = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const w = Math.max(60, raw.length * 6.5 + 14);
  const h = 20; const ah = 6; const totalH = h + ah;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalH}"><rect x="0" y="0" width="${w}" height="${h}" rx="4" ry="4" fill="${color}" opacity="0.92"/><text x="${w/2}" y="14" font-family="Meiryo,sans-serif" font-size="9" font-weight="bold" fill="white" text-anchor="middle">${label}</text><polygon points="${w/2-5},${h} ${w/2+5},${h} ${w/2},${totalH}" fill="${color}" opacity="0.92"/></svg>`;
  try { return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w, h: totalH }; }
  catch { return { url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), w, h: totalH }; }
}

// ---- 物件マーカー「📍 物件」 ----
function makePropertyMarker(): { url: string; w: number; h: number } {
  const w = 72; const h = 26; const ah = 8; const totalH = h + ah;
  // 絵文字を使わずテキストのみ（エンコードエラー回避）
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalH}"><rect x="0" y="0" width="${w}" height="${h}" rx="5" ry="5" fill="#d32f2f"/><text x="${w/2}" y="18" font-family="Meiryo,sans-serif" font-size="13" font-weight="bold" fill="white" text-anchor="middle">&#x1F4CD; &#x7269;&#x4EF6;</text><polygon points="${w/2-6},${h} ${w/2+6},${h} ${w/2},${totalH}" fill="#d32f2f"/></svg>`;
  try { return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w, h: totalH }; }
  catch { return { url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), w, h: totalH }; }
}

// ---- マーカー描画 ----
function drawMarkers(map: google.maps.Map, data: NearbyData, iw: google.maps.InfoWindow, ref: React.MutableRefObject<google.maps.Marker[]>) {
  ref.current.forEach((m) => m.setMap(null)); ref.current = [];
  const pm = makePropertyMarker();
  ref.current.push(new google.maps.Marker({
    position: data.center, map, title: '物件', zIndex: 3000,
    icon: { url: pm.url, anchor: new google.maps.Point(pm.w / 2, pm.h), scaledSize: new google.maps.Size(pm.w, pm.h) },
  }));
  data.categories.filter(cat => DISPLAY_CATS.has(cat.type)).forEach((cat) => {
    const color = COLORS[cat.type] || '#757575';
    (data.places[cat.type] || []).forEach((p, idx) => {
      if (!p.lat || !p.lng) return;
      const ic = makeTextMarker(p.name, color);
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

  useEffect(() => { if (!coords) return; doFetch(coords); }, [coords, doFetch]);

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

  // ---- 印刷：モーダルコンテンツをそのまま印刷 ----
  const handlePrint = () => {
    // 印刷用スタイルを一時的に追加
    const styleId = 'nearby-print-override';
    const old = document.getElementById(styleId); if (old) old.remove();
    const st = document.createElement('style'); st.id = styleId;
    st.textContent = `
      @media print {
        @page { size: A4 landscape; margin: 8mm; }
        body > *:not(.MuiDialog-root) { display: none !important; }
        .MuiDialog-root { position: static !important; }
        .MuiDialog-container { height: auto !important; align-items: flex-start !important; }
        .MuiDialog-paper {
          height: auto !important; max-height: none !important;
          box-shadow: none !important; margin: 0 !important;
          width: 100% !important; max-width: 100% !important;
        }
        .MuiDialogTitle-root { padding: 4px 8px !important; }
        .MuiDialogContent-root { overflow: visible !important; height: auto !important; }
        .MuiDialogActions-root { display: none !important; }
        .MuiTabs-root { display: none !important; }
        .no-print { display: none !important; }
        /* 地図エリアを固定高さで印刷 */
        .nearby-map-container { height: 400px !important; }
      }
    `;
    document.head.appendChild(st);
    window.print();
    setTimeout(() => st.remove(), 3000);
  };

  const cur = tab === 0 ? data1 : data2;
  const c1 = data1 ? Object.values(data1.places).filter((_, i) => DISPLAY_CATS.has(Object.keys(data1.places)[i])).reduce((s, a) => s + a.length, 0) : 0;
  const c2 = data2 ? Object.values(data2.places).filter((_, i) => DISPLAY_CATS.has(Object.keys(data2.places)[i])).reduce((s, a) => s + a.length, 0) : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth
      PaperProps={{ sx: { height: '92vh', display: 'flex', flexDirection: 'column' } }}>

      {/* 印刷用タイトル（通常時は非表示） */}
      <Box sx={{ display: 'none', '@media print': { display: 'block' }, px: 2, pt: 1 }}>
        <Typography variant="h6" fontWeight="bold">近隣環境マップ</Typography>
        {address && <Typography variant="body2" color="text.secondary">{address}</Typography>}
      </Box>

      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <MapIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">近隣MAP</Typography>
          {address && <Typography variant="body2" color="text.secondary">{address}</Typography>}
          {loading && <CircularProgress size={16} sx={{ ml: 1 }} />}
        </Box>
        <IconButton onClick={handleClose} size="small" className="no-print"><CloseIcon /></IconButton>
      </DialogTitle>
      <Divider />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }} className="no-print">
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
            {/* 地図（左65%） */}
            <Box className="nearby-map-container" sx={{ flex: '1 1 65%', borderRadius: 1, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: 0 }}>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={coords}
                zoom={14}
                options={{ zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: true, clickableIcons: false }}
                onLoad={onMapLoad}
              />
            </Box>

            {/* 施設リスト（右35%） */}
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
                  {cur.categories.filter(cat => DISPLAY_CATS.has(cat.type)).map((cat) => {
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
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }} className="no-print">
        <Tooltip title="施設情報を再取得します">
          <span>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => coords && doFetch(coords)} disabled={loading || !coords} size="small">再取得</Button>
          </span>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" color="primary" startIcon={<PrintIcon />}
          onClick={handlePrint}
          disabled={(!data1 && !data2) || loading}>
          PDFで印刷
        </Button>
        <Button variant="outlined" onClick={handleClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NearbyMapModal;
