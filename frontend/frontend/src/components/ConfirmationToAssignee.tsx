import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Send as SendIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { InlineEditableField } from './InlineEditableField';
import api from '../services/api';

interface ConfirmationToAssigneeProps {
  buyer: {
    buyer_number: string;
    name: string;
    property_number: string;
    confirmation_to_assignee?: string;
  };
  propertyAssignee: string | null;
  onSendSuccess: () => void;
}

export const ConfirmationToAssignee: React.FC<ConfirmationToAssigneeProps> = ({
  buyer,
  propertyAssignee,
  onSendSuccess,
}) => {
  const [confirmationText, setConfirmationText] = useState(buyer.confirmation_to_assignee || '');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasText = confirmationText.trim().length > 0;

  const handleSend = async () => {
    if (!hasText) {
      setError('確認事項を入力してください');
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const currentUrl = window.location.href;

      const response = await api.post(
        `/api/buyers/${buyer.buyer_number}/send-confirmation`,
        {
          confirmationText,
          buyerDetailUrl: currentUrl,
        }
      );

      if (response.data.success) {
        setSuccessMessage('送信しました');
        setError(null);
        onSendSuccess();

        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);
      } else {
        setError(response.data.error || 'メッセージの送信に失敗しました');
        setSuccessMessage(null);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'メッセージの送信に失敗しました';
      setError(errorMessage);
      setSuccessMessage(null);

      console.error('[ConfirmationToAssignee] Send failed:', {
        buyerNumber: buyer.buyer_number,
        error: err.message,
        response: err.response?.data,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleFieldSave = async (newValue: string) => {
    setConfirmationText(newValue);

    try {
      await api.put(`/api/buyers/${buyer.buyer_number}`, {
        confirmation_to_assignee: newValue,
      });
    } catch (err: any) {
      console.error('[ConfirmationToAssignee] Save failed:', err);
      throw new Error('保存に失敗しました');
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <InlineEditableField
        label="担当への確認事項"
        value={confirmationText}
        fieldName="confirmation_to_assignee"
        fieldType="textarea"
        onSave={handleFieldSave}
        readOnly={false}
        buyerId={buyer.buyer_number}
        enableConflictDetection={true}
        alwaysShowBorder={true}
        borderPlaceholder="担当者への確認事項や質問を入力..."
        showEditIndicator={true}
      />

      {hasText && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              担当者 <strong>{propertyAssignee}</strong> に送信
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={isSending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              onClick={handleSend}
              disabled={isSending}
            >
              {isSending ? '送信中...' : '送信'}
            </Button>
          </Box>

          {successMessage && (
            <Alert severity="success" icon={<CheckIcon fontSize="inherit" />} sx={{ mt: 1 }}>
              {successMessage}
            </Alert>
          )}

          {error && (
            <Alert severity="error" icon={<ErrorIcon fontSize="inherit" />} sx={{ mt: 1 }}>
              {error}
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};
