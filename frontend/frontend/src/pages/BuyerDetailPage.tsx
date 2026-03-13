import { useState, useEffect } from 'react';
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
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Email as EmailIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import api, { buyerApi } from '../services/api';
import PropertyInfoCard from '../components/PropertyInfoCard';
import InquiryHistoryTable, { InquiryHistoryItem } from '../components/InquiryHistoryTable';
import { InquiryResponseEmailModal } from '../components/InquiryResponseEmailModal';
import RelatedBuyersSection from '../components/RelatedBuyersSection';
import UnifiedInquiryHistoryTable from '../components/UnifiedInquiryHistoryTable';
import RelatedBuyerNotificationBadge from '../components/RelatedBuyerNotificationBadge';
import BuyerGmailSendButton from '../components/BuyerGmailSendButton';
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
// 問合時ヒアリング用クイチE��入力�Eタンの定義
const INQUIRY_HEARING_QUICK_INPUTS = [
  { label: '初見か', text: '初見か�E�E },
  { label: '希望時期', text: '希望時期�E�E },
  { label: '駐車場希望台数', text: '駐車場希望台数�E�E },
  { label: 'リフォーム予箁E, text: 'リフォーム込みの予算（最高額）！E },
  { label: '持ち家ぁE, text: '持ち家か！E },
  { label: '他物件', text: '他に気になる物件はあるか？！E },
];

const BUYER_FIELD_SECTIONS = [
  {
    title: '問合せ�E冁E��惁E��',
    fields: [
      { key: 'initial_assignee', label: '初動拁E��E, inlineEditable: true },
      { key: 'follow_up_assignee', label: '後続担彁E, inlineEditable: true },
      { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },
      { key: 'inquiry_source', label: '問合せ�E', inlineEditable: true },
      { key: 'inquiry_hearing', label: '問合時ヒアリング', multiline: true, inlineEditable: true },
      { key: 'inquiry_confidence', label: '問合時確度', inlineEditable: true },
      { key: 'inquiry_email_phone', label: '【問合メール】電話対忁E, inlineEditable: true, fieldType: 'dropdown' },
      { key: 'three_calls_confirmed', label: '3回架電確認済み', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'email_type', label: 'メール種別', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'distribution_type', label: '配信種別', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'owned_home_hearing', label: '持家ヒアリング', inlineEditable: true },
      { key: 'latest_viewing_date', label: '冁E��日(最新)', type: 'date', inlineEditable: true },
      // viewing_notes は PropertyInfoCard 冁E��移勁E      { key: 'next_call_date', label: '次電日', type: 'date', inlineEditable: true },
    ],
  },
  {
    title: '基本惁E��',
    fields: [
      { key: 'buyer_number', label: '買主番号', inlineEditable: true, readOnly: true },
      { key: 'name', label: '氏名・会社吁E, inlineEditable: true },
      { key: 'phone_number', label: '電話番号', inlineEditable: true },
      { key: 'email', label: 'メールアドレス', inlineEditable: true },
      { key: 'company_name', label: '法人吁E, inlineEditable: true },
    ],
  },
  {
    title: '冁E��結果・後続対忁E,
    isViewingResultGroup: true,  // 特別なグループとしてマ�Eク
    fields: [
      { key: 'viewing_result_follow_up', label: '冁E��結果・後続対忁E, multiline: true, inlineEditable: true },
      { key: 'follow_up_assignee', label: '後続担彁E, inlineEditable: true },
      { key: 'latest_status', label: '☁E��新状況E, inlineEditable: true, fieldType: 'dropdown' },
    ],
  },
  {
    title: '希望条件',
    fields: [
      { key: 'desired_timing', label: '希望時期', inlineEditable: true },
      { key: 'desired_area', label: 'エリア', inlineEditable: true },
      { key: 'desired_property_type', label: '希望種別', inlineEditable: true },
      { key: 'desired_building_age', label: '築年数', inlineEditable: true },
      { key: 'desired_floor_plan', label: '間取めE, inlineEditable: true },
      { key: 'budget', label: '予箁E, inlineEditable: true },
      { key: 'price_range_house', label: '価格帯�E�戸建�E�E, inlineEditable: true },
      { key: 'price_range_apartment', label: '価格帯�E��Eンション�E�E, inlineEditable: true },
      { key: 'price_range_land', label: '価格帯�E�土地�E�E, inlineEditable: true },
      { key: 'parking_spaces', label: 'P台数', inlineEditable: true },
      { key: 'hot_spring_required', label: '温泉あめE, inlineEditable: true },
      { key: 'garden_required', label: '庭付き', inlineEditable: true },
      { key: 'pet_allowed_required', label: 'ペット可', inlineEditable: true },
      { key: 'good_view_required', label: '眺望良好', inlineEditable: true },
      { key: 'high_floor_required', label: '高層隁E, inlineEditable: true },
      { key: 'corner_room_required', label: '角部屁E, inlineEditable: true },
    ],
  },
  {
    title: 'そ�E仁E,
    fields: [
      { key: 'special_notes', label: '特記事頁E, multiline: true, inlineEditable: true },
      { key: 'message_to_assignee', label: '拁E��への伝言/質問事頁E, multiline: true, inlineEditable: true },
      { key: 'confirmation_to_assignee', label: '拁E��への確認事頁E, multiline: true, inlineEditable: true },
      { key: 'family_composition', label: '家族構�E', inlineEditable: true },
      { key: 'must_have_points', label: '譲れなぁE��', multiline: true, inlineEditable: true },
      { key: 'liked_points', label: '気に入ってぁE��点', multiline: true, inlineEditable: true },
      { key: 'disliked_points', label: 'ダメな点', multiline: true, inlineEditable: true },
      { key: 'purchase_obstacles', label: '購入時障害となる点', multiline: true, inlineEditable: true },
      { key: 'next_action', label: '次のアクション', multiline: true, inlineEditable: true },
    ],
  },
  {
    title: '買付情報',
    fields: [
      { key: 'offer_status', label: '買付有無', inlineEditable: true },
      { key: 'offer_comment', label: '買付コメンチE, inlineEditable: true },
      { key: 'offer_property_sheet', label: '買付（物件シート！E, inlineEditable: true },
      { key: 'offer_lost_comment', label: '買付外れコメンチE, inlineEditable: true },
      { key: 'offer_lost_chat', label: '買付外れチャチE��', inlineEditable: true },
    ],
  },
];

export default function BuyerDetailPage() {
  const { buyer_number } = useParams<{ buyer_number: string }>();
  const navigate = useNavigate();
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [linkedProperties, setLinkedProperties] = useState<PropertyListing[]>([]);
  const [inquiryHistory, setInquiryHistory] = useState<InquiryHistory[]>([]);
  const [inquiryHistoryTable, setInquiryHistoryTable] = useState<InquiryHistoryItem[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalProperties, setEmailModalProperties] = useState<PropertyListing[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [relatedBuyersCount, setRelatedBuyersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // クイチE��ボタンの状態管琁E  const { isDisabled: isQuickButtonDisabled, disableButton: disableQuickButton } = useQuickButtonState(buyer_number || '');

  const [copiedBuyerNumber, setCopiedBuyerNumber] = useState(false);

  // useStableContainerHeightフックを使用して安定した高さ管琁E  const { error: heightError } = useStableContainerHeight({
    headerHeight: 64,
    padding: 48,
    minHeight: 400,
    debounceDelay: 200,
  });

  // ビューポ�Eト高さ計算エラーのハンドリング
  useEffect(() => {
    if (heightError) {
      console.error('[BuyerDetailPage] Height calculation error:', heightError);
      setSnackbar({
        open: true,
        message: '画面高さの計算でエラーが発生しました。デフォルト値を使用します、E,
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
    } catch (error) {
      console.error('Failed to fetch buyer:', error);
    } finally {
      setLoading(false);
    }
  };

  // インライン編雁E��のフィールド更新ハンドラー
  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {
    if (!buyer) return;

    try {
      // 更新するフィールド�Eみを送信�E�双方向同期を有効化！E      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: true }  // スプレチE��シートへの同期を有効匁E      );
      
      // 競合がある場吁E      if (result.conflicts && result.conflicts.length > 0) {
        console.warn('Sync conflict detected:', result.conflicts);
        setSnackbar({
          open: true,
          message: '同期競合が発生しました。スプレチE��シート�E値が変更されてぁE��す、E,
          severity: 'warning'
        });
        // ローカル状態�E更新�E�EBには保存されてぁE���E�E        setBuyer(result.buyer);
        return { success: true };
      }
      
      // ローカル状態を更新
      setBuyer(result.buyer);
      
      // 同期スチE�Eタスを表示
      if (result.syncStatus === 'pending') {
        setSnackbar({
          open: true,
          message: '保存しました�E�スプレチE��シート同期�E保留中�E�E,
          severity: 'warning'
        });
      } else if (result.syncStatus === 'synced') {
        // 成功時�E特にメチE��ージを表示しなぁE��静かに成功�E�E      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Failed to update field:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || '更新に失敗しました' 
      };
    }
  };

  // 問合時ヒアリング用クイチE��入力�EタンのクリチE��ハンドラー
  // inquiry_hearingフィールド�E強制再レンダリング用キー
  const [inquiryHearingKey, setInquiryHearingKey] = useState(0);
  
  const handleInquiryHearingQuickInput = async (text: string, buttonLabel: string) => {
    if (!buyer) return;
    
    // ボタンを無効匁E    disableQuickButton(buttonLabel);
    
    const currentValue = buyer.inquiry_hearing || '';
    // 新しいチE��ストを先頭に追加�E�既存�E容がある場合�E改行を挟�E�E�E    const newValue = currentValue 
      ? `${text}\n${currentValue}` 
      : text;
    
    // 先にローカル状態を更新して即座にUIに反映
    setBuyer(prev => prev ? { ...prev, inquiry_hearing: newValue } : prev);
    // キーを更新してInlineEditableFieldを強制再レンダリング
    setInquiryHearingKey(prev => prev + 1);
    
    // そ�E後DBに保孁E    const result = await handleInlineFieldSave('inquiry_hearing', newValue);
    if (result && !result.success && result.error) {
      // エラー時�E允E�E値に戻ぁE      setBuyer(prev => prev ? { ...prev, inquiry_hearing: currentValue } : prev);
      setInquiryHearingKey(prev => prev + 1);
      setSnackbar({
        open: true,
        message: result.error,
        severity: 'error'
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const fetchLinkedProperties = async () => {
    try {
      const res = await api.get(`/api/buyers/${buyer_number}/properties`);
      const properties = res.data || [];
      setLinkedProperties(properties);
    } catch (error) {
      console.error('Failed to fetch linked properties:', error);
    }
  };

  const fetchInquiryHistory = async () => {
    try {
      const res = await api.get(`/api/buyers/${buyer_number}/inquiry-history`);
      const history = res.data || [];
      setInquiryHistory(history);
    } catch (error) {
      console.error('Failed to fetch inquiry history:', error);
    }
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
      
      // Automatically select properties with "current" status (今回)
      const currentStatusIds = new Set<string>(
        historyData
          .filter((item: InquiryHistoryItem) => item.status === 'current')
          .map((item: InquiryHistoryItem) => item.propertyListingId)
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
          message: '選択された物件の惁E��を取得できませんでした',
          severity: 'error',
        });
        return;
      }

      // 2.3 & 2.4: Display warning if some properties failed (partial success)
      if (validProperties.length < selectedProperties.length) {
        const failedCount = selectedProperties.length - validProperties.length;
        setSnackbar({
          open: true,
          message: `${failedCount}件の物件惁E��を取得できませんでした。取得できた${validProperties.length}件で続行します。`,
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
        : error.response?.data?.error || '物件惁E��の取得に失敗しました';
      
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
        return `${(num / 10000).toLocaleString()}丁E�E`;
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
            無効な買主番号でぁE          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            買主番号は有効な数値、UUID、また�EBY_形式である忁E��がありまぁE          </Typography>
          <Button 
            variant="contained" 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate('/buyers')}
          >
            買主一覧に戻めE          </Button>
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
          一覧に戻めE        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            onClick={() => navigate(-1)} 
            sx={{ mr: 2 }}
            aria-label="戻めE
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" fontWeight="bold">
            {buyer.name || buyer.buyer_number}
          </Typography>
          {buyer.buyer_number && (
            <Tooltip title={copiedBuyerNumber ? 'コピ�Eしました�E�E : '買主番号をコピ�E'}>
              <Chip
                label={buyer.buyer_number}
                size="small"
                color="primary"
                icon={<ContentCopyIcon fontSize="small" />}
                onClick={() => {
                  navigator.clipboard.writeText(buyer.buyer_number || '');
                  setCopiedBuyerNumber(true);
                  setTimeout(() => setCopiedBuyerNumber(false), 1500);
                }}
                sx={{ cursor: 'pointer' }}
              />
            </Tooltip>
          )}
          {buyer.inquiry_confidence && (
            <Chip label={buyer.inquiry_confidence} color="info" sx={{ ml: 2 }} />
          )}
          {buyer.latest_status && (
            <Chip label={buyer.latest_status.substring(0, 30)} sx={{ ml: 1 }} />
          )}
          <RelatedBuyerNotificationBadge 
            count={relatedBuyersCount} 
            onClick={scrollToRelatedBuyers}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            size="medium"
            onClick={() => navigate(`/buyers/${buyer_number}/inquiry-history`)}
          >
            問い合わせ履歴 ({inquiryHistoryTable.length})
          </Button>
          <Button
            variant="outlined"
            size="medium"
            onClick={() => navigate(`/buyers/${buyer_number}/desired-conditions`)}
          >
            希望条件
          </Button>
          <Button
            variant="outlined"
            size="medium"
            onClick={() => navigate(`/buyers/${buyer_number}/viewing-result`)}
          >
            冁E��
          </Button>
        </Box>
      </Box>

      {/* 問い合わせ履歴チE�Eブルセクション */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            問い合わせ履歴
          </Typography>
          {/* New Gmail Send Button with Template Selection */}
          {buyer && (
            <BuyerGmailSendButton
              buyerId={buyer_number || ''}
              buyerEmail={buyer.email || ''}
              buyerName={buyer.name || ''}
              inquiryHistory={inquiryHistoryTable}
              selectedPropertyIds={selectedPropertyIds}
              size="medium"
              variant="contained"
            />
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        {/* Selection Controls - Keep for backward compatibility */}
        {selectedPropertyIds.size > 0 && (
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <Typography variant="body2" color="primary" fontWeight="bold">
              {selectedPropertyIds.size}件選択中
            </Typography>
            <Button 
              variant="outlined" 
              size="small"
              onClick={handleClearSelection}
            >
              選択をクリア
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={selectedPropertyIds.size === 0}
              onClick={handleGmailSend}
              startIcon={<EmailIcon />}
            >
              旧Gmail送信 ({selectedPropertyIds.size}件)
            </Button>
          </Box>
        )}

        {/* Inquiry History Table */}
        {isLoadingHistory ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <InquiryHistoryTable
            inquiryHistory={inquiryHistoryTable}
            selectedPropertyIds={selectedPropertyIds}
            onSelectionChange={handleSelectionChange}
            onBuyerClick={handleBuyerClick}
          />
        )}
      </Paper>

      {/* 2カラムレイアウチE 左側に紐づぁE��物件の詳細惁E��、右側に買主惁E�� */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'flex-start',
          '@media (max-width: 900px)': {
            flexDirection: 'column',
          },
        }}
        role="region"
        aria-label="買主詳細惁E��の2カラムレイアウチE
      >
        {/* 左側: 紐づぁE��物件の詳細惁E�� - 独立スクロール */}
        <Box 
          sx={{ 
            flex: '0 0 42%', 
            minWidth: 0,
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            pr: 1,
            position: 'sticky',
            top: 16,
            // カスタムスクロールバ�Eスタイル
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
              },
            },
            '@media (max-width: 900px)': {
              flex: '1 1 auto',
              width: '100%',
              maxHeight: 'none',
              overflowY: 'visible',
              position: 'static',
              pr: 0,
            },
          }}
          role="complementary"
          aria-label="物件詳細カーチE
          tabIndex={0}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">物件詳細カーチE/Typography>
              {linkedProperties.length > 0 && (
                <Chip 
                  label={`${linkedProperties.length}件`} 
                  size="small" 
                  sx={{ ml: 2 }}
                />
              )}
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
                <Typography variant="body2">紐づぁE��物件はありません</Typography>
              </Paper>
            )}
          </Box>
        </Box>

        {/* 右側: 買主詳細惁E�� - 独立スクロール */}
        <Box 
          sx={{ 
            flex: '1 1 58%', 
            minWidth: 0,
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            pl: 1,
            position: 'sticky',
            top: 16,
            // カスタムスクロールバ�Eスタイル
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
              },
            },
            '@media (max-width: 900px)': {
              flex: '1 1 auto',
              width: '100%',
              maxHeight: 'none',
              overflowY: 'visible',
              position: 'static',
              pl: 0,
            },
          }}
          role="main"
          aria-label="買主惁E��"
          tabIndex={0}
        >
          {/* 重褁E��歴セクション */}
          {inquiryHistory.length > 1 && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'warning.light' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Chip 
                  label={`重褁E��めE(${inquiryHistory.length}件の問合せ履歴)`} 
                  color="warning" 
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                こ�E買主は過去に別の買主番号で問い合わせをしてぁE��ぁE              </Typography>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                {inquiryHistory.map((history) => (
                  <Box 
                    key={history.buyerNumber} 
                    sx={{ 
                      py: 1, 
                      px: 1.5,
                      mb: 0.5,
                      bgcolor: history.isCurrent ? 'primary.light' : 'background.paper',
                      borderRadius: 1,
                      border: history.isCurrent ? '2px solid' : '1px solid',
                      borderColor: history.isCurrent ? 'primary.main' : 'divider'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" fontWeight="bold">
                        買主番号: {history.buyerNumber}
                      </Typography>
                      {history.isCurrent && (
                        <Chip label="現在" color="primary" size="small" />
                      )}
                    </Box>
                    <Grid container spacing={1}>
                      {history.propertyNumber && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">物件番号</Typography>
                          <Typography variant="body2">{history.propertyNumber}</Typography>
                        </Grid>
                      )}
                      {history.inquiryDate && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">問合せ日</Typography>
                          <Typography variant="body2">
                            {formatValue(history.inquiryDate, 'date')}
                          </Typography>
                        </Grid>
                      )}
                      {history.inquirySource && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">問合せ�E</Typography>
                          <Typography variant="body2">{history.inquirySource}</Typography>
                        </Grid>
                      )}
                      {history.status && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">スチE�Eタス</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            {history.status.substring(0, 30)}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}

          {BUYER_FIELD_SECTIONS.map((section) => (
            <Paper 
              key={section.title} 
              sx={{ 
                p: 2, 
                mb: 2,
                // 冁E��結果グループには特別なスタイルを適用
                ...(section.isViewingResultGroup && {
                  bgcolor: 'rgba(33, 150, 243, 0.08)',  // 薁E��青色の背景
                  border: '1px solid',
                  borderColor: 'rgba(33, 150, 243, 0.3)',
                }),
              }}
            >
              <Typography 
                variant="h6" 
                gutterBottom
                sx={{
                  // 冁E��結果グループ�Eタイトルを強調
                  ...(section.isViewingResultGroup && {
                    color: 'primary.main',
                    fontWeight: 'bold',
                  }),
                }}
              >
                {section.title}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {section.fields.map((field: any) => {
                  const value = buyer[field.key];
                  
                  // multilineフィールド�E全幁E��表示
                  const gridSize = field.multiline ? { xs: 12 } : { xs: 12, sm: 6 };

                  // インライン編雁E��能なフィールチE                  if (field.inlineEditable) {
                    // inquiry_sourceフィールド�E特別処琁E��ドロチE�Eダウン�E�E                    if (field.key === 'inquiry_source') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={field.key}>
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
                          />
                        </Grid>
                      );
                    }

                    // latest_statusフィールド�E特別処琁E��ドロチE�Eダウン�E�E                    if (field.key === 'latest_status') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={field.key}>
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

                    // inquiry_email_phoneフィールド�E特別処琁E��ドロチE�Eダウン�E�E                    if (field.key === 'inquiry_email_phone') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={field.key}>
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

                    // three_calls_confirmedフィールド�E特別処琁E��ドロチE�Eダウン�E�E                    if (field.key === 'three_calls_confirmed') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={field.key}>
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

                    // email_typeフィールド�E特別処琁E��ドロチE�Eダウン�E�E                    if (field.key === 'email_type') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={field.key}>
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

                    // distribution_typeフィールド�E特別処琁E��ドロチE�Eダウン�E�E                    if (field.key === 'distribution_type') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={field.key}>
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

                    // そ�E他�EフィールチE                    const handleFieldSave = async (newValue: any) => {
                      const result = await handleInlineFieldSave(field.key, newValue);
                      if (result && !result.success && result.error) {
                        throw new Error(result.error);
                      }
                    };

                    // inquiry_hearingフィールドには常に囲ぁE��を表示
                    const isInquiryHearing = field.key === 'inquiry_hearing';

                    return (
                      <Grid item {...gridSize} key={field.key}>
                        {/* 問合時ヒアリング用クイチE��入力�Eタン */}
                        {isInquiryHearing && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              ヒアリング頁E��
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {INQUIRY_HEARING_QUICK_INPUTS.map((item) => {
                                const disabled = isQuickButtonDisabled(item.label);
                                return (
                                  <Tooltip 
                                    key={item.label} 
                                    title={disabled ? 'こ�Eボタンは使用済みでぁE : item.text} 
                                    arrow
                                  >
                                    <span>
                                      <Chip
                                        label={item.label}
                                        onClick={() => !disabled && handleInquiryHearingQuickInput(item.text, item.label)}
                                        size="small"
                                        clickable={!disabled}
                                        color="primary"
                                        variant="outlined"
                                        disabled={disabled}
                                        sx={{
                                          opacity: disabled ? 0.5 : 1,
                                          cursor: disabled ? 'not-allowed' : 'pointer',
                                          '&.Mui-disabled': {
                                            opacity: 0.5,
                                            pointerEvents: 'auto',
                                          },
                                        }}
                                      />
                                    </span>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                          </Box>
                        )}
                        <InlineEditableField
                          key={isInquiryHearing ? `inquiry_hearing_${inquiryHearingKey}` : field.key}
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
                          alwaysShowBorder={isInquiryHearing}
                          borderPlaceholder={isInquiryHearing ? 'ヒアリング冁E��を�E劁E..' : undefined}
                          showEditIndicator={!field.readOnly}
                        />
                      </Grid>
                    );
                  }

                  // インライン編雁E��可のフィールド（通常表示�E�E                  return (
                    <Grid item {...gridSize} key={field.key}>
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

          {/* メール送信履歴セクション */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">メール送信履歴</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {activities.filter(a => a.action === 'email').length > 0 ? (
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {activities
                  .filter(a => a.action === 'email')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((activity) => {
                    const metadata = activity.metadata || {};
                    const propertyNumbers = metadata.propertyNumbers || [];
                    const displayName = activity.employee ? getDisplayName(activity.employee) : '不�E';
                    
                    return (
                      <ListItem
                        key={activity.id}
                        sx={{
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          py: 2,
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                          <Typography variant="body2" fontWeight="bold">
                            {metadata.subject || '件名なぁE}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(activity.created_at)}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ width: '100%', mb: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            送信老E {displayName} ({metadata.senderEmail || '-'})
                          </Typography>
                        </Box>
                        
                        {propertyNumbers.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                              物件:
                            </Typography>
                            {propertyNumbers.map((pn: string) => (
                              <Chip
                                key={pn}
                                label={pn}
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            ))}
                          </Box>
                        )}
                        
                        {metadata.preViewingNotes && (
                          <Box sx={{ width: '100%', mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              冁E��前伝達事頁E
                            </Typography>
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
      </Box>

      {/* 関連買主セクション */}
      {buyer_number && (
        <Box sx={{ mt: 3 }}>
          <RelatedBuyersSection buyerNumber={buyer_number} />
        </Box>
      )}

      {/* 統合問合せ履歴 */}
      {buyer_number && (
        <Box sx={{ mt: 3 }}>
          <UnifiedInquiryHistoryTable buyerNumber={buyer_number} />
        </Box>
      )}

      {/* スナックバ�E */}
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
    </Container>
  );
}
