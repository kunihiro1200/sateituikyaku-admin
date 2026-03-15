import { useState, useEffect, useRef } from 'react';
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
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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

interface StaffInfo {
  initials: string;
  name: string;
}

interface ReportHistory {
  id: number;
  property_number: string;
  report_date: string | null;
  report_assignee: string | null;
  report_completed: string | null;
  sent_at: string;
  template_name: string | null;
  subject: string | null;
}

export default function PropertyReportPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();

  const [reportData, setReportData] = useState<ReportData>({});
  const [savedData, setSavedData] = useState<ReportData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jimuInitials, setJimuInitials] = useState<string[]>([]);
  const [jimuStaff, setJimuStaff] = useState<StaffInfo[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [mergedTemplates, setMergedTemplates] = useState<Record<string, { subject: string; body: string; sellerName?: string }>>({});
  const [prefetching, setPrefetching] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // 変更検知
  const hasChanges =
    reportData.report_date !== savedData.report_date ||
    reportData.report_completed !== savedData.report_completed ||
    reportData.report_assignee !== savedData.report_assignee;

  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchJimuStaff();
      fetchTemplates().then(() => {
        prefetchMergedTemplates();
      });
      fetchReportHistory();
    }
  }, [propertyNumber]);

  const fetchData = async () => {
    if (!propertyNumber) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      const d = response.data;
      let ownerName = d.seller_name || '';
      if (!ownerName) {
        try {
          const sellerRes = await api.get(`/api/sellers/by-number/${propertyNumber}`);
          ownerName = sellerRes.data?.name || '';
        } catch {
          // 売主が見つからない場合は空のまま
        }
      }
      const initial: ReportData = {
        report_date: d.report_date || '',
        report_completed: d.report_completed || 'N',
        report_assignee: d.report_assignee || d.sales_assignee || '',
        sales_assignee: d.sales_assignee || '',
        address: d.address || d.property_address || '',
        owner_name: ownerName,
      };
      setReportData(initial);
      setSavedData(initial);
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

  const fetchJimuStaff = async () => {
    try {
      const response = await api.get('/api/employees/jimu-staff');
      setJimuStaff(response.data.staff || []);
    } catch (error) {
      console.error('Failed to fetch jimu staff:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/api/email-templates/property');
      setTemplates(response.data || []);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch property templates:', error);
      setTemplates([]);
      return [];
    }
  };

  const fetchReportHistory = async () => {
    if (!propertyNumber) return;
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}/report-history`);
      setReportHistory(response.data || []);
    } catch (error) {
      // 報告履歴が取得できない場合は空のまま（エラー表示しない）
      setReportHistory([]);
    }
  };

  const prefetchMergedTemplates = async () => {
    if (!propertyNumber) return;
    setPrefetching(true);
    try {
      const tmplResponse = await api.get('/api/email-templates/property');
      const tmplList: EmailTemplate[] = tmplResponse.data || [];
      setTemplates(tmplList);

      const merged: Record<string, { subject: string; body: string; sellerName?: string }> = {};
      await Promise.all(
        tmplList.map(async (template) => {
          try {
            const mergeResponse = await api.post('/api/email-templates/property/merge', {
              propertyNumber,
              templateId: template.id,
            });
            merged[template.id] = {
              subject: mergeResponse.data.subject || template.subject,
              body: mergeResponse.data.body || template.body,
              sellerName: mergeResponse.data.sellerName,
            };
            if (mergeResponse.data.sellerName) {
              setReportData((prev) => ({ ...prev, owner_name: mergeResponse.data.sellerName }));
              setSavedData((prev) => ({ ...prev, owner_name: mergeResponse.data.sellerName }));
            }
          } catch (err) {
            console.error('Failed to prefetch template:', template.id, err);
            merged[template.id] = { subject: template.subject, body: template.body };
          }
        })
      );
      setMergedTemplates(merged);
    } catch (error) {
      console.error('Failed to prefetch merged templates:', error);
    } finally {
      setPrefetching(false);
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
      setSavedData({ ...reportData });
      setSnackbar({ open: true, message: '報告情報を保存しました', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateSelect = async (template: EmailTemplate) => {
    setTemplateDialogOpen(false);

    if (mergedTemplates[template.id]) {
      const cached = mergedTemplates[template.id];
      const subject = encodeURIComponent(cached.subject);
      const body = encodeURIComponent(cached.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
      // 送信後に履歴を記録
      recordSendHistory(template.name, cached.subject);
      return;
    }

    try {
      const mergeResponse = await api.post('/api/email-templates/property/merge', {
        propertyNumber,
        templateId: template.id,
      });
      const { subject: mergedSubject, body: mergedBody, sellerName } = mergeResponse.data;
      if (sellerName) {
        setReportData((prev) => ({ ...prev, owner_name: sellerName }));
      }
      const subject = encodeURIComponent(mergedSubject || template.subject);
      const body = encodeURIComponent(mergedBody || template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
      recordSendHistory(template.name, mergedSubject || template.subject);
    } catch (error) {
      console.error('Failed to merge template:', error);
      const subject = encodeURIComponent(template.subject);
      const body = encodeURIComponent(template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
    }
  };

  const recordSendHistory = async (templateName: string, subject: string) => {
    if (!propertyNumber) return;
    try {
      await api.post(`/api/property-listings/${propertyNumber}/report-history`, {
        template_name: templateName,
        subject,
        report_date: reportData.report_date || null,
        report_assignee: reportData.report_assignee || null,
        report_completed: reportData.report_completed || 'N',
      });
      // 履歴を再取得
      fetchReportHistory();
    } catch (error) {
      // 履歴記録失敗は無視
    }
  };

  // イニシャルからフルネームを取得
  const getFullName = (initials: string): string => {
    const staff = jimuStaff.find((s) => s.initials === initials);
    return staff?.name || initials;
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
        {/* ヘッダー保存ボタン（変更があると光る） */}
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !hasChanges}
          sx={{
            minWidth: 80,
            backgroundColor: hasChanges ? SECTION_COLORS.property.main : 'grey.400',
            transition: 'all 0.3s',
            ...(hasChanges && {
              animation: 'glow 1.5s ease-in-out infinite',
              '@keyframes glow': {
                '0%': { boxShadow: `0 0 0 0 ${SECTION_COLORS.property.main}99` },
                '70%': { boxShadow: `0 0 0 8px ${SECTION_COLORS.property.main}00` },
                '100%': { boxShadow: `0 0 0 0 ${SECTION_COLORS.property.main}00` },
              },
            }),
            '&:hover': {
              backgroundColor: hasChanges ? SECTION_COLORS.property.dark : 'grey.500',
            },
          }}
        >
          {saving ? '保存中' : '保存'}
        </Button>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
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

        {/* 報告担当 - ボックス選択（フルネーム表示） */}
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
                  minWidth: 64,
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

        {/* Gmail送信ボタン */}
        <Button
          variant="outlined"
          fullWidth
          startIcon={prefetching ? <CircularProgress size={16} /> : <EmailIcon />}
          onClick={() => setTemplateDialogOpen(true)}
          sx={{
            borderColor: '#1a73e8',
            color: '#1a73e8',
            '&:hover': { borderColor: '#1557b0', backgroundColor: '#1a73e808' },
          }}
        >
          {prefetching ? 'テンプレート準備中...' : 'Gmail送信'}
        </Button>
      </Paper>

      {/* 報告書一覧 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: SECTION_COLORS.property.main }}>
          送信履歴
        </Typography>
        {reportHistory.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            送信履歴はありません
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>送信日時</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>テンプレート</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>担当</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>完了</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportHistory.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      {new Date(h.sent_at).toLocaleString('ja-JP', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>{h.template_name || '-'}</TableCell>
                    <TableCell>{h.report_assignee ? getFullName(h.report_assignee) : '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={h.report_completed === 'Y' ? '完了' : '未完了'}
                        size="small"
                        color={h.report_completed === 'Y' ? 'success' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
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
