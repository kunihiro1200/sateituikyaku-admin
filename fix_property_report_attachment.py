#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PropertyReportPage.tsx に画像添付機能を追加するスクリプト"""

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. ImageSelectorModal インポートを追加
old_import = "import api from '../services/api';"
new_import = """import api from '../services/api';
import ImageSelectorModal from '../components/ImageSelectorModal';"""
text = text.replace(old_import, new_import, 1)

# 2. ImageIcon インポートを追加
old_icons = """import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Email as EmailIcon,
} from '@mui/icons-material';"""
new_icons = """import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Email as EmailIcon,
  Image as ImageIcon,
} from '@mui/icons-material';"""
text = text.replace(old_icons, new_icons, 1)

# 3. ステートを追加（sending ステートの後）
old_state = """  const [sending, setSending] = useState(false);"""
new_state = """  const [sending, setSending] = useState(false);
  // 画像添付用ステート
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);"""
text = text.replace(old_state, new_state, 1)

# 4. handleSendCancel にリセット処理を追加
old_cancel = """  const handleSendCancel = () => {
    setSendConfirmDialogOpen(false);
    setPendingSendHistory(null);
  };"""
new_cancel = """  const handleSendCancel = () => {
    setSendConfirmDialogOpen(false);
    setPendingSendHistory(null);
    setSelectedImages([]);
    setImageError(null);
  };"""
text = text.replace(old_cancel, new_cancel, 1)

# 5. handleSend を画像添付対応版に置き換え
old_send = """  const handleSend = async () => {
    if (!pendingSendHistory) return;
    setSending(true);
    try {
      // Gmail API で直接送信
      await api.post(`/api/property-listings/${propertyNumber}/send-report-email`, {
        to: editTo,
        subject: editSubject,
        body: editBody,
        template_name: pendingSendHistory.templateName,
        report_date: reportData.report_date || null,
        report_assignee: reportData.report_assignee || null,
        report_completed: reportData.report_completed || 'N',
      });

      setSendConfirmDialogOpen(false);
      setPendingSendHistory(null);
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
  };"""

new_send = """  // 画像添付ハンドラー
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
        });
      }

      setSendConfirmDialogOpen(false);
      setPendingSendHistory(null);
      setSelectedImages([]);
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
  };"""

text = text.replace(old_send, new_send, 1)

# 6. 送信確認ダイアログの本文 TextField の後に画像添付ボタンを追加
old_send_button = """            <Button
              onClick={handleSend}
              variant="contained"
              color="primary"
              size="large"
              disabled={sending || !editTo}
              startIcon={sending ? <CircularProgress size={18} /> : <EmailIcon />}
              sx={{ mt: 1 }}
            >
              {sending ? '送信中...' : '送信'}
            </Button>"""

new_send_button = """            {/* 画像添付ボタン */}
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
            </Button>"""

text = text.replace(old_send_button, new_send_button, 1)

# 7. ImageSelectorModal を末尾のダイアログ群に追加（送信履歴詳細ダイアログの後）
old_end = """      {/* 送信履歴詳細ダイアログ */}"""
new_end = """      {/* 画像選択モーダル */}
      <ImageSelectorModal
        open={imageSelectorOpen}
        onConfirm={handleImageSelectionConfirm}
        onCancel={handleImageSelectionCancel}
      />

      {/* 送信履歴詳細ダイアログ */}"""
text = text.replace(old_end, new_end, 1)

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
