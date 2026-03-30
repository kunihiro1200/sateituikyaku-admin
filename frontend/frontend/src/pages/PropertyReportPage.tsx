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
  Image as ImageIcon,
} from '@mui/icons-material';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import api from '../services/api';
import ImageSelectorModal from '../components/ImageSelectorModal';
import CompactBuyerListForProperty from '../components/CompactBuyerListForProperty';
import { SECTION_COLORS } from '../theme/sectionColors';

interface ReportData {
  report_date?: string;
  report_completed?: string;
  report_assignee?: string;
  sales_assignee?: string;
  address?: string;
  owner_name?: string;
  owner_email?: string;
  suumo_url?: string;
}

// 今日からN週間後の日付文字列（YYYY-MM-DD）を返す
const getDateWeeksLater = (weeks: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
};

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface StaffInfo {
  initials: string;
  name: string;
  // タスク5.1: jimu-staff APIのレスポンス型にemailを追加
  email?: string;
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
  body: string | null;
}


// 送信履歴テーブルの表示行を生成するヘルパー関数
// 5件未満の場合は null で埋めて rowCount 件にする
// 5件超の場合はそのまま全件返す
const getDisplayRows = (history: ReportHistory[], rowCount: number = 5): (ReportHistory | null)[] => {
  const rows: (ReportHistory | null)[] = [...history];
  while (rows.length < rowCount) {
    rows.push(null);
  }
  return rows;
};

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
  const [mergedTemplates, setMergedTemplates] = useState<Record<string, { subject: string; body: string; sellerName?: string; sellerEmail?: string }>>({});
  const [prefetching, setPrefetching] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<ReportHistory | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [sendConfirmDialogOpen, setSendConfirmDialogOpen] = useState(false);
  const [pendingSendHistory, setPendingSendHistory] = useState<{ templateName: string; subject: string; body: string; gmailUrl: string } | null>(null);
  // 編集中のメール内容
  const [editTo, setEditTo] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  // 返信先（Reply-To）選択状態（タスク5.2）
  const [editReplyTo, setEditReplyTo] = useState('');
  const [sending, setSending] = useState(false);
  // 画像添付用ステート
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // sendConfirmDialogOpen が true になったとき、report_assignee に対応するスタッフのメールをデフォルト設定（タスク5.2）
  useEffect(() => {
    if (sendConfirmDialogOpen) {
      const assignee = reportData.report_assignee || '';
      const matchedStaff = jimuStaff.find((s) => s.initials === assignee);
      // 対応するスタッフが存在しない場合は空文字列
      setEditReplyTo(matchedStaff?.email || '');
    }
  }, [sendConfirmDialogOpen]);

  // 変更検知
  const hasChanges =
    reportData.report_date !== savedData.report_date ||
    reportData.report_completed !== savedData.report_completed ||
    reportData.report_assignee !== savedData.report_assignee ||
    reportData.suumo_url !== savedData.suumo_url;

  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchJimuStaff();
      fetchTemplates();
      fetchReportHistory();
      fetchBuyers();
    }
  }, [propertyNumber]);

  const fetchData = async () => {
    if (!propertyNumber) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      const d = response.data;
      let ownerName = d.seller_name || '';
      let ownerEmail = d.seller_email || d.email || '';
      if (!ownerName || !ownerEmail) {
        try {
          const sellerRes = await api.get(`/api/sellers/by-number/${propertyNumber}`);
          if (!ownerName) ownerName = sellerRes.data?.name || '';
          if (!ownerEmail) ownerEmail = sellerRes.data?.email || '';
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
        owner_email: ownerEmail,
        suumo_url: d.suumo_url || '',
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

  const fetchBuyers = async () => {
    if (!propertyNumber) return;
    setBuyersLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}/buyers`);
      setBuyers(response.data || []);
    } catch (error) {
      // エラーは無視して空リストを表示（要件2.5）
      setBuyers([]);
    } finally {
      setBuyersLoading(false);
    }
  };

  const prefetchMergedTemplates = async () => {
    if (!propertyNumber) return;
    setPrefetching(true);
    try {
      const tmplResponse = await api.get('/api/email-templates/property');
      const tmplList: EmailTemplate[] = tmplResponse.data || [];
      setTemplates(tmplList);

      const merged: Record<string, { subject: string; body: string; sellerName?: string; sellerEmail?: string }> = {};
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
              sellerEmail: mergeResponse.data.sellerEmail,
            };
            if (mergeResponse.data.sellerName) {
              setReportData((prev) => ({ ...prev, owner_name: mergeResponse.data.sellerName }));
              setSavedData((prev) => ({ ...prev, owner_name: mergeResponse.data.sellerName }));
            }
            if (mergeResponse.data.sellerEmail) {
              setReportData((prev) => ({ ...prev, owner_email: mergeResponse.data.sellerEmail }));
              setSavedData((prev) => ({ ...prev, owner_email: mergeResponse.data.sellerEmail }));
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
        suumo_url: reportData.suumo_url || null,
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

    const toEmail = reportData.owner_email || '';

    if (mergedTemplates[template.id]) {
      const cached = mergedTemplates[template.id];
      const resolvedEmail = cached.sellerEmail || toEmail;
      const to = encodeURIComponent(resolvedEmail);
      const subject = encodeURIComponent(cached.subject);
      const body = encodeURIComponent(cached.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
      // Gmailを開かずにプレビューダイアログを表示
      setPendingSendHistory({ templateName: template.name, subject: cached.subject, body: cached.body, gmailUrl });
      setEditTo(cached.sellerEmail || toEmail);
      setEditSubject(cached.subject);
      setEditBody(cached.body);
      setSendConfirmDialogOpen(true);
      return;
    }

    try {
      const mergeResponse = await api.post('/api/email-templates/property/merge', {
        propertyNumber,
        templateId: template.id,
      });
      const { subject: mergedSubject, body: mergedBody, sellerName, sellerEmail } = mergeResponse.data;
      if (sellerName) {
        setReportData((prev) => ({ ...prev, owner_name: sellerName }));
      }
      const resolvedEmail = sellerEmail || toEmail;
      const to = encodeURIComponent(resolvedEmail);
      const subject = encodeURIComponent(mergedSubject || template.subject);
      const body = encodeURIComponent(mergedBody || template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
      // Gmailを開かずにプレビューダイアログを表示
      setPendingSendHistory({ templateName: template.name, subject: mergedSubject || template.subject, body: mergedBody || template.body, gmailUrl });
      setEditTo(resolvedEmail);
      setEditSubject(mergedSubject || template.subject);
      setEditBody(mergedBody || template.body);
      setSendConfirmDialogOpen(true);
    } catch (error) {
      console.error('Failed to merge template:', error);
      const to = encodeURIComponent(toEmail);
      const subject = encodeURIComponent(template.subject);
      const body = encodeURIComponent(template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
      setPendingSendHistory({ templateName: template.name, subject: template.subject, body: template.body, gmailUrl });
      setEditTo(toEmail);
      setEditSubject(template.subject);
      setEditBody(template.body);
      setSendConfirmDialogOpen(true);
    }
  };

  // 画像添付ハンドラー
  const handleOpenImageSelector = () => {
    setImageSelectorOpen(true);
  };

  const handleImageSelectionConfirm = (images: any[]) => {
    setSelectedImages(images);
    setImageSelectorOpen(false);
    setImageError(null);
  };

  const handleImageSelectionCancel = () => {
    setImageSelectorOpen(false);
  };

  const handleSend = async () => {
    if (!pendingSendHistory) return;
    setSending(true);
    try {
      // selectedImages を attachmentImages に変換（CallModePage と同じロジック）
      const attachmentImages: any[] = [];
      if (Array.isArray(selectedImages) && selectedImages.length > 0) {
        for (const img of selectedImages) {
          if (img.source === 'drive') {
            attachmentImages.push({ id: img.driveFileId || img.id, name: img.name });
          } else if (img.source === 'local' && img.previewUrl) {
            const base64Match = (img.previewUrl as string).match(/^data:([^;]+);base64,(.+)$/);
            if (base64Match) {
              attachmentImages.push({
                id: img.id,
                name: img.name,
                base64Data: base64Match[2],
                mimeType: base64Match[1],
              });
            }
          } else if (img.source === 'url' && img.url) {
            attachmentImages.push({ id: img.id, name: img.name, url: img.url });
          }
        }
      }

      if (attachmentImages.length > 0) {
        // multipart/form-data で送信
        const formData = new FormData();
        formData.append('to', editTo);
        formData.append('subject', editSubject);
        formData.append('body', editBody);
        formData.append('template_name', pendingSendHistory.templateName);
        formData.append('report_date', reportData.report_date || '');
        formData.append('report_assignee', reportData.report_assignee || '');
        formData.append('report_completed', reportData.report_completed || 'N');
        // 返信先が選択されている場合のみ replyTo を追加（タスク5.3）
        if (editReplyTo) {
          formData.append('replyTo', editReplyTo);
        }

        const localAttachments = attachmentImages.filter((a: any) => a.base64Data);
        const driveOrUrlAttachments = attachmentImages.filter((a: any) => !a.base64Data);

        for (const att of localAttachments) {
          const byteString = atob(att.base64Data);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
          const blob = new Blob([ab], { type: att.mimeType });
          formData.append('attachments', blob, att.name);
        }

        if (driveOrUrlAttachments.length > 0) {
          formData.append('driveAttachments', JSON.stringify(driveOrUrlAttachments));
        }

        await api.post(
          `/api/property-listings/${propertyNumber}/send-report-email`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      } else {
        // 従来通り application/json で送信
        await api.post(`/api/property-listings/${propertyNumber}/send-report-email`, {
          to: editTo,
          subject: editSubject,
          body: editBody,
          template_name: pendingSendHistory.templateName,
          report_date: reportData.report_date || null,
          report_assignee: reportData.report_assignee || null,
          report_completed: reportData.report_completed || 'N',
          // 返信先が選択されている場合のみ replyTo を含める（タスク5.3）
          ...(editReplyTo ? { replyTo: editReplyTo } : {}),
        });
      }

      setSendConfirmDialogOpen(false);
      setPendingSendHistory(null);
      setSelectedImages([]);
      // 返信先もリセット（タスク5.2）
      setEditReplyTo('');
      fetchReportHistory();
      setSnackbar({ open: true, message: 'メールを送信しました', severity: 'success' });
    } catch (error: any) {
      const errMsg = error.response?.data?.error || 'メール送信に失敗しました';
      const errDetail = error.response?.data?.detail || '';
      const fullMsg = errDetail ? `${errMsg} / ${errDetail}` : errMsg;
      setSnackbar({ open: true, message: fullMsg, severity: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleSendCancel = () => {
    setSendConfirmDialogOpen(false);
    setPendingSendHistory(null);
    setSelectedImages([]);
    setImageError(null);
    // 返信先もリセット（タスク5.2）
    setEditReplyTo('');
  };

  const recordSendHistory = async (templateName: string, subject: string, body?: string) => {
    if (!propertyNumber) return;
    try {
      await api.post(`/api/property-listings/${propertyNumber}/report-history`, {
        template_name: templateName,
        subject,
        body: body || null,
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
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack} size="large">
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
                報告 - {propertyNumber}
                {reportData.owner_name && (
                  <Typography component="span" variant="h6" sx={{ ml: 2, color: 'text.primary', fontWeight: 'normal' }}>
                    {reportData.owner_name}
                  </Typography>
                )}
              </Typography>
              {/* Gmail送信ボタン（売主氏名の右） */}
              <Button
                variant="outlined"
                size="small"
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

      {/* 左右2カラムレイアウト */}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        {/* 左カラム：報告情報 + Gmail送信 */}
        <Box sx={{ flex: '0 0 380px', minWidth: 0 }}>
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
                    // 報告完了がYに変更されたら報告日を2週間後に更新
                    const newReportDate = value === 'Y' ? getDateWeeksLater(2) : (reportData.report_date || '');
                    setReportData((prev) => ({
                      ...prev,
                      report_completed: value,
                      report_date: newReportDate,
                    }));
                  }
                }}
                size="small"
              >
                <ToggleButton value="N" sx={{ px: 3 }}>N</ToggleButton>
                <ToggleButton value="Y" sx={{ px: 3 }}>Y</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* 報告担当 */}
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

            {/* SUUMO URL */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
                SUUMO URL
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="https://suumo.jp/..."
                value={reportData.suumo_url || ''}
                onChange={(e) => setReportData((prev) => ({ ...prev, suumo_url: e.target.value }))}
              />
              {reportData.suumo_url && (
                <Button
                  size="small"
                  href={reportData.suumo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ mt: 0.5, p: 0, minWidth: 0, fontSize: '0.75rem' }}
                >
                  開く
                </Button>
              )}
            </Box>
          </Paper>
        </Box>

        {/* 右カラム：送信履歴 + 前回メール内容 */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 送信履歴（5行固定表示） */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: SECTION_COLORS.property.main }}>
              送信履歴
            </Typography>
            <TableContainer sx={{ maxHeight: 220, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>送信日時</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>テンプレート</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>担当</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>完了</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getDisplayRows(reportHistory).map((h, index) =>
                    h === null ? (
                      <TableRow key={`empty-${index}`} sx={{ cursor: 'default' }}>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                      </TableRow>
                    ) : (
                      <TableRow
                        key={h.id}
                        hover
                        onClick={() => { setSelectedHistory(h); setHistoryDialogOpen(true); }}
                        sx={{ cursor: 'pointer' }}
                      >
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
                    )
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* 前回メール内容 */}
          {reportHistory.length > 0 && reportHistory[0].body && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, color: SECTION_COLORS.property.main }}>
                前回メール内容
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {new Date(reportHistory[0].sent_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                　{reportHistory[0].template_name || ''}
              </Typography>
              {reportHistory[0].subject && (
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                  件名: {reportHistory[0].subject}
                </Typography>
              )}
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: 'text.secondary', maxHeight: 300, overflow: 'auto', bgcolor: '#f9f9f9', p: 1.5, borderRadius: 1 }}>
                {reportHistory[0].body}
              </Typography>
            </Paper>
          )}

          {/* 買主一覧 */}
          <CompactBuyerListForProperty
            buyers={buyers}
            propertyNumber={propertyNumber || ''}
            loading={buyersLoading}
          />
        </Box>
      </Box>

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

      {/* メールプレビュー＆送信ダイアログ（左：前回、右：今回） */}
      <Dialog open={sendConfirmDialogOpen} onClose={handleSendCancel} fullScreen>
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight="bold">メール確認</Typography>
          <Button onClick={handleSendCancel} color="inherit" size="small">閉じる</Button>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', overflow: 'hidden' }}>
          {/* 左：前回のメール */}
          <Box sx={{ flex: 1, borderRight: '1px solid', borderColor: 'divider', p: 2, overflow: 'auto', bgcolor: '#fafafa', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ mb: 1 }}>
              {reportHistory.length > 0 && reportHistory[0].template_name
                ? reportHistory[0].template_name
                : '前回のメール'}
            </Typography>
            {reportHistory.length > 0 && reportHistory[0].body ? (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {new Date(reportHistory[0].sent_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Typography>
                {reportHistory[0].subject && (
                  <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                    件名: {reportHistory[0].subject}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'text.primary' }}>
                  {reportHistory[0].body}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.disabled" sx={{ mt: 2, textAlign: 'center' }}>
                前回の送信履歴なし
              </Typography>
            )}
          </Box>

          {/* 右：今回のメール（編集可能） */}
          <Box sx={{ flex: 1, p: 2, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" fontWeight="bold" color="primary">
              {pendingSendHistory?.templateName || '今回のメール'}
            </Typography>
            <TextField
              label="宛先"
              size="small"
              fullWidth
              value={editTo}
              onChange={(e) => setEditTo(e.target.value)}
            />
            {/* 返信先（Reply-To）選択フィールド（タスク5.2） */}
            <FormControl size="small" fullWidth>
              <InputLabel id="reply-to-label">返信先（Reply-To）</InputLabel>
              <Select
                labelId="reply-to-label"
                label="返信先（Reply-To）"
                value={editReplyTo}
                onChange={(e) => setEditReplyTo(e.target.value)}
                displayEmpty
              >
                {/* 未選択状態のプレースホルダー */}
                <MenuItem value="">
                  <em>選択なし（送信元と同じ）</em>
                </MenuItem>
                {/* スタッフ一覧：「氏名 <メールアドレス>」形式で表示 */}
                {jimuStaff
                  .filter((s) => s.email)
                  .map((s) => (
                    <MenuItem key={s.initials} value={s.email}>
                      {s.name} &lt;{s.email}&gt;
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <TextField
              label="件名"
              size="small"
              fullWidth
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
            />
            <TextField
              label="本文"
              multiline
              fullWidth
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              sx={{ flex: 1 }}
              InputProps={{ sx: { fontSize: '0.85rem', alignItems: 'flex-start' } }}
              inputProps={{ style: { minHeight: 'calc(100vh - 280px)' } }}
            />
            {/* 画像添付ボタン */}
            <Box sx={{ mt: 1 }}>
              <Button
                variant="outlined"
                startIcon={<ImageIcon />}
                onClick={handleOpenImageSelector}
                fullWidth
              >
                画像を添付
              </Button>
              {selectedImages.length > 0 && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  {selectedImages.length}枚の画像が選択されました
                </Alert>
              )}
              {imageError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {imageError}
                </Alert>
              )}
            </Box>
            <Button
              onClick={handleSend}
              variant="contained"
              color="primary"
              size="large"
              disabled={sending || !editTo}
              startIcon={sending ? <CircularProgress size={18} /> : <EmailIcon />}
              sx={{ mt: 1 }}
            >
              {sending ? '送信中...' : '送信'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* 画像選択モーダル */}
      <ImageSelectorModal
        open={imageSelectorOpen}
        onConfirm={handleImageSelectionConfirm}
        onCancel={handleImageSelectionCancel}
      />

      {/* 送信履歴詳細ダイアログ */}
      <Dialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          送信履歴の詳細
          {selectedHistory && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {new Date(selectedHistory.sent_at).toLocaleString('ja-JP')}　{selectedHistory.template_name || ''}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {selectedHistory?.subject && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" fontWeight="bold" gutterBottom>件名</Typography>
              <Typography variant="body2">{selectedHistory.subject}</Typography>
            </Box>
          )}
          {selectedHistory?.body ? (
            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight="bold" gutterBottom>本文</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', bgcolor: '#f9f9f9', p: 1.5, borderRadius: 1 }}>
                {selectedHistory.body}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">本文データがありません</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>閉じる</Button>
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
