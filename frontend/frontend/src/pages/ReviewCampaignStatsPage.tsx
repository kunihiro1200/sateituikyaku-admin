import { Container, Box, Typography } from '@mui/material';
import PageNavigation from '../components/PageNavigation';
import ReviewCampaignStats from '../components/ReviewCampaignStats';
import { SECTION_COLORS } from '../theme/sectionColors';

export default function ReviewCampaignStatsPage() {
  const sharedItemsColor = SECTION_COLORS.sharedItems;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ color: sharedItemsColor.main }}>
          口コミ・キャンペーン集計
        </Typography>
      </Box>

      {/* ページナビゲーション */}
      <PageNavigation />

      <Box sx={{ mt: 2 }}>
        <ReviewCampaignStats />
      </Box>
    </Container>
  );
}
