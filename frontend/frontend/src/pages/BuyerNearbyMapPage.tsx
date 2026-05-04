import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Map as MapIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import NearbyMapModal from '../components/NearbyMapModal';
import PageNavigation from '../components/PageNavigation';
import { SECTION_COLORS } from '../theme/sectionColors';

export default function BuyerNearbyMapPage() {
  const navigate = useNavigate();
  const [googleMapUrl, setGoogleMapUrl] = useState('');
  const [submittedUrl, setSubmittedUrl] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSubmit = () => {
    if (!googleMapUrl.trim()) return;
    setSubmittedUrl(googleMapUrl.trim());
    setModalOpen(true);
  };

  const handleClear = () => {
    setGoogleMapUrl('');
    setSubmittedUrl(null);
    setModalOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ナビゲーションバー */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 200,
          bgcolor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexShrink: 0,
        }}
      >
        <PageNavigation />
      </Box>

      <Box sx={{ py: 3, px: 3, maxWidth: 800, mx: 'auto', width: '100%' }}>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton onClick={() => navigate('/buyers')} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h5"
            fontWeight="bold"
            sx={{ color: SECTION_COLORS.buyer.main, display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <MapIcon />
            何でも近隣MAP
          </Typography>
        </Box>

        {/* 説明 */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Google Map の URL を入力すると、その地点の近隣施設（スーパー・学校・病院・駅など）を地図上に表示します。
          表示後は PDF で印刷することもできます。
        </Typography>

        {/* URL入力フォーム */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            Google Map URL を入力
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="https://maps.google.com/... または https://goo.gl/maps/..."
              value={googleMapUrl}
              onChange={(e) => setGoogleMapUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MapIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: googleMapUrl ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleClear}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!googleMapUrl.trim()}
              startIcon={<span style={{ fontSize: '1.1em' }}>🗺️</span>}
              sx={{
                whiteSpace: 'nowrap',
                background: 'linear-gradient(135deg, #0277bd 0%, #01579b 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #01579b 0%, #003c6e 100%)',
                },
              }}
            >
              近隣MAPを表示
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            ※ Google Maps の共有URLや短縮URL（goo.gl）に対応しています
          </Typography>
        </Paper>
      </Box>

      {/* 近隣MAPモーダル */}
      {submittedUrl && (
        <NearbyMapModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          googleMapUrl={submittedUrl}
          address=""
        />
      )}
    </Box>
  );
}
