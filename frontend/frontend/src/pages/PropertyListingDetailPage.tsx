import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import api from '../services/api';
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
  running_cost?: number;
  running_cost_item1?: string;
  running_cost_item2?: string;
  running_cost_item3?: string;
  running_cost_price1?: number;
  running_cost_price2?: number;
  running_cost_price3?: number;
}

interface Buyer {
  id: number;
  name: string;
  confidence_level?: string;
  phone?: string;
  email?: string;
}

interface WorkTaskData {
  storage_url?: string;
}

export default function PropertyListingDetailPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [data, setData] = useState<PropertyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const [workTaskData, setWorkTaskData] = useState<WorkTaskData | null>(null);
  const [retrievingStorageUrl, setRetrievingStorageUrl] = useState(false);
  const [isCalculatingAreas, setIsCalculatingAreas] = useState(false);
  
  // Edit mode states for each section
  const [isPriceEditMode, setIsPriceEditMode] = useState(false);
  const [isBasicInfoEditMode, setIsBasicInfoEditMode] = useState(false);
  const [isPropertyDetailsEditMode, setIsPropertyDetailsEditMode] = useState(false);
  const [isFrequentlyAskedEditMode, setIsFrequentlyAskedEditMode] = useState(false);
  const [isViewingInfoEditMode, setIsViewingInfoEditMode] = useState(false);
  const [isSellerBuyerEditMode, setIsSellerBuyerEditMode] = useState(false);
  
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Check for buyer context from navigation state
  const buyerContext = location.state as { buyerId?: string; buyerName?: string; source?: string } | null;

  useEffect(() => {
    if (propertyNumber) {
      fetchPropertyData();
      fetchBuyers();
      fetchWorkTaskData();
    }
  }, [propertyNumber]);

  const fetchPropertyData = async () => {
    if (!propertyNumber) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      setData(response.data);
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

  const handleSave = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;
    setSaving(true);
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, editedData);
      setSnackbar({
        open: true,
        message: '保存しました',
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
    } finally {
      setSaving(false);
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
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, editedData);
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

  // 物件番号コピー機能
  const handleCopyPropertyNumber = async () => {
    if (!data?.property_number) return;

    try {
      await navigator.clipboard.writeText(data.property_number);
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

  // 公開URLを新しいタブで開く
  const handleOpenPublicUrl = () => {
    if (!data?.property_number) return;
    
    const publicUrl = `https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`;
    window.open(publicUrl, '_blank', 'noopener,noreferrer');
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
  const GOOGLE_MAP_URL_PATTERN = /^https:\/\/(maps\.google\.com|www\.google\.com\/maps|goo\.gl\/maps)\/.+/;
  const GOOGLE_DRIVE_FOLDER_PATTERN = /^https:\/\/drive\.google\.com\/drive\/(u\/\d+\/)?folders\/.+/;

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
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            物件が見つかりません
          </Typography>
          <Button variant="contained" onClick={handleBack} sx={{ mt: 2 }}>
            物件リストに戻る
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3, zoom: '0.6' }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* 左サイドバー - サイドバーステータス */}
        <PropertySidebarStatus
          listings={[data]}
          selectedStatus={data.sidebar_status || null}
          onStatusChange={() => {}}
          pendingPriceReductionProperties={new Set()}
        />

        {/* メインコンテンツ */}
        <Box sx={{ flex: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack} size="large">
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
                物件詳細 - {data.property_number}
              </Typography>
              <IconButton
                size="small"
                onClick={handleCopyPropertyNumber}
                sx={{ color: SECTION_COLORS.property.main }}
                title="物件番号をコピー"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
              {/* 公開URLボタン */}
              <Button
                variant="outlined"
                size="small"
                onClick={handleOpenPublicUrl}
                endIcon={<OpenInNewIcon fontSize="small" />}
                sx={{
                  ml: 1,
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
            {/* 売主連絡先ボタン */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              {data.seller_contact && (
                <Button
                  variant="outlined"
                  size="small"
                  href={`tel:${data.seller_contact}`}
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
                <Button
                  variant="outlined"
                  size="small"
                  href={`mailto:${data.seller_email}`}
                  startIcon={<EmailIcon fontSize="small" />}
                  sx={{
                    borderColor: '#1976d2',
                    color: '#1976d2',
                    '&:hover': {
                      borderColor: '#115293',
                      backgroundColor: '#1976d208',
                    },
                  }}
                >
                  売主へメール
                </Button>
              )}
            </Box>
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
        <Box sx={{ display: 'flex', gap: 2 }}>
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
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            size="medium"
            variant="contained"
          />
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={!hasChanges || saving}
            sx={{
              backgroundColor: SECTION_COLORS.property.main,
              '&:hover': {
                backgroundColor: SECTION_COLORS.property.dark,
              },
            }}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </Box>
      </Box>

      {/* Property Header - Key Information */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">所在地</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.address || data.display_address || '-'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">種別</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.property_type || '-'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">現況</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.current_status || '-'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">担当</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.sales_assignee || '-'}
            </Typography>
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
            gap: 2, 
            mb: 2,
            p: 2,
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
              >
                <PriceSection
                  salesPrice={data.price}
                  listingPrice={data.listing_price}
                  priceReductionHistory={data.price_reduction_history}
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

          {/* 2. よく聞かれる項目 + 特記・備忘録 */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 2, 
            mb: 2,
            p: 2,
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
              <Paper sx={{ p: 2, bgcolor: '#fff9e6', height: '100%' }}>
                <Box sx={{ 
                  mb: 2, 
                  pb: 1, 
                  borderBottom: `2px solid ${SECTION_COLORS.property.main}`,
                }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main, fontSize: '1.25rem' }}>
                    特記・備忘録
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ fontSize: '1rem' }}>特記</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={editedData.special_notes !== undefined ? editedData.special_notes : (data.special_notes || '')}
                    onChange={(e) => handleFieldChange('special_notes', e.target.value)}
                    placeholder="特記事項を入力してください"
                    sx={{ '& .MuiInputBase-input': { fontSize: '18px', lineHeight: 1.8 } }}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ fontSize: '1rem' }}>備忘録</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={editedData.memo !== undefined ? editedData.memo : (data.memo || '')}
                    onChange={(e) => handleFieldChange('memo', e.target.value)}
                    placeholder="備忘録を入力してください"
                    sx={{ '& .MuiInputBase-input': { fontSize: '18px', lineHeight: 1.8 } }}
                  />
                </Box>
              </Paper>
            </Box>
          </Box>

          {/* 3. 内覧情報 + 基本情報 */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 2, 
            mb: 2,
            p: 2,
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
              >
                <Grid container spacing={2}>
                  {(isViewingInfoEditMode || data.viewing_key) && (
                    <Grid item xs={12}>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>内覧時（鍵等）</Typography>
                      {isViewingInfoEditMode ? (
                        <TextField
                          fullWidth
                          size="small"
                          value={editedData.viewing_key !== undefined ? editedData.viewing_key : (data.viewing_key || '')}
                          onChange={(e) => handleFieldChange('viewing_key', e.target.value)}
                        />
                      ) : (
                        <Typography variant="body1">{data.viewing_key}</Typography>
                      )}
                    </Grid>
                  )}
                  {(isViewingInfoEditMode || data.viewing_parking) && (
                    <Grid item xs={12}>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>内覧時駐車場</Typography>
                      {isViewingInfoEditMode ? (
                        <TextField
                          fullWidth
                          size="small"
                          value={editedData.viewing_parking !== undefined ? editedData.viewing_parking : (data.viewing_parking || '')}
                          onChange={(e) => handleFieldChange('viewing_parking', e.target.value)}
                        />
                      ) : (
                        <Typography variant="body1">{data.viewing_parking}</Typography>
                      )}
                    </Grid>
                  )}
                  {(isViewingInfoEditMode || data.viewing_notes) && (
                    <Grid item xs={12}>
                      <Box sx={{ bgcolor: '#e3f2fd', p: 2, borderRadius: 1, border: '2px solid #2196f3' }}>
                        <Typography variant="h6" color="primary.dark" fontWeight="bold" gutterBottom sx={{ fontSize: '1.25rem' }}>
                          📝 内覧の時の伝達事項
                        </Typography>
                        {isViewingInfoEditMode ? (
                          <TextField
                            fullWidth
                            multiline
                            rows={4}
                            value={editedData.viewing_notes !== undefined ? editedData.viewing_notes : (data.viewing_notes || '')}
                            onChange={(e) => handleFieldChange('viewing_notes', e.target.value)}
                            sx={{ 
                              bgcolor: 'white',
                              '& .MuiInputBase-input': { fontSize: '1.1rem', lineHeight: 1.8 }
                            }}
                          />
                        ) : (
                          <Typography 
                            variant="body1"
                            sx={{ 
                              fontSize: '1.1rem', 
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
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>内覧可能日</Typography>
                      {isViewingInfoEditMode ? (
                        <TextField
                          fullWidth
                          size="small"
                          value={editedData.viewing_available_date !== undefined ? editedData.viewing_available_date : (data.viewing_available_date || '')}
                          onChange={(e) => handleFieldChange('viewing_available_date', e.target.value)}
                        />
                      ) : (
                        <Typography variant="body1">{data.viewing_available_date}</Typography>
                      )}
                    </Grid>
                  )}
                  {(isViewingInfoEditMode || data.building_viewing) && (
                    <Grid item xs={6}>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>建物内覧</Typography>
                      {isViewingInfoEditMode ? (
                        <TextField
                          fullWidth
                          size="small"
                          value={editedData.building_viewing !== undefined ? editedData.building_viewing : (data.building_viewing || '')}
                          onChange={(e) => handleFieldChange('building_viewing', e.target.value)}
                        />
                      ) : (
                        <Typography variant="body1">{data.building_viewing}</Typography>
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
              >
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>物件番号</Typography>
                <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1.25rem' }}>{data.property_number}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>担当</Typography>
                {isBasicInfoEditMode ? (
                  <TextField
                    fullWidth
                    size="small"
                    value={editedData.sales_assignee !== undefined ? editedData.sales_assignee : (data.sales_assignee || '')}
                    onChange={(e) => handleFieldChange('sales_assignee', e.target.value)}
                    sx={{ '& .MuiInputBase-input': { fontSize: '1.1rem' } }}
                  />
                ) : (
                  <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>{data.sales_assignee || '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>種別</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.property_type !== undefined ? editedData.property_type : (data.property_type || '')}
                    onChange={(e) => handleFieldChange('property_type', e.target.value)} />
                ) : (
                  <Typography variant="body1">{data.property_type || '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>状況</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.status !== undefined ? editedData.status : (data.status || '')}
                    onChange={(e) => handleFieldChange('status', e.target.value)} />
                ) : (
                  <Typography variant="body1">{data.status || '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>現況</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.current_status !== undefined ? editedData.current_status : (data.current_status || '')}
                    onChange={(e) => handleFieldChange('current_status', e.target.value)} />
                ) : (
                  <Typography variant="body1">{data.current_status || '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>配信日（公開）</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small" type="date"
                    value={editedData.distribution_date !== undefined ? editedData.distribution_date : (data.distribution_date || '')}
                    onChange={(e) => handleFieldChange('distribution_date', e.target.value)}
                    InputLabelProps={{ shrink: true }} />
                ) : (
                  <Typography variant="body1">{data.distribution_date || '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>売出価格</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small" type="number"
                    value={editedData.listing_price !== undefined ? editedData.listing_price : (data.listing_price || '')}
                    onChange={(e) => handleFieldChange('listing_price', e.target.value ? Number(e.target.value) : null)}
                    InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>¥</Typography> }} />
                ) : (
                  <Typography variant="body1">{data.listing_price ? `¥${data.listing_price.toLocaleString()}` : '-'}</Typography>
                )}
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>所在地</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.address !== undefined ? editedData.address : (data.address || data.display_address || '')}
                    onChange={(e) => handleFieldChange('address', e.target.value)} />
                ) : (
                  <Typography variant="body1">{data.address || data.display_address || '-'}</Typography>
                )}
              </Grid>
              {data.management_type && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>管理形態</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.management_type !== undefined ? editedData.management_type : (data.management_type || '')}
                      onChange={(e) => handleFieldChange('management_type', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.management_type}</Typography>
                  )}
                </Grid>
              )}
              {data.management_company && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>管理会社</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.management_company !== undefined ? editedData.management_company : (data.management_company || '')}
                      onChange={(e) => handleFieldChange('management_company', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.management_company}</Typography>
                  )}
                </Grid>
              )}
              {data.pet_consultation && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>ペット相談</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.pet_consultation !== undefined ? editedData.pet_consultation : (data.pet_consultation || '')}
                      onChange={(e) => handleFieldChange('pet_consultation', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.pet_consultation}</Typography>
                  )}
                </Grid>
              )}
              {data.hot_spring && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>温泉</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.hot_spring !== undefined ? editedData.hot_spring : (data.hot_spring || '')}
                      onChange={(e) => handleFieldChange('hot_spring', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.hot_spring}</Typography>
                  )}
                </Grid>
              )}
              {data.deduction_usage && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>控除利用</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.deduction_usage !== undefined ? editedData.deduction_usage : (data.deduction_usage || '')}
                      onChange={(e) => handleFieldChange('deduction_usage', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.deduction_usage}</Typography>
                  )}
                </Grid>
              )}
              {data.delivery_method && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>引渡方法</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.delivery_method !== undefined ? editedData.delivery_method : (data.delivery_method || '')}
                      onChange={(e) => handleFieldChange('delivery_method', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.delivery_method}</Typography>
                  )}
                </Grid>
              )}
              {data.broker && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>仲介業者</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.broker !== undefined ? editedData.broker : (data.broker || '')}
                      onChange={(e) => handleFieldChange('broker', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.broker}</Typography>
                  )}
                </Grid>
              )}
              {data.judicial_scrivener && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>司法書士</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.judicial_scrivener !== undefined ? editedData.judicial_scrivener : (data.judicial_scrivener || '')}
                      onChange={(e) => handleFieldChange('judicial_scrivener', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.judicial_scrivener}</Typography>
                  )}
                </Grid>
              )}
              {data.storage_location && (
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>保存場所</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.storage_location !== undefined ? editedData.storage_location : (data.storage_location || '')}
                      onChange={(e) => handleFieldChange('storage_location', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.storage_location}</Typography>
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
            gap: 2, 
            mb: 2,
            p: 2,
            bgcolor: '#f3e5f5',
            borderRadius: 2,
            border: '1px solid #ce93d8'
          }}>
            {/* 地図・サイトURL */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Box sx={{ mb: 2, pb: 1, borderBottom: `2px solid ${SECTION_COLORS.property.main}` }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
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
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">格納先URL</Typography>
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
                onSave={handleSavePropertyDetails} onCancel={handleCancelPropertyDetails}>
                <PropertyDetailsSection data={data} editedData={editedData}
                  onFieldChange={handleFieldChange} isEditMode={isPropertyDetailsEditMode} />
              </EditableSection>
            </Box>
          </Box>

          {/* 5. 配信エリア番号（全幅） */}
          <Box sx={{ mb: 2, p: 2, bgcolor: '#e8f5e9', borderRadius: 2, border: '1px solid #a5d6a7' }}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ mb: 2, pb: 1, borderBottom: `2px solid ${SECTION_COLORS.property.main}` }}>
                <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
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
            </Paper>
          </Box>

          {/* 6. 売主・買主情報 + 手数料情報 */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 2, p: 2,
            bgcolor: '#fce4ec', borderRadius: 2, border: '1px solid #f48fb1' }}>
            {/* 売主・買主情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <EditableSection title="売主・買主情報" isEditMode={isSellerBuyerEditMode}
                onEditToggle={() => setIsSellerBuyerEditMode(!isSellerBuyerEditMode)}
                onSave={handleSaveSellerBuyer} onCancel={handleCancelSellerBuyer}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>売主</Typography>
                  <Grid container spacing={2}>
                    {(isSellerBuyerEditMode || data.seller_name) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>名前</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_name !== undefined ? editedData.seller_name : (data.seller_name || '')}
                            onChange={(e) => handleFieldChange('seller_name', e.target.value)} />
                        ) : (<Typography variant="body1">{data.seller_name}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.seller_address) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>住所</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_address !== undefined ? editedData.seller_address : (data.seller_address || '')}
                            onChange={(e) => handleFieldChange('seller_address', e.target.value)} />
                        ) : (<Typography variant="body1">{data.seller_address}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.seller_contact) && (
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>連絡先</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_contact !== undefined ? editedData.seller_contact : (data.seller_contact || '')}
                            onChange={(e) => handleFieldChange('seller_contact', e.target.value)} />
                        ) : (<Typography variant="body1">{data.seller_contact}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.seller_email) && (
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>メールアドレス</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_email !== undefined ? editedData.seller_email : (data.seller_email || '')}
                            onChange={(e) => handleFieldChange('seller_email', e.target.value)} />
                        ) : (<Typography variant="body1">{data.seller_email}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.sale_reason) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>売却理由</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.sale_reason !== undefined ? editedData.sale_reason : (data.sale_reason || '')}
                            onChange={(e) => handleFieldChange('sale_reason', e.target.value)} />
                        ) : (<Typography variant="body1">{data.sale_reason}</Typography>)}
                      </Grid>
                    )}
                  </Grid>
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>買主</Typography>
                  <Grid container spacing={2}>
                    {(isSellerBuyerEditMode || data.buyer_name) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">名前</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.buyer_name !== undefined ? editedData.buyer_name : (data.buyer_name || '')}
                            onChange={(e) => handleFieldChange('buyer_name', e.target.value)} />
                        ) : (<Typography variant="body1">{data.buyer_name}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.buyer_address) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">住所</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.buyer_address !== undefined ? editedData.buyer_address : (data.buyer_address || '')}
                            onChange={(e) => handleFieldChange('buyer_address', e.target.value)} />
                        ) : (<Typography variant="body1">{data.buyer_address}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.buyer_contact) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">連絡先</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.buyer_contact !== undefined ? editedData.buyer_contact : (data.buyer_contact || '')}
                            onChange={(e) => handleFieldChange('buyer_contact', e.target.value)} />
                        ) : (<Typography variant="body1">{data.buyer_contact}</Typography>)}
                      </Grid>
                    )}
                  </Grid>
                </Box>
              </EditableSection>
            </Box>
            {/* 手数料情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Box sx={{ mb: 2, pb: 1, borderBottom: `2px solid ${SECTION_COLORS.property.main}` }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>手数料情報</Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">手数料（計）</Typography>
                    <Typography variant="body1">{data.total_commission ? `¥${data.total_commission.toLocaleString()}` : '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">転売差額</Typography>
                    <Typography variant="body1">{data.resale_margin ? `¥${data.resale_margin.toLocaleString()}` : '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">売主から</Typography>
                    <Typography variant="body1">{data.commission_from_seller ? `¥${data.commission_from_seller.toLocaleString()}` : '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">買主から</Typography>
                    <Typography variant="body1">{data.commission_from_buyer ? `¥${data.commission_from_buyer.toLocaleString()}` : '-'}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          </Box>

          {/* 7. 買付情報（全幅・条件付き表示） */}
          {(data.offer_date || data.offer_status || data.offer_amount) && (
            <Box sx={{ mb: 2, p: 2, bgcolor: '#fff3e0', borderRadius: 2, border: '1px solid #ffb74d' }}>
              <Paper sx={{ p: 2 }}>
                <Box sx={{ mb: 2, pb: 1, borderBottom: `2px solid ${SECTION_COLORS.property.main}` }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>買付情報</Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">買付日</Typography>
                    <Typography variant="body1">{data.offer_date || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">買付</Typography>
                    <Typography variant="body1">{data.offer_status || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">金額</Typography>
                    <Typography variant="body1">{data.offer_amount || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">会社名</Typography>
                    <Typography variant="body1">{data.company_name || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">買付コメント</Typography>
                    <Typography variant="body1">{data.offer_comment || '-'}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          )}

          {/* 8. 添付画像・資料（全幅） */}
          <Box sx={{ mb: 2, p: 2, bgcolor: '#f1f8e9', borderRadius: 2, border: '1px solid #aed581' }}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ mb: 2, pb: 1, borderBottom: `2px solid ${SECTION_COLORS.property.main}` }}>
                <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>添付画像・資料</Typography>
              </Box>
              <Grid container spacing={2}>
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
        </Box> {/* メインコンテンツ */}
      </Box> {/* サイドバー + メインコンテンツ */}
    </Container>
  );
}
