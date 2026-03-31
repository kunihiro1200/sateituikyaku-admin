import { Box, Typography, Paper } from '@mui/material';

interface PropertyHeaderInfoProps {
  address: string | null;
  salesPrice: number | null;
  salesAssignee: string | null;
}

/**
 * 物件ヘッダー情報コンポーネント
 * 
 * レインズ登録ページのヘッダーに物件の基本情報を表示します。
 * - 物件所在地
 * - 売買価格（万円単位、カンマ区切り）
 * - 営業担当
 * 
 * 空欄時のフォールバック表示：
 * - 物件所在地が空欄 → 「未入力」
 * - 売買価格が空欄 → 「価格応談」
 * - 営業担当が空欄 → 「未設定」
 */
export default function PropertyHeaderInfo({
  address,
  salesPrice,
  salesAssignee,
}: PropertyHeaderInfoProps) {
  // 売買価格を万円単位でカンマ区切りにフォーマット
  const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) {
      return '価格応談';
    }
    // 円単位から万円単位に変換してカンマ区切り
    const manYen = Math.round(price / 10000);
    return `${manYen.toLocaleString()}万円`;
  };

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        backgroundColor: '#f5f5f5',
        border: '1px solid #e0e0e0',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1.5, sm: 3 },
          flexWrap: 'wrap',
        }}
      >
        {/* 物件所在地 */}
        <Box sx={{ flex: { xs: '1 1 100%', sm: '2 1 200px' } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight="bold"
            sx={{ display: 'block', mb: 0.5 }}
          >
            物件所在地
          </Typography>
          <Typography variant="body2" color={address ? 'text.primary' : 'text.disabled'}>
            {address || '未入力'}
          </Typography>
        </Box>

        {/* 売買価格 */}
        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 120px' } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight="bold"
            sx={{ display: 'block', mb: 0.5 }}
          >
            売買価格
          </Typography>
          <Typography
            variant="body2"
            color={salesPrice ? 'text.primary' : 'text.disabled'}
            fontWeight={salesPrice ? 'bold' : 'normal'}
          >
            {formatPrice(salesPrice)}
          </Typography>
        </Box>

        {/* 営業担当 */}
        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 100px' } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight="bold"
            sx={{ display: 'block', mb: 0.5 }}
          >
            営業担当
          </Typography>
          <Typography variant="body2" color={salesAssignee ? 'text.primary' : 'text.disabled'}>
            {salesAssignee || '未設定'}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
