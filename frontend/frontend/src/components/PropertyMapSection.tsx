import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Box, Paper, Typography, CircularProgress, Button, Alert } from '@mui/material';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';
import EditLocationIcon from '@mui/icons-material/EditLocation';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

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
  const markerRef = useRef<google.maps.Marker | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

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
    setIsEditMode(!isEditMode);
    setSaveMessage(null);
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
        </Box>

        {mapCoordinates && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!isEditMode ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditLocationIcon />}
                onClick={handleEditModeToggle}
              >
                位置を修正
              </Button>
            ) : (
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
          </Box>
        )}
      </Box>

      {saveMessage && (
        <Alert severity={saveMessage.type} sx={{ mb: 2 }}>
          {saveMessage.text}
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
        </Box>
      )}
    </Paper>
  );
};

export default PropertyMapSection;
