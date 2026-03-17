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
  TextField
} from '@mui/material';
import {
  Send as SendIcon,
} from '@mui/icons-material';
import SenderAddressSelector from './SenderAddressSelector';

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
  onBodyChange
}: DistributionConfirmationModalProps) {
  const [sending, setSending] = useState(false);
  const [editedBody, setEditedBody] = useState(bodyPreview);

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

  return (
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
  );
}
