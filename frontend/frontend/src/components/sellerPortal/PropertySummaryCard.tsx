import { Paper, Typography, Box } from '@mui/material';
import { PropertySummary } from '../../services/sellerPortalApi';

/**
 * 査定額カードの上に表示する物件概要（売主名・種別・住所・面積）。
 * 面積は当社調べ（_verified）があれば優先して表示する（バックエンド側で優先順位を解決済み）。
 */
export default function PropertySummaryCard({ summary }: { summary: PropertySummary }) {
  return (
    <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#fff' }} elevation={0} variant="outlined">
      {summary.ownerName && (
        <Typography variant="subtitle1" fontWeight="bold">
          {summary.ownerName}
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary">
        {summary.propertyTypeLabel}
        {summary.address ? ` ・ ${summary.address}` : ''}
      </Typography>
      {(summary.landArea || summary.buildingArea) && (
        <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
          {summary.landArea && (
            <Typography variant="caption" color="text.secondary">
              土地面積: {summary.landArea}㎡
            </Typography>
          )}
          {summary.buildingArea && (
            <Typography variant="caption" color="text.secondary">
              {summary.propertyTypeLabel === 'マンション' ? '専有面積' : '建物面積'}: {summary.buildingArea}㎡
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
}
