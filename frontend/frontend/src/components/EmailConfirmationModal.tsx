import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Divider,
  CircularProgress,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { Email as EmailIcon, AttachFile, Delete } from '@mui/icons-material';
import { ImageFile } from './ImageSelectorModal';
import ImageSelectorModal from './ImageSelectorModal';

interface EmailConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (subject: string, body: string, attachments: ImageFile[]) => Promise<void>;
  recipientCount: number;
  defaultSubject: string;
  defaultBody: string;
}

export default function EmailConfirmationModal({
  open,
  onClose,
  onConfirm,
  recipientCount,
  defaultSubject,
  defaultBody,
}: EmailConfirmationModalProps) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<ImageFile[]>([]);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);

  // モーダルが開かれたときにデフォルト値と添付ファイルをリセット
  useEffect(() => {
    if (open) {
      setSubject(defaultSubject);
      setBody(defaultBody);
      setAttachments([]);
    }
  }, [open, defaultSubject, defaultBody]);

  const handleConfirm = async () => {
    setSending(true);
    try {
      await onConfirm(subject, body, attachments);
      setAttachments([]);
      onClose();
    } catch (error) {
      // エラーは親コンポーネントで処理される
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      setAttachments([]);
      onClose();
    }
  };

  // 添付ファイル選択確定
  const handleImageSelectorConfirm = (selectedImages: ImageFile[]) => {
    setAttachments(selectedImages);
    setImageSelectorOpen(false);
  };

  // 添付ファイル削除
  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(f => f.id !== id));
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '70vh' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmailIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              メール送信確認
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              送信先: {recipientCount}件の買主
            </Typography>
            <Typography variant="body2" color="warning.main" fontWeight="bold">
              ⚠️ 各買主に個別にメールが送信されます。送信前に内容を確認してください。
            </Typography>
            {recipientCount > 1 && (
              <Typography variant="body2" color="info.main" sx={{ mt: 1 }}>
                💡 本文中の「{'{氏名}'}」は、送信時に各買主の氏名に自動置換されます。
              </Typography>
            )}
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* 件名 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              件名
            </Typography>
            <TextField
              fullWidth
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="件名を入力してください"
              disabled={sending}
            />
          </Box>

          {/* 本文 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              本文
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={15}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="本文を入力してください"
              disabled={sending}
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                }
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              ※ 本文は各買主ごとに個別に送信されます
            </Typography>
          </Box>

          {/* 添付ファイルエリア */}
          <Box>
            <Button
              variant="outlined"
              startIcon={<AttachFile />}
              onClick={() => setImageSelectorOpen(true)}
              disabled={sending}
              size="small"
            >
              画像を添付
              {attachments.length > 0 && (
                <Chip
                  label={`${attachments.length}件`}
                  size="small"
                  color="primary"
                  sx={{ ml: 1 }}
                />
              )}
            </Button>

            {/* 添付ファイル一覧 */}
            {attachments.length > 0 && (
              <List dense sx={{ mt: 1 }}>
                {attachments.map((file) => (
                  <ListItem
                    key={file.id}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleRemoveAttachment(file.id)}
                        disabled={sending}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    }
                    sx={{ py: 0.5 }}
                  >
                    <ListItemText
                      primary={file.name}
                      primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={handleClose}
            disabled={sending}
            variant="outlined"
          >
            キャンセル
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={sending || !subject.trim() || !body.trim()}
            variant="contained"
            startIcon={sending ? <CircularProgress size={16} /> : <EmailIcon />}
          >
            {sending ? '送信中...' : `${recipientCount}件送信`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 画像選択モーダル */}
      <ImageSelectorModal
        open={imageSelectorOpen}
        onConfirm={handleImageSelectorConfirm}
        onCancel={() => setImageSelectorOpen(false)}
        initialSelected={attachments}
      />
    </>
  );
}
