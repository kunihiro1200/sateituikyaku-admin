import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import api from '../services/api';

interface StatsData {
  campaign_count: number;
  review_points: number;
}

interface ReviewCampaignStatsResponse {
  period_start: string;
  assignees: string[];
  goal_per_person: number;
  monthly_goal: number;
  elapsed_months: number;
  current_month_target: number;
  stats: Record<string, StatsData>;
}

/**
 * 口コミ・キャンペーン集計テーブル
 * 共有ページに常に表示される
 */
export default function ReviewCampaignStats() {
  const [data, setData] = useState<ReviewCampaignStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/work-tasks/review-campaign-stats');
        setData(res.data);
      } catch (err: any) {
        console.error('口コミ集計取得エラー:', err);
        setError('集計データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error || !data) {
    return null;
  }

  const { assignees, goal_per_person, monthly_goal, elapsed_months, current_month_target, stats } = data;

  // 合計計算
  const totalCampaign = assignees.reduce((sum, a) => sum + stats[a].campaign_count, 0);
  const totalReview = assignees.reduce((sum, a) => sum + stats[a].review_points, 0);
  const totalGoal = goal_per_person * assignees.length;

  // 達成率計算
  const getAchievementRate = (points: number, goal: number) => {
    if (goal === 0) return '0.00%';
    return ((points / goal) * 100).toFixed(2) + '%';
  };

  // 月末時点達成率計算
  const getMonthlyRate = (points: number, target: number) => {
    if (target === 0) return '0.00%';
    return ((points / target) * 100).toFixed(2) + '%';
  };

  // 達成率の色分け
  const getRateColor = (points: number, target: number) => {
    if (target === 0) return 'inherit';
    const rate = points / target;
    if (rate >= 1) return '#4caf50'; // 100%以上 = 緑
    if (rate >= 0.5) return '#ff9800'; // 50%以上 = オレンジ
    return '#f44336'; // 50%未満 = 赤
  };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
        口コミ・キャンペーン集計（2025/10/1〜）
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#e8f5e9' }}>
              <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                取得件数（2025/10/1〜集計）
              </TableCell>
              {assignees.map((a) => (
                <TableCell key={a} align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  {a}
                </TableCell>
              ))}
              <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                計
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* 新紹介者キャンペーン */}
            <TableRow>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                新紹介者キャンペーン（3000万円以上10万円）
              </TableCell>
              {assignees.map((a) => (
                <TableCell key={a} align="center">
                  {stats[a].campaign_count}
                </TableCell>
              ))}
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                {totalCampaign}
              </TableCell>
            </TableRow>

            {/* 口コミ登録合計 */}
            <TableRow>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                口コミ登録合計（口コミ=2pt、アンケート用紙=1pt）
              </TableCell>
              {assignees.map((a) => (
                <TableCell key={a} align="center">
                  {stats[a].review_points}
                </TableCell>
              ))}
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                {totalReview}
              </TableCell>
            </TableRow>

            {/* 口コミ目標 */}
            <TableRow sx={{ bgcolor: '#fff9c4' }}>
              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                口コミ目標
              </TableCell>
              {assignees.map((a) => (
                <TableCell key={a} align="center">
                  {goal_per_person}
                </TableCell>
              ))}
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                {totalGoal}
              </TableCell>
            </TableRow>

            {/* 口コミ達成率 */}
            <TableRow sx={{ bgcolor: '#fce4ec' }}>
              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                口コミ達成率
              </TableCell>
              {assignees.map((a) => (
                <TableCell key={a} align="center">
                  {getAchievementRate(stats[a].review_points, goal_per_person)}
                </TableCell>
              ))}
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                {getAchievementRate(totalReview, totalGoal)}
              </TableCell>
            </TableRow>

            {/* 月末時点の達成率 */}
            <TableRow sx={{ bgcolor: '#e8f5e9' }}>
              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                {currentMonth}月末時点の達成率/　月{monthly_goal}pt 計{current_month_target}pt
              </TableCell>
              {assignees.map((a) => (
                <TableCell
                  key={a}
                  align="center"
                  sx={{
                    fontWeight: 'bold',
                    color: getRateColor(stats[a].review_points, current_month_target),
                  }}
                >
                  {getMonthlyRate(stats[a].review_points, current_month_target)}
                </TableCell>
              ))}
              <TableCell align="center" />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
