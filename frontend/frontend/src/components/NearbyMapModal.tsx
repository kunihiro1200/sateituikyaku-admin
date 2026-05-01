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

// 表示するカテゴリ（飲食店・薬局・バス停は除外）
const DISPLAY_CATS = new Set([
  'supermarket', 'convenience_store', 'school', 'kindergarten',
  'hospital', 'bank', 'post_office', 'park', 'train_station',
]);

const COLORS: Record<string, string> = {
  supermarket: '#e53935', convenience_store: '#c62828',
  school: '#1565c0', kindergarten: '#0277bd',
  hospital: '#2e7d32',
  bank: '#e65100', post_office: '#bf360c',
  park: '#33691e', train_station: '#283593',
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

// ---- テキストラベル付きSVGマーカー（文字切れ防止） ----
function makeTextMarker(name: string, color: string): { url: string; w: number; h: number } {
  // 最大12文字に制限（それ以上は省略）
  const raw = name.length > 12 ? name.slice(0, 12) + '…' : name;
  const label = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // 日本語1文字=10px、英数字=7px で幅を計算（font-size:10px bold 基準）
  let textW = 0;
  for (const ch of raw) { textW += ch.charCodeAt(0) > 127 ? 10 : 7; }
  const w = Math.max(56, textW + 28); // 左右パディング14pxずつ
  const h = 22; const ah = 6; const totalH = h + ah;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalH}">
    <rect x="0" y="0" width="${w}" height="${h}" rx="4" ry="4" fill="${color}" opacity="0.93"/>
    <text x="${w/2}" y="15" font-family="Meiryo,'Yu Gothic',sans-serif"
      font-size="10" font-weight="bold" fill="white" text-anchor="middle">${label}</text>
    <polygon points="${w/2-5},${h} ${w/2+5},${h} ${w/2},${totalH}" fill="${color}" opacity="0.93"/>
  </svg>`;
  try { return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w, h: totalH }; }
  catch { return { url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), w, h: totalH }; }
}

// ---- 物件マーカー（家マーク・吹き出しなし） ----
function makePropertyMarker(): { url: string; w: number; h: number } {
  const w = 40; const h = 40;
  // 家の形をSVGパスで描画
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 40 40">
    <!-- 影 -->
    <ellipse cx="20" cy="38" rx="10" ry="3" fill="rgba(0,0,0,0.2)"/>
    <!-- 家の本体 -->
    <polygon points="20,4 36,18 32,18 32,36 8,36 8,18 4,18" fill="#d32f2f" stroke="white" stroke-width="1.5"/>
    <!-- 屋根の強調 -->
    <polygon points="20,4 36,18 4,18" fill="#b71c1c" stroke="white" stroke-width="1"/>
    <!-- ドア -->
    <rect x="16" y="26" width="8" height="10" rx="1" fill="white" opacity="0.9"/>
    <!-- 窓 -->
    <rect x="11" y="22" width="6" height="5" rx="1" fill="white" opacity="0.8"/>
    <rect x="23" y="22" width="6" height="5" rx="1" fill="white" opacity="0.8"/>
  </svg>`;
  try { return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w, h }; }
  catch { return { url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), w, h }; }
}

// ---- マーカー描画 ----
function drawMarkers(map: google.maps.Map, data: NearbyData, iw: google.maps.InfoWindow, ref: React.MutableRefObject<google.maps.Marker[]>) {
  ref.current.forEach((m) => m.setMap(null)); ref.current = [];
  const pm = makePropertyMarker();
  ref.current.push(new google.maps.Marker({
    position: data.center, map, title: '物件', zIndex: 3000,
    icon: {
      url: pm.url,
      anchor: new google.maps.Point(pm.w / 2, pm.h), // 家の底中央を基準点に
      scaledSize: new google.maps.Size(pm.w, pm.h),
    },
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

// ---- 施設リストコンポーネント（印刷・通常共用） ----
function FacilityList({ data, label, color }: { data: NearbyData | null; label: string; color: string }) {
  if (!data) return <Typography variant="caption" color="text.secondary">データなし</Typography>;
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight="bold" sx={{ color, mb: 0.5, fontSize: '11px' }}>{label}</Typography>
      {data.categories.filter(cat => DISPLAY_CATS.has(cat.type)).map((cat) => {
        const places = data.places[cat.type] || [];
        if (!places.length) return null;
        const c = COLORS[cat.type] || '#757575';
        return (
          <Paper key={cat.type} variant="outlined" sx={{ p: 0.75, borderLeft: `3px solid ${c}`, mb: 0.75, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <Typography fontSize={12}>{cat.icon}</Typography>
              <Typography variant="caption" fontWeight="bold" sx={{ color: c, fontSize: '10px' }}>{cat.label}</Typography>
              <Chip label={places.length} size="small" sx={{ ml: 'auto', height: 14, fontSize: '9px' }} />
            </Box>
            <List dense disablePadding>
              {places.map((p, i) => (
                <ListItem key={i} disablePadding sx={{ py: 0 }}>
                  <ListItemText
                    primary={<Typography variant="caption" sx={{ fontWeight: i === 0 ? 'bold' : 'normal', display: 'block', fontSize: '10px' }}>{p.name}</Typography>}
                    secondary={<Typography variant="caption" color="text.secondary" sx={{ fontSize: '9px' }}>約{p.distance}m{p.rating ? `　★${p.rating}` : ''}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        );
      })}
    </Box>
  );
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

  // ---- 印刷：新規ウィンドウで地図画像＋施設リストを印刷 ----
  const handlePrint = () => {
    const curData = tab === 0 ? data1 : data2;
    const tabLabel = tab === 0 ? '半径1km圏内の施設' : '半径2km圏内の施設';

    // 施設リストのHTML生成
    const facilityHtml = curData
      ? curData.categories
          .filter(cat => DISPLAY_CATS.has(cat.type))
          .map(cat => {
            const places = curData.places[cat.type] || [];
            if (!places.length) return '';
            const color = COLORS[cat.type] || '#757575';
            const rows = places.map((p, i) =>
              `<div class="place-item">
                <span class="place-name" style="font-weight:${i === 0 ? 'bold' : 'normal'}">${p.name}</span>
                <span class="place-dist">約${p.distance}m${p.rating ? `　★${p.rating}` : ''}</span>
              </div>`
            ).join('');
            return `<div class="cat-block" style="border-left:3px solid ${color}">
              <div class="cat-header">
                <span>${cat.icon}</span>
                <span class="cat-label" style="color:${color}">${cat.label}</span>
                <span class="cat-count">${places.length}</span>
              </div>
              ${rows}
            </div>`;
          }).join('')
      : '';

    // Google Static Maps APIで地図画像URL生成
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    let mapImgHtml = '';
    if (coords) {
      // マーカーパラメータ生成
      const markerParams: string[] = [];
      // 物件マーカー
      markerParams.push(`markers=color:red%7Clabel:P%7C${coords.lat},${coords.lng}`);
      // 施設マーカー（カテゴリ別）
      if (curData) {
        curData.categories.filter(cat => DISPLAY_CATS.has(cat.type)).forEach(cat => {
          const places = curData.places[cat.type] || [];
          places.forEach(p => {
            if (p.lat && p.lng) {
              markerParams.push(`markers=size:tiny%7C${p.lat},${p.lng}`);
            }
          });
        });
      }
      const zoom = tab === 0 ? 14 : 13;
      const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${coords.lat},${coords.lng}&zoom=${zoom}&size=1200x630&scale=2&language=ja&${markerParams.join('&')}&key=${apiKey}`;
      mapImgHtml = `<img src="${staticUrl}" style="width:100%;height:auto;display:block;" alt="近隣MAP"/>`;
    } else {
      // Static Maps APIキーがない場合はGoogle Maps埋め込みURLを使用
      mapImgHtml = `<div style="padding:20px;text-align:center;color:#666;">地図を表示できませんでした</div>`;
    }

    const printHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8"/>
<title>近隣MAP - ${address || ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Meiryo', 'Yu Gothic', sans-serif; background: white; }
  @page { size: A4 landscape; margin: 8mm; }

  /* ===== 1ページ目：地図 ===== */
  .page-map {
    page-break-after: always;
    break-after: page;
    width: 100%;
  }
  .print-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3mm 0 2mm;
    border-bottom: 1px solid #ccc;
    margin-bottom: 3mm;
  }
  .print-header h1 { font-size: 13pt; font-weight: bold; }
  .print-header .addr { font-size: 9pt; color: #666; }
  .print-header .tab-label { font-size: 9pt; color: #1565c0; margin-left: auto; }
  .map-container { width: 100%; }
  .map-container img { width: 100%; height: auto; display: block; border: 1px solid #ddd; }

  /* ===== 2ページ目：施設リスト ===== */
  .page-list {
    page-break-before: always;
    break-before: page;
    width: 100%;
    columns: 3;
    column-gap: 6mm;
  }
  .cat-block {
    break-inside: avoid;
    padding: 3px 6px;
    margin-bottom: 5px;
    background: #fafafa;
  }
  .cat-header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
  }
  .cat-label { font-size: 9pt; font-weight: bold; }
  .cat-count {
    margin-left: auto;
    font-size: 8pt;
    background: #eee;
    border-radius: 8px;
    padding: 0 5px;
  }
  .place-item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 1px 0;
    border-bottom: 1px dotted #eee;
  }
  .place-name { font-size: 8.5pt; }
  .place-dist { font-size: 7.5pt; color: #888; white-space: nowrap; margin-left: 4px; }
  .list-header {
    font-size: 11pt;
    font-weight: bold;
    margin-bottom: 4mm;
    padding-bottom: 2mm;
    border-bottom: 1px solid #ccc;
    column-span: all;
  }
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
</style>
</head>
<body>

<!-- 1ページ目：地図 -->
<div class="page-map">
  <div class="print-header">
    <h1>🗺️ 近隣MAP</h1>
    ${address ? `<span class="addr">${address}</span>` : ''}
    <span class="tab-label">🔵 ${tabLabel}</span>
  </div>
  <div class="map-container">${mapImgHtml}</div>
</div>

<!-- 2ページ目：施設リスト -->
<div class="page-list">
  <div class="list-header">📍 ${tabLabel}</div>
  ${facilityHtml}
</div>

</body>
</html>`;

    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) { alert('ポップアップがブロックされました。許可してから再試行してください。'); return; }
    win.document.write(printHtml);
    win.document.close();
    win.onload = () => {
      setTimeout(() => {
        win.print();
        win.close();
      }, 500);
    };
  };

  const cur = tab === 0 ? data1 : data2;
  const c1 = data1 ? Object.values(data1.places).reduce((s, a) => s + a.length, 0) : 0;
  const c2 = data2 ? Object.values(data2.places).reduce((s, a) => s + a.length, 0) : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth
      PaperProps={{ sx: { height: '92vh', display: 'flex', flexDirection: 'column' } }}>

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

      {/* タブ（通常表示のみ） */}
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
          <Box className="nearby-print-wrapper" sx={{ display: 'flex', gap: 2, height: '100%' }}>

            {/* ===== 地図エリア（1ページ目） ===== */}
            <Box className="nearby-map-area" sx={{ flex: '1 1 65%', borderRadius: 1, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: 0 }}>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={coords}
                zoom={14}
                options={{ zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: true, clickableIcons: false }}
                onLoad={onMapLoad}
              />
            </Box>

            {/* ===== 施設リストエリア ===== */}
            <Box sx={{ flex: '0 0 35%', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

              {/* 通常表示（タブで切り替え） */}
              <Box className="nearby-screen-only" sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {loading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2">施設を検索中...</Typography>
                  </Box>
                )}
                {!loading && cur && (
                  <FacilityList
                    data={cur}
                    label={tab === 0 ? '🔵 半径1km圏内の施設' : '🟢 半径2km圏内の施設'}
                    color={tab === 0 ? '#1565c0' : '#2e7d32'}
                  />
                )}
                {!loading && !cur && !error && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Typography variant="body2" color="text.secondary">地図を読み込み中...</Typography>
                  </Box>
                )}
              </Box>

              {/* 印刷用（2ページ目：選択中タブの1列のみ） */}
              <Box className="nearby-list-area nearby-print-only" sx={{ display: 'none' }}>
                <Box sx={{ width: '100%' }}>
                  <FacilityList
                    data={tab === 0 ? data1 : data2}
                    label={tab === 0 ? '🔵 半径1km圏内の施設' : '🟢 半径2km圏内の施設'}
                    color={tab === 0 ? '#1565c0' : '#2e7d32'}
                  />
                </Box>
              </Box>

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
