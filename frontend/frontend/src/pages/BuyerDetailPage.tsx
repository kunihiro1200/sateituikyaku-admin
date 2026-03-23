import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Divider,
  CircularProgress,
  IconButton,
  Alert,
  Snackbar,
  List,
  ListItem,
  Tooltip,
  FormControl,
  Select,
  InputLabel,
  MenuItem,
  TextField,
  InputAdornment,
  Link,
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Email as EmailIcon,
  ContentCopy as ContentCopyIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Launch as LaunchIcon,
} from '@mui/icons-material';
import api, { buyerApi } from '../services/api';
import PropertyInfoCard from '../components/PropertyInfoCard';
import InquiryHistoryTable, { InquiryHistoryItem } from '../components/InquiryHistoryTable';
import { InquiryResponseEmailModal } from '../components/InquiryResponseEmailModal';
import RelatedBuyersSection from '../components/RelatedBuyersSection';
import UnifiedInquiryHistoryTable from '../components/UnifiedInquiryHistoryTable';
import RelatedBuyerNotificationBadge from '../components/RelatedBuyerNotificationBadge';
import BuyerGmailSendButton from '../components/BuyerGmailSendButton';
import { SmsDropdownButton } from '../components/SmsDropdownButton';
import PageNavigation from '../components/PageNavigation';
import { InlineEditableField } from '../components/InlineEditableField';
import { useStableContainerHeight } from '../hooks/useStableContainerHeight';
import { useQuickButtonState } from '../hooks/useQuickButtonState';
import { INQUIRY_SOURCE_OPTIONS } from '../utils/buyerInquirySourceOptions';
import { LATEST_STATUS_OPTIONS } from '../utils/buyerLatestStatusOptions';
import { 
  INQUIRY_EMAIL_PHONE_OPTIONS, 
  THREE_CALLS_CONFIRMED_OPTIONS, 
  EMAIL_TYPE_OPTIONS, 
  DISTRIBUTION_TYPE_OPTIONS 
} from '../utils/buyerFieldOptions';
import RichTextCommentEditor, { RichTextCommentEditorHandle } from '../components/RichTextCommentEditor';
import { formatDateTime } from '../utils/dateFormat';
import { getDisplayName } from '../utils/employeeUtils';

interface Buyer {
  [key: string]: any;
}

interface PropertyListing {
  id: string;
  property_number: string;
  address: string;
  display_address?: string;
  property_type: string;
  sales_price: number;
  status: string;
  sales_assignee?: string;
  contract_date?: string;
  settlement_date?: string;
}

interface InquiryHistory {
  buyerNumber: string;
  propertyNumber: string | null;
  inquiryDate: string | null;
  inquirySource: string | null;
  status: string | null;
  isCurrent: boolean;
}

interface Activity {
  id: number;
  action: string;
  target_type: string;
  target_id: number;
  metadata: any;
  created_at: string;
  employee?: {
    id: number;
    name: string;
    initials: string;
  };
}

// フィールドをセクションごとにグループ化
// 問合時ヒアリング用クイック入力ボタンの定義
const INQUIRY_HEARING_QUICK_INPUTS = [
  { label: '初見か', text: '初見か：' },
  { label: '希望時期', text: '希望時期：' },
  { label: '駐車場希望台数', text: '駐車場希望台数：' },
  { label: 'リフォーム予算', text: 'リフォーム込みの予算（最高額）：' },
  { label: '持ち家か', text: '持ち家か：' },
  { label: '他物件', text: '他に気になる物件はあるか？：' },
];

const BUYER_FIELD_SECTIONS = [
  {
    title: '問合せ内容',
    fields: [
      { key: 'inquiry_hearing', label: '問合時ヒアリング', multiline: true, inlineEditable: true },
      { key: 'initial_assignee', label: '初動担当', inlineEditable: true },
      { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },
      { key: 'inquiry_source', label: '問合せ元', inlineEditable: true },
      { key: 'latest_status', label: '★最新状況', inlineEditable: true },
      { key: 'inquiry_email_phone', label: '【問合メール】電話対応', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'three_calls_confirmed', label: '3回架電確認済み', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'email_type', label: 'メール種別', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'distribution_type', label: '配信種別', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'owned_home_hearing', label: '持家ヒアリング', inlineEditable: true },
      // viewing_notes は PropertyInfoCard 内に移動
      { key: 'next_call_date', label: '次電日', type: 'date', inlineEditable: true },
    ],
  },
  {
    title: '基本情報',
    fields: [
      { key: 'buyer_number', label: '買主番号', inlineEditable: true, readOnly: true },
      { key: 'name', label: '氏名・会社名', inlineEditable: true },
      { key: 'phone_number', label: '電話番号', inlineEditable: true },
      { key: 'email', label: 'メールアドレス', inlineEditable: true },
      { key: 'company_name', label: '法人名', inlineEditable: true },
      { key: 'broker_inquiry', label: '業者問合せ', inlineEditable: true, fieldType: 'text', conditionalOn: 'company_name' },
    ],
  },
  {
    title: 'その他',
    fields: [
      { key: 'special_notes', label: '特記事項', multiline: true, inlineEditable: true },
      { key: 'message_to_assignee', label: '担当への伝言/質問事項', multiline: true, inlineEditable: true },
      { key: 'confirmation_to_assignee', label: '担当への確認事項', multiline: true, inlineEditable: true },
      { key: 'family_composition', label: '家族構成', inlineEditable: true },
      { key: 'must_have_points', label: '譲れない点', multiline: true, inlineEditable: true },
      { key: 'liked_points', label: '気に入っている点', multiline: true, inlineEditable: true },
      { key: 'disliked_points', label: 'ダメな点', multiline: true, inlineEditable: true },
      { key: 'purchase_obstacles', label: '購入時障害となる点', multiline: true, inlineEditable: true },
      { key: 'next_action', label: '次のアクション', multiline: true, inlineEditable: true },
    ],
  },
];

export default function BuyerDetailPage() {
  const { buyer_number } = useParams<{ buyer_number: string }>();
  const navigate = useNavigate();
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [linkedProperties, setLinkedProperties] = useState<PropertyListing[]>([]);
  const [nearbyPropertiesCount, setNearbyPropertiesCount] = useState(0);
  const [inquiryHistory, setInquiryHistory] = useState<InquiryHistory[]>([]);
  const [inquiryHistoryTable, setInquiryHistoryTable] = useState<InquiryHistoryItem[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalProperties, setEmailModalProperties] = useState<PropertyListing[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [relatedBuyersCount, setRelatedBuyersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedBuyerNumber, setCopiedBuyerNumber] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // クイックボタンの状態管理
  const { isDisabled: isQuickButtonDisabled, disableButton: disableQuickButton } = useQuickButtonState(buyer_number || '');

  // ヒアリング項目用RichTextEditorのref
  const hearingEditorRef = useRef<RichTextCommentEditorHandle>(null);
  // ヒアリング項目のローカル編集値（HTML）
  const [hearingEditValue, setHearingEditValue] = useState<string>('');
  const [hearingSaving, setHearingSaving] = useState(false);
  // 買主番号検索バー用
  const [buyerNumberSearch, setBuyerNumberSearch] = useState('');

  // 通常スタッフのイニシャル一覧（初動担当選択用）
  const [normalInitials, setNormalInitials] = useState<string[]>([]);

  useEffect(() => {
    api.get('/api/employees/normal-initials')
      .then(res => setNormalInitials(res.data.initials || []))
      .catch(err => console.error('Failed to fetch normal initials:', err));
  }, []);

  // useStableContainerHeightフックを使用して安定した高さ管理
  const { error: heightError } = useStableContainerHeight({
    headerHeight: 64,
    padding: 48,
    minHeight: 400,
    debounceDelay: 200,
  });

  // ビューポート高さ計算エラーのハンドリング
  useEffect(() => {
    if (heightError) {
      console.error('[BuyerDetailPage] Height calculation error:', heightError);
      setSnackbar({
        open: true,
        message: '画面高さの計算でエラーが発生しました。デフォルト値を使用します。',
        severity: 'warning',
      });
    }
  }, [heightError]);

  // Validate buyer_number parameter - support UUID, numeric, and BY_ prefix formats
  const isUuid = buyer_number ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyer_number) : false;
  const isNumericBuyerNumber = buyer_number ? /^\d+$/.test(buyer_number) : false;
  const isByPrefixBuyerNumber = buyer_number ? /^BY_[A-Za-z0-9_]+$/.test(buyer_number) : false;
  const isValidBuyerNumber = isUuid || isNumericBuyerNumber || isByPrefixBuyerNumber;

  useEffect(() => {
    if (buyer_number && isValidBuyerNumber) {
      fetchBuyer();
      fetchLinkedProperties();
      fetchInquiryHistory();
      fetchInquiryHistoryTable();
      fetchRelatedBuyersCount();
      fetchActivities();
    }
  }, [buyer_number, isValidBuyerNumber]);

  const fetchRelatedBuyersCount = async () => {
    try {
      const res = await api.get(`/api/buyers/${buyer_number}/related`);
      setRelatedBuyersCount(res.data.total_count || 0);
    } catch (error) {
      console.error('Failed to fetch related buyers count:', error);
    }
  };

  const scrollToRelatedBuyers = () => {
    const element = document.getElementById('related-buyers-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const fetchBuyer = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/buyers/${buyer_number}`);
      setBuyer(res.data);
      // ヒアリング項目の初期値をセット（HTML形式で保存されている場合はそのまま）
      setHearingEditValue(res.data.inquiry_hearing || '');
    } catch (error) {
      console.error('Failed to fetch buyer:', error);
    } finally {
      setLoading(false);
    }
  };

  // ヒアリング項目の保存ハンドラー
  const handleSaveHearing = async () => {
    if (!buyer) return;
    setHearingSaving(true);
    try {
      const result = await buyerApi.update(
        buyer_number!,
        { inquiry_hearing: hearingEditValue },
        { sync: true }
      );
      setBuyer(result.buyer);
      setHearingEditValue(result.buyer.inquiry_hearing || '');
      setSnackbar({ open: true, message: 'ヒアリング項目を保存しました', severity: 'success' });
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.error || '保存に失敗しました', severity: 'error' });
    } finally {
      setHearingSaving(false);
    }
  };

  // インライン編集用のフィールド更新ハンドラー
  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {
    if (!buyer) return;

    try {
      // 更新するフィールドのみを送信（双方向同期を有効化）
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: true }  // スプレッドシートへの同期を有効化
      );
      
      // 競合がある場合
      if (result.conflicts && result.conflicts.length > 0) {
        console.warn('Sync conflict detected:', result.conflicts);
        setSnackbar({
          open: true,
          message: '同期競合が発生しました。スプレッドシートの値が変更されています。',
          severity: 'warning'
        });
        // ローカル状態は更新（DBには保存されている）
        setBuyer(result.buyer);
        return { success: true };
      }
      
      // ローカル状態を更新
      setBuyer(result.buyer);
      
      // 同期ステータスを表示
      if (result.syncStatus === 'pending') {
        setSnackbar({
          open: true,
          message: '保存しました（スプレッドシート同期は保留中）',
          severity: 'warning'
        });
      } else if (result.syncStatus === 'synced') {
        // 成功時は特にメッセージを表示しない（静かに成功）
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Failed to update field:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || '更新に失敗しました' 
      };
    }
  };

  // 問合時ヒアリング用クイック入力ボタンのクリックハンドラー（RichTextEditor版）
  const handleHearingQuickInput = (text: string, buttonLabel: string) => {
    // カーソル位置に太字で挿入（カーソルなければ現在位置）
    hearingEditorRef.current?.insertAtCursor(`<b>${text}</b>`);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const fetchLinkedProperties = async () => {
    try {
      const res = await api.get(`/api/buyers/${buyer_number}/properties`);
      const properties = res.data || [];
      setLinkedProperties(properties);

      // 近隣物件数を取得（非同期・ページ表示をブロックしない）
      if (properties.length > 0) {
        api.get(`/api/buyers/${buyer_number}/nearby-properties`, {
          params: { propertyNumber: properties[0].property_number },
        }).then(nearbyRes => {
          setNearbyPropertiesCount(nearbyRes.data.nearbyProperties?.length || 0);
        }).catch(() => {
          // 近隣物件取得失敗は無視
        });
      }
    } catch (error) {
      console.error('Failed to fetch linked properties:', error);
    }
  };

  const fetchInquiryHistory = async () => {
    // fetchInquiryHistoryTable と統合済み（重複呼び出し防止）
  };

  const fetchActivities = async () => {
    try {
      const res = await api.get(`/api/activity-logs`, {
        params: {
          target_type: 'buyer',
          target_id: buyer_number,
        },
      });
      setActivities(res.data || []);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  };

  const fetchInquiryHistoryTable = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await api.get(`/api/buyers/${buyer_number}/inquiry-history`);
      
      // Validate response structure
      if (!res.data || !res.data.inquiryHistory) {
        console.error('Invalid response format:', res.data);
        throw new Error('Invalid response format');
      }
      
      const historyData = res.data.inquiryHistory || [];
      setInquiryHistoryTable(historyData);
      setInquiryHistory(historyData); // fetchInquiryHistory と統合（重複API呼び出し防止）
      
      // Automatically select properties with "current" status (今回)
      const currentStatusIds = new Set<string>(
        historyData
          .filter((item: InquiryHistoryItem) => item.status === 'current')
          .map((item: InquiryHistoryItem) => item.propertyNumber)
      );
      setSelectedPropertyIds(currentStatusIds);
    } catch (error: any) {
      console.error('Failed to fetch inquiry history table:', error);
      
      // Set empty array on error to prevent crashes
      setInquiryHistoryTable([]);
      
      // Display user-friendly error message
      const errorMessage = error.response?.status === 404
        ? '買主が見つかりませんでした'
        : error.response?.data?.error || '問い合わせ履歴の取得に失敗しました';
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSelectionChange = (propertyIds: Set<string>) => {
    setSelectedPropertyIds(propertyIds);
  };

  const handleClearSelection = () => {
    setSelectedPropertyIds(new Set());
  };

  const handleGmailSend = async () => {
    // 2.1: Empty selection validation
    if (selectedPropertyIds.size === 0) {
      setSnackbar({
        open: true,
        message: '物件を選択してください',
        severity: 'warning',
      });
      return;
    }

    try {
      // 2.2: Implement resilient property details fetching
      // Fetch full property details for selected properties with individual error handling
      const selectedProperties = await Promise.all(
        Array.from(selectedPropertyIds).map(async (propertyListingId) => {
          try {
            const res = await api.get(`/api/property-listings/${propertyListingId}`);
            return res.data;
          } catch (error: any) {
            // 2.4: Log specific property IDs that failed
            console.error(`Failed to fetch property ${propertyListingId}:`, error);
            // Return null for failed fetches to continue with other properties
            return null;
          }
        })
      );

      // 2.2: Filter out null values (failed fetches)
      const validProperties = selectedProperties.filter(p => p !== null);

      // 2.3: Handle case where all properties failed to fetch
      if (validProperties.length === 0) {
        setSnackbar({
          open: true,
          message: '選択された物件の情報を取得できませんでした',
          severity: 'error',
        });
        return;
      }

      // 2.3 & 2.4: Display warning if some properties failed (partial success)
      if (validProperties.length < selectedProperties.length) {
        const failedCount = selectedProperties.length - validProperties.length;
        setSnackbar({
          open: true,
          message: `${failedCount}件の物件情報を取得できませんでした。取得できた${validProperties.length}件で続行します。`,
          severity: 'warning',
        });
      }

      setEmailModalProperties(validProperties);
      setEmailModalOpen(true);
    } catch (error: any) {
      // 2.4: Provide clear user-friendly error messages
      console.error('Failed to fetch property details:', error);
      
      const errorMessage = error.response?.status === 404
        ? '物件が見つかりませんでした'
        : error.response?.data?.error || '物件情報の取得に失敗しました';
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    }
  };

  const handleEmailSuccess = () => {
    setSelectedPropertyIds(new Set());
    setEmailModalOpen(false);
    setSnackbar({
      open: true,
      message: 'メールを送信しました',
      severity: 'success',
    });
    // Refresh activities to show new email history
    fetchActivities();
  };

  const handleBuyerClick = (buyerNumber: string) => {
    // Navigate to buyer detail page using buyer number
    navigate(`/buyers/${buyerNumber}`);
  };

  const formatValue = (value: any, type?: string) => {
    if (value === null || value === undefined || value === '') return '-';
    
    if (type === 'date') {
      try {
        return new Date(value).toLocaleDateString('ja-JP');
      } catch {
        return value;
      }
    }
    
    if (type === 'price') {
      const num = Number(value);
      if (!isNaN(num)) {
        return `${(num / 10000).toLocaleString()}万円`;
      }
    }
    
    return String(value);
  };

  // Validate buyer_number parameter
  if (!buyer_number || !isValidBuyerNumber) {
    return (
      <Container maxWidth="xl" sx={{ py: 3, px: 2 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" color="error" gutterBottom>
            無効な買主番号です
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            買主番号は有効な数値、UUID、またはBY_形式である必要があります
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate('/buyers')}
          >
            買主一覧に戻る
          </Button>
        </Box>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3, px: 2, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!buyer) {
    return (
      <Container maxWidth="xl" sx={{ py: 3, px: 2 }}>
        <Typography>買主が見つかりませんでした</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/buyers')}>
          一覧に戻る
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ナビゲーションバー + 買主番号検索バー */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 200, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', px: 1, py: 0.5, display: 'flex', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
        <PageNavigation />
        <TextField
          size="small"
          placeholder="買主番号"
          value={buyerNumberSearch}
          onChange={(e) => setBuyerNumberSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && buyerNumberSearch.trim()) {
              navigate(`/buyers/${buyerNumberSearch.trim()}`);
            }
          }}
          sx={{ width: 240 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            endAdornment: buyerNumberSearch ? (
              <InputAdornment position="end">
                <ClearIcon
                  fontSize="small"
                  sx={{ cursor: 'pointer', color: 'text.secondary' }}
                  onClick={() => setBuyerNumberSearch('')}
                />
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            onClick={() => navigate('/buyers')} 
            sx={{ mr: 2 }}
            aria-label="戻る"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" fontWeight="bold">
            {buyer.name ? buyer.name + '様' : buyer.buyer_number}
          </Typography>
          {/* 買主番号コピーChip - 名前の直後に目立つように配置 */}
          <Tooltip title={copiedBuyerNumber ? 'コピーしました！' : '買主番号をコピー'} arrow>
            <Chip
              icon={<ContentCopyIcon fontSize="small" />}
              label={buyer_number}
              size="medium"
              onClick={() => {
                navigator.clipboard.writeText(buyer_number || '');
                setCopiedBuyerNumber(true);
                setTimeout(() => setCopiedBuyerNumber(false), 2000);
              }}
              color="success"
              variant="filled"
              sx={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
            />
          </Tooltip>

          {buyer.latest_status && (
            <Chip label={buyer.latest_status.substring(0, 30)} sx={{ ml: 1 }} />
          )}
          <RelatedBuyerNotificationBadge 
            count={relatedBuyersCount} 
            onClick={scrollToRelatedBuyers}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 近隣物件ボタン */}
          {linkedProperties.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<HomeIcon />}
              onClick={() => {
                const firstProperty = linkedProperties[0];
                window.open(`/buyers/${buyer_number}/nearby-properties?propertyNumber=${firstProperty.property_number}`, '_blank');
              }}
              sx={{ borderRadius: 1 }}
            >
              近隣物件 ({nearbyPropertiesCount})
            </Button>
          )}
          {/* Gmail送信ボタン */}
          <BuyerGmailSendButton
            buyerId={buyer_number || ''}
            buyerEmail={buyer.email || ''}
            buyerName={buyer.name || ''}
            buyerCompanyName={buyer.company_name || ''}
            buyerNumber={buyer_number || ''}
            inquiryHistory={inquiryHistoryTable}
            selectedPropertyIds={selectedPropertyIds}
            size="small"
            variant="contained"
            onEmailSent={fetchActivities}
          />

          {/* 電話番号ボタン */}
          {buyer.phone_number && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<PhoneIcon />}
              onClick={async () => {
                // 発信を先に開始（ページ遷移しないようにwindow.openを使用）
                window.open(`tel:${buyer.phone_number}`, '_self');
                // 通話履歴を記録
                try {
                  await api.post(`/api/buyers/${buyer_number}/call-history`, {
                    phoneNumber: buyer.phone_number,
                  });
                  await fetchActivities();
                } catch (e) {
                  console.error('通話履歴記録失敗:', e);
                }
              }}
              sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', cursor: 'pointer' }}
            >
              {buyer.phone_number}
            </Button>
          )}

          {/* SMS送信ドロップダウン */}
          {buyer.phone_number && (
            <SmsDropdownButton
              phoneNumber={buyer.phone_number}
              buyerName={buyer.name || 'お客様'}
              buyerNumber={buyer_number || ''}
              propertyAddress={linkedProperties[0]?.display_address || linkedProperties[0]?.address || ''}
              propertyType={linkedProperties[0]?.property_type || ''}
              onSmsSent={fetchActivities}
            />
          )}
          {false && buyer.phone_number && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>SMS送信</InputLabel>
              <Select
                value=""
                label="SMS送信"
                onChange={(e) => {
                  const templateId = e.target.value;
                  if (!templateId || !buyer.phone_number) return;
                  const name = buyer.name || 'お客様';
                  const address = linkedProperties[0]?.display_address || linkedProperties[0]?.address || '';
                  const viewingFormBase = 'https://docs.google.com/forms/d/e/1FAIpQLSefXwsYKryraVM4jtnLgcYtboUg3w-lx7tasftVA47E5jXUlQ/viewform?usp=pp_url';
                  const viewingFormUrl = `${viewingFormBase}&entry.267319544=${buyer_number}&entry.2056434590=${encodeURIComponent(address)}`;
                  const publicSiteUrl = 'https://property-site-frontend-kappa.vercel.app/public/properties';
                  let message = '';

                  if (templateId === 'land_no_permission') {
                    message = `${name}様

この度はお問い合わせありがとうございます。
株式会社いふうと申します。

所在地：${address}
上記の物件のお問い合わせ、ありがとうございます。
現地確認につきましては、敷地外からはご自由に見ていただいて大丈夫です。
所在地：${address}
★非公開の物件はこちらから↓↓
${publicSiteUrl}
ご不明な点等ございましたら、お気軽にお問い合わせください。

また、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。

株式会社 いふう
TEL：097-533-2022`;
                  } else if (templateId === 'minpaku') {
                    message = `${name}様

この度はお問い合わせありがとうございます。
株式会社いふうと申します。

所在地：${address}
上記の物件のお問い合わせ、ありがとうございます。
民泊につきましては、民泊新法（営業180日以内）であればどの用途地域でも民泊が可能です。保健所に届け出をする際に「近隣住民に説明したか」が必須の項目になりますので、反対が出た場合は難しい可能性もあります。
ご不明な点等ございましたら、東部保健所（0977-67-2511）へお問い合わせください。

また、ご内覧希望の場合は、こちらからご予約お願いいたします↓↓
${viewingFormUrl}

★お急ぎで内覧をご希望の方は、直接お電話にてお申込みも承っております！
お気軽にお問い合わせください。

また、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。

株式会社 いふう
TEL：097-533-2022`;
                  } else if (templateId === 'land_need_permission') {
                    message = `${name}様

この度はお問い合わせありがとうございます。
株式会社いふうと申します。

所在地：${address}
上記の物件のお問い合わせ、ありがとうございます。
現地確認につきましては、当社で売主様へ許可を取った後に、敷地外からはご自由に見ていただくことになります。
そこで、現地に行かれる日程が決まりましたら下記より日程をご予約いただければと思います

所在地：${address}

${viewingFormUrl}

★非公開の物件はこちらから↓↓
${publicSiteUrl}
ご不明な点等ございましたら、お気軽にお問い合わせください。

また、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡くださいませ。

株式会社 いふう
TEL：097-533-2022`;
                  } else if (templateId === 'offer_no_viewing') {
                    message = `${name}様

この度はお問い合わせありがとうございます。
株式会社いふうと申します。

所在地：${address}

大変申し訳ございませんが、こちらの物件は他のお客様より只今申込みをいただいております。
万が一契約まで至らなかった場合、ご連絡さしあげるという形でよろしいでしょうか？

他に気になる物件がございましたら、他社の物件でもご紹介可能ですので、お気軽にお問い合わせくださいませ。
★非公開の物件はこちらから↓↓
${publicSiteUrl}

株式会社 いふう
TEL：097-533-2022`;
                  } else if (templateId === 'offer_ok_viewing') {
                    message = `${name}様

この度はお問い合わせありがとうございます。
株式会社いふうと申します。

所在地：${address}

大変申し訳ございませんが、こちらの物件は他のお客様より只今申込みをいただいております。
その方が契約に至らない場合もございますので、随時、内覧は可能です。（申込みを頂いた場合は２番手以降となります）
上記をご承知の上、内覧をご希望される場合は、下記ご入力後返信いただくか、お電話で直接受け付けます。
内覧のご予約はこちらから↓↓
${viewingFormUrl}

★非公開の物件はこちらから↓↓
${publicSiteUrl}

周辺エリアで物件をお探しでしたら、メールにて公開前・新着物件をご案内しておりますのでご利用ください。
また、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。

株式会社 いふう
TEL：097-533-2022`;
                  } else if (templateId === 'no_response') {
                    message = `${name}様

先日は${address}のお問い合わせを頂き誠にありがとうございました。
その後物件探しのご状況はいかがでしょうか？
まだ物件をお探しであれば是非いふうにてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。
以前お問合せ頂いた物件に関しまして、ご内覧希望日時を記載してご返信頂きましたら直ぐにご確認可能でございます。
是非一度ご案内させて頂ければ幸いです

内覧のご予約はこちらから↓↓
${viewingFormUrl}

既に当社で別の物件を内覧予定、済でしたら申し訳ございません、本メールは無視してください。
気になる物件がございましたら他社様の物件もご内覧可能です。
★非公開の物件はこちらから↓↓
${publicSiteUrl}
引き続き宜しくお願い致します。

株式会社 いふう
TEL：097-533-2022`;
                  } else if (templateId === 'no_response_offer') {
                    message = `${name}様

先日は${address}のお問い合わせを頂き誠にありがとうございました。
物件案内がご要望に添えず、大変申し訳ございませんでした。
その後物件探しのご状況はいかがでしょうか？
まだ物件をお探しであれば是非いふうにてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。

他に気になる物件がございましたら他社様の物件もご内覧可能です。
★非公開の物件はこちらから↓↓
${publicSiteUrl}
引き続き宜しくお願い致します。

株式会社 いふう
TEL：097-533-2022`;
                  } else if (templateId === 'pinrich') {
                    message = `${name}様
先日は、ご登録いただきましてありがとうございました！その後物件探しのご状況はいかがでしょうか？
まだ物件をお探しであれば是非いふうにてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。

他に気になる物件がございましたら他社様の物件もご内覧可能です。
★非公開の物件はこちらから↓↓
${publicSiteUrl}
引き続き宜しくお願い致します。

株式会社 いふう
TEL：097-533-2022`;
                  } else if (templateId === 'house_mansion') {
                    message = `${name}様

この度はお問い合わせありがとうございます。
株式会社いふうと申します。

所在地：${address}
上記の物件のお問い合わせ、ありがとうございます。
ご不明な点等ございましたら、お気軽にお問い合わせください。

また、ご内覧希望の場合は、こちらからご予約お願いいたします↓↓
${viewingFormUrl}

★非公開の物件はこちらから↓↓
${publicSiteUrl}
お気軽にお問い合わせください。

また、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。

株式会社 いふう
TEL：097-533-2022`;
                  }

                  if (message) {
                    const smsLink = `sms:${buyer.phone_number}?body=${encodeURIComponent(message)}`;
                    window.location.href = smsLink;
                  }
                }}
              >
                <MenuItem value="">テンプレート選択</MenuItem>
                {/* 種別が土地の場合のみ土地用テンプレートを表示 */}
                {linkedProperties[0]?.property_type === '土' ? [
                  <MenuItem key="land_no_permission" value="land_no_permission">資料請求（土）許可不要</MenuItem>,
                  <MenuItem key="minpaku" value="minpaku">民泊問合せ</MenuItem>,
                  <MenuItem key="land_need_permission" value="land_need_permission">資料請求（土）売主要許可</MenuItem>,
                ] : [
                  <MenuItem key="house_mansion" value="house_mansion">資料請求（戸・マ）</MenuItem>,
                ]}
                <MenuItem value="offer_no_viewing">買付あり内覧NG</MenuItem>
                <MenuItem value="offer_ok_viewing">買付あり内覧OK</MenuItem>
                <MenuItem value="no_response">前回問合せ後反応なし</MenuItem>
                <MenuItem value="no_response_offer">反応なし（買付あり不適合）</MenuItem>
                <MenuItem value="pinrich">物件指定なし（Pinrich）</MenuItem>
              </Select>
            </FormControl>
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/inquiry-history`)}
          >
            問合履歴{inquiryHistoryTable.length}件
          </Button>
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/desired-conditions`)}
          >
            希望条件
          </Button>
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/viewing-result`)}
          >
            内覧
          </Button>
        </Box>
      </Box>


      {/* 3カラムレイアウト: 左列に通話・メール履歴、中央列に物件詳細カード、右列に買主情報 */}
      <Box
        sx={{
          display: 'flex',
          gap: 0,
          flex: 1,
          overflow: 'hidden',
          '@media (max-width: 900px)': {
            flexDirection: 'column',
          },
        }}
        role="region"
        aria-label="買主詳細情報の3カラムレイアウト"
      >
        {/* 左列: 通話履歴 + メール・SMS送信履歴 - 独立スクロール */}
        <Box
          sx={{
            flex: '0 0 18%',
            minWidth: 0,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRight: '1px solid',
            borderColor: 'divider',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible', borderRight: 'none', borderBottom: '1px solid', borderColor: 'divider' },
          }}
          role="complementary"
          aria-label="通話・メール履歴"
          tabIndex={0}
        >
          {/* 通話履歴セクション */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PhoneIcon sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="h6">通話履歴</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {activities.filter(a => a.action === 'call' || a.action === 'phone_call').length > 0 ? (
              <List disablePadding>
                {activities
                  .filter(a => a.action === 'call' || a.action === 'phone_call')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((activity) => {
                    const metadata = activity.metadata || {};
                    const emp = activity.employee;
                    // nameから名字を取り出す（例: "国広智子" → "国広"、"国広 智子" → "国広"）
                    const displayName = emp
                      ? (emp.name ? emp.name.split(/[\s　]/)[0] : (emp.initials || '不明'))
                      : '不明';
                    return (
                      <ListItem
                        key={activity.id}
                        sx={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider', py: 1.5 }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(activity.created_at)}
                          </Typography>
                          <Typography variant="caption" fontWeight="bold" color="success.main">
                            {displayName}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          📞 {metadata.phoneNumber || '発信'}
                        </Typography>
                        {(metadata.notes || metadata.memo) && (
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', mt: 0.5 }}>
                            {metadata.notes || metadata.memo}
                          </Typography>
                        )}
                      </ListItem>
                    );
                  })}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                <PhoneIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2">通話履歴はありません</Typography>
              </Box>
            )}
          </Paper>

          {/* メール・SMS送信履歴セクション */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <EmailIcon sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="h6">メール・SMS送信履歴</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {activities.filter(a => a.action === 'email' || a.action === 'sms').length > 0 ? (
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {activities
                  .filter(a => a.action === 'email' || a.action === 'sms')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((activity) => {
                    const metadata = activity.metadata || {};
                    const isSms = activity.action === 'sms';
                    const propertyNumbers = metadata.propertyNumbers || metadata.property_numbers || [];
                    const displayName = activity.employee ? getDisplayName(activity.employee) : '不明';
                    return (
                      <ListItem
                        key={activity.id}
                        sx={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider', py: 2 }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {isSms ? (
                              <Chip label="SMS" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
                            ) : (
                              <Chip label="メール" size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
                            )}
                            <Typography variant="body2" fontWeight="bold">
                              {isSms
                                ? (metadata.templateName || 'テンプレート不明')
                                : (metadata.templateName || metadata.subject || '件名なし')}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(activity.created_at)}
                          </Typography>
                        </Box>
                        {isSms ? (
                          <Box sx={{ width: '100%', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              送信者: {displayName} / 送信先: {metadata.phoneNumber || '-'}
                            </Typography>
                          </Box>
                        ) : (
                          <Box sx={{ width: '100%', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              送信者: {displayName} ({metadata.senderEmail || '-'})
                            </Typography>
                          </Box>
                        )}
                        {!isSms && propertyNumbers.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>物件:</Typography>
                            {propertyNumbers.map((pn: string) => (
                              <Chip key={pn} label={pn} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                            ))}
                          </Box>
                        )}
                        {!isSms && metadata.preViewingNotes && (
                          <Box sx={{ width: '100%', mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>内覧前伝達事項:</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                              {metadata.preViewingNotes}
                            </Typography>
                          </Box>
                        )}
                      </ListItem>
                    );
                  })}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                <EmailIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2">メール送信履歴はありません</Typography>
              </Box>
            )}
          </Paper>
        </Box>

        {/* 中央列: 物件詳細カード - 独立スクロール */}
        <Box
          sx={{
            flex: '0 0 36%',
            minWidth: 0,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRight: '1px solid',
            borderColor: 'divider',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible', borderRight: 'none', borderBottom: '1px solid', borderColor: 'divider' },
          }}
          role="complementary"
          aria-label="物件詳細カード"
          tabIndex={0}
        >
          <Box sx={{ p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              <Typography variant="h6">物件詳細カード</Typography>
              {linkedProperties.map((lp) => (
                <Link
                  key={lp.property_number}
                  href={`https://property-site-frontend-kappa.vercel.app/public/properties/${lp.property_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  {`https://property-site-frontend-kappa.vercel.app/public/properties/${lp.property_number}`}
                  <LaunchIcon sx={{ fontSize: 12 }} />
                </Link>
              ))}
            </Box>
            {linkedProperties.length > 0 ? (
              linkedProperties.map((property) => (
                <Box key={property.id} sx={{ mb: 2 }}>
                  <PropertyInfoCard
                    propertyId={property.property_number}
                    buyer={buyer}
                    onClose={() => {}}
                    showCloseButton={false}
                  />
                </Box>
              ))
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">紐づいた物件はありません</Typography>
              </Paper>
            )}
          </Box>
        </Box>

        {/* 右列: 買主情報フィールド + 関連買主 - 独立スクロール */}
        <Box
          sx={{
            flex: '1 1 46%',
            minWidth: 0,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible' },
          }}
          role="main"
          aria-label="買主情報"
          tabIndex={0}
        >


          {BUYER_FIELD_SECTIONS.map((section) => (
            <Paper 
              key={section.title} 
              sx={{ 
                p: 2, 
                mb: 2,
                // 内覧結果グループには特別なスタイルを適用
                ...(section.isViewingResultGroup && {
                  bgcolor: 'rgba(33, 150, 243, 0.08)',  // 薄い青色の背景
                  border: '1px solid',
                  borderColor: 'rgba(46, 125, 50, 0.3)',
                }),
              }}
            >
              <Typography 
                variant="h6" 
                gutterBottom
                sx={{
                  // 内覧結果グループのタイトルを強調
                  ...(section.isViewingResultGroup && {
                    color: 'success.main',
                    fontWeight: 'bold',
                  }),
                }}
              >
                {section.title}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {section.fields.map((field: any, fieldIndex: number) => {
                  const value = buyer[field.key];
                  
                  // multilineフィールドは全幅で表示
                  const gridSize = field.multiline ? { xs: 12 } : { xs: 12, sm: 6 };

                  // インライン編集可能なフィールド
                  if (field.inlineEditable) {
                    // inquiry_sourceフィールドは特別処理（ドロップダウン）
                    if (field.key === 'inquiry_source') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={INQUIRY_SOURCE_OPTIONS}
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                            validation={(newValue) => {
                              if (buyer.broker_inquiry === '業者問合せ') return null;
                              if (!newValue || !String(newValue).trim()) return '問合せ元は必須です';
                              return null;
                            }}
                          />
                        </Grid>
                      );
                    }

                    // latest_statusフィールドは特別処理（ドロップダウン）
                    if (field.key === 'latest_status') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={LATEST_STATUS_OPTIONS}
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }

                    // inquiry_email_phoneフィールドは特別処理（ドロップダウン）
                    if (field.key === 'inquiry_email_phone') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={INQUIRY_EMAIL_PHONE_OPTIONS}
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }

                    // three_calls_confirmedフィールドは特別処理（ドロップダウン）
                    if (field.key === 'three_calls_confirmed') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={THREE_CALLS_CONFIRMED_OPTIONS}
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }

                    // email_typeフィールドは特別処理（ドロップダウン）
                    if (field.key === 'email_type') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={EMAIL_TYPE_OPTIONS}
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }

                    // distribution_typeフィールドは特別処理（ドロップダウン）
                    if (field.key === 'distribution_type') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={DISTRIBUTION_TYPE_OPTIONS}
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }

                    // initial_assigneeフィールドは特別処理（ボックス選択）
                    if (field.key === 'initial_assignee') {
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {field.label}
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {normalInitials.map((initial) => (
                              <Chip
                                key={initial}
                                label={initial}
                                size="small"
                                onClick={async () => {
                                  const newValue = buyer.initial_assignee === initial ? '' : initial;
                                  await handleInlineFieldSave('initial_assignee', newValue);
                                }}
                                color={buyer.initial_assignee === initial ? 'primary' : 'default'}
                                variant={buyer.initial_assignee === initial ? 'filled' : 'outlined'}
                                sx={{ cursor: 'pointer', fontWeight: buyer.initial_assignee === initial ? 'bold' : 'normal' }}
                              />
                            ))}
                            {/* 現在の値がリストにない場合も表示 */}
                            {buyer.initial_assignee && !normalInitials.includes(buyer.initial_assignee) && (
                              <Chip
                                label={buyer.initial_assignee}
                                size="small"
                                color="primary"
                                variant="filled"
                                sx={{ fontWeight: 'bold' }}
                              />
                            )}
                          </Box>
                        </Grid>
                      );
                    }

                    // broker_inquiryフィールドは特別処理（条件付きドロップダウン）
                    if (field.key === 'broker_inquiry') {
                      // company_name が空の場合は非表示
                      if (!buyer.company_name || !buyer.company_name.trim()) {
                        return null;
                      }
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };
                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="text"
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }

                    // その他のフィールド
                    const handleFieldSave = async (newValue: any) => {
                      const result = await handleInlineFieldSave(field.key, newValue);
                      if (result && !result.success && result.error) {
                        throw new Error(result.error);
                      }
                    };

                    // inquiry_hearingフィールドはRichTextEditorで表示
                    if (field.key === 'inquiry_hearing') {
                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          {/* 問合時ヒアリング用クイック入力ボタン */}
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              ヒアリング項目
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                              {INQUIRY_HEARING_QUICK_INPUTS.map((item) => (
                                <Chip
                                  key={item.label}
                                  label={item.label}
                                  onClick={() => handleHearingQuickInput(item.text, item.label)}
                                  size="small"
                                  clickable
                                  color="success"
                                  variant="outlined"
                                  sx={{ cursor: 'pointer' }}
                                />
                              ))}
                            </Box>
                          </Box>
                          {(() => {
                            const isDirty = hearingEditValue !== (buyer?.inquiry_hearing || '');
                            return (
                              <>
                                <Box sx={{
                                  border: isDirty ? '2px solid #ff6d00' : '2px solid transparent',
                                  borderRadius: 1,
                                  transition: 'border-color 0.2s',
                                }}>
                                  <RichTextCommentEditor
                                    ref={hearingEditorRef}
                                    value={hearingEditValue}
                                    onChange={(html) => setHearingEditValue(html)}
                                    placeholder="ヒアリング内容を入力..."
                                  />
                                </Box>
                                <Button
                                  fullWidth
                                  variant={isDirty ? 'contained' : 'outlined'}
                                  size="large"
                                  onClick={handleSaveHearing}
                                  disabled={hearingSaving}
                                  sx={{
                                    mt: 1,
                                    ...(isDirty ? {
                                      backgroundColor: '#ff6d00',
                                      color: '#fff',
                                      fontWeight: 'bold',
                                      boxShadow: '0 0 0 3px rgba(255,109,0,0.4)',
                                      animation: 'pulse-orange 1.5s infinite',
                                      '@keyframes pulse-orange': {
                                        '0%': { boxShadow: '0 0 0 0 rgba(255,109,0,0.5)' },
                                        '70%': { boxShadow: '0 0 0 8px rgba(255,109,0,0)' },
                                        '100%': { boxShadow: '0 0 0 0 rgba(255,109,0,0)' },
                                      },
                                      '&:hover': { backgroundColor: '#e65100' },
                                    } : {
                                      color: '#bdbdbd',
                                      borderColor: '#e0e0e0',
                                    }),
                                  }}
                                >
                                  {hearingSaving ? '保存中...' : '保存'}
                                </Button>
                              </>
                            );
                          })()}
                        </Grid>
                      );
                    }

                    return (
                      <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                        <InlineEditableField
                          label={field.label}
                          value={value || ''}
                          fieldName={field.key}
                          fieldType={
                            field.type === 'date' ? 'date' :
                            field.multiline ? 'textarea' :
                            'text'
                          }
                          onSave={handleFieldSave}
                          readOnly={field.readOnly === true}
                          buyerId={buyer_number}
                          enableConflictDetection={true}
                          showEditIndicator={!field.readOnly}
                        />
                      </Grid>
                    );
                  }

                  // インライン編集不可のフィールド（通常表示）
                  return (
                    <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                      <Typography variant="caption" color="text.secondary">
                        {field.label}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: field.multiline ? 'pre-wrap' : 'normal' }}>
                        {formatValue(value, field.type)}
                      </Typography>
                    </Grid>
                  );
                })}
              </Grid>
            </Paper>
          ))}


        </Box>
      </Box>



      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* メール送信モーダル */}
      <InquiryResponseEmailModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        selectedProperties={emailModalProperties}
        onSuccess={handleEmailSuccess}
        buyerInfo={buyer ? {
          name: buyer.name || '',
          email: buyer.email || '',
          buyerId: buyer_number || '',
        } : undefined}
      />
    </Box>
  );
}
