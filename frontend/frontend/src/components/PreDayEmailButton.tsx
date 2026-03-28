import { useState } from 'react';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import { InquiryHistoryItem } from './InquiryHistoryTable';
import BuyerEmailCompositionModal from './BuyerEmailCompositionModal';
import { EmailTemplate, EmailData, MergedEmailContent } from '../types/emailTemplate';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const PRE_DAY_TEMPLATE_NAME = '☆内覧前日通知メール';

interface PreDayEmailButtonProps {
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  buyerCompanyName?: string;
  buyerNumber?: string;
  preViewingNotes?: string;
  latestViewingDate?: string;
  viewingTime?: string;
  inquiryHistory: InquiryHistoryItem[];
  selectedPropertyIds: Set<string>;
  size?: 'small' | 'medium' | 'large';
  onEmailSent?: () => void;
}

/**
 * 内覧前日Eメール送信ボタン
 * BuyerViewingResultPage で calculated_status === '内覧日前日' の場合のみ表示される
 * '★内覧前日通知メール' テンプレートのみを使用する
 */
export default function PreDayEmailButton({
  buyerId,
  buyerEmail,
  buyerName,
  buyerCompanyName,
  buyerNumber,
  preViewingNotes,
  latestViewingDate,
  viewingTime,
  selectedPropertyIds,
  size = 'medium',
  onEmailSent,
}: PreDayEmailButtonProps) {
  const [loading, setLoading] = useState(false);
  const [compositionModalOpen, setCompositionModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [mergedContent, setMergedContent] = useState<MergedEmailContent | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { employee } = useAuthStore();

  const isDisabled = loading;

  const handleClick = async () => {
    setLoading(true);
    try {
      // テンプレート一覧を取得して '★内覧前日通知メール' のみ使用
      const templatesRes = await api.get('/api/email-templates');
      const templates: EmailTemplate[] = templatesRes.data;
      const template = templates.find((t) => t.name === PRE_DAY_TEMPLATE_NAME);

      if (!template) {
        setErrorMessage(`${PRE_DAY_TEMPLATE_NAME}テンプレートが見つかりません。スプレッドシートのテンプレートシートに「買主」区分で「${PRE_DAY_TEMPLATE_NAME}」を追加してください。`);
        return;
      }

      setSelectedTemplate(template);

      // mergeMultiple でテンプレートをマージ
      const propertyIds = Array.from(selectedPropertyIds);
      const mergeRes = await api.post(`/api/email-templates/${template.id}/mergeMultiple`, {
        buyer: {
          buyerName,
          name: buyerName,
          company_name: buyerCompanyName || '',
          buyer_number: buyerNumber || '',
          email: buyerEmail,
          pre_viewing_notes: preViewingNotes || '',
          latest_viewing_date: latestViewingDate || '',
          viewing_time: viewingTime || '',
        },
        propertyIds,
        templateSubject: template.subject,
        templateBody: template.body,
      });

      setMergedContent(mergeRes.data);
      setCompositionModalOpen(true);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || `テンプレートの準備に失敗しました: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (emailData: EmailData) => {
    const senderEmail = employee?.email;
    if (!senderEmail) {
      throw new Error('送信者のメールアドレスが取得できません');
    }

    const propertyIds = Array.from(selectedPropertyIds);
    const files = emailData.attachments || [];

    if (files.length > 0) {
      const formData = new FormData();
      formData.append('buyerId', emailData.buyerId);
      formData.append('subject', emailData.subject);
      formData.append('body', emailData.body);
      formData.append('senderEmail', senderEmail);
      if (selectedTemplate?.name) formData.append('templateName', selectedTemplate.name);
      propertyIds.forEach((id) => formData.append('propertyIds[]', id));
      files.forEach((file) => formData.append('attachments', file));
      await api.post('/api/gmail/send', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else {
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
    setSelectedTemplate(null);
    setMergedContent(null);
    onEmailSent?.();
  };

  const handleCancel = () => {
    setCompositionModalOpen(false);
    setSelectedTemplate(null);
    setMergedContent(null);
  };

  return (
    <>
      <Button
        variant="contained"
        size={size}
        startIcon={loading ? <CircularProgress size={20} /> : <EmailIcon />}
        onClick={handleClick}
        disabled={isDisabled}
        sx={{
          backgroundColor: '#e65100',
          color: '#fff',
          fontWeight: 'bold',
          '&:hover': { backgroundColor: '#bf360c' },
          '&:disabled': { backgroundColor: '#ffccbc', color: '#fff' },
          animation: isDisabled ? 'none' : 'preDayPulse 1.5s ease-in-out infinite',
          '@keyframes preDayPulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0.6)' },
            '70%': { boxShadow: '0 0 0 10px rgba(230, 81, 0, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0)' },
          },
        }}
      >
        内覧前日Eメール
      </Button>

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

      <Snackbar open={!!successMessage} autoHideDuration={6000} onClose={() => setSuccessMessage(null)}>
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar open={!!errorMessage} autoHideDuration={6000} onClose={() => setErrorMessage(null)}>
        <Alert severity="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
