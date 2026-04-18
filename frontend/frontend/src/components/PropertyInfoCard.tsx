import React from 'react';
import { useState, useEffect } from 'react';
import {
  Paper,
  Box,
  Typography,
  Grid,
  IconButton,
  CircularProgress,
  Alert,
  Button,
  Link,
  Snackbar,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  Launch as LaunchIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api, { propertyListingApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { getSenderAddress, saveSenderAddress } from '../utils/senderAddressStorage';
import RichTextEmailEditor from './RichTextEmailEditor';
import SenderAddressSelector from './SenderAddressSelector';
import ImageSelectorModal from './ImageSelectorModal';
import PurchaseStatusBadge from './PurchaseStatusBadge';
import { getPurchaseStatusText } from '../utils/purchaseStatusUtils';

interface PropertyFullDetails {
  id: number;
  property_number: string;
  atbb_status?: string; // atbb_status
  status?: string; // atbb成約済み/非公開
  distribution_date?: string; // 配信日
  address?: string; // 所在地
  display_address?: string; // 住居表示
  property_type?: string; // 種別
  sales_assignee?: string; // 担当名
  price?: number; // 価格
  listing_price?: number; // 売出価格
  monthly_loan_payment?: number; // 月々ローン支払い
  offer_status?: string; // 買付有無
  price_reduction_history?: string; // 値下げ履歴
  sale_reason?: string; // 理由
  suumo_url?: string; // Suumo URL
  google_map_url?: string; // Google Map URL
  storage_location?: string; // 保存場所
  image_url?: string; // 画像URL
  pdf_url?: string; // PDF URL
  confirmation_status?: string; // 確済
  structure?: string;
  floor_plan?: string;
  land_area?: number;
  building_area?: number;
  pre_viewing_notes?: string; // 内覧前伝達事項（物件リストから取得）
  broker_response?: string; // 業者対応日付

  // 内覧情報（新規追加）
  viewing_key?: string;             // 内覧時（鍵等）
  viewing_parking?: string;         // 内覧時駐車場
  viewing_notes?: string;           // 内覧の時の伝達事項
  viewing_available_date?: string;  // 内覧可能日

  // 売主情報（新規追加）
  seller_contact?: string;          // 連絡先
  seller_email?: string;            // メールアドレス
  seller_name?: string;             // 売主名
}

interface Buyer {
  pre_viewing_notes?: string;
  viewing_notes?: string;
  other_company_property?: string;  // 他社物件
  building_name_price?: string;     // 建物名/価格
  [key: string]: any;
}

interface PropertyInfoCardProps {
  propertyId: string;
  buyer?: Buyer;
  onClose?: () => void;
  showCloseButton?: boolean;
}

// テキスト内のURLを検出してリンク化するヘルパー関数
function renderTextWithLinks(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s\u3000-\u9fff\uff00-\uffef]+)/g;
  const parts = text.split(urlRegex);
  const urlTestRegex = /^https?:\/\//;
  return parts.map((part, index) => {
    if (urlTestRegex.test(part)) {
      return (
        <Link
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ wordBreak: 'break-all' }}
        >
          {part}
        </Link>
      );
    }
    return part;
  });
}

export default function PropertyInfoCard({
  propertyId,
  buyer,
  onClose,
  showCloseButton = true,
}: PropertyInfoCardProps) {
  const navigate = useNavigate();
  const { employee } = useAuthStore();
  const [property, setProperty] = useState<PropertyFullDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedDisplayAddress, setCopiedDisplayAddress] = useState(false);
  // この物件に「買」を含むlatest_statusの買主がいるか
  const [propertyHasBuyerPurchase, setPropertyHasBuyerPurchase] = useState<string | null>(null);

  // メール送信ダイアログ関連
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // テンプレートメニュー関連
  const [propertyEmailTemplates, setPropertyEmailTemplates] = useState<
    Array<{ id: string; name: string; subject: string; body: string }>
  >([]);
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<null | HTMLElement>(null);

  // 送信元・返信先
  const [senderAddress, setSenderAddress] = useState<string>(getSenderAddress());
  const [replyTo, setReplyTo] = useState<string>('');
  const [jimuStaff, setJimuStaff] = useState<Array<{ initials: string; name: string; email?: string }>>([]);

  // 画像添付
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [showImageSelector, setShowImageSelector] = useState(false);

  useEffect(() => {
    fetchPropertyDetails();
    fetchPropertyBuyerPurchaseStatus();
    fetchJimuStaff();

    // 物件リストの変更を検知するため30秒ごとに再フェッチ
    const intervalId = setInterval(() => {
      fetchPropertyDetails(true); // バックグラウンド再フェッチ（ローディング表示なし）
    }, 30000);

    return () => clearInterval(intervalId);
  }, [propertyId]);

  // この物件に紐づく買主の中に「買」を含むlatest_statusの人がいるか確認
  const fetchPropertyBuyerPurchaseStatus = async () => {
    try {
      const response = await api.get(`/api/property-listings/${propertyId}/buyers`);
      const buyers: any[] = response.data || [];
      const buyerWithPurchase = buyers.find((b: any) => b.latest_status && b.latest_status.includes('買'));
      setPropertyHasBuyerPurchase(buyerWithPurchase ? buyerWithPurchase.latest_status : null);
    } catch {
      // エラー時は非表示のまま
    }
  };

  const fetchJimuStaff = async () => {
    try {
      const response = await api.get('/api/employees/jimu-staff');
      setJimuStaff(response.data || []);
    } catch (err) {
      console.error('Failed to fetch jimu staff:', err);
    }
  };

  const fetchPropertyDetails = async (background = false) => {
    try {
      if (!background) setLoading(true);
      setError(null);
      const response = await api.get(`/api/property-listings/${propertyId}`);
      setProperty(response.data);
    } catch (err: any) {
      console.error('Failed to fetch property details:', err);
      if (err.response?.status === 404) {
        setError('物件情報が見つかりません');
      } else if (err.response?.status === 403) {
        setError('アクセス権限がありません');
      } else {
        setError('物件情報の取得に失敗しました');
      }
    } finally {
      if (!background) setLoading(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return '-';
    return `${(price / 10000).toLocaleString()}万円`;
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('ja-JP');
    } catch {
      return date;
    }
  };

  const handleNavigateToProperty = () => {
    if (property) {
      window.open(`/property-listings/${property.property_number}`, '_blank');
    }
  };

  const handleCopyPropertyNumber = async () => {
    if (!property?.property_number) return;

    try {
      await navigator.clipboard.writeText(property.property_number);
      setSnackbarMessage('物件番号をコピーしました');
      setSnackbarOpen(true);
    } catch (err) {
      console.error('Failed to copy property number:', err);
      setSnackbarMessage('コピーに失敗しました');
      setSnackbarOpen(true);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // 電話発信 + 履歴記録
  const handlePhoneCall = async (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber}`;
    try {
      await propertyListingApi.post(
        `/api/property-listings/${property?.property_number}/seller-send-history`,
        {
          chat_type: 'seller_sms',
          subject: '電話発信',
          message: phoneNumber,
          sender_name: employee?.name || employee?.initials || '不明',
        }
      );
    } catch (err) {
      console.error('Failed to save phone call history:', err);
    }
  };

  // メール送信ボタンクリック → テンプレート一覧取得
  const handleEmailButtonClick = async (event: React.MouseEvent<HTMLElement>) => {
    try {
      const response = await api.get('/api/email-templates/property-non-report');
      setPropertyEmailTemplates(response.data || []);
      setTemplateMenuAnchor(event.currentTarget);
    } catch (err) {
      console.error('Failed to fetch email templates:', err);
      setSnackbarMessage('テンプレートの取得に失敗しました');
      setSnackbarOpen(true);
    }
  };

  // テンプレート選択 → merge → ダイアログ表示
  const handleSelectTemplate = async (templateId: string, templateName: string) => {
    setTemplateMenuAnchor(null);
    try {
      const response = await api.post('/api/email-templates/property/merge', {
        templateId,
        propertyNumber: property?.property_number,
      });
      setEmailSubject(response.data.subject || '');
      setEmailBody(response.data.body || '');
      setEmailRecipient(property?.seller_email || '');
      setSelectedTemplateName(templateName);
      setEmailDialogOpen(true);
    } catch (err) {
      console.error('Failed to merge template:', err);
      setSnackbarMessage('テンプレートの適用に失敗しました');
      setSnackbarOpen(true);
    }
  };

  // メール送信実行 + 履歴記録
  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const attachments = selectedImages.map((img: any) => ({
        id: img.id || img.name,
        name: img.name,
        base64Data: img.base64Data,
        mimeType: img.mimeType || 'image/jpeg',
        url: img.url,
      }));

      await api.post(
        `/api/emails/by-seller-number/${property?.property_number}/send-template-email`,
        {
          templateId: 'custom',
          to: emailRecipient,
          subject: emailSubject,
          content: emailBody,
          htmlBody: emailBody,
          from: senderAddress,
          replyTo: replyTo || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        }
      );

      // 送信履歴を記録
      try {
        await propertyListingApi.post(
          `/api/property-listings/${property?.property_number}/seller-send-history`,
          {
            chat_type: 'seller_email',
            subject: selectedTemplateName || emailSubject,
            message: emailBody,
            sender_name: employee?.name || employee?.initials || '不明',
          }
        );
      } catch (historyErr) {
        console.error('Failed to save email send history:', historyErr);
      }

      setSnackbarMessage('メールを送信しました');
      setSnackbarOpen(true);
      handleEmailDialogClose();
    } catch (err: any) {
      console.error('Failed to send email:', err);
      const errorMessage = err.response?.data?.error?.message || 'メールの送信に失敗しました';
      setSnackbarMessage(errorMessage);
      setSnackbarOpen(true);
    } finally {
      setSendingEmail(false);
    }
  };

  // ダイアログキャンセル
  const handleEmailDialogClose = () => {
    setEmailDialogOpen(false);
    setEmailSubject('');
    setEmailBody('');
    setEmailRecipient('');
    setSelectedTemplateName('');
    setSelectedImages([]);
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, mb: 3, position: 'relative' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3, mb: 3, position: 'relative', bgcolor: '#fff3f3' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold" color="error">
            物件情報
          </Typography>
          {showCloseButton && onClose && (
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="outlined" size="small" onClick={fetchPropertyDetails}>
          再試行
        </Button>
      </Paper>
    );
  }

  if (!property) {
    return null;
  }

  return (
    <Paper
      sx={{
        p: 3,
        mb: 3,
        position: 'relative',
        border: '2px solid',
        borderColor: 'success.main',
        bgcolor: '#f1f8f1',
      }}
    >
      {/* 買付状況バッジ - 最上部に表示（この物件に買付買主がいれば全員に表示） */}
      <PurchaseStatusBadge
        statusText={getPurchaseStatusText(
          propertyHasBuyerPurchase || buyer?.latest_status,
          property?.offer_status
        )}
      />
      {/* Header - 外部リンクアイコンと閉じるボタンのみ */}
      <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
        <IconButton size="small" onClick={handleNavigateToProperty} color="success">
          <OpenInNewIcon fontSize="small" />
        </IconButton>
        {showCloseButton && onClose && (
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      {/* Property Details */}
      <Grid container spacing={2}>
        {/* 業者対応日付（今日より後の場合のみ目立つ表示） */}
        {property.broker_response && (() => {
          try {
            let brokerDateValue: any = property.broker_response;

            // Excelシリアル値の場合は変換
            if (typeof brokerDateValue === 'number' || !isNaN(Number(brokerDateValue))) {
              const serialNumber = Number(brokerDateValue);
              const excelEpoch = new Date(1900, 0, 1);
              const daysOffset = serialNumber - 2;
              brokerDateValue = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }

            const now = new Date();
            const tokyoNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
            const tokyoToday = new Date(tokyoNow.getFullYear(), tokyoNow.getMonth(), tokyoNow.getDate());

            const brokerDate = new Date(brokerDateValue);
            const tokyoBrokerDate = new Date(brokerDate.getFullYear(), brokerDate.getMonth(), brokerDate.getDate());

            if (tokyoBrokerDate > tokyoToday) {
              const formattedDate = `${tokyoBrokerDate.getFullYear()}/${String(tokyoBrokerDate.getMonth() + 1).padStart(2, '0')}/${String(tokyoBrokerDate.getDate()).padStart(2, '0')}`;
              return (
                <Grid item xs={12}>
                  <Box
                    sx={{
                      px: 3,
                      py: 1.5,
                      background: '#ffeb3b',
                      borderRadius: 1,
                      border: '3px solid #d32f2f',
                      boxShadow: '0 0 20px rgba(244, 67, 54, 0.6)',
                      animation: 'blink 1.5s infinite, shake 0.5s infinite',
                      '@keyframes blink': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.8 },
                      },
                      '@keyframes shake': {
                        '0%, 100%': { transform: 'translateX(0)' },
                        '25%': { transform: 'translateX(-2px)' },
                        '75%': { transform: 'translateX(2px)' },
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        color: '#d32f2f',
                        fontWeight: 'bold',
                        fontSize: '1.3rem',
                        letterSpacing: '0.05em',
                        textAlign: 'center',
                      }}
                    >
                      ⚠️ 業者対応: {formattedDate} ⚠️
                    </Typography>
                  </Box>
                </Grid>
              );
            }
          } catch (error) {
            console.error('Failed to parse broker_response date:', error);
          }
          return null;
        })()}

        {/* 1行目: 物件番号 + atbb_status + 配信日 */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap' }}>
            {/* 物件番号 */}
            <Box sx={{ flex: '0 0 auto' }}>
              <Typography variant="caption" color="text.secondary">
                物件番号
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Typography variant="body1" fontWeight="bold" color="success.main">
                  {property.property_number}
                </Typography>
                <IconButton
                  size="small"
                  onClick={handleCopyPropertyNumber}
                  aria-label="物件番号をコピー"
                  sx={{
                    padding: '4px',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>

            {/* atbb_status */}
            {property.atbb_status && (
              <Box sx={{ flex: '0 0 auto' }}>
                <Typography variant="caption" color="text.secondary">
                  ステータス
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    color={property.atbb_status.includes('非公開') ? 'error.main' : 'text.secondary'}
                  >
                    {property.atbb_status}
                  </Typography>
                  {property.atbb_status === '一般・公開中' && (
                    <Typography
                      variant="caption"
                      color="error.main"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      ⚠ 一般媒介なので売主様に状況確認してください
                    </Typography>
                  )}
                </Box>
              </Box>
            )}

            {/* 配信日 */}
            {property.distribution_date && (
              <Box sx={{ flex: '0 0 auto' }}>
                <Typography variant="caption" color="text.secondary">
                  配信日
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {formatDate(property.distribution_date)}
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>

        {/* 2行目: 所在地 + 住居表示 */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {/* 所在地 */}
            {property.address && (
              <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                <Typography variant="caption" color="text.secondary">
                  所在地
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <Typography variant="body2">
                    {property.address}
                  </Typography>
                  <Tooltip title={copiedAddress ? 'コピーしました' : '所在地をコピー'}>
                    <IconButton size="small" onClick={async () => {
                      await navigator.clipboard.writeText(property.address!);
                      setCopiedAddress(true);
                      setTimeout(() => setCopiedAddress(false), 2000);
                    }} sx={{ color: copiedAddress ? 'success.main' : 'text.secondary' }}>
                      {copiedAddress ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            )}

            {/* 住居表示 */}
            {property.display_address && (
              <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                <Typography variant="caption" color="text.secondary">
                  住居表示
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <Typography variant="body2">
                    {property.display_address}
                  </Typography>
                  <Tooltip title={copiedDisplayAddress ? 'コピーしました' : '住居表示をコピー'}>
                    <IconButton size="small" onClick={async () => {
                      await navigator.clipboard.writeText(property.display_address!);
                      setCopiedDisplayAddress(true);
                      setTimeout(() => setCopiedDisplayAddress(false), 2000);
                    }} sx={{ color: copiedDisplayAddress ? 'success.main' : 'text.secondary' }}>
                      {copiedDisplayAddress ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            )}
          </Box>
        </Grid>

        {/* 内覧前伝達事項（物件側から取得） */}
        {property.pre_viewing_notes && (
          <Grid item xs={12}>
            <Box
              sx={{
                p: 2,
                bgcolor: '#fff9e6',
                borderRadius: 1,
                border: '1px solid #f0e5c0',
              }}
            >
              <Typography variant="caption" color="text.secondary" fontWeight="bold">
                内覧前伝達事項
              </Typography>
              <Typography
                variant="body2"
                component="div"
                sx={{
                  mt: 1,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  color: '#555',
                  lineHeight: 1.5,
                }}
              >
                {renderTextWithLinks(property.pre_viewing_notes)}
              </Typography>
            </Box>
          </Grid>
        )}

        {/* 種別 */}
        {property.property_type && (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              種別
            </Typography>
            <Typography variant="body2">
              {property.property_type}
            </Typography>
          </Grid>
        )}

        {/* 担当名 */}
        {property.sales_assignee && (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              担当名
            </Typography>
            <Typography variant="body2">
              {property.sales_assignee}
            </Typography>
          </Grid>
        )}

        {/* 価格 + Suumo URL + Google Map */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* 価格 */}
            {(property.price || property.listing_price) && (
              <Box sx={{ flex: '0 0 auto' }}>
                <Typography variant="caption" color="text.secondary">
                  価格
                </Typography>
                <Typography variant="body2" fontWeight="bold" sx={{ mt: 0.5 }}>
                  {formatPrice(property.price || property.listing_price)}
                </Typography>
              </Box>
            )}

            {/* Suumo URL */}
            {property.suumo_url && (
              <Box sx={{ flex: '0 0 auto' }}>
                <Typography variant="caption" color="text.secondary">
                  Suumo URL
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Link
                    href={property.suumo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <Typography variant="body2">
                      Suumoで開く
                    </Typography>
                    <LaunchIcon fontSize="small" />
                  </Link>
                </Box>
              </Box>
            )}

            {/* Google Map URL */}
            {property.google_map_url && (
              <Box sx={{ flex: '0 0 auto' }}>
                <Typography variant="caption" color="text.secondary">
                  Google Map
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Link
                    href={property.google_map_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <Typography variant="body2">
                      地図を開く
                    </Typography>
                    <LaunchIcon fontSize="small" />
                  </Link>
                </Box>
              </Box>
            )}

            {/* 保存場所 */}
            {property.storage_location && (
              <Box sx={{ flex: '0 0 auto' }}>
                <Typography variant="caption" color="text.secondary">
                  保存場所
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Link
                    href={property.storage_location}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <Typography variant="body2">保存場所を開く</Typography>
                    <LaunchIcon fontSize="small" />
                  </Link>
                </Box>
              </Box>
            )}

            {/* 画像 */}
            {property.image_url && (
              <Box sx={{ flex: '0 0 auto' }}>
                <Typography variant="caption" color="text.secondary">
                  画像
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Link
                    href={property.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <Typography variant="body2">画像を開く</Typography>
                    <LaunchIcon fontSize="small" />
                  </Link>
                </Box>
              </Box>
            )}

            {/* PDF */}
            {property.pdf_url && (
              <Box sx={{ flex: '0 0 auto' }}>
                <Typography variant="caption" color="text.secondary">
                  PDF
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Link
                    href={property.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <Typography variant="body2">PDFを開く</Typography>
                    <LaunchIcon fontSize="small" />
                  </Link>
                </Box>
              </Box>
            )}
          </Box>
        </Grid>

        {/* 月々ローン支払い */}
        {property.monthly_loan_payment && (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              月々ローン支払い
            </Typography>
            <Typography variant="body2">
              {formatPrice(property.monthly_loan_payment)}
            </Typography>
          </Grid>
        )}

        {/* 買付有無 */}
        {property.offer_status && (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              買付有無
            </Typography>
            <Typography variant="body2">
              {property.offer_status}
            </Typography>
          </Grid>
        )}

        {/* 値下げ履歴 + 理由 */}
        {(property.price_reduction_history || property.sale_reason) && (
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* 値下げ履歴 */}
              {property.price_reduction_history && (
                <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                  <Typography variant="caption" color="text.secondary">
                    値下げ履歴
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                    {property.price_reduction_history}
                  </Typography>
                </Box>
              )}

              {/* 理由 */}
              {property.sale_reason && (
                <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                  <Typography variant="caption" color="text.secondary">
                    理由
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {property.sale_reason}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        )}


        {/* 内覧情報セクション */}
        {(property.viewing_key || property.viewing_parking ||
          property.viewing_notes || property.viewing_available_date) && (
          <Grid item xs={12}>
            <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 1, border: '1px solid #bbdefb' }}>
              <Typography variant="caption" fontWeight="bold">
                内覧情報
              </Typography>
              {property.viewing_key && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    内覧時（鍵等）
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {property.viewing_key}
                  </Typography>
                </Box>
              )}
              {property.viewing_parking && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    内覧時駐車場
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {property.viewing_parking}
                  </Typography>
                </Box>
              )}
              {property.viewing_notes && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    内覧の時の伝達事項
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {property.viewing_notes}
                  </Typography>
                </Box>
              )}
              {property.viewing_available_date && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    内覧可能日
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {property.viewing_available_date}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        )}
        {/* 売主情報セクション */}
        {(property.seller_name || property.seller_contact ||
          property.seller_email || property.sale_reason) && (
          <Grid item xs={12}>
            <Box sx={{ p: 2, bgcolor: '#fff3e0', borderRadius: 1, border: '1px solid #ffe0b2' }}>
              <Typography variant="caption" fontWeight="bold">
                売主情報
              </Typography>
              {property.seller_name && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    売主名前
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {property.seller_name}
                  </Typography>
                </Box>
              )}
              {property.seller_contact && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    連絡先
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <Link
                      href={`tel:${property.seller_contact}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handlePhoneCall(property.seller_contact!);
                      }}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <PhoneIcon sx={{ fontSize: 16 }} />
                      <Typography variant="body2">
                        {property.seller_contact}
                      </Typography>
                    </Link>
                  </Box>
                </Box>
              )}
              {property.seller_email && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    メールアドレス
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <Typography variant="body2">
                      {property.seller_email}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleEmailButtonClick}
                      color="primary"
                      aria-label="メール送信"
                    >
                      <EmailIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                </Box>
              )}
              {property.sale_reason && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    売却理由
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {property.sale_reason}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        )}
        {/* 確済 */}
        {property.confirmation_status && (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              確済
            </Typography>
            <Typography variant="body2">
              {property.confirmation_status}
            </Typography>
          </Grid>
        )}

        {/* 追加情報 */}
        {property.structure && (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              構造
            </Typography>
            <Typography variant="body2">
              {property.structure}
            </Typography>
          </Grid>
        )}

        {property.floor_plan && (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              間取り
            </Typography>
            <Typography variant="body2">
              {property.floor_plan}
            </Typography>
          </Grid>
        )}

        {property.land_area && (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              土地面積
            </Typography>
            <Typography variant="body2">
              {property.land_area}㎡
            </Typography>
          </Grid>
        )}

        {property.building_area && (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              建物面積
            </Typography>
            <Typography variant="body2">
              {property.building_area}㎡
            </Typography>
          </Grid>
        )}

      </Grid>

      {/* Footer - Navigate to full property detail */}
      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleNavigateToProperty}
          endIcon={<OpenInNewIcon />}
        >
          物件詳細ページを開く
        </Button>
      </Box>

      {/* テンプレート選択メニュー */}
      <Menu
        anchorEl={templateMenuAnchor}
        open={Boolean(templateMenuAnchor)}
        onClose={() => setTemplateMenuAnchor(null)}
      >
        {propertyEmailTemplates.map((template) => (
          <MenuItem
            key={template.id}
            onClick={() => handleSelectTemplate(template.id, template.name)}
          >
            {template.name}
          </MenuItem>
        ))}
        {propertyEmailTemplates.length === 0 && (
          <MenuItem disabled>テンプレートがありません</MenuItem>
        )}
      </Menu>

      {/* メール送信ダイアログ */}
      <Dialog
        open={emailDialogOpen}
        onClose={handleEmailDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>メール送信</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* 送信元アドレス */}
            <SenderAddressSelector
              value={senderAddress}
              onChange={(value) => {
                setSenderAddress(value);
                saveSenderAddress(value);
              }}
            />

            {/* 返信先 */}
            <FormControl fullWidth size="small">
              <InputLabel>返信先（Reply-To）</InputLabel>
              <Select
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                label="返信先（Reply-To）"
              >
                <MenuItem value="">なし</MenuItem>
                {jimuStaff.map((staff) => (
                  <MenuItem key={staff.initials} value={staff.email || ''}>
                    {staff.name}（{staff.initials}）
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* 送信先 */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                送信先
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {emailRecipient}
              </Typography>
            </Box>

            {/* 件名 */}
            <FormControl fullWidth>
              <InputLabel shrink>件名</InputLabel>
              <Box sx={{ mt: 2 }}>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </Box>
            </FormControl>

            {/* 本文 */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                本文
              </Typography>
              <Box sx={{ mt: 1 }}>
                <RichTextEmailEditor
                  value={emailBody}
                  onChange={setEmailBody}
                />
              </Box>
            </Box>

            {/* 画像添付 */}
            <Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowImageSelector(true)}
              >
                画像を添付
              </Button>
              {selectedImages.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {selectedImages.map((img: any, index: number) => (
                    <Chip
                      key={index}
                      label={img.name}
                      onDelete={() => {
                        setSelectedImages(selectedImages.filter((_: any, i: number) => i !== index));
                      }}
                      size="small"
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEmailDialogClose} disabled={sendingEmail}>
            キャンセル
          </Button>
          <Button
            onClick={handleSendEmail}
            variant="contained"
            disabled={sendingEmail || !emailRecipient}
          >
            {sendingEmail ? '送信中...' : '送信'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 画像選択モーダル */}
      {showImageSelector && (
        <ImageSelectorModal
          open={showImageSelector}
          onClose={() => setShowImageSelector(false)}
          onSelect={(images: any[]) => {
            setSelectedImages(images);
            setShowImageSelector(false);
          }}
        />
      )}

      {/* Snackbar for copy notification */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Paper>
  );
}
