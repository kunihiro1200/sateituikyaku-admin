import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Snackbar,
  Alert,
  Typography,
  IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import api from '../services/api';

interface ReinsData {
  reins_certificate_email: string | null;
  cc_assignee: string | null;
  report_date_setting: string | null;
}

const REINS_FIELDS: {
  key: keyof ReinsData;
  label: string;
  options: string[];
}[] = [
  {
    key: 'reins_certificate_email',
    label: 'レインズ証明書メール済み',
    options: ['連絡済み', '未'],
  },
  {
    key: 'cc_assignee',
    label: '担当をCCにいれる',
    options: ['済', '未'],
  },
  {
    key: 'report_date_setting',
    label: '報告日設定',
    options: ['する', 'しない'],
  },
];

export default function ReinsRegistrationPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<ReinsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (propertyNumber) {
      fetchData();
    }
  }, [propertyNumber]);

  const fetchData = async () => {
    if (!propertyNumber) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      const d = response.data;
      setData({
        reins_certificate_email: d.reins_certificate_email ?? null,
        cc_assignee: d.cc_assignee ?? null,
        report_date_setting: d.report_date_setting ?? null,
      });
    } catch (error) {
      setSnackbar({ open: true, message: 'データの取得に失敗しました', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (field: keyof ReinsData, value: string) => {
    if (!propertyNumber || !data) return;
    const prevValue = data[field];
    setData((prev) => prev ? { ...prev, [field]: value } : prev);
    setUpdating(field);
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, { [field]: value });
      setSnackbar({ open: true, message: '保存しました', severity: 'success' });
    } catch (error) {
      setData((prev) => prev ? { ...prev, [field]: prevValue } : prev);
      setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <IconButton onClick={() => navigate(`/property-listings/${propertyNumber}`)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight="bold">
          レインズ登録・サイト入力
        </Typography>
        {propertyNumber && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({propertyNumber})
          </Typography>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* ボタン切り替えフィールド */}
          {REINS_FIELDS.map((field) => (
            <Paper key={field.key} sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1.5 }}>
                {field.label}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {field.options.map((option) => (
                  <Button
                    key={option}
                    variant={data?.[field.key] === option ? 'contained' : 'outlined'}
                    onClick={() => handleUpdate(field.key, option)}
                    disabled={updating === field.key}
                    sx={{ minWidth: 80 }}
                  >
                    {updating === field.key ? <CircularProgress size={16} /> : option}
                  </Button>
                ))}
              </Box>
            </Paper>
          ))}

          {/* レインズURL */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1.5 }}>
              レインズURL
            </Typography>
            <Button
              variant="outlined"
              endIcon={<OpenInNewIcon />}
              onClick={() => window.open('https://system.reins.jp/', '_blank')}
            >
              レインズシステムを開く
            </Button>
          </Paper>

          {/* 戻るボタン */}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="text"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/property-listings/${propertyNumber}`)}
            >
              物件詳細に戻る
            </Button>
          </Box>
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
