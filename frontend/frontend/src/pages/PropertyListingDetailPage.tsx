import { useState, useEffect } from 'react';
import PageNavigation from '../components/PageNavigation';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  Alert,
  Grid,
  TextField,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Tooltip,
  Select,
  MenuItem,
  Menu,
  InputAdornment,
  Chip,
  ButtonGroup,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Assignment as AssignmentIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Sms as SmsIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import api from '../services/api';
import RichTextEmailEditor from '../components/RichTextEmailEditor';
import ImageSelectorModal from '../components/ImageSelectorModal';
import SenderAddressSelector from '../components/SenderAddressSelector';
import { emailTemplates } from '../utils/emailTemplates';
import { getActiveEmployees } from '../services/employeeService';
import { getSenderAddress, saveSenderAddress } from '../utils/senderAddressStorage';
import { useAuthStore } from '../store/authStore';
import { buildUpdatedHistory } from '../utils/priceHistoryUtils';
import { isMobile } from 'react-device-detect';
import { SECTION_COLORS } from '../theme/sectionColors';
import FrequentlyAskedSection from '../components/FrequentlyAskedSection';
import PriceSection from '../components/PriceSection';
import PropertyDetailsSection from '../components/PropertyDetailsSection';
import CompactBuyerListForProperty from '../components/CompactBuyerListForProperty';
import EditableSection from '../components/EditableSection';
import GmailDistributionButton from '../components/GmailDistributionButton';
import DistributionAreaField from '../components/DistributionAreaField';
import EditableUrlField from '../components/EditableUrlField';
import PropertySidebarStatus from '../components/PropertySidebarStatus';
import PropertyChatHistory from '../components/PropertyChatHistory';
import { getDisplayStatus } from '../utils/atbbStatusDisplayMapper';
import PurchaseStatusBadge from '../components/PurchaseStatusBadge';
import { getPurchaseStatusText, hasBuyerPurchaseStatus } from '../utils/purchaseStatusUtils';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';
import ChatHistorySection from '../components/ChatHistorySection';
import { fetchChatHistory } from '../services/chatHistoryService';
import { ChatHistoryItem } from '../types/chatHistory';

interface PropertyListing {
  id: number;
  property_number: string;
  sales_assignee?: string;
  property_type?: string;
  contract_date?: string;
  settlement_date?: string;
  distribution_date?: string;
  address?: string;
  display_address?: string;
  land_area?: number;
  building_area?: number;
  sales_price?: number;
  status?: string;
  atbb_status?: string;
  seller_name?: string;
  seller_address?: string;
  seller_contact?: string;
  seller_email?: string;
  buyer_name?: string;
  buyer_address?: string;
  buyer_contact?: string;
  total_commission?: number;
  resale_margin?: number;
  commission_from_seller?: number;
  commission_from_buyer?: number;
  listing_price?: number;
  property_tax?: number;
  structure?: string;
  construction_year_month?: string;
  floor_plan?: string;
  exclusive_area?: number;
  main_lighting?: string;
  current_status?: string;
  delivery?: string;
  parking?: string;
  parking_fee?: number;
  bike_parking?: string;
  bike_parking_fee?: number;
  bicycle_parking?: string;
  bicycle_parking_fee?: number;
  management_fee?: number;
  reserve_fund?: number;
  special_notes?: string;
  pre_viewing_notes?: string;
  owner_info?: string;
  viewing_key?: string;
  viewing_parking?: string;
  viewing_notes?: string;
  viewing_available_date?: string;
  building_viewing?: string;
  broker_response?: string;
  sale_reason?: string;
  price?: number;
  price_reduction_history?: string;
  offer_date?: string;
  offer_status?: string;
  offer_amount?: string;
  offer_comment?: string;
  company_name?: string;
  image_url?: string;
  pdf_url?: string;
  google_map_url?: string;
  suumo_url?: string;
  distribution_areas?: string;
  management_type?: string;
  management_work_type?: string;
  management_company?: string;
  pet_consultation?: string;
  hot_spring?: string;
  hot_spring_status?: string;
  hot_spring_usage_type?: string;
  hot_spring_cost?: string;
  deduction_usage?: string;
  delivery_method?: string;
  broker?: string;
  judicial_scrivener?: string;
  storage_location?: string;
  memo?: string;
  sales_contract_completed?: string;
  running_cost?: number;
  running_cost_item1?: string;
  running_cost_item2?: string;
  running_cost_item3?: string;
  running_cost_price1?: number;
  running_cost_price2?: number;
  running_cost_price3?: number;
}

interface Buyer {
  buyer_id?: string;
  id?: number;
  name: string;
  buyer_number?: string;
  confidence_level?: string;
  inquiry_confidence?: string;
  phone?: string;
  phone_number?: string;
  email?: string;
  reception_date?: string;
  viewing_date?: string;
  latest_status?: string;
}

interface WorkTaskData {
  storage_url?: string;
}

// 値下げ履歴の最初の行から「前の価格」を取得するヘルパー
// 形式: "K3/17 1380万→1280万" → 13800000 を返す
function getPreviousPriceFromHistory(history: string | null | undefined): number | undefined {
  if (!history) return undefined;
  const lines = history.split('\n').filter((l: string) => l.trim());
  if (lines.length === 0) return undefined;
  const match = lines[0].match(/(\d+(?:\.\d+)?)万→(\d+(?:\.\d+)?)万/);
  if (!match) return undefined;
  const prevMan = parseFloat(match[1]);
  return Math.round(prevMan * 10000);
}

// 表示用日付フォーマット関数
// null / undefined / 空文字 → '-' を返す
// 'YYYY-MM-DD' 形式 → 'YYYY/MM/DD' 形式に変換して返す
const formatDisplayDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  return dateStr.replace(/-/g, '/');
};

export default function PropertyListingDetailPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { employee } = useAuthStore();
  const [data, setData] = useState<PropertyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const [workTaskData, setWorkTaskData] = useState<WorkTaskData | null>(null);
  const [retrievingStorageUrl, setRetrievingStorageUrl] = useState(false);
  const [isCalculatingAreas, setIsCalculatingAreas] = useState(false);
  
  // Edit mode states for each section
  const [isHeaderEditMode, setIsHeaderEditMode] = useState(false);
  const [isPriceEditMode, setIsPriceEditMode] = useState(false);
  const [isBasicInfoEditMode, setIsBasicInfoEditMode] = useState(false);
  const [isPropertyDetailsEditMode, setIsPropertyDetailsEditMode] = useState(false);
  const [isFrequentlyAskedEditMode, setIsFrequentlyAskedEditMode] = useState(false);
  const [isViewingInfoEditMode, setIsViewingInfoEditMode] = useState(false);
  const [isSellerBuyerEditMode, setIsSellerBuyerEditMode] = useState(false);
  
  const [salesContractDialog, setSalesContractDialog] = useState(false);
  const [salesContractUrlDialog, setSalesContractUrlDialog] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatToOfficePanelOpen, setChatToOfficePanelOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatToOfficeMessage, setChatToOfficeMessage] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatToOfficeSending, setChatToOfficeSending] = useState(false);
  const [chatHistoryRefreshTrigger, setChatHistoryRefreshTrigger] = useState(0);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [copiedPropertyNumber, setCopiedPropertyNumber] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [propertyNumberSearch, setPropertyNumberSearch] = useState<string>(''); // 物件番号検索

  // 物件テンプレート（非報告）関連の状態
  const [propertyEmailTemplates, setPropertyEmailTemplates] = useState<Array<{id: string; name: string; subject: string; body: string}>>([]);
  const [propertyEmailTemplatesLoading, setPropertyEmailTemplatesLoading] = useState(false);
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<null | HTMLElement>(null);

  // メール送信関連の状態
  const [emailDialog, setEmailDialog] = useState<{
    open: boolean;
    subject: string;
    body: string;
    recipient: string;
  }>({ open: false, subject: '', body: '', recipient: '' });
  const [editableEmailRecipient, setEditableEmailRecipient] = useState('');
  const [editableEmailSubject, setEditableEmailSubject] = useState('');
  const [editableEmailBody, setEditableEmailBody] = useState('');
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [senderAddress, setSenderAddress] = useState<string>(getSenderAddress());
  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);

  // 確認フィールド関連の状態
  const [confirmation, setConfirmation] = useState<'未' | '済' | null>(null);
  const [confirmationUpdating, setConfirmationUpdating] = useState(false);

  // Check for buyer context from navigation state
  const buyerContext = location.state as { buyerId?: string; buyerName?: string; source?: string } | null;

  useEffect(() => {
    if (propertyNumber) {
      Promise.allSettled([
        fetchPropertyData(),
        fetchBuyers(),
        fetchWorkTaskData(),
        getActiveEmployees().then(setActiveEmployees).catch(() => {}),
      ]);
      // 物件テンプレート（非報告）を事前取得
      fetchPropertyEmailTemplates();
    }
  }, [propertyNumber]);

  // 物件テンプレート（非報告）を取得する関数
  const fetchPropertyEmailTemplates = async () => {
    setPropertyEmailTemplatesLoading(true);
    try {
      const response = await api.get('/api/email-templates/property-non-report');
      setPropertyEmailTemplates(response.data);
    } catch (err) {
      console.error('[PropertyListingDetailPage] 物件テンプレート取得失敗:', err);
      // エラー時はボタンを非活性のまま維持（テンプレートは空のまま）
    } finally {
      setPropertyEmailTemplatesLoading(false);
    }
  };

  const fetchPropertyData = async () => {
    if (!propertyNumber) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      setData(response.data);
      // 確認フィールドを設定（nullの場合はそのまま）
      setConfirmation(response.data.confirmation);
    } catch (error) {
      console.error('Failed to fetch property data:', error);
      setSnackbar({
        open: true,
        message: '物件データの取得に失敗しました',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBuyers = async () => {
    if (!propertyNumber) return;
    setBuyersLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}/buyers`);
      setBuyers(response.data);
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
    } finally {
      setBuyersLoading(false);
    }
  };

  const fetchWorkTaskData = async () => {
    if (!propertyNumber) return;
    try {
      const response = await api.get(`/api/work-tasks/${propertyNumber}`);
      setWorkTaskData(response.data);
    } catch (error) {
      console.error('Failed to fetch work task data:', error);
      // Don't break the page if work task data is unavailable
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditedData((prev) => ({ ...prev, [field]: value }));

    // 売買価格（sales_price）は自動保存しない（保存ボタンで確定）
    if (field === 'sales_price') {
      return;
    }
  };

  // Save handlers for each section
  const handleSavePrice = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;

    // 価格変更の検出と値下げ履歴の自動追記
    const newSalesPrice = editedData.sales_price;
    const oldSalesPrice = data?.sales_price;

    let dataToSave = { ...editedData };

    if (newSalesPrice !== undefined && newSalesPrice !== null && newSalesPrice !== oldSalesPrice) {
      const initials = employee?.initials ?? '';
      const now = new Date();
      const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;
      const existingHistory =
        editedData.price_reduction_history !== undefined
          ? editedData.price_reduction_history
          : (data?.price_reduction_history ?? '');
      const updatedHistory = buildUpdatedHistory(
        oldSalesPrice,
        newSalesPrice,
        initials,
        existingHistory,
        dateStr
      );
      dataToSave = { ...dataToSave, price_reduction_history: updatedHistory };
    }

    try {
      await api.put(`/api/property-listings/${propertyNumber}`, dataToSave);
      setSnackbar({
        open: true,
        message: '価格情報を保存しました',
        severity: 'success',
      });
      await fetchPropertyData();
      setEditedData({});
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleSaveHeader = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, editedData);
      setSnackbar({
        open: true,
        message: 'サマリー情報を保存しました',
        severity: 'success',
      });
      await fetchPropertyData();
      setEditedData({});
      setIsHeaderEditMode(false);
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleCancelHeader = () => {
    setEditedData({});
    setIsHeaderEditMode(false);
  };

  const handleSaveBasicInfo = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, editedData);
      setSnackbar({
        open: true,
        message: '基本情報を保存しました',
        severity: 'success',
      });
      await fetchPropertyData();
      setEditedData({});
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleSavePropertyDetails = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, editedData);
      setSnackbar({
        open: true,
        message: '物件詳細情報を保存しました',
        severity: 'success',
      });
      await fetchPropertyData();
      setEditedData({});
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  // Cancel handlers for each section
  const handleCancelPrice = () => {
    setEditedData({});
    setIsPriceEditMode(false);
  };

  const handleCancelBasicInfo = () => {
    setEditedData({});
    setIsBasicInfoEditMode(false);
  };

  const handleCancelPropertyDetails = () => {
    setEditedData({});
    setIsPropertyDetailsEditMode(false);
  };

  const handleSaveFrequentlyAsked = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, editedData);
      setSnackbar({
        open: true,
        message: 'よく聞かれる項目を保存しました',
        severity: 'success',
      });
      await fetchPropertyData();
      setEditedData({});
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleCancelFrequentlyAsked = () => {
    setEditedData({});
    setIsFrequentlyAskedEditMode(false);
  };

  const handleSaveViewingInfo = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, editedData);
      setSnackbar({
        open: true,
        message: '内覧情報を保存しました',
        severity: 'success',
      });
      await fetchPropertyData();
      setEditedData({});
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleCancelViewingInfo = () => {
    setEditedData({});
    setIsViewingInfoEditMode(false);
  };

  const handleSaveSellerBuyer = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, editedData);
      setSnackbar({
        open: true,
        message: '売主買主情報を保存しました',
        severity: 'success',
      });
      await fetchPropertyData();
      setEditedData({});
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleCancelSellerBuyer = () => {
    setEditedData({});
    setIsSellerBuyerEditMode(false);
  };

  const handleSaveNotes = async () => {
    if (!propertyNumber) return;
    const notesData: Record<string, any> = {};
    if (editedData.special_notes !== undefined) notesData.special_notes = editedData.special_notes;
    if (editedData.memo !== undefined) notesData.memo = editedData.memo;
    if (Object.keys(notesData).length === 0) return;
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, notesData);
      setSnackbar({ open: true, message: '特記・備忘録を保存しました', severity: 'success' });
      await fetchPropertyData();
      setEditedData({});
    } catch (error) {
      setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    }
  };

  // 物件番号コピー機能
  const handleCopyAddress = async () => {
    const address = data?.address || data?.display_address;
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
      setSnackbar({ open: true, message: '所在地をコピーしました', severity: 'success' });
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  const handleCopyPropertyNumber = async () => {
    if (!data?.property_number) return;

    try {
      await navigator.clipboard.writeText(data.property_number);
      setCopiedPropertyNumber(true);
      setTimeout(() => setCopiedPropertyNumber(false), 2000);
      setSnackbar({
        open: true,
        message: '物件番号をコピーしました',
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to copy property number:', error);
      setSnackbar({
        open: true,
        message: '物件番号のコピーに失敗しました',
        severity: 'error',
      });
    }
  };

  // 公開URLコピー機能
  const handleCopyPublicUrl = async () => {
    if (!data?.property_number) return;
    
    const publicUrl = `https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`;
    
    try {
      await navigator.clipboard.writeText(publicUrl);
      setSnackbar({
        open: true,
        message: '公開URLをコピーしました',
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to copy public URL:', error);
      setSnackbar({
        open: true,
        message: '公開URLのコピーに失敗しました',
        severity: 'error',
      });
    }
  };

  // 担当へCHAT送信
  const handleSendChatToAssignee = async () => {
    if (!chatMessage.trim() || !propertyNumber) return;
    setChatSending(true);
    try {
      await api.post(`/api/property-listings/${propertyNumber}/send-chat-to-assignee`, {
        message: chatMessage,
        senderName: employee?.name || employee?.initials || '不明',
      });
      setSnackbar({ open: true, message: '担当へチャットを送信しました', severity: 'success' });
      setChatMessage('');
      setChatPanelOpen(false);
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.error || 'チャット送信に失敗しました', severity: 'error' });
    } finally {
      setChatSending(false);
    }
  };

  // 事務へCHATパネルをトグル
  const handleToggleChatToOfficePanel = () => {
    setChatToOfficePanelOpen(!chatToOfficePanelOpen);
    if (!chatToOfficePanelOpen) {
      // パネルを開く時、メッセージをクリア
      setChatToOfficeMessage('');
    }
  };

  // 事務へCHAT送信
  const handleSendChatToOffice = async () => {
    if (!chatToOfficeMessage.trim() || !propertyNumber) return;
    setChatToOfficeSending(true);
    try {
      await api.post(`/api/property-listings/${propertyNumber}/send-chat-to-office`, {
        message: chatToOfficeMessage,
        senderName: employee?.name || employee?.initials || '不明',
      });
      // 確認フィールドを「未」に自動設定
      setConfirmation('未');
      
      // 物件リストのキャッシュをクリア（最重要）
      pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS);
      
      // 物件リストページに戻ったときに再取得するためのフラグを設定
      sessionStorage.setItem('propertyListingsNeedsRefresh', 'true');
      
      // 即座にサイドバーを更新するためのイベントを発火
      console.log('[PropertyListingDetailPage] イベント発火:', { propertyNumber, confirmation: '未' });
      window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', { 
        detail: { propertyNumber, confirmation: '未' } 
      }));
      console.log('[PropertyListingDetailPage] イベント発火完了');
      
      // CHAT送信履歴を再取得
      setChatHistoryRefreshTrigger(prev => prev + 1);
      
      setSnackbar({ open: true, message: '事務へチャットを送信しました', severity: 'success' });
      setChatToOfficeMessage('');
      setChatToOfficePanelOpen(false);
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.error || 'チャット送信に失敗しました', severity: 'error' });
    } finally {
      setChatToOfficeSending(false);
    }
  };

  // 確認フィールド更新
  const handleUpdateConfirmation = async (value: '未' | '済') => {
    setConfirmationUpdating(true);
    try {
      await api.put(`/api/property-listings/${propertyNumber}/confirmation`, { confirmation: value });
      setConfirmation(value);
      setSnackbar({ open: true, message: `確認を「${value}」に更新しました`, severity: 'success' });
      
      // 物件リストのキャッシュをクリア（最重要）
      pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS);
      
      // 物件リストページに戻ったときに再取得するためのフラグを設定
      sessionStorage.setItem('propertyListingsNeedsRefresh', 'true');
      
      // 即座にサイドバーを更新するためのイベントを発火
      console.log('[PropertyListingDetailPage] イベント発火:', { propertyNumber, confirmation: value });
      window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', { 
        detail: { propertyNumber, confirmation: value } 
      }));
      console.log('[PropertyListingDetailPage] イベント発火完了');
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.error || '確認の更新に失敗しました', severity: 'error' });
    } finally {
      setConfirmationUpdating(false);
    }
  };

  // 公開URLを新しいタブで開く
  const handleOpenPublicUrl = () => {
    if (!data?.property_number) return;
    
    const publicUrl = `https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`;
    window.open(publicUrl, '_blank', 'noopener,noreferrer');
  };

  // メール送信ダイアログを開く
  const handleOpenEmailDialog = () => {
    if (!data?.seller_email) return;
    const defaultTemplate = emailTemplates[0];
    const subject = defaultTemplate ? defaultTemplate.subject : '';
    const body = defaultTemplate ? defaultTemplate.content.replace(/\n/g, '<br>') : '';
    setEditableEmailRecipient(data.seller_email);
    setEditableEmailSubject(subject);
    setEditableEmailBody(body);
    setSelectedImages([]);
    setEmailDialog({ open: true, subject, body, recipient: data.seller_email });
  };

  // 物件テンプレートを選択してプレースホルダー置換後にダイアログを開く
  const handleSelectPropertyEmailTemplate = async (templateId: string) => {
    setTemplateMenuAnchor(null);
    if (!data?.seller_email || !propertyNumber) return;
    try {
      const response = await api.post('/api/email-templates/property/merge', {
        propertyNumber,
        templateId,
      });
      const { subject, body } = response.data;
      setEditableEmailRecipient(data.seller_email);
      setEditableEmailSubject(subject || '');
      setEditableEmailBody((body || '').replace(/\n/g, '<br>'));
      setSelectedImages([]);
      setEmailDialog({ open: true, subject: subject || '', body: body || '', recipient: data.seller_email });
    } catch (err: any) {
      setSnackbar({ open: true, message: 'テンプレートの取得に失敗しました', severity: 'error' });
    }
  };

  // メール送信実行
  const handleSendEmail = async () => {
    if (!propertyNumber) return;
    setSendingEmail(true);
    try {
      const attachmentImages: any[] = [];
      for (const img of selectedImages) {
        if (img.source === 'drive') {
          attachmentImages.push({ id: img.driveFileId || img.id, name: img.name });
        } else if (img.source === 'local' && img.previewUrl) {
          const base64Match = (img.previewUrl as string).match(/^data:([^;]+);base64,(.+)$/);
          if (base64Match) {
            attachmentImages.push({ id: img.id, name: img.name, base64Data: base64Match[2], mimeType: base64Match[1] });
          }
        } else if (img.source === 'url' && img.url) {
          attachmentImages.push({ id: img.id, name: img.name, url: img.url });
        }
      }
      const payload: any = {
        templateId: 'custom',
        to: editableEmailRecipient,
        subject: editableEmailSubject,
        content: editableEmailBody,
        htmlBody: editableEmailBody,
        from: senderAddress,
      };
      if (attachmentImages.length > 0) payload.attachments = attachmentImages;

      await api.post(`/api/emails/by-seller-number/${propertyNumber}/send-template-email`, payload);
      setSnackbar({ open: true, message: 'メールを送信しました', severity: 'success' });
      setEmailDialog({ open: false, subject: '', body: '', recipient: '' });
      setSelectedImages([]);
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.error?.message || 'メール送信に失敗しました', severity: 'error' });
    } finally {
      setSendingEmail(false);
    }
  };

  // 買主候補リストページを開く
  const handleOpenBuyerCandidates = () => {
    if (!propertyNumber) return;

    // 新しいタブで買主候補リストページを開く
    window.open(
      `/property-listings/${propertyNumber}/buyer-candidates`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  // URL patterns for validation
  const GOOGLE_MAP_URL_PATTERN = /^https:\/\/(maps\.google\.com|www\.google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)\/.+/;
  const GOOGLE_DRIVE_FOLDER_PATTERN = /^https:\/\/drive\.google\.com\/drive\/(u\/\d+\/)?folders\/.+/;
  const SUUMO_URL_PATTERN = /^https:\/\/suumo\.jp\/.+/;

  // URL update handlers
  const handleUpdateGoogleMapUrl = async (newUrl: string) => {
    try {
      const response = await api.patch(
        `/api/property-listings/${propertyNumber}/google-map-url`,
        { googleMapUrl: newUrl }
      );
      
      // Update local state
      setData(prev => prev ? {
        ...prev,
        google_map_url: newUrl,
        distribution_areas: response.data.distributionAreas
      } : null);
      
      // Show success message
      setSnackbar({
        open: true,
        message: '地図URLを更新しました',
        severity: 'success',
      });
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || '地図URLの更新に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleUpdateStorageLocation = async (newUrl: string) => {
    try {
      await api.patch(
        `/api/property-listings/${propertyNumber}/storage-location`,
        { storageLocation: newUrl }
      );
      
      // Update local state
      setData(prev => prev ? {
        ...prev,
        storage_location: newUrl
      } : null);
      
      // Show success message
      setSnackbar({
        open: true,
        message: '格納先URLを更新しました',
        severity: 'success',
      });
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || '格納先URLの更新に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleUpdateSuumoUrl = async (newUrl: string) => {
    try {
      await api.put(
        `/api/property-listings/${propertyNumber}`,
        { suumo_url: newUrl }
      );
      
      // Update local state
      setData(prev => prev ? {
        ...prev,
        suumo_url: newUrl
      } : null);
      
      // Show success message
      setSnackbar({
        open: true,
        message: 'Suumo URLを更新しました',
        severity: 'success',
      });
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Suumo URLの更新に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  // 格納先URLを自動取得
  const handleAutoRetrieveStorageUrl = async () => {
    if (!propertyNumber) return;
    
    setRetrievingStorageUrl(true);
    try {
      const response = await api.post(
        `/api/public/properties/${propertyNumber}/retrieve-storage-url`
      );
      
      if (response.data.success && response.data.storageUrl) {
        // Update local state
        setData(prev => prev ? {
          ...prev,
          storage_location: response.data.storageUrl
        } : null);
        
        // Show success message
        setSnackbar({
          open: true,
          message: response.data.message || '格納先URLを自動取得しました',
          severity: 'success',
        });
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || '格納先URLの自動取得に失敗しました',
        severity: 'error',
      });
    } finally {
      setRetrievingStorageUrl(false);
    }
  };

  const handleBack = () => {
    // If navigated from buyer detail page, go back to buyer detail
    if (buyerContext?.buyerId && buyerContext?.source === 'buyer-detail') {
      navigate(`/buyers/${buyerContext.buyerId}`);
      return;
    }
    
    // Otherwise, go back to property listings
    const savedState = sessionStorage.getItem('propertyListState');
    if (savedState) {
      navigate('/property-listings', { state: JSON.parse(savedState) });
    } else {
      navigate('/property-listings');
    }
  };

  const hasChanges = Object.keys(editedData).length > 0;

  if (loading) {
    return (
      <Box sx={{ py: 3, px: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ py: 3, px: 2 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            物件が見つかりません
          </Typography>
          <Button variant="contained" onClick={handleBack} sx={{ mt: 2 }}>
            物件リストに戻る
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {/* ナビゲーションバー */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 200, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <PageNavigation />
        <TextField
          size="small"
          placeholder="物件番号で移動"
          value={propertyNumberSearch}
          onChange={(e) => setPropertyNumberSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && propertyNumberSearch.trim()) {
              navigate(`/property-listings/${propertyNumberSearch.trim()}`);
              setPropertyNumberSearch('');
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: propertyNumberSearch ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setPropertyNumberSearch('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ width: 200 }}
        />
      </Box>
    <Box sx={{ py: 1, px: 1 }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* 左サイドバー - サイドバーステータス */}
        <Box>
          <PropertySidebarStatus
            listings={[data]}
            selectedStatus={data.sidebar_status || null}
            onStatusChange={() => {}}
            pendingPriceReductionProperties={new Set()}
          />
          
          {/* CHAT送信履歴 */}
          <PropertyChatHistory
            propertyNumber={propertyNumber}
            refreshTrigger={chatHistoryRefreshTrigger}
          />
        </Box>

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1 }}>
      {/* モバイル時: 戻るボタンを画面上部に常時表示 */}
      {isMobile && (
        <Box sx={{ px: 1, py: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            variant="outlined"
            size="small"
            sx={{ minHeight: 44 }}
          >
            物件リストに戻る
          </Button>
        </Box>
      )}
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', px: 1, py: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 0.5 : 0, mb: isMobile ? 0 : 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 2, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          {!isMobile && (
          <IconButton onClick={handleBack} size="large">
            <ArrowBackIcon />
          </IconButton>
          )}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* 買付状況バッジ */}
              <PurchaseStatusBadge
                statusText={getPurchaseStatusText(
                  buyers.find(b => hasBuyerPurchaseStatus(b.latest_status))?.latest_status,
                  data.offer_status
                )}
              />
            </Box>
            {/* ヘッダーボタン（2行レイアウト） */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
              {/* 第1行: 売主TEL、EMAIL送信、SMS、公開URL */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {data.seller_contact && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => { window.location.href = `tel:${data.seller_contact}`; }}
                    startIcon={<PhoneIcon fontSize="small" />}
                    sx={{
                      borderColor: '#1565c0',
                      color: '#1565c0',
                      '&:hover': {
                        borderColor: '#0d47a1',
                        backgroundColor: '#1565c008',
                      },
                    }}
                  >
                    売主TEL
                  </Button>
                )}
                {data.seller_email && (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={(e) => {
                        if (!data.seller_email) return;
                        setTemplateMenuAnchor(e.currentTarget);
                      }}
                      disabled={!data.seller_email || propertyEmailTemplatesLoading || propertyEmailTemplates.length === 0}
                      startIcon={propertyEmailTemplatesLoading ? <CircularProgress size={14} /> : <EmailIcon fontSize="small" />}
                      endIcon={<ArrowDropDownIcon fontSize="small" />}
                      sx={{
                        borderColor: '#1976d2',
                        color: '#1976d2',
                        '&:hover': {
                          borderColor: '#115293',
                          backgroundColor: '#1976d208',
                        },
                      }}
                    >
                      Email送信
                    </Button>
                    <Menu
                      anchorEl={templateMenuAnchor}
                      open={Boolean(templateMenuAnchor)}
                      onClose={() => setTemplateMenuAnchor(null)}
                    >
                      {propertyEmailTemplates
                        .filter((tmpl) => {
                          if (tmpl.name.includes('一般媒介')) {
                            return (data.atbb_status || '').includes('一般媒介');
                          }
                          return true;
                        })
                        .map((tmpl) => (
                          <MenuItem key={tmpl.id} onClick={() => handleSelectPropertyEmailTemplate(tmpl.id)}>
                            {tmpl.name}
                          </MenuItem>
                        ))}
                    </Menu>
                  </>
                )}
                {data.seller_contact && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => { window.location.href = `sms:${data.seller_contact}`; }}
                    startIcon={<SmsIcon fontSize="small" />}
                    sx={{
                      borderColor: '#2e7d32',
                      color: '#2e7d32',
                      '&:hover': {
                        borderColor: '#1b5e20',
                        backgroundColor: '#2e7d3208',
                      },
                    }}
                  >
                    SMS
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleOpenPublicUrl}
                  endIcon={<OpenInNewIcon fontSize="small" />}
                  sx={{
                    borderColor: SECTION_COLORS.property.main,
                    color: SECTION_COLORS.property.main,
                    '&:hover': {
                      borderColor: SECTION_COLORS.property.dark,
                      backgroundColor: `${SECTION_COLORS.property.main}08`,
                    },
                  }}
                >
                  公開URL
                </Button>
                <IconButton
                  size="small"
                  onClick={handleCopyPublicUrl}
                  sx={{ color: SECTION_COLORS.property.main }}
                  title="公開URLをコピー"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
              
              {/* 第2行: 担当へCHAT、事務へCHAT */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {data.sales_assignee && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setChatPanelOpen(!chatPanelOpen)}
                    sx={{
                      borderColor: '#7b1fa2',
                      color: '#7b1fa2',
                      '&:hover': {
                        borderColor: '#4a148c',
                        backgroundColor: '#7b1fa208',
                      },
                    }}
                  >
                    担当へCHAT
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleToggleChatToOfficePanel}
                  aria-label="事務担当者へチャットを送信"
                  sx={{
                    borderColor: '#7b1fa2',
                    color: '#7b1fa2',
                    '&:hover': {
                      borderColor: '#4a148c',
                      backgroundColor: '#7b1fa208',
                    },
                  }}
                >
                  事務へCHAT
                </Button>
              </Box>
            </Box>
            {chatPanelOpen && data.sales_assignee && (
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <TextField
                  size="small"
                  placeholder="担当へ質問_伝言"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  multiline
                  rows={3}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={chatSending || !chatMessage.trim()}
                  onClick={handleSendChatToAssignee}
                  sx={{ backgroundColor: '#7b1fa2', '&:hover': { backgroundColor: '#4a148c' } }}
                >
                  {chatSending ? <CircularProgress size={16} sx={{ color: 'white' }} /> : '送信'}
                </Button>
              </Box>
            )}
            {chatToOfficePanelOpen && (
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <TextField
                  size="small"
                  placeholder="事務へ質問_伝言"
                  value={chatToOfficeMessage}
                  onChange={(e) => setChatToOfficeMessage(e.target.value)}
                  multiline
                  rows={3}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={chatToOfficeSending || !chatToOfficeMessage.trim()}
                  onClick={handleSendChatToOffice}
                  sx={{ backgroundColor: '#7b1fa2', '&:hover': { backgroundColor: '#4a148c' } }}
                >
                  {chatToOfficeSending ? <CircularProgress size={16} sx={{ color: 'white' }} /> : '送信'}
                </Button>
              </Box>
            )}
          </Box>
          {buyerContext?.buyerId && buyerContext?.source === 'buyer-detail' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                買主から遷移:
              </Typography>
              <Typography variant="body2" fontWeight="medium" sx={{ color: SECTION_COLORS.property.main }}>
                {buyerContext.buyerName || `買主ID: ${buyerContext.buyerId}`}
              </Typography>
            </Box>
          )}
        </Box>

        {/* 業者対応マーク - ヘッダー中央 */}
        {data.broker_response && (() => {
          try {
            let brokerDateValue: any = data.broker_response;
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
                <Box
                  sx={{
                    px: 3,
                    py: 1,
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
                      fontSize: '0.75rem',
                      letterSpacing: '0.05em',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ⚠️ 業者対応: {formattedDate} ⚠️
                  </Typography>
                </Box>
              );
            }
          } catch (e) {
            console.error('Failed to parse broker_response date:', e);
          }
          return null;
        })()}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => window.open(`/property-listings/${propertyNumber}/reins-registration`, '_blank', 'noopener,noreferrer')}
            sx={{ borderColor: '#1565c0', color: '#1565c0', '&:hover': { borderColor: '#0d47a1', backgroundColor: '#1565c008' } }}
          >
            レインズ登録、サイト入力
          </Button>
          <Button
            variant="outlined"
            startIcon={<AssignmentIcon />}
            onClick={() => window.open(`/property-listings/${propertyNumber}/report`, '_blank')}
            sx={{
              borderColor: '#7b1fa2',
              color: '#7b1fa2',
              '&:hover': {
                borderColor: '#6a1b9a',
                backgroundColor: '#7b1fa208',
              },
            }}
          >
            報告
          </Button>
          <Button
            variant="outlined"
            startIcon={<PersonIcon />}
            onClick={handleOpenBuyerCandidates}
            sx={{
              borderColor: SECTION_COLORS.property.main,
              color: SECTION_COLORS.property.main,
              '&:hover': {
                borderColor: SECTION_COLORS.property.main,
                backgroundColor: `${SECTION_COLORS.property.main}08`,
              },
            }}
          >
            買主候補リスト
          </Button>
          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            publicUrl={`https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            salesPrice={editedData.sales_price !== undefined ? editedData.sales_price : data.sales_price}
            previousSalesPrice={getPreviousPriceFromHistory(data.price_reduction_history)}
            priceReductionHistory={data.price_reduction_history}
            propertyType={editedData.property_type !== undefined ? editedData.property_type : data.property_type}
            size="medium"
            variant="contained"
          />
        </Box>
      </Box>

      {/* Property Header - Key Information */}
      <Paper sx={{ p: 1, mb: 1, bgcolor: '#f5f5f5', position: 'sticky', top: 48, zIndex: 100 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1" color="text.secondary" fontWeight="bold">物件情報</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography 
                variant="h6" 
                fontWeight="bold" 
                color="primary.main"
                sx={{ fontSize: '1.25rem' }}
              >
                {data.property_number}
              </Typography>
              <Tooltip title={copiedPropertyNumber ? 'コピーしました' : '物件番号をコピー'}>
                <IconButton
                  size="medium"
                  onClick={handleCopyPropertyNumber}
                  aria-label="物件番号をコピー"
                  sx={{ 
                    color: copiedPropertyNumber ? 'success.main' : 'primary.main',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  {copiedPropertyNumber ? <CheckIcon /> : <ContentCopyIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isHeaderEditMode ? (
              <>
                <Button size="small" variant="contained" onClick={handleSaveHeader} disabled={Object.keys(editedData).length === 0}>
                  保存
                </Button>
                <Button size="small" variant="outlined" onClick={handleCancelHeader}>
                  キャンセル
                </Button>
              </>
            ) : (
              <Button size="small" variant="outlined" onClick={() => setIsHeaderEditMode(true)}>
                編集
              </Button>
            )}
          </Box>
        </Box>
        <Grid container spacing={0.5} alignItems="flex-start" sx={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
          <Grid item xs={6} sm={4} md={true} sx={{ minWidth: 120, flex: '1 1 0' }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>所在地</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                value={editedData.address !== undefined ? editedData.address : (data.address || '')}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                sx={{ mt: 0.5 }}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.75rem' }}>
                  {data.address || data.display_address || '-'}
                </Typography>
                {(data.address || data.display_address) && (
                  <Tooltip title={copiedAddress ? 'コピーしました' : '所在地をコピー'}>
                    <IconButton size="small" onClick={handleCopyAddress}
                      sx={{ color: copiedAddress ? 'success.main' : 'text.secondary' }}>
                      {copiedAddress ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}
          </Grid>
          <Grid item xs={6} sm={4} md={true} sx={{ minWidth: 120, flex: '1 1 0' }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>売主氏名</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                value={editedData.seller_name !== undefined ? editedData.seller_name : (data.seller_name || '')}
                onChange={(e) => handleFieldChange('seller_name', e.target.value)}
                sx={{ mt: 0.5 }}
              />
            ) : (
              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.75rem' }}>
                {data.seller_name || '-'}
              </Typography>
            )}
          </Grid>
          <Grid item xs={6} sm={4} md={true} sx={{ minWidth: 120, flex: '1 1 0' }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>ATBB状況</Typography>
            {isHeaderEditMode ? (
              <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                <Select
                  value={editedData.atbb_status !== undefined ? editedData.atbb_status : (data.atbb_status || '')}
                  onChange={(e) => handleFieldChange('atbb_status', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value=""><em>未設定</em></MenuItem>
                  <MenuItem value="専任・公開中">専任・公開中</MenuItem>
                  <MenuItem value="一般・公開中">一般・公開中</MenuItem>
                  <MenuItem value="専任・公開前">専任・公開前</MenuItem>
                  <MenuItem value="一般・公開前">一般・公開前</MenuItem>
                  <MenuItem value="非公開（専任）">非公開（専任）</MenuItem>
                  <MenuItem value="非公開（一般）">非公開（一般）</MenuItem>
                  <MenuItem value="他社物件">他社物件</MenuItem>
                  <MenuItem value="非公開（配信メールのみ）">非公開（配信メールのみ）</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.75rem' }}>
                {getDisplayStatus(data.atbb_status) || '-'}
              </Typography>
            )}
          </Grid>
          <Grid item xs={6} sm={4} md={true} sx={{ minWidth: 120, flex: '1 1 0' }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>種別</Typography>
            {isHeaderEditMode ? (
              <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                <Select
                  value={editedData.property_type !== undefined ? editedData.property_type : (data.property_type || '')}
                  onChange={(e) => handleFieldChange('property_type', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value=""><em>未設定</em></MenuItem>
                  <MenuItem value="土地">土地</MenuItem>
                  <MenuItem value="戸建て">戸建て</MenuItem>
                  <MenuItem value="マンション">マンション</MenuItem>
                  <MenuItem value="収益物件">収益物件</MenuItem>
                  <MenuItem value="その他">その他</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.75rem' }}>
                {data.property_type || '-'}
              </Typography>
            )}
          </Grid>
          <Grid item xs={6} sm={4} md={true} sx={{ minWidth: 120, flex: '1 1 0' }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>現況</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                value={editedData.current_status !== undefined ? editedData.current_status : (data.current_status || '')}
                onChange={(e) => handleFieldChange('current_status', e.target.value)}
                sx={{ mt: 0.5 }}
              />
            ) : (
              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.75rem' }}>
                {data.current_status || '-'}
              </Typography>
            )}
          </Grid>
          <Grid item xs={6} sm={4} md={true} sx={{ minWidth: 120, flex: '1 1 0' }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>担当</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                value={editedData.sales_assignee !== undefined ? editedData.sales_assignee : (data.sales_assignee || '')}
                onChange={(e) => handleFieldChange('sales_assignee', e.target.value)}
                sx={{ mt: 0.5 }}
              />
            ) : (
              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.75rem' }}>
                {data.sales_assignee || '-'}
              </Typography>
            )}
          </Grid>
          <Grid item xs={6} sm={4} md={true} sx={{ minWidth: 120, flex: '1 1 0' }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>公開日</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                type="date"
                value={editedData.distribution_date !== undefined ? editedData.distribution_date : (data.distribution_date || '')}
                onChange={(e) => handleFieldChange('distribution_date', e.target.value)}
                sx={{ mt: 0.5 }}
                InputLabelProps={{ shrink: true }}
              />
            ) : (
              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.75rem' }}>
                {formatDisplayDate(data.distribution_date)}
              </Typography>
            )}
          </Grid>
          <Grid item xs={6} sm={4} md={true} sx={{ minWidth: 120, flex: '1 1 0' }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>売買価格</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                type="number"
                value={editedData.sales_price !== undefined ? editedData.sales_price : (data.sales_price || '')}
                onChange={(e) => handleFieldChange('sales_price', e.target.value ? Number(e.target.value) : null)}
                sx={{ mt: 0.5 }}
                InputProps={{
                  endAdornment: <Typography variant="caption" sx={{ ml: 0.5 }}>円</Typography>
                }}
              />
            ) : (
              <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.75rem', color: data.sales_price ? 'text.primary' : 'text.disabled' }}>
                {data.sales_price ? `${Math.round(data.sales_price / 10000).toLocaleString()}万円` : '価格応談'}
              </Typography>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Full Width Content */}
        <Grid item xs={12}>
          {/* 1. 価格情報 + 買主リスト */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 1, 
            mb: 1,
            p: 1,
            bgcolor: '#f8f9fa',
            borderRadius: 2,
            border: '1px solid #e0e0e0'
          }}>
            {/* 価格情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 33%' } }}>
              <EditableSection
                title="価格情報"
                isEditMode={isPriceEditMode}
                onEditToggle={() => setIsPriceEditMode(!isPriceEditMode)}
                onSave={handleSavePrice}
                onCancel={handleCancelPrice}
                hasChanges={Object.keys(editedData).length > 0}
              >
                <PriceSection
                  salesPrice={data.sales_price}
                  salesPriceActual={editedData.sales_price !== undefined ? editedData.sales_price : data.sales_price}
                  listingPrice={data.listing_price}
                  propertyType={editedData.property_type !== undefined ? editedData.property_type : data.property_type}
                  priceReductionHistory={data.price_reduction_history}
                  priceReductionScheduledDate={data.price_reduction_scheduled_date}
                  onFieldChange={handleFieldChange}
                  editedData={editedData}
                  isEditMode={isPriceEditMode}
                  propertyNumber={data.property_number}
                  salesAssignee={data.sales_assignee}
                  address={data.address}
                  onChatSendSuccess={(message) => setSnackbar({ open: true, message, severity: 'success' })}
                  onChatSendError={(message) => setSnackbar({ open: true, message, severity: 'error' })}
                />
              </EditableSection>
            </Box>
            
            {/* 買主リスト */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 67%' } }}>
              <CompactBuyerListForProperty
                buyers={buyers as any[]}
                propertyNumber={data.property_number}
                loading={buyersLoading}
              />
            </Box>
          </Box>

          {/* 確認フィールド（よく聞かれる項目の上） */}
          <Box sx={{ mb: 1, p: 1, bgcolor: '#fff8e1', borderRadius: 1, border: '1px solid #ffe082' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" fontWeight="bold">確認:</Typography>
              {confirmation !== null && (
                <ButtonGroup size="small" disabled={confirmationUpdating}>
                  <Button
                    variant={confirmation === '未' ? 'contained' : 'outlined'}
                    onClick={() => handleUpdateConfirmation('未')}
                    aria-label="確認を未に設定"
                    aria-pressed={confirmation === '未'}
                  >
                    未
                  </Button>
                  <Button
                    variant={confirmation === '済' ? 'contained' : 'outlined'}
                    onClick={() => handleUpdateConfirmation('済')}
                    aria-label="確認を済に設定"
                    aria-pressed={confirmation === '済'}
                  >
                    済
                  </Button>
                </ButtonGroup>
              )}
              {confirmation === null && (
                <Typography variant="body2" color="text.secondary">
                  （事務へCHAT送信後に表示されます）
                </Typography>
              )}
              {/* スクリーンリーダー用のaria-live領域 */}
              <Box
                role="status"
                aria-live="polite"
                aria-atomic="true"
                sx={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}
              >
                {confirmationUpdating && `確認を${confirmation}に更新中`}
              </Box>
            </Box>
          </Box>

          {/* 2. よく聞かれる項目 + 特記・備忘録 */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 1, 
            mb: 1,
            p: 1,
            bgcolor: '#fff8e1',
            borderRadius: 2,
            border: '1px solid #ffe082'
          }}>
            {/* よく聞かれる項目 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <EditableSection
                title="よく聞かれる項目"
                isEditMode={isFrequentlyAskedEditMode}
                onEditToggle={() => setIsFrequentlyAskedEditMode(!isFrequentlyAskedEditMode)}
                onSave={handleSaveFrequentlyAsked}
                onCancel={handleCancelFrequentlyAsked}
                hasChanges={Object.keys(editedData).length > 0}
              >
                <FrequentlyAskedSection 
                  data={data} 
                  editedData={editedData}
                  onFieldChange={handleFieldChange}
                  isEditMode={isFrequentlyAskedEditMode}
                />
              </EditableSection>
            </Box>
            
            {/* 特記・備忘録 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <Paper sx={{ p: 1, bgcolor: '#fff9e6', height: '100%' }}>
                <Box sx={{ 
                  mb: 2, 
                  pb: 0.5, 
                  borderBottom: `1px solid ${SECTION_COLORS.property.main}`,
                }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
                    特記・備忘録
                  </Typography>
                </Box>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem' }}>特記</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    value={editedData.special_notes !== undefined ? editedData.special_notes : (data.special_notes || '')}
                    onChange={(e) => handleFieldChange('special_notes', e.target.value)}
                    placeholder="特記事項を入力してください"
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', lineHeight: 1.8 } }}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.75rem' }}>備忘録</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    value={editedData.memo !== undefined ? editedData.memo : (data.memo || '')}
                    onChange={(e) => handleFieldChange('memo', e.target.value)}
                    placeholder="備忘録を入力してください"
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', lineHeight: 1.8 } }}
                  />
                </Box>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSaveNotes}
                    disabled={editedData.special_notes === undefined && editedData.memo === undefined}
                    sx={{
                      ...(editedData.special_notes !== undefined || editedData.memo !== undefined ? {
                        backgroundColor: '#d32f2f',
                        '&:hover': { backgroundColor: '#b71c1c' },
                        animation: 'pulseSave 1.5s infinite',
                        '@keyframes pulseSave': {
                          '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.7)' },
                          '70%': { boxShadow: '0 0 0 8px rgba(211, 47, 47, 0)' },
                          '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' },
                        },
                      } : { bgcolor: SECTION_COLORS.property.main }),
                    }}
                  >
                    保存
                  </Button>
                </Box>
              </Paper>
            </Box>
          </Box>

          {/* 3. 内覧情報 + 基本情報 */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 1, 
            mb: 1,
            p: 1,
            bgcolor: '#e3f2fd',
            borderRadius: 2,
            border: '1px solid #90caf9'
          }}>
            {/* 内覧情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <EditableSection
                title="内覧情報"
                isEditMode={isViewingInfoEditMode}
                onEditToggle={() => setIsViewingInfoEditMode(!isViewingInfoEditMode)}
                onSave={handleSaveViewingInfo}
                onCancel={handleCancelViewingInfo}
                hasChanges={Object.keys(editedData).length > 0}
              >
                <Grid container spacing={0.5}>
                  {(isViewingInfoEditMode || data.viewing_key) && (
                    <Grid item xs={12}>
                      <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>内覧時（鍵等）</Typography>
                      {isViewingInfoEditMode ? (
                        <TextField
                          fullWidth
                          size="small"
                          value={editedData.viewing_key !== undefined ? editedData.viewing_key : (data.viewing_key || '')}
                          onChange={(e) => handleFieldChange('viewing_key', e.target.value)}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.viewing_key}</Typography>
                      )}
                    </Grid>
                  )}
                  {(isViewingInfoEditMode || data.viewing_parking) && (
                    <Grid item xs={12}>
                      <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>内覧時駐車場</Typography>
                      {isViewingInfoEditMode ? (
                        <TextField
                          fullWidth
                          size="small"
                          value={editedData.viewing_parking !== undefined ? editedData.viewing_parking : (data.viewing_parking || '')}
                          onChange={(e) => handleFieldChange('viewing_parking', e.target.value)}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.viewing_parking}</Typography>
                      )}
                    </Grid>
                  )}
                  {(isViewingInfoEditMode || data.viewing_notes) && (
                    <Grid item xs={12}>
                      <Box sx={{ bgcolor: '#e3f2fd', p: 1, borderRadius: 1, border: '2px solid #2196f3' }}>
                        <Typography variant="subtitle2" color="primary.dark" fontWeight="bold" gutterBottom>
                          📝 内覧の時の伝達事項
                        </Typography>
                        {isViewingInfoEditMode ? (
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            value={editedData.viewing_notes !== undefined ? editedData.viewing_notes : (data.viewing_notes || '')}
                            onChange={(e) => handleFieldChange('viewing_notes', e.target.value)}
                            sx={{ 
                              bgcolor: 'white',
                              '& .MuiInputBase-input': { fontSize: '0.75rem', lineHeight: 1.8 }
                            }}
                          />
                        ) : (
                          <Typography 
                            variant="body1"
                            sx={{ 
                              fontSize: '0.75rem', 
                              lineHeight: 1.8,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word'
                            }}
                          >
                            {data.viewing_notes}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  )}
                  {(isViewingInfoEditMode || data.viewing_available_date) && (
                    <Grid item xs={6}>
                      <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>内覧可能日</Typography>
                      {isViewingInfoEditMode ? (
                        <TextField
                          fullWidth
                          size="small"
                          value={editedData.viewing_available_date !== undefined ? editedData.viewing_available_date : (data.viewing_available_date || '')}
                          onChange={(e) => handleFieldChange('viewing_available_date', e.target.value)}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.viewing_available_date}</Typography>
                      )}
                    </Grid>
                  )}
                  {(isViewingInfoEditMode || data.building_viewing) && (
                    <Grid item xs={6}>
                      <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>建物内覧</Typography>
                      {isViewingInfoEditMode ? (
                        <TextField
                          fullWidth
                          size="small"
                          value={editedData.building_viewing !== undefined ? editedData.building_viewing : (data.building_viewing || '')}
                          onChange={(e) => handleFieldChange('building_viewing', e.target.value)}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.building_viewing}</Typography>
                      )}
                    </Grid>
                  )}
                </Grid>
              </EditableSection>
            </Box>

            {/* 基本情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <EditableSection
                title="基本情報"
                isEditMode={isBasicInfoEditMode}
                onEditToggle={() => setIsBasicInfoEditMode(!isBasicInfoEditMode)}
                onSave={handleSaveBasicInfo}
                onCancel={handleCancelBasicInfo}
                hasChanges={Object.keys(editedData).length > 0}
              >
            <Grid container spacing={0.5}>
              <Grid item xs={6}>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>物件番号</Typography>
                <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '0.75rem' }}>{data.property_number}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>担当</Typography>
                {isBasicInfoEditMode ? (
                  <TextField
                    fullWidth
                    size="small"
                    value={editedData.sales_assignee !== undefined ? editedData.sales_assignee : (data.sales_assignee || '')}
                    onChange={(e) => handleFieldChange('sales_assignee', e.target.value)}
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                  />
                ) : (
                  <Typography variant="subtitle2" sx={{ fontSize: '0.75rem' }}>{data.sales_assignee || '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>種別</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.property_type !== undefined ? editedData.property_type : (data.property_type || '')}
                    onChange={(e) => handleFieldChange('property_type', e.target.value)} />
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.property_type || '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>売出価格</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small" type="number"
                    value={editedData.listing_price !== undefined ? editedData.listing_price : (data.listing_price || '')}
                    onChange={(e) => handleFieldChange('listing_price', e.target.value ? Number(e.target.value) : null)}
                    InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>¥</Typography> }} />
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.listing_price ? `¥${data.listing_price.toLocaleString()}` : '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>状況</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.status !== undefined ? editedData.status : (data.status || '')}
                    onChange={(e) => handleFieldChange('status', e.target.value)} />
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.status || '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>現況</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.current_status !== undefined ? editedData.current_status : (data.current_status || '')}
                    onChange={(e) => handleFieldChange('current_status', e.target.value)} />
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.current_status || '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>配信日（公開）</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small" type="date"
                    value={editedData.distribution_date !== undefined ? editedData.distribution_date : (data.distribution_date || '')}
                    onChange={(e) => handleFieldChange('distribution_date', e.target.value)}
                    InputLabelProps={{ shrink: true }} />
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.distribution_date || '-'}</Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>所在地</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.address !== undefined ? editedData.address : (data.address || data.display_address || '')}
                    onChange={(e) => handleFieldChange('address', e.target.value)} />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2">{data.address || data.display_address || '-'}</Typography>
                    {(data.address || data.display_address) && (
                      <Tooltip title={copiedAddress ? 'コピーしました' : '所在地をコピー'}>
                        <IconButton size="small" onClick={handleCopyAddress}
                          sx={{ color: copiedAddress ? 'success.main' : 'text.secondary' }}>
                          {copiedAddress ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                )}
                {!isBasicInfoEditMode && data.display_address && data.address && data.display_address !== data.address && (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', mb: 0.25 }}>住居表示</Typography>
                    <Typography variant="body2" color="text.secondary">{data.display_address}</Typography>
                  </Box>
                )}
              </Grid>
              {data.management_type && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>管理形態</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.management_type !== undefined ? editedData.management_type : (data.management_type || '')}
                      onChange={(e) => handleFieldChange('management_type', e.target.value)} />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.management_type}</Typography>
                  )}
                </Grid>
              )}
              {data.management_company && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>管理会社</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.management_company !== undefined ? editedData.management_company : (data.management_company || '')}
                      onChange={(e) => handleFieldChange('management_company', e.target.value)} />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.management_company}</Typography>
                  )}
                </Grid>
              )}
              {data.pet_consultation && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>ペット相談</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.pet_consultation !== undefined ? editedData.pet_consultation : (data.pet_consultation || '')}
                      onChange={(e) => handleFieldChange('pet_consultation', e.target.value)} />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.pet_consultation}</Typography>
                  )}
                </Grid>
              )}
              {data.hot_spring && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>温泉</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.hot_spring !== undefined ? editedData.hot_spring : (data.hot_spring || '')}
                      onChange={(e) => handleFieldChange('hot_spring', e.target.value)} />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.hot_spring}</Typography>
                  )}
                </Grid>
              )}
              {data.deduction_usage && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>控除利用</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.deduction_usage !== undefined ? editedData.deduction_usage : (data.deduction_usage || '')}
                      onChange={(e) => handleFieldChange('deduction_usage', e.target.value)} />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.deduction_usage}</Typography>
                  )}
                </Grid>
              )}
              {data.delivery_method && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>引渡方法</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.delivery_method !== undefined ? editedData.delivery_method : (data.delivery_method || '')}
                      onChange={(e) => handleFieldChange('delivery_method', e.target.value)} />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.delivery_method}</Typography>
                  )}
                </Grid>
              )}
              {data.broker && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>仲介業者</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.broker !== undefined ? editedData.broker : (data.broker || '')}
                      onChange={(e) => handleFieldChange('broker', e.target.value)} />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.broker}</Typography>
                  )}
                </Grid>
              )}
              {data.judicial_scrivener && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>司法書士</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.judicial_scrivener !== undefined ? editedData.judicial_scrivener : (data.judicial_scrivener || '')}
                      onChange={(e) => handleFieldChange('judicial_scrivener', e.target.value)} />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.judicial_scrivener}</Typography>
                  )}
                </Grid>
              )}
              {data.storage_location && (
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>保存場所</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.storage_location !== undefined ? editedData.storage_location : (data.storage_location || '')}
                      onChange={(e) => handleFieldChange('storage_location', e.target.value)} />
                  ) : (
                    <Link href={data.storage_location} target="_blank" rel="noopener noreferrer"
                      sx={{ fontSize: '0.75rem', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {data.storage_location}
                      <OpenInNewIcon sx={{ fontSize: '0.75rem', flexShrink: 0 }} />
                    </Link>
                  )}
                </Grid>
              )}
                </Grid>
              </EditableSection>
            </Box>
          </Box>

          {/* 4. 地図・サイトURL + 物件詳細情報 */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 1, 
            mb: 1,
            p: 1,
            bgcolor: '#f3e5f5',
            borderRadius: 2,
            border: '1px solid #ce93d8'
          }}>
            {/* 地図・サイトURL */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <Paper sx={{ p: 1, height: '100%' }}>
                <Box sx={{ mb: 1, pb: 0.5, borderBottom: `1px solid ${SECTION_COLORS.property.main}` }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
                    地図・サイトURL
                  </Typography>
                </Box>
                <EditableUrlField
                  label="地図URL"
                  value={data.google_map_url || null}
                  placeholder="https://maps.google.com/..."
                  urlPattern={GOOGLE_MAP_URL_PATTERN}
                  errorMessage="有効なGoogle Map URLを入力してください"
                  onSave={handleUpdateGoogleMapUrl}
                  helperText="物件の位置を示すGoogle Map URLを入力してください"
                />
                <EditableUrlField
                  label="Suumo URL"
                  value={data.suumo_url || null}
                  placeholder="https://suumo.jp/..."
                  urlPattern={SUUMO_URL_PATTERN}
                  errorMessage="有効なSuumo URLを入力してください"
                  onSave={handleUpdateSuumoUrl}
                  helperText="Suumo掲載URLを入力してください"
                />
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold">格納先URL</Typography>
                    <Button variant="outlined" size="small" onClick={handleAutoRetrieveStorageUrl}
                      disabled={retrievingStorageUrl}
                      startIcon={retrievingStorageUrl ? <CircularProgress size={16} /> : null}
                      sx={{ borderColor: SECTION_COLORS.property.main, color: SECTION_COLORS.property.main,
                        '&:hover': { borderColor: SECTION_COLORS.property.dark, backgroundColor: `${SECTION_COLORS.property.main}08` } }}>
                      {retrievingStorageUrl ? '取得中...' : '自動取得'}
                    </Button>
                  </Box>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">現在のURL:</Typography>
                    {data.storage_location ? (
                      <Link href={data.storage_location} target="_blank" rel="noopener noreferrer"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, wordBreak: 'break-all', fontSize: '0.875rem' }}>
                        {data.storage_location}
                        <OpenInNewIcon fontSize="small" />
                      </Link>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>未設定</Typography>
                    )}
                  </Box>
                  <EditableUrlField label="" value={data.storage_location || null}
                    placeholder="https://drive.google.com/drive/folders/..."
                    urlPattern={GOOGLE_DRIVE_FOLDER_PATTERN}
                    errorMessage="有効なGoogle DriveフォルダURLを入力してください"
                    onSave={handleUpdateStorageLocation}
                    helperText="物件関連ドキュメントが保存されているGoogle DriveフォルダのURLを入力してください" />
                </Box>
              </Paper>
            </Box>
            {/* 物件詳細情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <EditableSection title="物件詳細情報" isEditMode={isPropertyDetailsEditMode}
                onEditToggle={() => setIsPropertyDetailsEditMode(!isPropertyDetailsEditMode)}
                onSave={handleSavePropertyDetails} onCancel={handleCancelPropertyDetails}
                hasChanges={Object.keys(editedData).length > 0}>
                <PropertyDetailsSection
                  data={{
                    ...data,
                    price: editedData.price !== undefined ? editedData.price : data.price,
                    sales_price: editedData.sales_price !== undefined ? editedData.sales_price : data.sales_price,
                    property_type: editedData.property_type !== undefined ? editedData.property_type : data.property_type,
                  }}
                  editedData={editedData}
                  onFieldChange={handleFieldChange}
                  isEditMode={isPropertyDetailsEditMode}
                />
              </EditableSection>
            </Box>
          </Box>

          {/* 5. 配信エリア番号（全幅） */}
          <Box sx={{ mb: 2, p: 2, bgcolor: '#e8f5e9', borderRadius: 2, border: '1px solid #a5d6a7' }}>
            <Paper sx={{ p: 1 }}>
              <Box sx={{ mb: 1, pb: 0.5, borderBottom: `1px solid ${SECTION_COLORS.property.main}` }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
                  配信エリア番号
                </Typography>
              </Box>
              <DistributionAreaField
                propertyNumber={propertyNumber || ''}
                googleMapUrl={data.google_map_url}
                value={editedData.distribution_areas !== undefined ? editedData.distribution_areas : (data.distribution_areas || '')}
                onChange={(value) => handleFieldChange('distribution_areas', value)}
                onCalculatingChange={setIsCalculatingAreas}
              />
              {editedData.distribution_areas !== undefined && (
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={async () => {
                      try {
                        await api.put(`/api/property-listings/${propertyNumber}`, { distribution_areas: editedData.distribution_areas });
                        setSnackbar({ open: true, message: '配信エリアを保存しました', severity: 'success' });
                        await fetchPropertyData();
                        setEditedData(prev => { const { distribution_areas, ...rest } = prev; return rest; });
                      } catch {
                        setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
                      }
                    }}
                  >
                    保存
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setEditedData(prev => { const { distribution_areas, ...rest } = prev; return rest; })}
                  >
                    キャンセル
                  </Button>
                </Box>
              )}
            </Paper>
          </Box>

          {/* 6. 売主・買主情報 + 手数料情報 */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 1, p: 2,
            bgcolor: '#fce4ec', borderRadius: 2, border: '1px solid #f48fb1' }}>
            {/* 売主・買主情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <EditableSection title="売主・買主情報" isEditMode={isSellerBuyerEditMode}
                onEditToggle={() => setIsSellerBuyerEditMode(!isSellerBuyerEditMode)}
                onSave={handleSaveSellerBuyer} onCancel={handleCancelSellerBuyer}
                hasChanges={Object.keys(editedData).length > 0}>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>売主</Typography>
                  <Grid container spacing={0.5}>
                    {(isSellerBuyerEditMode || data.seller_name) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>名前</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_name !== undefined ? editedData.seller_name : (data.seller_name || '')}
                            onChange={(e) => handleFieldChange('seller_name', e.target.value)} />
                        ) : (<Typography variant="body2" sx={{ fontWeight: 600 }}>{data.seller_name}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.seller_address) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>住所</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_address !== undefined ? editedData.seller_address : (data.seller_address || '')}
                            onChange={(e) => handleFieldChange('seller_address', e.target.value)} />
                        ) : (<Typography variant="body2" sx={{ fontWeight: 600 }}>{data.seller_address}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.seller_contact) && (
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>連絡先</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_contact !== undefined ? editedData.seller_contact : (data.seller_contact || '')}
                            onChange={(e) => handleFieldChange('seller_contact', e.target.value)} />
                        ) : (<Typography variant="body2" sx={{ fontWeight: 600 }}>{data.seller_contact}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.seller_email) && (
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>メールアドレス</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_email !== undefined ? editedData.seller_email : (data.seller_email || '')}
                            onChange={(e) => handleFieldChange('seller_email', e.target.value)} />
                        ) : (<Typography variant="body2" sx={{ fontWeight: 600 }}>{data.seller_email}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.sale_reason) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.7rem', color: 'text.secondary', mb: 0 }}>売却理由</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.sale_reason !== undefined ? editedData.sale_reason : (data.sale_reason || '')}
                            onChange={(e) => handleFieldChange('sale_reason', e.target.value)} />
                        ) : (<Typography variant="body2" sx={{ fontWeight: 600 }}>{data.sale_reason}</Typography>)}
                      </Grid>
                    )}
                  </Grid>
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>買主</Typography>
                  <Grid container spacing={0.5}>
                    {(isSellerBuyerEditMode || data.buyer_name) && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">名前</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.buyer_name !== undefined ? editedData.buyer_name : (data.buyer_name || '')}
                            onChange={(e) => handleFieldChange('buyer_name', e.target.value)} />
                        ) : (<Typography variant="body2" sx={{ fontWeight: 600 }}>{data.buyer_name}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.buyer_address) && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">住所</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.buyer_address !== undefined ? editedData.buyer_address : (data.buyer_address || '')}
                            onChange={(e) => handleFieldChange('buyer_address', e.target.value)} />
                        ) : (<Typography variant="body2" sx={{ fontWeight: 600 }}>{data.buyer_address}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.buyer_contact) && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">連絡先</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.buyer_contact !== undefined ? editedData.buyer_contact : (data.buyer_contact || '')}
                            onChange={(e) => handleFieldChange('buyer_contact', e.target.value)} />
                        ) : (<Typography variant="body2" sx={{ fontWeight: 600 }}>{data.buyer_contact}</Typography>)}
                      </Grid>
                    )}
                  </Grid>
                </Box>
              </EditableSection>
            </Box>
            {/* 売買契約完了 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <Paper sx={{ p: 1, mb: 1 }}>
                <Box sx={{ mb: 1, pb: 0.5, borderBottom: `1px solid ${SECTION_COLORS.property.main}` }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>売買契約完了</Typography>
                </Box>
                <FormControl fullWidth size="small">
                  <Select
                    value={editedData.sales_contract_completed !== undefined ? editedData.sales_contract_completed : (data.sales_contract_completed || '')}
                    displayEmpty
                    onChange={(e) => {
                      const val = e.target.value;
                      handleFieldChange('sales_contract_completed', val);
                      if (val === '契約完了したのでネット非公開お願いします。') {
                        setSalesContractDialog(true);
                      }
                    }}
                  >
                    <MenuItem value="">（未設定）</MenuItem>
                    <MenuItem value="契約完了したのでネット非公開お願いします。">契約完了したのでネット非公開お願いします。</MenuItem>
                  </Select>
                </FormControl>
                {(editedData.sales_contract_completed !== undefined ? editedData.sales_contract_completed : (data.sales_contract_completed || '')) === '契約完了したのでネット非公開お願いします。' && (
                  <Box sx={{ mt: 1 }}>
                    <Button
                      variant="contained"
                      color="warning"
                      size="small"
                      onClick={() => setSalesContractDialog(true)}
                    >
                      チャット送信メッセージを表示
                    </Button>
                  </Box>
                )}
              </Paper>
            </Box>
            {/* 手数料情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <Paper sx={{ p: 1, height: '100%' }}>
                <Box sx={{ mb: 1, pb: 0.5, borderBottom: `1px solid ${SECTION_COLORS.property.main}` }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>手数料情報</Typography>
                </Box>
                <Grid container spacing={0.5}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">手数料（計）</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.total_commission ? `¥${data.total_commission.toLocaleString()}` : '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">転売差額</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.resale_margin ? `¥${data.resale_margin.toLocaleString()}` : '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">売主から</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.commission_from_seller ? `¥${data.commission_from_seller.toLocaleString()}` : '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">買主から</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.commission_from_buyer ? `¥${data.commission_from_buyer.toLocaleString()}` : '-'}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          </Box>

          {/* 7. 買付情報（全幅・条件付き表示） */}
          {(data.offer_date || data.offer_status || data.offer_amount) && (
            <Box sx={{ mb: 2, p: 2, bgcolor: '#fff3e0', borderRadius: 2, border: '1px solid #ffb74d' }}>
              <Paper sx={{ p: 1 }}>
                <Box sx={{ mb: 1, pb: 0.5, borderBottom: `1px solid ${SECTION_COLORS.property.main}` }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>買付情報</Typography>
                </Box>
                <Grid container spacing={0.5}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">買付日</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.offer_date || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">買付</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.offer_status || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">金額</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.offer_amount || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">会社名</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.company_name || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">買付コメント</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{data.offer_comment || '-'}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          )}

          {/* 8. 添付画像・資料（全幅） */}
          <Box sx={{ mb: 2, p: 2, bgcolor: '#f1f8e9', borderRadius: 2, border: '1px solid #aed581' }}>
            <Paper sx={{ p: 1 }}>
              <Box sx={{ mb: 1, pb: 0.5, borderBottom: `1px solid ${SECTION_COLORS.property.main}` }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>添付画像・資料</Typography>
              </Box>
              <Grid container spacing={0.5}>
                {data.image_url && (
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ border: '1px solid #ddd', borderRadius: 1, p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>画像</Typography>
                      <Button variant="outlined" size="small" href={data.image_url} target="_blank" rel="noopener noreferrer">
                        画像を開く
                      </Button>
                    </Box>
                  </Grid>
                )}
                {data.pdf_url && (
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ border: '1px solid #ddd', borderRadius: 1, p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>PDF</Typography>
                      <Button variant="outlined" size="small" href={data.pdf_url} target="_blank" rel="noopener noreferrer">
                        PDFを開く
                      </Button>
                    </Box>
                  </Grid>
                )}
              </Grid>
              {!data.image_url && !data.pdf_url && (
                <Typography variant="body2" color="text.secondary">添付資料がありません</Typography>
              )}
            </Paper>
          </Box>
        </Grid>
      </Grid>

      {/* 売買契約完了 チャット送信確認ダイアログ（ステップ1） */}
      <Dialog open={salesContractDialog} onClose={() => setSalesContractDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>チャット送信</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            売買契約完了の通知をチャットに送信しますか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSalesContractDialog(false)}>閉じる</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={chatSending}
            onClick={async () => {
              if (!data?.property_number) return;
              setChatSending(true);
              try {
                const apiBase = import.meta.env.VITE_API_URL || '';
                const res = await fetch(`${apiBase}/api/property-listings/${data.property_number}/notify-contract-completed`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) throw new Error('送信失敗');
                setSnackbar({ open: true, message: 'チャットに送信しました', severity: 'success' });
                setSalesContractDialog(false);
                setSalesContractUrlDialog(true);
              } catch (e) {
                setSnackbar({ open: true, message: 'チャット送信に失敗しました', severity: 'error' });
              } finally {
                setChatSending(false);
              }
            }}
          >
            {chatSending ? '送信中...' : 'チャット送信'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 売買契約完了 スプレッドシートURLダイアログ（ステップ2） */}
      <Dialog open={salesContractUrlDialog} onClose={() => setSalesContractUrlDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>チャット送信メッセージ</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            担当は、チャット送信後、下記より物件番号のみを入力してください↓↓
          </Typography>
          <Link
            href="https://docs.google.com/spreadsheets/d/1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M/edit?gid=534678762#gid=534678762"
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ wordBreak: 'break-all' }}
          >
            https://docs.google.com/spreadsheets/d/1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M/edit?gid=534678762#gid=534678762
          </Link>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSalesContractUrlDialog(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
      {/* メール送信ダイアログ */}
      <Dialog open={emailDialog.open} onClose={() => setEmailDialog(prev => ({ ...prev, open: false }))} maxWidth="md" fullWidth>
        <DialogTitle>メール送信</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <SenderAddressSelector
              value={senderAddress}
              onChange={(addr) => { setSenderAddress(addr); saveSenderAddress(addr); }}
            />
            <TextField
              label="送信先"
              value={editableEmailRecipient}
              onChange={(e) => setEditableEmailRecipient(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="件名"
              value={editableEmailSubject}
              onChange={(e) => setEditableEmailSubject(e.target.value)}
              fullWidth
              size="small"
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                本文
              </Typography>
              <RichTextEmailEditor
                value={editableEmailBody}
                onChange={setEditableEmailBody}
                placeholder="メール本文を入力してください"
              />
            </Box>
            {/* 画像添付 */}
            <Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowImageSelector(true)}
                sx={{ mb: 1 }}
              >
                画像を選択
              </Button>
              {selectedImages.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selectedImages.map((img) => (
                    <Chip
                      key={img.id}
                      label={img.name}
                      size="small"
                      onDelete={() => setSelectedImages(prev => prev.filter(i => i.id !== img.id))}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialog(prev => ({ ...prev, open: false }))}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleSendEmail}
            disabled={sendingEmail || !editableEmailRecipient}
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
          sellerNumber={propertyNumber || ''}
          onSelect={(images) => {
            setSelectedImages(images);
            setShowImageSelector(false);
          }}
          initialSelected={selectedImages}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
        </Box> {/* メインコンテンツ */}
      </Box> {/* サイドバー + メインコンテンツ */}
    </Box>
    </Box>
  );
}
