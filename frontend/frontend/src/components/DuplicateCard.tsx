import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Grid,
  Divider,
  Link as MuiLink,
} from '@mui/material';
import { DuplicateMatch } from '../types';

interface DuplicateCardProps {
  duplicate: DuplicateMatch;
}

const DuplicateCard: React.FC<DuplicateCardProps> = ({ duplicate }) => {
  const { sellerInfo } = duplicate;

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

  // 円単位 → 万円単位に変換
  const formatValuation = (amount?: number): string => {
    if (!amount) return '';
    return `${Math.round(amount / 10000).toLocaleString()}万円`;
  };

  // 存在する査定額を「/」区切りで結合
  const valuationText = [
    sellerInfo.valuationAmount1,
    sellerInfo.valuationAmount2,
    sellerInfo.valuationAmount3,
  ]
    .filter(Boolean)
    .map(formatValuation)
    .join(' / ');

  // 日付フォーマット（YYYY/MM/DD）
  const formatDate = (dateStr?: string | Date): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        {/* ヘッダー：売主番号リンク + 重複タイプ */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            <MuiLink
              href={`/sellers/${duplicate.sellerId}/call`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textDecoration: 'none', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
            >
              {sellerInfo.sellerNumber || duplicate.sellerId}
            </MuiLink>
          </Typography>
          <Chip
            label={getMatchTypeLabel(duplicate.matchType)}
            color={getMatchTypeColor(duplicate.matchType)}
            size="small"
          />
        </Box>

        {/* 基本情報グリッド */}
        <Grid container spacing={1} mb={1}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">反響日</Typography>
            <Typography variant="body2">{formatDate(sellerInfo.inquiryDate)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">確度</Typography>
            <Typography variant="body2">{sellerInfo.confidenceLevel || '-'}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">状況（当社）</Typography>
            <Typography variant="body2">{sellerInfo.status || '-'}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">次電日</Typography>
            <Typography variant="body2">{formatDate(sellerInfo.nextCallDate)}</Typography>
          </Grid>
        </Grid>

        {/* 物件所在地 */}
        {sellerInfo.propertyAddress && (
          <Box mb={1}>
            <Typography variant="caption" color="text.secondary">物件所在地</Typography>
            <Typography variant="body2">{sellerInfo.propertyAddress}</Typography>
          </Box>
        )}

        {/* 査定額 */}
        {valuationText && (
          <Box mb={1}>
            <Typography variant="caption" color="text.secondary">査定額</Typography>
            <Typography variant="body2">{valuationText}</Typography>
          </Box>
        )}

        {/* コメント */}
        {sellerInfo.comments && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box>
              <Typography variant="caption" color="text.secondary">コメント</Typography>
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 0.5 }}
              >
                {sellerInfo.comments}
              </Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DuplicateCard;
