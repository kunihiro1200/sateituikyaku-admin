/**
 * 比較マップ作成ページ
 * /sellers/:id/comparison-map
 *
 * 査定対象1件＋競合1〜5件の比較マップをA4縦PDF（window.print()）で出力する。
 * 地図は Google Maps Static API をバックエンド経由で取得し、
 * 吹き出しラベルを CSS で絶対位置指定して重ねることでピンと物件名を紐付ける。
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, Paper, Grid,
  IconButton, CircularProgress, Alert, Tooltip,
  Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  MyLocation as MyLocationIcon,
  Print as PrintIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  UploadFile as UploadFileIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { GoogleMap, Marker, InfoWindow, TransitLayer, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';
import api from '../services/api';
import { v4 as uuidv4 } from 'uuid';

// ─── 型定義 ────────────────────────────────────────────────────────

type PriceType = '査定前' | '査定価格' | '売出提案価格';
type LocStatus = 'idle' | 'loading' | 'confirmed' | 'warning' | 'error';

interface SubjectProperty {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  priceType: PriceType;
  price: string;         // 万円単位・数値文字列
  builtYearMonth: string; // "2012年08月" 形式
  exclusiveArea: string;  // ㎡ 数値文字列
  totalUnits: string;
  floorInfo: string;
  locStatus: LocStatus;
  locMsg: string;
}

interface CompetingProperty {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  price: string;
  builtYearMonth: string;
  exclusiveArea: string;
  totalUnits: string;
  floorInfo: string;
  locStatus: LocStatus;
  locMsg: string;
}

// ─── 抽出済みプロパティの型 ───────────────────────────────────────

interface ExtractedProperty {
  name: string;
  address: string;
  price: string;
  builtYearMonth: string;
  exclusiveArea: string;
  totalUnits: string;
  floorInfo: string;
}

// ─── ユーティリティ ────────────────────────────────────────────────

/** 万円単位の数値文字列 → 表示用文字列 */
function fmtPrice(price: string): string {
  const n = parseFloat(price);
  if (isNaN(n) || !price) return '—';
  return `${n.toLocaleString('ja-JP')}万円`;
}

/** ㎡単価を計算（価格÷専有面積、小数第1位） */
function calcPerSqm(price: string, area: string): string {
  const p = parseFloat(price);
  const a = parseFloat(area);
  if (!p || !a || a === 0) return '—';
  return `${(p / a).toFixed(1)}万円/㎡`;
}

/** 築年月から築年数を計算 */
function calcAge(ym: string): string {
  const m = ym.match(/(\d{4})年(\d{1,2})月/);
  if (!m) {
    const y = ym.match(/(\d{4})年/);
    if (y) {
      const age = new Date().getFullYear() - parseInt(y[1]);
      return `築${age}年`;
    }
    return '';
  }
  const builtDate = new Date(parseInt(m[1]), parseInt(m[2]) - 1);
  const now = new Date();
  const months = (now.getFullYear() - builtDate.getFullYear()) * 12 + (now.getMonth() - builtDate.getMonth());
  const age = Math.floor(months / 12);
  return `築${age}年`;
}

/** 住所から地域名（区・丁目レベル）を抽出してラベル用に短縮 */
function extractAreaLabel(address: string): string {
  if (!address) return '';
  // 「市区町村 + 丁目」を抽出：南区高宮4丁目、博多区美野島2丁目 など
  const m = address.match(/(?:市|区|町|村)([^市区町村0-9０-９（\s]*(?:\d+丁目)?)/);
  if (m) {
    const prefix = address.match(/([^市]+(?:市|区))/)?.[0] ?? '';
    return (prefix + m[0]).substring(0, 12);
  }
  // フォールバック：先頭から13文字
  return address.replace(/^.+(?:市|都|道|府)/, '').substring(0, 12);
}

// ─── 座標 → 画像ピクセル変換 ──────────────────────────────────────

const TILE_SIZE = 256;

function toWorldXY(lat: number, lng: number) {
  const x = ((lng + 180) / 360) * TILE_SIZE;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * TILE_SIZE;
  return { x, y };
}

/** lat/lng → 画像上のピクセル位置パーセント (%) */
export function latLngToPixelPct(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  zoom: number,
  imgW: number,
  imgH: number
): { xPct: number; yPct: number } {
  const scale = Math.pow(2, zoom);
  const c = toWorldXY(centerLat, centerLng);
  const p = toWorldXY(lat, lng);
  const x = imgW / 2 + (p.x - c.x) * scale;
  const y = imgH / 2 + (p.y - c.y) * scale;
  return { xPct: (x / imgW) * 100, yPct: (y / imgH) * 100 };
}

/** 全ピンが収まる最適な zoom レベルを計算 */
export function calcBoundsZoom(
  points: Array<{ lat: number; lng: number }>,
  imgW: number,
  imgH: number,
  padding = 90
): number {
  if (points.length === 0) return 14;
  if (points.length === 1) return 15;
  const worlds = points.map(p => toWorldXY(p.lat, p.lng));
  const minWX = Math.min(...worlds.map(w => w.x));
  const maxWX = Math.max(...worlds.map(w => w.x));
  const minWY = Math.min(...worlds.map(w => w.y));
  const maxWY = Math.max(...worlds.map(w => w.y));
  const spanX = maxWX - minWX || 0.001;
  const spanY = maxWY - minWY || 0.001;
  const zoomX = Math.log2((imgW - padding) / spanX);
  const zoomY = Math.log2((imgH - padding) / spanY);
  return Math.floor(Math.min(zoomX, zoomY, 17));
}

// ─── 初期値 ────────────────────────────────────────────────────────

const DEFAULT_SUBJECT: SubjectProperty = {
  name: '', address: '', latitude: null, longitude: null,
  priceType: '査定前', price: '',
  builtYearMonth: '', exclusiveArea: '', totalUnits: '', floorInfo: '',
  locStatus: 'idle', locMsg: '',
};

function newCompeting(): CompetingProperty {
  return {
    id: uuidv4(), name: '', address: '', latitude: null, longitude: null,
    price: '', builtYearMonth: '', exclusiveArea: '', totalUnits: '', floorInfo: '',
    locStatus: 'idle', locMsg: '',
  };
}

// ─── 位置確認ステータスアイコン ────────────────────────────────────

function LocIcon({ status, msg }: { status: LocStatus; msg?: string }) {
  if (status === 'loading') return <CircularProgress size={16} sx={{ flexShrink: 0 }} />;
  if (status === 'confirmed') return <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18, flexShrink: 0 }} />;
  if (status === 'warning')
    return (
      <Tooltip title={msg ?? '精度が低い位置です。地図で確認してください。'}>
        <WarningIcon sx={{ color: 'warning.main', fontSize: 18, flexShrink: 0 }} />
      </Tooltip>
    );
  if (status === 'error')
    return (
      <Tooltip title={msg ?? 'エラー'}>
        <WarningIcon sx={{ color: 'error.main', fontSize: 18, flexShrink: 0 }} />
      </Tooltip>
    );
  return null;
}

// ─── メインコンポーネント ──────────────────────────────────────────

const ComparisonMapPage: React.FC = () => {
  const { id: sellerId } = useParams<{ id: string }>();
  const { isLoaded } = useGoogleMaps();

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sellerInfo, setSellerInfo] = useState<{ sellerNumber?: string; name?: string } | null>(null);

  const [subject, setSubject] = useState<SubjectProperty>(DEFAULT_SUBJECT);
  const [competing, setCompeting] = useState<CompetingProperty[]>([]);
  const [infoId, setInfoId] = useState<string | null>(null); // open InfoWindow id
  const [printLoading, setPrintLoading] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  // ── 資料アップロード＆AI抽出用ステート（現在募集中）──────────────
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedProps, setExtractedProps] = useState<ExtractedProperty[]>([]);
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // 自動保存したマップのID（2回目以降の上書き用）
  const [savedMapId, setSavedMapId] = useState<string | null>(null);

  // ── 成約済み物件ステート ────────────────────────────────────────
  const [settledCompeting, setSettledCompeting] = useState<CompetingProperty[]>([]);
  const [settledPrintLoading, setSettledPrintLoading] = useState(false);
  const [settledExtracting, setSettledExtracting] = useState(false);
  const [settledExtractError, setSettledExtractError] = useState<string | null>(null);
  const [settledExtractedProps, setSettledExtractedProps] = useState<ExtractedProperty[]>([]);
  const [showSettledExtractDialog, setShowSettledExtractDialog] = useState(false);
  const [isSettledDragging, setIsSettledDragging] = useState(false);

  // ── 学校マーカーステート ──────────────────────────────────────
  const [showSchools, setShowSchools] = useState(true); // 初期値: 表示ON
  const [schoolMarkers, setSchoolMarkers] = useState<Array<{
    lat: number; lng: number; name: string; schoolType: 'elementary' | 'middle';
  }>>([]);
  const settledUploadRef = useRef<HTMLInputElement>(null);

  // ── 売主データ読み込み＆自動ジオコーディング ─────────────────
  useEffect(() => {
    if (!sellerId) { setPageLoading(false); return; }
    (async () => {
      try {
        const { data } = await api.get(`/api/sellers/${sellerId}`);
        setSellerInfo({ sellerNumber: data.sellerNumber, name: data.name });

        // 物件住所
        const addr = data.property?.property_address
          || data.property?.address
          || data.propertyAddress
          || '';

        // 築年月（buildYear は年のみの場合が多い）
        const by = data.property?.buildYear ?? data.buildYear;
        const bym = by ? `${by}年` : '';

        // 専有面積
        const ba = data.property?.buildingArea ?? data.buildingArea;

        // 査定額
        // 査定額は自動補完しない（デフォルト：査定前・空欄）
        const priceType: PriceType = '査定前';
        const priceStr = '';

        const hasCoords = !!(data.latitude && data.longitude);
        setSubject(prev => ({
          ...prev,
          address: addr,
          builtYearMonth: bym,
          exclusiveArea: ba ? String(ba) : '',
          priceType,
          price: priceStr,
          ...(hasCoords ? {
            latitude: data.latitude,
            longitude: data.longitude,
            locStatus: 'confirmed' as LocStatus,
          } : {}),
        }));

        // ── 座標がなければ住所から自動ジオコーディング ──
        if (!hasCoords && addr) {
          setSubject(prev => ({ ...prev, locStatus: 'loading', locMsg: '' }));
          try {
            const { data: geoData } = await api.post('/api/comparison-maps/geocode', { address: addr });
            if (geoData.success) {
              setSubject(prev => ({
                ...prev,
                latitude: geoData.latitude,
                longitude: geoData.longitude,
                locStatus: geoData.needsConfirmation ? 'warning' : 'confirmed',
                locMsg: geoData.message ?? '',
              }));
            } else {
              setSubject(prev => ({ ...prev, locStatus: 'idle', locMsg: '' }));
            }
          } catch {
            setSubject(prev => ({ ...prev, locStatus: 'idle', locMsg: '' }));
          }
        }
      } catch (err) {
        console.error('[ComparisonMap] load seller failed:', err);
        setPageError('売主データの読み込みに失敗しました。');
      } finally {
        setPageLoading(false);
      }
    })();
  }, [sellerId]);

  // ── 保存済み競合物件を復元 ────────────────────────────────────
  useEffect(() => {
    if (!sellerId) return;
    (async () => {
      try {
        const { data: savedMaps } = await api.get(`/api/comparison-maps/seller/${sellerId}`);
        if (!savedMaps?.length) return;
        const latest = savedMaps[0];
        setSavedMapId(latest.id);
        const savedCompeting: CompetingProperty[] = (latest.competing_properties ?? []).map((p: any) => ({
          id: uuidv4(),
          name: p.name ?? '',
          address: p.address ?? '',
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          price: p.price ?? '',
          builtYearMonth: p.builtYearMonth ?? '',
          exclusiveArea: p.exclusiveArea ?? '',
          totalUnits: p.totalUnits ?? '',
          floorInfo: p.floorInfo ?? '',
          locStatus: (p.latitude && p.longitude ? 'confirmed' : 'idle') as LocStatus,
          locMsg: '',
        }));
        if (savedCompeting.length > 0) setCompeting(savedCompeting);
        // ── 成約済み物件を復元 ──
        const savedSettled: CompetingProperty[] = ((latest.subject_property as any)?.settledProperties ?? []).map((p: any) => ({
          id: uuidv4(),
          name: p.name ?? '',
          address: p.address ?? '',
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          price: p.price ?? '',
          builtYearMonth: p.builtYearMonth ?? '',
          exclusiveArea: p.exclusiveArea ?? '',
          totalUnits: p.totalUnits ?? '',
          floorInfo: p.floorInfo ?? '',
          locStatus: (p.latitude && p.longitude ? 'confirmed' : 'idle') as LocStatus,
          locMsg: '',
        }));
        if (savedSettled.length > 0) setSettledCompeting(savedSettled);
      } catch {
        // 保存データなしは無視
      }
    })();
  }, [sellerId]);

  // ── 競合物件の自動保存（変更後2.5秒） ────────────────────────
  useEffect(() => {
    if (!sellerId || (competing.length === 0 && settledCompeting.length === 0)) return;
    const timer = setTimeout(async () => {
      try {
        const body = {
          id: savedMapId,
          sellerId,
          sellerNumber: sellerInfo?.sellerNumber ?? '',
          subjectProperty: {
            name: subject.name, address: subject.address,
            latitude: subject.latitude, longitude: subject.longitude,
            priceType: subject.priceType, price: subject.price,
            builtYearMonth: subject.builtYearMonth, exclusiveArea: subject.exclusiveArea,
            // 成約済み物件もここに格納（別テーブル不要）
            settledProperties: settledCompeting.map(p => ({
              name: p.name, address: p.address, latitude: p.latitude, longitude: p.longitude,
              price: p.price, builtYearMonth: p.builtYearMonth, exclusiveArea: p.exclusiveArea,
              totalUnits: p.totalUnits, floorInfo: p.floorInfo,
            })),
          },
          competingProperties: competing.map(p => ({
            name: p.name, address: p.address, latitude: p.latitude, longitude: p.longitude,
            price: p.price, builtYearMonth: p.builtYearMonth, exclusiveArea: p.exclusiveArea,
            totalUnits: p.totalUnits, floorInfo: p.floorInfo,
          })),
        };
        const { data } = await api.post('/api/comparison-maps/save', body);
        if (data?.id && !savedMapId) setSavedMapId(data.id);
      } catch {
        // 自動保存失敗は無視
      }
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competing, settledCompeting, sellerId]);

  // ── 近隣の学校を Places API で検索（バックエンド経由） ────────
  useEffect(() => {
    if (!subject.latitude || !subject.longitude) return;
    // バックエンド経由でサーバーサイド Places API を呼ぶ（フロント直接呼び出しより安定）
    api.get('/api/comparison-maps/nearby-schools', {
      params: { lat: subject.latitude, lng: subject.longitude },
    }).then(({ data }) => {
      const markers = [
        ...(data.elementary ?? []).map((s: any) => ({ ...s, schoolType: 'elementary' as const })),
        ...(data.middle ?? []).map((s: any) => ({ ...s, schoolType: 'middle' as const })),
      ];
      setSchoolMarkers(markers);
    }).catch(err => console.warn('[ComparisonMap] nearby-schools failed:', err?.message));
  }, [subject.latitude, subject.longitude]);

  // ── 地図の範囲自動調整 ───────────────────────────────────────
  const fitMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;
    const pts = [
      subject.latitude && subject.longitude ? { lat: subject.latitude, lng: subject.longitude } : null,
      ...competing.map(p => p.latitude && p.longitude ? { lat: p.latitude, lng: p.longitude } : null),
    ].filter(Boolean) as google.maps.LatLngLiteral[];
    if (!pts.length) return;
    if (pts.length === 1) {
      mapRef.current.setCenter(pts[0]);
      mapRef.current.setZoom(15);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    pts.forEach(p => bounds.extend(p));
    mapRef.current.fitBounds(bounds, 60);
  }, [subject, competing]);

  useEffect(() => { fitMap(); }, [fitMap]);

  // ── ジオコーディング ──────────────────────────────────────────
  const geocode = async (type: 'subject' | string) => {
    const isSubject = type === 'subject';
    const prop = isSubject ? subject : competing.find(p => p.id === type);
    if (!prop?.address.trim()) { alert('住所を入力してください。'); return; }

    const setLoading = () => {
      if (isSubject) setSubject(p => ({ ...p, locStatus: 'loading', locMsg: '' }));
      else setCompeting(arr => arr.map(p => p.id === type ? { ...p, locStatus: 'loading', locMsg: '' } : p));
    };
    const setResult = (patch: Partial<SubjectProperty & CompetingProperty>) => {
      if (isSubject) setSubject(p => ({ ...p, ...patch }));
      else setCompeting(arr => arr.map(p => p.id === type ? { ...p, ...patch } : p));
    };

    setLoading();
    try {
      const { data } = await api.post('/api/comparison-maps/geocode', {
        address: prop.address,
        name: prop.name,
      });
      if (!data.success) throw new Error(data.error ?? '座標取得失敗');
      setResult({
        latitude: data.latitude,
        longitude: data.longitude,
        locStatus: data.needsConfirmation ? 'warning' : 'confirmed',
        locMsg: data.message ?? '',
      });
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'エラー';
      setResult({ locStatus: 'error', locMsg: msg });
    }
  };

  // ── 印刷HTML生成 ──────────────────────────────────────────────
  const handlePrint = async () => {
    if (competing.length === 0) {
      alert('競合物件を1件以上追加してください。');
      return;
    }

    // 位置確認済みピン（地図に表示するもの）
    type PinItem = {
      isSubject: boolean;
      label: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
    };
    const pins: PinItem[] = [];
    if (subject.latitude && subject.longitude) {
      pins.push({ isSubject: true, label: '★', name: subject.name || '査定対象物件', address: subject.address, lat: subject.latitude, lng: subject.longitude });
    }
    competing.forEach((p, i) => {
      if (p.latitude && p.longitude) {
        pins.push({ isSubject: false, label: String(i + 1), name: p.name || `競合物件${i + 1}`, address: p.address, lat: p.latitude, lng: p.longitude });
      }
    });

    if (pins.length === 0) {
      alert('位置確認済みの物件がありません。「位置確認」ボタンを押してください。');
      return;
    }

    // 未確認の物件があれば警告（テーブルには全件表示）
    const totalCount = 1 + competing.length;
    if (pins.length < totalCount) {
      if (!window.confirm(`位置未確認の物件があります（${totalCount - pins.length}件）。\n確認済みの${pins.length}件のみ地図に表示して印刷しますか？`)) return;
    }

    setPrintLoading(true);
    try {
      // 静的地図パラメータを計算
      // IMG_H=460 で縦長にしてA4の余白を削減
      const IMG_W = 600, IMG_H = 460;
      const ACT_W = IMG_W * 2, ACT_H = IMG_H * 2; // scale=2 で物理サイズは2倍

      const points = pins.map(p => ({ lat: p.lat, lng: p.lng }));
      // ── 中心 = バウンディングボックスの中央（平均より精確）
      const lats = points.map(p => p.lat);
      const lngs = points.map(p => p.lng);
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      // ── ズーム = 論理サイズ(600×460)・大きめのパディングで全ピンを収める
      const zoom = calcBoundsZoom(points, IMG_W, IMG_H, 110);

      const markers = pins.map(p => ({
        lat: p.lat, lng: p.lng,
        // 査定対象はラベルなし（金ピン）。Static APIはA-Z/0-9のみ対応のため★は空文字にする
        label: p.isSubject ? '' : p.label,
        color: p.isSubject ? '0xFFAA00' : '0xFF0000',
      }));

      // 学校マーカーを追加（showSchools ON の場合・印刷前に未ロードなら取得）
      let currentSchools = schoolMarkers;
      if (showSchools && currentSchools.length === 0 && subject.latitude && subject.longitude) {
        try {
          const { data: sd } = await api.get('/api/comparison-maps/nearby-schools', {
            params: { lat: subject.latitude, lng: subject.longitude },
          });
          currentSchools = [
            ...(sd.elementary ?? []).map((s: any) => ({ ...s, schoolType: 'elementary' as const })),
            ...(sd.middle ?? []).map((s: any) => ({ ...s, schoolType: 'middle' as const })),
          ];
          setSchoolMarkers(currentSchools);
        } catch { /* 学校なしで続行 */ }
      }

      // Static Maps 用マーカー（学校はサイズ mid で数字なし）
      const schoolMarkersForPrint = showSchools ? currentSchools.map(s => ({
        lat: s.lat, lng: s.lng,
        label: s.schoolType === 'elementary' ? 'E' : 'M',
        color: s.schoolType === 'elementary' ? '0x4CAF50' : '0xFF9800',
        size: 'mid' as const,  // mid = ラベル付き小マーカー
      })) : [];

      // CSS オーバーレイ用の学校位置（パーセント）を計算
      type SchoolForPrint = typeof currentSchools[0] & { xPct: number; yPct: number };
      const schoolsForOverlay: SchoolForPrint[] = showSchools ? currentSchools.map(s => {
        const { xPct, yPct } = latLngToPixelPct(s.lat, s.lng, centerLat, centerLng, zoom, ACT_W, ACT_H);
        return { ...s, xPct, yPct };
      }) : [];

      // バックエンドから静的地図画像（base64）を取得
      const { data: mapData } = await api.get('/api/comparison-maps/static-map', {
        params: {
          markers: JSON.stringify([...markers, ...schoolMarkersForPrint]),
          centerLat: centerLat.toFixed(7),
          centerLng: centerLng.toFixed(7),
          zoom,
          width: IMG_W,
          height: IMG_H,
        },
      });

      // 各ピンの画像上の % 位置を計算（吹き出しラベル用）
      // ★ ピンは「先端（Tip）= 座標位置」だが、番号バッジは円部（先端から約26px上）にある。
      //    ラベルを番号バッジに揃えるため Y を上方向にオフセットする。
      //    大きなマーカー(scale=2)の物理高さ ≈ 72px → 論理 36px
      //    バッジ中心 ≈ 先端から 26px 上 → ACT_H=920 に対して 52px = 52/920 = 5.7%
      const PIN_Y_OFFSET_PCT = 5.5; // Tip → バッジ中心へのオフセット（%）

      type LabelItem = PinItem & { xPct: number; yPct: number };
      const labelPositions: LabelItem[] = pins.map(p => {
        const { xPct, yPct } = latLngToPixelPct(p.lat, p.lng, centerLat, centerLng, zoom, ACT_W, ACT_H);
        return { ...p, xPct, yPct: Math.max(0, yPct - PIN_Y_OFFSET_PCT) };
      });

      // 比較表データ（全物件：位置未確認でも表示）
      type TableItem = {
        isSubject: boolean; label: string; name: string; address: string;
        price: string; priceType?: PriceType; builtYearMonth: string; exclusiveArea: string;
      };
      const tableData: TableItem[] = [
        {
          isSubject: true, label: '★',
          name: subject.name || '査定対象物件',
          address: subject.address,
          price: subject.price,
          priceType: subject.priceType,
          builtYearMonth: subject.builtYearMonth,
          exclusiveArea: subject.exclusiveArea,
        },
        ...competing.map((p, i): TableItem => ({
          isSubject: false, label: String(i + 1),
          name: p.name || `競合物件${i + 1}`,
          address: p.address,
          price: p.price,
          priceType: undefined,
          builtYearMonth: p.builtYearMonth,
          exclusiveArea: p.exclusiveArea,
        })),
      ];

      const html = buildPrintHtml(tableData.length, mapData.imageData, tableData, undefined, schoolsForOverlay);
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
    } catch (err: any) {
      console.error('[ComparisonMap] print error:', err);
      alert('地図画像の取得に失敗しました。ネットワーク接続を確認してください。');
    } finally {
      setPrintLoading(false);
    }
  };

  // ── 成約済み物件 印刷 ─────────────────────────────────────────
  const handlePrintSettled = async () => {
    if (settledCompeting.length === 0) {
      alert('成約済み物件を1件以上追加してください。');
      return;
    }
    type PinItem = { isSubject: boolean; label: string; name: string; address: string; lat: number; lng: number };
    const pins: PinItem[] = [];
    if (subject.latitude && subject.longitude) {
      pins.push({ isSubject: true, label: '★', name: subject.name || '査定対象物件', address: subject.address, lat: subject.latitude, lng: subject.longitude });
    }
    settledCompeting.forEach((p, i) => {
      if (p.latitude && p.longitude) {
        pins.push({ isSubject: false, label: String(i + 1), name: p.name || `成約物件${i + 1}`, address: p.address, lat: p.latitude, lng: p.longitude });
      }
    });
    if (pins.length === 0) {
      alert('位置確認済みの物件がありません。');
      return;
    }
    setSettledPrintLoading(true);
    try {
      const IMG_W = 600, IMG_H = 460;
      const ACT_W = IMG_W * 2, ACT_H = IMG_H * 2;
      const points = pins.map(p => ({ lat: p.lat, lng: p.lng }));
      const lats = points.map(p => p.lat);
      const lngs = points.map(p => p.lng);
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const zoom = calcBoundsZoom(points, IMG_W, IMG_H, 110);
      const markers = pins.map(p => ({
        lat: p.lat, lng: p.lng,
        label: p.isSubject ? '' : p.label,
        color: p.isSubject ? '0xFFAA00' : '0x2196F3', // 成約済みは青
      }));
      const { data: mapData } = await api.get('/api/comparison-maps/static-map', {
        params: { markers: JSON.stringify(markers), centerLat: centerLat.toFixed(7), centerLng: centerLng.toFixed(7), zoom, width: IMG_W, height: IMG_H },
      });
      type TableItem = { isSubject: boolean; label: string; name: string; address: string; price: string; priceType?: PriceType; builtYearMonth: string; exclusiveArea: string };
      const tableData: TableItem[] = [
        { isSubject: true, label: '★', name: subject.name || '査定対象物件', address: subject.address, price: subject.price, priceType: subject.priceType, builtYearMonth: subject.builtYearMonth, exclusiveArea: subject.exclusiveArea },
        ...settledCompeting.map((p, i): TableItem => ({ isSubject: false, label: String(i + 1), name: p.name || `成約物件${i + 1}`, address: p.address, price: p.price, priceType: undefined, builtYearMonth: p.builtYearMonth, exclusiveArea: p.exclusiveArea })),
      ];
      const html = buildPrintHtml(tableData.length, mapData.imageData, tableData, { titleSuffix: '（成約済み物件）', priceRowLabel: '成約価格', badgeColor: '#2196F3', accentColor: '#1565c0' });
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
    } catch (err) {
      alert('地図画像の取得に失敗しました。');
    } finally {
      setSettledPrintLoading(false);
    }
  };

  // ── 印刷HTML構築 ──────────────────────────────────────────────
  type LabelForPrint = { isSubject: boolean; label: string; name: string; address: string; xPct: number; yPct: number };
  type TableForPrint = { isSubject: boolean; label: string; name: string; address: string; price: string; priceType?: PriceType; builtYearMonth: string; exclusiveArea: string };
  type SchoolForPrint = { lat: number; lng: number; name: string; schoolType: 'elementary' | 'middle'; xPct: number; yPct: number };

  function buildPrintHtml(
    count: number,
    imgData: string,
    tableData: TableForPrint[],
    options?: { titleSuffix?: string; priceRowLabel?: string; badgeColor?: string; accentColor?: string },
    schools?: SchoolForPrint[]
  ): string {
    const titleSuffix = options?.titleSuffix ?? '（現在募集中物件）';
    const priceRowLabel = options?.priceRowLabel ?? '価格';
    const accentColor = options?.accentColor ?? '#CC0000';
    const subjectBadgeBg = '#FF8800';
    const competingBadgeBg = options?.badgeColor ?? '#CC0000';
    // ── 学校名 CSS ラベル ──
    const schoolLabelsHtml = (schools ?? []).map(s => {
      const borderColor = s.schoolType === 'elementary' ? '#4CAF50' : '#FF9800';
      const textColor = s.schoolType === 'elementary' ? '#2E7D32' : '#E65100';
      const goLeft = s.xPct > 65;
      const xStyle = goLeft
        ? `right:${(100 - s.xPct).toFixed(2)}%; transform:translate(0,-50%);`
        : `left:${s.xPct.toFixed(2)}%; transform:translate(4pt,-50%);`;
      return `<div style="position:absolute;${xStyle}top:${s.yPct.toFixed(2)}%;background:rgba(255,255,255,0.92);border:0.5pt solid ${borderColor};border-radius:2pt;padding:0.5pt 2pt;font-size:6pt;font-weight:bold;color:${textColor};white-space:nowrap;pointer-events:none;line-height:1.2;">${s.name}</div>`;
    }).join('');
    // 比較表HTML（ラベルオーバーレイは廃止 → 静的マップのピン番号のみ使用）
    const CIRCLED_NUM = ['', '①', '②', '③', '④', '⑤'];
    const colW = Math.floor(85 / tableData.length);
    const headerCells = tableData.map(p => {
      const badgeBg = p.isSubject ? subjectBadgeBg : competingBadgeBg;
      const num = parseInt(p.label, 10);
      const badgeLabel = p.isSubject ? '★' : (CIRCLED_NUM[num] ?? p.label);
      // ★ 数字バッジを th の先頭に固定行として配置し、縦方向の揃えを強制する
      return `<th style="width:${colW}%;text-align:center;background:#fff;padding:3pt 2pt;border:0.5pt solid #ccc;vertical-align:top;">
  <div style="display:flex;flex-direction:column;align-items:center;gap:1pt;">
    <div style="display:inline-flex;width:18pt;height:18pt;border-radius:50%;background:${badgeBg};color:white;font-weight:bold;font-size:9pt;align-items:center;justify-content:center;flex-shrink:0;">${p.isSubject ? '★' : p.label}</div>
    <div style="font-size:7pt;font-weight:bold;line-height:1.3;color:#111;word-break:break-all;">${p.name}</div>
    <div style="font-size:6pt;color:#555;line-height:1.3;word-break:break-all;">${p.address}</div>
  </div>
</th>`;
    }).join('');

    const priceRow = tableData.map(p => {
      if (p.isSubject && p.priceType === '査定前') {
        return `<td style="text-align:center;padding:2pt;font-size:8pt;font-weight:bold;color:#888;">査定前</td>`;
      }
      const display = p.price ? `${parseFloat(p.price).toLocaleString('ja-JP')}万円` : '—';
      const priceLabel = p.isSubject && p.priceType && p.priceType !== '査定前'
        ? `<div style="font-size:6pt;color:#888;">${p.priceType}</div>` : '';
      return `<td style="text-align:center;padding:2pt;border:0.5pt solid #ccc;">
  ${priceLabel}<div style="font-size:13pt;font-weight:bold;color:#CC0000;line-height:1.1;">${display}</div>
</td>`;
    }).join('');

    const builtRow = tableData.map(p => {
      const age = calcAge(p.builtYearMonth);
      const display = p.builtYearMonth ? `${p.builtYearMonth}${age ? `<br><span style="font-size:6pt;">(${age})</span>` : ''}` : '—';
      return `<td style="text-align:center;padding:2pt;border:0.5pt solid #ccc;font-size:7.5pt;">${display}</td>`;
    }).join('');

    const areaRow = tableData.map(p => {
      const val = p.exclusiveArea ? `${p.exclusiveArea}㎡` : '—';
      return `<td style="text-align:center;padding:2pt;border:0.5pt solid #ccc;font-size:7.5pt;">${val}</td>`;
    }).join('');

    const sqmRow = tableData.map(p => {
      const val = (p.isSubject && p.priceType === '査定前') ? '—' : calcPerSqm(p.price, p.exclusiveArea);
      return `<td style="text-align:center;padding:2pt;border:0.5pt solid #ccc;font-size:7.5pt;">${val}</td>`;
    }).join('');

    const rowHdr = `background:#f5f5f5;font-size:7pt;font-weight:bold;text-align:center;padding:2pt 3pt;border:0.5pt solid #ccc;width:15%;white-space:nowrap;`;

    const tableHtml = `<table style="width:100%;border-collapse:collapse;">
  <thead>
    <tr>
      <th style="${rowHdr}"></th>
      ${headerCells}
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${rowHdr}">${priceRowLabel}</td>${priceRow}
    </tr>
    <tr>
      <td style="${rowHdr}">築年月</td>${builtRow}
    </tr>
    <tr>
      <td style="${rowHdr}">専有面積</td>${areaRow}
    </tr>
    <tr>
      <td style="${rowHdr}">㎡単価</td>${sqmRow}
    </tr>
  </tbody>
</table>`;

    const subjectName = subject.name || subject.address?.replace(/^.+(?:市|都|道|府)/, '') || '査定対象';
    const title = `${subjectName}　周辺競合物件比較マップ`;

    const CSS = `
@page { size: A4 portrait; margin: 8mm; }
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Hiragino Kaku Gothic Pro', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', 'MS Gothic', sans-serif;
  font-size: 9pt;
  color: #111;
  width: 194mm;
}
.page {
  /* flex を使わず自然フロー。画像サイズが決まったあとに表が続く */
  display: block;
}
.title {
  text-align: center;
  font-size: 19pt;
  font-weight: bold;
  letter-spacing: 1pt;
  padding-bottom: 3pt;
  margin-bottom: 3pt;
  border-bottom: 2.5pt solid ${accentColor};
}
.map-wrapper {
  position: relative;   /* 吹き出しラベルの基準 */
  width: 100%;
  /* ⚠️ height / overflow / object-fit は一切設定しない。
     画像の自然サイズ（width:100% height:auto）に完全追従させることで
     ピン座標の % 計算と表示位置が一致する。 */
}
.map-wrapper img {
  width: 100%;
  height: auto;         /* アスペクト比維持・トリミングなし */
  display: block;
}
.map-attribution {
  position: absolute;
  bottom: 2pt;
  right: 3pt;
  font-size: 6pt;
  color: #555;
  background: rgba(255,255,255,0.85);
  padding: 1pt 3pt;
  border-radius: 2pt;
}
  top: 50%;
  transform: translateY(-50%);
  border-top: 4pt solid transparent;
  border-bottom: 4pt solid transparent;
  border-right: 6pt solid #CC0000;
}
.table-section {
  flex-shrink: 0;
  margin-top: 3pt;
}
.footer-note {
  font-size: 6pt;
  color: #777;
  text-align: right;
  margin-top: 1pt;
  flex-shrink: 0;
}`;

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
<div class="page">
  <div class="title">${count}物件 比較表${titleSuffix}</div>
  <div class="map-wrapper">
    <img src="${imgData}" alt="比較マップ" />
    ${schoolLabelsHtml}
    <div class="map-attribution">© Google</div>
  </div>
  <div class="table-section">
    ${tableHtml}
  </div>
  <div class="footer-note">※住所ベースの概略位置です</div>
</div>
<script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;
  }

  // ── 資料アップロード＆AI抽出処理 ────────────────────────────────

  /** File オブジェクトを受け取り Claude で物件情報を抽出する共通処理 */
  const processFile = async (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setExtractError('対応形式: PDF / JPEG / PNG / WebP / GIF');
      return;
    }

    setExtractError(null);
    setExtracting(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data } = await api.post('/api/comparison-maps/extract-properties', {
        imageBase64: base64,
        mediaType: file.type || 'image/jpeg',
      });

      if (!data.properties?.length) {
        setExtractError('物件情報を読み取れませんでした。より鮮明な画像またはPDFを試してください。');
        return;
      }
      setExtractedProps(data.properties);
      setShowExtractDialog(true);
    } catch (err: any) {
      setExtractError(err.response?.data?.error ?? err.message ?? 'エラーが発生しました。');
    } finally {
      setExtracting(false);
    }
  };

  /** input[type=file] の onChange */
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) processFile(file);
  };

  /** ドラッグイベント */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!extracting && competing.length < 5) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (extracting || competing.length >= 5) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  /** 確認ダイアログで「追加する」を押した時 ─ 追加後に自動ジオコーディング */
  const handleAddExtracted = async () => {
    const remaining = 5 - competing.length;
    const toAdd = extractedProps.slice(0, remaining).map(p => ({
      ...newCompeting(),
      name: p.name,
      address: p.address,
      price: p.price,
      builtYearMonth: p.builtYearMonth,
      exclusiveArea: p.exclusiveArea,
      totalUnits: p.totalUnits,
      floorInfo: p.floorInfo,
    }));
    setCompeting(arr => [...arr, ...toAdd]);
    setShowExtractDialog(false);
    setExtractedProps([]);

    // 住所がある物件は自動ジオコーディング
    for (const prop of toAdd) {
      if (!prop.address.trim()) continue;
      setCompeting(arr => arr.map(p => p.id === prop.id ? { ...p, locStatus: 'loading', locMsg: '' } : p));
      try {
        const { data } = await api.post('/api/comparison-maps/geocode', { address: prop.address, name: prop.name });
        setCompeting(arr => arr.map(p => {
          if (p.id !== prop.id) return p;
          if (!data.success) return { ...p, locStatus: 'error', locMsg: data.error ?? 'エラー' };
          return {
            ...p,
            latitude: data.latitude,
            longitude: data.longitude,
            locStatus: data.needsConfirmation ? 'warning' : 'confirmed',
            locMsg: data.message ?? '',
          };
        }));
      } catch {
        setCompeting(arr => arr.map(p => p.id === prop.id ? { ...p, locStatus: 'error', locMsg: '位置取得に失敗しました' } : p));
      }
    }
  };

  // ── 競合物件の更新ヘルパー ────────────────────────────────────
  const updComp = useCallback((id: string, patch: Partial<CompetingProperty>) => {
    setCompeting(arr => arr.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);

  // ── 成約済み物件のジオコーディング ─────────────────────────────
  const geocodeSettled = async (id: string) => {
    const prop = settledCompeting.find(p => p.id === id);
    if (!prop?.address.trim()) { alert('住所を入力してください。'); return; }
    setSettledCompeting(arr => arr.map(p => p.id === id ? { ...p, locStatus: 'loading', locMsg: '' } : p));
    try {
      const { data } = await api.post('/api/comparison-maps/geocode', { address: prop.address, name: prop.name });
      if (!data.success) throw new Error(data.error ?? '座標取得失敗');
      setSettledCompeting(arr => arr.map(p => p.id === id ? {
        ...p, latitude: data.latitude, longitude: data.longitude,
        locStatus: data.needsConfirmation ? 'warning' : 'confirmed', locMsg: data.message ?? '',
      } : p));
    } catch (err: any) {
      setSettledCompeting(arr => arr.map(p => p.id === id ? { ...p, locStatus: 'error', locMsg: err.response?.data?.error ?? err.message } : p));
    }
  };

  // ── 成約済み物件の AI 抽出 ────────────────────────────────────
  const processSettledFile = async (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowed.includes(file.type)) { setSettledExtractError('対応形式: PDF / JPEG / PNG / WebP / GIF'); return; }
    setSettledExtractError(null);
    setSettledExtracting(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await api.post('/api/comparison-maps/extract-properties', { imageBase64: base64, mediaType: file.type || 'image/jpeg' });
      if (!data.properties?.length) { setSettledExtractError('物件情報を読み取れませんでした。'); return; }
      setSettledExtractedProps(data.properties);
      setShowSettledExtractDialog(true);
    } catch (err: any) {
      setSettledExtractError(err.response?.data?.error ?? err.message ?? 'エラーが発生しました。');
    } finally {
      setSettledExtracting(false);
    }
  };

  const handleSettledFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (file) processSettledFile(file);
  };

  const handleAddSettledExtracted = async () => {
    const remaining = 5 - settledCompeting.length;
    const toAdd = settledExtractedProps.slice(0, remaining).map(p => ({ ...newCompeting(), name: p.name, address: p.address, price: p.price, builtYearMonth: p.builtYearMonth, exclusiveArea: p.exclusiveArea, totalUnits: p.totalUnits, floorInfo: p.floorInfo }));
    setSettledCompeting(arr => [...arr, ...toAdd]);
    setShowSettledExtractDialog(false);
    setSettledExtractedProps([]);
    for (const prop of toAdd) {
      if (!prop.address.trim()) continue;
      setSettledCompeting(arr => arr.map(p => p.id === prop.id ? { ...p, locStatus: 'loading', locMsg: '' } : p));
      try {
        const { data } = await api.post('/api/comparison-maps/geocode', { address: prop.address, name: prop.name });
        setSettledCompeting(arr => arr.map(p => {
          if (p.id !== prop.id) return p;
          if (!data.success) return { ...p, locStatus: 'error', locMsg: data.error ?? 'エラー' };
          return { ...p, latitude: data.latitude, longitude: data.longitude, locStatus: data.needsConfirmation ? 'warning' : 'confirmed', locMsg: data.message ?? '' };
        }));
      } catch { setSettledCompeting(arr => arr.map(p => p.id === prop.id ? { ...p, locStatus: 'error', locMsg: '位置取得失敗' } : p)); }
    }
  };

  // ── 地図プレビュー ────────────────────────────────────────────
  // ⚠️ schoolMarkers / showSchools を deps に含めないと
  //    useCallback がキャッシュした古い値でレンダリングされるため必ず含める
  const MapPreview = useCallback(() => {
    if (!isLoaded) {
      return (
        <Box sx={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
          <CircularProgress />
        </Box>
      );
    }

    const googleMaps = window.google.maps;

    return (
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '380px' }}
        center={{ lat: 33.23, lng: 131.61 }}
        zoom={14}
        options={{ mapTypeControl: false, streetViewControl: false }}
        onLoad={map => { mapRef.current = map; fitMap(); }}
      >
        {/* バス停・鉄道・路線を表示（TransitLayer） */}
        <TransitLayer />

        {/* 学校マーカー（showSchools が ON の場合） */}
        {showSchools && schoolMarkers.map((s, i) => (
          <React.Fragment key={`school-${i}`}>
            <Marker
              position={{ lat: s.lat, lng: s.lng }}
              label={{ text: s.schoolType === 'elementary' ? '小' : '中', color: 'white', fontWeight: 'bold', fontSize: '11px' }}
              icon={{
                path: googleMaps.SymbolPath.CIRCLE,
                fillColor: s.schoolType === 'elementary' ? '#4CAF50' : '#FF9800',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: 'white',
                scale: 11,
              }}
              title={s.name}
            />
            {/* 学校名ラベル（常に表示） */}
            <OverlayView
              position={{ lat: s.lat, lng: s.lng }}
              mapPaneName="overlayLayer"
              getPixelPositionOffset={() => ({ x: 14, y: -8 })}
            >
              <div style={{
                background: 'rgba(255,255,255,0.92)',
                border: `1px solid ${s.schoolType === 'elementary' ? '#4CAF50' : '#FF9800'}`,
                borderRadius: '3px', padding: '1px 4px',
                fontSize: '10px', fontWeight: 'bold',
                color: s.schoolType === 'elementary' ? '#2E7D32' : '#E65100',
                whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                pointerEvents: 'none', lineHeight: '1.3',
              }}>
                {s.name}
              </div>
            </OverlayView>
          </React.Fragment>
        ))}

        {/* 査定対象 */}
        {subject.latitude && subject.longitude && (
          <>
            <Marker
              position={{ lat: subject.latitude, lng: subject.longitude }}
              label={{ text: '★', color: 'white', fontWeight: 'bold', fontSize: '14px' }}
              icon={{
                path: googleMaps.SymbolPath.CIRCLE,
                fillColor: '#FF8800',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: 'white',
                scale: 16,
              }}
              onClick={() => setInfoId('subject')}
            />
            {infoId === 'subject' && (
              <InfoWindow
                position={{ lat: subject.latitude, lng: subject.longitude }}
                onCloseClick={() => setInfoId(null)}
              >
                <Box sx={{ maxWidth: 180 }}>
                  <Typography variant="body2" fontWeight="bold">★ 査定対象物件</Typography>
                  <Typography variant="body2">{subject.name || '（物件名未入力）'}</Typography>
                  <Typography variant="caption" color="text.secondary">{subject.address}</Typography>
                </Box>
              </InfoWindow>
            )}
          </>
        )}

        {/* 競合物件 */}
        {competing.map((p, i) => {
          if (!p.latitude || !p.longitude) return null;
          return (
            <React.Fragment key={p.id}>
              <Marker
                position={{ lat: p.latitude, lng: p.longitude }}
                label={{ text: String(i + 1), color: 'white', fontWeight: 'bold', fontSize: '13px' }}
                icon={{
                  path: googleMaps.SymbolPath.CIRCLE,
                  fillColor: '#CC0000',
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: 'white',
                  scale: 15,
                }}
                onClick={() => setInfoId(p.id)}
              />
              {infoId === p.id && (
                <InfoWindow
                  position={{ lat: p.latitude, lng: p.longitude }}
                  onCloseClick={() => setInfoId(null)}
                >
                  <Box sx={{ maxWidth: 180 }}>
                    <Typography variant="body2" fontWeight="bold">競合物件 {i + 1}</Typography>
                    <Typography variant="body2">{p.name || '（物件名未入力）'}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.address}</Typography>
                    {p.price && <Typography variant="body2">{p.price}万円</Typography>}
                  </Box>
                </InfoWindow>
              )}
            </React.Fragment>
          );
        })}
      </GoogleMap>
    );
  }, [isLoaded, subject, competing, infoId, fitMap, showSchools, schoolMarkers]);

  // ── レンダリング ───────────────────────────────────────────────
  if (pageLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* ヘッダー */}
      <Box sx={{
        px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider',
        bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 2,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Button
          startIcon={<ArrowBackIcon />}
          variant="outlined" size="small"
          onClick={() => { if (window.opener) window.close(); else window.history.back(); }}
        >戻る</Button>
        <Typography variant="h6" fontWeight="bold">比較マップ作成</Typography>
        {sellerInfo && (
          <Typography variant="body2" color="text.secondary">
            {sellerInfo.sellerNumber}{sellerInfo.name ? ` — ${sellerInfo.name}様` : ''}
          </Typography>
        )}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={printLoading ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
            onClick={handlePrint}
            disabled={printLoading || competing.length === 0}
            size="small"
            sx={{ bgcolor: '#37474f', '&:hover': { bgcolor: '#263238' } }}
          >
            {printLoading ? '準備中...' : '募集中 印刷'}
          </Button>
          <Button
            variant="contained"
            startIcon={settledPrintLoading ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
            onClick={handlePrintSettled}
            disabled={settledPrintLoading || settledCompeting.length === 0}
            size="small"
            sx={{ bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' } }}
          >
            {settledPrintLoading ? '準備中...' : '成約済み 印刷'}
          </Button>
        </Box>
      </Box>

      {pageError && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{pageError}</Alert>}

      {/* 本体：左フォーム ＋ 右マップ */}
      <Box sx={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

        {/* 左：フォーム */}
        <Box sx={{ width: { xs: '100%', md: '42%' }, overflowY: 'auto', p: 2, borderRight: 1, borderColor: 'divider' }}>

          {/* 査定対象物件 */}
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: '#fff8e1', borderColor: '#FF8800' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{
                width: 24, height: 24, borderRadius: '50%', bgcolor: '#FF8800',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 'bold', fontSize: '12px', flexShrink: 0,
              }}>★</Box>
              <Typography variant="subtitle2" fontWeight="bold">査定対象物件</Typography>
              <Box sx={{ ml: 'auto' }}>
                <LocIcon status={subject.locStatus} msg={subject.locMsg} />
              </Box>
            </Box>

            <Grid container spacing={1}>
              <Grid item xs={12}>
                <TextField label="マンション名・物件名" value={subject.name} size="small" fullWidth
                  onChange={e => setSubject(p => ({ ...p, name: e.target.value }))} />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <TextField label="所在地" value={subject.address} size="small" fullWidth
                    onChange={e => setSubject(p => ({ ...p, address: e.target.value, locStatus: 'idle', locMsg: '' }))}
                    onBlur={() => { if (subject.address.trim() && subject.locStatus === 'idle') geocode('subject'); }} />
                  <Button variant="outlined" size="small" sx={{ whiteSpace: 'nowrap', minWidth: 76 }}
                    onClick={() => geocode('subject')}
                    disabled={subject.locStatus === 'loading' || !subject.address.trim()}
                    startIcon={<MyLocationIcon />}>
                    {subject.locStatus === 'loading' ? '取得中' : '位置確認'}
                  </Button>
                </Box>
                {subject.locMsg && (
                  <Typography variant="caption" color={subject.locStatus === 'error' ? 'error' : 'warning.main'}>
                    {subject.locMsg}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>価格種別</InputLabel>
                  <Select value={subject.priceType} label="価格種別"
                    onChange={e => setSubject(p => ({ ...p, priceType: e.target.value as PriceType }))}>
                    <MenuItem value="査定前">査定前</MenuItem>
                    <MenuItem value="査定価格">査定価格</MenuItem>
                    <MenuItem value="売出提案価格">売出提案価格</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {subject.priceType !== '査定前' && (
                <Grid item xs={12} sm={6}>
                  <TextField label="価格（万円）" value={subject.price} size="small" fullWidth type="number"
                    InputProps={{ endAdornment: <Typography variant="caption">万円</Typography> }}
                    onChange={e => setSubject(p => ({ ...p, price: e.target.value }))} />
                </Grid>
              )}
              <Grid item xs={6}>
                <TextField label="築年月" value={subject.builtYearMonth} size="small" fullWidth
                  placeholder="例: 2012年08月"
                  onChange={e => setSubject(p => ({ ...p, builtYearMonth: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="専有面積（㎡）" value={subject.exclusiveArea} size="small" fullWidth type="number"
                  InputProps={{ endAdornment: <Typography variant="caption">㎡</Typography> }}
                  onChange={e => setSubject(p => ({ ...p, exclusiveArea: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="総戸数" value={subject.totalUnits} size="small" fullWidth
                  onChange={e => setSubject(p => ({ ...p, totalUnits: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="所在階" value={subject.floorInfo} size="small" fullWidth
                  placeholder="例: 10階建ての7階"
                  onChange={e => setSubject(p => ({ ...p, floorInfo: e.target.value }))} />
              </Grid>
              {subject.priceType !== '査定前' && subject.price && subject.exclusiveArea && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    ㎡単価: {calcPerSqm(subject.price, subject.exclusiveArea)}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>

          {/* 競合物件リスト */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">競合物件</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              ({competing.length}/5件)
            </Typography>
          </Box>

          {competing.map((prop, idx) => (
            <Paper key={prop.id} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{
                  width: 24, height: 24, borderRadius: '50%', bgcolor: '#CC0000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 'bold', fontSize: '12px', flexShrink: 0,
                }}>{idx + 1}</Box>
                <Typography variant="subtitle2" fontWeight="bold">競合物件 {idx + 1}</Typography>
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocIcon status={prop.locStatus} msg={prop.locMsg} />
                  <IconButton size="small" color="error"
                    onClick={() => setCompeting(arr => arr.filter(p => p.id !== prop.id))}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <TextField label="マンション名・物件名" value={prop.name} size="small" fullWidth
                    onChange={e => updComp(prop.id, { name: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <TextField label="所在地" value={prop.address} size="small" fullWidth
                      onChange={e => updComp(prop.id, { address: e.target.value, locStatus: 'idle', locMsg: '' })}
                      onBlur={() => { if (prop.address.trim() && prop.locStatus === 'idle') geocode(prop.id); }} />
                    <Button variant="outlined" size="small" sx={{ whiteSpace: 'nowrap', minWidth: 76 }}
                      onClick={() => geocode(prop.id)}
                      disabled={prop.locStatus === 'loading' || !prop.address.trim()}
                      startIcon={<MyLocationIcon />}>
                      {prop.locStatus === 'loading' ? '取得中' : '位置確認'}
                    </Button>
                  </Box>
                  {prop.locMsg && (
                    <Typography variant="caption" color={prop.locStatus === 'error' ? 'error' : 'warning.main'}>
                      {prop.locMsg}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField label="販売価格（万円）" value={prop.price} size="small" fullWidth type="number"
                    InputProps={{ endAdornment: <Typography variant="caption">万円</Typography> }}
                    onChange={e => updComp(prop.id, { price: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="築年月" value={prop.builtYearMonth} size="small" fullWidth
                    placeholder="例: 2015年02月"
                    onChange={e => updComp(prop.id, { builtYearMonth: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="専有面積（㎡）" value={prop.exclusiveArea} size="small" fullWidth type="number"
                    InputProps={{ endAdornment: <Typography variant="caption">㎡</Typography> }}
                    onChange={e => updComp(prop.id, { exclusiveArea: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="総戸数" value={prop.totalUnits} size="small" fullWidth
                    onChange={e => updComp(prop.id, { totalUnits: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="所在階" value={prop.floorInfo} size="small" fullWidth
                    onChange={e => updComp(prop.id, { floorInfo: e.target.value })} />
                </Grid>
                {prop.price && prop.exclusiveArea && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      ㎡単価: {calcPerSqm(prop.price, prop.exclusiveArea)}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          ))}

          {competing.length < 5 && (
            <Button variant="outlined" fullWidth startIcon={<AddIcon />}
              onClick={() => setCompeting(arr => [...arr, newCompeting()])}
              sx={{ mb: 1 }}>
              競合物件を追加（{competing.length + 1}件目）
            </Button>
          )}

          {/* ── 資料から読み込む ── */}
          <Box sx={{ mb: 1.5 }}>
            {/* 隠しファイル入力 */}
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />

            {/* ドラッグ＆ドロップ対応アップロードエリア */}
            <Paper
              variant="outlined"
              onClick={() => !extracting && competing.length < 5 && uploadInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                p: 2,
                textAlign: 'center',
                cursor: competing.length >= 5 || extracting ? 'default' : 'pointer',
                borderStyle: 'dashed',
                borderWidth: '2px',
                borderColor: isDragging
                  ? 'primary.main'
                  : extracting
                  ? 'primary.light'
                  : competing.length >= 5
                  ? '#ddd'
                  : '#bbb',
                bgcolor: isDragging
                  ? '#e8f4fd'
                  : extracting
                  ? '#e3f2fd'
                  : '#fafafa',
                transition: 'all 0.15s',
                '&:hover': competing.length < 5 && !extracting && !isDragging
                  ? { bgcolor: '#f0f7ff', borderColor: 'primary.light' }
                  : {},
              }}
            >
              {extracting ? (
                <Box>
                  <CircularProgress size={24} sx={{ mb: 0.5 }} />
                  <Typography variant="body2" color="primary" fontWeight="bold">
                    Claude が資料を読み取り中...
                  </Typography>
                  <LinearProgress sx={{ mt: 1, borderRadius: 1 }} />
                </Box>
              ) : competing.length >= 5 ? (
                <Typography variant="caption" color="text.disabled">
                  競合物件は最大5件です
                </Typography>
              ) : isDragging ? (
                /* ドラッグ中 */
                <Box sx={{ pointerEvents: 'none' }}>
                  <UploadFileIcon sx={{ fontSize: 32, color: 'primary.main', mb: 0.5 }} />
                  <Typography variant="body2" color="primary" fontWeight="bold">
                    ここにドロップ！
                  </Typography>
                </Box>
              ) : (
                /* 通常状態 */
                <Box>
                  <UploadFileIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
                  <Typography variant="body2" fontWeight="bold" color="text.secondary">
                    資料をここにドラッグ＆ドロップ
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    または クリックしてファイルを選択
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>
                      PDF・JPEG・PNG・WebP 対応 ／ 1枚に複数物件が載っていても一括読み取りOK
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>

            {extractError && (
              <Alert severity="error" sx={{ mt: 0.5 }} onClose={() => setExtractError(null)}>
                {extractError}
              </Alert>
            )}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, lineHeight: 1.6 }}>
            ※ 各物件の「位置確認」ボタンを押して座標を取得後、「A4印刷」ボタンで比較マップを生成します。<br />
            ※ 地図は住所ベースの概略位置です。
          </Typography>

          {/* ───────────────── 成約済み物件セクション ───────────────── */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '2px solid #1565c0' }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, color: '#1565c0' }}>
              成約済み比較物件
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                ({settledCompeting.length}/5件)
              </Typography>
            </Typography>

            {settledCompeting.map((prop, idx) => (
              <Paper key={prop.id} variant="outlined" sx={{ p: 1.5, mb: 1.5, borderColor: '#90caf9' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#2196F3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '12px', flexShrink: 0 }}>{idx + 1}</Box>
                  <Typography variant="subtitle2" fontWeight="bold">成約物件 {idx + 1}</Typography>
                  <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LocIcon status={prop.locStatus} msg={prop.locMsg} />
                    <IconButton size="small" color="error" onClick={() => setSettledCompeting(arr => arr.filter(p => p.id !== prop.id))}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                <Grid container spacing={1}>
                  <Grid item xs={12}><TextField label="マンション名・物件名" value={prop.name} size="small" fullWidth onChange={e => setSettledCompeting(arr => arr.map(p => p.id === prop.id ? { ...p, name: e.target.value } : p))} /></Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <TextField label="所在地" value={prop.address} size="small" fullWidth
                        onChange={e => setSettledCompeting(arr => arr.map(p => p.id === prop.id ? { ...p, address: e.target.value, locStatus: 'idle', locMsg: '' } : p))}
                        onBlur={() => { if (prop.address.trim() && prop.locStatus === 'idle') geocode(prop.id + '_settled'); }} />
                      <Button variant="outlined" size="small" sx={{ whiteSpace: 'nowrap', minWidth: 76 }}
                        onClick={() => geocodeSettled(prop.id)}
                        disabled={prop.locStatus === 'loading' || !prop.address.trim()}
                        startIcon={<MyLocationIcon />}>
                        {prop.locStatus === 'loading' ? '取得中' : '位置確認'}
                      </Button>
                    </Box>
                    {prop.locMsg && <Typography variant="caption" color={prop.locStatus === 'error' ? 'error' : 'warning.main'}>{prop.locMsg}</Typography>}
                  </Grid>
                  <Grid item xs={12}><TextField label="成約価格（万円）" value={prop.price} size="small" fullWidth type="number" InputProps={{ endAdornment: <Typography variant="caption">万円</Typography> }} onChange={e => setSettledCompeting(arr => arr.map(p => p.id === prop.id ? { ...p, price: e.target.value } : p))} /></Grid>
                  <Grid item xs={6}><TextField label="築年月" value={prop.builtYearMonth} size="small" fullWidth placeholder="例: 2015年02月" onChange={e => setSettledCompeting(arr => arr.map(p => p.id === prop.id ? { ...p, builtYearMonth: e.target.value } : p))} /></Grid>
                  <Grid item xs={6}><TextField label="専有面積（㎡）" value={prop.exclusiveArea} size="small" fullWidth type="number" InputProps={{ endAdornment: <Typography variant="caption">㎡</Typography> }} onChange={e => setSettledCompeting(arr => arr.map(p => p.id === prop.id ? { ...p, exclusiveArea: e.target.value } : p))} /></Grid>
                  <Grid item xs={6}><TextField label="総戸数" value={prop.totalUnits} size="small" fullWidth onChange={e => setSettledCompeting(arr => arr.map(p => p.id === prop.id ? { ...p, totalUnits: e.target.value } : p))} /></Grid>
                  <Grid item xs={6}><TextField label="所在階" value={prop.floorInfo} size="small" fullWidth onChange={e => setSettledCompeting(arr => arr.map(p => p.id === prop.id ? { ...p, floorInfo: e.target.value } : p))} /></Grid>
                  {prop.price && prop.exclusiveArea && <Grid item xs={12}><Typography variant="caption" color="text.secondary">㎡単価: {calcPerSqm(prop.price, prop.exclusiveArea)}</Typography></Grid>}
                </Grid>
              </Paper>
            ))}

            {settledCompeting.length < 5 && (
              <Button variant="outlined" fullWidth startIcon={<AddIcon />} sx={{ mb: 1, borderColor: '#2196F3', color: '#2196F3' }}
                onClick={() => setSettledCompeting(arr => [...arr, newCompeting()])}>
                成約済み物件を追加（{settledCompeting.length + 1}件目）
              </Button>
            )}

            {/* 成約済み資料アップロードエリア */}
            <Box sx={{ mb: 1 }}>
              <input ref={settledUploadRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" style={{ display: 'none' }} onChange={handleSettledFileInput} />
              <Paper variant="outlined"
                onClick={() => !settledExtracting && settledCompeting.length < 5 && settledUploadRef.current?.click()}
                onDragOver={e => { e.preventDefault(); if (!settledExtracting && settledCompeting.length < 5) setIsSettledDragging(true); }}
                onDragLeave={e => { e.preventDefault(); setIsSettledDragging(false); }}
                onDrop={e => { e.preventDefault(); setIsSettledDragging(false); if (!settledExtracting && settledCompeting.length < 5) { const f = e.dataTransfer.files?.[0]; if (f) processSettledFile(f); } }}
                sx={{ p: 2, textAlign: 'center', cursor: settledCompeting.length >= 5 || settledExtracting ? 'default' : 'pointer', borderStyle: 'dashed', borderWidth: '2px', borderColor: isSettledDragging ? '#2196F3' : settledExtracting ? '#64b5f6' : '#90caf9', bgcolor: isSettledDragging ? '#e3f2fd' : '#f3f9ff', transition: 'all 0.15s' }}>
                {settledExtracting ? (
                  <Box><CircularProgress size={24} sx={{ mb: 0.5, color: '#2196F3' }} /><Typography variant="body2" color="primary" fontWeight="bold">Claudeが資料を読み取り中...</Typography><LinearProgress sx={{ mt: 1, borderRadius: 1 }} /></Box>
                ) : settledCompeting.length >= 5 ? (
                  <Typography variant="caption" color="text.disabled">成約済み物件は最大5件です</Typography>
                ) : isSettledDragging ? (
                  <Box><UploadFileIcon sx={{ fontSize: 32, color: '#2196F3', mb: 0.5 }} /><Typography variant="body2" color="primary" fontWeight="bold">ここにドロップ！</Typography></Box>
                ) : (
                  <Box>
                    <UploadFileIcon sx={{ fontSize: 28, color: '#90caf9', mb: 0.5 }} />
                    <Typography variant="body2" fontWeight="bold" color="text.secondary">成約済み資料をドラッグ＆ドロップ</Typography>
                    <Typography variant="caption" color="text.disabled">または クリックしてファイルを選択</Typography>
                    <Box sx={{ mt: 0.5 }}><Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>PDF・JPEG・PNG 対応 ／ 複数物件まとめてOK</Typography></Box>
                  </Box>
                )}
              </Paper>
              {settledExtractError && <Alert severity="error" sx={{ mt: 0.5 }} onClose={() => setSettledExtractError(null)}>{settledExtractError}</Alert>}
            </Box>
          </Box>
        </Box>

        {/* 右：地図プレビュー */}
        <Box sx={{ flex: 1, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', p: 2, gap: 1, overflow: 'hidden' }}>
          <Typography variant="caption" color="text.secondary">
            地図プレビュー（位置確認済み物件のみ表示）
          </Typography>
          <MapPreview />
          {/* 凡例 */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#FF8800', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px' }}>★</Box>
              <Typography variant="caption">査定対象</Typography>
            </Box>
            {competing.map((_, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#CC0000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 'bold' }}>{i + 1}</Box>
                <Typography variant="caption">競合{i + 1}</Typography>
              </Box>
            ))}
            {/* 学校トグル */}
            <Box
              onClick={() => setShowSchools(v => !v)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', ml: 'auto',
                opacity: showSchools ? 1 : 0.4, border: '1px solid #ccc', borderRadius: 1, px: 0.8, py: 0.3 }}
            >
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '9px', fontWeight: 'bold' }}>小</Box>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#FF9800', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '9px', fontWeight: 'bold' }}>中</Box>
              <Typography variant="caption" color="text.secondary">{showSchools ? '学校：表示中' : '学校：非表示'}</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
      {/* ── 資料読み取り確認ダイアログ ── */}
      <Dialog open={showExtractDialog} onClose={() => setShowExtractDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          読み取り結果 — {extractedProps.length}件
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            （内容を確認してから追加してください）
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1.5 }}>
          {extractedProps.map((p, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#CC0000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '11px', flexShrink: 0 }}>
                  {competing.length + i + 1}
                </Box>
                <Typography variant="subtitle2" fontWeight="bold">競合物件 {competing.length + i + 1}</Typography>
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <TextField label="物件名" value={p.name} size="small" fullWidth
                    onChange={e => setExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="所在地" value={p.address} size="small" fullWidth
                    onChange={e => setExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, address: e.target.value } : x))} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="価格（万円）" value={p.price} size="small" fullWidth
                    InputProps={{ endAdornment: <Typography variant="caption">万円</Typography> }}
                    onChange={e => setExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="築年月" value={p.builtYearMonth} size="small" fullWidth
                    onChange={e => setExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, builtYearMonth: e.target.value } : x))} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="専有面積（㎡）" value={p.exclusiveArea} size="small" fullWidth
                    InputProps={{ endAdornment: <Typography variant="caption">㎡</Typography> }}
                    onChange={e => setExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, exclusiveArea: e.target.value } : x))} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="総戸数" value={p.totalUnits} size="small" fullWidth
                    onChange={e => setExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, totalUnits: e.target.value } : x))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="所在階" value={p.floorInfo} size="small" fullWidth
                    onChange={e => setExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, floorInfo: e.target.value } : x))} />
                </Grid>
              </Grid>
            </Paper>
          ))}
          {competing.length + extractedProps.length > 5 && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              競合物件の上限（5件）を超えるため、先頭から{5 - competing.length}件のみ追加されます。
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowExtractDialog(false); setExtractedProps([]); }}>
            キャンセル
          </Button>
          <Button variant="contained" onClick={handleAddExtracted}
            disabled={extractedProps.length === 0}>
            {Math.min(extractedProps.length, 5 - competing.length)}件を競合物件に追加
          </Button>
        </DialogActions>
      </Dialog>
      {/* ── 成約済み 資料読み取り確認ダイアログ ── */}
      <Dialog open={showSettledExtractDialog} onClose={() => setShowSettledExtractDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>読み取り結果（成約済み）— {settledExtractedProps.length}件</DialogTitle>
        <DialogContent dividers sx={{ p: 1.5 }}>
          {settledExtractedProps.map((p, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#2196F3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '11px', flexShrink: 0 }}>{settledCompeting.length + i + 1}</Box>
                <Typography variant="subtitle2" fontWeight="bold">成約物件 {settledCompeting.length + i + 1}</Typography>
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={12}><TextField label="物件名" value={p.name} size="small" fullWidth onChange={e => setSettledExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></Grid>
                <Grid item xs={12}><TextField label="所在地" value={p.address} size="small" fullWidth onChange={e => setSettledExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, address: e.target.value } : x))} /></Grid>
                <Grid item xs={6}><TextField label="成約価格（万円）" value={p.price} size="small" fullWidth InputProps={{ endAdornment: <Typography variant="caption">万円</Typography> }} onChange={e => setSettledExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} /></Grid>
                <Grid item xs={6}><TextField label="築年月" value={p.builtYearMonth} size="small" fullWidth onChange={e => setSettledExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, builtYearMonth: e.target.value } : x))} /></Grid>
                <Grid item xs={6}><TextField label="専有面積（㎡）" value={p.exclusiveArea} size="small" fullWidth InputProps={{ endAdornment: <Typography variant="caption">㎡</Typography> }} onChange={e => setSettledExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, exclusiveArea: e.target.value } : x))} /></Grid>
                <Grid item xs={6}><TextField label="所在階" value={p.floorInfo} size="small" fullWidth onChange={e => setSettledExtractedProps(arr => arr.map((x, j) => j === i ? { ...x, floorInfo: e.target.value } : x))} /></Grid>
              </Grid>
            </Paper>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowSettledExtractDialog(false); setSettledExtractedProps([]); }}>キャンセル</Button>
          <Button variant="contained" sx={{ bgcolor: '#2196F3' }} onClick={handleAddSettledExtracted} disabled={settledExtractedProps.length === 0}>
            {Math.min(settledExtractedProps.length, 5 - settledCompeting.length)}件を成約済み物件に追加
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComparisonMapPage;
