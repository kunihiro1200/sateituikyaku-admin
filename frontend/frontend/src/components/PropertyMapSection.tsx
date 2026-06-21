import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Box, Paper, Typography, CircularProgress, Button, Alert } from '@mui/material';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';
import EditLocationIcon from '@mui/icons-material/EditLocation';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import SquareFootIcon from '@mui/icons-material/SquareFoot';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import MapIcon from '@mui/icons-material/Map';
import RefreshIcon from '@mui/icons-material/Refresh';

interface PropertyMapSectionProps {
  sellerNumber: string;
  propertyAddress: string | undefined;
  currentAddress?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const DEFAULT_ZOOM = 15;

const PropertyMapSection: React.FC<PropertyMapSectionProps> = ({ sellerNumber, propertyAddress, currentAddress }) => {
  const { isLoaded: isMapLoaded } = useGoogleMaps();
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [originalCoordinates, setOriginalCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingCoordinates, setIsLoadingCoordinates] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isRegeocoding, setIsRegeocoding] = useState(false);
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [measuredArea, setMeasuredArea] = useState<number | null>(null);
  const [isSatellite, setIsSatellite] = useState(false);

  const markerRef = useRef<google.maps.Marker | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const measurePolygonRef = useRef<google.maps.Polygon | null>(null);
  // 手動クリック描画用
  const measureClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const measurePointsRef = useRef<google.maps.LatLng[]>([]);
  const measureTempMarkersRef = useRef<google.maps.Marker[]>([]);
  const measurePolylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!sellerNumber) {
      setMapCoordinates(null);
      setOriginalCoordinates(null);
      return;
    }

    const fetchCoordinates = async () => {
      setIsLoadingCoordinates(true);
      try {
        const response = await api.get(`/api/sellers/by-number/${sellerNumber}`);
        const data = response.data;
        if (data.latitude && data.longitude) {
          const coords = { lat: data.latitude, lng: data.longitude };
          setMapCoordinates(coords);
          setOriginalCoordinates(coords);
        } else {
          setMapCoordinates(null);
          setOriginalCoordinates(null);
        }
      } catch (error) {
        console.error('🗺️ [PropertyMapSection] Error fetching coordinates:', error);
        setMapCoordinates(null);
        setOriginalCoordinates(null);
      } finally {
        setIsLoadingCoordinates(false);
      }
    };

    fetchCoordinates();
  }, [sellerNumber]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setDraggable(isEditMode);
    }
  }, [isEditMode]);

  // 手動描画のクリーンアップ
  const cleanupMeasureDrawing = () => {
    if (measureClickListenerRef.current) {
      google.maps.event.removeListener(measureClickListenerRef.current);
      measureClickListenerRef.current = null;
    }
    measureTempMarkersRef.current.forEach(m => m.setMap(null));
    measureTempMarkersRef.current = [];
    if (measurePolylineRef.current) {
      measurePolylineRef.current.setMap(null);
      measurePolylineRef.current = null;
    }
    measurePointsRef.current = [];
  };

  // 面積計測モードをONにする（DrawingManagerを使わず直接クリックリスナー）
  const handleMeasureModeOn = () => {
    if (!mapRef.current) return;
    if (isEditMode) return;

    setIsMeasureMode(true);
    setMeasuredArea(null);

    // ポリゴン描画用のポリライン（描画中の線）
    const polyline = new google.maps.Polyline({
      strokeColor: '#1565C0',
      strokeWeight: 2,
      map: mapRef.current,
    });
    measurePolylineRef.current = polyline;

    // 地図クリックで頂点を追加
    const listener = google.maps.event.addListener(mapRef.current, 'click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const map = mapRef.current;
      if (!map) return;

      const points = measurePointsRef.current;

      // 最初の点の近くをクリックしたら閉じる（3点以上あるとき）
      if (points.length >= 3) {
        const first = points[0];
        const proj = map.getProjection();
        if (proj) {
          const firstPx = proj.fromLatLngToPoint(first);
          const clickPx = proj.fromLatLngToPoint(e.latLng);
          const zoom = map.getZoom() ?? 15;
          const scale = Math.pow(2, zoom);
          if (firstPx && clickPx) {
            const dx = (firstPx.x - clickPx.x) * scale;
            const dy = (firstPx.y - clickPx.y) * scale;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 15) {
              // 閉じてポリゴン確定
              finalizeMeasurePolygon();
              return;
            }
          }
        }
      }

      // 点を追加
      points.push(e.latLng);

      // マーカーを置く（最初の点は目立たせる）
      const isFirst = points.length === 1;
      const marker = new google.maps.Marker({
        position: e.latLng,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isFirst ? 8 : 5,
          fillColor: isFirst ? '#FF5722' : '#1565C0',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
      measureTempMarkersRef.current.push(marker);

      // ポリラインを更新
      polyline.setPath(points);
    });

    measureClickListenerRef.current = listener;
  };

  // ポリゴンを確定して面積を計算
  const finalizeMeasurePolygon = () => {
    const points = measurePointsRef.current;
    if (points.length < 3 || !mapRef.current) return;

    // クリックリスナーを解除
    if (measureClickListenerRef.current) {
      google.maps.event.removeListener(measureClickListenerRef.current);
      measureClickListenerRef.current = null;
    }

    // ポリラインを削除
    if (measurePolylineRef.current) {
      measurePolylineRef.current.setMap(null);
      measurePolylineRef.current = null;
    }

    // 仮マーカーを削除
    measureTempMarkersRef.current.forEach(m => m.setMap(null));
    measureTempMarkersRef.current = [];

    // ポリゴンを作成
    const polygon = new google.maps.Polygon({
      paths: points,
      fillColor: '#2196F3',
      fillOpacity: 0.25,
      strokeColor: '#1565C0',
      strokeWeight: 2,
      editable: true,
      draggable: false,
      map: mapRef.current,
    });
    measurePolygonRef.current = polygon;
    measurePointsRef.current = [];

    // 面積を計算
    const area = google.maps.geometry.spherical.computeArea(polygon.getPath());
    setMeasuredArea(area);

    // 頂点変更時に再計算
    const recalc = () => {
      const updated = google.maps.geometry.spherical.computeArea(polygon.getPath());
      setMeasuredArea(updated);
    };
    google.maps.event.addListener(polygon.getPath(), 'set_at', recalc);
    google.maps.event.addListener(polygon.getPath(), 'insert_at', recalc);
    google.maps.event.addListener(polygon.getPath(), 'remove_at', recalc);
  };

  // 面積計測モードをOFFにする
  const handleMeasureModeOff = () => {
    cleanupMeasureDrawing();
    if (measurePolygonRef.current) {
      measurePolygonRef.current.setMap(null);
      measurePolygonRef.current = null;
    }
    setIsMeasureMode(false);
    setMeasuredArea(null);
  };

  // 描画をクリアして再描画
  const handleMeasureClear = () => {
    cleanupMeasureDrawing();
    if (measurePolygonRef.current) {
      measurePolygonRef.current.setMap(null);
      measurePolygonRef.current = null;
    }
    setMeasuredArea(null);

    // 再度クリックリスナーを設定
    if (!mapRef.current) return;
    const polyline = new google.maps.Polyline({
      strokeColor: '#1565C0',
      strokeWeight: 2,
      map: mapRef.current,
    });
    measurePolylineRef.current = polyline;

    const listener = google.maps.event.addListener(mapRef.current, 'click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const map = mapRef.current;
      if (!map) return;
      const points = measurePointsRef.current;
      if (points.length >= 3) {
        const first = points[0];
        const proj = map.getProjection();
        if (proj) {
          const firstPx = proj.fromLatLngToPoint(first);
          const clickPx = proj.fromLatLngToPoint(e.latLng);
          const zoom = map.getZoom() ?? 15;
          const scale = Math.pow(2, zoom);
          if (firstPx && clickPx) {
            const dx = (firstPx.x - clickPx.x) * scale;
            const dy = (firstPx.y - clickPx.y) * scale;
            if (Math.sqrt(dx * dx + dy * dy) < 15) {
              finalizeMeasurePolygon();
              return;
            }
          }
        }
      }
      points.push(e.latLng);
      const isFirst = points.length === 1;
      const marker = new google.maps.Marker({
        position: e.latLng,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isFirst ? 8 : 5,
          fillColor: isFirst ? '#FF5722' : '#1565C0',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
      measureTempMarkersRef.current.push(marker);
      polyline.setPath(points);
    });
    measureClickListenerRef.current = listener;
  };

  const formatArea = (areaSqm: number): string => {
    const tsubo = areaSqm / 3.30579;
    return `${areaSqm.toFixed(1)} ㎡（約 ${tsubo.toFixed(1)} 坪）`;
  };

  const handleToggleSatellite = () => {
    if (!mapRef.current) return;
    const next = !isSatellite;
    setIsSatellite(next);
    mapRef.current.setMapTypeId(
      next ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP
    );
  };

  const handleEditModeToggle = () => {
    if (isEditMode) {
      if (originalCoordinates) {
        setMapCoordinates(originalCoordinates);
        if (markerRef.current) markerRef.current.setPosition(originalCoordinates);
      }
    }
    if (!isEditMode && isMeasureMode) handleMeasureModeOff();
    setIsEditMode(!isEditMode);
    setSaveMessage(null);
  };

  const handleSaveCoordinates = async () => {
    if (!mapCoordinates || !sellerNumber) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await api.patch(`/api/sellers/by-number/${sellerNumber}`, {
        latitude: mapCoordinates.lat,
        longitude: mapCoordinates.lng,
      });
      setOriginalCoordinates(mapCoordinates);
      setIsEditMode(false);
      setSaveMessage({ type: 'success', text: '座標を保存しました' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({ type: 'error', text: '座標の保存に失敗しました' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setMapCoordinates({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  };

  const handleRegeocode = async () => {
    if (!sellerNumber) return;
    const addressToUse = currentAddress?.trim() || propertyAddress;
    if (!addressToUse) return;
    setIsRegeocoding(true);
    setSaveMessage(null);
    try {
      const response = await api.post(`/api/sellers/by-number/${sellerNumber}/geocode`, {
        address: addressToUse,
      });
      const { latitude, longitude, propertyAddress: geocodedAddress } = response.data;
      const newCoords = { lat: latitude, lng: longitude };
      setMapCoordinates(newCoords);
      setOriginalCoordinates(newCoords);
      if (markerRef.current) {
        markerRef.current.setPosition(newCoords);
        markerRef.current.setTitle(geocodedAddress);
      }
      if (mapRef.current) mapRef.current.setCenter(newCoords);
      setSaveMessage({ type: 'success', text: `「${geocodedAddress}」の位置に地図を更新しました` });
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error?.response?.data?.error || '住所からの座標取得に失敗しました' });
    } finally {
      setIsRegeocoding(false);
    }
  };

  if (!sellerNumber || !isMapLoaded || (!isLoadingCoordinates && !mapCoordinates && !propertyAddress && !currentAddress)) {
    return null;
  }

  const googleMapsUrl = mapCoordinates
    ? `https://www.google.com/maps?q=${mapCoordinates.lat},${mapCoordinates.lng}`
    : null;

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', cursor: googleMapsUrl && !isEditMode && !isMeasureMode ? 'pointer' : 'default' }}
          onClick={() => !isEditMode && !isMeasureMode && googleMapsUrl && window.open(googleMapsUrl, '_blank', 'noopener,noreferrer')}
        >
          <Typography variant="h6">🗺️ 物件位置</Typography>
          {googleMapsUrl && !isEditMode && !isMeasureMode && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              （クリックでGoogleマップを開く）
            </Typography>
          )}
          {isEditMode && (
            <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
              （ピンをドラッグして位置を修正）
            </Typography>
          )}
          {isMeasureMode && measuredArea === null && (
            <Typography variant="caption" color="success.main" sx={{ ml: 1 }}>
              （地図上をクリックして頂点を打つ、最初の点をクリックで確定）
            </Typography>
          )}
        </Box>

        {(mapCoordinates || propertyAddress || currentAddress) && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!isEditMode && !isMeasureMode && (
              <>
                {(propertyAddress || currentAddress) && (
                  <Button
                    variant="outlined" size="small" color="warning"
                    startIcon={isRegeocoding ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                    onClick={handleRegeocode}
                    disabled={isRegeocoding}
                    title={`「${currentAddress || propertyAddress}」の住所から地図を更新`}
                  >
                    {isRegeocoding ? '更新中...' : '地図を更新'}
                  </Button>
                )}
                {mapCoordinates && (
                  <>
                    <Button variant="outlined" size="small" startIcon={<EditLocationIcon />} onClick={handleEditModeToggle}>
                      位置を修正
                    </Button>
                    <Button variant="outlined" size="small" color="success" startIcon={<SquareFootIcon />} onClick={handleMeasureModeOn}>
                      面積を計る
                    </Button>
                    <Button
                      variant={isSatellite ? 'contained' : 'outlined'} size="small" color="primary"
                      startIcon={isSatellite ? <MapIcon /> : <SatelliteAltIcon />}
                      onClick={handleToggleSatellite}
                    >
                      {isSatellite ? '通常地図' : '航空写真'}
                    </Button>
                  </>
                )}
              </>
            )}
            {isEditMode && (
              <>
                <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSaveCoordinates} disabled={isSaving}>
                  {isSaving ? '保存中...' : '保存'}
                </Button>
                <Button variant="outlined" size="small" startIcon={<CancelIcon />} onClick={handleEditModeToggle} disabled={isSaving}>
                  キャンセル
                </Button>
              </>
            )}
            {isMeasureMode && (
              <>
                {measuredArea !== null && (
                  <Button variant="outlined" size="small" color="success" startIcon={<DeleteOutlineIcon />} onClick={handleMeasureClear}>
                    描画をクリア
                  </Button>
                )}
                <Button variant="outlined" size="small" startIcon={<CancelIcon />} onClick={handleMeasureModeOff}>
                  計測を終了
                </Button>
              </>
            )}
          </Box>
        )}
      </Box>

      {saveMessage && <Alert severity={saveMessage.type} sx={{ mb: 2 }}>{saveMessage.text}</Alert>}

      {!isLoadingCoordinates && !mapCoordinates && (propertyAddress || currentAddress) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            「<strong>{currentAddress || propertyAddress}</strong>」の座標がまだ登録されていません。「地図を更新」ボタンを押すと住所から地図上の位置を取得します。
          </Typography>
        </Alert>
      )}

      {isMeasureMode && measuredArea !== null && (
        <Alert severity="success" icon={<SquareFootIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="bold">計測面積: {formatArea(measuredArea)}</Typography>
          <Typography variant="caption" color="text.secondary">※ 頂点をドラッグして範囲を調整できます</Typography>
        </Alert>
      )}

      {isMeasureMode && measuredArea === null && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            地図上をクリックして頂点を打ち、最初の点をクリックして確定してください（3点以上必要）
          </Typography>
        </Alert>
      )}

      {isLoadingCoordinates && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoadingCoordinates && mapCoordinates && (
        <Box sx={{ borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCoordinates}
            zoom={DEFAULT_ZOOM}
            options={{
              zoomControl: true,
              streetViewControl: true,
              mapTypeControl: false,
              fullscreenControl: true,
              clickableIcons: false,
            }}
            onLoad={(map) => {
              mapRef.current = map;
              const marker = new google.maps.Marker({
                position: { lat: mapCoordinates.lat, lng: mapCoordinates.lng },
                map: map,
                title: propertyAddress,
                draggable: false,
              });
              markerRef.current = marker;
              marker.addListener('dragend', handleMarkerDragEnd);
            }}
          />

          {isEditMode && (
            <Box sx={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              bgcolor: 'rgba(255,255,255,0.95)', px: 2, py: 1, borderRadius: 1, boxShadow: 2,
              pointerEvents: 'none',
            }}>
              <Typography variant="caption" color="text.secondary">
                緯度: {mapCoordinates.lat.toFixed(7)}, 経度: {mapCoordinates.lng.toFixed(7)}
              </Typography>
            </Box>
          )}

          {isMeasureMode && measuredArea !== null && (
            <Box sx={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              bgcolor: 'rgba(255,255,255,0.97)', px: 2, py: 1, borderRadius: 1, boxShadow: 2,
              textAlign: 'center', whiteSpace: 'nowrap', pointerEvents: 'none',
            }}>
              <Typography variant="body2" fontWeight="bold" color="success.main">
                📐 {formatArea(measuredArea)}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default PropertyMapSection;
