#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
物件詳細ページのEmailボタンを通話モードと同じメール送信機能に変更するスクリプト
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
text = text.replace('\r\n', '\n')

# 1. importにRichTextEmailEditor, ImageSelectorModal, SenderAddressSelector, Chip, emailTemplates, getActiveEmployees, getSenderAddress, saveSenderAddressを追加
old_import_api = "import api from '../services/api';"
new_import_api = """import api from '../services/api';
import RichTextEmailEditor from '../components/RichTextEmailEditor';
import ImageSelectorModal from '../components/ImageSelectorModal';
import SenderAddressSelector from '../components/SenderAddressSelector';
import { emailTemplates } from '../utils/emailTemplates';
import { getActiveEmployees } from '../services/employeeService';
import { getSenderAddress, saveSenderAddress } from '../utils/senderAddressStorage';"""
text = text.replace(old_import_api, new_import_api, 1)

# 2. MUI importにChipを追加
old_mui = "  InputAdornment,\n} from '@mui/material';"
new_mui = "  InputAdornment,\n  Chip,\n} from '@mui/material';"
text = text.replace(old_mui, new_mui, 1)

# 3. 状態変数を追加（propertyNumberSearchの後）
old_state = "  const [propertyNumberSearch, setPropertyNumberSearch] = useState<string>(''); // 物件番号検索"
new_state = """  const [propertyNumberSearch, setPropertyNumberSearch] = useState<string>(''); // 物件番号検索

  // メール送信関連の状態
  const [emailDialog, setEmailDialog] = useState<{
    open: boolean;
    subject: string;
    body: string;
    recipient: string;
  }>({ open: false, subject: '', body: '', recipient: '' });
  const [editableEmailRecipient, setEditableEmailRecipient] = useState('');
  const [editableEmailSubject, setEditableEmailSubject] = useState('');
  const [editableEmailBody, setEditableEmailBody] = useState('');
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [senderAddress, setSenderAddress] = useState<string>(getSenderAddress());
  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);"""
text = text.replace(old_state, new_state, 1)

# 4. useEffectにactiveEmployees取得を追加
old_effect = """  useEffect(() => {
    if (propertyNumber) {
      fetchPropertyData();
      fetchBuyers();
      fetchWorkTaskData();
    }
  }, [propertyNumber]);"""
new_effect = """  useEffect(() => {
    if (propertyNumber) {
      fetchPropertyData();
      fetchBuyers();
      fetchWorkTaskData();
    }
    getActiveEmployees().then(setActiveEmployees).catch(() => {});
  }, [propertyNumber]);"""
text = text.replace(old_effect, new_effect, 1)

# 5. handleOpenBuyerCandidatesの前にメール送信ハンドラーを追加
old_buyer_candidates = "  // 買主候補リストページを開く\n  const handleOpenBuyerCandidates = () => {"
new_buyer_candidates = """  // メール送信ダイアログを開く
  const handleOpenEmailDialog = () => {
    if (!data?.seller_email) return;
    const defaultTemplate = emailTemplates[0];
    const subject = defaultTemplate ? defaultTemplate.subject : '';
    const body = defaultTemplate ? defaultTemplate.content.replace(/\\n/g, '<br>') : '';
    setEditableEmailRecipient(data.seller_email);
    setEditableEmailSubject(subject);
    setEditableEmailBody(body);
    setSelectedImages([]);
    setEmailDialog({ open: true, subject, body, recipient: data.seller_email });
  };

  // メール送信実行
  const handleSendEmail = async () => {
    if (!propertyNumber) return;
    setSendingEmail(true);
    try {
      const attachmentImages: any[] = [];
      for (const img of selectedImages) {
        if (img.source === 'drive') {
          attachmentImages.push({ id: img.driveFileId || img.id, name: img.name });
        } else if (img.source === 'local' && img.previewUrl) {
          const base64Match = (img.previewUrl as string).match(/^data:([^;]+);base64,(.+)$/);
          if (base64Match) {
            attachmentImages.push({ id: img.id, name: img.name, base64Data: base64Match[2], mimeType: base64Match[1] });
          }
        } else if (img.source === 'url' && img.url) {
          attachmentImages.push({ id: img.id, name: img.name, url: img.url });
        }
      }
      const payload: any = {
        templateId: 'custom',
        to: editableEmailRecipient,
        subject: editableEmailSubject,
        content: editableEmailBody,
        htmlBody: editableEmailBody,
        from: senderAddress,
      };
      if (attachmentImages.length > 0) payload.attachments = attachmentImages;

      await api.post(`/api/emails/by-seller-number/${propertyNumber}/send-template-email`, payload);
      setSnackbar({ open: true, message: 'メールを送信しました', severity: 'success' });
      setEmailDialog({ open: false, subject: '', body: '', recipient: '' });
      setSelectedImages([]);
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.error?.message || 'メール送信に失敗しました', severity: 'error' });
    } finally {
      setSendingEmail(false);
    }
  };

  // 買主候補リストページを開く
  const handleOpenBuyerCandidates = () => {"""
text = text.replace(old_buyer_candidates, new_buyer_candidates, 1)

# 6. EmailボタンのonClickを変更（mailto: → handleOpenEmailDialog）
old_email_btn = """              {data.seller_email && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { window.location.href = `mailto:${data.seller_email}`; }}
                  startIcon={<EmailIcon fontSize="small" />}
                  sx={{
                    borderColor: '#1976d2',
                    color: '#1976d2',
                    '&:hover': {
                      borderColor: '#115293',
                      backgroundColor: '#1976d208',
                    },
                  }}
                >
                  Email
                </Button>
              )}"""
new_email_btn = """              {data.seller_email && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleOpenEmailDialog}
                  startIcon={<EmailIcon fontSize="small" />}
                  sx={{
                    borderColor: '#1976d2',
                    color: '#1976d2',
                    '&:hover': {
                      borderColor: '#115293',
                      backgroundColor: '#1976d208',
                    },
                  }}
                >
                  Email
                </Button>
              )}"""
text = text.replace(old_email_btn, new_email_btn, 1)

# 7. Snackbarの前にメール送信ダイアログとImageSelectorModalを追加
old_snackbar = """      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>"""
new_snackbar = """      {/* メール送信ダイアログ */}
      <Dialog open={emailDialog.open} onClose={() => setEmailDialog(prev => ({ ...prev, open: false }))} maxWidth="md" fullWidth>
        <DialogTitle>メール送信</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <SenderAddressSelector
              value={senderAddress}
              onChange={(addr) => { setSenderAddress(addr); saveSenderAddress(addr); }}
            />
            <TextField
              label="送信先"
              value={editableEmailRecipient}
              onChange={(e) => setEditableEmailRecipient(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="件名"
              value={editableEmailSubject}
              onChange={(e) => setEditableEmailSubject(e.target.value)}
              fullWidth
              size="small"
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                本文
              </Typography>
              <RichTextEmailEditor
                value={editableEmailBody}
                onChange={setEditableEmailBody}
                placeholder="メール本文を入力してください"
              />
            </Box>
            {/* 画像添付 */}
            <Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowImageSelector(true)}
                sx={{ mb: 1 }}
              >
                画像を選択
              </Button>
              {selectedImages.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selectedImages.map((img) => (
                    <Chip
                      key={img.id}
                      label={img.name}
                      size="small"
                      onDelete={() => setSelectedImages(prev => prev.filter(i => i.id !== img.id))}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialog(prev => ({ ...prev, open: false }))}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleSendEmail}
            disabled={sendingEmail || !editableEmailRecipient}
          >
            {sendingEmail ? '送信中...' : '送信'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 画像選択モーダル */}
      {showImageSelector && (
        <ImageSelectorModal
          open={showImageSelector}
          onClose={() => setShowImageSelector(false)}
          sellerNumber={propertyNumber || ''}
          onSelect={(images) => {
            setSelectedImages(images);
            setShowImageSelector(false);
          }}
          initialSelected={selectedImages}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>"""
text = text.replace(old_snackbar, new_snackbar, 1)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
