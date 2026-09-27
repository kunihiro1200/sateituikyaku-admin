import { useState } from 'react';
import {
  Button,
  ButtonGroup,
  CircularProgress,
  Snackbar,
  Alert,
  Box,
  Menu,
  MenuItem,
  Chip,
  Typography,
  ListItemText,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { InquiryHistoryItem } from './InquiryHistoryTable';
import TemplateSelectionModal, {
  filterTemplatesByPropertyType,
  filterTemplatesByConditions,
} from './TemplateSelectionModal';
import BuyerEmailCompositionModal from './BuyerEmailCompositionModal';
import { EmailTemplate, EmailData, MergedEmailContent } from '../types/emailTemplate';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

// テンプレート名を正規化して照合する（全角半角・空白の表記揺れを吸収）
function normalizeTemplateName(value: unknown): string {
  return String(value || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

interface BuyerGmailSendButtonProps {
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  buyerCompanyName?: string;
  buyerNumber?: string;
  preViewingNotes?: string;
  followUpAssignee?: string; // 後続担当（署名の担当者情報取得に使用）
  otherCompanyProperty?: string; // 他社物件（物件番号なしの場合に住居表示の代わりに使用）
  inquiryHistory: InquiryHistoryItem[];
  selectedPropertyIds: Set<string>; // チェックボックスで選択された物件ID
  linkedPropertyType?: string; // 紐づき物件の種別（テンプレートフィルタリング用）
  brokerInquiry?: string;      // 業者問合せフィールド
  latestViewingDate?: string;  // 内覧日（最新）
  viewingTime?: string;        // 内覧時間
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
  onEmailSent?: () => void; // メール送信成功後のコールバック
  /**
   * 送信済みメールテンプレートの照合用（正規化テンプレート名の集合）。
   * テンプレート選択モーダルで送信済みテンプレをグレー化＋「送信済み」バッジ表示する。
   */
  sentTemplateNames?: Set<string>;
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
  otherCompanyProperty,
  inquiryHistory,
  selectedPropertyIds,
  linkedPropertyType,
  brokerInquiry,
  latestViewingDate,
  viewingTime,
  size = 'medium',
  variant = 'contained',
  onEmailSent,
  sentTemplateNames,
}: BuyerGmailSendButtonProps) {
  const [loading, setLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [compositionModalOpen, setCompositionModalOpen] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [mergedContent, setMergedContent] = useState<MergedEmailContent | null>(null);
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 右の▽ドロップダウン（SMS送信ボタンと同じ挙動でテンプレを直接表示）
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorEl);
  const [dropdownTemplates, setDropdownTemplates] = useState<EmailTemplate[]>([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);

  // Get current user email from auth store
  const { employee } = useAuthStore();

  // Don't show button if no inquiry history
  if (!inquiryHistory || inquiryHistory.length === 0) {
    return null;
  }

  // 選択数を取得
  const selectedCount = selectedPropertyIds.size;
  // メールアドレスがあればボタンは有効化する（物件未選択はクリック時にエラーメッセージで対応）
  const isDisabled = loading;

  const handleClick = () => {
    // 物件未選択でもテンプレート選択に進む（物件なしの場合は他社物件フィールドを使用）
    setTemplateModalOpen(true);
  };

  // ▽ドロップダウンを開く。開くたびにテンプレを取得してモーダルと同じ条件でフィルタする
  const handleOpenMenu = async (e: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(e.currentTarget);
    setDropdownLoading(true);
    try {
      const response = await api.get('/api/email-templates');
      setDropdownTemplates(response.data);
    } catch (err) {
      console.error('[BuyerGmailSendButton] テンプレート取得失敗:', err);
      setDropdownTemplates([]);
    } finally {
      setDropdownLoading(false);
    }
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
  };

  // ドロップダウンからテンプレを選択 → モーダルと同じ送信フローに乗せる
  const handleMenuTemplateSelect = (template: EmailTemplate) => {
    handleCloseMenu();
    handleTemplateSelect(template);
  };

  // モーダルと同じフィルタ（物件種別・業者問合せ・内覧日）を適用したドロップダウン用一覧
  const filteredDropdownTemplates = filterTemplatesByConditions(
    filterTemplatesByPropertyType(dropdownTemplates, linkedPropertyType),
    brokerInquiry,
    latestViewingDate
  );

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
          broker_inquiry: brokerInquiry || '',
          buyer_number: buyerNumber || '',
          email: buyerEmail,
          pre_viewing_notes: preViewingNotes || '',
          follow_up_assignee: followUpAssignee || '',
          latest_viewing_date: latestViewingDate || '',
          viewing_time: viewingTime || '',
          other_company_property: otherCompanyProperty || '',
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
      const senderEmail = 'tenant@ifoo-oita.com'; // 文字化け防止のため固定

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
      <ButtonGroup
        variant={variant}
        size={size}
        disabled={isDisabled}
        sx={{
          '& .MuiButton-root': {
            backgroundColor: '#2e7d32',
            color: '#fff',
            '&:hover': { backgroundColor: '#1b5e20' },
            '&:disabled': { backgroundColor: '#a5d6a7', color: '#fff' },
          },
          '& .MuiButtonGroup-grouped': {
            borderColor: '#1b5e20 !important',
          },
        }}
      >
        <Button
          startIcon={loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <EmailIcon />}
          onClick={handleClick}
          sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}
        >
          Gmail送信
        </Button>
        <Button
          size="small"
          onClick={handleOpenMenu}
          sx={{ px: 0.5, minWidth: 'unset' }}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>

      {/* ▽ドロップダウン：テンプレを直接一覧表示（SMS送信ボタンと同じUX） */}
      <Menu
        anchorEl={menuAnchorEl}
        open={menuOpen}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { maxHeight: 420, minWidth: 280 } } }}
      >
        {dropdownLoading && (
          <MenuItem disabled sx={{ justifyContent: 'center' }}>
            <CircularProgress size={20} />
          </MenuItem>
        )}
        {!dropdownLoading && filteredDropdownTemplates.length === 0 && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              利用可能なテンプレートがありません
            </Typography>
          </MenuItem>
        )}
        {!dropdownLoading &&
          filteredDropdownTemplates.map((template) => {
            const isSent = !!sentTemplateNames?.has(normalizeTemplateName(template.name));
            return (
              <MenuItem
                key={template.id}
                onClick={() => handleMenuTemplateSelect(template)}
                sx={{
                  backgroundColor: isSent ? '#e0e0e0' : '#ffffff',
                  '&:hover': { backgroundColor: isSent ? '#d6d6d6' : 'action.hover' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {template.name}
                      </Typography>
                    }
                  />
                  {isSent && (
                    <Chip
                      label="送信済み"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        backgroundColor: '#757575',
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Box>
              </MenuItem>
            );
          })}
      </Menu>

      {/* Template Selection Modal */}
      <TemplateSelectionModal
        open={templateModalOpen}
        onSelect={handleTemplateSelect}
        onCancel={handleCancel}
        propertyType={linkedPropertyType}
        brokerInquiry={brokerInquiry}
        latestViewingDate={latestViewingDate}
        sentTemplateNames={sentTemplateNames}
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
