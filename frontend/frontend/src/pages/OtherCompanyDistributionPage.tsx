import { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import {
  Email as EmailIcon,
  Image as ImageIcon,
  Folder as FolderIcon,
  CloudUpload as CloudUploadIcon,
  Link as LinkIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';
import ImageSelectorModal from '../components/ImageSelectorModal';

// 画像ファイル型（ImageSelectorModalと同じ）
interface ImageFile {
  id: string;
  name: string;
  source: 'drive' | 'local' | 'url';
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  previewUrl: string;
  driveFileId?: string;
  localFile?: File;
  url?: string;
}

interface Buyer {
  buyer_number: string;
  name: string;
  desired_area: string;
  desired_property_type: string;
  price_range_house: string | null;
  price_range_apartment: string | null;
  price_range_land: string | null;
  reception_date: string;
  phone_number: string;
  email: string;
  latest_status: string | null;
  inquiry_hearing: string | null;
}

// エリア選択肢（買主詳細画面と同じ形式）
const AREA_OPTIONS = [
  { value: '①中学校（王子、碩田学園、大分西）', label: '①中学校（王子、碩田学園、大分西）' },
  { value: '②中学校（滝尾、城東、原川）', label: '②中学校（滝尾、城東、原川）' },
  { value: '③中学校（明野、大東）', label: '③中学校（明野、大東）' },
  { value: '④中学校（東陽、鶴崎）', label: '④中学校（東陽、鶴崎）' },
  { value: '⑤中学校（大在、坂ノ市、鶴崎、佐賀関）', label: '⑤中学校（大在、坂ノ市、鶴崎、佐賀関）' },
  { value: '⑥中学校（南大分、城南、賀来）', label: '⑥中学校（南大分、城南、賀来）' },
  { value: '⑦中学校（植田、野津原）', label: '⑦中学校（植田、野津原）' },
  { value: '⑧中学校（判田、戸次、吉野、竹中）', label: '⑧中学校（判田、戸次、吉野、竹中）' },
  { value: '⑨青山中学校（南立石、堀田、扇山、荘園、鶴見７組、９組ルミエール除く）', label: '⑨青山中学校（南立石、堀田、扇山、荘園、鶴見７組、９組ルミエール除く）' },
  { value: '⑩中部中学校（東荘園、石垣東、北浜、京町、新港町）', label: '⑩中部中学校（東荘園、石垣東、北浜、京町、新港町）' },
  { value: '⑪北部中学校（亀川四の湯、亀川浜田町、大観山、上人本町、上人ケ浜）', label: '⑪北部中学校（亀川四の湯、亀川浜田町、大観山、上人本町、上人ケ浜）' },
  { value: '⑫朝日中学校（明礬、新別府、火売、北中、竹の内、大畑、朝日ケ丘）', label: '⑫朝日中学校（明礬、新別府、火売、北中、竹の内、大畑、朝日ケ丘）' },
  { value: '⑬東山中学校（東山、山の口）', label: '⑬東山中学校（東山、山の口）' },
  { value: '⑭鶴見台中学校（南須賀、石垣東、石垣西、中須賀元町）', label: '⑭鶴見台中学校（南須賀、石垣東、石垣西、中須賀元町）' },
  { value: '⑮別府西中学校（光町、中島町、青山町、立田町、浜脇、山家）', label: '⑮別府西中学校（光町、中島町、青山町、立田町、浜脇、山家）' },
  { value: '㊵大分', label: '㊵大分' },
  { value: '㊶別府', label: '㊶別府' },
  { value: '㊷別府駅周辺（中央町、駅前本町、上田の湯町、野口中町、西野口町、駅前町）', label: '㊷別府駅周辺（中央町、駅前本町、上田の湯町、野口中町、西野口町、駅前町）' },
  { value: '㊸鉄輪線より下（南立石２区、東荘園、ルミールの丘、石垣東、亀川中央町）', label: '㊸鉄輪線より下（南立石２区、東荘園、ルミールの丘、石垣東、亀川中央町）' },
];

// 価格帯選択肢
const PRICE_RANGE_OPTIONS = [
  '指定なし',
  '~1900万円',
  '1000万円~2999万円',
  '2000万円以上',
];

// 物件種別選択肢
const PROPERTY_TYPE_OPTIONS = ['戸建', 'マンション', '土地'];

const SIGNATURE_EMAIL = `\n\n××××××××××××××××××××××××××××\n株式会社いふう\n大分市舞鶴町1-3-30\nSTビル１F\n097-533-2022\ntenant@ifoo-oita.com\n定休日：水曜\n営業時間：10時～18時\n××××××××××××××××××××××××××××`;

export default function OtherCompanyDistributionPage() {
  const navigate = useNavigate();

  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('指定なし');
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // メールダイアログ
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('新着物件のご案内です！！');
  const [emailBody, setEmailBody] = useState('');
  const [selectedImages, setSelectedImages] = useState<ImageFile[]>([]);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false); // 0: Google Drive, 1: ローカルファイル, 2: URL（デフォルトはローカルファイル）
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // API呼び出し
  const fetchBuyers = async () => {
    if (!selectedArea || selectedPropertyTypes.length === 0) {
      setBuyers([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('area', selectedArea);
      params.append('priceRange', selectedPriceRange);
      selectedPropertyTypes.forEach(type => params.append('propertyTypes', type));

      const response = await api.get(`/api/buyers/other-company-distribution?${params.toString()}`);
      setBuyers(response.data.buyers);
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
      setBuyers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyers();
  }, [selectedArea, selectedPriceRange, selectedPropertyTypes]);

  // 物件種別ボタンのトグル
  const togglePropertyType = (type: string) => {
    setSelectedPropertyTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // チェックボックス操作
  const toggleCheck = (buyer_number: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(buyer_number) ? next.delete(buyer_number) : next.add(buyer_number);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === buyers.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(buyers.map(b => b.buyer_number)));
    }
  };

  const checkedBuyers = buyers.filter(b => checkedIds.has(b.buyer_number));
  const allChecked = buyers.length > 0 && checkedIds.size === buyers.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  // ヒアリング項目を取得
  const getHearingItems = (buyer: Buyer): string => {
    if (buyer.inquiry_hearing) {
      return buyer.inquiry_hearing;
    }
    return '-';
  };

  // 希望価格を物件種別に応じて表示
  const getPriceRange = (buyer: Buyer): string => {
    const propertyType = buyer.desired_property_type;
    if (propertyType === 'マンション') {
      return buyer.price_range_apartment || '-';
    }
    if (propertyType === '土地') {
      return buyer.price_range_land || '-';
    }
    if (propertyType === '戸建') {
      return buyer.price_range_house || '-';
    }
    // 複数種別の場合は全て表示
    const prices: string[] = [];
    if (buyer.price_range_house) prices.push(`戸建:${buyer.price_range_house}`);
    if (buyer.price_range_apartment) prices.push(`マンション:${buyer.price_range_apartment}`);
    if (buyer.price_range_land) prices.push(`土地:${buyer.price_range_land}`);
    return prices.length > 0 ? prices.join(', ') : '-';
  };

  // メール本文生成
  const buildEmailBody = (buyer: Buyer) => {
    return `${buyer.name}様\n\n大変お世話になっております。\n不動産会社の㈱いふうです。\n\n新着物件がでましたので、添付致します。\n他社様の物件でも気になる物件がございましたらまとめてご案内可能ですのでお申し付けくださいませ。${SIGNATURE_EMAIL}`;
  };

  const openEmailDialog = () => {
    if (checkedBuyers.length === 0) return;
    // 最初の買主の名前で本文を生成（個別送信なので各買主ごとに変わる）
    setEmailBody(buildEmailBody(checkedBuyers[0]));
    setEmailDialogOpen(true);
  };

  const handleOpenImageSelector = () => {
    setImageSelectorOpen(true);
  };

  const handleImageSelectionConfirm = (images: ImageFile[]) => {
    setSelectedImages(images);
    setImageSelectorOpen(false);
  };

  const handleImageSelectionCancel = () => {
    setImageSelectorOpen(false);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const sendEmails = async () => {
    setSending(true);
    try {
      // 各買主に個別送信
      for (const buyer of checkedBuyers) {
        const formData = new FormData();
        formData.append('buyerId', buyer.buyer_number);
        formData.append('subject', emailSubject);
        formData.append('body', buildEmailBody(buyer)); // 各買主ごとに本文を生成
        formData.append('senderEmail', 'tenant@ifoo-oita.com');
        
        // 画像を添付ファイルに変換（ローカルファイルのみ）
        for (const image of selectedImages) {
          if (image.source === 'local' && image.localFile) {
            formData.append('attachments', image.localFile);
          }
        }

        await api.post('/api/gmail/send', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      setEmailDialogOpen(false);
      setSnackbar({ open: true, message: `${checkedBuyers.length}件のメールを送信しました`, severity: 'success' });
      setCheckedIds(new Set()); // チェックをクリア
      setSelectedImages([]); // 選択画像をクリア
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'メール送信に失敗しました', severity: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.buyer.main }}>
          他社物件新着配信
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
            disabled={checkedIds.size === 0}
            onClick={openEmailDialog}
            sx={{
              backgroundColor: SECTION_COLORS.buyer.main,
              '&:hover': {
                backgroundColor: SECTION_COLORS.buyer.dark,
              },
            }}
          >
            Email送信 ({checkedIds.size})
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/buyers')}
            sx={{
              borderColor: SECTION_COLORS.buyer.main,
              color: SECTION_COLORS.buyer.main,
              '&:hover': {
                borderColor: SECTION_COLORS.buyer.dark,
                backgroundColor: `${SECTION_COLORS.buyer.main}15`,
              },
            }}
          >
            買主リストに戻る
          </Button>
        </Box>
      </Box>

      {/* フィルター */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          {/* エリア選択 */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>希望エリア</InputLabel>
              <Select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                label="希望エリア"
              >
                <MenuItem value="">未選択</MenuItem>
                {AREA_OPTIONS.map(area => (
                  <MenuItem key={area.value} value={area.value}>{area.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 価格帯選択 */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>価格種別</InputLabel>
              <Select
                value={selectedPriceRange}
                onChange={(e) => setSelectedPriceRange(e.target.value)}
                label="価格種別"
              >
                {PRICE_RANGE_OPTIONS.map(range => (
                  <MenuItem key={range} value={range}>{range}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 物件種別選択 */}
          <Grid item xs={12} md={4}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                物件種別
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {PROPERTY_TYPE_OPTIONS.map(type => (
                  <Button
                    key={type}
                    variant={selectedPropertyTypes.includes(type) ? 'contained' : 'outlined'}
                    onClick={() => togglePropertyType(type)}
                    sx={{
                      borderColor: SECTION_COLORS.buyer.main,
                      color: selectedPropertyTypes.includes(type) ? '#fff' : SECTION_COLORS.buyer.main,
                      backgroundColor: selectedPropertyTypes.includes(type) ? SECTION_COLORS.buyer.main : 'transparent',
                      '&:hover': {
                        borderColor: SECTION_COLORS.buyer.dark,
                        backgroundColor: selectedPropertyTypes.includes(type)
                          ? SECTION_COLORS.buyer.dark
                          : `${SECTION_COLORS.buyer.main}15`,
                      },
                    }}
                  >
                    {type}
                  </Button>
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 買主リスト */}
      <Paper>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : buyers.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {!selectedArea || selectedPropertyTypes.length === 0
                ? 'エリアと物件種別を選択してください'
                : '条件に合う買主が見つかりませんでした'}
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6">買主一覧 ({buyers.length}件)</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        onChange={toggleAll}
                      />
                    </TableCell>
                    <TableCell>買主番号</TableCell>
                    <TableCell>氏名</TableCell>
                    <TableCell>希望エリア</TableCell>
                    <TableCell>希望種別</TableCell>
                    <TableCell>希望価格</TableCell>
                    <TableCell>最新状況</TableCell>
                    <TableCell>ヒアリング項目</TableCell>
                    <TableCell>受付日</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {buyers.map(buyer => (
                    <TableRow
                      key={buyer.buyer_number}
                      hover
                      selected={checkedIds.has(buyer.buyer_number)}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => window.open(`/buyers/${buyer.buyer_number}`, '_blank', 'noopener,noreferrer')}
                    >
                      <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={checkedIds.has(buyer.buyer_number)}
                          onChange={() => toggleCheck(buyer.buyer_number)}
                        />
                      </TableCell>
                      <TableCell>{buyer.buyer_number}</TableCell>
                      <TableCell>{buyer.name}</TableCell>
                      <TableCell>{buyer.desired_area}</TableCell>
                      <TableCell>{buyer.desired_property_type}</TableCell>
                      <TableCell>{getPriceRange(buyer)}</TableCell>
                      <TableCell>
                        <Chip
                          label={buyer.latest_status || '-'}
                          size="small"
                          color="default"
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '300px', minWidth: '200px' }}>
                        <div dangerouslySetInnerHTML={{ __html: getHearingItems(buyer) }} />
                      </TableCell>
                      <TableCell>
                        {buyer.reception_date
                          ? new Date(buyer.reception_date).toLocaleDateString('ja-JP')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>

      {/* 件数表示 */}
      {buyers.length > 0 && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {buyers.length}件の買主が見つかりました
          </Typography>
        </Box>
      )}

      {/* メール送信ダイアログ */}
      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Email送信（{checkedBuyers.length}件）</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            選択した買主に個別にメールを送信します
          </Typography>
          <TextField
            label="件名"
            value={emailSubject}
            onChange={e => setEmailSubject(e.target.value)}
            fullWidth
          />
          <TextField
            label="本文（各買主の名前が自動的に挿入されます）"
            value={emailBody}
            onChange={e => setEmailBody(e.target.value)}
            multiline
            rows={14}
            fullWidth
          />
          
          {/* 添付ファイル選択 */}
          <Box>
            {/* 画像添付ボタン */}
          <Box>
            <Button
              variant="outlined"
              startIcon={<ImageIcon />}
              onClick={handleOpenImageSelector}
              fullWidth
            >
              画像を添付
            </Button>

            {selectedImages.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="success">
                  {selectedImages.length}枚の画像が選択されました
                </Alert>
                <List dense sx={{ mt: 1 }}>
                  {selectedImages.map((image, index) => (
                    <ListItem
                      key={image.id}
                      secondaryAction={
                        <IconButton edge="end" onClick={() => removeImage(index)}>
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={image.name}
                        secondary={`${(image.size / 1024).toFixed(1)} KB - ${image.source === 'drive' ? 'Google Drive' : image.source === 'local' ? 'ローカル' : 'URL'}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={sendEmails}
            disabled={sending}
          >
            {sending ? '送信中...' : `送信 (${checkedBuyers.length}件)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* 画像選択モーダル */}
      <ImageSelectorModal
        open={imageSelectorOpen}
        onConfirm={handleImageSelectionConfirm}
        onCancel={handleImageSelectionCancel}
      />
    </Container>
  );
}
