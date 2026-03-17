import { useState, useEffect } from 'react';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import { Email as EmailIcon } from '@mui/icons-material';
import EmailTemplateSelector from './EmailTemplateSelector';
import BuyerFilterSummaryModal from './BuyerFilterSummaryModal';
import DistributionConfirmationModal from './DistributionConfirmationModal';
import gmailDistributionService, { EnhancedBuyerEmailsResponse } from '../services/gmailDistributionService';
import { EmailTemplate, getAllTemplates } from '../utils/gmailDistributionTemplates';
import { getActiveEmployees } from '../services/employeeService';
import { 
  generateGmailComposeUrl, 
  isBccLimitExceeded, 
  limitBccRecipients,
  MAX_BCC_RECIPIENTS 
} from '../utils/gmailComposeUrl';
import api from '../services/api';

interface GmailDistributionButtonProps {
  propertyNumber: string;
  propertyAddress?: string;
  publicUrl?: string;
  distributionAreas?: string;
  salesPrice?: number;
  previousSalesPrice?: number;
  priceReductionHistory?: string;
  propertyType?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
}

const DEFAULT_SENDER = 'tenant@ifoo-oita.com';
const SIGNATURE = `*****************************
株式会社いふう
大分市舞鶴町1-3-30
TEL:097-533-2022
******************************`;

export default function GmailDistributionButton({
  propertyNumber,
  propertyAddress,
  publicUrl,
  distributionAreas,
  salesPrice,
  previousSalesPrice,
  priceReductionHistory,
  propertyType,
  size = 'small',
  variant = 'outlined'
}: GmailDistributionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [filterSummaryOpen, setFilterSummaryOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [buyerData, setBuyerData] = useState<EnhancedBuyerEmailsResponse | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedBuyers, setSelectedBuyers] = useState<Array<{ email: string; name: string | null }>>([]);
  const [senderAddress, setSenderAddress] = useState<string>(DEFAULT_SENDER);
  const [employees, setEmployees] = useState<any[]>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const templates = getAllTemplates();

  // 社員データを取得
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await getActiveEmployees();
        setEmployees(data);
      } catch (error) {
        console.error('Failed to fetch employees:', error);
        setEmployees([]);
      }
    };
    fetchEmployees();
  }, []);

  const handleSenderAddressChange = (address: string) => {
    setSenderAddress(address);
  };

  // 値下げ履歴から前の価格を取得するヘルパー
  const getPrevPriceFromHistory = (history: string | undefined): number | undefined => {
    if (!history) return undefined;
    const lines = history.split('\n').filter((l: string) => l.trim());
    if (lines.length === 0) return undefined;
    // 形式: "K3/17　1850万→1350万" または "K3/17 1850万→1350万"
    const match = lines[0].match(/(\d+(?:\.\d+)?)万→(\d+(?:\.\d+)?)万/);
    if (!match) return undefined;
    return Math.round(parseFloat(match[1]) * 10000);
  };

  // 価格変更テキストを生成
  const generatePriceChangeText = (): string => {
    // previousSalesPrice が未指定の場合、履歴から取得を試みる
    const prevPrice = previousSalesPrice ?? getPrevPriceFromHistory(priceReductionHistory);

    if (prevPrice && salesPrice) {
      const oldMan = Math.floor(prevPrice / 10000);
      const newMan = Math.floor(salesPrice / 10000);
      const diffMan = oldMan - newMan;
      if (diffMan > 0) {
        return `${oldMan}万円 → ${newMan}万円（${diffMan}万円値下げ）`;
      } else if (diffMan < 0) {
        return `${oldMan}万円 → ${newMan}万円（${Math.abs(diffMan)}万円値上げ）`;
      } else {
        return `${oldMan}万円（価格変更なし）`;
      }
    }
    if (salesPrice) {
      return `${Math.floor(salesPrice / 10000)}万円`;
    }
    if (prevPrice) {
      return `${Math.floor(prevPrice / 10000)}万円`;
    }
    return '';
  };

  // 価格テキストを生成（万円表示）
  const getPriceText = (): string => {
    const price = salesPrice || previousSalesPrice;
    if (!price) return '';
    return `${Math.floor(price / 10000)}万円`;
  };

  // テンプレートのプレースホルダーを置換
  const replacePlaceholders = (template: string, buyerName?: string): string => {
    return template
      .replace(/\{address\}/g, propertyAddress || '')
      .replace(/\{propertyNumber\}/g, propertyNumber)
      .replace(/\{publicUrl\}/g, publicUrl || '')
      .replace(/\{priceChangeText\}/g, generatePriceChangeText())
      .replace(/\{propertyType\}/g, propertyType || '')
      .replace(/\{price\}/g, getPriceText())
      .replace(/\{signature\}/g, SIGNATURE)
      .replace(/\{buyerName\}/g, buyerName || '');
  };

  const handleButtonClick = () => {
    if (!senderAddress || senderAddress.trim() === '') {
      setSenderAddress(DEFAULT_SENDER);
    }
    setTemplateSelectorOpen(true);
  };

  const handleTemplateSelect = async (template: EmailTemplate) => {
    setLoading(true);
    setSelectedTemplate(template);
    
    try {
      const result = await gmailDistributionService.fetchQualifiedBuyerEmailsEnhanced(
        propertyNumber,
        true
      );
      
      if (result.count === 0) {
        setSnackbar({
          open: true,
          message: '配信対象の買主が見つかりませんでした',
          severity: 'warning'
        });
        setLoading(false);
        return;
      }

      setBuyerData(result);
      setFilterSummaryOpen(true);
      setTemplateSelectorOpen(false);
    } catch (error: any) {
      console.error('Failed to fetch buyer data:', error);
      setSnackbar({
        open: true,
        message: error.message || '買主データの取得に失敗しました',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSummaryConfirm = (buyers: Array<{ email: string; name: string | null }>) => {
    if (!selectedTemplate || buyers.length === 0) {
      return;
    }
    setSelectedBuyers(buyers);
    setFilterSummaryOpen(false);
    setConfirmationOpen(true);
  };

  const handleConfirmationConfirm = async () => {
    if (!selectedTemplate || selectedBuyers.length === 0) {
      return;
    }

    // 1人選択時は名前を使用、複数時は「お客様」
    const buyerName = selectedBuyers.length === 1 ? (selectedBuyers[0].name || 'お客様') : 'お客様';
    const selectedEmails = selectedBuyers.map(b => b.email);

    try {
      const subject = replacePlaceholders(selectedTemplate.subject, buyerName);
      const body = replacePlaceholders(selectedTemplate.body, buyerName);

      const response = await api.post('/api/emails/send-distribution', {
        recipients: selectedEmails,
        subject: subject,
        body: body,
        senderAddress: senderAddress,
        propertyNumber: propertyNumber
      });

      const result = response.data;
      setConfirmationOpen(false);
      setSenderAddress(DEFAULT_SENDER);

      if (result.failedBatches === 0) {
        setSnackbar({
          open: true,
          message: `メールを送信しました (${result.successCount}件)\n送信元: ${senderAddress}`,
          severity: 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: `メール送信が完了しました\n成功: ${result.successCount}件\n失敗: ${result.failedCount}件`,
          severity: 'warning'
        });
      }
    } catch (error: any) {
      console.error('Failed to send emails via API:', error);
      setSnackbar({
        open: true,
        message: 'API経由での送信に失敗しました。Gmail Web UIで送信します。',
        severity: 'warning'
      });
      setConfirmationOpen(false);
      setSenderAddress(DEFAULT_SENDER);
      fallbackToGmailWebUI(buyerName);
    }
  };

  const fallbackToGmailWebUI = (buyerName?: string) => {
    if (!selectedTemplate || selectedBuyers.length === 0) {
      return;
    }

    const resolvedBuyerName = buyerName || (selectedBuyers.length === 1 ? (selectedBuyers[0].name || 'お客様') : 'お客様');
    const emailsForFallback = selectedBuyers.map(b => b.email);

    try {
      let emailsToSend = emailsForFallback;
      if (isBccLimitExceeded(emailsForFallback)) {
        setSnackbar({
          open: true,
          message: `宛先が${MAX_BCC_RECIPIENTS}件を超えています。最初の${MAX_BCC_RECIPIENTS}件のみ追加されます。`,
          severity: 'warning'
        });
        emailsToSend = limitBccRecipients(emailsForFallback);
      }

      const subject = replacePlaceholders(selectedTemplate.subject, resolvedBuyerName);
      const body = replacePlaceholders(selectedTemplate.body, resolvedBuyerName);

      const gmailUrl = generateGmailComposeUrl({
        bcc: emailsToSend.join(','),
        subject: subject,
        body: body
      });

      const newWindow = window.open(gmailUrl, '_blank');
      
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        setSnackbar({
          open: true,
          message: 'ポップアップがブロックされました。ブラウザの設定を確認してください。',
          severity: 'error'
        });
        return;
      }

      setSenderAddress(DEFAULT_SENDER);
      setSnackbar({
        open: true,
        message: `Gmailを開きました (${emailsToSend.length}件の宛先)\n送信元: ${senderAddress}\n\n内容を確認して、Gmailで送信ボタンを押してください。`,
        severity: 'success'
      });
    } catch (error: any) {
      console.error('Failed to open Gmail:', error);
      setSnackbar({
        open: true,
        message: error.message || 'Gmailを開けませんでした。もう一度お試しください。',
        severity: 'error'
      });
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        startIcon={loading ? <CircularProgress size={16} /> : <EmailIcon />}
        onClick={handleButtonClick}
        disabled={loading}
      >
        公開前、値下げメール
      </Button>

      <EmailTemplateSelector
        open={templateSelectorOpen}
        onClose={() => {
          setTemplateSelectorOpen(false);
          setSenderAddress(DEFAULT_SENDER);
        }}
        onSelect={handleTemplateSelect}
        templates={templates}
        senderAddress={senderAddress}
        onSenderAddressChange={handleSenderAddressChange}
        employees={employees}
      />

      <BuyerFilterSummaryModal
        open={filterSummaryOpen}
        onClose={() => {
          setFilterSummaryOpen(false);
          setSenderAddress(DEFAULT_SENDER);
        }}
        onConfirm={handleFilterSummaryConfirm}
        buyers={(buyerData?.filteredBuyers || []) as any}
        totalBuyers={buyerData?.totalBuyers || 0}
        senderAddress={senderAddress}
        onSenderAddressChange={handleSenderAddressChange}
        employees={employees}
      />

      <DistributionConfirmationModal
        open={confirmationOpen}
        onClose={() => {
          setConfirmationOpen(false);
          setSenderAddress(DEFAULT_SENDER);
        }}
        onConfirm={handleConfirmationConfirm}
        recipientCount={selectedBuyers.length}
        senderAddress={senderAddress}
        onSenderAddressChange={handleSenderAddressChange}
        employees={employees}
        subject={selectedTemplate ? replacePlaceholders(selectedTemplate.subject, selectedBuyers.length === 1 ? (selectedBuyers[0].name || 'お客様') : 'お客様') : ''}
        bodyPreview={selectedTemplate ? replacePlaceholders(selectedTemplate.body, selectedBuyers.length === 1 ? (selectedBuyers[0].name || 'お客様') : 'お客様') : ''}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
