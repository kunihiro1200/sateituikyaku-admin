import { useState } from 'react';
import { Button, CircularProgress, Snackbar, Alert, Typography, Box } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import { InquiryHistoryItem } from './InquiryHistoryTable';
import TemplateSelectionModal from './TemplateSelectionModal';
import BuyerEmailCompositionModal from './BuyerEmailCompositionModal';
import { EmailTemplate, EmailData, MergedEmailContent } from '../types/emailTemplate';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface BuyerGmailSendButtonProps {
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  buyerCompanyName?: string;
  buyerNumber?: string;
  preViewingNotes?: string;
  followUpAssignee?: string; // 後続担当（署名の担当者情報取得に使用）
  inquiryHistory: InquiryHistoryItem[];
  selectedPropertyIds: Set<string>; // チェックボックスで選択された物件ID
  linkedPropertyType?: string; // 紐づき物件の種別（テンプレートフィルタリング用）
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
  onEmailSent?: () => void; // メール送信成功後のコールバック
}

/**
 * Gmail send button for buyer detail page
 * Shows when there is at least one inquiry history record
 * Opens template selection modal when clicked
 * Uses selectedPropertyIds from checkbox selection in InquiryHistoryTable
 */
export default function BuyerGmailSendButton({
  buyerId,
  buyerEmail,
  buyerName,
  buyerCompanyName,
  buyerNumber,
  preViewingNotes,
  followUpAssignee,
  inquiryHistory,
  selectedPropertyIds,
  linkedPropertyType,
  size = 'medium',
  variant = 'contained',
  onEmailSent,
}: BuyerGmailSendButtonProps) {
  const [loading, setLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [compositionModalOpen, setCompositionModalOpen] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [mergedContent, setMergedContent] = useState<MergedEmailContent | null>(null);
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get current user email from auth store
  const { employee } = useAuthStore();

  // Don't show button if no inquiry history
  if (!inquiryHistory || inquiryHistory.length === 0) {
    return null;
  }

  // 選択数を取得
  const selectedCount = selectedPropertyIds.size;
  const isDisabled = selectedCount === 0 || loading;

  const handleClick = () => {
    // 選択物件がない場合はエラーメッセージを表示
    if (selectedCount === 0) {
      setErrorMessage('物件を選択してください');
      return;
    }

    // PropertySelectionModalをスキップして直接テンプレート選択へ
    setTemplateModalOpen(true);
  };

  const handleTemplateSelect = async (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setTemplateModalOpen(false);
    setLoading(true);

    try {
      // 選択された物件IDsを配列に変換
      const propertyIds = Array.from(selectedPropertyIds);
      
      console.log('[BuyerGmailSendButton] mergeMultiple request:', {
        templateId: template.id,
        propertyIds,
        buyerName,
        buyerEmail,
      });
      
      // 複数物件のデータを取得してマージ
      const response = await api.post(`/api/email-templates/${template.id}/mergeMultiple`, {
        buyer: {
          buyerName,
          name: buyerName,
          company_name: buyerCompanyName || '',
          buyer_number: buyerNumber || '',
          email: buyerEmail,
          pre_viewing_notes: preViewingNotes || '',
          follow_up_assignee: followUpAssignee || '',
        },
        propertyIds,
        templateSubject: template.subject,
        templateBody: template.body,
      });

      console.log('[BuyerGmailSendButton] mergeMultiple response:', response.data);
      setMergedContent(response.data);
      setCompositionModalOpen(true);
    } catch (err: any) {
      console.error('[BuyerGmailSendButton] mergeMultiple error:', err.response?.status, err.response?.data, err.message);
      setErrorMessage(err.response?.data?.error || `テンプレートの準備に失敗しました: ${err.response?.status || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (emailData: EmailData) => {
    try {
      const senderEmail = employee?.email;
      if (!senderEmail) {
        throw new Error('送信者のメールアドレスが取得できません');
      }

      const propertyIds = Array.from(selectedPropertyIds);
      const files = emailData.attachments || [];

      if (files.length > 0) {
        // 添付ファイルあり: multipart/form-data で送信
        const formData = new FormData();
        formData.append('buyerId', emailData.buyerId);
        formData.append('subject', emailData.subject);
        formData.append('body', emailData.body);
        formData.append('senderEmail', senderEmail);
        if (selectedTemplate?.name) formData.append('templateName', selectedTemplate.name);
        propertyIds.forEach(id => formData.append('propertyIds[]', id));
        files.forEach(file => formData.append('attachments', file));

        await api.post('/api/gmail/send', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        // 添付なし: JSON で送信
        await api.post('/api/gmail/send', {
          buyerId: emailData.buyerId,
          propertyIds,
          senderEmail,
          subject: emailData.subject,
          body: emailData.body,
          templateName: selectedTemplate?.name,
        });
      }

      setSuccessMessage('メールを送信しました');
      setCompositionModalOpen(false);
      resetState();
      onEmailSent?.();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'メールの送信に失敗しました';
      // タイムアウトエラーの場合は分かりやすいメッセージに変換
      const displayMsg = errMsg.includes('タイムアウト') || errMsg.includes('timeout')
        ? 'メール送信に時間がかかっています。しばらく待ってから再度お試しください。'
        : errMsg;
      throw new Error(displayMsg);
    }
  };

  const resetState = () => {
    setSelectedTemplate(null);
    setMergedContent(null);
  };

  const handleCancel = () => {
    setTemplateModalOpen(false);
    setCompositionModalOpen(false);
    resetState();
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          variant={variant}
          size={size}
          startIcon={loading ? <CircularProgress size={20} /> : <EmailIcon />}
          onClick={handleClick}
          disabled={isDisabled}
          sx={{
            backgroundColor: '#2e7d32',
            color: '#fff',
            '&:hover': { backgroundColor: '#1b5e20' },
            '&:disabled': { backgroundColor: '#a5d6a7', color: '#fff' },
          }}
        >
          Gmail送信
        </Button>
      </Box>

      {/* Template Selection Modal */}
      <TemplateSelectionModal
        open={templateModalOpen}
        onSelect={handleTemplateSelect}
        onCancel={handleCancel}
        propertyType={linkedPropertyType}
      />

      {/* Email Composition Modal */}
      {mergedContent && selectedTemplate && (
        <BuyerEmailCompositionModal
          open={compositionModalOpen}
          buyerId={buyerId}
          buyerEmail={buyerEmail}
          propertyIds={Array.from(selectedPropertyIds)}
          templateId={selectedTemplate.id}
          templateName={selectedTemplate.name}
          mergedContent={mergedContent}
          onSend={handleSendEmail}
          onCancel={handleCancel}
        />
      )}

      {/* Success/Error Notifications */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
      >
        <Alert severity="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
