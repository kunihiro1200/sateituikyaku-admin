#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DistributionConfirmationModal.tsx に画像添付UIを追加
GmailDistributionButton.tsx に画像添付の状態管理を追加
"""

# ============================================================
# 1. DistributionConfirmationModal.tsx
# ============================================================
modal_path = 'frontend/frontend/src/components/DistributionConfirmationModal.tsx'
with open(modal_path, 'rb') as f:
    content = f.read().decode('utf-8').replace('\r\n', '\n')

new_content = '''import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  TextField,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import SenderAddressSelector from './SenderAddressSelector';
import ImageSelectorModal from './ImageSelectorModal';

// ImageSelectorModalと同じ型定義
interface ImageFile {
  id: string;
  name: string;
  source: 'drive' | 'local' | 'url';
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  previewUrl: string;
  driveFileId?: string;
  localFile?: File;
  url?: string;
  base64Data?: string;
}

interface DistributionConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  recipientCount: number;
  senderAddress: string;
  onSenderAddressChange: (address: string) => void;
  employees: any[];
  subject: string;
  bodyPreview: string;
  onBodyChange?: (body: string) => void;
  selectedImages?: ImageFile[];
  onImagesChange?: (images: ImageFile[]) => void;
}

export default function DistributionConfirmationModal({
  open,
  onClose,
  onConfirm,
  recipientCount,
  senderAddress,
  onSenderAddressChange,
  employees,
  subject,
  bodyPreview,
  onBodyChange,
  selectedImages = [],
  onImagesChange,
}: DistributionConfirmationModalProps) {
  const [sending, setSending] = useState(false);
  const [editedBody, setEditedBody] = useState(bodyPreview);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);

  // bodyPreview が変わったら内部 state を更新
  useEffect(() => {
    setEditedBody(bodyPreview);
  }, [bodyPreview]);

  const handleBodyChange = (value: string) => {
    setEditedBody(value);
    if (onBodyChange) {
      onBodyChange(value);
    }
  };

  const handleConfirm = async () => {
    setSending(true);
    try {
      await onConfirm();
    } finally {
      setSending(false);
    }
  };

  const handleImagesConfirm = (images: ImageFile[]) => {
    if (onImagesChange) {
      onImagesChange(images);
    }
    setImageSelectorOpen(false);
  };

  const handleRemoveImage = (imageId: string) => {
    if (onImagesChange) {
      onImagesChange(selectedImages.filter(img => img.id !== imageId));
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          メール配信の確認
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            {/* 送信元アドレス選択 */}
            <Box sx={{ mb: 2 }}>
              <SenderAddressSelector
                value={senderAddress}
                onChange={onSenderAddressChange}
                employees={employees}
              />
            </Box>

            {/* 送信情報サマリー */}
            <Box sx={{ mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                送信情報
              </Typography>
              <List dense disablePadding>
                <ListItem disablePadding>
                  <ListItemText
                    primary="送信元"
                    secondary={senderAddress}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
                    secondaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemText
                    primary="送信先"
                    secondary={`${recipientCount}件の買主`}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
                    secondaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemText
                    primary="件名"
                    secondary={subject}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
                    secondaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              </List>
            </Box>

            {/* メール本文（編集可能） */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                メール本文（編集可能）
              </Typography>
              <TextField
                multiline
                fullWidth
                minRows={8}
                maxRows={20}
                value={editedBody}
                onChange={(e) => handleBodyChange(e.target.value)}
                variant="outlined"
                inputProps={{
                  style: {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                  }
                }}
              />
            </Box>

            {/* 画像添付セクション */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" fontWeight="bold">
                  画像添付
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AttachFileIcon />}
                  onClick={() => setImageSelectorOpen(true)}
                >
                  画像を選択
                </Button>
              </Box>
              {selectedImages.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {selectedImages.map((img) => (
                    <Chip
                      key={img.id}
                      icon={<ImageIcon />}
                      label={img.name}
                      onDelete={() => handleRemoveImage(img.id)}
                      deleteIcon={<CloseIcon />}
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  添付画像なし
                </Typography>
              )}
            </Box>

            <Alert severity="warning" sx={{ mb: 2 }}>
              この操作により、{recipientCount}件の買主にメールが送信されます。
              送信後は取り消すことができません。
            </Alert>

            <Alert severity="info">
              送信元アドレス「{senderAddress}」から送信されます。
              Reply-Toも同じアドレスに設定されます。
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={sending}>
            キャンセル
          </Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            color="primary"
            startIcon={sending ? <CircularProgress size={16} /> : <SendIcon />}
            disabled={sending || recipientCount === 0}
          >
            {sending ? '送信中...' : `送信する (${recipientCount}件)`}
          </Button>
        </DialogActions>
      </Dialog>

      <ImageSelectorModal
        open={imageSelectorOpen}
        onConfirm={handleImagesConfirm}
        onCancel={() => setImageSelectorOpen(false)}
      />
    </>
  );
}
'''

with open(modal_path, 'wb') as f:
    f.write(new_content.encode('utf-8'))
print(f'✅ {modal_path} updated')

# ============================================================
# 2. GmailDistributionButton.tsx - 画像添付の状態管理を追加
# ============================================================
button_path = 'frontend/frontend/src/components/GmailDistributionButton.tsx'
with open(button_path, 'rb') as f:
    content = f.read().decode('utf-8').replace('\r\n', '\n')

# ImageFile型のimportを追加（既存のimportブロックの後）
# DistributionConfirmationModalのimportはすでにある

# selectedImages stateを追加
old_state = '''  const [editedBody, setEditedBody] = useState<string>('');
  const [senderAddress, setSenderAddress] = useState<string>(DEFAULT_SENDER);'''

new_state = '''  const [editedBody, setEditedBody] = useState<string>('');
  const [selectedImages, setSelectedImages] = useState<Array<{
    id: string;
    name: string;
    source: 'drive' | 'local' | 'url';
    size: number;
    mimeType: string;
    thumbnailUrl?: string;
    previewUrl: string;
    driveFileId?: string;
    localFile?: File;
    url?: string;
    base64Data?: string;
  }>>([]);
  const [senderAddress, setSenderAddress] = useState<string>(DEFAULT_SENDER);'''

if old_state in content:
    content = content.replace(old_state, new_state)
    print('✅ Added selectedImages state')
else:
    print('❌ Could not find state block')

# handleFilterSummaryConfirmでselectedImagesをリセット
old_filter_confirm = '''  const handleFilterSummaryConfirm = (buyers: Array<{ email: string; name: string | null }>) => {
    if (!selectedTemplate || buyers.length === 0) {
      return;
    }
    setSelectedBuyers(buyers);
    // 確認モーダル表示時に本文を初期化
    const buyerName = buyers.length === 1 ? (buyers[0].name || 'お客様') : 'お客様';
    setEditedBody(replacePlaceholders(selectedTemplate.body, buyerName));
    setFilterSummaryOpen(false);
    setConfirmationOpen(true);
  };'''

new_filter_confirm = '''  const handleFilterSummaryConfirm = (buyers: Array<{ email: string; name: string | null }>) => {
    if (!selectedTemplate || buyers.length === 0) {
      return;
    }
    setSelectedBuyers(buyers);
    // 確認モーダル表示時に本文を初期化
    const buyerName = buyers.length === 1 ? (buyers[0].name || 'お客様') : 'お客様';
    setEditedBody(replacePlaceholders(selectedTemplate.body, buyerName));
    setSelectedImages([]);
    setFilterSummaryOpen(false);
    setConfirmationOpen(true);
  };'''

if old_filter_confirm in content:
    content = content.replace(old_filter_confirm, new_filter_confirm)
    print('✅ Updated handleFilterSummaryConfirm')
else:
    print('❌ Could not find handleFilterSummaryConfirm')

# handleConfirmationConfirmでattachmentsを送信リクエストに含める
old_confirm = '''      const response = await api.post('/api/emails/send-distribution', {
        recipients: selectedEmails,
        subject: subject,
        body: body,
        senderAddress: senderAddress,
        propertyNumber: propertyNumber
      });'''

new_confirm = '''      // ローカルファイルはBase64に変換してから送信
      const attachmentsPayload = await Promise.all(
        selectedImages.map(async (img) => {
          if (img.source === 'local' && img.localFile) {
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                // data:image/jpeg;base64,XXXX → XXXXの部分だけ取り出す
                resolve(result.split(',')[1] || '');
              };
              reader.onerror = reject;
              reader.readAsDataURL(img.localFile!);
            });
            return { ...img, base64Data };
          }
          return img;
        })
      );

      const response = await api.post('/api/emails/send-distribution', {
        recipients: selectedEmails,
        subject: subject,
        body: body,
        senderAddress: senderAddress,
        propertyNumber: propertyNumber,
        attachments: attachmentsPayload.length > 0 ? attachmentsPayload : undefined,
      });'''

if old_confirm in content:
    content = content.replace(old_confirm, new_confirm)
    print('✅ Updated handleConfirmationConfirm')
else:
    print('❌ Could not find handleConfirmationConfirm')

# onCloseでselectedImagesをリセット（confirmationOpen close）
old_close1 = '''        onClose={() => {
          setConfirmationOpen(false);
          setSenderAddress(DEFAULT_SENDER);
        }}
        onConfirm={handleConfirmationConfirm}'''

new_close1 = '''        onClose={() => {
          setConfirmationOpen(false);
          setSenderAddress(DEFAULT_SENDER);
          setSelectedImages([]);
        }}
        onConfirm={handleConfirmationConfirm}'''

if old_close1 in content:
    content = content.replace(old_close1, new_close1)
    print('✅ Updated confirmation onClose')
else:
    print('❌ Could not find confirmation onClose')

# DistributionConfirmationModalにselectedImages/onImagesChangeを渡す
old_modal_props = '''        subject={selectedTemplate ? replacePlaceholders(selectedTemplate.subject, selectedBuyers.length === 1 ? (selectedBuyers[0].name || 'お客様') : 'お客様') : ''}
        bodyPreview={editedBody}
        onBodyChange={setEditedBody}
      />'''

new_modal_props = '''        subject={selectedTemplate ? replacePlaceholders(selectedTemplate.subject, selectedBuyers.length === 1 ? (selectedBuyers[0].name || 'お客様') : 'お客様') : ''}
        bodyPreview={editedBody}
        onBodyChange={setEditedBody}
        selectedImages={selectedImages}
        onImagesChange={setSelectedImages}
      />'''

if old_modal_props in content:
    content = content.replace(old_modal_props, new_modal_props)
    print('✅ Updated DistributionConfirmationModal props')
else:
    print('❌ Could not find DistributionConfirmationModal props')

# 送信後にselectedImagesをリセット
old_after_send = '''      const result = response.data;
      setConfirmationOpen(false);
      setSenderAddress(DEFAULT_SENDER);'''

new_after_send = '''      const result = response.data;
      setConfirmationOpen(false);
      setSenderAddress(DEFAULT_SENDER);
      setSelectedImages([]);'''

if old_after_send in content:
    content = content.replace(old_after_send, new_after_send)
    print('✅ Updated post-send reset')
else:
    print('❌ Could not find post-send reset')

with open(button_path, 'wb') as f:
    f.write(content.encode('utf-8'))
print(f'✅ {button_path} updated')
print('All done!')
