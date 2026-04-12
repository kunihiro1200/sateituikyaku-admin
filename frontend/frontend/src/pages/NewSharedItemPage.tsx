import { useNavigate } from 'react-router-dom';
import { Container, Box, Typography, Button } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import NewSharedItemForm from '../components/NewSharedItemForm';
import { SECTION_COLORS } from '../theme/sectionColors';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';

export default function NewSharedItemPage() {
  const navigate = useNavigate();
  const color = SECTION_COLORS.sharedItems;

  const handleSaved = () => {
    // キャッシュをクリアして一覧を最新化
    pageDataCache.invalidate(CACHE_KEYS.SHARED_ITEMS);
    navigate('/shared-items');
  };

  const handleCancel = () => {
    navigate('/shared-items');
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleCancel}
          sx={{ color: color.main }}
        >
          戻る
        </Button>
        <Typography variant="h5" fontWeight="bold" sx={{ color: color.main }}>
          共有 新規作成
        </Typography>
      </Box>

      <NewSharedItemForm onSaved={handleSaved} onCancel={handleCancel} />
    </Container>
  );
}
