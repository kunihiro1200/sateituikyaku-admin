import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Grid,
  Link as MuiLink,
} from '@mui/material';

export interface BuyerDuplicateMatch {
  buyerId: string;
  matchType: 'phone' | 'email' | 'both';
  relationType: 'multiple_inquiry' | 'possible_duplicate';
  buyerInfo: {
    buyerNumber?: string;
    name?: string;
    receptionDate?: string | Date;
    propertyNumber?: string | null;
    propertyAddress?: string | null;
    latestStatus?: string | null;
    assignee?: string | null;
  };
}

interface BuyerDuplicateCardProps {
  duplicate: BuyerDuplicateMatch;
}

const BuyerDuplicateCard: React.FC<BuyerDuplicateCardProps> = ({ duplicate }) => {
  const { buyerInfo } = duplicate;

  const getMatchTypeLabel = (matchType: string) => {
    switch (matchType) {
      case 'phone': return '電話番号';
      case 'email': return 'メールアドレス';
      case 'both': return '電話番号・メールアドレス';
      default: return matchType;
    }
  };

  const getMatchTypeColor = (matchType: string): 'error' | 'warning' | 'info' | 'default' => {
    switch (matchType) {
      case 'both': return 'error';
      case 'phone': return 'warning';
      case 'email': return 'info';
      default: return 'default';
    }
  };

  const getRelationLabel = (relationType: string) =>
    relationType === 'possible_duplicate' ? '重複の可能性（同じ物件）' : '複数問合せ（別物件）';

  const getRelationColor = (relationType: string): 'error' | 'info' =>
    relationType === 'possible_duplicate' ? 'error' : 'info';

  const formatDate = (dateStr?: string | Date): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        {/* ヘッダー：買主番号リンク + マッチタイプ */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            <MuiLink
              href={`/buyers/${buyerInfo.buyerNumber || duplicate.buyerId}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textDecoration: 'none', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
            >
              買主{buyerInfo.buyerNumber || duplicate.buyerId}
            </MuiLink>
            {buyerInfo.name && (
              <Typography component="span" variant="body1" sx={{ ml: 1, color: 'text.secondary' }}>
                {buyerInfo.name}
              </Typography>
            )}
          </Typography>
          <Box display="flex" gap={1}>
            <Chip
              label={getMatchTypeLabel(duplicate.matchType)}
              color={getMatchTypeColor(duplicate.matchType)}
              size="small"
            />
            <Chip
              label={getRelationLabel(duplicate.relationType)}
              color={getRelationColor(duplicate.relationType)}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>

        {/* 基本情報グリッド */}
        <Grid container spacing={1} mb={1}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">受付日</Typography>
            <Typography variant="body2">{formatDate(buyerInfo.receptionDate)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">担当</Typography>
            <Typography variant="body2">{buyerInfo.assignee || '-'}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">物件番号</Typography>
            <Typography variant="body2">{buyerInfo.propertyNumber || '-'}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">最新状況</Typography>
            <Typography variant="body2">{buyerInfo.latestStatus || '-'}</Typography>
          </Grid>
        </Grid>

        {/* 前回どの物件に問い合わせたか */}
        {buyerInfo.propertyAddress && (
          <Box mb={0.5}>
            <Typography variant="caption" color="text.secondary">問合せ物件</Typography>
            <Typography variant="body2">{buyerInfo.propertyAddress}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default BuyerDuplicateCard;
