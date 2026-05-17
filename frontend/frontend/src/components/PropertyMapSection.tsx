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

interface PropertyMapSectionProps {
  sellerNumber: string;
  propertyAddress: string | undefined;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const DEFAULT_ZOOM = 15;

const PropertyMapSection: React.FC<PropertyMapSectionProps> = ({ sellerNumber, propertyAddress }) => {
  const { isLoaded: isMapLoaded } = useGoogleMaps();
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [originalCoordinates, setOriginalCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingCoordinates, setIsLoadingCoordinates] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // 面積計測用のstate
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [measuredArea, setMeasuredArea] = useState<number | null>(null);
  // 航空写真（サテライト）表示切り替え
  const [isSatellite, setIsSatellite] = useState(false);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const measurePolygonRef = useRef<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!sellerNumber) {
      setMapCoordinates(null);
      setOriginalCoordinates(null);
      return;
    }

    const fetchCoordinates = async () => {
      setIsLoadingCoordinates(true);
      try {
        // バックエンドから座標を取得（ジオコーディングもバックエンド側で実施）
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

  // 編集モードが変更されたときにマーカーのドラッグ可能状態を更新
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setDraggable(isEditMode);
      console.log('🗺️ [PropertyMapSection] Marker draggable set to:', isEditMode);
    }
  }, [isEditMode]);

  // 編集モード切り替え
  const handleEditModeToggle = () => {
    if (isEditMode) {
      // キャンセル: 元の座標に戻す
      if (originalCoordinates) {
        setMapCoordinates(originalCoordinates);
        if (markerRef.current) {
          markerRef.current.setPosition(originalCoordinates);
        }
      }
    }
    // 編集モードに入るとき/出るときは計測モードを終了する
    if (!isEditMode && isMeasureMode) {
      handleMeasureModeOff();
    }
    setIsEditMode(!isEditMode);
    setSaveMessage(null);
  };

  // 面積計測モードをONにする
  const handleMeasureModeOn = () => {
    if (!mapRef.current) return;

    // 編集モード中は計測モードに入れない
    if (isEditMode) return;

    setIsMeasureMode(true);
    setMeasuredArea(null);

    // DrawingManagerを作成してポリゴン描画を有効化
    const drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: false, // カスタムボタンを使うので非表示
      polygonOptions: {
        fillColor: '#2196F3',
        fillOpacity: 0.25,
        strokeColor: '#1565C0',
        strokeWeight: 2,
        editable: true,
        draggable: false,
      },
    });

    drawingManager.setMap(mapRef.current);
    drawingManagerRef.current = drawingManager;

    // ポリゴン描画完了時に面積を計算
    google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon: google.maps.Polygon) => {
      // 前のポリゴンがあれば削除
      if (measurePolygonRef.current) {
        measurePolygonRef.current.setMap(null);
      }
      measurePolygonRef.current = polygon;

      // 描画モードを終了（追加描画を防ぐ）
      drawingManager.setDrawingMode(null);

      // 面積を計算（㎡）
      const area = google.maps.geometry.spherical.computeArea(polygon.getPath());
      setMeasuredArea(area);

      // ポリゴンの頂点が変更されたときも再計算
      google.maps.event.addListener(polygon.getPath(), 'set_at', () => {
        const updatedArea = google.maps.geometry.spherical.computeArea(polygon.getPath());
        setMeasuredArea(updatedArea);
      });
      google.maps.event.addListener(polygon.getPath(), 'insert_at', () => {
        const updatedArea = google.maps.geometry.spherical.computeArea(polygon.getPath());
        setMeasuredArea(updatedArea);
      });
      google.maps.event.addListener(polygon.getPath(), 'remove_at', () => {
        const updatedArea = google.maps.geometry.spherical.computeArea(polygon.getPath());
        setMeasuredArea(updatedArea);
      });
    });
  };

  // 面積計測モードをOFFにする（クリーンアップ）
  const handleMeasureModeOff = () => {
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setMap(null);
      drawingManagerRef.current = null;
    }
    if (measurePolygonRef.current) {
      measurePolygonRef.current.setMap(null);
      measurePolygonRef.current = null;
    }
    setIsMeasureMode(false);
    setMeasuredArea(null);
  };

  // 描画をクリアして再描画できるようにする
  const handleMeasureClear = () => {
    if (measurePolygonRef.current) {
      measurePolygonRef.current.setMap(null);
      measurePolygonRef.current = null;
    }
    setMeasuredArea(null);

    // DrawingManagerを再度描画モードに戻す
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    }
  };

  // 面積を読みやすい形式にフォーマット（㎡ / 坪）
  const formatArea = (areaSqm: number): string => {
    const tsubo = areaSqm / 3.30579; // 1坪 = 3.30579㎡
    return `${areaSqm.toFixed(1)} ㎡（約 ${tsubo.toFixed(1)} 坪）`;
  };

  // 航空写真 / 通常地図の切り替え
  const handleToggleSatellite = () => {
    if (!mapRef.current) return;
    const next = !isSatellite;
    setIsSatellite(next);
    mapRef.current.setMapTypeId(
      next ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP
    );
  };

  // 座標を保存
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

      // 3秒後にメッセージを消す
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (error) {
      console.error('🗺️ [PropertyMapSection] Error saving coordinates:', error);
      setSaveMessage({ type: 'error', text: '座標の保存に失敗しました' });
    } finally {
      setIsSaving(false);
    }
  };

  // マーカーのドラッグ終了時
  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      setMapCoordinates({ lat: newLat, lng: newLng });
    }
  };

  if (!sellerNumber || !isMapLoaded || (!isLoadingCoordinates && !mapCoordinates)) {
    return null;
  }

  const googleMapsUrl = mapCoordinates
    ? `https://www.google.com/maps?q=${mapCoordinates.lat},${mapCoordinates.lng}`
    : null;

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', cursor: googleMapsUrl && !isEditMode ? 'pointer' : 'default' }}
          onClick={() => !isEditMode && googleMapsUrl && window.open(googleMapsUrl, '_blank', 'noopener,noreferrer')}
        >
          <Typography variant="h6">
            🗺️ 物件位置
          </Typography>
          {googleMapsUrl && !isEditMode && (
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
              （地図上をクリックして範囲を描画、最初の点をクリックで確定）
            </Typography>
          )}
        </Box>

        {mapCoordinates && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!isEditMode && !isMeasureMode && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditLocationIcon />}
                  onClick={handleEditModeToggle}
                >
                  位置を修正
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="success"
                  startIcon={<SquareFootIcon />}
                  onClick={handleMeasureModeOn}
                >
                  面積を計る
                </Button>
                <Button
                  variant={isSatellite ? 'contained' : 'outlined'}
                  size="small"
                  color="primary"
                  startIcon={isSatellite ? <MapIcon /> : <SatelliteAltIcon />}
                  onClick={handleToggleSatellite}
                >
                  {isSatellite ? '通常地図' : '航空写真'}
                </Button>
              </>
            )}
            {isEditMode && (
              <>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveCoordinates}
                  disabled={isSaving}
                >
                  {isSaving ? '保存中...' : '保存'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CancelIcon />}
                  onClick={handleEditModeToggle}
                  disabled={isSaving}
                >
                  キャンセル
                </Button>
              </>
            )}
            {isMeasureMode && (
              <>
                {measuredArea !== null && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="success"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={handleMeasureClear}
                  >
                    描画をクリア
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CancelIcon />}
                  onClick={handleMeasureModeOff}
                >
                  計測を終了
                </Button>
              </>
            )}
          </Box>
        )}
      </Box>

      {saveMessage && (
        <Alert severity={saveMessage.type} sx={{ mb: 2 }}>
          {saveMessage.text}
        </Alert>
      )}

      {/* 面積計測結果の表示 */}
      {isMeasureMode && measuredArea !== null && (
        <Alert
          severity="success"
          icon={<SquareFootIcon />}
          sx={{ mb: 2 }}
        >
          <Typography variant="body2" fontWeight="bold">
            計測面積: {formatArea(measuredArea)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ※ 頂点をドラッグして範囲を調整できます
          </Typography>
        </Alert>
      )}

      {isMeasureMode && measuredArea === null && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            地図上をクリックして計測したい範囲の頂点を打ち、最初の点をクリックして確定してください
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
              
              // マーカーを作成
              const marker = new google.maps.Marker({
                position: { lat: mapCoordinates.lat, lng: mapCoordinates.lng },
                map: map,
                title: propertyAddress,
                draggable: false, // 初期状態はドラッグ不可
              });

              markerRef.current = marker;

              // ドラッグ終了時のイベントリスナー
              marker.addListener('dragend', handleMarkerDragEnd);
              
              console.log('🗺️ [PropertyMapSection] Map and marker loaded');
            }}
          >
          </GoogleMap>

          {isEditMode && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                bgcolor: 'rgba(255, 255, 255, 0.95)',
                px: 2,
                py: 1,
                borderRadius: 1,
                boxShadow: 2,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                緯度: {mapCoordinates.lat.toFixed(7)}, 経度: {mapCoordinates.lng.toFixed(7)}
              </Typography>
            </Box>
          )}

          {isMeasureMode && measuredArea !== null && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                bgcolor: 'rgba(255, 255, 255, 0.97)',
                px: 2,
                py: 1,
                borderRadius: 1,
                boxShadow: 2,
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
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
