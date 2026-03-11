import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Button, Container } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import NearbyBuyersList from '../components/NearbyBuyersList';

const NearbyBuyersPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [buyerCount, setBuyerCount] = useState<number | null>(null);

  if (!id) {
    return <Typography>売主IDが指定されていません</Typography>;
  }

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => {
            // window.openで開いた場合はclose、それ以外はhistory.back
            if (window.opener) {
              window.close();
            } else {
              window.history.back();
            }
          }}
          variant="outlined"
          size="small"
        >
          戻る
        </Button>
        <Typography variant="h6" fontWeight="bold">
          近隣買主候補
          {buyerCount !== null && (
            <Typography component="span" variant="body1" color="text.secondary" sx={{ ml: 1 }}>
              ({buyerCount}件)
            </Typography>
          )}
        </Typography>
      </Box>
      <NearbyBuyersList sellerId={id} onCountChange={setBuyerCount} />
    </Container>
  );
};

export default NearbyBuyersPage;
