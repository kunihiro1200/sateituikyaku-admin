import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  Checkbox,
  FormControlLabel,
  Autocomplete,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  CalendarToday,
} from '@mui/icons-material';
import api from '../services/api';
import RichTextCommentEditor, { RichTextCommentEditorHandle } from '../components/RichTextCommentEditor';
import { useRef, useEffect } from 'react';
import { getActiveEmployees, Employee } from '../services/employeeService';

const propertyTypes = [
  { value: 'detached_house', label: '戸建て' },
  { value: 'apartment', label: 'マンション' },
  { value: 'land', label: '土地' },
  { value: 'commercial', label: '商業用' },
];

const prefectures = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

const structures = [
  { value: '木造', label: '木造' },
  { value: '軽量鉄骨', label: '軽量鉄骨' },
  { value: '鉄骨', label: '鉄骨' },
  { value: 'RC', label: 'RC' },
  { value: 'SRC', label: 'SRC' },
  { value: '他', label: '他' },
];

const sellerSituations = [
  { value: '居住中', label: '居住中' },
  { value: '空き家', label: '空き家' },
  { value: '賃貸中', label: '賃貸中' },
  { value: '古屋あり', label: '古屋あり' },
  { value: '更地', label: '更地' },
];

const valuationMethods = [
  { value: '机上査定メール', label: '机上査定メール' },
  { value: '郵送', label: '郵送' },
  { value: '不通', label: '不通' },
];

const contactMethods = [
  { value: 'Email', label: 'Email' },
  { value: 'Smail', label: 'Smail' },
  { value: '電話', label: '電話' },
];

const siteOptions = [
  'ウ',
  'ビ',
  'H',
  'お',
  'Y',
  'す',
  'a',
  'L',
  'エ',
  '近所',
  'チ',
  'P',
  '紹',
  'リ',
  '買',
  'HP',
  '知合',
  'at-homeの掲載を見て',
  '2件目以降査定'
];

export default function NewSellerPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  // 売主番号（自動採番）
  const [sellerNumber, setSellerNumber] = useState('');
  const [sellerNumberLoading, setSellerNumberLoading] = useState(false);

  // 売主コピー
  const [sellerCopyInput, setSellerCopyInput] = useState('');
  const [sellerCopyOptions, setSellerCopyOptions] = useState<Array<{sellerNumber: string; name: string; id: string}>>([]);
  const [sellerCopyLoading, setSellerCopyLoading] = useState(false);
  const [nextCallDateConfirmOpen, setNextCallDateConfirmOpen] = useState(false);

  // 社員リスト
  const [employees, setEmployees] = useState<Employee[]>([]);

  // コメント
  const [comments, setComments] = useState('');
  const [savingComments, setSavingComments] = useState(false);
  const commentEditorRef = useRef<RichTextCommentEditorHandle>(null);

  // 買主コピー
  const [buyerCopyInput, setBuyerCopyInput] = useState('');
  const [buyerCopyOptions, setBuyerCopyOptions] = useState<Array<{buyer_number: string; name: string}>>([]);
  const [buyerCopyLoading, setBuyerCopyLoading] = useState(false);

  // 売主情報
  const [name, setName] = useState('');
  const [requestorAddress, setRequestorAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');

  // 反響情報
  const [inquiryYear, setInquiryYear] = useState(new Date().getFullYear().toString());
  const [inquiryDate, setInquiryDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [inquiryDetailedDateTime, setInquiryDetailedDateTime] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [site, setSite] = useState('');
  const [inquiryReason, setInquiryReason] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [numberOfCompanies, setNumberOfCompanies] = useState('');

  // 物件情報
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [landArea, setLandArea] = useState('');
  const [buildingArea, setBuildingArea] = useState('');
  const [landAreaVerified, setLandAreaVerified] = useState('');
  const [buildingAreaVerified, setBuildingAreaVerified] = useState('');
  const [buildYear, setBuildYear] = useState('');
  const [structure, setStructure] = useState('');
  const [floorPlan, setFloorPlan] = useState('');
  const [sellerSituation, setSellerSituation] = useState('');
  const [propertyAddressForIeulMansion, setPropertyAddressForIeulMansion] = useState('');
  const [floors, setFloors] = useState('');
  const [parking, setParking] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');

  // 査定情報
  const [valuationAmount1, setValuationAmount1] = useState('');
  const [valuationAmount2, setValuationAmount2] = useState('');
  const [valuationAmount3, setValuationAmount3] = useState('');
  const [valuationMethod, setValuationMethod] = useState('');
  const [valuationAssignee, setValuationAssignee] = useState('');
  const [fixedAssetTaxRoadPrice, setFixedAssetTaxRoadPrice] = useState('');

  // 追客情報
  const [nextCallDate, setNextCallDate] = useState('');
  const [contactMethod, setContactMethod] = useState('');
  const [preferredContactTime, setPreferredContactTime] = useState('');

  // 訪問査定情報
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [visitAssignee, setVisitAssignee] = useState('');
  const [visitNotes, setVisitNotes] = useState('');

  // ステータス情報
  const [status, setStatus] = useState('追客中');
  const [confidence, setConfidence] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // 競合情報
  const [competitorName, setCompetitorName] = useState('');
  const [exclusiveOtherDecisionFactor, setExclusiveOtherDecisionFactor] = useState('');
  const [otherDecisionCountermeasure, setOtherDecisionCountermeasure] = useState('');
  const [contractYearMonth, setContractYearMonth] = useState('');
  const [exclusiveOtherDecisionMeeting, setExclusiveOtherDecisionMeeting] = useState('');

  // Pinrich情報
  const [pinrichStatus, setPinrichStatus] = useState('登録不要');

  // 除外管理
  const [exclusionSite, setExclusionSite] = useState('');
  const [exclusionCriteria, setExclusionCriteria] = useState('');
  const [exclusionDate, setExclusionDate] = useState('');
  const [exclusionAction, setExclusionAction] = useState('');

  // その他情報
  const [cancelNoticeAssignee, setCancelNoticeAssignee] = useState('');
  const [exclusiveScript, setExclusiveScript] = useState('');
  const [priceLossListEntered, setPriceLossListEntered] = useState(false);
  const [companyIntroduction, setCompanyIntroduction] = useState('');
  const [propertyIntroduction, setPropertyIntroduction] = useState('');

  // 売主番号取得
  useEffect(() => {
    const fetchNextSellerNumber = async () => {
      setSellerNumberLoading(true);
      try {
        const response = await api.get('/api/sellers/next-seller-number');
        setSellerNumber(response.data.sellerNumber);
      } catch (err) {
        console.error('Failed to fetch next seller number:', err);
        setError('売主番号の取得に失敗しました');
      } finally {
        setSellerNumberLoading(false);
      }
    };
    fetchNextSellerNumber();
  }, []);

  // 社員リストを取得
  useEffect(() => {
    getActiveEmployees().then(setEmployees).catch(console.error);
  }, []);

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
      if (seller.address) setRequestorAddress(seller.address);
      if (seller.phoneNumber) setPhoneNumber(seller.phoneNumber);
      if (seller.email) setEmail(seller.email);
      // 売主コピー時はサイトを「2件目以降査定」にデフォルト設定
      setSite('2件目以降査定');
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
    } catch (err) {
      setError('買主情報の取得に失敗しました');
    }
  };

  // 重複チェック（一時的に無効化）
  useEffect(() => {
    const checkDuplicate = async () => {
      if (phoneNumber && phoneNumber.length >= 10) {
        try {
          // TODO: バックエンドのエンドポイントが実装されたら有効化
          // const response = await api.post('/sellers-management/check-duplicate', {
          //   phoneNumber,
          //   email: email || undefined,
          // });
          // if (response.data.hasDuplicates) {
          //   setDuplicateWarning(response.data);
          // } else {
          //   setDuplicateWarning(null);
          // }
        } catch (err) {
          console.error('Duplicate check failed:', err);
        }
      }
    };

    const timer = setTimeout(checkDuplicate, 500);
    return () => clearTimeout(timer);
  }, [phoneNumber, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 次電日未入力の場合は確認ダイアログを表示
    if (!nextCallDate && !nextCallDateConfirmOpen) {
      setNextCallDateConfirmOpen(true);
      return;
    }
    setNextCallDateConfirmOpen(false);

    // バリデーション
    if (!name || !phoneNumber) {
      setError('名前、電話番号は必須です');
      return;
    }

    if (!propertyAddress || !propertyType) {
      setError('物件の住所、種別は必須です');
      return;
    }

    if (!confidence) {
      setError('確度は必須です');
      return;
    }

    if (!site) {
      setError('サイトは必須です');
      return;
    }



    try {
      setLoading(true);

      const data = {
        name,
        address: requestorAddress || propertyAddress, // addressは必須なので、依頼者住所または物件住所を使用
        phoneNumber,
        sellerNumber: sellerNumber || undefined,
        email: email || undefined,
        
        // 反響情報
        inquiryYear: inquiryYear ? parseInt(inquiryYear) : undefined,
        inquiryDate: inquiryDate || undefined,
        inquiryDetailedDateTime: inquiryDetailedDateTime || undefined,
        site: site || undefined,
        inquiryReason: inquiryReason || undefined,
        siteUrl: siteUrl || undefined,
        numberOfCompanies: numberOfCompanies ? parseInt(numberOfCompanies) : undefined,
        
        // 査定情報
        valuationAmount1: valuationAmount1 ? parseFloat(valuationAmount1) : undefined,
        valuationAmount2: valuationAmount2 ? parseFloat(valuationAmount2) : undefined,
        valuationAmount3: valuationAmount3 ? parseFloat(valuationAmount3) : undefined,
        valuationMethod: valuationMethod || undefined,
        valuationAssignee: valuationAssignee || undefined,
        fixedAssetTaxRoadPrice: fixedAssetTaxRoadPrice ? parseFloat(fixedAssetTaxRoadPrice) : undefined,
        
        // 追客情報
        nextCallDate: nextCallDate || undefined,
        contactMethod: contactMethod || undefined,
        preferredContactTime: preferredContactTime || undefined,
        
        // 訪問査定情報
        visitDate: visitDate || undefined,
        visitTime: visitTime || undefined,
        visitAssignee: visitAssignee || undefined,
        visitNotes: visitNotes || undefined,
        
        // ステータス
        status: status || 'new',
        confidence: confidence || undefined,
        assignedTo: assignedTo || undefined,

        // コメント
        comments: comments || undefined,

        // 競合情報
        competitorName: competitorName || undefined,
        exclusiveOtherDecisionFactor: exclusiveOtherDecisionFactor || undefined,
        otherDecisionCountermeasure: otherDecisionCountermeasure || undefined,
        contractYearMonth: contractYearMonth || undefined,
        exclusiveOtherDecisionMeeting: exclusiveOtherDecisionMeeting || undefined,

        // Pinrich
        pinrichStatus: pinrichStatus || undefined,

        // 除外管理
        exclusionSite: exclusionSite || undefined,
        exclusionCriteria: exclusionCriteria || undefined,
        exclusionDate: exclusionDate || undefined,
        exclusionAction: exclusionAction || undefined,

        // その他
        cancelNoticeAssignee: cancelNoticeAssignee || undefined,
        exclusiveScript: exclusiveScript || undefined,
        priceLossListEntered: priceLossListEntered || undefined,
        companyIntroduction: companyIntroduction || undefined,
        propertyIntroduction: propertyIntroduction || undefined,
        
        property: {
          address: propertyAddress,
          propertyType,
          landArea: landArea ? parseFloat(landArea) : undefined,
          buildingArea: buildingArea ? parseFloat(buildingArea) : undefined,
          landAreaVerified: landAreaVerified ? parseFloat(landAreaVerified) : undefined,
          buildingAreaVerified: buildingAreaVerified ? parseFloat(buildingAreaVerified) : undefined,
          buildYear: buildYear ? parseInt(buildYear, 10) : undefined,
          structure: structure || undefined,
          floorPlan: floorPlan || undefined,
          sellerSituation: sellerSituation || undefined,
          propertyAddressForIeulMansion: propertyAddressForIeulMansion || undefined,
          floors: floors ? parseInt(floors, 10) : undefined,
          parking,
          additionalInfo: additionalInfo || undefined,
        },
      };

      await api.post('/api/sellers', data);
      navigate('/');
    } catch (err: any) {
      console.error('Failed to create seller:', err);
      setError(err.response?.data?.error?.message || '売主の登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          戻る
        </Button>

        <Typography variant="h4" component="h1" gutterBottom>
          売主新規登録
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {duplicateWarning && duplicateWarning.hasDuplicates && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              重複の可能性があります
            </Typography>
            {duplicateWarning.matches.map((match: any, index: number) => (
              <Box key={index} sx={{ mt: 1 }}>
                <Typography variant="body2">
                  {match.sellerInfo.name} - {match.sellerInfo.phoneNumber}
                  {match.sellerInfo.sellerNumber && ` (${match.sellerInfo.sellerNumber})`}
                </Typography>
              </Box>
            ))}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {/* 基本情報セクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              基本情報
            </Typography>
            <Grid container spacing={2}>
              {/* 1. 売主コピー */}
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
                    />
                  )}
                  noOptionsText="該当する売主が見つかりません"
                  isOptionEqualToValue={(option, value) => option.sellerNumber === value.sellerNumber}
                />
              </Grid>
              {/* 2. 買主コピー */}
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
                    />
                  )}
                  noOptionsText="該当する買主が見つかりません"
                  isOptionEqualToValue={(option, value) => option.buyer_number === value.buyer_number}
                />
              </Grid>
              {/* 3. 売主番号 */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="売主番号"
                  value={sellerNumber}
                  InputProps={{ readOnly: true }}
                  helperText={sellerNumberLoading ? '取得中...' : '自動採番されます'}
                  disabled={sellerNumberLoading}
                />
              </Grid>
              {/* 4. 名前 */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="名前"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Grid>
              {/* 5. 依頼者住所 */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="依頼者住所"
                  value={requestorAddress}
                  onChange={(e) => setRequestorAddress(e.target.value)}
                />
              </Grid>
              {/* 6. 電話番号 */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="電話番号"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="090-1234-5678"
                />
              </Grid>
              {/* 7. メールアドレス */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="メールアドレス"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* 反響情報セクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              反響情報
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="反響年"
                  type="number"
                  value={inquiryYear}
                  onChange={(e) => setInquiryYear(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="反響日付"
                  type="date"
                  value={inquiryDate}
                  onChange={(e) => setInquiryDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="反響詳細日時"
                  type="datetime-local"
                  value={inquiryDetailedDateTime}
                  onChange={(e) => setInquiryDetailedDateTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="サイト *"
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  required
                  error={!site}
                  helperText={!site ? 'サイトは必須です' : ''}
                >
                  <MenuItem value="">選択してください</MenuItem>
                  {siteOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="査定理由"
                  value={inquiryReason}
                  onChange={(e) => setInquiryReason(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="サイトURL"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="送信社数"
                  type="number"
                  value={numberOfCompanies}
                  onChange={(e) => setNumberOfCompanies(e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* 物件情報セクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              物件情報
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="物件所在地"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  select
                  label="物件種別"
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                >
                  {propertyTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="構造"
                  value={structure}
                  onChange={(e) => setStructure(e.target.value)}
                >
                  <MenuItem value="">選択なし</MenuItem>
                  {structures.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="土地面積（㎡）"
                  type="number"
                  value={landArea}
                  onChange={(e) => setLandArea(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="建物面積（㎡）"
                  type="number"
                  value={buildingArea}
                  onChange={(e) => setBuildingArea(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="土地（当社調べ）（㎡）"
                  type="number"
                  value={landAreaVerified}
                  onChange={(e) => setLandAreaVerified(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="建物（当社調べ）（㎡）"
                  type="number"
                  value={buildingAreaVerified}
                  onChange={(e) => setBuildingAreaVerified(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="間取り"
                  value={floorPlan}
                  onChange={(e) => setFloorPlan(e.target.value)}
                  placeholder="例: 3LDK"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="築年"
                  type="number"
                  value={buildYear}
                  onChange={(e) => setBuildYear(e.target.value)}
                  placeholder="2000"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="売主状況"
                  value={sellerSituation}
                  onChange={(e) => setSellerSituation(e.target.value)}
                >
                  <MenuItem value="">選択なし</MenuItem>
                  {sellerSituations.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="階数"
                  type="number"
                  value={floors}
                  onChange={(e) => setFloors(e.target.value)}
                />
              </Grid>
              {propertyType === 'apartment' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="イエウール・マンション専用住所"
                    value={propertyAddressForIeulMansion}
                    onChange={(e) => setPropertyAddressForIeulMansion(e.target.value)}
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={parking}
                      onChange={(e) => setParking(e.target.checked)}
                    />
                  }
                  label="駐車場あり"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="追加情報"
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* コメントセクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              コメント
            </Typography>
            <Box>
              <RichTextCommentEditor
                ref={commentEditorRef}
                value={comments}
                onChange={(html) => setComments(html)}
                placeholder="コメントを入力してください..."
              />
            </Box>
          </Paper>

          {/* ステータス情報セクション（コメントの直後） */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              ステータス情報
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>状況（当社）</InputLabel>
                  <Select
                    value={status}
                    label="状況（当社）"
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <MenuItem value="追客中">追客中</MenuItem>
                    <MenuItem value="追客不要(未訪問）">追客不要(未訪問）</MenuItem>
                    <MenuItem value="除外済追客不要">除外済追客不要</MenuItem>
                    <MenuItem value="除外後追客中">除外後追客中</MenuItem>
                    <MenuItem value="専任媒介">専任媒介</MenuItem>
                    <MenuItem value="一般媒介">一般媒介</MenuItem>
                    <MenuItem value="リースバック（専任）">リースバック（専任）</MenuItem>
                    <MenuItem value="他決→追客">他決→追客</MenuItem>
                    <MenuItem value="他決→追客不要">他決→追客不要</MenuItem>
                    <MenuItem value="他決→専任">他決→専任</MenuItem>
                    <MenuItem value="他決→一般">他決→一般</MenuItem>
                    <MenuItem value="専任→他社専任">専任→他社専任</MenuItem>
                    <MenuItem value="一般→他決">一般→他決</MenuItem>
                    <MenuItem value="他社買取">他社買取</MenuItem>
                    <MenuItem value="訪問後（担当付）追客不要">訪問後（担当付）追客不要</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!confidence}>
                  <InputLabel>確度 *</InputLabel>
                  <Select
                    value={confidence}
                    label="確度 *"
                    onChange={(e) => setConfidence(e.target.value)}
                  >
                    <MenuItem value="A">A（売る気あり）</MenuItem>
                    <MenuItem value="B">B（売る気あるがまだ先の話）</MenuItem>
                    <MenuItem value="B_PRIME">B'（売る気は全く無い）</MenuItem>
                    <MenuItem value="C">C（電話が繋がらない）</MenuItem>
                    <MenuItem value="D">D（再建築不可）</MenuItem>
                    <MenuItem value="E">E（収益物件）</MenuItem>
                    <MenuItem value="DUPLICATE">ダブり（重複している）</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="担当社員"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* 査定情報セクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              査定情報
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="査定額1（万円）"
                  type="number"
                  value={valuationAmount1}
                  onChange={(e) => setValuationAmount1(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="査定額2（万円）"
                  type="number"
                  value={valuationAmount2}
                  onChange={(e) => setValuationAmount2(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="査定額3（万円）"
                  type="number"
                  value={valuationAmount3}
                  onChange={(e) => setValuationAmount3(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="査定方法"
                  value={valuationMethod}
                  onChange={(e) => setValuationMethod(e.target.value)}
                >
                  <MenuItem value="">選択なし</MenuItem>
                  {valuationMethods.map((m) => (
                    <MenuItem key={m.value} value={m.value}>
                      {m.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="査定担当"
                  value={valuationAssignee}
                  onChange={(e) => setValuationAssignee(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="固定資産税路線価（円/㎡）"
                  type="number"
                  value={fixedAssetTaxRoadPrice}
                  onChange={(e) => setFixedAssetTaxRoadPrice(e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* 追客情報セクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              追客情報
            </Typography>
            <Grid container spacing={2}>
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
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="連絡方法"
                  value={contactMethod}
                  onChange={(e) => setContactMethod(e.target.value)}
                >
                  <MenuItem value="">選択なし</MenuItem>
                  {contactMethods.map((m) => (
                    <MenuItem key={m.value} value={m.value}>
                      {m.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="連絡取りやすい時間帯"
                  value={preferredContactTime}
                  onChange={(e) => setPreferredContactTime(e.target.value)}
                  placeholder="例: 平日18時以降"
                />
              </Grid>
            </Grid>
          </Paper>

          {/* 訪問査定情報セクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              訪問査定情報
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="訪問日"
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="訪問時間"
                  type="time"
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>営担</InputLabel>
                  <Select
                    value={visitAssignee}
                    label="営担"
                    onChange={(e) => setVisitAssignee(e.target.value)}
                  >
                    <MenuItem value=""><em>未選択</em></MenuItem>
                    {employees.map((emp) => {
                      const initials = (emp as any).initials || emp.name || emp.email;
                      return (
                        <MenuItem key={(emp as any).id} value={initials}>
                          {emp.name} ({initials})
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="訪問時注意点"
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                />
              </Grid>
              {true && (
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<CalendarToday />}
                    onClick={() => {
                      const dateStr = visitDate;
                      const timeStr = visitTime || '10:00';
                      const dateTimeStr = `${dateStr}T${timeStr}:00`;
                      const date = new Date(dateTimeStr);
                      const startDateStr = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                      const endDate = new Date(date.getTime() + 60 * 60 * 1000);
                      const endDateStr = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                      const propertyAddr = propertyAddress || '物件所在地未設定';
                      const title = encodeURIComponent(`【訪問】${propertyAddr}`);
                      const details = encodeURIComponent(
                        `売主名: ${name}\n` +
                        `住所: ${requestorAddress || propertyAddr}\n` +
                        `電話: ${phoneNumber}\n` +
                        `\n訪問時注意点: ${visitNotes || 'なし'}`
                      );
                      const location = encodeURIComponent(propertyAddr);
                      const assignedEmployee = employees.find(e =>
                        (e as any).initials === visitAssignee || e.name === visitAssignee
                      );
                      const assignedEmail = (assignedEmployee as any)?.email || '';
                      const srcParam = assignedEmail ? `&src=${encodeURIComponent(assignedEmail)}` : '';
                      window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateStr}/${endDateStr}&details=${details}&location=${location}${srcParam}`, '_blank');
                    }}
                  >
                    📅 Googleカレンダーに送信
                  </Button>
                </Grid>
              )}
            </Grid>
          </Paper>


          {/* 次電日未入力確認ダイアログ */}
          <Dialog open={nextCallDateConfirmOpen} onClose={() => setNextCallDateConfirmOpen(false)}>
            <DialogTitle>次電日が未入力です</DialogTitle>
            <DialogContent>
              <Typography>次電日が入力されていませんがよろしいですか？</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setNextCallDateConfirmOpen(false)}>戻る</Button>
              <Button
                variant="contained"
                onClick={async () => {
                  setNextCallDateConfirmOpen(false);
                  // フォームを直接送信
                  const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                  await handleSubmit(fakeEvent);
                }}
              >
                このまま登録する
              </Button>
            </DialogActions>
          </Dialog>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/')}
              disabled={loading}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !sellerNumber}
            >
              {loading ? '登録中...' : '登録'}
            </Button>
          </Box>
        </form>
      </Box>
    </Container>
  );
}
