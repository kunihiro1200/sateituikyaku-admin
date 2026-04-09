import { useState, useEffect, useRef } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  Delete as DeleteIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import api, { buyerApi } from '../services/api';
import PropertyInfoCard from '../components/PropertyInfoCard';
import InquiryHistoryTable, { InquiryHistoryItem } from '../components/InquiryHistoryTable';
import { InquiryResponseEmailModal } from '../components/InquiryResponseEmailModal';
import RelatedBuyersSection from '../components/RelatedBuyersSection';
import UnifiedInquiryHistoryTable from '../components/UnifiedInquiryHistoryTable';
import RelatedBuyerNotificationBadge from '../components/RelatedBuyerNotificationBadge';
import { ConfirmationToAssignee } from '../components/ConfirmationToAssignee';
import BuyerGmailSendButton from '../components/BuyerGmailSendButton';
import { SmsDropdownButton } from '../components/SmsDropdownButton';
import PageNavigation from '../components/PageNavigation';
import { InlineEditableField } from '../components/InlineEditableField';
import { SectionSaveButton } from '../components/SectionSaveButton';
import { useStableContainerHeight } from '../hooks/useStableContainerHeight';
import { useAuthStore } from '../store/authStore';
import { useQuickButtonState } from '../hooks/useQuickButtonState';
import { INQUIRY_SOURCE_OPTIONS } from '../utils/buyerInquirySourceOptions';
import { LATEST_STATUS_OPTIONS } from '../utils/buyerLatestStatusOptions';
import { 
  INQUIRY_EMAIL_PHONE_OPTIONS, 
  INQUIRY_EMAIL_REPLY_OPTIONS,
  THREE_CALLS_CONFIRMED_OPTIONS,
  DISTRIBUTION_TYPE_OPTIONS,
} from '../utils/buyerFieldOptions';
import RichTextCommentEditor, { RichTextCommentEditorHandle } from '../components/RichTextCommentEditor';
import { ValidationWarningDialog } from '../components/ValidationWarningDialog';
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
    id: string;
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

// 担当への伝言/質問事項・内覧結果用クイック入力ボタンの定義
const ASSIGNEE_MESSAGE_QUICK_INPUTS = [
  { label: '内覧理由', text: '内覧理由：' },
  { label: '家族構成', text: '家族構成：' },
  { label: '購入物件の譲れない点', text: '購入物件の譲れない点：' },
  { label: 'この物件の気に入っている点', text: 'この物件の気に入っている点：' },
  { label: 'この物件の駄目な点', text: 'この物件の駄目な点：' },
  { label: '購入時障害となる点', text: '購入時障害となる点：' },
  { label: '仮審査', text: '仮審査：' },
  { label: '連絡の付きやすい曜日、時間帯', text: '連絡の付きやすい曜日、時間帯：' },
  { label: '次のアクション', text: '次のアクション：' },
  { label: 'クロージング', text: 'クロージング：' },
];

// 査定フィールドの選択肢定義
const PROPERTY_TYPE_OPTIONS = ['戸', 'マ', '土', '収益物件', '他'];
const CURRENT_STATUS_OPTIONS = ['居', '空', '賃', '他'];
const FLOOR_PLAN_OPTIONS = ['1R', '1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3K', '3DK', '3LDK', '4LDK以上'];
const VISIT_DESK_OPTIONS = ['机上査定', '訪問査定', '机上査定後訪問査定', '他'];
const SELLER_LIST_COPY_OPTIONS = ['済', '未'];

// 全角数字を半角数字に変換する
const toHalfWidth = (str: string): string => {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );
};

// 保存ボタン押下時にまとめて保存するフィールドのセット
const SAVE_BUTTON_FIELDS = new Set([
  'inquiry_email_phone',
  'inquiry_email_reply',
  'distribution_type',
  'pinrich',
  'vendor_survey',
  'three_calls_confirmed',
  'initial_assignee',
  'owned_home_hearing_inquiry',
  'owned_home_hearing_result',
  'valuation_required',
  'broker_inquiry',
]);

// 他社物件情報セクションの表示判定ヘルパー関数
const hasOtherCompanyPropertyData = (buyer: Buyer | null): boolean => {
  if (!buyer) return false;
  // 「他社物件」フィールドのみをチェック（「建物名/価格」は条件に含めない）
  const hasOtherProperty = !!(buyer.other_company_property && buyer.other_company_property.trim() !== '');
  return hasOtherProperty;
};

const BUYER_FIELD_SECTIONS = [
  {
    title: '問合せ内容',
    fields: [
      { key: 'vendor_survey', label: '業者向けアンケート', inlineEditable: true, fieldType: 'buttonSelect' },
      { key: 'inquiry_hearing', label: '問合時ヒアリング', multiline: true, inlineEditable: true },
      { key: 'initial_assignee', label: '初動担当', inlineEditable: true },
      { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },
      { key: 'inquiry_source', label: '問合せ元', inlineEditable: true },
      { key: 'latest_status', label: '★最新状況', inlineEditable: true },
      { key: 'distribution_type', label: '配信メール', inlineEditable: true, fieldType: 'buttonSelect', required: true },
      { key: 'pinrich', label: 'Pinrich', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'pinrich_link', label: 'Pinrichリンク', inlineEditable: true, fieldType: 'pinrichLink' },
      { key: 'inquiry_email_phone', label: '【問合メール】電話対応', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'inquiry_email_reply', label: '【問合メール】メール返信', inlineEditable: true, fieldType: 'buttonSelect' },
      { key: 'three_calls_confirmed', label: '3回架電確認済み', inlineEditable: true, fieldType: 'buttonSelect' },
      { key: 'confirmation_to_assignee', label: '担当への確認事項', inlineEditable: true, fieldType: 'confirmationToAssignee' },
      { key: 'next_call_date', label: '次電日', type: 'date', inlineEditable: true },
      { key: 'owned_home_hearing_inquiry', label: '問合時持家ヒアリング', inlineEditable: true, fieldType: 'staffSelect' },
      { key: 'owned_home_hearing_result', label: '持家ヒアリング結果', inlineEditable: true, fieldType: 'homeHearingResult' },
      { key: 'valuation_required', label: '要査定', inlineEditable: true, fieldType: 'valuationRequired' },
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
      { key: 'broker_inquiry', label: '業者問合せ', inlineEditable: true, fieldType: 'boxSelect' },
    ],
  },
];

export default function BuyerDetailPage() {
  const { buyer_number } = useParams<{ buyer_number: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  // 必須フィールド未入力ハイライト用
  const [missingRequiredFields, setMissingRequiredFields] = useState<Set<string>>(new Set());

  // 必須フィールドの表示名マップ
  const REQUIRED_FIELD_LABEL_MAP: Record<string, string> = {
    initial_assignee: '初動担当',
    inquiry_source: '問合せ元',
    latest_status: '★最新状況',
    distribution_type: '配信メール',
    inquiry_email_phone: '【問合メール】電話対応',
    inquiry_email_reply: '【問合メール】メール返信',
    three_calls_confirmed: '3回架電確認済み',
    desired_area: 'エリア（希望条件）',
    desired_property_type: '希望種別（希望条件）',
    price_range_house: '価格帯（戸建）',
    price_range_apartment: '価格帯（マンション）',
    price_range_land: '価格帯（土地）',
    price_range_any: '価格帯（いずれか）',
    owned_home_hearing_result: '持家ヒアリング結果',
    pinrich: 'Pinrich',
  };

  // Pinrich が必須かどうかを判定するヘルパー
  // AND(ISNOTBLANK([メールアドレス]), ISBLANK([業者問合せ]))
  const isPinrichRequired = (data: any): boolean => {
    if (!data) return false;
    
    // 条件1: メールアドレスが空白でないこと
    if (!data.email) return false;
    const emailTrimmed = String(data.email).trim();
    if (emailTrimmed.length === 0) return false;

    // 条件2: 業者問合せが空白であること
    if (data.broker_inquiry) {
      const brokerTrimmed = String(data.broker_inquiry).trim();
      if (brokerTrimmed.length > 0) return false;
    }

    return true;
  };

  // owned_home_hearing_result が必須かどうかを判定するヘルパー
  // AND([受付日]>="2026/3/30", ISNOTBLANK([問合時持家ヒアリング]))
  const isHomeHearingResultRequired = (data: any): boolean => {
    // 条件1: 受付日が2026-03-30以降であること
    if (!data.reception_date) return false;
    
    try {
      const receptionDate = new Date(data.reception_date);
      // Invalid Dateのチェック
      if (isNaN(receptionDate.getTime())) {
        console.error('Invalid reception_date:', data.reception_date);
        return false;
      }
      
      const thresholdDate = new Date('2026-03-30');
      if (receptionDate < thresholdDate) return false;
    } catch (error) {
      console.error('Date comparison error:', error);
      return false;
    }

    // 条件2: 問合時持家ヒアリングが空白でないこと
    if (!data.owned_home_hearing_inquiry) return false;
    const trimmed = String(data.owned_home_hearing_inquiry).trim();
    if (trimmed.length === 0) return false;
    
    // 条件3: 「不要」または「未」の場合は必須扱いにしない
    if (trimmed === '不要' || trimmed === '未') return false;

    return true;
  };

  // latest_status が必須かどうかを判定するヘルパー
  // 正しい必須条件: 条件A AND 条件B AND 条件C
  //   条件A: (inquiry_hearingが空欄でない AND inquiry_sourceに「電話」を含む) OR inquiry_email_phoneが「済」
  //   条件B: reception_date が 2026-02-08 以降
  //   条件C: broker_inquiry が空欄
  const isLatestStatusRequired = (data: any): boolean => {
    // 条件C: broker_inquiry が空欄でなければ必須でない
    if (data.broker_inquiry && String(data.broker_inquiry).trim()) return false;
    // 条件B: reception_date が 2026-02-08 以降でなければ必須でない
    if (!data.reception_date) return false;
    const receptionDate = new Date(data.reception_date);
    if (receptionDate < new Date('2026-02-08')) return false;
    // 条件A: (inquiry_hearingが空欄でない AND inquiry_sourceに「電話」を含む) OR inquiry_email_phoneが「済」
    const hearingFilled = data.inquiry_hearing && String(data.inquiry_hearing).trim();
    const hasPhone = data.inquiry_source && String(data.inquiry_source).includes('電話');
    const emailPhoneDone = data.inquiry_email_phone && String(data.inquiry_email_phone) === '済';
    if (!((hearingFilled && hasPhone) || emailPhoneDone)) return false;
    return true;
  };

  // 初動担当の条件付き必須判定
  // AND([受付日]>="2026/3/30", OR([_THISROW_BEFORE].[inquiry_email_phone]<>[inquiry_email_phone], AND(ISNOTBLANK([inquiry_hearing]),[inquiry_hearing]<>[_THISROW_BEFORE].[inquiry_hearing])))
  const isInitialAssigneeConditionallyRequired = (
    currentBuyer: any,
    changedFields: Record<string, any>
  ): boolean => {
    if (!currentBuyer?.reception_date) return false;
    const receptionDate = new Date(currentBuyer.reception_date);
    if (receptionDate < new Date('2026-03-30')) return false;

    // inquiry_email_phone が変更されたか
    const emailPhoneChanged =
      'inquiry_email_phone' in changedFields &&
      changedFields.inquiry_email_phone !== initialInquiryEmailPhoneRef.current;

    // inquiry_hearing が変更されかつ空でないか
    const hearingNewValue = 'inquiry_hearing' in changedFields
      ? changedFields.inquiry_hearing
      : currentBuyer.inquiry_hearing;
    const hearingChanged =
      'inquiry_hearing' in changedFields &&
      changedFields.inquiry_hearing !== initialInquiryHearingRef.current;
    const hearingFilledAndChanged =
      hearingChanged && hearingNewValue && String(hearingNewValue).trim().length > 0;

    return emailPhoneChanged || Boolean(hearingFilledAndChanged);
  };

  // 未入力の必須項目の表示名リストを返す（空配列 = 全て入力済み）
  const checkMissingFields = (): string[] => {
    if (!buyer) return [];

    const missingKeys: string[] = [];

    // 初動担当：常時必須 OR 条件付き必須（重複追加なし）
    const allChangedFields = Object.values(sectionChangedFields)
      .reduce((acc: Record<string, any>, fields) => ({ ...acc, ...fields }), {});
    const conditionallyRequired = isInitialAssigneeConditionallyRequired(buyer, allChangedFields);
    if (!buyer.initial_assignee || !String(buyer.initial_assignee).trim() || conditionallyRequired) {
      missingKeys.push('initial_assignee');
    }
    // broker_inquiryが「業者問合せ」の場合はinquiry_sourceを必須としない
    if (buyer.broker_inquiry !== '業者問合せ' && (!buyer.inquiry_source || !String(buyer.inquiry_source).trim())) {
      missingKeys.push('inquiry_source');
    }
    // 正しい必須条件を満たす場合のみ latest_status を必須扱いする
    if (isLatestStatusRequired(buyer) && (!buyer.latest_status || !String(buyer.latest_status).trim())) {
      missingKeys.push('latest_status');
    }
    if (!buyer.distribution_type || !String(buyer.distribution_type).trim()) {
      missingKeys.push('distribution_type');
    }

    // 問合せ元にメールが含まれる場合は inquiry_email_phone も必須
    const inquirySource = buyer.inquiry_source ? String(buyer.inquiry_source) : '';
    if (inquirySource.includes('メール')) {
      if (!buyer.inquiry_email_phone || !String(buyer.inquiry_email_phone).trim()) {
        missingKeys.push('inquiry_email_phone');
      }
      // inquiry_email_phone が「不通」の場合のみ three_calls_confirmed を必須
      if (String(buyer.inquiry_email_phone).trim() === '不通') {
        if (!buyer.three_calls_confirmed || !String(buyer.three_calls_confirmed).trim()) {
          missingKeys.push('three_calls_confirmed');
        }
      }
    }

    // 配信メールが「要」の場合は希望条件の必須チェック
    // 業者問合せの場合は配信メールを送らないため、希望条件は不要
    if (buyer.broker_inquiry !== '業者問合せ' && buyer.distribution_type && String(buyer.distribution_type).trim() === '要') {
      if (!buyer.desired_area || !String(buyer.desired_area).trim()) {
        missingKeys.push('desired_area');
      }
      if (!buyer.desired_property_type || !String(buyer.desired_property_type).trim()) {
        missingKeys.push('desired_property_type');
      }
      // 希望種別に応じた価格帯チェック
      const pt = String(buyer.desired_property_type || '').trim();
      const needsH = pt.includes('戸建て');
      const needsA = pt.includes('マンション');
      const needsL = pt.includes('土地');
      const anyPrice = buyer.price_range_house || buyer.price_range_apartment || buyer.price_range_land;
      if (needsH && !buyer.price_range_house) missingKeys.push('price_range_house');
      if (needsA && !buyer.price_range_apartment) missingKeys.push('price_range_apartment');
      if (needsL && !buyer.price_range_land) missingKeys.push('price_range_land');
      if (!needsH && !needsA && !needsL && !anyPrice) missingKeys.push('price_range_any');
    }

    // 持家ヒアリング結果：条件付き必須
    if (isHomeHearingResultRequired(buyer) && (!buyer.owned_home_hearing_result || !String(buyer.owned_home_hearing_result).trim())) {
      missingKeys.push('owned_home_hearing_result');
    }

    // Pinrich：条件付き必須
    if (isPinrichRequired(buyer) && 
        (!buyer.pinrich || !String(buyer.pinrich).trim() || buyer.pinrich === '未選択')) {
      missingKeys.push('pinrich');
    }

    // ハイライト用 state を更新
    setMissingRequiredFields(new Set(missingKeys));

    return missingKeys.map(k => REQUIRED_FIELD_LABEL_MAP[k] || k);
  };

  // バリデーション警告ダイアログ用 state
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string>('');

  // バリデーション警告ダイアログ用 missing labels state
  const [pendingMissingLabels, setPendingMissingLabels] = useState<string[]>([]);

  // 遷移前バリデーション共通ハンドラー
  const handleNavigate = (url: string) => {
    // 希望条件ページへの遷移はバリデーションをスキップ（入力しに行く正しい遷移）
    if (url.includes('/desired-conditions')) {
      navigate(url);
      return;
    }
    const missing = checkMissingFields();
    if (missing.length > 0) {
      setPendingNavigationUrl(url);
      setPendingMissingLabels(missing);
      setValidationDialogOpen(true);
    } else {
      navigate(url);
    }
  };

  // セクション別 DirtyState 管理
  const [sectionDirtyStates, setSectionDirtyStates] = useState<Record<string, boolean>>({});
  const [sectionChangedFields, setSectionChangedFields] = useState<Record<string, Record<string, any>>>({});
  const [sectionSavingStates, setSectionSavingStates] = useState<Record<string, boolean>>({});

  // クイックボタンの状態管理
  const { isDisabled: isQuickButtonDisabled, disableButton: disableQuickButton } = useQuickButtonState(buyer_number || '');

  // 変更前の値を保持（_THISROW_BEFORE相当）
  const initialInquiryEmailPhoneRef = useRef<string>('');
  const initialInquiryHearingRef = useRef<string>('');

  // ヒアリング項目用RichTextEditorのref
  const hearingEditorRef = useRef<RichTextCommentEditorHandle>(null);
  // ヒアリング項目のローカル編集値（HTML）
  const [hearingEditValue, setHearingEditValue] = useState<string>('');
  const [hearingSaving, setHearingSaving] = useState(false);
  // 担当への伝言/質問事項用RichTextEditorのref
  const messageToAssigneeEditorRef = useRef<RichTextCommentEditorHandle>(null);
  // 担当への伝言/質問事項のローカル編集値（HTML）
  const [messageToAssigneeEditValue, setMessageToAssigneeEditValue] = useState<string>('');
  const [messageToAssigneeSaving, setMessageToAssigneeSaving] = useState(false);
  // 買主番号検索バー用
  const [buyerNumberSearch, setBuyerNumberSearch] = useState('');
  // スマホ時のアコーディオン開閉状態
  const [mobileCallLogOpen, setMobileCallLogOpen] = useState(false);
  const [mobilePropertyCardOpen, setMobilePropertyCardOpen] = useState(false);
  const [mobileBuyerInfoOpen, setMobileBuyerInfoOpen] = useState(true); // 買主情報はデフォルト展開

  // ログインユーザー情報（SMS送信者名用）
  const { employee } = useAuthStore();

  // 通常スタッフのイニシャル一覧（初動担当選択用）
  const [normalInitials, setNormalInitials] = useState<string[]>([]);

  // 削除ダイアログ用の状態
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // メール本文表示用の状態
  const [emailBodyModalOpen, setEmailBodyModalOpen] = useState(false);
  const [selectedEmailBody, setSelectedEmailBody] = useState<string>('');



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

  // Pinrich の動的バリデーション
  useEffect(() => {
    if (buyer) {
      checkMissingFields();
    }
  }, [buyer?.email, buyer?.broker_inquiry, buyer?.pinrich]);

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
      // 変更前の値として記録（_THISROW_BEFORE相当）
      initialInquiryEmailPhoneRef.current = res.data.inquiry_email_phone || '';
      initialInquiryHearingRef.current = res.data.inquiry_hearing || '';
      // 担当への伝言/質問事項の初期値をセット
      setMessageToAssigneeEditValue(res.data.message_to_assignee || '');
      // 初回表示時から未入力の必須フィールドをハイライト
      const initialMissing: string[] = [];
      if (!res.data.initial_assignee || !String(res.data.initial_assignee).trim()) {
        initialMissing.push('initial_assignee');
      }
      // broker_inquiryが「業者問合せ」の場合はinquiry_sourceを必須としない
      if (res.data.broker_inquiry !== '業者問合せ' && (!res.data.inquiry_source || !String(res.data.inquiry_source).trim())) {
        initialMissing.push('inquiry_source');
      }
      // 正しい必須条件を満たす場合のみ latest_status を必須扱いする
      if (isLatestStatusRequired(res.data) && (!res.data.latest_status || !String(res.data.latest_status).trim())) {
        initialMissing.push('latest_status');
      }
      if (!res.data.distribution_type || !String(res.data.distribution_type).trim()) {
        initialMissing.push('distribution_type');
      }
      const src = res.data.inquiry_source ? String(res.data.inquiry_source) : '';
      if (src.includes('メール') && (!res.data.inquiry_email_phone || !String(res.data.inquiry_email_phone).trim())) {
        initialMissing.push('inquiry_email_phone');
      }
      // inquiry_email_phone が「不通」の場合のみ three_calls_confirmed を必須
      if (src.includes('メール') && String(res.data.inquiry_email_phone).trim() === '不通') {
        if (!res.data.three_calls_confirmed || !String(res.data.three_calls_confirmed).trim()) {
          initialMissing.push('three_calls_confirmed');
        }
      }
      // 持家ヒアリング結果：条件付き必須
      if (isHomeHearingResultRequired(res.data) && (!res.data.owned_home_hearing_result || !String(res.data.owned_home_hearing_result).trim())) {
        initialMissing.push('owned_home_hearing_result');
      }
      // Pinrich：条件付き必須
      if (isPinrichRequired(res.data) && 
          (!res.data.pinrich || !String(res.data.pinrich).trim() || res.data.pinrich === '未選択')) {
        initialMissing.push('pinrich');
      }
      if (initialMissing.length > 0) {
        setMissingRequiredFields(new Set(initialMissing));
      }
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
        { sync: true, force: true }  // 競合チェックスキップ
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
      // DBへの保存と同時にスプシへの同期も実行
      // force=true を付与して競合チェックをスキップ（last_synced_at が設定されている場合の409エラーを回避）
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: true, force: true }
      );

      // 同期失敗の通知（DBへの保存は成功）
      if (result?.syncStatus === 'pending' || result?.syncStatus === 'failed') {
        setSnackbar({
          open: true,
          message: 'DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました',
          severity: 'warning',
        });
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

  // セクション内フィールド変更検知ハンドラー
  const handleFieldChange = (sectionTitle: string, fieldName: string, newValue: any) => {
    if (!buyer) return;
    const originalValue = buyer[fieldName];
    // 元の値と同じなら変更フィールドから削除
    const isSameAsOriginal = String(newValue ?? '') === String(originalValue ?? '');
    setSectionChangedFields(prev => {
      const sectionFields = { ...(prev[sectionTitle] || {}) };
      if (isSameAsOriginal) {
        delete sectionFields[fieldName];
      } else {
        sectionFields[fieldName] = newValue;
      }
      const isDirty = Object.keys(sectionFields).length > 0;
      setSectionDirtyStates(prevDirty => ({ ...prevDirty, [sectionTitle]: isDirty }));
      return { ...prev, [sectionTitle]: sectionFields };
    });
  };

  // セクション保存ハンドラー
  const handleSectionSave = async (sectionTitle: string) => {
    const changedFields = sectionChangedFields[sectionTitle] || {};
    if (Object.keys(changedFields).length === 0) return;
    setSectionSavingStates(prev => ({ ...prev, [sectionTitle]: true }));
    try {
      // force=true を付与して競合チェックをスキップ（last_synced_at が設定されている場合の409エラーを回避）
      const result = await buyerApi.update(
        buyer_number!,
        changedFields,
        { sync: true, force: true }
      );
      setBuyer(result.buyer);
      setSectionDirtyStates(prev => ({ ...prev, [sectionTitle]: false }));
      setSectionChangedFields(prev => ({ ...prev, [sectionTitle]: {} }));
      // スプシ同期失敗時は警告表示
      if (result?.syncStatus === 'pending' || result?.syncStatus === 'failed') {
        setSnackbar({
          open: true,
          message: 'DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました',
          severity: 'warning',
        });
      } else {
        setSnackbar({ open: true, message: '保存しました', severity: 'success' });
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || '保存に失敗しました',
        severity: 'error',
      });
    } finally {
      setSectionSavingStates(prev => ({ ...prev, [sectionTitle]: false }));
    }
  };

  // 担当への伝言/質問事項の保存ハンドラー
  const handleSaveMessageToAssignee = async () => {
    if (!buyer) return;
    setMessageToAssigneeSaving(true);
    try {
      const result = await buyerApi.update(
        buyer_number!,
        { message_to_assignee: messageToAssigneeEditValue },
        { sync: true, force: true }  // 競合チェックスキップ
      );
      setBuyer(result.buyer);
      setMessageToAssigneeEditValue(result.buyer.message_to_assignee || '');
      const syncMsg = result.syncStatus === 'synced' ? '（スプシ同期済み）' : result.syncStatus === 'pending' ? '（スプシ同期保留中）' : '';
      setSnackbar({ open: true, message: `担当への伝言/質問事項を保存しました${syncMsg}`, severity: result.syncStatus === 'synced' ? 'success' : 'warning' });
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.error || '保存に失敗しました', severity: 'error' });
    } finally {
      setMessageToAssigneeSaving(false);
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

  // 買主削除ハンドラー
  const handleDeleteBuyer = async () => {
    if (!buyer?.buyer_id) return;
    setDeleting(true);
    try {
      await api.delete(`/api/buyers/${buyer.buyer_id}`);
      setDeleteDialogOpen(false);
      navigate('/buyers');
    } catch (err) {
      console.error('Delete buyer error:', err);
      setSnackbar({
        open: true,
        message: '削除に失敗しました',
        severity: 'error',
      });
    } finally {
      setDeleting(false);
    }
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
        <PageNavigation onNavigate={handleNavigate} />
        <TextField
          size="small"
          placeholder="買主番号"
          value={buyerNumberSearch}
          onChange={(e) => setBuyerNumberSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && buyerNumberSearch.trim()) {
              navigate(`/buyers/${toHalfWidth(buyerNumberSearch.trim())}`);
            }
          }}
          sx={{ width: 360 }}
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
      {/* モバイル時: 戻るボタンを画面上部に常時表示 */}
      {isMobile && (
        <Box sx={{ px: 1, py: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => handleNavigate('/buyers')}
            variant="outlined"
            size="small"
            sx={{ minHeight: 44 }}
          >
            買主一覧に戻る
          </Button>
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', px: 1, py: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 0.5 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 2, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          {!isMobile && (
          <IconButton 
            onClick={() => handleNavigate('/buyers')} 
            sx={{ mr: 2 }}
            aria-label="戻る"
          >
            <ArrowBackIcon />
          </IconButton>
          )}
          <Typography
            variant={isMobile ? 'body1' : 'h5'}
            fontWeight="bold"
            sx={{ fontSize: isMobile ? '0.95rem' : undefined }}
          >
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
            preViewingNotes={linkedProperties[0]?.pre_viewing_notes || ''}
            followUpAssignee={buyer.follow_up_assignee || ''}
            inquiryHistory={inquiryHistoryTable}
            selectedPropertyIds={selectedPropertyIds}
            linkedPropertyType={linkedProperties[0]?.property_type}
            brokerInquiry={buyer.broker_inquiry || ''}
            viewingDate={buyer.viewing_date || ''}
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
              senderName={employee?.name || ''}
              onSmsSent={fetchActivities}
              preViewingNotes={linkedProperties[0]?.pre_viewing_notes || ''}
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
            onClick={() => handleNavigate(`/buyers/${buyer_number}/inquiry-history`)}
          >
            問合履歴{inquiryHistoryTable.length}件
          </Button>
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => handleNavigate(`/buyers/${buyer_number}/desired-conditions`)}
          >
            希望条件
          </Button>
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => handleNavigate(`/buyers/${buyer_number}/viewing-result`)}
          >
            内覧
          </Button>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* 問合メール未対応一覧ボタン */}
          {(buyer.inquiry_email_phone === '未' || buyer.inquiry_email_reply === '未' ||
            (!buyer.viewing_date && buyer.inquiry_email_phone === '不要' &&
              (!buyer.inquiry_email_reply || buyer.inquiry_email_reply === '未'))) && (
            <Button
              variant="outlined"
              color="warning"
              size="small"
              onClick={() => navigate('/buyers?status=問合メール未対応')}
            >
              問合メール未対応一覧
            </Button>
          )}

          {/* 当日TEL一覧ボタン */}
          {buyer.next_call_date && (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const callDate = new Date(buyer.next_call_date);
            callDate.setHours(0, 0, 0, 0);
            return callDate <= today;
          })() && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => navigate('/buyers?status=当日TEL')}
            >
              当日TEL一覧
            </Button>
          )}

          {/* 業者問合せ一覧ボタン */}
          {buyer.broker_inquiry === '業者問合せ' && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate('/buyers?status=業者問合せあり')}
              sx={{ color: '#7b1fa2', borderColor: '#7b1fa2', '&:hover': { borderColor: '#4a148c', color: '#4a148c' } }}
            >
              業者問合せ一覧
            </Button>
          )}

          {/* 削除ボタン */}
          {buyer?.buyer_id && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{ ml: 'auto' }}
              size="small"
            >
              削除
            </Button>
          )}
        </Box>
      </Box>


      {/* 3カラムレイアウト: 左列に通話・メール履歴、中央列に物件詳細カード、右列に買主情報 */}
      <Box
        sx={{
          display: 'flex',
          gap: 0,
          flex: 1,
          overflow: isMobile ? 'auto' : 'hidden',
          flexDirection: isMobile ? 'column' : 'row',
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
            height: isMobile ? 'auto' : '100%',
            overflowY: isMobile ? 'visible' : 'auto',
            overflowX: 'hidden',
            borderRight: isMobile ? 'none' : '1px solid',
            borderColor: 'divider',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible', borderRight: 'none' },
          }}
          role="complementary"
          aria-label="通話・メール履歴"
          tabIndex={0}
        >
          {isMobile && (
            <Box
              onClick={() => setMobileCallLogOpen(!mobileCallLogOpen)}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#f5f5f5', cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider', borderTop: '1px solid', borderTopColor: 'divider' }}
            >
              <Typography variant="subtitle2" fontWeight="bold">📞 通話・メール履歴</Typography>
              <span style={{ transform: mobileCallLogOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', display: 'inline-block' }}>▼</span>
            </Box>
          )}
          <Box sx={{ display: isMobile && !mobileCallLogOpen ? 'none' : undefined }}>
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
                    
                    
                    const displayName = isSms
                      ? (metadata.senderName
                          ? metadata.senderName
                          : (activity.employee
                              ? (activity.employee.name
                                  ? activity.employee.name.split(/[\s\u3000]/)[0]
                                  : (activity.employee.initials || '担当者'))
                              : '担当者'))
                      : (activity.employee ? getDisplayName(activity.employee) : '不明');
                    return (
                      <ListItem
                        key={activity.id}
                        sx={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider', py: 1.5 }}
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
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">物件:</Typography>
                            {propertyNumbers.map((pn: string) => {
                              // metadata.propertyAddressesから住所を取得（存在する場合）
                              const propertyAddresses = metadata.propertyAddresses || {};
                              const address = propertyAddresses[pn] || '';
                              const hasBody = !!metadata.body;
                              return (
                                <Box 
                                  key={pn} 
                                  sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 0.5,
                                    cursor: hasBody ? 'pointer' : 'default',
                                    '&:hover': hasBody ? { bgcolor: 'action.hover', borderRadius: 1 } : {},
                                    p: 0.5,
                                  }}
                                  onClick={() => {
                                    if (metadata.body) {
                                      setSelectedEmailBody(metadata.body);
                                      setEmailBodyModalOpen(true);
                                    } else {
                                      setSnackbar({ open: true, message: 'メール本文が保存されていません（古いメールのため）', severity: 'warning' });
                                    }
                                  }}
                                  title={hasBody ? 'クリックしてメール本文を表示' : 'メール本文が保存されていません'}
                                >
                                  <Chip label={pn} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                  {address && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                      {address}
                                    </Typography>
                                  )}
                                  {hasBody && (
                                    <Typography variant="caption" color="primary" sx={{ fontSize: '0.6rem', ml: 0.5 }}>
                                      📧
                                    </Typography>
                                  )}
                                </Box>
                              );
                            })}
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
          </Box>{/* スマホ時通話履歴開閉Box */}
        </Box>

        {/* 中央列: 物件詳細カード - 独立スクロール */}
        <Box
          sx={{
            flex: '0 0 36%',
            minWidth: 0,
            height: isMobile ? 'auto' : '100%',
            overflowY: isMobile ? 'visible' : 'auto',
            overflowX: 'hidden',
            borderRight: isMobile ? 'none' : '1px solid',
            borderColor: 'divider',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible', borderRight: 'none' },
          }}
          role="complementary"
          aria-label="物件詳細カード"
          tabIndex={0}
        >
          {isMobile && (
            <Box
              onClick={() => setMobilePropertyCardOpen(!mobilePropertyCardOpen)}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#e8f5e9', cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider', borderTop: '1px solid', borderTopColor: 'divider' }}
            >
              <Typography variant="subtitle2" fontWeight="bold">🏠 物件詳細カード</Typography>
              <span style={{ transform: mobilePropertyCardOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', display: 'inline-block' }}>▼</span>
            </Box>
          )}
          <Box sx={{ display: isMobile && !mobilePropertyCardOpen ? 'none' : undefined }}>
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

            {/* 他社物件情報セクション */}
            {hasOtherCompanyPropertyData(buyer) && (
              <Paper
                sx={{
                  p: 3,
                  mb: 2,
                  bgcolor: '#fff9e6',
                  border: '2px solid #f0e5c0',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: '#856404' }}>
                  他社物件情報
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <InlineEditableField
                      label="他社物件"
                      value={buyer?.other_company_property || ''}
                      fieldName="other_company_property"
                      fieldType="textarea"
                      onSave={handleInlineFieldSave}
                      onChange={(fieldName, newValue) => handleFieldChange('他社物件情報', fieldName, newValue)}
                      buyerId={buyer_number}
                      enableConflictDetection={false}
                      showEditIndicator={true}
                      alwaysShowBorder={true}
                      helperText="こちらは詳細な住所のみにしてください。お客様に物件情報として表示されます。他社名や価格は「建物名/価格」欄に書いてください。"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <InlineEditableField
                      label="建物名/価格"
                      value={buyer?.building_name_price || ''}
                      fieldName="building_name_price"
                      fieldType="textarea"
                      onSave={handleInlineFieldSave}
                      onChange={(fieldName, newValue) => handleFieldChange('他社物件情報', fieldName, newValue)}
                      buyerId={buyer_number}
                      enableConflictDetection={false}
                      showEditIndicator={true}
                    />
                  </Grid>
                </Grid>
              </Paper>
            )}
          </Box>
          </Box>{/* スマホ時物件カード開閉Box */}
        </Box>

        {/* 右列: 買主情報フィールド + 関連買主 - 独立スクロール */}
        <Box
          sx={{
            flex: '1 1 46%',
            minWidth: 0,
            height: isMobile ? 'auto' : '100%',
            overflowY: isMobile ? 'visible' : 'auto',
            overflowX: 'hidden',
            order: isMobile ? -1 : 0,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible' },
            ...(isMobile && {
              '& .MuiInputBase-root': { minHeight: 44 },
              '& .MuiOutlinedInput-root': { minHeight: 44 },
              '& .MuiSelect-select': { minHeight: 44, display: 'flex', alignItems: 'center' },
            }),
          }}
          role="main"
          aria-label="買主情報"
          tabIndex={0}
        >
          {isMobile && (
            <Box
              onClick={() => setMobileBuyerInfoOpen(!mobileBuyerInfoOpen)}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#e3f2fd', cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Typography variant="subtitle2" fontWeight="bold">👤 買主情報</Typography>
              <span style={{ transform: mobileBuyerInfoOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', display: 'inline-block' }}>▼</span>
            </Box>
          )}
          <Box sx={{ display: isMobile && !mobileBuyerInfoOpen ? 'none' : undefined }}>


          {BUYER_FIELD_SECTIONS.map((section) => (
            <Box key={section.title}>
            <Paper 
              sx={{ 
                p: 2, 
                mb: 2,
                transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
                // 変更あり（未保存）のセクションは背景色で強調
                ...(sectionDirtyStates[section.title] && {
                  bgcolor: 'rgba(255, 152, 0, 0.08)',
                  boxShadow: '0 0 0 2px rgba(255, 152, 0, 0.4)',
                }),
                // 内覧結果グループには特別なスタイルを適用
                ...(section.isViewingResultGroup && {
                  bgcolor: 'rgba(33, 150, 243, 0.08)',  // 薄い青色の背景
                  border: '1px solid',
                  borderColor: 'rgba(46, 125, 50, 0.3)',
                }),
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography 
                  variant="h6" 
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
                {/* 「問合せ内容」以外のセクションはヘッダー右上に保存ボタンを表示 */}
                {section.title !== '問合せ内容' && (
                  <SectionSaveButton
                    isDirty={sectionDirtyStates[section.title] || false}
                    isSaving={sectionSavingStates[section.title] || false}
                    onSave={() => handleSectionSave(section.title)}
                  />
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={isMobile ? 1 : 2}>
                {section.fields.map((field: any, fieldIndex: number) => {
                  const value = buyer[field.key];
                  
                  // multilineフィールドは全幅で表示
                  // company_name は broker_inquiry と同じ行に並べるため xs=6
                  // isMobile 時は全フィールドを xs=12 の1カラムに
                  const gridSize = isMobile ? { xs: 12 } : (field.multiline ? { xs: 12 } : field.key === 'company_name' ? { xs: 6 } : { xs: 12, sm: 6 });

                  // インライン編集可能なフィールド
                  if (field.inlineEditable) {
                    // inquiry_sourceフィールドは特別処理（ドロップダウン）
                    if (field.key === 'inquiry_source') {
                      const handleFieldSave = async (newValue: any) => {
                        // UIを即座に更新（楽観的更新）
                        setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                        handleFieldChange(section.title, field.key, newValue);
                        // 必須フィールドの再チェック
                        setMissingRequiredFields(prev => {
                          const next = new Set(prev);
                          if (newValue && String(newValue).trim()) next.delete('inquiry_source');
                          else next.add('inquiry_source');
                          return next;
                        });
                        // バックグラウンドで保存
                        handleInlineFieldSave(field.key, newValue).catch(console.error);
                      };

                      const isInquirySourceMissing = missingRequiredFields.has('inquiry_source');
                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <Box sx={{
                            border: isInquirySourceMissing ? '2px solid #f44336' : 'none',
                            borderRadius: isInquirySourceMissing ? 1 : 0,
                            p: isInquirySourceMissing ? 0.5 : 0,
                            bgcolor: isInquirySourceMissing ? 'rgba(244,67,54,0.05)' : 'transparent',
                          }}>
                            {isInquirySourceMissing && (
                              <Typography variant="caption" color="error" sx={{ fontWeight: 'bold', display: 'block', mb: 0.25 }}>
                                {field.label} *
                              </Typography>
                            )}
                            <InlineEditableField
                              key={`inquiry_source-${isInquirySourceMissing}`}
                              label={isInquirySourceMissing ? '' : field.label}
                              value={buyer[field.key] || ''}
                              fieldName={field.key}
                              fieldType="dropdown"
                              options={INQUIRY_SOURCE_OPTIONS}
                              onSave={handleFieldSave}
                              onChange={(fieldName, newValue) => {
                                handleFieldChange(section.title, fieldName, newValue);
                                // 選択した瞬間に必須マークを消す
                                if (newValue && String(newValue).trim()) {
                                  setMissingRequiredFields(prev => {
                                    const next = new Set(prev);
                                    next.delete('inquiry_source');
                                    return next;
                                  });
                                }
                              }}
                              buyerId={buyer_number}
                              enableConflictDetection={false}
                              showEditIndicator={true}
                              validation={(newValue) => {
                                if (buyer.broker_inquiry === '業者問合せ') return null;
                                if (!newValue || !String(newValue).trim()) return '問合せ元は必須です';
                                return null;
                              }}
                            />
                          </Box>
                        </Grid>
                      );
                    }

                    // latest_statusフィールドは特別処理（ドロップダウン）
                    if (field.key === 'latest_status') {
                      const handleFieldSave = async (newValue: any) => {
                        // UIを即座に更新（楽観的更新）
                        setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                        handleFieldChange(section.title, field.key, newValue);
                        // 必須フィールドの再チェック
                        setMissingRequiredFields(prev => {
                          const next = new Set(prev);
                          if (newValue && String(newValue).trim()) next.delete('latest_status');
                          else next.add('latest_status');
                          return next;
                        });
                        // バックグラウンドで保存
                        handleInlineFieldSave(field.key, newValue).catch(console.error);
                      };

                      const isLatestStatusMissing = missingRequiredFields.has('latest_status');
                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <Box sx={{
                            border: isLatestStatusMissing ? '2px solid #f44336' : 'none',
                            borderRadius: isLatestStatusMissing ? 1 : 0,
                            p: isLatestStatusMissing ? 0.5 : 0,
                            bgcolor: isLatestStatusMissing ? 'rgba(244,67,54,0.05)' : 'transparent',
                          }}>
                            {isLatestStatusMissing && (
                              <Typography variant="caption" color="error" sx={{ fontWeight: 'bold', display: 'block', mb: 0.25 }}>
                                {field.label} *
                              </Typography>
                            )}
                            <InlineEditableField
                              key={`latest_status-${isLatestStatusMissing}`}
                              label={isLatestStatusMissing ? '' : field.label}
                              value={buyer[field.key] || ''}
                              fieldName={field.key}
                              fieldType="dropdown"
                              options={LATEST_STATUS_OPTIONS}
                              onSave={handleFieldSave}
                              onChange={(fieldName, newValue) => {
                                handleFieldChange(section.title, fieldName, newValue);
                                // 選択した瞬間に必須マークを消す
                                if (newValue && String(newValue).trim()) {
                                  setMissingRequiredFields(prev => {
                                    const next = new Set(prev);
                                    next.delete('latest_status');
                                    return next;
                                  });
                                }
                              }}
                              buyerId={buyer_number}
                              enableConflictDetection={false}
                              showEditIndicator={true}
                            />
                          </Box>
                        </Grid>
                      );
                    }

                    // inquiry_email_phoneフィールドは特別処理（ボタン選択 + 即時保存）
                    if (field.key === 'inquiry_email_phone') {
                      // 問合せ元に「電話」が含まれる場合は非表示
                      if (buyer.inquiry_source && buyer.inquiry_source.includes('電話')) {
                        return null;
                      }
                      const INQUIRY_EMAIL_PHONE_BTNS = ['済', '未', '不通', '電話番号なし', '不要'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            border: missingRequiredFields.has('inquiry_email_phone') ? '2px solid #f44336' : 'none',
                            borderRadius: missingRequiredFields.has('inquiry_email_phone') ? 1 : 0,
                            p: missingRequiredFields.has('inquiry_email_phone') ? 0.5 : 0,
                            bgcolor: missingRequiredFields.has('inquiry_email_phone') ? 'rgba(244,67,54,0.05)' : 'transparent',
                          }}>
                            <Typography variant="caption" color={missingRequiredFields.has('inquiry_email_phone') ? 'error' : 'text.secondary'} sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: missingRequiredFields.has('inquiry_email_phone') ? 'bold' : 'normal' }}>
                              {field.label}{missingRequiredFields.has('inquiry_email_phone') ? ' *' : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {INQUIRY_EMAIL_PHONE_BTNS.map((opt) => {
                                const isSelected = value === opt;
                                return (
                                  <Button
                                    key={opt}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color={opt === '済' ? 'success' : opt === '未' ? 'error' : 'primary'}
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('inquiry_email_phone');
                                        else next.add('inquiry_email_phone');
                                        return next;
                                      });
                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                    }}
                                    sx={{
                                      flex: 1,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {opt}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }

                    // inquiry_email_replyフィールドは特別処理（ボタン選択 + 即時保存）
                    if (field.key === 'inquiry_email_reply') {
                      const INQUIRY_EMAIL_REPLY_BTNS = ['済', '未', '不要'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            border: missingRequiredFields.has('inquiry_email_reply') ? '2px solid #f44336' : 'none',
                            borderRadius: missingRequiredFields.has('inquiry_email_reply') ? 1 : 0,
                            p: missingRequiredFields.has('inquiry_email_reply') ? 0.5 : 0,
                            bgcolor: missingRequiredFields.has('inquiry_email_reply') ? 'rgba(244,67,54,0.05)' : 'transparent',
                          }}>
                            <Typography variant="caption" color={missingRequiredFields.has('inquiry_email_reply') ? 'error' : 'text.secondary'} sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: missingRequiredFields.has('inquiry_email_reply') ? 'bold' : 'normal' }}>
                              {field.label}{missingRequiredFields.has('inquiry_email_reply') ? ' *' : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {INQUIRY_EMAIL_REPLY_BTNS.map((opt) => {
                                const isSelected = buyer?.[field.key] === opt;
                                return (
                                  <Button
                                    key={opt}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color={opt === '済' ? 'success' : opt === '未' ? 'error' : 'primary'}
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('inquiry_email_reply');
                                        else next.add('inquiry_email_reply');
                                        return next;
                                      });
                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                    }}
                                    sx={{
                                      flex: 1,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {opt}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }

                    // distribution_typeフィールドは特別処理（必須・ボタン選択UI）
                    if (field.key === 'distribution_type') {
                      const isDistributionMissing = missingRequiredFields.has('distribution_type');
                      return (
                        <Grid item xs={12} sm={6} key={`${section.title}-${field.key}`}>
                          {isDistributionMissing && (
                            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
                              ⚠ 配信メール（必須）
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color={isDistributionMissing ? 'error' : 'text.secondary'} sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: isDistributionMissing ? 'bold' : 'normal' }}>
                              {field.label}{isDistributionMissing ? ' *' : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {DISTRIBUTION_TYPE_OPTIONS.map((opt) => {
                                const isSelected = buyer[field.key] === opt.value;
                                return (
                                  <Button
                                    key={opt.value}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color="primary"
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt.value;

                                      // 🚨 修正: 「要」に変更する際の即時バリデーションを削除
                                      // ページ遷移時にバリデーションを実行する（handleNavigate関数）

                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('distribution_type');
                                        else next.add('distribution_type');
                                        return next;
                                      });
                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                    }}
                                    sx={{
                                      flex: 1,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {opt.label}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }

                    // pinrichフィールドは特別処理（ドロップダウン）
                    if (field.key === 'pinrich') {
                      const PINRICH_OPTIONS = [
                        '配信中',
                        'クローズ',
                        '登録不要（不可）',
                        '500万以上の設定済み',
                        '配信拒否（顧客より）',
                        '登録無し',
                        '2件目以降',
                        '受信エラー',
                      ];
                      return (
                        <Grid item xs={12} sm={6} key={`${section.title}-${field.key}`}>
                          <FormControl fullWidth size="small">
                            <InputLabel>{field.label}</InputLabel>
                            <Select
                              value={buyer[field.key] || ''}
                              label={field.label}
                              onChange={async (e) => {
                                const newValue = e.target.value;
                                setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                handleFieldChange(section.title, field.key, newValue);
                                // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                              }}
                            >
                              <MenuItem value=""><em>未選択</em></MenuItem>
                              {PINRICH_OPTIONS.map((opt) => (
                                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      );
                    }

                    // pinrich_linkフィールドは特別処理（リンク表示）
                    if (field.key === 'pinrich_link') {
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Link
                            href="https://pinrich.com/management/hankyo"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem' }}
                          >
                            Pinrichリンク
                            <LaunchIcon fontSize="small" />
                          </Link>
                        </Grid>
                      );
                    }

                    // vendor_surveyフィールドは特別処理（値がある場合のみ表示、「未」のときはオレンジ強調）
                    if (field.key === 'vendor_survey') {
                      // 値がない場合は非表示（スプシに入力があった場合のみ表示）
                      if (!buyer?.vendor_survey || !String(buyer.vendor_survey).trim()) {
                        return null;
                      }
                      const VENDOR_SURVEY_BTNS = ['確認済み', '未'];
                      const isUmi = buyer?.vendor_survey === '未';
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 'bold', color: isUmi ? 'warning.main' : 'text.secondary' }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {VENDOR_SURVEY_BTNS.map((opt) => {
                                const isSelected = buyer?.[field.key] === opt;
                                return (
                                  <Button
                                    key={opt}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color={opt === '未' ? 'warning' : 'primary'}
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                    }}
                                    sx={{
                                      flex: 1,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {opt}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }

                    // post_viewing_seller_contactフィールドは特別処理（ボタン選択・即時保存）
                    if (field.key === 'post_viewing_seller_contact') {
                      const POST_VIEWING_OPTIONS = ['済', '未', '不要'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {POST_VIEWING_OPTIONS.map((opt) => {
                                const isSelected = buyer?.[field.key] === opt;
                                return (
                                  <Button
                                    key={opt}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color="primary"
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      await handleInlineFieldSave(field.key, newValue);
                                    }}
                                    sx={{
                                      flex: 1,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {opt}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }

                    // three_calls_confirmedフィールドは特別処理（inquiry_email_phoneに値があれば常時表示）
                    if (field.key === 'three_calls_confirmed') {
                      // inquiry_email_phone に値がない場合は非表示
                      if (!buyer?.inquiry_email_phone) {
                        return null;
                      }
                      const THREE_CALLS_BTNS = ['3回架電OK', '3回架電未', '他'];
                      const isThreeCallsMissing = missingRequiredFields.has('three_calls_confirmed');
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            border: isThreeCallsMissing ? '2px solid #f44336' : 'none',
                            borderRadius: isThreeCallsMissing ? 1 : 0,
                            p: isThreeCallsMissing ? 0.5 : 0,
                            bgcolor: isThreeCallsMissing ? 'rgba(244,67,54,0.05)' : 'transparent',
                          }}>
                            <Typography variant="caption" color={isThreeCallsMissing ? 'error' : 'text.secondary'} sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: isThreeCallsMissing ? 'bold' : 'normal' }}>
                              {field.label}{isThreeCallsMissing ? ' *' : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {THREE_CALLS_BTNS.map((opt) => {
                                const isSelected = buyer?.[field.key] === opt;
                                return (
                                  <Button
                                    key={opt}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color="primary"
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('three_calls_confirmed');
                                        else next.add('three_calls_confirmed');
                                        return next;
                                      });
                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                    }}
                                    sx={{
                                      flex: 1,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {opt}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }

                    // confirmation_to_assigneeフィールドは ConfirmationToAssignee コンポーネントで表示
                    // 物件担当者（sales_assignee）が設定されている場合のみ表示
                    if (field.key === 'confirmation_to_assignee') {
                      const propertyAssignee = linkedProperties[0]?.sales_assignee || null;
                      if (!propertyAssignee) return null;
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <ConfirmationToAssignee
                            buyer={{
                              buyer_number: buyer.buyer_number,
                              name: buyer.name || '',
                              property_number: linkedProperties[0]?.property_number || '',
                              confirmation_to_assignee: buyer.confirmation_to_assignee,
                            }}
                            propertyAssignee={propertyAssignee}
                            onSendSuccess={() => {
                              fetchBuyer();
                              setSnackbar({ open: true, message: 'チャットを送信しました', severity: 'success' });
                            }}
                          />
                        </Grid>
                      );
                    }

                    // initial_assigneeフィールドは特別処理（ボックス選択）
                    if (field.key === 'initial_assignee') {
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption" color={missingRequiredFields.has('initial_assignee') ? 'error' : 'text.secondary'} sx={{ fontWeight: missingRequiredFields.has('initial_assignee') ? 'bold' : 'normal' }}>
                              {field.label}{missingRequiredFields.has('initial_assignee') ? ' *' : ''}
                            </Typography>
                            {/* 「問合せ内容」セクションの保存ボタンは初動担当の右横に配置 */}
                            {section.title === '問合せ内容' && (
                              <SectionSaveButton
                                isDirty={sectionDirtyStates[section.title] || false}
                                isSaving={sectionSavingStates[section.title] || false}
                                onSave={() => handleSectionSave(section.title)}
                              />
                            )}
                          </Box>
                          <Box sx={{
                            display: 'flex', flexWrap: 'wrap', gap: 0.5,
                            border: missingRequiredFields.has('initial_assignee') ? '2px solid #f44336' : 'none',
                            borderRadius: missingRequiredFields.has('initial_assignee') ? 1 : 0,
                            p: missingRequiredFields.has('initial_assignee') ? 0.5 : 0,
                            bgcolor: missingRequiredFields.has('initial_assignee') ? 'rgba(244,67,54,0.05)' : 'transparent',
                          }}>
                            {normalInitials.length === 0 && (
                              <Typography variant="caption" color="text.secondary">読み込み中...</Typography>
                            )}
                            {normalInitials.map((initial) => {
                              const isSelected = buyer.initial_assignee === initial;
                              return (
                                <Button
                                  key={initial}
                                  size="small"
                                  variant={isSelected ? 'contained' : 'outlined'}
                                  color="primary"
                                  onClick={() => {
                                    const newValue = isSelected ? '' : initial;
                                    // 即座にUI更新
                                    setBuyer((prev: any) => prev ? { ...prev, initial_assignee: newValue } : prev);
                                    // sectionChangedFieldsに記録（保存ボタン押下時にまとめて保存するため）
                                    handleFieldChange(section.title, 'initial_assignee', newValue);
                                    // 必須マーク更新
                                    setMissingRequiredFields(prev => {
                                      const next = new Set(prev);
                                      if (newValue) next.delete('initial_assignee');
                                      else next.add('initial_assignee');
                                      return next;
                                    });
                                    // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                  }}
                                  sx={{
                                    minWidth: 40,
                                    px: 1.5,
                                    py: 0.5,
                                    fontWeight: isSelected ? 'bold' : 'normal',
                                    borderRadius: 1,
                                  }}
                                >
                                  {initial}
                                </Button>
                              );
                            })}
                            {/* 現在の値がリストにない場合も表示 */}
                            {buyer.initial_assignee && !normalInitials.includes(buyer.initial_assignee) && (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                sx={{ minWidth: 40, px: 1.5, py: 0.5, fontWeight: 'bold', borderRadius: 1 }}
                              >
                                {buyer.initial_assignee}
                              </Button>
                            )}
                          </Box>
                        </Grid>
                      );
                    }

                    // broker_inquiryフィールドは特別処理（ボックス選択・法人名の右隣xs=6）
                    if (field.key === 'broker_inquiry') {
                      const BROKER_OPTIONS = ['業者問合せ', '業者（両手）'];
                      return (
                        <Grid item xs={6} key={`${section.title}-${field.key}`}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {field.label}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {BROKER_OPTIONS.map((option) => {
                              const isSelected = buyer.broker_inquiry === option;
                              return (
                                <Button
                                  key={option}
                                  size="small"
                                  variant={isSelected ? 'contained' : 'outlined'}
                                  color="primary"
                                  onClick={async () => {
                                    const newValue = isSelected ? '' : option;
                                    // 業者問合せ選択時は配信メールを「不要」に自動セット（UI即時反映）
                                    setBuyer((prev: any) => {
                                      if (!prev) return prev;
                                      const updated: any = { ...prev, [field.key]: newValue };
                                      if (newValue === '業者問合せ') {
                                        updated.distribution_type = '不要';
                                      }
                                      return updated;
                                    });
                                    handleFieldChange(section.title, field.key, newValue);
                                    // 業者問合せ選択時は distribution_type も即時保存
                                    if (newValue === '業者問合せ') {
                                      handleFieldChange('問合せ内容', 'distribution_type', '不要');
                                      await handleInlineFieldSave('distribution_type', '不要');
                                    }
                                    // SAVE_BUTTON_FIELDS に含まれるため broker_inquiry 自体の handleInlineFieldSave は呼ばない
                                  }}
                                  sx={{
                                    flex: 1,
                                    py: 0.5,
                                    fontSize: '0.7rem',
                                    fontWeight: isSelected ? 'bold' : 'normal',
                                    borderRadius: 1,
                                  }}
                                >
                                  {option}
                                </Button>
                              );
                            })}
                          </Box>
                        </Grid>
                      );
                    }

                    // owned_home_hearing_inquiry フィールドは特別処理（スタッフイニシャル選択）
                    if (field.key === 'owned_home_hearing_inquiry') {
                      const SPECIAL_OPTIONS = ['不要', '未'];  // 追加
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {normalInitials.map((initial) => {
                                const isSelected = buyer.owned_home_hearing_inquiry === initial;
                                return (
                                  <Button
                                    key={initial}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color="primary"
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : initial;
                                      setBuyer((prev: any) => {
                                        if (!prev) return prev;
                                        const updated = { ...prev, [field.key]: newValue };
                                        // owned_home_hearing_inquiry が変わったら owned_home_hearing_result の必須状態を再計算
                                        setMissingRequiredFields(prevMissing => {
                                          const next = new Set(prevMissing);
                                          if (isHomeHearingResultRequired(updated)) {
                                            if (!updated.owned_home_hearing_result || !String(updated.owned_home_hearing_result).trim()) {
                                              next.add('owned_home_hearing_result');
                                            }
                                          } else {
                                            next.delete('owned_home_hearing_result');
                                          }
                                          return next;
                                        });
                                        return updated;
                                      });
                                      handleFieldChange(section.title, field.key, newValue);
                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                    }}
                                    sx={{
                                      minWidth: 40,
                                      px: 1.5,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {initial}
                                  </Button>
                                );
                              })}
                              {/* 「不要」「未」ボタンを追加 */}
                              {SPECIAL_OPTIONS.map((option) => {
                                const isSelected = buyer.owned_home_hearing_inquiry === option;
                                return (
                                  <Button
                                    key={option}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color="secondary"  // イニシャルと区別するため異なる色
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : option;
                                      setBuyer((prev: any) => {
                                        if (!prev) return prev;
                                        const updated = { ...prev, [field.key]: newValue };
                                        // 必須状態を再計算
                                        setMissingRequiredFields(prevMissing => {
                                          const next = new Set(prevMissing);
                                          if (isHomeHearingResultRequired(updated)) {
                                            if (!updated.owned_home_hearing_result || !String(updated.owned_home_hearing_result).trim()) {
                                              next.add('owned_home_hearing_result');
                                            }
                                          } else {
                                            next.delete('owned_home_hearing_result');
                                          }
                                          return next;
                                        });
                                        return updated;
                                      });
                                      handleFieldChange(section.title, field.key, newValue);
                                    }}
                                    sx={{
                                      minWidth: 60,
                                      px: 1.5,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {option}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }

                    // owned_home_hearing_result フィールドは特別処理（4択ボタン・条件付き表示）
                    if (field.key === 'owned_home_hearing_result') {
                      const inquiry = buyer.owned_home_hearing_inquiry;
                      // 問合時持家ヒアリングが空、「不要」、「未」の場合は非表示
                      if (!inquiry || inquiry === '不要' || inquiry === '未') {
                        return null;
                      }
                      const RESULT_OPTIONS = ['持家（マンション）', '持家（戸建）', '賃貸', '他不明'];
                      const showValuationText = ['持家（マンション）', '持家（戸建）'].includes(
                        buyer.owned_home_hearing_result
                      );
                      const isResultMissing = missingRequiredFields.has('owned_home_hearing_result');
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{
                            display: 'flex', flexDirection: 'column', gap: 0.5,
                          }}>
                            <Typography variant="caption" color={isResultMissing ? 'error' : 'text.secondary'} sx={{ fontWeight: isResultMissing ? 'bold' : 'normal' }}>
                              {field.label}{isResultMissing ? ' *' : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              {RESULT_OPTIONS.map((option) => {
                                const isSelected = buyer.owned_home_hearing_result === option;
                                return (
                                  <Button
                                    key={option}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color="primary"
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : option;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) {
                                          next.delete('owned_home_hearing_result');
                                        } else if (isHomeHearingResultRequired(buyer)) {
                                          next.add('owned_home_hearing_result');
                                        } else {
                                          next.delete('owned_home_hearing_result');
                                        }
                                        return next;
                                      });
                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                    }}
                                    sx={{
                                      flex: 1,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                      // 必須条件を満たしているが未選択の場合は赤枠
                                      border: isResultMissing && !isSelected ? '2px solid red' : undefined,
                                    }}
                                  >
                                    {option}
                                  </Button>
                                );
                              })}
                            </Box>
                            {showValuationText && (
                              <Typography variant="caption" color="primary.main" sx={{ mt: 0.5 }}>
                                机上査定を無料で行っていますがこの後メールで査定額差し上げましょうか？
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                      );
                    }

                    // valuation_required フィールドは特別処理（2択ボタン・条件付き表示）
                    if (field.key === 'valuation_required') {
                      const showValuation = ['持家（マンション）', '持家（戸建）'].includes(
                        buyer.owned_home_hearing_result
                      );
                      if (!showValuation) return null;
                      const VALUATION_OPTIONS = ['要', '不要'];
                      return (
                        <>
                          <Grid item xs={12} key={`${section.title}-${field.key}`}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {field.label}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {VALUATION_OPTIONS.map((option) => {
                                  const isSelected = buyer.valuation_required === option;
                                  return (
                                    <Button
                                      key={option}
                                      size="small"
                                      variant={isSelected ? 'contained' : 'outlined'}
                                      color="primary"
                                      onClick={() => {
                                        const newValue = isSelected ? '' : option;
                                        // UIを即座に更新
                                        setBuyer((prev: any) => prev ? { ...prev, valuation_required: newValue } : prev);
                                        handleFieldChange(section.title, field.key, newValue);
                                        // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                      }}
                                      sx={{
                                        flex: 1,
                                        py: 0.5,
                                        fontWeight: isSelected ? 'bold' : 'normal',
                                        borderRadius: 1,
                                      }}
                                    >
                                      {option}
                                    </Button>
                                  );
                                })}
                              </Box>
                            </Box>
                          </Grid>
                          {buyer.valuation_required === '要' && (() => {
                            const propertyType = buyer.property_type || '';
                            const isManshon = propertyType === 'マ';
                            const isTochi = propertyType === '土';

                            // 全角数字→半角変換
                            const toHalfWidth = (str: string) =>
                              str.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

                            // ボタン選択ヘルパー（UIを即座に更新し、保存はバックグラウンドで実行）
                            const renderButtonSelect = (fieldKey: string, label: string, options: string[]) => (
                              <Grid item xs={12} key={`valuation-field-${fieldKey}`}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {label}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                                    {options.map((option) => {
                                      const isSelected = buyer[fieldKey] === option;
                                      return (
                                        <Button
                                          key={option}
                                          size="small"
                                          variant={isSelected ? 'contained' : 'outlined'}
                                          color="primary"
                                          onClick={() => {
                                            const newValue = isSelected ? '' : option;
                                            setBuyer((prev: any) => prev ? { ...prev, [fieldKey]: newValue } : prev);
                                            handleFieldChange(section.title, fieldKey, newValue);
                                            handleInlineFieldSave(fieldKey, newValue).catch(console.error);
                                          }}
                                          sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                                        >
                                          {option}
                                        </Button>
                                      );
                                    })}
                                  </Box>
                                </Box>
                              </Grid>
                            );

                            // 数値入力ヘルパー（直接入力・全角対応）
                            const renderNumberInput = (fieldKey: string, label: string, step: number = 1) => {
                              const isDecimal = step < 1;
                              return (
                                <Grid item xs={12} key={`valuation-field-${fieldKey}`}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                                      {label}
                                    </Typography>
                                    <TextField
                                      size="small"
                                      defaultValue={buyer[fieldKey] ?? ''}
                                      onChange={(e) => {
                                        const half = toHalfWidth(e.target.value);
                                        e.target.value = half;
                                      }}
                                      onBlur={async (e) => {
                                        const half = toHalfWidth(e.target.value);
                                        const num = parseFloat(half);
                                        const saved = isNaN(num) ? '' : (isDecimal ? num.toFixed(2) : String(Math.round(num)));
                                        setBuyer((prev: any) => prev ? { ...prev, [fieldKey]: saved } : prev);
                                        handleFieldChange(section.title, fieldKey, saved);
                                        handleInlineFieldSave(fieldKey, saved).catch(console.error);
                                      }}
                                      sx={{ flex: 1 }}
                                      inputProps={{ inputMode: 'decimal' }}
                                      placeholder={isDecimal ? '0.00' : '0'}
                                    />
                                  </Box>
                                </Grid>
                              );
                            };

                            // テキスト入力ヘルパー（ロングテキスト）
                            const renderTextInput = (fieldKey: string, label: string) => (
                              <Grid item xs={12} key={`valuation-field-${fieldKey}`}>
                                <InlineEditableField
                                  label={label}
                                  value={buyer[fieldKey] || ''}
                                  fieldName={fieldKey}
                                  multiline={true}
                                  onSave={async (newValue: any) => {
                                    setBuyer((prev: any) => prev ? { ...prev, [fieldKey]: newValue } : prev);
                                    handleInlineFieldSave(fieldKey, newValue).catch(console.error);
                                  }}
                                  onChange={(fn: string, nv: any) => handleFieldChange(section.title, fn, nv)}
                                  buyerId={buyer_number}
                                  fieldType="text"
                                />
                              </Grid>
                            );

                            // ドロップダウンヘルパー
                            const renderDropdown = (fieldKey: string, label: string, options: string[]) => (
                              <Grid item xs={12} key={`valuation-field-${fieldKey}`}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {label}
                                  </Typography>
                                  <FormControl size="small" sx={{ flex: 1 }}>
                                    <Select
                                      value={buyer[fieldKey] || ''}
                                      onChange={async (e) => {
                                        setBuyer((prev: any) => prev ? { ...prev, [fieldKey]: e.target.value } : prev);
                                        handleFieldChange(section.title, fieldKey, e.target.value);
                                        handleInlineFieldSave(fieldKey, e.target.value).catch(console.error);
                                      }}
                                      displayEmpty
                                    >
                                      <MenuItem value=""><em>-</em></MenuItem>
                                      {options.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                                    </Select>
                                  </FormControl>
                                </Box>
                              </Grid>
                            );

                            return (
                              <>
                                {renderButtonSelect('property_type', '種別', PROPERTY_TYPE_OPTIONS)}
                                {renderTextInput('location', '所在地')}
                                {renderButtonSelect('current_status', '現況', CURRENT_STATUS_OPTIONS)}
                                {!isManshon && renderNumberInput('land_area', '土地面積（不明の場合は空欄）', 0.01)}
                                {!isTochi && renderNumberInput('building_area', '建物面積（不明の場合は空欄）', 0.01)}
                                {!isTochi && renderDropdown('floor_plan', '間取り', FLOOR_PLAN_OPTIONS)}
                                {!isTochi && renderNumberInput('build_year', '築年（西暦）', 1)}
                                {!isTochi && renderTextInput('renovation_history', 'リフォーム履歴（その他太陽光等も）')}
                                {renderTextInput('other_valuation_done', '他に査定したことある？')}
                                {renderTextInput('owner_name', '名義人')}
                                {renderTextInput('loan_balance', 'ローン残')}
                                {renderButtonSelect('visit_desk', '訪問/机上', VISIT_DESK_OPTIONS)}
                                {renderButtonSelect('seller_list_copy', '売主リストコピー', SELLER_LIST_COPY_OPTIONS)}
                              </>
                            );
                          })()}
                        </>
                      );
                    }

                    // その他のフィールド
                    const handleFieldSave = async (newValue: any) => {
                      // UIを即座に更新（楽観的更新）してからAPIをバックグラウンドで保存
                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                      handleInlineFieldSave(field.key, newValue).catch(console.error);
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

                    // message_to_assigneeフィールドはRichTextEditorとクイックボタンで表示
                    if (field.key === 'message_to_assignee') {
                      const isDirty = messageToAssigneeEditValue !== (buyer?.message_to_assignee || '');
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          {/* 担当への伝言/質問事項用クイック入力ボタン */}
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                              {ASSIGNEE_MESSAGE_QUICK_INPUTS.map((item) => (
                                <Chip
                                  key={item.label}
                                  label={item.label}
                                  onClick={() => messageToAssigneeEditorRef.current?.insertAtCursor(`<b>${item.text}</b>`)}
                                  size="small"
                                  clickable
                                  color="primary"
                                  variant="outlined"
                                  sx={{ cursor: 'pointer' }}
                                />
                              ))}
                            </Box>
                          </Box>
                          <Box sx={{
                            border: isDirty ? '2px solid #ff6d00' : '2px solid transparent',
                            borderRadius: 1,
                            transition: 'border-color 0.2s',
                          }}>
                            <RichTextCommentEditor
                              ref={messageToAssigneeEditorRef}
                              value={messageToAssigneeEditValue}
                              onChange={(html) => setMessageToAssigneeEditValue(html)}
                              placeholder="担当への伝言・質問事項を入力..."
                            />
                          </Box>
                          <Button
                            fullWidth
                            variant={isDirty ? 'contained' : 'outlined'}
                            size="large"
                            onClick={handleSaveMessageToAssignee}
                            disabled={messageToAssigneeSaving}
                            sx={{
                              mt: 1,
                              ...(isDirty ? {
                                backgroundColor: '#ff6d00',
                                color: '#fff',
                                fontWeight: 'bold',
                                boxShadow: '0 0 0 3px rgba(255,109,0,0.4)',
                                animation: 'pulse-orange 1.5s infinite',
                                '&:hover': { backgroundColor: '#e65100' },
                              } : {
                                color: '#bdbdbd',
                                borderColor: '#e0e0e0',
                              }),
                            }}
                          >
                            {messageToAssigneeSaving ? '保存中...' : '保存'}
                          </Button>
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
                          onChange={(fieldName, newValue) => handleFieldChange(section.title, fieldName, newValue)}
                          readOnly={field.readOnly === true}
                          buyerId={buyer_number}
                          enableConflictDetection={false}
                          showEditIndicator={!field.readOnly}
                          highlighted={field.key === 'next_call_date'}
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
                {/* セクション下部にも保存ボタンを表示（フィールドが多い場合に上部が見えなくなるため） */}
                {section.title === '問合せ内容' && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                      <SectionSaveButton
                        isDirty={sectionDirtyStates[section.title] || false}
                        isSaving={sectionSavingStates[section.title] || false}
                        onSave={() => handleSectionSave(section.title)}
                      />
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Paper>
            
            {/* 基本情報セクションの直後に買付率ボタンを表示 */}
            {section.title === '基本情報' && (
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<BarChartIcon />}
                  onClick={() => navigate('/buyers/purchase-rate-statistics')}
                  sx={{ minWidth: 200 }}
                >
                  買付率
                </Button>
              </Box>
            )}
            </Box>
          ))}

          </Box>{/* スマホ時買主情報開閉Box */}
        </Box>
      </Box>



      {/* スナックバー */}
      {/* バリデーション警告ダイアログ */}
      <ValidationWarningDialog
        open={validationDialogOpen}
        missingFieldLabels={pendingMissingLabels}
        onProceed={() => {
          setValidationDialogOpen(false);
          navigate(pendingNavigationUrl);
        }}
        onStay={() => setValidationDialogOpen(false)}
        onGoToDesiredConditions={() => {
          setValidationDialogOpen(false);
          navigate(`/buyers/${buyer_number}/desired-conditions`);
        }}
      />

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

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>買主を削除しますか？</DialogTitle>
        <DialogContent>
          <Typography>
            {buyer?.name}（{buyer?.buyer_number}）をDBから削除します。<br />
            削除後も復元可能ですが、一覧から非表示になります。
          </Typography>
          <Typography sx={{ color: 'error.main', fontWeight: 'bold', mt: 1 }}>
            買主リスト（スプシ）も1行削除してください
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>キャンセル</Button>
          <Button onClick={handleDeleteBuyer} color="error" variant="contained" disabled={deleting}>
            {deleting ? '削除中...' : '削除する'}
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* メール本文表示モーダル */}
      <Dialog
        open={emailBodyModalOpen}
        onClose={() => setEmailBodyModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>メール本文</DialogTitle>
        <DialogContent>
          <Box sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            {selectedEmailBody}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailBodyModalOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
