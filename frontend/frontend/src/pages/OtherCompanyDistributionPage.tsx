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
  const [recommendComment, setRecommendComment] = useState(''); // おすすめコメント
  const [propertyUrl, setPropertyUrl] = useState(''); // 物件URL
  const [selectedImages, setSelectedImages] = useState<ImageFile[]>([]);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // 物件プレビュー取得
  const [scraping, setScraping] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [showFields, setShowFields] = useState({
    images: true, price: true, address: true, access: true,
    layout: true, area: true, floor: false, built_year: false,
    parking: false, features: false, map: true,
  });

  // スクレイピング結果から自動入力用データを生成
  const autoFillFromScrapedData = (data: any) => {
    // 住所を自動入力
    if (data.address) {
      setAddress(data.address);
    }

    // 価格帯を自動判定
    if (data.price) {
      const priceStr = data.price.replace(/[^0-9]/g, ''); // 数字のみ抽出
      const priceNum = parseInt(priceStr, 10);
      if (!isNaN(priceNum)) {
        if (priceNum < 1900) {
          setSelectedPriceRange('~1900万円');
        } else if (priceNum >= 1000 && priceNum < 3000) {
          setSelectedPriceRange('1000万円~2999万円');
        } else if (priceNum >= 3000) {
          setSelectedPriceRange('2000万円以上');
        }
      }
    }

    // 物件種別を自動判定
    const propertyTypeMap: { [key: string]: string } = {
      '中古マンション': 'マンション',
      '新築マンション': 'マンション',
      'マンション': 'マンション',
      '中古一戸建て': '戸建',
      '新築一戸建て': '戸建',
      '一戸建て': '戸建',
      '戸建': '戸建',
      '土地': '土地',
    };
    
    const propertyType = data.details?.['物件種目'];
    const isMansion = propertyType && propertyTypeMap[propertyType] === 'マンション';
    
    if (propertyType && propertyTypeMap[propertyType]) {
      const mappedType = propertyTypeMap[propertyType];
      setSelectedPropertyTypes([mappedType]);
      
      // マンション以外の場合はペット・高層階フィルターをリセット
      if (mappedType !== 'マンション') {
        setSelectedPet('どちらでも');
        setSelectedFloor('どちらでも');
      }
    }

    // マンションの場合のみ、高層階・ペット・温泉を自動判定
    if (isMansion) {
      // 高層階を自動判定（7階以上 → 高層階）
      const floorInfo = data.details?.['階建/階'] || data.details?.['階建 / 階'] || data.floor;
      if (floorInfo) {
        // 「15階建 / 8階」のような形式から階数を抽出
        const floorMatch = floorInfo.match(/\/\s*(\d+)階/);
        if (floorMatch) {
          const floor = parseInt(floorMatch[1], 10);
          if (floor >= 7) {
            setSelectedFloor('高層階');
          } else {
            setSelectedFloor('低層階');
          }
        }
      }

      // ペットを自動判定
      // 「ペット」フィールドを確認
      const petField = data.details?.['ペット'];
      
      console.log('[自動入力] ペット判定:', {
        petField,
        petFieldExists: petField !== undefined,
        petValue: petField?.trim(),
        allDetails: Object.keys(data.details || {})
      });
      
      if (petField !== undefined) {
        // 「ペット」フィールドが存在する場合
        const petValue = petField.trim();
        if (petValue && petValue !== '－' && petValue !== '-') {
          // 何か書かれている場合（「大型犬可 小型犬可 猫可」「相談」など） → 「可」
          console.log('[自動入力] ペット: 可 (理由: 何か書かれている)', petValue);
          setSelectedPet('可');
        } else {
          // 空または「－」の場合 → 「不可」
          console.log('[自動入力] ペット: 不可 (理由: 空または「－」)', petValue);
          setSelectedPet('不可');
        }
      } else {
        console.log('[自動入力] ペット: どちらでも (理由: フィールドなし)');
      }
      // 「ペット」フィールド自体がない場合は「どちらでも」のまま
    }

    // 温泉を自動判定（全物件種別）
    const features = data.details?.['設備・サービス'] || data.features || '';
    const remarks = data.details?.['備考'] || data.remarks || '';
    const allText = (features + ' ' + remarks).toLowerCase();
    
    if (allText.includes('温泉') || allText.includes('天然温泉') || allText.includes('源泉')) {
      setSelectedOnsen('あり');
    } else {
      // 温泉情報がない場合は「なし」
      setSelectedOnsen('なし');
    }

    // P台数を自動判定
    if (data.parking) {
      const parkingStr = data.parking.toLowerCase();
      
      // 「○台」という明示的な表記を優先的に検索
      const explicitMatch = parkingStr.match(/(\d+)\s*台/);
      
      if (explicitMatch) {
        // 「10台」「2台」のような明示的な表記がある場合
        const parkingNum = parseInt(explicitMatch[1], 10);
        if (parkingNum >= 10) {
          setSelectedParking('10台以上');
        } else if (parkingNum >= 3) {
          setSelectedParking('3台以上');
        } else if (parkingNum >= 2) {
          setSelectedParking('2台以上');
        } else if (parkingNum >= 1) {
          setSelectedParking('1台');
        }
      } else if (parkingStr.includes('有')) {
        // 「有」のみの場合は1台（マンションの場合は基本1台）
        setSelectedParking('1台');
      } else if (parkingStr.includes('無') || parkingStr.includes('なし')) {
        setSelectedParking('不要');
      }
    }
  };

  const handleScrape = async () => {
    if (!propertyUrl.trim()) return;
    setScraping(true);
    setPreviewData(null);
    setPreviewUrl('');
    try {
      // RailwayのスクレイピングAPIサーバーに送信
      const scrapeApiUrl = import.meta.env.VITE_SCRAPE_API_URL || 'http://localhost:8765';
      const res = await fetch(`${scrapeApiUrl}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: propertyUrl.trim() }),
      });
      if (!res.ok) throw new Error(`スクレイピングサーバーエラー: ${res.status}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error || '取得失敗');
      setPreviewData(result.data);
      setPreviewUrl(result.preview_url);
      
      // 自動入力を実行
      autoFillFromScrapedData(result.data);
      
      // 画像を自動選択（最初の3枚）
      if (result.data.images && result.data.images.length > 0) {
        const firstThreeImages: ImageFile[] = result.data.images.slice(0, 3).map((imgUrl: string, index: number) => ({
          id: `scraped-${Date.now()}-${index}`,
          name: `物件画像${index + 1}.jpg`,
          source: 'url' as const,
          size: 0, // URLの場合はサイズ不明
          mimeType: 'image/jpeg',
          previewUrl: imgUrl,
          url: imgUrl,
        }));
        setSelectedImages(firstThreeImages);
      }
      
      setSnackbar({ open: true, message: '物件情報を取得し、フィルターに自動入力しました', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: `取得失敗: ${err.message}。scrape_server.pyが起動しているか確認してください。`, severity: 'error' });
    } finally {
      setScraping(false);
    }
  };

  const toggleField = (key: keyof typeof showFields) => {
    setShowFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyPreviewUrl = () => {
    navigator.clipboard.writeText(previewUrl);
    setSnackbar({ open: true, message: '公開URLをコピーしました', severity: 'success' });
  };

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
    // プレビューURLがあればそれを使用、なければ元のURLを使用
    const linkUrl = previewUrl || propertyUrl.trim();
    
    // スクレイピングデータがある場合は新フォーマット
    if (previewData) {
      const propertyAddress = previewData.address || '住所情報なし';
      const propertyPrice = previewData.price || '価格情報なし';
      
      // 物件情報を整形
      const propertyDetails = [];
      if (previewData.layout) propertyDetails.push(`間取り: ${previewData.layout}`);
      if (previewData.area) propertyDetails.push(`面積: ${previewData.area}`);
      if (previewData.floor) propertyDetails.push(`階: ${previewData.floor}`);
      if (previewData.built_year) propertyDetails.push(`築年月: ${previewData.built_year}`);
      if (previewData.parking) propertyDetails.push(`駐車場: ${previewData.parking}`);
      if (previewData.access) propertyDetails.push(`交通: ${previewData.access}`);
      
      const propertyInfo = propertyDetails.length > 0 ? propertyDetails.join('\n') : '';
      
      // おすすめコメント（入力されている場合のみ表示）
      const commentSection = recommendComment.trim() ? `\n${recommendComment.trim()}\n` : '';
      
      // 画像HTML（最初の3枚のみ、大きめに表示）
      const imageHtml = selectedImages.slice(0, 3).map((image, index) => {
        const imgSrc = image.url || image.previewUrl;
        return `<img src="${imgSrc}" alt="物件画像${index + 1}" style="max-width: 600px; width: 100%; height: auto; margin: 10px 0; display: block;" />`;
      }).join('');
      
      return `${buyer.name}様

大変お世話になっております。
不動産会社の㈱いふうです。

新着物件がでましたので、ご案内致します。

${propertyAddress}/${propertyPrice}/

${imageHtml}

他にはこちらから
${linkUrl}${commentSection}
${propertyInfo}${SIGNATURE_EMAIL}`;
    }
    
    // スクレイピングデータがない場合は従来フォーマット
    const urlLine = linkUrl ? `\n物件情報はこちら: ${linkUrl}\n` : '';
    return `${buyer.name}様\n\n大変お世話になっております。\n不動産会社の㈱いふうです。\n\n新着物件がでましたので、ご案内致します。\n他社様の物件でも気になる物件がございましたらまとめてご案内可能ですのでお申し付けくださいませ。${urlLine}${SIGNATURE_EMAIL}`;
  };

  const openEmailDialog = () => {
    if (checkedBuyers.length === 0) return;
    
    // スクレイピングデータがある場合は件名も更新
    if (previewData) {
      const propertyAddress = previewData.address || '住所情報なし';
      const propertyPrice = previewData.price || '価格情報なし';
      setEmailSubject(`${propertyAddress}/${propertyPrice}/おまたせしました！新着物件です！`);
    } else {
      setEmailSubject('新着物件のご案内です！！');
    }
    
    // 最初の買主の名前で本文を生成（個別送信なので各買主ごとに変わる）
    setEmailBody(buildEmailBody(checkedBuyers[0]));
    setEmailDialogOpen(true);
  };

  // おすすめコメントが変更されたら本文を再生成
  useEffect(() => {
    if (emailDialogOpen && checkedBuyers.length > 0) {
      setEmailBody(buildEmailBody(checkedBuyers[0]));
    }
  }, [recommendComment]);

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
        
        // 画像を添付ファイルに変換
        for (const image of selectedImages) {
          if (image.source === 'local' && image.localFile) {
            // ローカルファイルの場合
            formData.append('attachments', image.localFile);
          } else if (image.source === 'url' && image.url) {
            // URL画像の場合はURLを送信（バックエンドでダウンロード）
            formData.append('imageUrls', image.url);
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
      setRecommendComment(''); // おすすめコメントをクリア
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
        {/* URL入力フィールド */}
        <TextField
          label="URL"
          value={propertyUrl}
          onChange={e => setPropertyUrl(e.target.value)}
          placeholder="https://www.athome.co.jp/mansion/..."
          size="small"
          sx={{ width: 380 }}
          InputProps={{
            startAdornment: <LinkIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
          }}
        />
        <Button
          variant="contained"
          onClick={handleScrape}
          disabled={scraping || !propertyUrl.trim()}
          sx={{ backgroundColor: '#555', '&:hover': { backgroundColor: '#333' }, whiteSpace: 'nowrap' }}
        >
          {scraping ? '取得中...' : '物件情報を取得'}
        </Button>
        <Box sx={{ display: 'flex', gap: 2 }}>          <Button
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

      {/* 物件プレビュー選択UI */}
      {previewData && (
        <Paper sx={{ p: 2, mb: 2, border: '2px solid', borderColor: SECTION_COLORS.buyer.main }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5, color: SECTION_COLORS.buyer.main }}>
            📋 公開する情報を選択
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {[
              { key: 'images',     label: `写真（${previewData.images?.length || 0}枚）` },
              { key: 'price',      label: `価格：${previewData.price || '-'}` },
              { key: 'address',    label: `所在地：${previewData.address || '-'}` },
              { key: 'access',     label: `交通：${previewData.access || '-'}` },
              { key: 'layout',     label: `間取り：${previewData.layout || '-'}` },
              { key: 'area',       label: `面積：${previewData.area || '-'}` },
              { key: 'floor',      label: `階：${previewData.floor || '-'}` },
              { key: 'built_year', label: `築年月：${previewData.built_year || '-'}` },
              { key: 'parking',    label: `駐車場：${previewData.parking || '-'}` },
              { key: 'features',   label: '設備・サービス' },
              { key: 'map',        label: '地図' },
            ].map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                onClick={() => toggleField(key as keyof typeof showFields)}
                color={showFields[key as keyof typeof showFields] ? 'primary' : 'default'}
                variant={showFields[key as keyof typeof showFields] ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer', maxWidth: 280 }}
              />
            ))}
          </Box>
          {previewUrl && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>公開URL:</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: SECTION_COLORS.buyer.main, wordBreak: 'break-all' }}>
                {previewUrl}
              </Typography>
              <Button size="small" variant="contained" onClick={copyPreviewUrl}
                sx={{ backgroundColor: SECTION_COLORS.buyer.main, '&:hover': { backgroundColor: SECTION_COLORS.buyer.dark } }}>
                URLをコピー
              </Button>
              <Button size="small" variant="outlined" onClick={() => window.open(previewUrl, '_blank')}
                sx={{ borderColor: SECTION_COLORS.buyer.main, color: SECTION_COLORS.buyer.main }}>
                プレビュー確認
              </Button>
            </Box>
          )}
        </Paper>
      )}

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
      <Dialog 
        open={emailDialogOpen} 
        onClose={() => {
          setEmailDialogOpen(false);
          setRecommendComment(''); // ダイアログを閉じたらおすすめコメントをリセット
        }} 
        maxWidth="md" 
        fullWidth
      >
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
          
          {/* おすすめコメント入力欄（スクレイピングデータがある場合のみ表示） */}
          {previewData && (
            <TextField
              label="おすすめコメント（任意）"
              value={recommendComment}
              onChange={e => setRecommendComment(e.target.value)}
              multiline
              rows={3}
              fullWidth
              placeholder="この物件のおすすめポイントを入力してください"
              helperText="入力したコメントは「他にはこちらから」の下に表示されます"
            />
          )}
          
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
          <Button onClick={() => {
            setEmailDialogOpen(false);
            setRecommendComment(''); // キャンセル時もおすすめコメントをリセット
          }}>キャンセル</Button>
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
