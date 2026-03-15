import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  Alert,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';

interface ReportData {
  report_date?: string;
  report_completed?: string;
  report_assignee?: string;
  sales_assignee?: string;
}

export default function PropertyReportPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();

  const [reportData, setReportData] = useState<ReportData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jimuInitials, setJimuInitials] = useState<string[]>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
    }
  }, [propertyNumber]);

  const fetchData = async () => {
    if (!propertyNumber) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      const d = response.data;
      setReportData({
        report_date: d.report_date || '',
        report_completed: d.report_completed || 'N',
        // report_assignee: デフォルトは sales_assignee
        report_assignee: d.report_assignee || d.sales_assignee || '',
        sales_assignee: d.sales_assignee || '',
      });
    } catch (error) {
      console.error('Failed to fetch property data:', error);
      setSnackbar({ open: true, message: '物件データの取得に失敗しました', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchJimuInitials = async () => {
    try {
      const response = await api.get('/api/employees/jimu-initials');
      setJimuInitials(response.data.initials || []);
    } catch (error) {
      console.error('Failed to fetch jimu initials:', error);
      // フォールバック: active-initials を使用
      try {
        const fallback = await api.get('/api/employees/active-initials');
        setJimuInitials(fallback.data.initials || []);
      } catch {
        setJimuInitials([]);
      }
    }
  };

  const handleSave = async () => {
    if (!propertyNumber) return;
    setSaving(true);
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, {
        report_date: reportData.report_date || null,
        report_completed: reportData.report_completed || 'N',
        report_assignee: reportData.report_assignee || null,
      });
      setSnackbar({ open: true, message: '報告情報を保存しました', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate(`/property-listings/${propertyNumber}`);
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={handleBack} size="large">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
          報告 - {propertyNumber}
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        {/* 報告日 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
            報告日
          </Typography>
          <TextField
            type="date"
            fullWidth
            size="small"
            value={reportData.report_date || ''}
            onChange={(e) => setReportData((prev) => ({ ...prev, report_date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        {/* 報告完了 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
            報告完了
          </Typography>
          <ToggleButtonGroup
            value={reportData.report_completed || 'N'}
            exclusive
            onChange={(_, value) => {
              if (value !== null) {
                setReportData((prev) => ({ ...prev, report_completed: value }));
              }
            }}
            size="small"
          >
            <ToggleButton value="N" sx={{ px: 3 }}>
              N
            </ToggleButton>
            <ToggleButton value="Y" sx={{ px: 3 }}>
              Y
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* 報告担当 */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
            報告担当
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={reportData.report_assignee || ''}
              onChange={(e) => setReportData((prev) => ({ ...prev, report_assignee: e.target.value }))}
              displayEmpty
            >
              <MenuItem value="">
                <em>未選択</em>
              </MenuItem>
              {jimuInitials.map((initial) => (
                <MenuItem key={initial} value={initial}>
                  {initial}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {reportData.sales_assignee && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              物件担当: {reportData.sales_assignee}
            </Typography>
          )}
        </Box>

        {/* 保存ボタン */}
        <Button
          variant="contained"
          fullWidth
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            backgroundColor: SECTION_COLORS.property.main,
            '&:hover': { backgroundColor: SECTION_COLORS.property.dark },
          }}
        >
          {saving ? '保存中...' : '保存'}
        </Button>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
