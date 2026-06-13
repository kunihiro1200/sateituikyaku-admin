import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Chip,
  Alert,
  Tooltip,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import api, { buyerApi, employeeApi } from '../services/api';
import { InlineEditableField } from '../components/InlineEditableField';
import RichTextCommentEditor, { RichTextCommentEditorHandle } from '../components/RichTextCommentEditor';
import { LATEST_STATUS_OPTIONS } from '../utils/buyerLatestStatusOptions';
import { VIEWING_UNCONFIRMED_OPTIONS } from '../utils/buyerDetailFieldOptions';
import { ValidationService } from '../services/ValidationService';
import PreDayEmailButton from '../components/PreDayEmailButton';
import SmsIcon from '@mui/icons-material/Sms';
import { useAuthStore } from '../store/authStore';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';
import { OfferFailedChatSentPopup } from '../components/OfferFailedChatSentPopup';
import CompactBuyerListForProperty from '../components/CompactBuyerListForProperty';

/**
 * カレンダーイベントのタイトルを生成する
 * - viewing_mobile（専任物件用）を優先し、空の場合は viewing_type_general（一般媒介用）を使用
 * - 「立会」を含み「立会不要」を含まない場合のみ末尾に（買主氏名）を追加
 */
export function generateCalendarTitle(
  viewingType: string | undefined | null,
  viewingTypeGeneral: string | undefined | null,
  propertyAddress: string | undefined | null,
  buyerName: string | undefined | null,
  otherCompanyProperty: string | undefined | null = null
): string {
  const viewingTypeValue = viewingType || viewingTypeGeneral || '';
  // 自社物件の住所がない場合は他社物件フィールドの内容を使用
  const propertyAddr = propertyAddress || otherCompanyProperty || '';
  const isRittai = viewingTypeValue.includes('立会') && !viewingTypeValue.includes('立会不要');
  const buyerNameSuffix = isRittai && buyerName ? `（${buyerName}）` : '';
  return `${viewingTypeValue}${propertyAddr}${buyerNameSuffix}`.trim();
}

/**
 * 業者問合せ時にカレンダータイトル末尾に氏名・会社名を追加する
 * @param baseTitle - generateCalendarTitle で生成した基本タイトル
 * @param brokerInquiry - buyer.broker_inquiry の値
 * @param buyerName - buyer.name の値
 * @returns 加工後のタイトル文字列
 */
export function applyAgencyInquiryTitle(
  baseTitle: string,
  brokerInquiry: string | undefined | null,
  buyerName: string | undefined | null
): string {
  if (brokerInquiry === '業者問合せ' && buyerName && buyerName.trim().length > 0) {
    return `${baseTitle} ${buyerName}`;
  }
  return baseTitle;
}

/**
 * カレンダーイベントの説明欄を生成する
 * 末尾に買主詳細画面のURLを追加する
 */
export function generateCalendarDescription(
  propertyAddress: string | undefined | null,
  googleMapUrl: string | undefined | null,
  buyerName: string | undefined | null,
  buyerNumber: string | undefined | null,
  phoneNumber: string | undefined | null,
  inquiryHearing: string | undefined | null
): string {
  const baseUrl = 'https://sateituikyaku-admin-frontend.vercel.app';
  return (
    `買主番号: ${buyerNumber || 'なし'}\n` +
    `物件住所: ${propertyAddress || 'なし'}\n` +
    `GoogleMap: ${googleMapUrl || 'なし'}\n` +
    `\n` +
    `お客様名: ${buyerName || buyerNumber || 'なし'}\n` +
    `電話番号: ${phoneNumber || 'なし'}\n` +
    `問合時ヒアリング: ${inquiryHearing || 'なし'}\n` +
    `買主詳細: ${baseUrl}/buyers/${buyerNumber || ''}`
  );
}

/**
 * 内覧前日SMS本文を生成する
 * 木曜日内覧 → 「明後日の〇月〇日」
 * それ以外 → 「明日の〇月〇日」
 */
function generatePreDaySmsBody(buyer: {
  name?: string | null;
  viewing_date?: string | null;
  viewing_time?: string | null;
}, propertyAddress: string, googleMapUrl: string): string {
  const name = buyer.name || 'お客様';
  const dateStr = buyer.viewing_date || '';
  const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
  let dateLabel = '';
  let dayWord = '明日';

  if (parts.length === 3) {
    const viewingDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const month = viewingDate.getMonth() + 1;
    const day = viewingDate.getDate();
    dateLabel = `${month}月${day}日`;
    if (viewingDate.getDay() === 4) dayWord = '明後日'; // 木曜
  }

  const rawTime = buyer.viewing_time || '';
  let timeStr = '';
  if (rawTime) {
    // 既に HH:MM 形式かチェック
    if (/^\d{1,2}:\d{2}$/.test(rawTime)) {
      timeStr = rawTime;
    } else {
      // Dateオブジェクト文字列などから時・分を抽出
      const dateObj = new Date(rawTime);
      if (!isNaN(dateObj.getTime())) {
        const hours = dateObj.getHours().toString().padStart(2, '0');
        const minutes = dateObj.getMinutes().toString().padStart(2, '0');
        timeStr = `${hours}:${minutes}`;
      }
    }
  }
  const mapLine = googleMapUrl ? `\n${googleMapUrl}` : '';

  return `【内覧のご連絡　☆返信不可☆】\n${name}様\nお世話になっております。㈱いふうです。\n${dayWord}の${dateLabel} ${timeStr}から${propertyAddress}の内覧をよろしくお願いいたします。${mapLine}\nこのメールは返信不可となっておりますので、何かございましたら下記連絡先へお願いいたします。\n【電話】(10時～18時）*水曜定休\n097-533-2022\n【メールアドレス】\ntenant@ifoo-oita.com\nそれではお会いできるのを楽しみにしております。\n㈱いふう`;
}

/**
 * 内覧日前日かどうかを判定（BuyerStatusCalculator Priority 3 と同じロジック）
 * - 木曜内覧 → 2日前（火曜）に表示
 * - それ以外 → 1日前に表示
 * - broker_inquiry === '業者問合せ' は除外
 * - notification_sender が入力済みは除外
 */
function isViewingPreDay(buyer: { viewing_date?: string | null; broker_inquiry?: string | null; notification_sender?: string | null }): boolean {
  if (!buyer.viewing_date) return false;
  if (buyer.broker_inquiry === '業者問合せ') return false;
  if (buyer.notification_sender && buyer.notification_sender.trim() !== '') return false;

  const dateStr = buyer.viewing_date;
  const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
  if (parts.length !== 3) return false;
  const viewingDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  viewingDate.setHours(0, 0, 0, 0);
  if (isNaN(viewingDate.getTime())) return false;

  // JST で今日の日付を取得
  const now = new Date();
  const jstOffset = 9 * 60 * 60000;
  const today = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + jstOffset);
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = viewingDate.getDay(); // 0=日, 4=木
  const daysBeforeTarget = dayOfWeek === 4 ? 2 : 1;
  const targetDate = new Date(viewingDate);
  targetDate.setDate(viewingDate.getDate() - daysBeforeTarget);
  targetDate.setHours(0, 0, 0, 0);

  return today.getTime() === targetDate.getTime();
}

interface Buyer {
  [key: string]: any;
}

// 内覧結果・後続対応用クイック入力ボタンの定義
const VIEWING_RESULT_QUICK_INPUTS = [
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

export default function BuyerViewingResultPage() {
  const { buyer_number } = useParams<{ buyer_number: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { employee } = useAuthStore();
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const buyerRef = useRef<Buyer | null>(null); // handleInlineFieldSave から buyer を参照するための ref
  const [linkedProperties, setLinkedProperties] = useState<any[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [staffInitials, setStaffInitials] = useState<Array<{ label: string; value: string }>>([]);
  const [copiedBuyerNumber, setCopiedBuyerNumber] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [viewingResultKey, setViewingResultKey] = useState(0);
  const [isQuickInputSaving, setIsQuickInputSaving] = useState(false);
  // 内覧結果・後続対応 RichTextEditor 用
  const viewingResultEditorRef = useRef<RichTextCommentEditorHandle>(null);
  const [viewingResultEditValue, setViewingResultEditValue] = useState<string>('');
  const [viewingResultSaving, setViewingResultSaving] = useState(false);
  // 気づきフィールド
  const insightExecutorEditorRef = useRef<RichTextCommentEditorHandle>(null);
  const insightCompanionEditorRef = useRef<RichTextCommentEditorHandle>(null);
  const [insightExecutorValue, setInsightExecutorValue] = useState<string>('');
  const [insightCompanionValue, setInsightCompanionValue] = useState<string>('');
  const [insightSaving, setInsightSaving] = useState(false);
  // 気づき必須警告ダイアログ
  const [insightRequiredDialog, setInsightRequiredDialog] = useState<{ open: boolean; targetUrl: string }>({ open: false, targetUrl: '' });
  // 全買主の気づき一覧
  const [allInsightBuyers, setAllInsightBuyers] = useState<any[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [isOfferFailedFlag, setIsOfferFailedFlag] = useState(false); // 買付外れましたフラグ
  const [offerFailedChatSentPopupOpen, setOfferFailedChatSentPopupOpen] = useState(false);
  const [campaignHandedOver, setCampaignHandedOver] = useState(false); // 10万円キャンペーンお渡し済みチェック
  const [normalInitials, setNormalInitials] = useState<string[]>([]);
  const [calendarOpened, setCalendarOpened] = useState(false); // カレンダーを開いたかどうか
  const [leaveWarningDialog, setLeaveWarningDialog] = useState<{ open: boolean; targetUrl: string }>({ open: false, targetUrl: '' });
  const [sellerViewingContactDialog, setSellerViewingContactDialog] = useState<{ open: boolean; targetUrl: string }>({ open: false, targetUrl: '' });
  const [calendarConfirmDialog, setCalendarConfirmDialog] = useState<{
    open: boolean;
    viewingDate: string;
    viewingTime: string;
    assignee: string;
    propertyAddress: string;
    googleMapUrl: string;
    title: string;
    description: string;
  }>({
    open: false,
    viewingDate: '',
    viewingTime: '',
    assignee: '',
    propertyAddress: '',
    googleMapUrl: '',
    title: '',
    description: '',
  });
  // 内覧ダブルブッキング警告ダイアログ
  const [doubleBookingWarning, setDoubleBookingWarning] = useState<{
    open: boolean;
    conflicts: Array<{ buyer_number: string; name: string; viewing_date: string; viewing_time: string | null; follow_up_assignee: string }>;
  }>({ open: false, conflicts: [] });
  // 物件の買主リスト
  const [propertyBuyers, setPropertyBuyers] = useState<any[]>([]);
  const [propertyBuyersLoading, setPropertyBuyersLoading] = useState(false);
  // ダブルブッキング警告からスクロールするための ref
  const buyerListSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (buyer_number) {
      fetchBuyer();
      fetchLinkedProperties();
      fetchStaffInitials();
      fetchEmployees();
      fetchAllInsightBuyers();
    }
  }, [buyer_number, location.key]);

  // デバッグ用: buyerステートの変更を監視
  useEffect(() => {
    if (buyer) {
      console.log('[BuyerViewingResultPage] Buyer state updated:', {
        viewing_date: buyer.viewing_date,
        viewing_time: buyer.viewing_time,
        follow_up_assignee: buyer.follow_up_assignee,
      });
    }
  }, [buyer]);

  // デバッグ用: linkedPropertiesステートの変更を監視
  useEffect(() => {
    console.log('[BuyerViewingResultPage] linkedProperties updated:', linkedProperties);
    console.log('[BuyerViewingResultPage] linkedProperties length:', linkedProperties?.length);
    
    if (linkedProperties && linkedProperties.length > 0) {
      linkedProperties.forEach((property: any, index: number) => {
        console.log(`[BuyerViewingResultPage] Property ${index} status:`, property.status);
      });
    }
  }, [linkedProperties]);

  useEffect(() => {
    api.get('/api/employees/normal-initials')
      .then(res => setNormalInitials(res.data.initials || []))
      .catch(err => console.error('Failed to fetch normal initials:', err));
  }, []);

  // カレンダー必須チェック: 内覧日・時間・後続担当あり かつ 内覧未確定空欄 かつ 通知送信者空欄 かつ 内覧日が今日より後
  const isFutureViewingDate = (() => {
    if (!buyer?.viewing_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const viewingDate = new Date(buyer.viewing_date);
    viewingDate.setHours(0, 0, 0, 0);
    return viewingDate > today;
  })();
  const needsCalendar = !!(
    isFutureViewingDate &&
    buyer?.viewing_time &&
    buyer?.follow_up_assignee &&
    !buyer?.viewing_unconfirmed &&
    !buyer?.notification_sender
  );

  // isCalendarEnabled 計算値
  // 内覧形態の参照フィールドは物件種別に依存する（要件3.5）
  // - 専任物件: viewing_mobile を参照
  // - 一般媒介物件: viewing_type_general を参照
  // - 他社物件（linkedProperties が空）: atbbStatus が '' になるため、
  //   3番目の分岐（viewing_mobile || viewing_type_general）が適用される。
  //   他社物件ケースでは viewing_mobile に値が保存されるため、正しく参照される（要件2.1, 2.2, 2.3）
  const atbbStatus = linkedProperties?.[0]?.atbb_status || '';
  const viewingTypeValue =
    atbbStatus.includes('専任')
      ? (buyer?.viewing_mobile || null)
      : atbbStatus.includes('一般')
      ? (buyer?.viewing_type_general || null)
      : (buyer?.viewing_mobile || buyer?.viewing_type_general || null);

  // 4条件がすべて非空の場合のみ true（要件3.1, 3.2, 3.5）
  const isCalendarEnabled = !!(
    buyer?.viewing_date &&
    buyer?.viewing_time &&
    buyer?.follow_up_assignee &&
    viewingTypeValue
  );

  // 必須強調表示の計算値（要件2.1〜2.7, 3.4）
  const hasViewingDate = !!(buyer?.viewing_date && buyer.viewing_date.trim() !== '');
  const isTimeRequired = hasViewingDate && !(buyer?.viewing_time && buyer.viewing_time.trim() !== '');
  // isViewingTypeRequired: 内覧日あり かつ 内覧形態未選択の場合に true
  // 他社物件ケース（linkedProperties が空）でも viewingTypeValue が viewing_mobile を参照するため、
  // viewing_mobile が空のとき true になる → 他社物件ケースも既存ロジックでカバー済み（要件3.4）
  const isViewingTypeRequired = hasViewingDate && !viewingTypeValue;
  const isFollowUpRequired = hasViewingDate && !(buyer?.follow_up_assignee && buyer.follow_up_assignee.trim() !== '');

  // 気づき（内覧実行者）必須チェック:
  // 内覧日が2026-04-28以降 かつ ヒアリング項目（viewing_result_follow_up）に値がある場合に必須
  const INSIGHT_REQUIRED_FROM = new Date('2026-04-28');
  INSIGHT_REQUIRED_FROM.setHours(0, 0, 0, 0);
  const isInsightExecutorRequired = (() => {
    if (!buyer?.viewing_date) return false;
    const viewingDate = new Date(buyer.viewing_date);
    viewingDate.setHours(0, 0, 0, 0);
    if (viewingDate < INSIGHT_REQUIRED_FROM) return false;
    const hasHearing = !!(buyer?.viewing_result_follow_up && buyer.viewing_result_follow_up.trim() !== '');
    return hasHearing;
  })();
  // 売主内覧日連絡 必須チェック（2026-04-29以降の内覧日で未入力の場合、遷移をブロック）
  const isSellerViewingContactBlocked = (() => {
    if (!buyer?.viewing_date) return false;
    // 文字列比較でタイムゾーン問題を回避
    const vdStr = buyer.viewing_date.substring(0, 10);
    if (vdStr < '2026-04-29') return false;
    // seller_viewing_date_contact が未入力（空）の場合のみブロック
    return !buyer.seller_viewing_date_contact;
  })();

  // 離脱ガード: カレンダー未開封の場合に警告
  const guardedNavigate = (url: string) => {
    if (needsCalendar && !calendarOpened) {
      setLeaveWarningDialog({ open: true, targetUrl: url });
    } else if (isInsightExecutorRequired && !insightExecutorValue.replace(/<[^>]*>/g, '').trim()) {
      setInsightRequiredDialog({ open: true, targetUrl: url });
    } else if (isSellerViewingContactBlocked) {
      setSellerViewingContactDialog({ open: true, targetUrl: url });
    } else {
      navigate(url);
    }
  };

  const fetchBuyer = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/buyers/${buyer_number}`);
      buyerRef.current = res.data;
      setBuyer(res.data);
      // 内覧結果・後続対応の初期値をセット（空の場合はデフォルトテンプレート）
      const VIEWING_RESULT_DEFAULT_TEMPLATE = 
        '<p>・お客の属性：</p>' +
        '<p>・内覧理由：</p>' +
        '<p>・物件の気に入っている点：</p>' +
        '<p>・懸念事項：</p>' +
        '<p>・予算：</p>' +
        '<p>・時期：</p>';
      setViewingResultEditValue(res.data.viewing_result_follow_up || VIEWING_RESULT_DEFAULT_TEMPLATE);
      // 気づきフィールドの初期値をセット
      setInsightExecutorValue(res.data.viewing_insight_executor || '');
      setInsightCompanionValue(res.data.viewing_insight_companion || '');
      // property_numberがあれば買主リストを取得（linkedPropertiesが空の場合のフォールバック）
      if (res.data.property_number) {
        fetchPropertyBuyers(res.data.property_number);
      }
    } catch (error) {
      console.error('Failed to fetch buyer:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedProperties = async () => {
    try {
      const res = await api.get(`/api/buyers/${buyer_number}/properties`);
      const properties = res.data || [];
      setLinkedProperties(properties);
      // 紐づいた物件を全て選択済みとして初期化
      const ids = new Set<string>(
        properties
          .map((p: any) => p.id || p.property_listing_id)
          .filter(Boolean)
      );
      setSelectedPropertyIds(ids);
      // 最初の物件番号で買主リストを取得
      if (properties.length > 0 && properties[0].property_number) {
        fetchPropertyBuyers(properties[0].property_number);
      } else if (buyerRef.current?.property_number) {
        // linkedPropertiesが空でもbuyerのproperty_numberで取得
        fetchPropertyBuyers(buyerRef.current.property_number);
      }
    } catch (error) {
      console.error('Failed to fetch linked properties:', error);
    }
  };

  const fetchPropertyBuyers = async (propertyNumber: string) => {
    setPropertyBuyersLoading(true);
    try {
      const res = await api.get(`/api/property-listings/${propertyNumber}/buyers`);
      setPropertyBuyers(res.data || []);
    } catch (error) {
      console.error('Failed to fetch property buyers:', error);
    } finally {
      setPropertyBuyersLoading(false);
    }
  };

  const fetchAllInsightBuyers = async () => {
    try {
      const res = await api.get('/api/buyers/insights');
      setAllInsightBuyers(res.data || []);
    } catch (error) {
      console.error('Failed to fetch insight buyers:', error);
    }
  };

  const fetchStaffInitials = async () => {
    try {
      const res = await api.get('/api/employees/active-initials');
      const initials = res.data.initials || [];
      setStaffInitials(initials.map((initial: string) => ({ label: initial, value: initial })));
    } catch (error) {
      console.error('Failed to fetch staff initials:', error);
      // エラー時は空配列を設定
      setStaffInitials([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const employeesData = await employeeApi.getAll();
      setEmployees(employeesData);
    } catch (err) {
      console.error('Failed to load employees:', err);
      // エラーが発生しても空配列を設定（カレンダー送信は可能にする）
      setEmployees([]);
    }
  };

  // 内覧ダブルブッキングチェック
  // 同じ物件・同じ日（日本時間）・異なる後続担当の内覧があれば警告ダイアログを表示
  const checkDoubleBooking = async (
    viewingDate: string,
    followUpAssignee: string,
    propertyNumber: string
  ) => {
    if (!viewingDate || !propertyNumber) return;
    try {
      const params = new URLSearchParams({
        propertyNumber,
        viewingDate,
        currentBuyerNumber: buyer_number || '',
        followUpAssignee: followUpAssignee || '',
      });
      const res = await api.get(`/api/buyers/viewing-double-booking-check?${params.toString()}`);
      const { conflicts } = res.data;
      if (conflicts && conflicts.length > 0) {
        setDoubleBookingWarning({ open: true, conflicts });
      }
    } catch (e) {
      // チェック失敗は非致命的なので無視
      console.warn('[checkDoubleBooking] failed:', e);
    }
  };

  const handleInlineFieldSave = useCallback(async (fieldName: string, newValue: any): Promise<void> => {
    if (!buyerRef.current) return;

    // Optimistic UI: APIを待たずに即座にUIを更新する
    const previousBuyer = buyerRef.current;
    const optimisticBuyer = { ...buyerRef.current, [fieldName]: newValue };
    buyerRef.current = optimisticBuyer;
    setBuyer(optimisticBuyer);

    try {
      console.log(`[BuyerViewingResultPage] Saving field: ${fieldName}, value:`, newValue);
      
      // 内覧関連フィールドとlatest_statusはsync: trueでスプレッドシートに即時同期する
      const SYNC_FIELDS = [
        'latest_status',
        'viewing_date',
        'viewing_time',
        'follow_up_assignee',
        'viewing_unconfirmed',
        'viewing_result_follow_up',
        'pre_viewing_notes',
        'viewing_notes',
        'pre_viewing_hearing',
        'seller_viewing_contact',
        'buyer_viewing_contact',
        // seller_viewing_date_contact はスプシ同期不要（同期失敗でロールバックされるため除外）
        'seller_cancel_contact',
        'notification_sender',
        'inquiry_hearing',
        'post_viewing_seller_contact',
        'viewing_mobile',
        'viewing_type_general',
        'offer_comment',
        'build_year',
        'renovation_history',
        'other_valuation_done',
        'owner_name',
        'loan_balance',
        'visit_desk',
        'seller_list_copy',
        'viewing_insight_executor',
        'viewing_insight_companion',
      ];
      const shouldSync = SYNC_FIELDS.includes(fieldName);
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: shouldSync, force: shouldSync }
      );
      
      console.log(`[BuyerViewingResultPage] Save result for ${fieldName}:`, result.buyer[fieldName]);
      
      // API成功後はサーバーの値で確定する
      buyerRef.current = result.buyer;
      setBuyer(result.buyer);

      // サイドバーカテゴリーに影響するフィールドが更新された場合はキャッシュを無効化
      const SIDEBAR_AFFECTING_FIELDS = [
        'seller_viewing_date_contact',
        'next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender',
        'inquiry_email_phone', 'pinrich', 'latest_status', 'broker_inquiry',
        'vendor_survey', 'viewing_type_general', 'post_viewing_seller_contact',
        'viewing_unconfirmed',
      ];
      if (SIDEBAR_AFFECTING_FIELDS.includes(fieldName)) {
        pageDataCache.invalidate(CACHE_KEYS.BUYERS_WITH_STATUS);
      }
    } catch (error: any) {
      // API失敗時は元の値に戻す（ロールバック）
      console.error('Failed to update field:', error);
      buyerRef.current = previousBuyer;
      setBuyer(previousBuyer);
      throw new Error(error.response?.data?.error || '更新に失敗しました');
    }
  }, [buyer_number]);

  // JSX内でuseCallbackを使えないため、各フィールド用コールバックをトップレベルで定義
  const handleSaveLatestViewingDate = useCallback(
    async (newValue: any) => {
      console.log('[BuyerViewingResultPage] InlineEditableField onSave called with:', newValue);
      await handleInlineFieldSave('viewing_date', newValue);
      // 内覧日が設定された場合、ダブルブッキングチェック
      if (newValue && buyerRef.current) {
        const propertyNumber = linkedProperties?.[0]?.property_number || '';
        const followUpAssignee = buyerRef.current.follow_up_assignee || '';
        await checkDoubleBooking(newValue, followUpAssignee, propertyNumber);
      }
    },
    [handleInlineFieldSave, linkedProperties]
  );

  const handleSaveViewingTime = useCallback(
    (newValue: any) => handleInlineFieldSave('viewing_time', newValue),
    [handleInlineFieldSave]
  );

  const handleSaveViewingResultFollowUp = useCallback(
    (newValue: any) => handleInlineFieldSave('viewing_result_follow_up', newValue),
    [handleInlineFieldSave]
  );

  const handleSaveLatestStatus = useCallback(
    (newValue: any) => handleInlineFieldSave('latest_status', newValue),
    [handleInlineFieldSave]
  );

  const handleSaveOfferComment = useCallback(
    (newValue: any) => handleInlineFieldSave('offer_comment', newValue),
    [handleInlineFieldSave]
  );

  // 内覧結果・後続対応の保存ハンドラー（スプシ同期あり）
  const handleSaveViewingResult = async () => {
    if (!buyer) return;
    setViewingResultSaving(true);
    try {
      const result = await buyerApi.update(
        buyer_number!,
        { viewing_result_follow_up: viewingResultEditValue },
        { sync: true, force: true }  // スプレッドシートへ即同期・競合チェックスキップ
      );
      buyerRef.current = result.buyer;
      setBuyer(result.buyer);
      setViewingResultEditValue(result.buyer.viewing_result_follow_up || '');
      const syncMsg = result.syncStatus === 'synced' ? '（スプシ同期済み）' : result.syncStatus === 'pending' ? '（スプシ同期保留中）' : '';
      setSnackbar({ open: true, message: `内覧結果・後続対応を保存しました${syncMsg}`, severity: result.syncStatus === 'synced' ? 'success' : 'warning' });
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.error || '保存に失敗しました', severity: 'error' });
    } finally {
      setViewingResultSaving(false);
    }
  };

  const handleViewingResultQuickInput = (text: string) => {
    // RichTextEditorのカーソル位置に太字で挿入
    viewingResultEditorRef.current?.insertAtCursor(`<b>${text}</b>`);
  };

  // 気づきフィールドの保存ハンドラー
  const handleSaveInsights = async () => {
    if (!buyer) return;
    setInsightSaving(true);
    try {
      const result = await buyerApi.update(
        buyer_number!,
        {
          viewing_insight_executor: insightExecutorValue,
          viewing_insight_companion: insightCompanionValue,
        },
        { sync: true, force: true }
      );
      buyerRef.current = result.buyer;
      setBuyer(result.buyer);
      setInsightExecutorValue(result.buyer.viewing_insight_executor || '');
      setInsightCompanionValue(result.buyer.viewing_insight_companion || '');
      setSnackbar({ open: true, message: '気づきを保存しました', severity: 'success' });
      // 保存後に一覧テーブルを最新化（キャッシュクリア→再取得）
      const propertyNumber = linkedProperties?.[0]?.property_number;
      if (propertyNumber) {
        try {
          await api.delete(`/api/property-listings/${propertyNumber}/buyers/cache`);
        } catch (_) { /* キャッシュクリア失敗は無視 */ }
        fetchPropertyBuyers(propertyNumber);
      }
      fetchAllInsightBuyers();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.error || '保存に失敗しました', severity: 'error' });
    } finally {
      setInsightSaving(false);
    }
  };

  const handleCalendarButtonClick = async () => {
    if (!buyer) return;

    // 物件情報を取得
    const property = linkedProperties && linkedProperties.length > 0 ? linkedProperties[0] : null;

    // 内覧日時を組み立て
    const rawDate = buyer.viewing_date || '';
    const rawTime = buyer.viewing_time || '14:00';
    const numParts = rawDate.match(/\d+/g);

    let startDateStr = '';
    let endDateStr = '';

    if (numParts && numParts.length >= 3) {
      const year = numParts[0].padStart(4, '0');
      const month = numParts[1].padStart(2, '0');
      const day = numParts[2].padStart(2, '0');

      let hours = 14, minutes = 0;
      if (rawTime.includes(':')) {
        [hours, minutes] = rawTime.split(':').map(Number);
      }

      const pad = (n: number) => String(n).padStart(2, '0');
      startDateStr = `${year}${month}${day}T${pad(hours)}${pad(minutes)}00`;
      const endHours = hours + 1;
      endDateStr = `${year}${month}${day}T${pad(endHours)}${pad(minutes)}00`;
    }

    // タイトルと説明を生成
    // 他社物件ケース（linkedProperties が空）では property が null になるが、
    // buyer.viewing_mobile は正しく渡される。
    // generateCalendarTitle 内で viewingType || viewingTypeGeneral || '' として処理されるため変更不要（要件2.4）
    // 種別に"マ"が含まれる場合は住居表示（display_address）を優先する
    const propertyType = property?.property_type || '';
    const isMansion = propertyType.includes('マ');
    const calendarAddress = isMansion
      ? (property?.display_address || property?.address)
      : property?.address;
    const baseTitle = generateCalendarTitle(
      buyer.viewing_mobile,
      buyer.viewing_type_general,
      calendarAddress,
      buyer.name,
      buyer.other_company_property
    );
    const title = applyAgencyInquiryTitle(baseTitle, buyer.broker_inquiry, buyer.name);
    const description = generateCalendarDescription(
      calendarAddress,
      property?.google_map_url,
      buyer.name,
      buyer.buyer_number,
      buyer.phone_number,
      buyer.inquiry_hearing
    );

    // 後続担当のメールアドレスを取得（CallModePageと同じ仕組み）
    const followUpAssignee = buyer.follow_up_assignee;
    console.log('=== カレンダー後続担当デバッグ ===');
    console.log('follow_up_assignee:', followUpAssignee);
    console.log('employees配列:', employees);
    
    const TENANT_EMAIL = 'tenant@ifoo-oita.com';
    let assignedEmail = '';
    if (followUpAssignee) {
      // 「業者」の場合はテナントメールアドレスを使用
      if (followUpAssignee === '業者') {
        assignedEmail = TENANT_EMAIL;
      } else {
        // イニシャルまたは名前で従業員マスタを検索
        const matchedEmployees = employees.filter(e => {
          const initialsMatch = e.initials === followUpAssignee;
          const nameMatch = e.name === followUpAssignee;
          console.log(`従業員チェック: ${e.name} (initials: ${e.initials}, email: ${e.email})`);
          console.log(`  - initialsMatch: ${initialsMatch}, nameMatch: ${nameMatch}`);
          return initialsMatch || nameMatch;
        });
        
        console.log('マッチした社員数:', matchedEmployees.length);
        console.log('マッチした社員:', matchedEmployees);
        
        if (matchedEmployees.length > 1) {
          // 重複イニシャルの場合、エラーメッセージを表示
          const names = matchedEmployees.map(e => e.name).join(', ');
          setSnackbar({
            open: true,
            message: `後続担当（${followUpAssignee}）が複数の社員に一致します: ${names}`,
            severity: 'error',
          });
          return;
        }
        
        const assignedEmployee = matchedEmployees[0];
        console.log('見つかった社員:', assignedEmployee?.name);
        console.log('メールアドレス:', assignedEmployee?.email);
        
        if (assignedEmployee?.email) {
          assignedEmail = assignedEmployee.email;
        } else {
          // 後続担当が従業員マスタに存在しない場合、エラーメッセージを表示
          setSnackbar({
            open: true,
            message: `後続担当（${followUpAssignee}）が従業員マスタに見つかりません`,
            severity: 'error',
          });
          return;
        }
      }
    }

    // バックエンドAPIを呼び出してカレンダー登録とメール送信を実行
    try {
      const viewingDate = new Date(startDateStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
      const endDate = new Date(endDateStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));

      // ===== カレンダーを先に開く（await より前に呼ぶことでポップアップブロックを回避）=====
      {
        const startStr = viewingDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const endStr = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const addr = calendarAddress || buyer.other_company_property || '';
        const calDetails =
          `買主番号: ${buyer.buyer_number}\n` +
          `お客様名: ${buyer.name || ''}\n` +
          `電話: ${buyer.phone_number || ''}\n` +
          `問合時ヒアリング: ${buyer.inquiry_hearing || ''}\n` +
          `\n買主詳細ページ:\n${window.location.origin}/buyers/${buyer.buyer_number}`;

        const calParams = new URLSearchParams({
          action: 'TEMPLATE',
          text: title,
          dates: `${startStr}/${endStr}`,
          details: calDetails,
          location: addr,
        });
        if (assignedEmail) calParams.append('add', assignedEmail);
        const srcParam = assignedEmail ? `&src=${encodeURIComponent(assignedEmail)}` : '';
        window.open(`https://calendar.google.com/calendar/render?${calParams.toString()}${srcParam}`, '_blank');
      }
      // ===== カレンダーここまで =====

      console.log('[BuyerViewingResultPage] Calling /api/buyer-appointments');
      
      const response = await api.post('/api/buyer-appointments', {
        buyerNumber: buyer.buyer_number,
        startTime: viewingDate.toISOString(),
        endTime: endDate.toISOString(),
        assignedTo: buyer.follow_up_assignee,
        followUpAssignee: buyer.follow_up_assignee,
        buyerName: buyer.name,
        buyerPhone: buyer.phone_number,
        buyerEmail: buyer.email,
        viewingMobile: buyer.viewing_mobile || '',
        viewingTypeGeneral: buyer.viewing_type_general || '',
        viewingDate: buyer.viewing_date || '',
        viewingTime: buyer.viewing_time || '',
        propertyAddress: calendarAddress || '',
        propertyNumber: property?.property_number || '',
        propertyGoogleMapUrl: property?.google_map_url || '',
        inquiryHearing: buyer.inquiry_hearing || '',
        creatorName: buyer.name,
        customTitle: title,
        customDescription: description,
      });

      console.log('[BuyerViewingResultPage] Calendar event created:', response.data);

      // バックエンドAPIでイベント作成済みのため、成功メッセージを表示
      setSnackbar({
        open: true,
        message: `後続担当（${buyer.follow_up_assignee}）のGoogleカレンダーに内覧予約を登録しました`,
        severity: 'success',
      });
      setCalendarOpened(true);
    } catch (error: any) {
      console.error('[BuyerViewingResultPage] Calendar event creation error:', error);
      const errorMessage = error.response?.data?.error?.message || 'カレンダー登録に失敗しました';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
      return; // エラーの場合はGoogleカレンダーを開かない
    }

  };

  const handleCalendarConfirm = async () => {
    if (!buyer) return;
    setCalendarConfirmDialog(prev => ({ ...prev, open: false }));

    try {
      const rawViewingDate = buyer.viewing_date || '';
      const numParts = rawViewingDate.match(/\d+/g);
      if (!numParts || numParts.length < 3) {
        setSnackbar({ open: true, message: `内覧日の形式が不正です（値: "${rawViewingDate}"）`, severity: 'error' });
        return;
      }
      const year = numParts[0].padStart(4, '0');
      const month = numParts[1].padStart(2, '0');
      const day = numParts[2].padStart(2, '0');
      const viewingDate = new Date(`${year}-${month}-${day}T00:00:00`);
      if (isNaN(viewingDate.getTime())) {
        setSnackbar({ open: true, message: `内覧日のパースに失敗しました（値: "${rawViewingDate}"）`, severity: 'error' });
        return;
      }
      const rawViewingTime = buyer.viewing_time || '14:00';
      let hours: number, minutes: number;
      if (rawViewingTime.includes(':')) {
        [hours, minutes] = rawViewingTime.split(':').map(Number);
      } else if (/^\d{3,4}$/.test(rawViewingTime.trim())) {
        const t = rawViewingTime.trim().padStart(4, '0');
        hours = parseInt(t.substring(0, 2), 10);
        minutes = parseInt(t.substring(2, 4), 10);
      } else {
        hours = 14;
        minutes = 0;
      }
      viewingDate.setHours(hours, minutes, 0, 0);
      const endDate = new Date(viewingDate);
      endDate.setHours(viewingDate.getHours() + 1);

      const property = linkedProperties && linkedProperties.length > 0 ? linkedProperties[0] : null;
      // 種別に"マ"が含まれる場合は住居表示（display_address）を優先する
      const propType = property?.property_type || '';
      const isMansionType = propType.includes('マ');
      const propAddress = isMansionType
        ? (property?.display_address || property?.address || '')
        : (property?.address || '');

      const response = await api.post('/api/buyer-appointments', {
        buyerNumber: buyer.buyer_number,
        startTime: viewingDate.toISOString(),
        endTime: endDate.toISOString(),
        assignedTo: buyer.follow_up_assignee,
        followUpAssignee: buyer.follow_up_assignee,
        buyerName: buyer.name,
        buyerPhone: buyer.phone_number,
        buyerEmail: buyer.email,
        viewingMobile: buyer.viewing_mobile || '',
        viewingTypeGeneral: buyer.viewing_type_general || '',
        viewingDate: buyer.viewing_date || '',
        viewingTime: buyer.viewing_time || '',
        propertyAddress: propAddress,
        propertyNumber: property?.property_number || '',
        propertyGoogleMapUrl: property?.google_map_url || '',
        inquiryHearing: buyer.inquiry_hearing || '',
        creatorName: buyer.name,
        customTitle: calendarConfirmDialog.title,
        customDescription: calendarConfirmDialog.description,
      });

      console.log('[BuyerViewingResultPage] Calendar event created:', response.data);

      setSnackbar({
        open: true,
        message: `後続担当（${buyer.follow_up_assignee}）のGoogleカレンダーに内覧予約を登録しました`,
        severity: 'success',
      });

      // 登録成功後にGoogleカレンダーを開く
      window.open('https://calendar.google.com/calendar/r', '_blank');
    } catch (error: any) {
      console.error('[BuyerViewingResultPage] Calendar event creation error:', error);
      const errorMessage = error.response?.data?.error?.message || 'カレンダー登録に失敗しました';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  const handleOfferFailedChatSentPopupOk = () => {
    setOfferFailedChatSentPopupOpen(false);
    navigate(`/buyers/${buyer_number}`);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // 買付情報セクションの表示条件を判定
  const shouldShowOfferSection = (): boolean => {
    if (!buyer?.latest_status) return isOfferFailedFlag; // 買付外れフラグがある場合は表示
    
    const status = buyer.latest_status.trim();
    
    // 「買」を含む場合、または買付外れフラグがある場合は表示
    return status.includes('買') || isOfferFailedFlag;
  };

  // 買付外れましたかどうかを判定
  const isOfferFailed = (): boolean => {
    return isOfferFailedFlag;
  };

  // ★最新状況の選択肢を物件のatbb_statusに応じてフィルタリング
  const getFilteredLatestStatusOptions = (): typeof LATEST_STATUS_OPTIONS => {
    // 空欄選択肢を先頭に追加
    const emptyOption = { value: '', label: '（空欄）' };
    
    // 紐づいた物件がない場合は全ての選択肢を表示
    if (!linkedProperties || linkedProperties.length === 0) {
      return [emptyOption, ...LATEST_STATUS_OPTIONS];
    }

    // 紐づいた物件のatbb_statusを取得
    const atbbStatus = linkedProperties[0]?.atbb_status || '';

    // 専任媒介の場合
    if (atbbStatus.includes('専任')) {
      const filtered = LATEST_STATUS_OPTIONS.filter(option => {
        // 「買（専任 両手）」「買（専任 片手）」のみ表示
        // その他の「買（）」は非表示
        if (option.value.startsWith('買（')) {
          return option.value === '買（専任 両手）' || option.value === '買（専任 片手）';
        }
        // 「買（」で始まらない選択肢はそのまま表示
        return true;
      });
      return [emptyOption, ...filtered];
    }

    // 一般媒介の場合
    if (atbbStatus.includes('一般')) {
      const filtered = LATEST_STATUS_OPTIONS.filter(option => {
        // 「買（一般 両手）」「買（一般 片手）」のみ表示
        // その他の「買（）」は非表示
        if (option.value.startsWith('買（')) {
          return option.value === '買（一般 両手）' || option.value === '買（一般 片手）';
        }
        // 「買（」で始まらない選択肢はそのまま表示
        return true;
      });
      return [emptyOption, ...filtered];
    }

    // 専任も一般も含まれない場合は全ての選択肢を表示
    return [emptyOption, ...LATEST_STATUS_OPTIONS];
  };

  // 買付チャット送信ハンドラー
  const handleOfferChatSend = async () => {
    if (!buyer || !linkedProperties || linkedProperties.length === 0) {
      setSnackbar({
        open: true,
        message: '買主または物件情報が不足しています',
        severity: 'error',
      });
      return;
    }

    try {
      // バックエンドAPIを呼び出し
      const response = await api.post(`/api/buyers/${buyer.buyer_number}/send-offer-chat`, {
        propertyNumber: linkedProperties[0].property_number,
        offerComment: buyer.offer_comment || '',
        campaignHandedOver: campaignHandedOver,
      });

      if (response.data.success) {
        if (isOfferFailed()) {
          setOfferFailedChatSentPopupOpen(true);
        } else {
          setSnackbar({
            open: true,
            message: 'Google Chatに送信しました',
            severity: 'success',
          });
        }
      } else {
        throw new Error(response.data.error || 'チャット送信に失敗しました');
      }
    } catch (error: any) {
      console.error('Failed to send chat message:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || error.message || 'チャット送信に失敗しました',
        severity: 'error',
      });
    }
  };

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
        <Button startIcon={<ArrowBackIcon />} onClick={() => guardedNavigate(`/buyers/${buyer_number}`)}>
          買主詳細に戻る
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3, px: 2 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton 
          onClick={() => guardedNavigate(`/buyers/${buyer_number}`)} 
          sx={{ mr: 2 }}
          aria-label="買主詳細に戻る"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold">
          内覧結果・後続対応
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          {buyer.name || buyer.buyer_number}
        </Typography>
        {/* 買主番号（クリックでコピー） */}
        {buyer.buyer_number && (
          <>
            <Chip 
              label={buyer.buyer_number} 
              size="small" 
              color="primary"
              onClick={() => {
                navigator.clipboard.writeText(buyer.buyer_number || '');
                setCopiedBuyerNumber(true);
                setTimeout(() => setCopiedBuyerNumber(false), 1500);
              }}
              sx={{ ml: 2, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
              title="クリックでコピー"
            />
            {copiedBuyerNumber && (
              <Typography variant="body2" sx={{ ml: 1, color: 'success.main', fontWeight: 'bold' }}>✓</Typography>
            )}
          </>
        )}
        {/* 物件所在地（紐づき物件が存在しaddressが非空の場合のみ表示） */}
        {linkedProperties.length > 0 && (linkedProperties[0].property_address || linkedProperties[0].address) && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ ml: 1 }}
          >
            {linkedProperties[0].property_address || linkedProperties[0].address}
          </Typography>
        )}
        {/* 内覧前日ボタン群（内覧日前日の場合のみ表示） */}
        {isViewingPreDay(buyer) && (
          <Box sx={{ ml: 'auto', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* メアドがある場合はEメールボタン */}
              {buyer.email && (
                <PreDayEmailButton
                  buyerId={buyer_number || ''}
                  buyerEmail={buyer.email || ''}
                  buyerName={buyer.name || ''}
                  buyerCompanyName={buyer.company_name || ''}
                  buyerNumber={buyer_number || ''}
                  preViewingNotes={buyer.pre_viewing_notes || ''}
                  viewingDate={buyer.viewing_date || ''}
                  viewingTime={buyer.viewing_time || ''}
                  inquiryHistory={[]}
                  selectedPropertyIds={selectedPropertyIds}
                  propertyNumbers={linkedProperties.map((p: any) => p.property_number).filter(Boolean)}
                  size="medium"
                  onEmailSent={async () => {
                    // メール送信後、ログイン中のスタッフのイニシャルを通知送信者に自動設定
                    // /api/employees/initials-by-emailでイニシャルを取得（スプシから確実に取得）
                    let senderInitial = '';
                    try {
                      const res = await api.get('/api/employees/initials-by-email');
                      senderInitial = res.data?.initials || '';
                    } catch { /* ignore */ }
                    // フォールバック: employee.initialsを使用（正しいフィールド名）
                    if (!senderInitial) senderInitial = employee?.initials || '';
                    if (senderInitial) {
                      await handleInlineFieldSave('notification_sender', senderInitial);
                    }
                  }}
                />
              )}
              {/* 電話番号がある場合はSMSボタン */}
              {buyer.phone_number && (() => {
                const property = linkedProperties.length > 0 ? linkedProperties[0] : null;
                // 種別に"マ"が含まれる場合は住居表示（display_address）を優先する
                const pType = property?.property_type || '';
                const isMansionSms = pType.includes('マ');
                const address = isMansionSms
                  ? (property?.display_address || property?.address || property?.property_address || buyer.other_company_property || '')
                  : (property?.address || property?.display_address || property?.property_address || buyer.other_company_property || '');
                const googleMapUrl = property?.google_map_url || '';
                const smsBody = generatePreDaySmsBody(buyer, address, googleMapUrl);
                const smsLink = `sms:${buyer.phone_number}?body=${encodeURIComponent(smsBody)}`;
                return (
                  <Button
                    variant="contained"
                    size="medium"
                    startIcon={<SmsIcon />}
                    onClick={() => {
                      api.post(`/api/buyers/${buyer_number}/sms-history`, {
                        templateId: 'pre_day_viewing',
                        templateName: '内覧前日SMS',
                        phoneNumber: buyer.phone_number,
                        senderName: '',
                      }).catch(() => {});
                      window.open(smsLink, '_self');
                    }}
                    sx={{
                      backgroundColor: '#546e7a',
                      color: '#fff',
                      fontWeight: 'bold',
                      '&:hover': { backgroundColor: '#37474f' },
                      animation: 'smsPulse 1.5s ease-in-out infinite',
                      '@keyframes smsPulse': {
                        '0%': { boxShadow: '0 0 0 0 rgba(84, 110, 122, 0.6)' },
                        '70%': { boxShadow: '0 0 0 10px rgba(84, 110, 122, 0)' },
                        '100%': { boxShadow: '0 0 0 0 rgba(84, 110, 122, 0)' },
                      },
                    }}
                  >
                    内覧前日SMS
                  </Button>
                );
              })()}
              {/* 内覧日前日一覧ボタン */}
              <Button
                variant="outlined"
                color="success"
                size="medium"
                onClick={() => guardedNavigate('/buyers?status=内覧日前日')}
              >
                内覧日前日一覧
              </Button>
            </Box>
          </Box>
        )}
        {/* 通知送信者ボタン群（内覧前日かどうかに関わらず常に表示） */}
        {(isViewingPreDay(buyer) || buyer.notification_sender) && (
          <Box sx={{ ml: isViewingPreDay(buyer) ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              通知送信者:
            </Typography>
            {normalInitials.map((initial) => {
              const isSelected = buyer.notification_sender === initial;
              return (
                <Button
                  key={initial}
                  size="small"
                  variant={isSelected ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={async () => {
                    const newValue = isSelected ? '' : initial;
                    await handleInlineFieldSave('notification_sender', newValue);
                  }}
                  sx={{ minWidth: 36, px: 1, py: 0.3, fontSize: '0.75rem', fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                >
                  {initial}
                </Button>
              );
            })}
            {/* 現在の値がリストにない場合も表示 */}
            {buyer.notification_sender && !normalInitials.includes(buyer.notification_sender) && (
              <Button
                size="small"
                variant="contained"
                color="primary"
                sx={{ minWidth: 36, px: 1, py: 0.3, fontSize: '0.75rem', fontWeight: 'bold', borderRadius: 1 }}
              >
                {buyer.notification_sender}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* 内覧結果・後続対応セクション */}
      <Paper 
        sx={{ 
          p: 3,
          bgcolor: 'rgba(33, 150, 243, 0.08)',
          border: '1px solid',
          borderColor: 'rgba(33, 150, 243, 0.3)',
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          内覧結果・後続対応
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 内覧情報（1列表示） */}
          <Box sx={{ display: 'flex', gap: 1, mb: 0, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* 内覧日 */}
            <Box sx={{ width: '280px', flexShrink: 0 }}>
              <InlineEditableField
                label="内覧日（最新）"
                value={buyer.viewing_date || ''}
                onSave={handleSaveLatestViewingDate}
                fieldType="date"
              />
              {/* クリアボタン（常に表示） */}
              <Button
                size="small"
                variant="outlined"
                color="error"
                fullWidth
                sx={{ mt: 0.5, fontSize: '0.7rem', padding: '2px 4px' }}
                onClick={async () => {
                  // キャンセルメール送信（内覧日クリア前に情報を取得）
                  try {
                    const property = linkedProperties && linkedProperties.length > 0 ? linkedProperties[0] : null;
                    await api.post('/api/buyer-appointments/cancel-notification', {
                      buyerNumber: buyer.buyer_number,
                      propertyNumber: property?.property_number || '',
                      previousViewingDate: buyer.viewing_date || '',
                      viewingMobile: buyer.viewing_mobile || '',
                      viewingTypeGeneral: buyer.viewing_type_general || '',
                      followUpAssignee: buyer.follow_up_assignee || '',
                      inquiryHearing: buyer.inquiry_hearing || '',
                    });
                    console.log('[BuyerViewingResultPage] Cancel notification sent');
                  } catch (cancelError: any) {
                    console.warn('[BuyerViewingResultPage] Cancel notification failed (non-fatal):', cancelError.message);
                  }
                  await handleInlineFieldSave('viewing_date', null);
                  await handleInlineFieldSave('viewing_time', null);
                }}
              >
                🗑️ 内覧日をクリア
              </Button>
              {/* カレンダーリンクボタン */}
              {buyer.viewing_date && (
                  <Button
                    size="small"
                    variant={isCalendarEnabled ? 'contained' : 'outlined'}
                    color={isCalendarEnabled ? 'error' : 'primary'}
                    fullWidth
                    disabled={!isCalendarEnabled}
                    sx={{
                      mt: 0.5,
                      fontSize: isCalendarEnabled ? '0.75rem' : '0.7rem',
                      padding: isCalendarEnabled ? '4px 8px' : '2px 4px',
                      fontWeight: isCalendarEnabled ? 'bold' : 'normal',
                      ...(isCalendarEnabled
                        ? {
                            animation: 'calendarPulse 1.5s ease-in-out infinite',
                            '@keyframes calendarPulse': {
                              '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.5)' },
                              '70%': { boxShadow: '0 0 0 6px rgba(211, 47, 47, 0)' },
                              '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' },
                            },
                          }
                        : {
                            color: '#9e9e9e',
                            borderColor: '#e0e0e0',
                            backgroundColor: '#f5f5f5',
                          }),
                    }}
                    onClick={handleCalendarButtonClick}
                  >
                    📅 カレンダーで開く
                  </Button>
              )}
            </Box>

            {/* 時間 */}
            <Box sx={{ width: '200px', flexShrink: 0 }}>
              <Box
                sx={{
                  p: isTimeRequired ? 1 : 0,
                  border: isTimeRequired ? '2px solid' : 'none',
                  borderColor: isTimeRequired ? 'error.main' : 'transparent',
                  borderRadius: 2,
                  bgcolor: isTimeRequired ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                  boxShadow: isTimeRequired ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {isTimeRequired && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold', fontSize: '0.7rem' }}>
                    *必須
                  </Typography>
                )}
                <InlineEditableField
                  label={isTimeRequired ? '時間 *必須' : '時間'}
                  value={buyer.viewing_time || ''}
                  onSave={handleSaveViewingTime}
                  fieldType="time"
                  placeholder="例: 14:30"
                />
              </Box>
            </Box>

            {/* 内覧形態（条件付き表示：内覧日が入力されている場合のみ表示） */}
            {(() => {
              // 内覧日が入力されているかチェック
              const hasViewingDate = buyer.viewing_date && buyer.viewing_date.trim() !== '';
              
              // 内覧日が入力されていない場合は表示しない
              if (!hasViewingDate) {
                return null;
              }

              console.log('[BuyerViewingResultPage] linkedProperties:', linkedProperties);
              console.log('[BuyerViewingResultPage] linkedProperties length:', linkedProperties?.length);
              
              // 紐づいた物件のatbb_statusに「専任」が含まれているかチェック
              const hasExclusiveProperty = linkedProperties?.some(
                (property: any) => {
                  console.log('[BuyerViewingResultPage] Checking property atbb_status:', property.atbb_status);
                  return property.atbb_status && property.atbb_status.includes('専任');
                }
              );

              // 紐づいた物件のatbb_statusに「一般」が含まれているかチェック
              const hasGeneralProperty = linkedProperties?.some(
                (property: any) => property.atbb_status && property.atbb_status.includes('一般')
              );

              console.log('[BuyerViewingResultPage] hasExclusiveProperty:', hasExclusiveProperty);
              console.log('[BuyerViewingResultPage] hasGeneralProperty:', hasGeneralProperty);

              // 専任物件の場合
              if (hasExclusiveProperty) {
                // 必須条件：内覧日が入力されているが、内覧形態が未入力の場合
                const hasValue = buyer.viewing_mobile && buyer.viewing_mobile.trim() !== '';
                const isRequired = !hasValue;

                const VIEWING_FORM_EXCLUSIVE_OPTIONS = [
                  '【内覧_専（自社物件）】',
                  '【内覧（他社物件）】',
                  '準不【内覧_専（立会）】',
                  '準不【内覧_専（立会不要）】',
                ];

                return (
                  <Box sx={{ width: '400px', flexShrink: 0 }}>
                    <Box 
                      sx={{ 
                        p: isRequired ? 1 : 0,
                        border: isRequired ? '2px solid' : 'none',
                        borderColor: isRequired ? 'error.main' : 'transparent',
                        borderRadius: 2,
                        bgcolor: isRequired ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                        boxShadow: isRequired ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        内覧形態 {isRequired && <span style={{ color: 'red', fontWeight: 'bold' }}>*必須</span>}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {VIEWING_FORM_EXCLUSIVE_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            variant={buyer.viewing_mobile === option ? 'contained' : 'outlined'}
                            color="primary"
                            size="small"
                            onClick={async () => {
                              // 同じボタンを2度クリックしたら値をクリア
                              const newValue = buyer.viewing_mobile === option ? '' : option;
                              await handleInlineFieldSave('viewing_mobile', newValue);
                            }}
                            sx={{ 
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                              whiteSpace: 'normal',
                              wordBreak: 'break-all',
                              fontSize: '0.7rem',
                              padding: '2px 4px',
                            }}
                          >
                            {option}
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                );
              }

              // 一般媒介物件の場合
              if (hasGeneralProperty) {
                // 必須条件：内覧日が入力されているが、内覧形態が未入力の場合
                const hasValue = buyer.viewing_type_general && buyer.viewing_type_general.trim() !== '';
                const isRequired = !hasValue;

                const VIEWING_FORM_GENERAL_OPTIONS = [
                  '【内覧_一般（自社物件）】',
                  '準不【内覧_一般（立会）】',
                  '準不【内覧_一般（立会不要）】',
                ];

                return (
                  <Box sx={{ width: '400px', flexShrink: 0 }}>
                    <Box 
                      sx={{ 
                        p: isRequired ? 1 : 0,
                        border: isRequired ? '2px solid' : 'none',
                        borderColor: isRequired ? 'error.main' : 'transparent',
                        borderRadius: 2,
                        bgcolor: isRequired ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                        boxShadow: isRequired ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        内覧形態_一般媒介 {isRequired && <span style={{ color: 'red', fontWeight: 'bold' }}>*必須</span>}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {VIEWING_FORM_GENERAL_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            variant={buyer.viewing_type_general === option ? 'contained' : 'outlined'}
                            color="primary"
                            size="small"
                            onClick={async () => {
                              // 同じボタンを2度クリックしたら値をクリア
                              const newValue = buyer.viewing_type_general === option ? '' : option;
                              await handleInlineFieldSave('viewing_type_general', newValue);
                            }}
                            sx={{ 
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                              whiteSpace: 'normal',
                              wordBreak: 'break-all',
                              fontSize: '0.7rem',
                              padding: '2px 4px',
                            }}
                          >
                            {option}
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                );
              }

              // 他社物件ケース（linkedProperties が空）の場合
              // hasViewingDate が true かつ linkedProperties が空のとき、
              // viewing_mobile の選択肢を表示する（要件1.1, 1.2）
              if (linkedProperties.length === 0) {
                // 必須条件：内覧日が入力されているが、内覧形態が未入力の場合（要件3.4）
                const hasValue = buyer.viewing_mobile && buyer.viewing_mobile.trim() !== '';
                // isRequired: 他社物件ケースでも既存の isViewingTypeRequired と同じロジックで判定
                const isRequired = !hasValue;

                // 他社物件では専任物件と同じ選択肢（VIEWING_FORM_EXCLUSIVE_OPTIONS）を使用（要件1.2）
                const VIEWING_FORM_EXCLUSIVE_OPTIONS = [
                  '【内覧_専（自社物件）】',
                  '【内覧（他社物件）】',
                  '準不【内覧_専（立会）】',
                  '準不【内覧_専（立会不要）】',
                ];

                return (
                  <Box sx={{ width: '400px', flexShrink: 0 }}>
                    <Box 
                      sx={{ 
                        p: isRequired ? 1 : 0,
                        border: isRequired ? '2px solid' : 'none',
                        borderColor: isRequired ? 'error.main' : 'transparent',
                        borderRadius: 2,
                        bgcolor: isRequired ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                        boxShadow: isRequired ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        内覧形態 {isRequired && <span style={{ color: 'red', fontWeight: 'bold' }}>*必須</span>}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {VIEWING_FORM_EXCLUSIVE_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            // タスク4.3: viewing_mobile === option のとき 'contained'、それ以外は 'outlined'（要件3.3）
                            variant={buyer.viewing_mobile === option ? 'contained' : 'outlined'}
                            color="primary"
                            size="small"
                            onClick={async () => {
                              // タスク4.1: 未選択→選択で viewing_mobile に保存、選択済み→再クリックでクリア（要件3.1, 3.2, 3.5）
                              const newValue = buyer.viewing_mobile === option ? '' : option;
                              await handleInlineFieldSave('viewing_mobile', newValue);
                            }}
                            sx={{ 
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                              whiteSpace: 'normal',
                              wordBreak: 'break-all',
                              fontSize: '0.7rem',
                              padding: '2px 4px',
                            }}
                          >
                            {option}
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                );
              }

              // 専任も一般もなく、他社物件でもない場合は表示しない
              return null;
            })()}

            {/* 後続担当 + 随行者 縦並びラッパー */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
            {/* 後続担当 */}
            <Box sx={{ width: '360px', flexShrink: 0 }}>
              <Box
                sx={{
                  p: isFollowUpRequired ? 1 : 0,
                  border: isFollowUpRequired ? '2px solid' : 'none',
                  borderColor: isFollowUpRequired ? 'error.main' : 'transparent',
                  borderRadius: 2,
                  bgcolor: isFollowUpRequired ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                  boxShadow: isFollowUpRequired ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              >
              <Typography variant="caption" color={isFollowUpRequired ? 'error' : 'text.secondary'} sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', fontWeight: isFollowUpRequired ? 'bold' : 'normal' }}>
                後続担当 {isFollowUpRequired && <span style={{ color: 'red', fontWeight: 'bold' }}>*必須</span>}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {staffInitials.map((staff) => {
                  // 営業担当かどうかを判定（K、Y、I、林、U）
                  const isSales = ['K', 'Y', 'I', '林', 'U'].includes(staff.value);
                  
                  return (
                    <Button
                      key={staff.value}
                      variant={buyer.follow_up_assignee === staff.value ? 'contained' : 'outlined'}
                      color={isSales ? 'success' : 'primary'}
                      size="small"
                      onClick={async () => {
                        // 同じボタンを2度クリックしたら値をクリア
                        const newValue = buyer.follow_up_assignee === staff.value ? '' : staff.value;
                        
                        // 楽観的UI更新: 即座にUIを更新
                        setBuyer(prev => prev ? { ...prev, follow_up_assignee: newValue } : prev);
                        buyerRef.current = buyer ? { ...buyer, follow_up_assignee: newValue } : null;
                        
                        // バックグラウンドで保存（エラー時はロールバック）
                        try {
                          await handleInlineFieldSave('follow_up_assignee', newValue);
                          // ダブルブッキングチェック（後続担当設定時）
                          if (newValue && buyer.viewing_date) {
                            const propertyNumber = linkedProperties?.[0]?.property_number || '';
                            await checkDoubleBooking(buyer.viewing_date, newValue, propertyNumber);
                          }
                        } catch (error) {
                          // エラー時は元の値に戻す
                          setBuyer(prev => prev ? { ...prev, follow_up_assignee: buyer.follow_up_assignee } : prev);
                          buyerRef.current = buyer;
                        }
                      }}
                      sx={{ 
                        minWidth: '32px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        fontWeight: isSales ? 'normal' : 'bold',
                      }}
                    >
                      {staff.label}
                    </Button>
                  );
                })}
                {/* タスク5.1: 「業者」ボタン（要件1.1, 1.2, 1.3） */}
                <Button
                  variant={buyer.follow_up_assignee === '業者' ? 'contained' : 'outlined'}
                  color="warning"
                  size="small"
                  onClick={async () => {
                    const newValue = buyer.follow_up_assignee === '業者' ? '' : '業者';
                    setBuyer(prev => prev ? { ...prev, follow_up_assignee: newValue } : prev);
                    buyerRef.current = buyer ? { ...buyer, follow_up_assignee: newValue } : null;
                    try {
                      await handleInlineFieldSave('follow_up_assignee', newValue);
                      // ダブルブッキングチェック（業者ボタン設定時）
                      if (newValue && buyer.viewing_date) {
                        const propertyNumber = linkedProperties?.[0]?.property_number || '';
                        await checkDoubleBooking(buyer.viewing_date, newValue, propertyNumber);
                      }
                    } catch (error) {
                      setBuyer(prev => prev ? { ...prev, follow_up_assignee: buyer.follow_up_assignee } : prev);
                      buyerRef.current = buyer;
                    }
                  }}
                  sx={{ minWidth: '32px', padding: '2px 6px', fontSize: '0.7rem' }}
                >
                  業者
                </Button>
              </Box>
              </Box>
            </Box>

            {/* 随行者 */}
            <Box sx={{ flexShrink: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                随行者
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {staffInitials.map((staff) => {
                  const isSales = ['K', 'Y', 'I', '林', 'U'].includes(staff.value);
                  return (
                    <Button
                      key={staff.value}
                      variant={buyer.viewing_companion === staff.value ? 'contained' : 'outlined'}
                      color={isSales ? 'success' : 'primary'}
                      size="small"
                      onClick={async () => {
                        const newValue = buyer.viewing_companion === staff.value ? '' : staff.value;
                        setBuyer(prev => prev ? { ...prev, viewing_companion: newValue } : prev);
                        buyerRef.current = buyer ? { ...buyer, viewing_companion: newValue } : null;
                        try {
                          await handleInlineFieldSave('viewing_companion', newValue);
                        } catch (error) {
                          setBuyer(prev => prev ? { ...prev, viewing_companion: buyer.viewing_companion } : prev);
                          buyerRef.current = buyer;
                        }
                      }}
                      sx={{
                        minWidth: '32px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        fontWeight: isSales ? 'normal' : 'bold',
                      }}
                    >
                      {staff.label}
                    </Button>
                  );
                })}
              </Box>
            </Box>
            {/* ラッパー終了 */}
            </Box>

            {/* 内覧未確定 */}
            <Box sx={{ width: '240px', flexShrink: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                内覧未確定
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {VIEWING_UNCONFIRMED_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={buyer.viewing_unconfirmed === option.value ? 'contained' : 'outlined'}
                    color="primary"
                    size="small"
                    onClick={async () => {
                      // 同じボタンを2度クリックしたら値をクリア
                      const newValue = buyer.viewing_unconfirmed === option.value ? '' : option.value;
                      await handleInlineFieldSave('viewing_unconfirmed', newValue);
                    }}
                    sx={{ 
                      fontSize: '0.7rem',
                      padding: '2px 4px',
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </Box>
            </Box>
            {/* 内覧後売主連絡（内覧情報行内 - viewing_mobile または viewing_type_general に「一般」が含まれる場合のみ表示） */}
            {(() => {
              const showPostViewingSellerContact =
                (buyer.viewing_mobile && buyer.viewing_mobile.includes('一般')) ||
                (buyer.viewing_type_general && buyer.viewing_type_general.includes('一般'));
              if (!showPostViewingSellerContact) return null;

              // 必須条件判定
              // mediation_type === "一般・公開中" AND viewing_date >= "2025-07-05" AND <= today AND viewing_result_follow_up が非空
              const isPostViewingSellerContactRequired = (() => {
                const mediationType = linkedProperties?.find((p: any) => p.atbb_status)?.atbb_status || '';
                if (mediationType !== '一般・公開中') return false;
                if (!buyer.viewing_date) return false;
                const viewingDate = new Date(buyer.viewing_date);
                if (isNaN(viewingDate.getTime())) return false;
                const minDate = new Date('2025-07-05');
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                if (viewingDate < minDate || viewingDate > today) return false;
                return !!(buyer.viewing_result_follow_up && String(buyer.viewing_result_follow_up).trim());
              })();

              return (
                <Box sx={{ flexShrink: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                    内覧後売主連絡{isPostViewingSellerContactRequired ? '*' : ''}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {(['済', '未', '不要'] as const).map((option) => {
                      const isSelected = buyer.post_viewing_seller_contact === option;
                      return (
                        <Button
                          key={option}
                          size="small"
                          variant={isSelected ? 'contained' : 'outlined'}
                          color="primary"
                          onClick={async () => {
                            const newValue = isSelected ? '' : option;
                            await handleInlineFieldSave('post_viewing_seller_contact', newValue);
                          }}
                          sx={{ py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1, fontSize: '0.75rem' }}
                        >
                          {option}
                        </Button>
                      );
                    })}
                  </Box>
                  {/* 注意書き（常時表示） */}
                  <Typography
                    variant="caption"
                    color="error"
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    *一般媒介は内覧後に、全ての売り主に結果報告をしてください
                  </Typography>
                </Box>
              );
            })()}
          </Box>

          {/* 内覧結果・後続対応 */}
          <Box>
            {/* クイック入力ボタン */}
            <Box sx={{ mb: 1 }}>
              {/* 売主内覧日連絡 / 売主キャンセル連絡 */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mb: 1 }}>
                {/* 売主内覧日連絡: SHOW条件 ISNOTBLANK([●内覧日(最新）]) */}
                {buyer.viewing_date && (
                  <Box sx={{ flexShrink: 0 }}>
                    {/* 必須条件: AND(ISNOTBLANK([●内覧日(最新）]),[●内覧日(最新）]>="2025/8/1") */}
                    {(() => {
                      const isRequired = (() => {
                        if (!buyer.viewing_date) return false;
                        const vd = new Date(buyer.viewing_date);
                        if (isNaN(vd.getTime())) return false;
                        return vd >= new Date('2025-08-01');
                      })();
                      return (
                        <>
                          <Typography variant="caption" color={isRequired && !buyer.seller_viewing_date_contact ? 'error' : 'text.secondary'} sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', fontWeight: isRequired && !buyer.seller_viewing_date_contact ? 'bold' : 'normal' }}>
                            売主内覧日連絡{isRequired && !buyer.seller_viewing_date_contact ? ' *必須' : ''}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {(['済', '未', '不要'] as const).map((option) => {
                              const isSelected = buyer.seller_viewing_date_contact === option;
                              return (
                                <Button
                                  key={option}
                                  size="small"
                                  variant={isSelected ? 'contained' : 'outlined'}
                                  color="primary"
                                  onClick={async () => {
                                    const newValue = isSelected ? '' : option;
                                    await handleInlineFieldSave('seller_viewing_date_contact', newValue);
                                  }}
                                  sx={{ py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1, fontSize: '0.75rem' }}
                                >
                                  {option}
                                </Button>
                              );
                            })}
                          </Box>
                        </>
                      );
                    })()}
                  </Box>
                )}

                {/* 売主キャンセル連絡: SHOW条件 AND(ISBLANK([●内覧日(最新）]),[売主内覧日連絡]="済") */}
                {!buyer.viewing_date && buyer.seller_viewing_date_contact === '済' && (
                  <Box sx={{ flexShrink: 0 }}>
                    {/* 必須条件: AND(ISBLANK([●内覧日(最新）]),[売主内覧日連絡]="済") */}
                    {(() => {
                      const isRequired = !buyer.viewing_date && buyer.seller_viewing_date_contact === '済';
                      return (
                        <>
                          <Typography variant="caption" color={isRequired && !buyer.seller_cancel_contact ? 'error' : 'text.secondary'} sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', fontWeight: isRequired && !buyer.seller_cancel_contact ? 'bold' : 'normal' }}>
                            売主キャンセル連絡{isRequired && !buyer.seller_cancel_contact ? ' *必須' : ''}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {(['済', '未', '不要'] as const).map((option) => {
                              const isSelected = buyer.seller_cancel_contact === option;
                              return (
                                <Button
                                  key={option}
                                  size="small"
                                  variant={isSelected ? 'contained' : 'outlined'}
                                  color="primary"
                                  onClick={async () => {
                                    const newValue = isSelected ? '' : option;
                                    await handleInlineFieldSave('seller_cancel_contact', newValue);
                                  }}
                                  sx={{ py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1, fontSize: '0.75rem' }}
                                >
                                  {option}
                                </Button>
                              );
                            })}
                          </Box>
                        </>
                      );
                    })()}
                  </Box>
                )}
              </Box>

              <Typography variant="subtitle2" gutterBottom>
                ヒアリング項目
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {VIEWING_RESULT_QUICK_INPUTS.map((item) => (
                  <Tooltip key={item.label} title={item.text} arrow>
                    <Chip
                      label={item.label}
                      onClick={() => handleViewingResultQuickInput(item.text)}
                      size="small"
                      clickable
                      color="primary"
                      variant="outlined"
                      sx={{ cursor: 'pointer' }}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>
            {/* RichTextEditor + 保存ボタン */}
            {(() => {
              const VIEWING_RESULT_DEFAULT_TEMPLATE = 
                '<p>・お客の属性：</p>' +
                '<p>・内覧理由：</p>' +
                '<p>・物件の気に入っている点：</p>' +
                '<p>・懸念事項：</p>' +
                '<p>・予算：</p>' +
                '<p>・時期：</p>';
              const savedValue = buyer?.viewing_result_follow_up || '';
              const isDirty = savedValue
                ? viewingResultEditValue !== savedValue
                : viewingResultEditValue !== VIEWING_RESULT_DEFAULT_TEMPLATE && viewingResultEditValue !== '';
              return (
                <>
                  <Box sx={{
                    border: isDirty ? '2px solid #ff6d00' : '2px solid transparent',
                    borderRadius: 1,
                    transition: 'border-color 0.2s',
                  }}>
                    <RichTextCommentEditor
                      ref={viewingResultEditorRef}
                      value={viewingResultEditValue}
                      onChange={(html) => setViewingResultEditValue(html)}
                      placeholder="内覧結果・後続対応を入力..."
                    />
                  </Box>
                  <Button
                    fullWidth
                    variant={isDirty ? 'contained' : 'outlined'}
                    size="large"
                    onClick={handleSaveViewingResult}
                    disabled={viewingResultSaving}
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
                    {viewingResultSaving ? '保存中...' : '保存'}
                  </Button>
                </>
              );
            })()}

            {/* 10万円キャンペーンお渡し済みチェック（ヒアリング項目の下） */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <input
                type="checkbox"
                id="campaign-handed-over-hearing"
                checked={campaignHandedOver}
                onChange={(e) => setCampaignHandedOver(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <label htmlFor="campaign-handed-over-hearing" style={{ cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold' }}>
                10万円キャンペーン お渡し済み
              </label>
            </Box>
          </Box>

          {/* 気づきフィールド */}
          <Box sx={{ mt: 2 }}>
            {/* 気づき（内覧実行者） */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                気づき（内覧実行者）
                {isInsightExecutorRequired && (
                  <Typography component="span" color="error" sx={{ ml: 0.5, fontWeight: 'bold' }}>
                    *必須
                  </Typography>
                )}
              </Typography>
              <Box sx={{
                border: isInsightExecutorRequired && !insightExecutorValue.replace(/<[^>]*>/g, '').trim()
                  ? '2px solid #d32f2f'
                  : '1px solid rgba(0,0,0,0.23)',
                borderRadius: 1,
                bgcolor: '#fff',
              }}>
                <RichTextCommentEditor
                  ref={insightExecutorEditorRef}
                  value={insightExecutorValue}
                  onChange={(html) => setInsightExecutorValue(html)}
                  placeholder="内覧実行者の気づきを入力..."
                />
              </Box>
              {isInsightExecutorRequired && !insightExecutorValue.replace(/<[^>]*>/g, '').trim() && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  ヒアリング項目が入力されている場合、気づき（内覧実行者）は必須です
                </Typography>
              )}
            </Box>
            {/* 気づき（随行者） */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                気づき（随行者）
              </Typography>
              <Box sx={{
                border: '1px solid rgba(0,0,0,0.23)',
                borderRadius: 1,
                bgcolor: '#fff',
              }}>
                <RichTextCommentEditor
                  ref={insightCompanionEditorRef}
                  value={insightCompanionValue}
                  onChange={(html) => setInsightCompanionValue(html)}
                  placeholder="随行者の気づきを入力..."
                />
              </Box>
            </Box>
            {/* 気づき保存ボタン */}
            {(() => {
              const isInsightDirty =
                insightExecutorValue !== (buyer?.viewing_insight_executor || '') ||
                insightCompanionValue !== (buyer?.viewing_insight_companion || '');
              return (
                <Button
                  fullWidth
                  variant={isInsightDirty ? 'contained' : 'outlined'}
                  size="large"
                  onClick={handleSaveInsights}
                  disabled={insightSaving}
                  sx={{
                    ...(isInsightDirty ? {
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
                  {insightSaving ? '保存中...' : '保存'}
                </Button>
              );
            })()}
          </Box>

          {/* 気づき必須警告ダイアログ */}
          <Dialog open={insightRequiredDialog.open} onClose={() => setInsightRequiredDialog({ open: false, targetUrl: '' })}>
            <DialogTitle>気づき（内覧実行者）が未入力です</DialogTitle>
            <DialogContent>
              <Typography>
                ヒアリング項目が入力されているため、「気づき（内覧実行者）」は必須です。
                入力せずにページを移動しますか？
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setInsightRequiredDialog({ open: false, targetUrl: '' })}>
                戻って入力する
              </Button>
              <Button
                color="warning"
                onClick={() => {
                  setInsightRequiredDialog({ open: false, targetUrl: '' });
                  navigate(insightRequiredDialog.targetUrl);
                }}
              >
                このまま移動する
              </Button>
            </DialogActions>
          </Dialog>

          {/* ★最新状況 */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            {/* ★最新状況ドロップダウン（幅を半分に） */}
            <Box sx={{ flex: '0 0 50%' }}>
              <Box 
                sx={{ 
                  p: (isOfferFailedFlag && (!buyer.latest_status || buyer.latest_status.trim() === '')) ? 1 : 0,
                  border: (isOfferFailedFlag && (!buyer.latest_status || buyer.latest_status.trim() === '')) ? '2px solid' : 'none',
                  borderColor: (isOfferFailedFlag && (!buyer.latest_status || buyer.latest_status.trim() === '')) ? 'error.main' : 'transparent',
                  borderRadius: 2,
                  bgcolor: (isOfferFailedFlag && (!buyer.latest_status || buyer.latest_status.trim() === '')) ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                  boxShadow: (isOfferFailedFlag && (!buyer.latest_status || buyer.latest_status.trim() === '')) ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {isOfferFailedFlag && (!buyer.latest_status || buyer.latest_status.trim() === '') && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
                    ★最新状況を選択してください *必須
                  </Typography>
                )}
                <InlineEditableField
                  label={isOfferFailedFlag ? "★最新状況 *必須" : "★最新状況"}
                  value={buyer.latest_status || ''}
                  onSave={handleSaveLatestStatus}
                  fieldType="dropdown"
                  options={getFilteredLatestStatusOptions()}
                  fieldName="latest_status"
                  buyerId={buyer_number}
                  enableConflictDetection={false}
                  showEditIndicator={true}
                  oneClickDropdown={true}
                />
              </Box>
            </Box>

            {/* 買付外れましたボタン（「買」を含む場合のみ表示） */}
            {buyer.latest_status && buyer.latest_status.includes('買') && !isOfferFailedFlag && (
              <Box sx={{ flex: '0 0 auto', pt: 3 }}>
                <Button
                  variant="outlined"
                  color="error"
                  size="medium"
                  onClick={async () => {
                    // 買付外れフラグを立てて、★最新状況を空欄にする
                    setIsOfferFailedFlag(true);
                    await handleInlineFieldSave('latest_status', '');
                  }}
                  sx={{ 
                    fontWeight: 'bold',
                    minWidth: '160px',
                  }}
                >
                  買付外れました
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Paper>

      {/* 買付情報セクション（条件付き表示） */}
      {shouldShowOfferSection() && (
        <Paper 
          sx={{ 
            p: 3,
            mt: 3,
            bgcolor: isOfferFailed() ? 'rgba(211, 47, 47, 0.08)' : 'rgba(76, 175, 80, 0.08)',
            border: '1px solid',
            borderColor: isOfferFailed() ? 'rgba(211, 47, 47, 0.3)' : 'rgba(76, 175, 80, 0.3)',
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            {isOfferFailed() ? '買付外れ情報' : '買付情報'}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* 買付コメント or 買付ハズレコメント */}
            <Box>
              {/* 買付外れの場合 */}
              {isOfferFailed() && (
                <Box 
                  sx={{ 
                    p: (!buyer.offer_comment || buyer.offer_comment.trim() === '') ? 1 : 0,
                    border: (!buyer.offer_comment || buyer.offer_comment.trim() === '') ? '2px solid' : 'none',
                    borderColor: (!buyer.offer_comment || buyer.offer_comment.trim() === '') ? 'error.main' : 'transparent',
                    borderRadius: 2,
                    bgcolor: (!buyer.offer_comment || buyer.offer_comment.trim() === '') ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                    boxShadow: (!buyer.offer_comment || buyer.offer_comment.trim() === '') ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    買付ハズレコメント
                    <span style={{ color: 'red', fontWeight: 'bold' }}> *必須</span>
                  </Typography>
                  <InlineEditableField
                    label=""
                    value={buyer.offer_comment || ''}
                    onSave={handleSaveOfferComment}
                    fieldType="textarea"
                    multiline
                    rows={3}
                  />
                </Box>
              )}
              {/* 通常の買付の場合 */}
              {!isOfferFailed() && (
                <Box 
                  sx={{ 
                    p: (!buyer.offer_comment || buyer.offer_comment.trim() === '') ? 1 : 0,
                    border: (!buyer.offer_comment || buyer.offer_comment.trim() === '') ? '2px solid' : 'none',
                    borderColor: (!buyer.offer_comment || buyer.offer_comment.trim() === '') ? 'error.main' : 'transparent',
                    borderRadius: 2,
                    bgcolor: (!buyer.offer_comment || buyer.offer_comment.trim() === '') ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                    boxShadow: (!buyer.offer_comment || buyer.offer_comment.trim() === '') ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    買付コメント
                    <span style={{ color: 'red', fontWeight: 'bold' }}> *必須</span>
                  </Typography>
                  <InlineEditableField
                    label=""
                    value={buyer.offer_comment || ''}
                    onSave={handleSaveOfferComment}
                    fieldType="textarea"
                    multiline
                    rows={3}
                    placeholder="価格交渉がある場合は、書いてください。仮審査をいつ受けて、いつまでの決済希望等、スケジュール感もあれば記載してください。"
                  />
                </Box>
              )}
            </Box>

            {/* 10万円キャンペーンお渡し済みチェック（買付外れでない場合のみ） */}
            {!isOfferFailed() && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input
                  type="checkbox"
                  id="campaign-handed-over"
                  checked={campaignHandedOver}
                  onChange={(e) => setCampaignHandedOver(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="campaign-handed-over" style={{ cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold' }}>
                  10万円キャンペーン お渡し済み
                </label>
              </Box>
            )}

            {/* 買付チャット送信ボタン or 買付ハズレチャット送信ボタン */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {isOfferFailed() ? '買付ハズレチャット送信' : '買付チャット送信'}
                <span style={{ color: 'red', fontWeight: 'bold' }}> *必須</span>
              </Typography>
              <Button
                variant="contained"
                color={isOfferFailed() ? 'error' : 'primary'}
                size="medium"
                onClick={handleOfferChatSend}
                sx={{ 
                  fontWeight: 'bold',
                }}
              >
                送信
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* 気づき一覧テーブル（全買主） */}
      {(() => {
        if (allInsightBuyers.length === 0) return null;
        return (
          <Paper sx={{ p: 3, mt: 3, bgcolor: '#e8f4fd', border: '1px solid #90caf9' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#1565c0' }}>
              気づき一覧（全買主）
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#bbdefb' }}>
                    {['買主番号', '物件住所', '内覧日', '内覧者（後続担当）', '随行者', '実行者コメント', '随行者コメント'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #90caf9', whiteSpace: 'nowrap', color: '#1565c0' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allInsightBuyers.map((b: any, idx: number) => (
                    <tr key={b.buyer_number} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#e3f2fd' }}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #90caf9', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        <span
                          style={{ color: '#1976d2', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
                          onClick={() => navigate(`/buyers/${b.buyer_number}`)}
                        >
                          {b.buyer_number}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #90caf9', verticalAlign: 'top' }}>
                        {b.property_address || '-'}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #90caf9', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        {b.viewing_date ? String(b.viewing_date).split('T')[0] : '-'}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #90caf9', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        {b.follow_up_assignee || '-'}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #90caf9', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        {b.name || '-'}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #90caf9', verticalAlign: 'top', minWidth: '200px' }}>
                        {b.viewing_insight_executor
                          ? <span dangerouslySetInnerHTML={{ __html: b.viewing_insight_executor }} />
                          : '-'}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #90caf9', verticalAlign: 'top', minWidth: '200px' }}>
                        {b.viewing_insight_companion
                          ? <span dangerouslySetInnerHTML={{ __html: b.viewing_insight_companion }} />
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Paper>
        );
      })()}


      {/* 物件の買主リストセクション */}
      {linkedProperties.length > 0 && (
        <Box ref={buyerListSectionRef} sx={{ mt: 3 }}>
          <CompactBuyerListForProperty
            buyers={propertyBuyers}
            propertyNumber={linkedProperties[0].property_number}
            loading={propertyBuyersLoading}
            showCreateButton={false}
          />
        </Box>
      )}

      {/* スナックバー */}
      {/* カレンダー登録確認ダイアログ */}
      <Dialog open={calendarConfirmDialog.open} onClose={() => setCalendarConfirmDialog(prev => ({ ...prev, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle>📅 Googleカレンダーに登録</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">内覧日時</Typography>
                <Typography variant="body2">{calendarConfirmDialog.viewingDate} {calendarConfirmDialog.viewingTime}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">後続担当</Typography>
                <Typography variant="body2">{calendarConfirmDialog.assignee || '（未設定）'}</Typography>
              </Box>
            </Box>
            <TextField
              label="タイトル"
              value={calendarConfirmDialog.title}
              onChange={(e) => setCalendarConfirmDialog(prev => ({ ...prev, title: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="説明"
              value={calendarConfirmDialog.description}
              onChange={(e) => setCalendarConfirmDialog(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={5}
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalendarConfirmDialog(prev => ({ ...prev, open: false }))}>キャンセル</Button>
          <Button onClick={handleCalendarConfirm} variant="contained" color="primary">カレンダーに登録</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <OfferFailedChatSentPopup
        open={offerFailedChatSentPopupOpen}
        onOk={handleOfferFailedChatSentPopupOk}
      />

      {/* カレンダー未開封の離脱警告ダイアログ */}
      <Dialog open={leaveWarningDialog.open} onClose={() => setLeaveWarningDialog({ open: false, targetUrl: '' })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>⚠️ カレンダー登録が未完了です</DialogTitle>
        <DialogContent>
          <Typography>
            内覧日・時間・後続担当が設定されていますが、まだ「カレンダーで開く」ボタンを押していません。
          </Typography>
          <Typography sx={{ mt: 1 }}>
            このままページを離れますか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveWarningDialog({ open: false, targetUrl: '' })}>
            このページに留まる
          </Button>
          <Button
            color="error"
            onClick={() => {
              setLeaveWarningDialog({ open: false, targetUrl: '' });
              navigate(leaveWarningDialog.targetUrl);
            }}
          >
            このまま離れる
          </Button>
        </DialogActions>
      </Dialog>

      {/* 売主内覧日連絡 未入力の離脱ブロックダイアログ */}
      <Dialog open={sellerViewingContactDialog.open} onClose={() => setSellerViewingContactDialog({ open: false, targetUrl: '' })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>🚨 売主内覧日連絡が未入力です</DialogTitle>
        <DialogContent>
          <Typography>
            内覧日が2026年4月29日以降の場合、<strong>売主内覧日連絡</strong>の入力が必須です。
          </Typography>
          <Typography sx={{ mt: 1 }}>
            「済」「未」「不要」のいずれかを選択してからページを離れてください。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setSellerViewingContactDialog({ open: false, targetUrl: '' })}>
            入力する
          </Button>
        </DialogActions>
      </Dialog>

      {/* 内覧ダブルブッキング警告ダイアログ */}
      <Dialog
        open={doubleBookingWarning.open}
        onClose={() => setDoubleBookingWarning({ open: false, conflicts: [] })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'warning.dark', display: 'flex', alignItems: 'center', gap: 1 }}>
          ⚠️ 同日に同じ物件の内覧が入っています
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5 }}>
            この前後に同じ物件で内覧が入っています。確認してください。鍵の件等大丈夫ですか？
          </Typography>
          {doubleBookingWarning.conflicts.map((c, idx) => (
            <Box key={idx} sx={{ p: 1.5, mb: 1, bgcolor: 'warning.light', borderRadius: 1, fontSize: '0.85rem' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                買主番号: {c.buyer_number}　{c.name || '（氏名なし）'}
              </Typography>
              <Typography variant="body2">
                内覧日: {c.viewing_date ? c.viewing_date.slice(0, 10) : ''}　時間: {c.viewing_time || '未設定'}　後続担当: {c.follow_up_assignee}
              </Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              setDoubleBookingWarning({ open: false, conflicts: [] });
              // 買主リストセクションへスクロール
              setTimeout(() => {
                buyerListSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }}
          >
            確認しました
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
