import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';

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
  const [isLoadingCoordinates, setIsLoadingCoordinates] = useState(false);

  useEffect(() => {
    if (!sellerNumber) {
      setMapCoordinates(null);
      return;
    }

    const fetchCoordinates = async () => {
      setIsLoadingCoordinates(true);
      try {
        // バックエンドから座標を取得（ジオコーディングもバックエンド側で実施）
        const response = await api.get(`/api/sellers/by-number/${sellerNumber}`);
        const data = response.data;

        if (data.latitude && data.longitude) {
          setMapCoordinates({ lat: data.latitude, lng: data.longitude });
        } else {
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

  if (!sellerNumber || !isMapLoaded || (!isLoadingCoordinates && !mapCoordinates)) {
    return null;
  }

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          🗺️ 物件位置
        </Typography>
      </Box>

      {isLoadingCoordinates && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoadingCoordinates && mapCoordinates && (
        <Box sx={{ borderRadius: '8px', overflow: 'hidden' }}>
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
              new google.maps.Marker({
                position: { lat: mapCoordinates.lat, lng: mapCoordinates.lng },
                map: map,
                title: propertyAddress,
              });
            }}
          >
          </GoogleMap>
        </Box>
      )}
    </Paper>
  );
};

export default PropertyMapSection;
