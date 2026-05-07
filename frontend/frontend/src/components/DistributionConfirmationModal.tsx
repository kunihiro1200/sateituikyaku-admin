import { useState, useEffect } from 'react';
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
  /** テスト送信モードの場合はtrue（タイトルが変わる） */
  isTestMode?: boolean;
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
  isTestMode = false,
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
          {isTestMode ? 'テスト送信の確認' : 'メール配信の確認'}
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
