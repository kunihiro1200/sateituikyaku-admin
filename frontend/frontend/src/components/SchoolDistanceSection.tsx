/**
 * SchoolDistanceSection
 * 通話モードページ（CallModePage）で使用する学校徒歩距離セクション。
 *
 * 機能:
 * - 小学校区の自動判定（GeoJSON Point-in-Polygon）
 * - 最寄り中学校の自動取得（Google Places API）
 * - 物件から各学校までの徒歩ルート距離の計算（Google Directions API）
 * - 道路距離80mにつき1分・端数切り上げで広告用徒歩時間を算出
 * - 学校の正門・通学入口座標の設定・修正（地図上でクリック）
 * - 取得結果をseller_attached_document2に保存
 * - 手動再取得
 * - 自治体公式学区ページへのリンク
 *
 * 注意: 中学校区のGeoJSONデータは未整備のため「最寄り中学校（要確認）」として表示。
 * 学区は自治体の公式情報で確認すること。
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Grid, TextField, CircularProgress,
  Alert, Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, Link, Divider,
} from '@mui/material';
import {
  School as SchoolIcon,
  AutoAwesome as AutoIcon,
  Save as SaveIcon,
  EditLocation as EditLocationIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  LocationOn as LocationOnIcon,
} from '@mui/icons-material';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';
import api from '../services/api';

// ---- 型定義 ----

interface SchoolInfo {
  name: string;
  distanceMeters: number | null;
  walkMinutes: number | null;
  lat: number | null;
  lng: number | null;
  districtConfirmed: boolean;
  isEstimated?: boolean; // true=直線距離推定値、false=Directions API実測値
}

interface SchoolDistanceSectionProps {
  sellerNumber: string;
  sellerId: string;
  propertyAddress?: string;
}

// ---- 自治体公式学区ページURL ----
// 住所から市区町村を判定してリンクを返す
const DISTRICT_PAGE_MAP: Record<string, { label: string; url: string }> = {
  '大分市': {
    label: '大分市 学校区',
    url: 'https://www.city.oita.oita.jp/o201/machi/gakko/gakkiku/index.html',
  },
  '別府市': {
    label: '別府市 学校区',
    url: 'https://www.city.beppu.oita.jp/site/gakkikku/',
  },
  '中津市': {
    label: '中津市 学校区',
    url: 'https://www.city.nakatsu.oita.jp/docs/2020022500016/',
  },
  '日田市': {
    label: '日田市 学校区',
    url: 'https://www.city.hita.oita.jp/page/page002283.html',
  },
  '佐伯市': {
    label: '佐伯市 学校区',
    url: 'https://www.city.saiki.oita.jp/q/aview/24/4419.html',
  },
  '臼杵市': {
    label: '臼杵市 学校区',
    url: 'https://www.city.usuki.oita.jp/',
  },
  '津久見市': {
    label: '津久見市 学校区',
    url: 'https://www.city.tsukumi.oita.jp/',
  },
  '竹田市': {
    label: '竹田市 学校区',
    url: 'https://www.city.taketa.oita.jp/',
  },
  '豊後高田市': {
    label: '豊後高田市 学校区',
    url: 'https://www.city.bungotakada.oita.jp/',
  },
  '宇佐市': {
    label: '宇佐市 学校区',
    url: 'https://www.city.usa.oita.jp/',
  },
  '豊後大野市': {
    label: '豊後大野市 学校区',
    url: 'https://www.bungo-ohno.jp/',
  },
  '由布市': {
    label: '由布市 学校区',
    url: 'https://www.city.yufu.oita.jp/',
  },
  '国東市': {
    label: '国東市 学校区',
    url: 'https://www.city.kunisaki.oita.jp/',
  },
};

function getDistrictPageLink(address?: string): { label: string; url: string } | null {
  if (!address) return null;
  for (const [city, info] of Object.entries(DISTRICT_PAGE_MAP)) {
    if (address.includes(city)) return info;
  }
  // マッチしない場合はGoogle検索リンク
  const cityMatch = address.match(/^[^\s　]+[市町村]/);
  if (cityMatch) {
    return {
      label: `${cityMatch[0]} 学校区を検索`,
      url: `https://www.google.com/search?q=${encodeURIComponent(cityMatch[0] + ' 小学校区 中学校区 学区')}`,
    };
  }
  return null;
}

// ---- 正門設定マップモーダル ----

interface EntranceMapModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (lat: number, lng: number) => void;
  initialLat: number;
  initialLng: number;
  schoolName: string;
  label: string;
}

const EntranceMapModal: React.FC<EntranceMapModalProps> = ({
  open, onClose, onSelect, initialLat, initialLng, schoolName, label,
}) => {
  const { isLoaded } = useGoogleMaps();
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number }>({
    lat: initialLat, lng: initialLng,
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  useEffect(() => {
    if (open) setMarkerPos({ lat: initialLat, lng: initialLng });
  }, [open, initialLat, initialLng]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    // マーカーを作成（ドラッグ可能）
    const marker = new google.maps.Marker({
      position: { lat: initialLat, lng: initialLng },
      map,
      draggable: true,
      title: `${schoolName} 正門`,
    });
    markerRef.current = marker;

    // マーカードラッグ終了
    marker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        setMarkerPos(pos);
      }
    });

    // 地図クリックでマーカー移動
    const listener = google.maps.event.addListener(map, 'click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        marker.setPosition(pos);
        setMarkerPos(pos);
      }
    });
    clickListenerRef.current = listener;
  }, [initialLat, initialLng, schoolName]);

  // マーカーの位置を外部stateに追随させる
  useEffect(() => {
    if (markerRef.current && open) {
      markerRef.current.setPosition({ lat: initialLat, lng: initialLng });
      setMarkerPos({ lat: initialLat, lng: initialLng });
    }
  }, [open, initialLat, initialLng]);

  const handleClose = () => {
    if (clickListenerRef.current) {
      google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    mapRef.current = null;
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocationOnIcon color="primary" />
          <Typography fontWeight="bold">{label}の正門位置を設定</Typography>
        </Box>
        <IconButton size="small" onClick={handleClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ px: 2, py: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
          <Typography variant="body2" color="text.secondary">
            🗺️ 地図上の正門・通学入口をクリック、またはピンをドラッグして位置を設定してください
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {schoolName} — 現在の設定位置: {markerPos.lat.toFixed(6)}, {markerPos.lng.toFixed(6)}
          </Typography>
        </Box>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '420px' }}
            center={{ lat: initialLat, lng: initialLng }}
            zoom={17}
            onLoad={onMapLoad}
            options={{
              mapTypeId: 'roadmap',
              mapTypeControl: true,
              streetViewControl: false,
              fullscreenControl: false,
              gestureHandling: 'greedy',
              draggableCursor: 'crosshair',
            }}
          />
        ) : (
          <Box sx={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2 }}>
        <Button onClick={handleClose} color="inherit">キャンセル</Button>
        <Button
          variant="contained"
          onClick={() => { onSelect(markerPos.lat, markerPos.lng); handleClose(); }}
          startIcon={<LocationOnIcon />}
        >
          この位置を正門として設定
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ---- 学校カードコンポーネント ----

interface SchoolCardProps {
  label: string;
  icon: string;
  info: SchoolInfo;
  isJuniorHigh?: boolean; // 中学校の場合は「要確認」バッジを表示
  onNameChange: (v: string) => void;
  onWalkMinutesChange: (v: string) => void;
  onSetEntrance: () => void;
  hasCustomEntrance: boolean;
}

const SchoolCard: React.FC<SchoolCardProps> = ({
  label, icon, info, isJuniorHigh,
  onNameChange, onWalkMinutesChange, onSetEntrance, hasCustomEntrance,
}) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderLeft: `3px solid ${isJuniorHigh ? '#e65100' : '#1565c0'}`,
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <Typography fontSize={16}>{icon}</Typography>
        <Typography variant="subtitle2" fontWeight="bold" sx={{ color: isJuniorHigh ? '#e65100' : '#1565c0' }}>
          {label}
        </Typography>
        {info.districtConfirmed ? (
          <Chip
            icon={<CheckCircleIcon />}
            label="学区確定"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontSize: '9px', height: 18 }}
          />
        ) : isJuniorHigh ? (
          <Chip
            icon={<WarningIcon />}
            label="要自治体確認"
            size="small"
            color="warning"
            variant="outlined"
            sx={{ fontSize: '9px', height: 18 }}
          />
        ) : null}
        {hasCustomEntrance && (
          <Chip
            label="正門設定済"
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontSize: '9px', height: 18, ml: 'auto' }}
          />
        )}
      </Box>

      {/* 学校名 */}
      <TextField
        fullWidth
        size="small"
        label="学校名"
        value={info.name}
        onChange={(e) => onNameChange(e.target.value)}
        sx={{ mb: 1, '& .MuiOutlinedInput-root': { fontSize: '13px' } }}
        InputLabelProps={{ sx: { fontSize: '12px' } }}
      />

      {/* 距離・徒歩時間 */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.3 }}>
            道路距離{info.isEstimated ? '（推定）' : ''}
          </Typography>
          <Typography variant="body2" fontWeight="bold" sx={{ color: info.isEstimated ? '#e65100' : '#333' }}>
            {info.distanceMeters !== null
              ? `約${info.distanceMeters.toLocaleString()}m${info.isEstimated ? ' ※' : ''}`
              : '—'}
          </Typography>
          {info.isEstimated && info.distanceMeters !== null && (
            <Typography variant="caption" sx={{ color: '#e65100', fontSize: '9px' }}>
              ※直線距離×1.3の推定値
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: 1 }}>
          <TextField
            size="small"
            label="徒歩時間（分）"
            value={info.walkMinutes !== null ? String(info.walkMinutes) : ''}
            onChange={(e) => onWalkMinutesChange(e.target.value)}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', style: { fontSize: '13px' } }}
            InputLabelProps={{ sx: { fontSize: '11px' } }}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '13px' } }}
            helperText="広告表示用（80m/分・切上）"
            FormHelperTextProps={{ sx: { fontSize: '9px', mt: 0.3 } }}
          />
        </Box>
      </Box>

      {/* 正門設定ボタン */}
      <Tooltip title="正門・通学入口の位置を地図上で設定（徒歩ルート計算に使用）">
        <Button
          size="small"
          variant="outlined"
          startIcon={<EditLocationIcon />}
          onClick={onSetEntrance}
          sx={{ fontSize: '11px' }}
          disabled={!info.lat}
        >
          正門を地図で設定
        </Button>
      </Tooltip>

      {info.lat && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          目的地: {info.lat.toFixed(5)}, {info.lng?.toFixed(5)}
        </Typography>
      )}
    </Paper>
  );
};

// ---- メインコンポーネント ----

const EMPTY_SCHOOL: SchoolInfo = {
  name: '', distanceMeters: null, walkMinutes: null,
  lat: null, lng: null, districtConfirmed: false,
};

const SchoolDistanceSection: React.FC<SchoolDistanceSectionProps> = ({
  sellerNumber, sellerId, propertyAddress,
}) => {
  const [elementarySchool, setElementarySchool] = useState<SchoolInfo>(EMPTY_SCHOOL);
  const [juniorHighSchool, setJuniorHighSchool] = useState<SchoolInfo>(EMPTY_SCHOOL);
  const [customElemEntrance, setCustomElemEntrance] = useState<{ lat: number; lng: number } | null>(null);
  const [customJhEntrance, setCustomJhEntrance] = useState<{ lat: number; lng: number } | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [entranceModalOpen, setEntranceModalOpen] = useState<'elementary' | 'juniorHigh' | null>(null);

  // 初期データ読み込み
  const loadData = useCallback(async () => {
    if (!sellerId) return;
    try {
      const res = await api.get(`/api/sellers/${sellerId}/attached-document2`);
      const d = res.data;
      if (d) {
        setElementarySchool({
          name: d.elementary_school_name || '',
          distanceMeters: d.elementary_school_distance ?? null,
          walkMinutes: d.elementary_school_walk ? parseInt(d.elementary_school_walk, 10) : null,
          lat: d.elementary_school_entrance_lat ?? null,
          lng: d.elementary_school_entrance_lng ?? null,
          districtConfirmed: false,
        });
        setJuniorHighSchool({
          name: d.junior_high_school_name || '',
          distanceMeters: d.junior_high_school_distance ?? null,
          walkMinutes: d.junior_high_school_walk ? parseInt(d.junior_high_school_walk, 10) : null,
          lat: d.junior_high_school_entrance_lat ?? null,
          lng: d.junior_high_school_entrance_lng ?? null,
          districtConfirmed: false,
        });
        if (d.elementary_school_entrance_lat) {
          setCustomElemEntrance({
            lat: d.elementary_school_entrance_lat,
            lng: d.elementary_school_entrance_lng,
          });
        }
        if (d.junior_high_school_entrance_lat) {
          setCustomJhEntrance({
            lat: d.junior_high_school_entrance_lat,
            lng: d.junior_high_school_entrance_lng,
          });
        }
        setFetchedAt(d.school_info_fetched_at ?? null);
      }
    } catch (_) {
      // 初回取得エラーは無視（まだ登録されていない場合あり）
    }
  }, [sellerId]);

  useEffect(() => { loadData(); }, [loadData]);

  // 自動取得
  const handleAutoFetch = async () => {
    setFetching(true);
    setFetchError(null);
    setSaveSuccess(false);
    try {
      // 物件の座標を取得
      const coordRes = await api.get(`/api/sellers/by-number/${sellerNumber}`);
      const lat = coordRes.data.latitude;
      const lng = coordRes.data.longitude;

      if (!lat || !lng) {
        setFetchError('物件の座標が未設定です。地図（PropertyMap）で物件の位置を設定してください。');
        return;
      }

      // school-walk APIで徒歩距離を計算
      const params: Record<string, string | number> = { lat, lng };
      if (customElemEntrance) {
        params.elementaryLat = customElemEntrance.lat;
        params.elementaryLng = customElemEntrance.lng;
      }
      if (customJhEntrance) {
        params.juniorHighLat = customJhEntrance.lat;
        params.juniorHighLng = customJhEntrance.lng;
      }

      const res = await api.get('/api/nearby-map/school-walk', { params });
      const data = res.data;

      if (data.elementarySchool) {
        setElementarySchool({
          name: data.elementarySchool.name,
          distanceMeters: data.elementarySchool.distanceMeters,
          walkMinutes: data.elementarySchool.walkMinutes,
          lat: data.elementarySchool.lat,
          lng: data.elementarySchool.lng,
          districtConfirmed: data.elementarySchool.districtConfirmed,
          isEstimated: data.elementarySchool.isEstimated ?? false,
        });
        // カスタム正門が未設定なら取得結果座標を使う
        if (!customElemEntrance) {
          setCustomElemEntrance(null); // Places APIの座標はカスタム設定としては扱わない
        }
      }
      if (data.juniorHighSchool) {
        setJuniorHighSchool({
          name: data.juniorHighSchool.name,
          distanceMeters: data.juniorHighSchool.distanceMeters,
          walkMinutes: data.juniorHighSchool.walkMinutes,
          lat: data.juniorHighSchool.lat,
          lng: data.juniorHighSchool.lng,
          districtConfirmed: data.juniorHighSchool.districtConfirmed,
          isEstimated: data.juniorHighSchool.isEstimated ?? false,
        });
      }
    } catch (err: any) {
      setFetchError(err.response?.data?.error || '学校情報の取得に失敗しました');
    } finally {
      setFetching(false);
    }
  };

  // 保存
  const handleSave = async () => {
    if (!sellerId) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.patch(`/api/sellers/${sellerId}/attached-document2/school`, {
        elementary_school_name: elementarySchool.name || null,
        elementary_school_walk: elementarySchool.walkMinutes !== null ? String(elementarySchool.walkMinutes) : null,
        elementary_school_distance: elementarySchool.distanceMeters,
        elementary_school_entrance_lat: customElemEntrance?.lat ?? elementarySchool.lat,
        elementary_school_entrance_lng: customElemEntrance?.lng ?? elementarySchool.lng,
        junior_high_school_name: juniorHighSchool.name || null,
        junior_high_school_walk: juniorHighSchool.walkMinutes !== null ? String(juniorHighSchool.walkMinutes) : null,
        junior_high_school_distance: juniorHighSchool.distanceMeters,
        junior_high_school_entrance_lat: customJhEntrance?.lat ?? juniorHighSchool.lat,
        junior_high_school_entrance_lng: customJhEntrance?.lng ?? juniorHighSchool.lng,
        school_info_fetched_at: new Date().toISOString(),
      });
      setFetchedAt(new Date().toISOString());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setFetchError(err.response?.data?.error || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const districtLink = getDistrictPageLink(propertyAddress);

  const hasAnyData = elementarySchool.name || juniorHighSchool.name;

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          mt: 2,
          p: 2,
          borderColor: '#1565c0',
          borderRadius: 2,
          bgcolor: '#fafcff',
        }}
      >
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <SchoolIcon sx={{ color: '#1565c0', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#1565c0' }}>
            学校区・徒歩距離
          </Typography>
          {fetchedAt && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              取得日時: {new Date(fetchedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Typography>
          )}
        </Box>

        {/* 注意書き */}
        <Alert severity="info" sx={{ mb: 1.5, py: 0.5, fontSize: '11px' }}>
          <Box component="span" sx={{ fontWeight: 'bold' }}>小学校区</Box>
          は学区GeoJSONデータで自動判定します。
          <Box component="span" sx={{ fontWeight: 'bold', color: '#e65100' }}>中学校区</Box>
          はGeoJSONデータ未整備のため最近接校を表示します（
          <Box component="span" fontWeight="bold">要自治体確認</Box>
          ）。徒歩時間は道路距離80mにつき1分・端数切り上げの不動産広告表示基準です。
        </Alert>

        {/* エラー表示 */}
        {fetchError && (
          <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setFetchError(null)}>
            {fetchError}
          </Alert>
        )}
        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 1.5 }}>
            保存しました
          </Alert>
        )}

        {/* 学校カード */}
        <Grid container spacing={2} sx={{ mb: 1.5 }}>
          <Grid item xs={12} sm={6}>
            <SchoolCard
              label="小学校"
              icon="🏫"
              info={elementarySchool}
              isJuniorHigh={false}
              hasCustomEntrance={!!customElemEntrance}
              onNameChange={(v) => setElementarySchool((p) => ({ ...p, name: v }))}
              onWalkMinutesChange={(v) => {
                const n = parseInt(v, 10);
                setElementarySchool((p) => ({
                  ...p,
                  walkMinutes: v === '' ? null : isNaN(n) ? p.walkMinutes : n,
                }));
              }}
              onSetEntrance={() => setEntranceModalOpen('elementary')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SchoolCard
              label="中学校（最近接・要確認）"
              icon="🏫"
              info={juniorHighSchool}
              isJuniorHigh
              hasCustomEntrance={!!customJhEntrance}
              onNameChange={(v) => setJuniorHighSchool((p) => ({ ...p, name: v }))}
              onWalkMinutesChange={(v) => {
                const n = parseInt(v, 10);
                setJuniorHighSchool((p) => ({
                  ...p,
                  walkMinutes: v === '' ? null : isNaN(n) ? p.walkMinutes : n,
                }));
              }}
              onSetEntrance={() => setEntranceModalOpen('juniorHigh')}
            />
          </Grid>
        </Grid>

        <Divider sx={{ mb: 1.5 }} />

        {/* アクションボタン */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={fetching ? <CircularProgress size={14} color="inherit" /> : <AutoIcon />}
            onClick={handleAutoFetch}
            disabled={fetching || saving}
          >
            {fetching ? '取得中...' : hasAnyData ? '再取得' : '自動取得'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || fetching || !hasAnyData}
            color="success"
          >
            {saving ? '保存中...' : '保存'}
          </Button>
          {districtLink && (
            <Tooltip title={`${districtLink.label}（外部サイト）`}>
              <Link
                href={districtLink.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '12px', ml: 'auto' }}
              >
                <OpenInNewIcon sx={{ fontSize: 14 }} />
                自治体公式サイトで学区確認
              </Link>
            </Tooltip>
          )}
        </Box>

        {/* APIクレジット（Google Maps Platform利用規約） */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          ※ 徒歩ルート距離はGoogle Maps Directions APIを使用して取得します（1回あたり最大2リクエスト）。
        </Typography>
      </Paper>

      {/* 正門設定モーダル（小学校） */}
      {entranceModalOpen === 'elementary' && elementarySchool.lat && (
        <EntranceMapModal
          open
          onClose={() => setEntranceModalOpen(null)}
          onSelect={(lat, lng) => {
            setCustomElemEntrance({ lat, lng });
            setElementarySchool((p) => ({ ...p, lat, lng }));
          }}
          initialLat={customElemEntrance?.lat ?? elementarySchool.lat}
          initialLng={customElemEntrance?.lng ?? elementarySchool.lng ?? 0}
          schoolName={elementarySchool.name}
          label="小学校"
        />
      )}

      {/* 正門設定モーダル（中学校） */}
      {entranceModalOpen === 'juniorHigh' && juniorHighSchool.lat && (
        <EntranceMapModal
          open
          onClose={() => setEntranceModalOpen(null)}
          onSelect={(lat, lng) => {
            setCustomJhEntrance({ lat, lng });
            setJuniorHighSchool((p) => ({ ...p, lat, lng }));
          }}
          initialLat={customJhEntrance?.lat ?? juniorHighSchool.lat}
          initialLng={customJhEntrance?.lng ?? juniorHighSchool.lng ?? 0}
          schoolName={juniorHighSchool.name}
          label="中学校"
        />
      )}
    </>
  );
};

export default SchoolDistanceSection;
