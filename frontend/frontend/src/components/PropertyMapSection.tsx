import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';

/**
 * 物件位置を地図上に表示するコンポーネント
 * 
 * 機能:
 * - データベースから物件の座標を取得
 * - Google Mapsで物件位置を表示
 * - 物件位置にピンを表示
 * 
 * 使用場所:
 * - 通話モードページ（CallModePage）
 * 
 * @param sellerNumber - 売主番号（座標を取得するために使用）
 * @param propertyAddress - 物件住所（地図のタイトルに使用）
 */
interface PropertyMapSectionProps {
  sellerNumber: string;
  propertyAddress: string | undefined;
}

// 地図コンテナのスタイル設定
const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

// デフォルトのズームレベル（15 = 街区レベル）
const DEFAULT_ZOOM = 15;

/**
 * PropertyMapSectionコンポーネント
 * 
 * 処理フロー:
 * 1. sellerNumberが変更されたら、バックエンドAPIから座標を取得
 * 2. 座標を取得したら、地図を表示
 * 3. 地図上に物件位置のピンを表示
 * 
 * エラーハンドリング:
 * - 売主番号が未設定の場合: 地図を表示しない
 * - 座標が未設定の場合: 地図を表示しない
 * - Google Maps API読み込み失敗の場合: 地図を表示しない
 */
const PropertyMapSection: React.FC<PropertyMapSectionProps> = ({ sellerNumber, propertyAddress }) => {
  const { isLoaded: isMapLoaded } = useGoogleMaps();
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingCoordinates, setIsLoadingCoordinates] = useState(false);

  /**
   * 売主番号が変更されたら、バックエンドAPIから座標を取得
   * 
   * 処理:
   * 1. 売主番号が未設定の場合は、座標をnullに設定
   * 2. バックエンドのAPIエンドポイントを呼び出す（売主番号で検索）
   * 3. 座標を取得したら、stateに保存
   * 4. 座標がない場合は、ブラウザから直接Geocoding APIを呼び出す
   * 5. 取得した座標をバックエンドに保存（次回から高速化）
   */
  useEffect(() => {
    if (!sellerNumber) {
      setMapCoordinates(null);
      return;
    }

    const fetchCoordinates = async () => {
      setIsLoadingCoordinates(true);
      try {
        console.log('🗺️ [PropertyMapSection] Fetching coordinates for seller:', sellerNumber);
        
        // バックエンドのAPIエンドポイントを呼び出す（売主番号で検索）
        const response = await api.get(`/api/sellers/by-number/${sellerNumber}`);
        
        if (response.status === 200) {
          const data = response.data;
          
          if (data.latitude && data.longitude) {
            // データベースに座標がある場合はそれを使用
            console.log('🗺️ [PropertyMapSection] Coordinates fetched from database:', { lat: data.latitude, lng: data.longitude });
            setMapCoordinates({ lat: data.latitude, lng: data.longitude });
          } else if (data.propertyAddress) {
            // 座標がない場合は、ブラウザから直接Geocoding APIを呼び出す
            console.log('🗺️ [PropertyMapSection] No coordinates in database, fetching from Geocoding API:', data.propertyAddress);
            
            const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (!GOOGLE_MAPS_API_KEY) {
              console.error('🗺️ [PropertyMapSection] Google Maps APIキーが設定されていません');
              setMapCoordinates(null);
              return;
            }

            // Geocoding APIで座標を取得
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(data.propertyAddress)}&key=${GOOGLE_MAPS_API_KEY}`;
            const geocodeResponse = await fetch(geocodeUrl);
            const geocodeData = await geocodeResponse.json();

            if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
              const location = geocodeData.results[0].geometry.location;
              console.log('🗺️ [PropertyMapSection] Coordinates fetched from Geocoding API:', location);
              
              setMapCoordinates({
                lat: location.lat,
                lng: location.lng,
              });

              // バックエンドに座標を保存（次回から高速化）
              try {
                await api.patch(`/api/sellers/${data.id}/coordinates`, {
                  latitude: location.lat,
                  longitude: location.lng,
                });
                console.log('🗺️ [PropertyMapSection] Coordinates saved to database');
              } catch (saveError) {
                console.warn('🗺️ [PropertyMapSection] Failed to save coordinates (display not affected):', saveError);
              }
            } else {
              console.warn('🗺️ [PropertyMapSection] Geocoding API failed:', geocodeData.status);
              setMapCoordinates(null);
            }
          } else {
            console.warn('🗺️ [PropertyMapSection] No property address found for seller:', sellerNumber);
            setMapCoordinates(null);
          }
        } else {
          console.warn('🗺️ [PropertyMapSection] Failed to fetch seller data:', response.status);
          setMapCoordinates(null);
        }
      } catch (error) {
        console.error('🗺️ [PropertyMapSection] Error fetching coordinates:', error);
        setMapCoordinates(null);
      } finally {
        setIsLoadingCoordinates(false);
      }
    };

    fetchCoordinates();
  }, [sellerNumber]);

  /**
   * 地図を表示しない条件:
   * 1. 売主番号が未設定
   * 2. Google Maps APIが読み込まれていない
   * 3. 座標の読み込み中ではなく、かつ座標が取得できていない
   * 
   * これらの条件に該当する場合は、nullを返して地図を表示しない
   */
  if (!sellerNumber || !isMapLoaded || (!isLoadingCoordinates && !mapCoordinates)) {
    return null;
  }

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      {/* 地図セクションのヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          🗺️ 物件位置
        </Typography>
      </Box>
      
      {/* ローディングインジケーター */}
      {isLoadingCoordinates && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}
      
      {/* 地図表示 */}
      {!isLoadingCoordinates && mapCoordinates && (
        <Box sx={{ borderRadius: '8px', overflow: 'hidden' }}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCoordinates}
            zoom={DEFAULT_ZOOM}
            options={{
              zoomControl: true,           // ズームコントロールを表示
              streetViewControl: true,     // ストリートビューコントロールを表示
              mapTypeControl: false,       // 地図タイプコントロールを非表示
              fullscreenControl: true,     // フルスクリーンコントロールを表示
              clickableIcons: false,       // アイコンをクリック不可に設定
            }}
            onLoad={(map) => {
              console.log('🗺️ [PropertyMapSection] Map loaded');
              
              // 直接Google Maps APIを使用してマーカーを追加
              // （公開物件サイトと同じ実装）
              new google.maps.Marker({
                position: { lat: mapCoordinates.lat, lng: mapCoordinates.lng },
                map: map,
                title: propertyAddress,
              });
              
              console.log('🗺️ [PropertyMapSection] Marker created');
            }}
          >
            {/* マーカーは onLoad で直接追加 */}
          </GoogleMap>
        </Box>
      )}
    </Paper>
  );
};

export default PropertyMapSection;
