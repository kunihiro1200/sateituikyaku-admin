import { Box, Typography } from '@mui/material';

/**
 * 売却サポートページのトップヘッダー。
 * 「専門的な不動産業者向け画面」ではなく「自分の不動産の売却専用ページ」という
 * シンプルで安心感のある見た目にする。
 */
export default function SellerPortalHeader({ sellerNumber }: { sellerNumber: string }) {
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
        くじら不動産 売却サポート
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.6 }}>
        管理番号: {sellerNumber}
      </Typography>
    </Box>
  );
}
