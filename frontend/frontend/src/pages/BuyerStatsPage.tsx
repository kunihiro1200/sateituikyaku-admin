import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import PageNavigation from '../components/PageNavigation';
import { SECTION_COLORS } from '../theme/sectionColors';
import BuyerStatsSection from '../components/BuyerStatsSection';
import type { BuyerStatsData } from '../components/BuyerStatsSection';
import api from '../services/api';

/**
 * 事務会議用の買主統計ページ。
 * 買主リストのサイドバーと同じ3統計（持家ヒアリング統計 / 買付統計 / 内覧統計）を、
 * 共有ページの事務会議から確認できるようにする。
 * データは買主リストと同じ /api/buyers/sidebar-counts を利用する。
 */
export default function BuyerStatsPage() {
  const sharedItemsColor = SECTION_COLORS.sharedItems;
  const [stats, setStats] = useState<BuyerStatsData | null>(null);
  const [normalStaffInitials, setNormalStaffInitials] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/buyers/sidebar-counts');
      const data = res.data || {};
      // レスポンスは { categoryCounts, normalStaffInitials, ... } 形式
      const categoryCounts = data.categoryCounts ?? data;
      setStats(categoryCounts as BuyerStatsData);
      setNormalStaffInitials(data.normalStaffInitials || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || '統計の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const hasAnyStats =
    stats &&
    (Object.keys(stats.homeHearingMonthlyStats || {}).length > 0 ||
      Object.keys(stats.purchaseMonthlyStats || {}).length > 0 ||
      Object.keys(stats.viewingMonthlyStats || {}).length > 0);

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight="bold" sx={{ color: sharedItemsColor.main }}>
          買主統計（持家ヒアリング・買付・内覧）
        </Typography>
        <Tooltip title="再読み込み">
          <IconButton onClick={fetchStats} size="small" disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <PageNavigation />

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
        買主リストと同じ統計です。各項目をクリックすると月別・担当別の内訳を展開できます。
      </Typography>

      <Box sx={{ mt: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !hasAnyStats ? (
          <Alert severity="info">統計データがありません。</Alert>
        ) : (
          <Paper sx={{ p: 1 }}>
            <BuyerStatsSection categoryCounts={stats} normalStaffInitials={normalStaffInitials} />
          </Paper>
        )}
      </Box>
    </Container>
  );
}
