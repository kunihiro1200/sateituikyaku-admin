import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  OutlinedInput,
  Checkbox,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, OpenInNew } from '@mui/icons-material';
import api from '../services/api';
import PurchaseStatusBadge from '../components/PurchaseStatusBadge';
import { getPurchaseStatusText } from '../utils/purchaseStatusUtils';
import { INQUIRY_SOURCE_OPTIONS } from '../utils/buyerInquirySourceOptions';
import { LATEST_STATUS_OPTIONS } from '../utils/buyerLatestStatusOptions';
import {
  INQUIRY_EMAIL_PHONE_OPTIONS,
  DISTRIBUTION_TYPE_OPTIONS,
} from '../utils/buyerFieldOptions';
import {
  AREA_OPTIONS,
  DESIRED_PROPERTY_TYPE_OPTIONS,
  PARKING_SPACES_OPTIONS,
  PRICE_RANGE_DETACHED_OPTIONS,
  PRICE_RANGE_MANSION_OPTIONS,
  PRICE_RANGE_LAND_OPTIONS,
  BUILDING_AGE_OPTIONS,
  FLOOR_PLAN_OPTIONS,
} from '../utils/buyerDesiredConditionsOptions';

interface PropertyInfo {
  property_number: string;
  address: string;
  property_type: string;
  sales_price: number | null;
  land_area: number | null;
  building_area: number | null;
  floor_plan?: string;
  current_status?: string;
  pre_viewing_notes?: string;
  property_tax?: number;
  management_fee?: number;
  reserve_fund?: number;
  parking?: string;
  parking_fee?: number;
  delivery?: string;
  viewing_key?: string;
  viewing_parking?: string;
  viewing_notes?: string;
  special_notes?: string;
  memo?: string;
  broker_response?: string | number;
  offer_status?: string; // 買付フィールド
}

export default function NewBuyerPage() {
  const navigate = useNavigate();
  const [registeredBuyerNumber, setRegisteredBuyerNumber] = useState<string | null>(null);
  const [postRegistrationAction, setPostRegistrationAction] = useState<'desired-conditions' | 'viewing-result' | null>(null);
  const [searchParams] = useSearchParams();
  const propertyNumber = searchParams.get('propertyNumber');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [propertyInfo, setPropertyInfo] = useState<PropertyInfo | null>(null);
  const [loadingProperty, setLoadingProperty] = useState(false);
  const [nextBuyerNumber, setNextBuyerNumber] = useState<string>('');
  const [normalInitials, setNormalInitials] = useState<string[]>([]);

  // 基本情報
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [propertyNumberField, setPropertyNumberField] = useState(propertyNumber || '');
  
  // 法人名・業者問合せ
  const [companyName, setCompanyName] = useState('');
  const [brokerInquiry, setBrokerInquiry] = useState('');

  // 問合せ情報
  const [receptionDate, setReceptionDate] = useState(new Date().toISOString().split('T')[0]);
  const [inquirySource, setInquirySource] = useState('');
  const [inquiryHearing, setInquiryHearing] = useState('');
  const [latestStatus, setLatestStatus] = useState('');
  const [initialAssignee, setInitialAssignee] = useState('');
  
  // 希望条件（詳細）
  const [desiredArea, setDesiredArea] = useState<string[]>([]);
  const [desiredPropertyType, setDesiredPropertyType] = useState('');
  const [desiredBuildingAge, setDesiredBuildingAge] = useState('');
  const [desiredFloorPlan, setDesiredFloorPlan] = useState('');
  const [budget, setBudget] = useState('');
  const [priceRangeHouse, setPriceRangeHouse] = useState('');
  const [priceRangeApartment, setPriceRangeApartment] = useState('');
  const [priceRangeLand, setPriceRangeLand] = useState('');
  const [parkingSpaces, setParkingSpaces] = useState('');

  // 内覧情報
  const [viewingDate, setLatestViewingDate] = useState('');
  const [viewingTime, setViewingTime] = useState('');
  const [followUpAssignee, setFollowUpAssignee] = useState('');
  const [viewingResultFollowUp, setViewingResultFollowUp] = useState('');

  // 問合せ情報（追加フィールド）
  const [inquiryEmailPhone, setInquiryEmailPhone] = useState('');
  const [threeCallsConfirmed, setThreeCallsConfirmed] = useState('');
  const [vendorSurvey, setVendorSurvey] = useState('');
  const [emailType, setEmailType] = useState('');
  const [distributionType, setDistributionType] = useState('');
  const [pinrich, setPinrich] = useState('');
  const [ownedHomeHearing, setOwnedHomeHearing] = useState('');
  const [ownedHomeHearingInquiry, setOwnedHomeHearingInquiry] = useState('');
  const [ownedHomeHearingResult, setOwnedHomeHearingResult] = useState('');
  const [valuationRequired, setValuationRequired] = useState('');
  const [nextCallDate, setNextCallDate] = useState('');

  // 売主コピー
  const [sellerCopyInput, setSellerCopyInput] = useState('');
  const [sellerCopyOptions, setSellerCopyOptions] = useState<Array<{sellerNumber: string; name: string; id: string}>>([]);
  const [sellerCopyLoading, setSellerCopyLoading] = useState(false);

  // 買主コピー
  const [buyerCopyInput, setBuyerCopyInput] = useState('');
  const [buyerCopyOptions, setBuyerCopyOptions] = useState<Array<{buyer_number: string; name: string}>>([]);
  const [buyerCopyLoading, setBuyerCopyLoading] = useState(false);

  // チャット送信状態
  const [chatSending, setChatSending] = useState(false);
  const [chatSent, setChatSent] = useState(false);

  // その他
  const [specialNotes, setSpecialNotes] = useState('');
  const [messageToAssignee, setMessageToAssignee] = useState('');
  const [confirmationToAssignee, setConfirmationToAssignee] = useState('');
  const [familyComposition, setFamilyComposition] = useState('');
  const [mustHavePoints, setMustHavePoints] = useState('');
  const [likedPoints, setLikedPoints] = useState('');
  const [dislikedPoints, setDislikedPoints] = useState('');
  const [purchaseObstacles, setPurchaseObstacles] = useState('');
  const [nextAction, setNextAction] = useState('');

  useEffect(() => {
    if (propertyNumber) {
      fetchPropertyInfo(propertyNumber);
    }
    // 次の買主番号を取得
    api.get('/api/buyers/next-buyer-number')
      .then(res => setNextBuyerNumber(res.data.buyerNumber))
      .catch(err => console.error('Failed to fetch next buyer number:', err));
    // 通常スタッフのイニシャル一覧を取得
    api.get('/api/employees/normal-initials')
      .then(res => setNormalInitials(res.data.initials || []))
      .catch(err => console.error('Failed to fetch normal initials:', err));
  }, [propertyNumber]);

  const fetchPropertyInfo = async (propNum: string) => {
    setLoadingProperty(true);
    try {
      const response = await api.get(`/api/property-listings/${propNum}`);
      setPropertyInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch property info:', error);
      setPropertyInfo(null);
    } finally {
      setLoadingProperty(false);
    }
  };


  // 売主コピー検索ハンドラ
  const handleSellerCopySearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSellerCopyOptions([]);
      return;
    }
    setSellerCopyLoading(true);
    try {
      const response = await api.get(`/api/sellers/search?q=${encodeURIComponent(query)}`);
      setSellerCopyOptions(response.data || []);
    } catch (err) {
      setSellerCopyOptions([]);
    } finally {
      setSellerCopyLoading(false);
    }
  };

  const handleSellerCopySelect = async (option: {sellerNumber: string; name: string; id: string} | null) => {
    if (!option) return;
    try {
      const response = await api.get(`/api/sellers/by-number/${option.sellerNumber}`);
      const seller = response.data;
      if (seller.name) setName(seller.name);
      if (seller.phoneNumber) setPhoneNumber(seller.phoneNumber);
      if (seller.email) setEmail(seller.email);
      setInquirySource('売主');
    } catch (err) {
      setError('売主情報の取得に失敗しました');
    }
  };

  // 買主コピー検索ハンドラ
  const handleBuyerCopySearch = async (query: string) => {
    if (!query || query.length < 2) {
      setBuyerCopyOptions([]);
      return;
    }
    setBuyerCopyLoading(true);
    try {
      const response = await api.get(`/api/buyers/search?q=${encodeURIComponent(query)}&limit=20`);
      setBuyerCopyOptions(response.data || []);
    } catch (err) {
      setBuyerCopyOptions([]);
    } finally {
      setBuyerCopyLoading(false);
    }
  };

  const handleBuyerCopySelect = async (option: {buyer_number: string; name: string} | null) => {
    if (!option) return;
    try {
      const response = await api.get(`/api/buyers/${option.buyer_number}`);
      const buyer = response.data;
      if (buyer.name) setName(buyer.name);
      if (buyer.phoneNumber || buyer.phone_number) setPhoneNumber(buyer.phoneNumber || buyer.phone_number);
      if (buyer.email) setEmail(buyer.email);
      setInquirySource('2件目以降');
    } catch (err) {
      setError('買主情報の取得に失敗しました');
    }
  };

  // 法人名に入力がある場合のみ業者問合せを表示する
  const showBrokerInquiry = (name: string): boolean => {
    return Boolean(name && name.trim().length > 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      setError('氏名は必須です');
      return;
    }

    // 初動担当の条件付き必須バリデーション（受付日2026/3/30以降）
    const receptionDateObj = receptionDate ? new Date(receptionDate) : null;
    const isAfterCutoff = receptionDateObj && receptionDateObj >= new Date('2026-03-30');
    if (isAfterCutoff) {
      const emailPhoneFilled = inquiryEmailPhone && String(inquiryEmailPhone).trim();
      const hearingFilled = inquiryHearing && String(inquiryHearing).trim();
      if ((emailPhoneFilled || hearingFilled) && (!initialAssignee || !String(initialAssignee).trim())) {
        setError('初動担当は必須です（受付日2026/3/30以降かつ問合メール電話対応または問合時ヒアリングが入力されている場合）');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const buyerData = {
        name,
        phone_number: phoneNumber,
        email,
        company_name: companyName,
        broker_inquiry: companyName.trim() ? brokerInquiry : '',
        property_number: propertyNumberField,
        reception_date: receptionDate,
        inquiry_source: inquirySource,
        inquiry_hearing: inquiryHearing,
        latest_status: latestStatus,
        initial_assignee: initialAssignee,
        // 希望条件
        desired_area: desiredArea.join('|'),
        desired_property_type: desiredPropertyType,
        desired_building_age: desiredBuildingAge,
        desired_floor_plan: desiredFloorPlan,
        budget,
        price_range_house: priceRangeHouse,
        price_range_apartment: priceRangeApartment,
        price_range_land: priceRangeLand,
        parking_spaces: parkingSpaces,
        // 内覧情報
        viewing_date: viewingDate || null,
        viewing_time: viewingTime || null,
        follow_up_assignee: followUpAssignee || null,
        viewing_result_follow_up: viewingResultFollowUp || null,
        // 問合せ情報（追加）
        inquiry_email_phone: inquiryEmailPhone || null,
        three_calls_confirmed: threeCallsConfirmed || null,
        vendor_survey: vendorSurvey || null,
        email_type: emailType || null,
        distribution_type: distributionType || null,
        pinrich: pinrich || null,
        owned_home_hearing: ownedHomeHearing || null,
        owned_home_hearing_inquiry: ownedHomeHearingInquiry || null,
        owned_home_hearing_result: ownedHomeHearingResult || null,
        valuation_required: valuationRequired || null,
        next_call_date: nextCallDate || null,
        // その他
        special_notes: specialNotes || null,
        message_to_assignee: messageToAssignee || null,
        confirmation_to_assignee: confirmationToAssignee || null,
        family_composition: familyComposition || null,
        must_have_points: mustHavePoints || null,
        liked_points: likedPoints || null,
        disliked_points: dislikedPoints || null,
        purchase_obstacles: purchaseObstacles || null,
        next_action: nextAction || null,
      };

      const response = await api.post('/api/buyers', buyerData);
      const createdBuyerNumber = response.data.buyer_number || nextBuyerNumber;
      setRegisteredBuyerNumber(createdBuyerNumber);
      // 登録後アクションがある場合は即遷移
      if (postRegistrationAction) {
        navigate(`/buyers/${createdBuyerNumber}/${postRegistrationAction}`);
        return;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '買主の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => {
            if (propertyNumberField) {
              navigate(`/property-listings/${propertyNumberField}`);
            } else {
              navigate('/buyers');
            }
          }}
          sx={{ mb: 2 }}
        >
          {propertyNumberField ? '物件詳細に戻る' : '買主リストに戻る'}
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h5" fontWeight="bold">新規買主登録</Typography>
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => document.getElementById('section-desired-conditions')?.scrollIntoView({ behavior: 'smooth' })}
          >
            希望条件
          </Button>
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => document.getElementById('section-viewing')?.scrollIntoView({ behavior: 'smooth' })}
          >
            内覧
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 登録完了後のボタン表示 */}
      {registeredBuyerNumber && (
        <Box sx={{ mb: 3, p: 3, bgcolor: 'success.light', borderRadius: 2 }}>
          <Typography variant="h6" color="success.dark" gutterBottom>
            ✅ 買主番号 {registeredBuyerNumber} を登録しました
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            <Button
              variant="outlined"
              color="success"
              size="small"
              onClick={() => navigate(`/buyers/${registeredBuyerNumber}/desired-conditions`)}
            >
              希望条件
            </Button>
            <Button
              variant="outlined"
              color="success"
              size="small"
              onClick={() => navigate(`/buyers/${registeredBuyerNumber}/viewing-result`)}
            >
              内覧
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate(`/buyers/${registeredBuyerNumber}`)}
            >
              買主詳細を見る
            </Button>
            {propertyNumberField && (
              <Button
                variant="outlined"
                onClick={() => navigate(`/property-listings/${propertyNumberField}`)}
              >
                物件詳細に戻る
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={() => navigate('/buyers')}
            >
              買主リストに戻る
            </Button>
          </Box>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* 左側: 物件情報 */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, position: 'sticky', top: 16 }}>
            {/* 買付状況バッジ - 物件情報エリアの最上部に表示 */}
            <PurchaseStatusBadge
              statusText={getPurchaseStatusText(latestStatus, propertyInfo?.offer_status)}
            />
            <Typography variant="h6" gutterBottom>物件情報</Typography>
            
            {/* 物件詳細リンクボタン */}
            {propertyInfo && !loadingProperty && propertyNumberField && (
              <Button
                variant="outlined"
                size="small"
                fullWidth
                startIcon={<OpenInNew />}
                component="a"
                href={`/property-listings/${propertyInfo.property_number}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="物件詳細を新しいタブで開く"
                sx={{ mb: 2 }}
              >
                物件詳細を見る
              </Button>
            )}
            
            <TextField
              fullWidth
              label="物件番号"
              value={propertyNumberField}
              onChange={(e) => {
                setPropertyNumberField(e.target.value);
                if (e.target.value) {
                  fetchPropertyInfo(e.target.value);
                } else {
                  setPropertyInfo(null);
                }
              }}
              sx={{ mb: 2 }}
            />

            {loadingProperty && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={32} />
              </Box>
            )}

            {propertyInfo && !loadingProperty && (
              <Box>
                {/* 業者への対応日付表示（今日より後の場合のみ） */}
                {propertyInfo.broker_response && (() => {
                  try {
                    let brokerDateValue = propertyInfo.broker_response;

                    // Excelシリアル値の場合は変換
                    if (typeof brokerDateValue === 'number' || !isNaN(Number(brokerDateValue))) {
                      const serialNumber = Number(brokerDateValue);
                      const excelEpoch = new Date(1900, 0, 1);
                      const daysOffset = serialNumber - 2; // Excelの1900年うるう年バグ対応
                      brokerDateValue = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    }

                    // 東京時間で今日の日付を取得
                    const now = new Date();
                    const tokyoNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
                    const tokyoToday = new Date(tokyoNow.getFullYear(), tokyoNow.getMonth(), tokyoNow.getDate());

                    const brokerDate = new Date(brokerDateValue);
                    const tokyoBrokerDate = new Date(brokerDate.getFullYear(), brokerDate.getMonth(), brokerDate.getDate());

                    // 今日より後の日付の場合のみ表示
                    if (tokyoBrokerDate > tokyoToday) {
                      const formattedDate = `${tokyoBrokerDate.getFullYear()}/${String(tokyoBrokerDate.getMonth() + 1).padStart(2, '0')}/${String(tokyoBrokerDate.getDate()).padStart(2, '0')}`;
                      return (
                        <Box
                          sx={{
                            mb: 3,
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
                      );
                    }
                  } catch (error) {
                    console.error('Failed to parse broker_response date:', error);
                  }
                  return null;
                })()}

                {/* 特記・備忘録 - 最上部に配置 */}
                {(propertyInfo.special_notes || propertyInfo.memo) && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: '#fff9e6', borderRadius: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold" color="warning.dark" gutterBottom>
                      ⚠️ 特記・備忘録
                    </Typography>
                    {propertyInfo.special_notes && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">特記</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {propertyInfo.special_notes}
                        </Typography>
                      </Box>
                    )}
                    {propertyInfo.memo && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">備忘録</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {propertyInfo.memo}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}

                {/* 内覧前伝達事項 - 2番目に重要 */}
                {propertyInfo.pre_viewing_notes && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: '#e8f5e9', borderRadius: 1, border: '2px solid #2e7d32' }}>
                    <Typography variant="subtitle2" fontWeight="bold" color="primary.main" gutterBottom>
                      📋 内覧前伝達事項
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {propertyInfo.pre_viewing_notes}
                    </Typography>
                  </Box>
                )}

                {/* 内覧情報 - 3番目に重要 */}
                {(propertyInfo.viewing_key || propertyInfo.viewing_parking || propertyInfo.viewing_notes) && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      🔑 内覧情報
                    </Typography>
                    <Grid container spacing={1}>
                      {propertyInfo.viewing_key && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">内覧時（鍵等）</Typography>
                          <Typography variant="body2">{propertyInfo.viewing_key}</Typography>
                        </Grid>
                      )}
                      {propertyInfo.viewing_parking && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">内覧時駐車場</Typography>
                          <Typography variant="body2">{propertyInfo.viewing_parking}</Typography>
                        </Grid>
                      )}
                      {propertyInfo.viewing_notes && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">内覧の時の伝達事項</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {propertyInfo.viewing_notes}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                )}

                {/* 基本情報 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>基本情報</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">住所</Typography>
                      <Typography variant="body2" fontWeight="bold">{propertyInfo.address || '-'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">物件種別</Typography>
                      <Typography variant="body2">{propertyInfo.property_type || '-'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">間取り</Typography>
                      <Typography variant="body2">{propertyInfo.floor_plan || '-'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">価格</Typography>
                      <Typography variant="body2" fontWeight="bold" color="primary.main">
                        {propertyInfo.sales_price ? `${propertyInfo.sales_price.toLocaleString()}万円` : '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">現況</Typography>
                      <Typography variant="body2">{propertyInfo.current_status || '-'}</Typography>
                    </Grid>
                  </Grid>
                </Box>

                {/* よく聞かれる項目 */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>よく聞かれる項目</Typography>
                  <Grid container spacing={2}>
                    {propertyInfo.property_tax && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">固定資産税</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {propertyInfo.property_tax.toLocaleString()}円
                        </Typography>
                      </Grid>
                    )}
                    {propertyInfo.management_fee && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">管理費</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {propertyInfo.management_fee.toLocaleString()}円
                        </Typography>
                      </Grid>
                    )}
                    {propertyInfo.reserve_fund && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">積立金</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {propertyInfo.reserve_fund.toLocaleString()}円
                        </Typography>
                      </Grid>
                    )}
                    {propertyInfo.parking && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">駐車場</Typography>
                        <Typography variant="body2">{propertyInfo.parking}</Typography>
                        {propertyInfo.parking_fee && (
                          <Typography variant="caption" color="text.secondary">
                            ({propertyInfo.parking_fee.toLocaleString()}円)
                          </Typography>
                        )}
                      </Grid>
                    )}
                    {propertyInfo.delivery && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">引渡し</Typography>
                        <Typography variant="body2">{propertyInfo.delivery}</Typography>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              </Box>
            )}

            {!propertyInfo && !loadingProperty && propertyNumberField && (
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">物件情報が見つかりませんでした</Typography>
              </Box>
            )}

            {!propertyNumberField && (
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">物件番号を入力すると物件情報が表示されます</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* 右側: 買主入力フォーム */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                {/* 基本情報 */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>基本情報</Typography>
                </Grid>

                {/* 売主コピー */}
                <Grid item xs={12}>
                  <Autocomplete
                    options={sellerCopyOptions}
                    getOptionLabel={(option) => `${option.sellerNumber} - ${option.name}`}
                    loading={sellerCopyLoading}
                    inputValue={sellerCopyInput}
                    onInputChange={(_event, value) => {
                      setSellerCopyInput(value);
                      handleSellerCopySearch(value);
                    }}
                    onChange={(_event, value) => handleSellerCopySelect(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="売主コピー（既存の売主番号を入力して情報をコピー）"
                        placeholder="例: AA910"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {sellerCopyLoading ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    noOptionsText={sellerCopyLoading ? '検索中...' : '該当する売主が見つかりません'}
                    isOptionEqualToValue={(option, value) => option.sellerNumber === value.sellerNumber}
                  />
                </Grid>

                {/* 買主コピー */}
                <Grid item xs={12}>
                  <Autocomplete
                    options={buyerCopyOptions}
                    getOptionLabel={(option) => `${option.buyer_number} - ${option.name}`}
                    loading={buyerCopyLoading}
                    inputValue={buyerCopyInput}
                    onInputChange={(_event, value) => {
                      setBuyerCopyInput(value);
                      handleBuyerCopySearch(value);
                    }}
                    onChange={(_event, value) => handleBuyerCopySelect(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="買主コピー（既存の買主番号を入力して情報をコピー）"
                        placeholder="例: 2051"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {buyerCopyLoading ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    noOptionsText={buyerCopyLoading ? '検索中...' : '該当する買主が見つかりません'}
                    isOptionEqualToValue={(option, value) => option.buyer_number === value.buyer_number}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="買主番号（自動採番）"
                    value={nextBuyerNumber || '取得中...'}
                    InputProps={{ readOnly: true }}
                    sx={{ bgcolor: '#f5f5f5' }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} />

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="氏名・会社名"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="電話番号"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="メールアドレス"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="法人名"
                    value={companyName}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setCompanyName(newValue);
                      // 法人名がクリアされた場合は業者問合せをリセット
                      if (!newValue.trim()) {
                        setBrokerInquiry('');
                      }
                    }}
                    placeholder="法人の場合は会社名を入力"
                  />
                </Grid>

                {showBrokerInquiry(companyName) && (
                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        業者問合せ <span style={{ color: 'red' }}>*</span>
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {['業者問合せ', '業者（両手）'].map((option) => (
                          <Chip
                            key={option}
                            label={option}
                            onClick={() => {
                              const newVal = brokerInquiry === option ? '' : option;
                              setBrokerInquiry(newVal);
                              // 業者問合せ選択時は配信メールを「不要」に自動セット
                              if (newVal === '業者問合せ') {
                                setDistributionType('不要');
                              }
                            }}
                            color={brokerInquiry === option ? 'primary' : 'default'}
                            variant={brokerInquiry === option ? 'filled' : 'outlined'}
                            sx={{ cursor: 'pointer', fontWeight: brokerInquiry === option ? 'bold' : 'normal' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  </Grid>
                )}

﻿                {/* 問合せ情報 */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>問合せ情報</Typography>
                </Grid>

                {/* inquiry_hearing: multiline */}
                <Grid item xs={12}>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      問合時ヒアリング
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {[
                        { label: '初見か', text: '初見か：' },
                        { label: '希望時期', text: '希望時期：' },
                        { label: '駐車場希望台数', text: '駐車場希望台数：' },
                        { label: 'リフォーム予算', text: 'リフォーム込みの予算（最高額）：' },
                        { label: '持ち家か', text: '持ち家か：' },
                        { label: '他物件', text: '他に気になる物件はあるか？：' },
                      ].map((item) => (
                        <Chip
                          key={item.label}
                          label={item.label}
                          size="small"
                          onClick={() => setInquiryHearing((prev) => prev ? prev + '\n' + item.text : item.text)}
                          variant="outlined"
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      value={inquiryHearing}
                      onChange={(e) => setInquiryHearing(e.target.value)}
                      placeholder="ヒアリング内容を入力してください"
                    />
                  </Box>
                </Grid>

                {/* initial_assignee: 必須・赤枚 */}
                <Grid item xs={12}>
                  <Box sx={{
                    border: !initialAssignee ? '2px solid #f44336' : 'none',
                    borderRadius: !initialAssignee ? 1 : 0,
                    p: !initialAssignee ? 0.5 : 0,
                    bgcolor: !initialAssignee ? 'rgba(244,67,54,0.05)' : 'transparent',
                  }}>
                    <Typography variant="caption" color={!initialAssignee ? 'error' : 'text.secondary'} sx={{ display: 'block', mb: 0.5, fontWeight: !initialAssignee ? 'bold' : 'normal' }}>
                      初動担当{!initialAssignee ? ' *' : ''}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {normalInitials.map((initial) => (
                        <Button
                          key={initial}
                          size="small"
                          variant={initialAssignee === initial ? 'contained' : 'outlined'}
                          color="primary"
                          onClick={() => setInitialAssignee(initialAssignee === initial ? '' : initial)}
                          sx={{ minWidth: 40, px: 1.5, py: 0.5, fontWeight: initialAssignee === initial ? 'bold' : 'normal', borderRadius: 1 }}
                        >
                          {initial}
                        </Button>
                      ))}
                    </Box>
                  </Box>
                </Grid>

                {/* reception_date: date input */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="受付日"
                    type="date"
                    value={receptionDate}
                    onChange={(e) => setReceptionDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    helperText="自動で今日の日付が入力されます"
                  />
                </Grid>

                {/* inquiry_source: Autocomplete（必須） */}
                <Grid item xs={12} sm={6}>
                  <Box sx={{
                    border: !inquirySource ? '2px solid #f44336' : 'none',
                    borderRadius: !inquirySource ? 1 : 0,
                    p: !inquirySource ? 0.5 : 0,
                    bgcolor: !inquirySource ? 'rgba(244,67,54,0.05)' : 'transparent',
                  }}>
                    {!inquirySource && (
                      <Typography variant="caption" color="error" sx={{ fontWeight: 'bold', display: 'block', mb: 0.25 }}>
                        問合せ元 *
                      </Typography>
                    )}
                    <Autocomplete
                      fullWidth
                      options={INQUIRY_SOURCE_OPTIONS}
                      groupBy={(option) => option.category}
                      getOptionLabel={(option) => option.label}
                      value={INQUIRY_SOURCE_OPTIONS.find(opt => opt.value === inquirySource) || null}
                      onChange={(_, newValue) => setInquirySource(newValue?.value || '')}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={!inquirySource ? '' : '問合せ元'}
                        />
                      )}
                    />
                  </Box>
                </Grid>

                {/* latest_status: Autocomplete（必須） */}
                <Grid item xs={12}>
                  <Box sx={{
                    border: !latestStatus ? '2px solid #f44336' : 'none',
                    borderRadius: !latestStatus ? 1 : 0,
                    p: !latestStatus ? 0.5 : 0,
                    bgcolor: !latestStatus ? 'rgba(244,67,54,0.05)' : 'transparent',
                  }}>
                    {!latestStatus && (
                      <Typography variant="caption" color="error" sx={{ fontWeight: 'bold', display: 'block', mb: 0.25 }}>
                        ★最新状況 *
                      </Typography>
                    )}
                    <Autocomplete
                      fullWidth
                      options={LATEST_STATUS_OPTIONS}
                      getOptionLabel={(option) => option.label}
                      value={LATEST_STATUS_OPTIONS.find(opt => opt.value === latestStatus) || null}
                      onChange={(_, newValue) => setLatestStatus(newValue?.value || '')}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={!latestStatus ? '' : '★最新状況'}
                        />
                      )}
                    />
                  </Box>
                </Grid>

                {/* distribution_type: buttonSelect（必須） */}
                <Grid item xs={12} sm={6}>
                  {!distributionType && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
                      ⚠ 配信メール（必須）
                    </Typography>
                  )}
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    border: !distributionType ? '2px solid #f44336' : 'none',
                    borderRadius: !distributionType ? 1 : 0,
                    p: !distributionType ? 0.5 : 0,
                    bgcolor: !distributionType ? 'rgba(244,67,54,0.05)' : 'transparent',
                  }}>
                    <Typography variant="caption" color={!distributionType ? 'error' : 'text.secondary'} sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: !distributionType ? 'bold' : 'normal' }}>
                      配信メール{!distributionType ? ' *' : ''}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                      {DISTRIBUTION_TYPE_OPTIONS.map((opt) => {
                        const isSelected = distributionType === opt.value;
                        return (
                          <Button
                            key={opt.value}
                            size="small"
                            variant={isSelected ? 'contained' : 'outlined'}
                            color="primary"
                            onClick={() => setDistributionType(isSelected ? '' : opt.value)}
                            sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                          >
                            {opt.label}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                </Grid>

                {/* pinrich: dropdown */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Pinrich</InputLabel>
                    <Select
                      value={pinrich}
                      label="Pinrich"
                      onChange={(e) => setPinrich(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {['配信中', 'クローズ', '登録不要（不可）', '500万以上の設定済み', '配信拒否（顧客より）', '登録無し', '2件目以降', '受信エラー'].map((opt) => (
                        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* inquiry_email_phone: inquiry_sourceに「電話」が含まれる場合は非表示 */}
                {!inquirySource.includes('電話') && (
                  <Grid item xs={12}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      border: (inquirySource.includes('メール') && !inquiryEmailPhone) ? '2px solid #f44336' : 'none',
                      borderRadius: (inquirySource.includes('メール') && !inquiryEmailPhone) ? 1 : 0,
                      p: (inquirySource.includes('メール') && !inquiryEmailPhone) ? 0.5 : 0,
                      bgcolor: (inquirySource.includes('メール') && !inquiryEmailPhone) ? 'rgba(244,67,54,0.05)' : 'transparent',
                    }}>
                      <Typography variant="caption" color={(inquirySource.includes('メール') && !inquiryEmailPhone) ? 'error' : 'text.secondary'} sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: (inquirySource.includes('メール') && !inquiryEmailPhone) ? 'bold' : 'normal' }}>
                        』問合メール『電話対応{(inquirySource.includes('メール') && !inquiryEmailPhone) ? ' *' : ''}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                        {['済', '未', '不通', '電話番号なし', '不要'].map((opt) => {
                          const isSelected = inquiryEmailPhone === opt;
                          return (
                            <Button
                              key={opt}
                              size="small"
                              variant={isSelected ? 'contained' : 'outlined'}
                              color={opt === '済' ? 'success' : opt === '未' ? 'error' : 'primary'}
                              onClick={() => setInquiryEmailPhone(isSelected ? '' : opt)}
                              sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                            >
                              {opt}
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  </Grid>
                )}

                {/* three_calls_confirmed: inquiry_email_phoneに値がない場合は非表示 */}
                {inquiryEmailPhone && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                        3回架電確認済み
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                        {['3回架電OK', '3回架電未', '他'].map((opt) => {
                          const isSelected = threeCallsConfirmed === opt;
                          return (
                            <Button
                              key={opt}
                              size="small"
                              variant={isSelected ? 'contained' : 'outlined'}
                              color="primary"
                              onClick={() => setThreeCallsConfirmed(isSelected ? '' : opt)}
                              sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                            >
                              {opt}
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  </Grid>
                )}

                {/* next_call_date: date input */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="次電日"
                    type="date"
                    value={nextCallDate}
                    onChange={(e) => setNextCallDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* 希望条件 */}
                <Grid item xs={12}>
                  <Typography id="section-desired-conditions" variant="h6" gutterBottom sx={{ mt: 2 }}>希望条件</Typography>
                </Grid>

                {/* エリア（複数選択） */}
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    ★エリア（複数選択可）
                  </Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      multiple
                      value={desiredArea}
                      onChange={(e) => setDesiredArea(e.target.value as string[])}
                      input={<OutlinedInput />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((val) => {
                            const opt = AREA_OPTIONS.find((o) => o.value === val);
                            return (
                              <Chip
                                key={val}
                                label={opt ? opt.label : val}
                                size="small"
                                onDelete={(e) => {
                                  e.stopPropagation();
                                  setDesiredArea(desiredArea.filter((v) => v !== val));
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                              />
                            );
                          })}
                        </Box>
                      )}
                      MenuProps={{ PaperProps: { style: { maxHeight: 400 } } }}
                    >
                      {AREA_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value} dense>
                          <Checkbox size="small" checked={desiredArea.includes(opt.value)} sx={{ p: 0, mr: 1 }} />
                          <Typography variant="body2">{opt.label}</Typography>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>★希望種別</InputLabel>
                    <Select
                      value={desiredPropertyType}
                      label="★希望種別"
                      onChange={(e) => setDesiredPropertyType(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {DESIRED_PROPERTY_TYPE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>★築年数</InputLabel>
                    <Select
                      value={desiredBuildingAge}
                      label="★築年数"
                      onChange={(e) => setDesiredBuildingAge(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {BUILDING_AGE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>★間取り</InputLabel>
                    <Select
                      value={desiredFloorPlan}
                      label="★間取り"
                      onChange={(e) => setDesiredFloorPlan(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {FLOOR_PLAN_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="予算"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="例: 3000万円"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>価格帯（戸建）</InputLabel>
                    <Select
                      value={priceRangeHouse}
                      label="価格帯（戸建）"
                      onChange={(e) => setPriceRangeHouse(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {PRICE_RANGE_DETACHED_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>価格帯（マンション）</InputLabel>
                    <Select
                      value={priceRangeApartment}
                      label="価格帯（マンション）"
                      onChange={(e) => setPriceRangeApartment(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {PRICE_RANGE_MANSION_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>価格帯（土地）</InputLabel>
                    <Select
                      value={priceRangeLand}
                      label="価格帯（土地）"
                      onChange={(e) => setPriceRangeLand(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {PRICE_RANGE_LAND_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>●P台数</InputLabel>
                    <Select
                      value={parkingSpaces}
                      label="●P台数"
                      onChange={(e) => setParkingSpaces(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {PARKING_SPACES_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* 内覧情報 */}
                <Grid item xs={12}>
                  <Typography id="section-viewing" variant="h6" gutterBottom sx={{ mt: 2 }}>内覧情報（任意）</Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="内覧日"
                    type="date"
                    value={viewingDate}
                    onChange={(e) => setLatestViewingDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="内覧時間"
                    value={viewingTime}
                    onChange={(e) => setViewingTime(e.target.value)}
                    placeholder="例: 14:00"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    後続担当
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {normalInitials.map((initial) => (
                      <Chip
                        key={initial}
                        label={initial}
                        size="small"
                        onClick={() => setFollowUpAssignee(followUpAssignee === initial ? '' : initial)}
                        color={followUpAssignee === initial ? 'success' : 'default'}
                        variant={followUpAssignee === initial ? 'filled' : 'outlined'}
                        sx={{ cursor: 'pointer', fontWeight: followUpAssignee === initial ? 'bold' : 'normal' }}
                      />
                    ))}
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="内覧結果・後続対応"
                    multiline
                    rows={3}
                    value={viewingResultFollowUp}
                    onChange={(e) => setViewingResultFollowUp(e.target.value)}
                    placeholder="内覧結果や後続対応の内容を入力してください"
                  />
                </Grid>

                {/* その他 */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>その他</Typography>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="特記事項"
                    multiline
                    rows={3}
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="担当への伝言/質問事項"
                    multiline
                    rows={2}
                    value={messageToAssignee}
                    onChange={(e) => setMessageToAssignee(e.target.value)}
                  />
                  {/* 入力があれば担当へCHAT送信ボタンを表示 */}
                  {messageToAssignee.trim() && propertyNumberField && (
                    <Button
                      variant="contained"
                      size="small"
                      disabled={chatSending}
                      onClick={async () => {
                        setChatSending(true);
                        try {
                          await api.post(`/api/property-listings/${propertyNumberField}/send-chat-to-assignee`, {
                            message: messageToAssignee,
                            senderName: '新規登録',
                          });
                          setChatSent(true);
                          setTimeout(() => setChatSent(false), 3000);
                        } catch (err) {
                          console.error('チャット送信失敗:', err);
                        } finally {
                          setChatSending(false);
                        }
                      }}
                      sx={{ mt: 1, bgcolor: '#7b1fa2', '&:hover': { bgcolor: '#4a148c' } }}
                    >
                      {chatSending ? '送信中...' : chatSent ? '✅ 送信済み' : '担当へCHAT送信'}
                    </Button>
                  )}
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="家族構成"
                    value={familyComposition}
                    onChange={(e) => setFamilyComposition(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="譲れない点"
                    value={mustHavePoints}
                    onChange={(e) => setMustHavePoints(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="気に入っている点"
                    value={likedPoints}
                    onChange={(e) => setLikedPoints(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="ダメな点"
                    value={dislikedPoints}
                    onChange={(e) => setDislikedPoints(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="購入時障害となる点"
                    value={purchaseObstacles}
                    onChange={(e) => setPurchaseObstacles(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="次のアクション"
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                  />
                </Grid>

                {/* ボタン */}
                <Grid item xs={12}>
                  {!registeredBuyerNumber ? (
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            if (propertyNumberField) {
                              navigate(`/property-listings/${propertyNumberField}`);
                            } else {
                              navigate('/buyers');
                            }
                          }}
                          disabled={loading}
                        >
                          キャンセル
                        </Button>
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={loading}
                        >
                          {loading ? '登録中...' : '登録'}
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                      <Typography variant="subtitle1" color="success.dark" fontWeight="bold" gutterBottom>
                        ✅ 買主番号 {registeredBuyerNumber} を登録しました
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
                        <Button
                          variant="outlined"
                          color="success"
                          size="small"
                          onClick={() => navigate(`/buyers/${registeredBuyerNumber}/desired-conditions`)}
                        >
                          希望条件
                        </Button>
                        <Button
                          variant="outlined"
                          color="success"
                          size="small"
                          onClick={() => navigate(`/buyers/${registeredBuyerNumber}/viewing-result`)}
                        >
                          内覧
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => navigate(`/buyers/${registeredBuyerNumber}`)}
                        >
                          買主詳細を見る
                        </Button>
                        {propertyNumberField && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => navigate(`/property-listings/${propertyNumberField}`)}
                          >
                            物件詳細に戻る
                          </Button>
                        )}
                      </Box>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </form>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
