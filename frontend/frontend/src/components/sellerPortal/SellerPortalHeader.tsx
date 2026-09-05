import { Box, Typography } from '@mui/material';

/**
 * 売却サポートページのトップヘッダー。
 * 売主番号がFIで始まる場合は「くじら不動産」、それ以外は「株式会社いふう」を表示する。
 */
export default function SellerPortalHeader({ sellerNumber }: { sellerNumber: string }) {
  const isFi = sellerNumber.toUpperCase().startsWith('FI');
  const companyName = isFi ? 'くじら不動産' : '株式会社いふう';

  return (
    <Box
      sx={{
        bgcolor: '#0B2545',
        color: 'white',
        px: 2,
        py: 2.5,
        textAlign: 'center',
      }}
    >
      <Typography variant="subtitle2" sx={{ opacity: 0.8, fontSize: '0.75rem' }}>
        {companyName} 売却サポート
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.6 }}>
        管理番号: {sellerNumber}
      </Typography>
    </Box>
  );
}
