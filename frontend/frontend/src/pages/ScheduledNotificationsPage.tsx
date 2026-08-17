import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ScheduleIcon from '@mui/icons-material/Schedule';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface NotificationItem {
  id: number;
  schedule: string;
  subject: string;
  body: string;
  type: string;
}

function getTypeColor(type: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' {
  if (type.startsWith('weekly')) return 'info';
  if (type.startsWith('monthly')) return 'primary';
  if (type.startsWith('yearly')) return 'secondary';
  if (type === 'one_time') return 'error';
  return 'default';
}

export default function ScheduledNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('auth_token') || '';
        const res = await fetch(`${API_URL}/api/scheduled-notifications/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setNotifications(data.notifications || []);
        setRecipients(data.recipients || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">データ取得エラー: {error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3} maxWidth="1200px" mx="auto">
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <EmailIcon color="primary" />
        <Typography variant="h5" fontWeight="bold">
          定期メール通知スケジュール
        </Typography>
        <Chip label={`${notifications.length}件`} size="small" color="primary" />
      </Box>

      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
        <Typography variant="body2" color="text.secondary">
          <ScheduleIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
          毎日 午前9時(JST) に自動チェックされ、該当日のメールが送信されます。
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          送信先: {recipients.join(', ')}
        </Typography>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#e3f2fd' }}>
              <TableCell sx={{ fontWeight: 'bold', width: 40 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 180 }}>頻度</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>件名</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>本文（プレビュー）</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notifications.map((n) => (
              <TableRow key={n.id} hover>
                <TableCell>{n.id}</TableCell>
                <TableCell>
                  <Chip
                    label={n.schedule}
                    size="small"
                    color={getTypeColor(n.type)}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{n.subject}</TableCell>
                <TableCell sx={{ color: '#666', fontSize: '0.85rem', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.body.replace(/\\n/g, ' ').substring(0, 80)}...
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
