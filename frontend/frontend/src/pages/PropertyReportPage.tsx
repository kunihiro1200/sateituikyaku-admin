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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';

interface ReportData {
  report_date?: string;
  report_completed?: string;
  report_assignee?: string;
  sales_assignee?: string;
  address?: string;
  owner_name?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export default function PropertyReportPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();

  const [reportData, setReportData] = useState<ReportData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jimuInitials, setJimuInitials] = useState<string[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchTemplates();
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
        report_assignee: d.report_assignee || d.sales_assignee || '',
        sales_assignee: d.sales_assignee || '',
        address: d.address || d.property_address || '',
        owner_name: d.owner_name || '',
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
      try {
        const fallback = await api.get('/api/employees/active-initials');
        setJimuInitials(fallback.data.initials || []);
      } catch {
        setJimuInitials([]);
      }
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/api/email-templates/property');
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to fetch property templates:', error);
      setTemplates([]);
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

  const handleTemplateSelect = async (template: EmailTemplate) => {
    setTemplateDialogOpen(false);
    try {
      // プレースホルダー置換済みの件名・本文を取得
      const mergeResponse = await api.post('/api/email-templates/property/merge', {
        propertyNumber,
        templateId: template.id,
      });
      const { subject: mergedSubject, body: mergedBody } = mergeResponse.data;
      const subject = encodeURIComponent(mergedSubject || template.subject);
      const body = encodeURIComponent(mergedBody || template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
    } catch (error) {
      console.error('Failed to merge template:', error);
      // フォールバック: 置換なしで開く
      const subject = encodeURIComponent(template.subject);
      const body = encodeURIComponent(template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
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
        <Box>
          <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
            報告 - {propertyNumber}
            {reportData.owner_name && (
              <Typography component="span" variant="h6" sx={{ ml: 2, color: 'text.primary', fontWeight: 'normal' }}>
                {reportData.owner_name}
              </Typography>
            )}
          </Typography>
          {reportData.address && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {reportData.address}
            </Typography>
          )}
        </Box>
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
            <ToggleButton value="N" sx={{ px: 3 }}>N</ToggleButton>
            <ToggleButton value="Y" sx={{ px: 3 }}>Y</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* 報告担当 - ボックス選択 */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
            報告担当
          </Typography>
          <ToggleButtonGroup
            value={reportData.report_assignee || ''}
            exclusive
            onChange={(_, value) => {
              setReportData((prev) => ({ ...prev, report_assignee: value ?? '' }));
            }}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            {jimuInitials.map((initial) => (
              <ToggleButton
                key={initial}
                value={initial}
                sx={{
                  px: 2,
                  minWidth: 48,
                  fontWeight: 'bold',
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': { backgroundColor: 'primary.dark' },
                  },
                }}
              >
                {initial}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {reportData.sales_assignee && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              物件担当: {reportData.sales_assignee}
            </Typography>
          )}
        </Box>

        {/* ボタン群 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

          <Button
            variant="outlined"
            fullWidth
            startIcon={<EmailIcon />}
            onClick={() => setTemplateDialogOpen(true)}
            sx={{
              borderColor: '#1a73e8',
              color: '#1a73e8',
              '&:hover': { borderColor: '#1557b0', backgroundColor: '#1a73e808' },
            }}
          >
            Gmail送信
          </Button>
        </Box>
      </Paper>

      {/* テンプレート選択ダイアログ */}
      <Dialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>メールテンプレートを選択</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {templates.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                テンプレートが見つかりません
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {templates.map((template, index) => (
                <Box key={template.id}>
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => handleTemplateSelect(template)}>
                      <ListItemText
                        primary={template.name}
                        secondary={template.subject}
                      />
                    </ListItemButton>
                  </ListItem>
                  {index < templates.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>キャンセル</Button>
        </DialogActions>
      </Dialog>

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
