import { useState, useEffect, useRef } from 'react';
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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EmailIcon from '@mui/icons-material/Email';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import api, { propertyListingApi } from '../services/api';
import PropertyHeaderInfo from '../components/PropertyHeaderInfo';
import { useAuthStore } from '../store/authStore';

interface PropertyData {
  property_number?: string;
  seller_name?: string;
  seller_email?: string;
  sales_assignee?: string;
  suumo_url?: string;
  reins_certificate_email?: string | null;
  cc_assignee?: string | null;
  report_date_setting?: string | null;
  reins_url?: string | null;
  address?: string | null;
  sales_price?: number | null;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  initials?: string;
}

const REINS_FIELDS: {
  key: keyof Pick<PropertyData, 'reins_certificate_email' | 'cc_assignee' | 'report_date_setting'>;
  label: string;
  options: string[];
}[] = [
  { key: 'reins_certificate_email', label: 'レインズ証明書メール済み', options: ['連絡済み', '未'] },
  { key: 'cc_assignee', label: '担当をCCにいれる', options: ['済', '未'] },
  { key: 'report_date_setting', label: '報告日設定', options: ['する', 'しない'] },
];

function buildEmailBody(sellerName: string, suumoUrl: string): string {
  const suumoLine = suumoUrl ? `■SUUMO\n${suumoUrl}` : '■SUUMO';
  return `${sellerName}様

お世話になっております。
株式会社いふうです。

本日、各サイトに正式に公開されましたので、レインズの登録証明書を送付いたします。
（全国に募集を公開している証明です）

【各サイトのご案内】
■athome
${suumoLine}

今後、当社全員で、お客様の大切な物件の販売に努めてまいります。
2週間に1度担当より、進捗状況をご報告させていただきます。

よろしくお願い申し上げます。

***************************
株式会社 いふう
〒870-0044
大分市舞鶴町1丁目3-30
TEL：097-533-2022
FAX：097-529-7160
HP：https://ifoo-oita.com/
店休日：毎週水曜日　年末年始、GW、盆
***************************`;
}

export default function ReinsRegistrationPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();
  const { employee } = useAuthStore();

  const [data, setData] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [suumoUrlInput, setSuumoUrlInput] = useState('');


  // Gmail送信ダイアログ
  const [gmailOpen, setGmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailSubject, setEmailSubject] = useState('サイト公開＆レインズ登録証明書のご案内（株式会社いふう）');
  const [emailBody, setEmailBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (propertyNumber) fetchData();
  }, [propertyNumber]);

  const fetchData = async () => {
    if (!propertyNumber) return;
    setLoading(true);
    try {
      const [propRes, empRes] = await Promise.all([
        api.get(`/api/property-listings/${propertyNumber}`),
        api.get('/api/employees/active'),
      ]);
      const d = propRes.data;
      setData({
        seller_name: d.seller_name ?? '',
        seller_email: d.seller_email ?? '',
        sales_assignee: d.sales_assignee ?? '',
        suumo_url: d.suumo_url ?? '',
        reins_certificate_email: d.reins_certificate_email ?? null,
        cc_assignee: d.cc_assignee ?? null,
        report_date_setting: d.report_date_setting ?? null,
        reins_url: d.reins_url ?? null,
        address: d.address ?? null,
        sales_price: d.sales_price ?? null,
      });
      setSuumoUrlInput(d.suumo_url ?? '');

      const employees: Employee[] = empRes.data?.employees || empRes.data || [];
      const assignee = d.sales_assignee ?? '';
      const assigneeEmployee = employees.find(
        (e) =>
          e.initials === assignee ||
          e.name === assignee ||
          (assignee && e.name.includes(assignee)) ||
          (assignee && assignee.includes(e.initials || ''))
      );

      setEmailTo(d.seller_email ?? '');
      setEmailCc(assigneeEmployee?.email ?? '');
      setEmailBody(buildEmailBody(d.seller_name ?? '売主', d.suumo_url ?? ''));
    } catch (error) {
      setSnackbar({ open: true, message: 'データの取得に失敗しました', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (field: keyof PropertyData, value: string) => {
    if (!propertyNumber || !data) return;
    const prevValue = data[field];
    setData((prev) => prev ? { ...prev, [field]: value } : prev);
    setUpdating(field);
    try {
      // 報告日設定が変更された場合、報告日を自動計算
      if (field === 'report_date_setting') {
        let reportDate: string | null = null;
        
        if (value === 'する') {
          // 本日+14日を計算
          const today = new Date();
          const futureDate = new Date(today);
          futureDate.setDate(futureDate.getDate() + 14);
          reportDate = futureDate.toISOString().split('T')[0];
          
          // UIを更新
          setData((prev) => prev ? { ...prev, report_date_setting: value } : prev);
          
          // 報告日設定と報告日の両方を保存
          await api.put(`/api/property-listings/${propertyNumber}`, { 
            report_date_setting: value,
            report_date: reportDate
          });
          
          setSnackbar({ open: true, message: `保存しました（報告日: ${reportDate}）`, severity: 'success' });
        } else if (value === 'しない') {
          // 報告日をクリア
          reportDate = null;
          
          // UIを更新
          setData((prev) => prev ? { ...prev, report_date_setting: value } : prev);
          
          // 報告日設定と報告日の両方を保存
          await api.put(`/api/property-listings/${propertyNumber}`, { 
            report_date_setting: value,
            report_date: reportDate
          });
          
          setSnackbar({ open: true, message: '保存しました（報告日をクリア）', severity: 'success' });
        } else {
          // その他の値の場合は報告日設定のみ保存
          await api.put(`/api/property-listings/${propertyNumber}`, { [field]: value });
          setSnackbar({ open: true, message: '保存しました', severity: 'success' });
        }
      } else {
        // 報告日設定以外のフィールドは通常通り保存
        await api.put(`/api/property-listings/${propertyNumber}`, { [field]: value });
        setSnackbar({ open: true, message: '保存しました', severity: 'success' });
      }
    } catch (error) {
      setData((prev) => prev ? { ...prev, [field]: prevValue } : prev);
      setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    } finally {
      setUpdating(null);
    }
  };

  const handleSaveSuumoUrl = async () => {
    if (!propertyNumber || !data) return;
    
    // URL形式バリデーション
    const SUUMO_URL_PATTERN = /^https:\/\/suumo\.jp\/.+/;
    if (suumoUrlInput && !SUUMO_URL_PATTERN.test(suumoUrlInput)) {
      setSnackbar({ 
        open: true, 
        message: '有効なSuumo URLを入力してください（https://suumo.jp/...）', 
        severity: 'error' 
      });
      return;
    }

    const prevValue = data.suumo_url;
    setData((prev) => prev ? { ...prev, suumo_url: suumoUrlInput } : prev);
    setUpdating('suumo_url');
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, { suumo_url: suumoUrlInput });
      setSnackbar({ open: true, message: 'Suumo URLを保存しました', severity: 'success' });
      // メール本文を更新
      setEmailBody(buildEmailBody(data.seller_name ?? '売主', suumoUrlInput));
    } catch (error) {
      setData((prev) => prev ? { ...prev, suumo_url: prevValue } : prev);
      setSuumoUrlInput(prevValue ?? '');
      setSnackbar({ open: true, message: 'Suumo URLの保存に失敗しました', severity: 'error' });
    } finally {
      setUpdating(null);
    }
  };

  const handleOpenSuumoUrl = () => {
    if (suumoUrlInput) {
      window.open(suumoUrlInput, '_blank');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendEmail = async () => {
    if (!propertyNumber || !emailTo || !emailSubject || !emailBody) {
      setSnackbar({ open: true, message: '宛先・件名・本文は必須です', severity: 'error' });
      return;
    }
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('to', emailTo);
      if (emailCc) formData.append('cc', emailCc);
      formData.append('subject', emailSubject);
      formData.append('body', emailBody);
      formData.append('from', 'tenant@ifoo-oita.com');
      attachments.forEach((file) => formData.append('attachments', file));

      await api.post(
        `/api/property-listings/${propertyNumber}/send-report-email`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setSnackbar({ open: true, message: 'メールを送信しました', severity: 'success' });
      setGmailOpen(false);
      setAttachments([]);

      // 売主への送信履歴を保存（非同期・非ブロッキング）
      try {
        await propertyListingApi.saveSellerSendHistory(propertyNumber!, {
          chat_type: 'seller_gmail',
          subject: emailSubject || '',
          message: emailBody || '',
          sender_name: employee?.name || employee?.initials || '不明',
        });
      } catch (err) {
        console.error('[GMAIL送信履歴] 保存に失敗しました:', err);
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'メール送信に失敗しました',
        severity: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
        {/* Gmail送信ボタン */}
        <Button
          variant="contained"
          startIcon={<EmailIcon />}
          onClick={() => setGmailOpen(true)}
          sx={{ backgroundColor: '#1565c0', '&:hover': { backgroundColor: '#0d47a1' } }}
        >
          Gmail送信
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* PropertyHeaderInfo - 物件番号の下に配置 */}
          <PropertyHeaderInfo
            address={data?.address ?? null}
            salesPrice={data?.sales_price ?? null}
            salesAssignee={data?.sales_assignee ?? null}
            propertyNumber={data?.property_number ?? ''}
          />

          {/* レインズ証明書メール済み + レインズURL（横並び） */}
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {/* レインズ証明書メール済み */}
              <Box sx={{ flex: '1 1 auto' }}>
                <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1.5 }}>
                  レインズ証明書メール済み
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {['連絡済み', '未'].map((option) => (
                    <Button
                      key={option}
                      variant={data?.reins_certificate_email === option ? 'contained' : 'outlined'}
                      onClick={() => handleUpdate('reins_certificate_email', option)}
                      disabled={updating === 'reins_certificate_email'}
                      sx={{ minWidth: 80 }}
                    >
                      {updating === 'reins_certificate_email' ? <CircularProgress size={16} /> : option}
                    </Button>
                  ))}
                </Box>
              </Box>

              <Divider orientation="vertical" flexItem />

              {/* レインズシステムリンク */}
              <Box sx={{ flex: '2 1 200px', display: 'flex', alignItems: 'center' }}>
                <Button
                  variant="text"
                  size="small"
                  endIcon={<OpenInNewIcon fontSize="small" />}
                  onClick={() => window.open('https://system.reins.jp/', '_blank')}
                  sx={{ p: 0 }}
                >
                  レインズシステムを開く
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Suumo URLフィールド */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1.5 }}>
              Suumo URL
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="https://suumo.jp/..."
                value={suumoUrlInput}
                onChange={(e) => setSuumoUrlInput(e.target.value)}
                disabled={updating === 'suumo_url'}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveSuumoUrl();
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleSaveSuumoUrl}
                disabled={updating === 'suumo_url'}
                sx={{ minWidth: 80 }}
              >
                {updating === 'suumo_url' ? <CircularProgress size={16} /> : '保存'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleOpenSuumoUrl}
                disabled={!suumoUrlInput || updating === 'suumo_url'}
                endIcon={<OpenInNewIcon />}
                sx={{ minWidth: 80 }}
              >
                開く
              </Button>
            </Box>
          </Paper>

          {/* 残りのフィールド */}
          {REINS_FIELDS.filter((f) => f.key !== 'reins_certificate_email').map((field) => (
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

      {/* Gmail送信ダイアログ */}
      <Dialog open={gmailOpen} onClose={() => setGmailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Gmail送信
            <IconButton onClick={() => setGmailOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="宛先"
              fullWidth
              size="small"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              required
            />
            <TextField
              label="CC"
              fullWidth
              size="small"
              value={emailCc}
              onChange={(e) => setEmailCc(e.target.value)}
              helperText="物件担当のメールアドレス"
            />
            <TextField
              label="送信元"
              fullWidth
              size="small"
              value="tenant@ifoo-oita.com"
              disabled
            />
            <TextField
              label="件名"
              fullWidth
              size="small"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              required
            />
            <TextField
              label="本文"
              fullWidth
              multiline
              rows={14}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              required
            />

            {/* 添付ファイル */}
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                添付ファイル
              </Typography>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<AttachFileIcon />}
                onClick={() => fileInputRef.current?.click()}
              >
                ファイルを追加
              </Button>
              {attachments.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {attachments.map((file, index) => (
                    <Chip
                      key={index}
                      label={file.name}
                      size="small"
                      onDelete={() => handleRemoveAttachment(index)}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGmailOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleSendEmail}
            disabled={sending || !emailTo}
            startIcon={sending ? <CircularProgress size={16} /> : <EmailIcon />}
          >
            {sending ? '送信中...' : '送信'}
          </Button>
        </DialogActions>
      </Dialog>

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
