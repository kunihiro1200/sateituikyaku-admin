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

interface MonthlyStatistics {
  month: string;
  total: {
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  };
  assignees: Array<{
    followUpAssignee: string;
    viewingCount: number;
    purchaseCount: number;
    purchaseRate: number | null;
  }>;
}

const BuyerPurchaseRateStatisticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState<MonthlyStatistics[]>([]);
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
        <Typography variant="h6">データがありません（集計対象期間: 2026年1月以降）</Typography>
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
        <Typography variant="h4">買付率統計</Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          戻る
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        集計対象期間: 2026年1月以降
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>年月</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">内覧件数</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">買付件数</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">買付率（%）</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {statistics.map((monthData, monthIndex) => (
              <React.Fragment key={monthIndex}>
                {/* 月の合計行 */}
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{monthData.month} 計</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{monthData.total.viewingCount}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{monthData.total.purchaseCount}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {monthData.total.purchaseRate !== null ? `${monthData.total.purchaseRate}%` : '-'}
                  </TableCell>
                </TableRow>
                {/* 担当者ごとの行（インデント） */}
                {monthData.assignees.map((assignee, assigneeIndex) => (
                  <TableRow key={`${monthIndex}-${assigneeIndex}`} hover>
                    <TableCell sx={{ pl: 4 }}>{assignee.followUpAssignee}</TableCell>
                    <TableCell align="right">{assignee.viewingCount}</TableCell>
                    <TableCell align="right">{assignee.purchaseCount}</TableCell>
                    <TableCell align="right">
                      {assignee.purchaseRate !== null ? `${assignee.purchaseRate}%` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default BuyerPurchaseRateStatisticsPage;
