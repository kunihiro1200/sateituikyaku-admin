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

// 表示するカテゴリ
const DISPLAY_CATS = new Set([
  'supermarket', 'convenience_store',
  'elementary_school', 'middle_school', 'high_school', 'kindergarten', 'cram_school',
  'hospital', 'dentist', 'bank', 'post_office', 'park', 'train_station',
  'restaurant',
]);

const COLORS: Record<string, string> = {
  supermarket: '#e53935', convenience_store: '#c62828',
  elementary_school: '#1565c0', middle_school: '#1565c0', high_school: '#1565c0',
  kindergarten: '#0277bd', cram_school: '#1565c0',
  hospital: '#2e7d32', dentist: '#2e7d32',
  bank: '#e65100', post_office: '#bf360c',
  park: '#33691e', train_station: '#283593',
  restaurant: '#d84315',
};

// 丸囲み文字アイコンを使うカテゴリと表示文字
const CIRCLE_ICONS: Record<string, string> = {
  kindergarten: '幼',
  elementary_school: '小',
  middle_school: '中',
  high_school: '高',
  hospital: '病',
  dentist: '歯',
  bank: '銀',
  cram_school: '塾',
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

// ---- 丸囲み文字SVGマーカー（全ケース統一サイズ） ----
function makeCircleTextMarker(char: string, color: string): { url: string; w: number; h: number } {
  const size = 32;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="${size/2}" y="${size/2 + 6}" font-family="Meiryo,'Yu Gothic',sans-serif"
      font-size="15" font-weight="bold" fill="white" text-anchor="middle">${char}</text>
    <polygon points="${size/2-5},${size} ${size/2+5},${size} ${size/2},${size+8}" fill="${color}"/>
  </svg>`;
  try { return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w: size, h: size + 8 }; }
  catch { return { url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), w: size, h: size + 8 }; }
}

// ---- フォーク＆ナイフSVGマーカー（飲食店） ----
function makeRestaurantMarker(): { url: string; w: number; h: number } {
  const w = 36; const h = 42;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 36 42">
    <circle cx="18" cy="16" r="15" fill="#d84315" stroke="white" stroke-width="2"/>
    <!-- フォーク -->
    <line x1="13" y1="8" x2="13" y2="24" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="11" y1="8" x2="11" y2="13" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="13" y1="8" x2="13" y2="13" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="15" y1="8" x2="15" y2="13" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <!-- ナイフ -->
    <line x1="22" y1="8" x2="22" y2="24" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M22,8 Q26,10 26,14 L22,16" fill="white" stroke="white" stroke-width="0.5"/>
    <polygon points="15,36 21,36 18,42" fill="#d84315"/>
  </svg>`;
  try { return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w, h }; }
  catch { return { url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), w, h }; }
}

// ---- テキストラベル付きSVGマーカー（オフセット対応・尻尾伸縮） ----
// offsetX/offsetY: ラベルを実際の座標からずらすピクセル数（尻尾がその分伸びる）
function makeTextMarker(name: string, color: string, offsetX = 0, offsetY = 0): { url: string; w: number; h: number; anchorX: number; anchorY: number } {
  const raw = name.length > 12 ? name.slice(0, 12) + '…' : name;
  const label = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let textW = 0;
  for (const ch of raw) { textW += ch.charCodeAt(0) > 127 ? 10 : 7; }
  const boxW = Math.max(56, textW + 28);
  const boxH = 22;

  // SVGキャンバスサイズ：ラベルボックス＋尻尾の伸び分を含む
  const padX = Math.abs(offsetX);
  const padY = Math.abs(offsetY);
  const svgW = boxW + padX;
  const svgH = boxH + 6 + padY; // 6 = 最小尻尾高さ

  // ラベルボックスの左上座標（オフセット方向によって配置を変える）
  const boxX = offsetX < 0 ? 0 : padX;
  const boxY = offsetY < 0 ? 0 : padY;

  // 尻尾の先端（実際のマーカー位置 = アンカー）
  // アンカーはSVG内の「実際の地点」を指す座標
  const tipX = offsetX < 0 ? svgW : (offsetX > 0 ? 0 : svgW / 2);
  const tipY = offsetY < 0 ? svgH : (offsetY > 0 ? 0 : svgH);

  // 尻尾の根元（ボックス底辺中央）
  const baseX = boxX + boxW / 2;
  const baseY = boxY + boxH;

  // アンカー位置（SVG内でのピクセル座標）
  const anchorX = offsetX < 0 ? svgW : (offsetX > 0 ? 0 : svgW / 2);
  const anchorY = offsetY < 0 ? svgH : (offsetY > 0 ? 0 : svgH);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
    <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="4" ry="4" fill="${color}" opacity="0.93"/>
    <text x="${boxX + boxW/2}" y="${boxY + 15}" font-family="Meiryo,'Yu Gothic',sans-serif"
      font-size="10" font-weight="bold" fill="white" text-anchor="middle">${label}</text>
    <polygon points="${baseX-5},${baseY} ${baseX+5},${baseY} ${tipX},${tipY}" fill="${color}" opacity="0.93"/>
  </svg>`;

  try { return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w: svgW, h: svgH, anchorX, anchorY }; }
  catch { return { url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), w: svgW, h: svgH, anchorX, anchorY }; }
}

// ---- ピクセル座標変換 ----
function latLngToPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = Math.pow(2, zoom);
  const x = (lng + 180) / 360 * 256 * scale;
  const sinLat = Math.sin(lat * Math.PI / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * 256 * scale;
  return { x, y };
}

// ---- オフセット計算：配置済みラベルと被らない方向を探す ----
// 候補方向：上・右上・右・右下・下・左下・左・左上
const OFFSET_CANDIDATES = [
  { dx: 0,   dy: -35 }, // 上
  { dx: 35,  dy: -25 }, // 右上
  { dx: 40,  dy: 0   }, // 右
  { dx: 35,  dy: 25  }, // 右下
  { dx: 0,   dy: 35  }, // 下（デフォルト）
  { dx: -35, dy: 25  }, // 左下
  { dx: -40, dy: 0   }, // 左
  { dx: -35, dy: -25 }, // 左上
];

interface PlacedLabel {
  px: number; py: number;   // 地点のピクセル座標
  lx: number; ly: number;   // ラベル左上のピクセル座標
  lw: number; lh: number;   // ラベルサイズ
}

function findBestOffset(
  px: number, py: number,
  labelW: number, labelH: number,
  placed: PlacedLabel[]
): { dx: number; dy: number } {
  for (const { dx, dy } of OFFSET_CANDIDATES) {
    // ラベル左上座標（アンカーからオフセット、ラベル中央下がアンカー）
    const lx = px + dx - labelW / 2;
    const ly = py + dy - labelH;

    // 既存ラベルと重なるか確認
    const overlaps = placed.some(q => {
      return !(lx + labelW < q.lx || lx > q.lx + q.lw ||
               ly + labelH < q.ly || ly > q.ly + q.lh);
    });
    if (!overlaps) return { dx, dy };
  }
  // 全方向で重なる場合はデフォルト（下）
  return OFFSET_CANDIDATES[4];
}}

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

// ---- 公園用ツリーアイコンマーカー ----
function makeParkMarker(): { url: string; w: number; h: number } {
  const w = 24; const h = 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 28">
    <ellipse cx="12" cy="11" rx="9" ry="9" fill="#33691e" opacity="0.95"/>
    <ellipse cx="12" cy="9" rx="7" ry="7" fill="#558b2f" opacity="0.9"/>
    <rect x="10" y="18" width="4" height="7" rx="1" fill="#5d4037"/>
    <ellipse cx="12" cy="11" rx="4" ry="3" fill="#7cb342" opacity="0.6"/>
  </svg>`;
  try { return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), w, h }; }
  catch { return { url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), w, h }; }
}


// ---- マーカー描画（オフセット付き尻尾伸縮でラベル被り回避） ----
function drawMarkers(map: google.maps.Map, data: NearbyData, iw: google.maps.InfoWindow, ref: React.MutableRefObject<google.maps.Marker[]>) {
  ref.current.forEach((m) => m.setMap(null)); ref.current = [];
  const zoom = map.getZoom() ?? 14;

  const placedLabels: PlacedLabel[] = [];

  // 物件マーカー（常に最優先）
  const pm = makePropertyMarker();
  const centerPx = latLngToPixel(data.center.lat, data.center.lng, zoom);
  placedLabels.push({ px: centerPx.x, py: centerPx.y, lx: centerPx.x - pm.w/2, ly: centerPx.y - pm.h, lw: pm.w, lh: pm.h });
  ref.current.push(new google.maps.Marker({
    position: data.center, map, title: '物件', zIndex: 3000,
    icon: { url: pm.url, anchor: new google.maps.Point(pm.w / 2, pm.h), scaledSize: new google.maps.Size(pm.w, pm.h) },
  }));

  data.categories.filter(cat => DISPLAY_CATS.has(cat.type)).forEach((cat) => {
    const color = COLORS[cat.type] || '#757575';
    (data.places[cat.type] || []).forEach((p, idx) => {
      if (!p.lat || !p.lng) return;

      const ppx = latLngToPixel(p.lat, p.lng, zoom);

      if (cat.type === 'park') {
        // 公園：ツリーアイコン（オフセットなし）
        const pk = makeParkMarker();
        placedLabels.push({ px: ppx.x, py: ppx.y, lx: ppx.x - pk.w/2, ly: ppx.y - pk.h, lw: pk.w, lh: pk.h });
        const mk = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng }, map,
          title: `${p.name} (${p.distance}m)`, zIndex: 800 - idx,
          icon: { url: pk.url, anchor: new google.maps.Point(pk.w / 2, pk.h), scaledSize: new google.maps.Size(pk.w, pk.h) },
        });
        mk.addListener('click', () => {
          iw.setContent(`<div style="font-size:12px;padding:5px 8px;min-width:160px;line-height:1.6;"><b>${cat.icon} ${p.name}</b><br/><span style="color:#555;font-size:11px;">${p.vicinity}</span><br/><span style="color:#1565c0;font-weight:bold;">物件から約 ${p.distance}m</span>${p.rating ? `<br/><span style="color:#e65100;">★ ${p.rating}</span>` : ''}</div>`);
          iw.open(map, mk);
        });
        ref.current.push(mk);

      } else if (cat.type === 'restaurant') {
        // 飲食店：フォーク＆ナイフアイコン（オフセットなし）
        const rm = makeRestaurantMarker();
        placedLabels.push({ px: ppx.x, py: ppx.y, lx: ppx.x - rm.w/2, ly: ppx.y - rm.h, lw: rm.w, lh: rm.h });
        const mk = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng }, map,
          title: `${p.name} (${p.distance}m)`, zIndex: 800 - idx,
          icon: { url: rm.url, anchor: new google.maps.Point(rm.w / 2, rm.h), scaledSize: new google.maps.Size(rm.w, rm.h) },
        });
        mk.addListener('click', () => {
          iw.setContent(`<div style="font-size:12px;padding:5px 8px;min-width:160px;line-height:1.6;"><b>${cat.icon} ${p.name}</b><br/><span style="color:#555;font-size:11px;">${p.vicinity}</span><br/><span style="color:#1565c0;font-weight:bold;">物件から約 ${p.distance}m</span>${p.rating ? `<br/><span style="color:#e65100;">★ ${p.rating}</span>` : ''}</div>`);
          iw.open(map, mk);
        });
        ref.current.push(mk);

      } else if (CIRCLE_ICONS[cat.type]) {
        // 丸囲み文字：オフセットなし（コンパクトなので被りにくい）
        const ci = makeCircleTextMarker(CIRCLE_ICONS[cat.type], color);
        placedLabels.push({ px: ppx.x, py: ppx.y, lx: ppx.x - ci.w/2, ly: ppx.y - ci.h, lw: ci.w, lh: ci.h });
        const mk = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng }, map,
          title: `${p.name} (${p.distance}m)`, zIndex: 900 - idx,
          icon: { url: ci.url, anchor: new google.maps.Point(ci.w / 2, ci.h), scaledSize: new google.maps.Size(ci.w, ci.h) },
        });
        mk.addListener('click', () => {
          iw.setContent(`<div style="font-size:12px;padding:5px 8px;min-width:160px;line-height:1.6;"><b>${cat.icon} ${p.name}</b><br/><span style="color:#555;font-size:11px;">${p.vicinity}</span><br/><span style="color:#1565c0;font-weight:bold;">物件から約 ${p.distance}m</span>${p.rating ? `<br/><span style="color:#e65100;">★ ${p.rating}</span>` : ''}</div>`);
          iw.open(map, mk);
        });
        ref.current.push(mk);

      } else {
        // テキストラベル：被らない方向にオフセット＋尻尾伸縮
        // まずデフォルトサイズを計算
        const raw = p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name;
        let textW = 0;
        for (const ch of raw) { textW += ch.charCodeAt(0) > 127 ? 10 : 7; }
        const labelW = Math.max(56, textW + 28);
        const labelH = 28; // boxH + tail

        const { dx, dy } = findBestOffset(ppx.x, ppx.y, labelW, labelH, placedLabels);
        const ic = makeTextMarker(p.name, color, dx, dy);

        // 配置済みリストに追加
        placedLabels.push({
          px: ppx.x, py: ppx.y,
          lx: ppx.x + dx - ic.w / 2,
          ly: ppx.y + dy - ic.h,
          lw: ic.w, lh: ic.h,
        });

        const mk = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng }, map,
          title: `${p.name} (${p.distance}m)`, zIndex: 1000 - idx,
          icon: { url: ic.url, anchor: new google.maps.Point(ic.anchorX, ic.anchorY), scaledSize: new google.maps.Size(ic.w, ic.h) },
        });
        mk.addListener('click', () => {
          iw.setContent(`<div style="font-size:12px;padding:5px 8px;min-width:160px;line-height:1.6;"><b>${cat.icon} ${p.name}</b><br/><span style="color:#555;font-size:11px;">${p.vicinity}</span><br/><span style="color:#1565c0;font-weight:bold;">物件から約 ${p.distance}m</span>${p.rating ? `<br/><span style="color:#e65100;">★ ${p.rating}</span>` : ''}</div>`);
          iw.open(map, mk);
        });
        ref.current.push(mk);
      }
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

  // ---- 印刷：地図DOMを移動して印刷する方式 ----
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

    // 地図コンテナのサイズを取得
    const mapAreaEl = document.querySelector('.nearby-map-area') as HTMLElement | null;
    if (!mapAreaEl || !coords) return;

    // A4横の印刷サイズに合わせた固定サイズを使用（モーダルサイズに依存しない）
    // A4横 = 297mm x 210mm、96dpi換算で約1123px x 794px
    const PRINT_W = 1123;
    const HEADER_H = 36;
    const PRINT_MAP_H = 794 - HEADER_H;

    // 印刷用ラッパーを body に追加（地図DOMを移動）
    const printWrap = document.createElement('div');
    printWrap.id = 'nearby-map-print-wrap';
    printWrap.style.cssText = `position:fixed;top:${HEADER_H}px;left:0;width:${PRINT_W}px;height:${PRINT_MAP_H}px;z-index:99999;background:white;overflow:hidden;`;

    // ヘッダーdivを作成
    const headerWrap = document.createElement('div');
    headerWrap.id = 'nearby-header-print-wrap';
    headerWrap.innerHTML = `
      <span style="font-size:13pt;font-weight:bold;">🗺️ 近隣MAP</span>
      ${address ? `<span style="font-size:9pt;color:#555;margin-left:8px;">${address}</span>` : ''}
      <span style="font-size:9pt;color:#1565c0;margin-left:auto;">${tabLabel}</span>
    `;
    headerWrap.style.cssText = `
      position:fixed;top:0;left:0;width:${PRINT_W}px;height:${HEADER_H}px;z-index:100000;
      display:flex;align-items:center;gap:6px;
      background:white;padding:4px 10px;
      border-bottom:1px solid #ccc;box-sizing:border-box;
      font-family:'Meiryo','Yu Gothic',sans-serif;
    `;
    document.body.appendChild(headerWrap);

    // 地図の内部divを移動
    const mapInner = mapAreaEl.firstElementChild as HTMLElement | null;
    if (mapInner) {
      // 印刷用サイズに強制リサイズ
      mapInner.style.width = `${PRINT_W}px`;
      mapInner.style.height = `${PRINT_MAP_H}px`;
      printWrap.appendChild(mapInner);
      document.body.appendChild(printWrap);
      // 元のコンテナを非表示にして印刷時に映り込まないようにする
      mapAreaEl.style.display = 'none';
      if (mapRef.current) {
        google.maps.event.trigger(mapRef.current, 'resize');
        mapRef.current.setCenter(coords);
      }
    }

    // 施設リスト用div
    const facilityWrap = document.createElement('div');
    facilityWrap.id = 'nearby-facility-print-wrap';
    facilityWrap.innerHTML = facilityHtml;
    document.body.appendChild(facilityWrap);

    // 印刷スタイル
    const styleId = 'nearby-print-style';
    const old = document.getElementById(styleId); if (old) old.remove();
    const st = document.createElement('style');
    st.id = styleId;
    st.textContent = `
      @media print {
        @page { size: A4 landscape; margin: 0; }

        /* ダイアログ全体を非表示 */
        body > *:not(#nearby-header-print-wrap):not(#nearby-map-print-wrap):not(#nearby-facility-print-wrap) {
          display: none !important;
        }

        /* 1ページ目：ヘッダー＋地図をまとめて1ページ */
        #nearby-header-print-wrap {
          position: static !important;
          display: flex !important;
          align-items: center !important;
          width: 100% !important;
          padding: 2mm 5mm !important;
          border-bottom: 1px solid #ccc !important;
          background: white !important;
          box-sizing: border-box !important;
        }

        #nearby-map-print-wrap {
          position: static !important;
          display: block !important;
          width: 100% !important;
          height: 185mm !important;
          overflow: hidden !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        #nearby-map-print-wrap > div {
          width: 100% !important;
          height: 100% !important;
        }

        /* 2ページ目：施設リスト（余白なし） */
        #nearby-facility-print-wrap {
          display: block !important;
          width: 100% !important;
          padding: 6mm !important;
          box-sizing: border-box !important;
          columns: 3 !important;
          column-gap: 5mm !important;
          font-family: 'Meiryo', 'Yu Gothic', sans-serif !important;
        }
        .cat-block { break-inside: avoid; padding: 3px 6px; margin-bottom: 5px; background: #fafafa; }
        .cat-header { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
        .cat-label { font-size: 9pt; font-weight: bold; }
        .cat-count { margin-left: auto; font-size: 8pt; background: #eee; border-radius: 8px; padding: 0 5px; }
        .place-item { display: flex; justify-content: space-between; padding: 1px 0; border-bottom: 1px dotted #eee; }
        .place-name { font-size: 8.5pt; }
        .place-dist { font-size: 7.5pt; color: #888; white-space: nowrap; margin-left: 4px; }

        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    `;
    document.head.appendChild(st);

    setTimeout(() => {
      window.print();
      // 印刷後に元に戻す
      setTimeout(() => {
        if (mapInner && mapAreaEl) {
          mapInner.style.width = '';
          mapInner.style.height = '';
          mapAreaEl.style.display = '';
          mapAreaEl.appendChild(mapInner);
          if (mapRef.current) {
            google.maps.event.trigger(mapRef.current, 'resize');
            mapRef.current.setCenter(coords);
          }
        }
        printWrap.remove();
        facilityWrap.remove();
        headerWrap.remove();
        st.remove();
      }, 1000);
    }, 400);
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
                options={{
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: true,
                  clickableIcons: false,
                  styles: [
                    // 飲食店・カフェ・バーを非表示（poi.attraction以外のPOIラベルを抑制）
                    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
                    { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'on' }] },
                  ],
                }}
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
