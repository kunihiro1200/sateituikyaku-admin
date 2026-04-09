import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { buyerApi } from '../services/api';

interface PurchaseRateStatistic {
  month: string;
  followUpAssignee: string;
  purchaseCount: number;
  viewingCount: number;
  purchaseRate: number | null;
}

const BuyerPurchaseRateStatisticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState<PurchaseRateStatistic[]>([]);
  const [total, setTotal] = useState<{
    purchaseCount: number;
    viewingCount: number;
    purchaseRate: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await buyerApi.getPurchaseRateStatistics();
      setStatistics(response.statistics);
      setTotal(response.total);
    } catch (err: any) {
      console.error('Failed to fetch purchase rate statistics:', err);
      setError(err.message || '統計データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error" variant="h6">
          エラー: {error}
        </Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mt: 2 }}
        >
          戻る
        </Button>
      </Box>
    );
  }

  if (statistics.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">データがありません</Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mt: 2 }}
        >
          戻る
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">買付率統計（2026年1月以降）</Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          戻る
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>月</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>後続担当</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">買付数</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">内覧数</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">買付率（%）</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {statistics.map((stat, index) => (
              <TableRow key={index} hover>
                <TableCell>{stat.month}</TableCell>
                <TableCell>{stat.followUpAssignee}</TableCell>
                <TableCell align="right">{stat.purchaseCount}</TableCell>
                <TableCell align="right">{stat.viewingCount}</TableCell>
                <TableCell align="right">
                  {stat.purchaseRate !== null ? `${stat.purchaseRate}%` : '-'}
                </TableCell>
              </TableRow>
            ))}
            {total && (
              <TableRow sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>合計</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{total.purchaseCount}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{total.viewingCount}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {total.purchaseRate !== null ? `${total.purchaseRate}%` : '-'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default BuyerPurchaseRateStatisticsPage;
