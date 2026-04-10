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
  distance?: number; // 距離（km）
  inquired_property_address?: string; // 問合せ物件所在地
}

// 削除：エリア選択肢は不要（住所入力に変更）

// 価格帯選択肢
const PRICE_RANGE_OPTIONS = [
  '指定なし',
  '~1900万円',
  '1000万円~2999万円',
  '2000万円以上',
];

// 物件種別選択肢
const PROPERTY_TYPE_OPTIONS = ['戸建', 'マンション', '土地'];

// ペットフィルター選択肢
const PET_OPTIONS = ['可', '不可', 'どちらでも'] as const;
// P台数フィルター選択肢
const PARKING_OPTIONS = ['1台', '2台以上', '3台以上', '10台以上', '不要', '指定なし'] as const;
// 温泉フィルター選択肢
const ONSEN_OPTIONS = ['あり', 'なし', 'どちらでも'] as const;
// 高層階フィルター選択肢
const FLOOR_OPTIONS = ['高層階', '低層階', 'どちらでも'] as const;

const SIGNATURE_EMAIL = `\n\n××××××××××××××××××××××××××××\n株式会社いふう\n大分市舞鶴町1-3-30\nSTビル１F\n097-533-2022\ntenant@ifoo-oita.com\n定休日：水曜\n営業時間：10時～18時\n××××××××××××××××××××××××××××`;

export default function OtherCompanyDistributionPage() {
  const navigate = useNavigate();

  const [address, setAddress] = useState<string>(''); // 住所入力
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('指定なし');
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [selectedPet, setSelectedPet] = useState<string>('どちらでも');
  const [selectedParking, setSelectedParking] = useState<string>('指定なし');
  const [selectedOnsen, setSelectedOnsen] = useState<string>('どちらでも');
  const [selectedFloor, setSelectedFloor] = useState<string>('どちらでも');
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>(''); // エラーメッセージ
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
    // 住所と物件種別が未入力の場合は検索しない
    if (!address.trim() || selectedPropertyTypes.length === 0) {
      setBuyers([]);
      setError('');
      return;
    }

    // 住所のバリデーション（最大200文字）
    if (address.length > 200) {
      setError('住所は200文字以内で入力してください');
      setBuyers([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/buyers/radius-search', {
        address: address.trim(),
        priceRange: selectedPriceRange,
        propertyTypes: selectedPropertyTypes,
        pet: selectedPet,
        parking: selectedParking,
        onsen: selectedOnsen,
        floor: selectedFloor,
      });
      setBuyers(response.data.buyers);
    } catch (err: any) {
      console.error('Failed to fetch buyers:', err);
      
      // エラーメッセージを設定
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.message) {
        setError(`エラーが発生しました: ${err.message}`);
      } else {
        setError('買主の検索に失敗しました。しばらくしてから再度お試しください。');
      }
      
      setBuyers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyers();
  }, [address, selectedPriceRange, selectedPropertyTypes, selectedPet, selectedParking, selectedOnsen, selectedFloor]);

  // 物件種別ボタンのトグル
  const togglePropertyType = (type: string) => {
    setSelectedPropertyTypes(prev => {
      const next = prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type];
      // マンションが含まれなくなった場合はペット・高層階フィルターをリセット
      if (!next.includes('マンション')) {
        setSelectedPet('どちらでも');
        setSelectedFloor('どちらでも');
      }
      return next;
    });
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

  // 最新状況の最初のアルファベットを取得
  const getFirstAlphabet = (status: string | null): string => {
    if (!status) return '-';
    const match = status.match(/[A-Z]/);
    return match ? match[0] : '-';
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

        // activity_logsに記録（メール送信成功後）
        try {
          await api.post('/api/activity-logs/email', {
            buyerId: buyer.buyer_number,
            propertyNumbers: [], // 他社物件のため空配列
            recipientEmail: buyer.email,
            subject: emailSubject,
            templateName: '他社物件新着配信',
            senderEmail: 'tenant@ifoo-oita.com',
            source: 'other_company_distribution', // 送信元識別子
          });
        } catch (logError) {
          // activity_logs記録失敗はログのみ（ユーザーには通知しない）
          console.error('Failed to log email activity:', logError);
        }
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
          {/* 住所または物件番号入力 */}
          <Grid item xs={12} md={4}>
            <TextField
              label="住所または物件番号を入力してください"
              placeholder="例: 大分県大分市府内町1-1-1 または AA9926"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              fullWidth
              helperText="入力した住所または物件番号の半径3km圏内で買主を検索します（最大200文字）"
              error={address.length > 200}
            />
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

          {/* ペットフィルター（マンション選択時のみ表示） */}
          {selectedPropertyTypes.includes('マンション') && (
            <Grid item xs={12} md={3}>
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                  ペット
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {PET_OPTIONS.map(option => (
                    <Button
                      key={option}
                      variant={selectedPet === option ? 'contained' : 'outlined'}
                      onClick={() => setSelectedPet(option)}
                      sx={{
                        borderColor: SECTION_COLORS.buyer.main,
                        color: selectedPet === option ? '#fff' : SECTION_COLORS.buyer.main,
                        backgroundColor: selectedPet === option ? SECTION_COLORS.buyer.main : 'transparent',
                        '&:hover': {
                          borderColor: SECTION_COLORS.buyer.dark,
                          backgroundColor: selectedPet === option
                            ? SECTION_COLORS.buyer.dark
                            : `${SECTION_COLORS.buyer.main}15`,
                        },
                      }}
                    >
                      {option}
                    </Button>
                  ))}
                </Box>
              </Box>
            </Grid>
          )}

          {/* P台数フィルター（常時表示） */}
          <Grid item xs={12} md={4}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                P台数
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {PARKING_OPTIONS.map(option => (
                  <Button
                    key={option}
                    variant={selectedParking === option ? 'contained' : 'outlined'}
                    onClick={() => setSelectedParking(option)}
                    sx={{
                      borderColor: SECTION_COLORS.buyer.main,
                      color: selectedParking === option ? '#fff' : SECTION_COLORS.buyer.main,
                      backgroundColor: selectedParking === option ? SECTION_COLORS.buyer.main : 'transparent',
                      '&:hover': {
                        borderColor: SECTION_COLORS.buyer.dark,
                        backgroundColor: selectedParking === option
                          ? SECTION_COLORS.buyer.dark
                          : `${SECTION_COLORS.buyer.main}15`,
                      },
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </Box>
            </Box>
          </Grid>

          {/* 温泉フィルター（常時表示） */}
          <Grid item xs={12} md={3}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                温泉
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {ONSEN_OPTIONS.map(option => (
                  <Button
                    key={option}
                    variant={selectedOnsen === option ? 'contained' : 'outlined'}
                    onClick={() => setSelectedOnsen(option)}
                    sx={{
                      borderColor: SECTION_COLORS.buyer.main,
                      color: selectedOnsen === option ? '#fff' : SECTION_COLORS.buyer.main,
                      backgroundColor: selectedOnsen === option ? SECTION_COLORS.buyer.main : 'transparent',
                      '&:hover': {
                        borderColor: SECTION_COLORS.buyer.dark,
                        backgroundColor: selectedOnsen === option
                          ? SECTION_COLORS.buyer.dark
                          : `${SECTION_COLORS.buyer.main}15`,
                      },
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </Box>
            </Box>
          </Grid>

          {/* 高層階フィルター（マンション選択時のみ表示） */}
          {selectedPropertyTypes.includes('マンション') && (
            <Grid item xs={12} md={3}>
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                  高層階
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {FLOOR_OPTIONS.map(option => (
                    <Button
                      key={option}
                      variant={selectedFloor === option ? 'contained' : 'outlined'}
                      onClick={() => setSelectedFloor(option)}
                      sx={{
                        borderColor: SECTION_COLORS.buyer.main,
                        color: selectedFloor === option ? '#fff' : SECTION_COLORS.buyer.main,
                        backgroundColor: selectedFloor === option ? SECTION_COLORS.buyer.main : 'transparent',
                        '&:hover': {
                          borderColor: SECTION_COLORS.buyer.dark,
                          backgroundColor: selectedFloor === option
                            ? SECTION_COLORS.buyer.dark
                            : `${SECTION_COLORS.buyer.main}15`,
                        },
                      }}
                    >
                      {option}
                    </Button>
                  ))}
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* 買主リスト */}
      <Paper>
        {/* エラーメッセージ */}
        {error && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }} color="text.secondary">
              検索中...
            </Typography>
          </Box>
        ) : buyers.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {!address.trim() || selectedPropertyTypes.length === 0
                ? '住所と物件種別を入力してください'
                : error
                ? '' // エラーメッセージが表示されている場合は何も表示しない
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
                    <TableCell>距離</TableCell>
                    <TableCell>希望エリア</TableCell>
                    <TableCell>問合せ物件所在地</TableCell>
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
                      <TableCell>
                        {buyer.distance !== undefined ? (
                          <Chip
                            label={`${buyer.distance.toFixed(2)} km`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{buyer.desired_area}</TableCell>
                      <TableCell>{buyer.inquired_property_address || '-'}</TableCell>
                      <TableCell>{buyer.desired_property_type}</TableCell>
                      <TableCell>{getPriceRange(buyer)}</TableCell>
                      <TableCell>
                        <Chip
                          label={getFirstAlphabet(buyer.latest_status)}
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
