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
  Print as PrintIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';
import ImageSelectorModal from '../components/ImageSelectorModal';
import TestGmailSendButton from '../components/TestGmailSendButton';
import PropertyPrintSheet from '../components/PropertyPrintSheet';

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
  const [propertyNumber, setPropertyNumber] = useState<string>(''); // 物件番号入力
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
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit'); // プレビューモード
  const [testEmail, setTestEmail] = useState(''); // テスト送信用メールアドレス
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
  const [showProviderInfo, setShowProviderInfo] = useState(false); // 販売元情報の表示状態
  const [showPrintSheet, setShowPrintSheet] = useState(false); // 印刷シート表示状態

  // 配信履歴
  const [distributionHistory, setDistributionHistory] = useState<any[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<{ isDuplicate: boolean; history: any; source?: string } | null>(null);

  // 配信履歴を取得
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/api/distribution-history');
        setDistributionHistory(res.data);
      } catch (err) {
        console.error('Failed to fetch distribution history:', err);
      }
    };
    fetchHistory();
  }, []);

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
      '未入居一戸建て': '戸建',
      '一戸建て': '戸建',
      '戸建て': '戸建',
      '戸建': '戸建',
      '戸': '戸建',
      '土地': '土地',
    };
    
    const propertyType = data.details?.['物件種目'];
    const isMansion = propertyType && propertyTypeMap[propertyType] === 'マンション';
    
    console.log('[自動入力] 物件種別判定:', {
      propertyType,
      isMansion,
      mappedType: propertyTypeMap[propertyType],
      allDetailsKeys: Object.keys(data.details || {})
    });
    
    if (propertyType && propertyTypeMap[propertyType]) {
      const mappedType = propertyTypeMap[propertyType];
      console.log('[自動入力] 物件種別:', mappedType);
      setSelectedPropertyTypes([mappedType]);
      
      // マンション以外の場合はペット・高層階フィルターをリセット
      if (mappedType !== 'マンション') {
        setSelectedPet('どちらでも');
        setSelectedFloor('どちらでも');
      }
    } else {
      console.log('[自動入力] 物件種別: 判定できず (propertyType:', propertyType, ')');
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

    // P台数の自動入力は削除（ユーザーが手動で入力する）
    // 物件種別が「土地」以外の場合は「指定なし」のままにして、ユーザーに入力を促す
  };

  const handleScrape = async () => {
    if (!propertyUrl.trim()) return;
    setScraping(true);
    setPreviewData(null);
    setPreviewUrl('');
    try {
      // バックエンド経由でスクレイピング（CORS回避）
      const res = await api.post('/api/buyers/scrape-property', { url: propertyUrl.trim() });
      const result = res.data;
      if (!result.success) throw new Error(result.error || '取得失敗');
      setPreviewData(result.data);
      setPreviewUrl(result.preview_url);
      setShowProviderInfo(false); // 新しいスクレイピング時は販売元情報を非表示に
      
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
      
      // 重複チェック
      if (result.data.address && result.data.price) {
        try {
          const landArea = result.data.details?.['土地面積'] || result.data.area || null;
          const dupRes = await api.post('/api/distribution-history/check-duplicate', {
            propertyAddress: result.data.address,
            price: result.data.price,
            landArea: landArea,
            sourceUrl: propertyUrl.trim(),
          });
          if (dupRes.data.isDuplicate) {
            setDuplicateWarning(dupRes.data);
          } else {
            setDuplicateWarning(null);
          }
        } catch (dupErr) {
          console.error('Duplicate check failed:', dupErr);
        }
      }
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
    // 物件番号または住所、かつ物件種別が必須
    if ((!propertyNumber.trim() && !address.trim()) || selectedPropertyTypes.length === 0) {
      setBuyers([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      
      // 物件番号が入力されている場合
      if (propertyNumber.trim()) {
        params.append('propertyNumber', propertyNumber.trim());
      }
      
      // 住所が入力されている場合（エリア検索として使用）
      if (address.trim()) {
        params.append('area', address.trim());
      }
      
      params.append('priceRange', selectedPriceRange);
      selectedPropertyTypes.forEach(type => params.append('propertyTypes', type));

      const response = await api.get(`/api/buyers/other-company-distribution?${params.toString()}`);
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
  }, [propertyNumber, address, selectedPriceRange, selectedPropertyTypes, selectedPet, selectedParking, selectedOnsen, selectedFloor]);

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
      // 土地のみが選択された場合はP台数を「指定なし」にリセット
      if (next.length === 1 && next.includes('土地')) {
        setSelectedParking('指定なし');
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
  const buildEmailBody = (buyer: Buyer | null) => {
    // プレビューURLがあればそれを使用、なければ元のURLを使用
    const linkUrl = previewUrl || propertyUrl.trim();
    const buyerName = buyer?.name || '（買主名）';
    
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
      
      const propertyInfo = propertyDetails.join('<br>');
      
      // おすすめコメント（入力されている場合のみ表示）
      const commentSection = recommendComment.trim() ? `<br>${recommendComment.trim().replace(/\n/g, '<br>')}<br>` : '';
      
      // 画像HTML（最初の3枚のみ、大きめに表示）
      const imageHtml = selectedImages.slice(0, 3).map((image, index) => {
        const imgSrc = image.url || image.previewUrl;
        return `<img src="${imgSrc}" alt="物件画像${index + 1}" style="max-width: 600px; width: 100%; height: auto; margin: 10px 0; display: block;" />`;
      }).join('');
      
      return `${buyerName}様<br><br>大変お世話になっております。<br>不動産会社の㈱いふうです。<br><br>新着物件がでましたので、ご案内致します。<br><br>${propertyAddress}/${propertyPrice}/<br><br>${imageHtml}<br>他の画像はこちらから<br><a href="${linkUrl}">${linkUrl}</a>${commentSection}<br>${propertyInfo}<br>★建売専門HPはこちら<br><a href="https://sateituikyaku-admin-frontend.vercel.app/tateuri">https://sateituikyaku-admin-frontend.vercel.app/tateuri</a>${SIGNATURE_EMAIL.replace(/\n/g, '<br>')}`;
    }
    
    // スクレイピングデータがない場合は従来フォーマット
    const urlLine = linkUrl ? `<br>物件情報はこちら: <a href="${linkUrl}">${linkUrl}</a><br>` : '';
    return `${buyerName}様<br><br>大変お世話になっております。<br>不動産会社の㈱いふうです。<br><br>新着物件がでましたので、ご案内致します。<br>他社様の物件でも気になる物件がございましたらまとめてご案内可能ですのでお申し付けくださいませ。${urlLine}<br>★建売専門HPはこちら<br><a href="https://sateituikyaku-admin-frontend.vercel.app/tateuri">https://sateituikyaku-admin-frontend.vercel.app/tateuri</a>${SIGNATURE_EMAIL.replace(/\n/g, '<br>')}`;
  };

  const openEmailDialog = () => {
    // スクレイピングデータがある場合は件名も更新
    if (previewData) {
      const propertyAddress = previewData.address || '住所情報なし';
      const propertyPrice = previewData.price || '価格情報なし';
      setEmailSubject(`${propertyAddress}/${propertyPrice}/おまたせしました！新着物件です！`);
    } else {
      setEmailSubject('新着物件のご案内です！！');
    }
    
    // 買主が選択されている場合は最初の買主の名前で本文を生成、未選択の場合はデフォルト本文
    if (checkedBuyers.length > 0) {
      setEmailBody(buildEmailBody(checkedBuyers[0]));
    } else {
      setEmailBody(buildEmailBody(null));
    }
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
      // テストメールアドレスが入力されている場合は、テスト送信（買主選択不要）
      const isTestSend = !!testEmail.trim();

      // 宛先リストを組み立てる
      const recipients: Array<{ email: string; name: string | null; buyerNumber: string }> = isTestSend
        ? [{ email: testEmail.trim(), name: checkedBuyers[0]?.name || null, buyerNumber: checkedBuyers[0]?.buyer_number || 'test' }]
        : checkedBuyers
            .filter(b => b.email && b.email.trim())
            .map(b => ({ email: b.email!, name: b.name || null, buyerNumber: b.buyer_number }));

      if (recipients.length === 0) {
        setSnackbar({ open: true, message: 'メールアドレスが登録されている買主がいません', severity: 'warning' });
        setSending(false);
        return;
      }

      // 本文は {buyerName} プレースホルダーを使い、バックエンドで各買主名に置換させる
      // buildEmailBody の buyerName 部分だけ {buyerName} に差し替えた汎用テンプレートを生成
      const bodyTemplate = buildEmailBody(null).replace(/（買主名）/g, '{buyerName}');

      // 添付画像をAPIの attachments 形式に変換
      const attachments = selectedImages
        .filter(img => img.url || (img.source === 'local' && img.localFile))
        .map((img, index) => ({
          id: img.id || `img-${index}`,
          name: img.name || `image-${index + 1}.jpg`,
          mimeType: img.mimeType || 'image/jpeg',
          ...(img.url ? { url: img.url } : {}),
        }));

      // /api/emails/send-distribution を使って一括送信（近隣買主・価格変更メールと同じAPI）
      const response = await api.post('/api/emails/send-distribution', {
        senderAddress: 'tenant@ifoo-oita.com',
        recipients,
        subject: emailSubject,
        body: bodyTemplate,
        source: 'other_company_distribution',
        ...(attachments.length > 0 ? { attachments } : {}),
      });

      const result = response.data;
      const successCount: number = result.successCount ?? recipients.length;
      const failedCount: number = result.failedCount ?? 0;

      setEmailDialogOpen(false);

      if (isTestSend) {
        setSnackbar({ open: true, message: `テストメール（${testEmail}）を送信しました`, severity: 'success' });
      } else if (failedCount === 0) {
        setSnackbar({ open: true, message: `${successCount}件のメールを送信しました`, severity: 'success' });
      } else {
        setSnackbar({
          open: true,
          message: `${successCount}件送信成功、${failedCount}件失敗`,
          severity: 'warning',
        });
      }

      setCheckedIds(new Set()); // チェックをクリア
      setSelectedImages([]); // 選択画像をクリア
      setRecommendComment(''); // おすすめコメントをクリア
      setTestEmail(''); // テストメールアドレスをクリア

      // 配信履歴を記録（テスト送信以外）
      if (!isTestSend && successCount > 0 && previewData?.address && previewData?.price) {
        try {
          // 土地面積を取得（detailsから直接、またはareaフィールドから）
          const landArea = previewData.details?.['土地面積'] || previewData.area || null;
          await api.post('/api/distribution-history', {
            propertyAddress: previewData.address,
            price: previewData.price,
            propertyType: previewData.details?.['物件種目'] || null,
            sourceUrl: propertyUrl || null,
            landArea: landArea,
            sentCount: successCount,
          });
          // 履歴を再取得
          const histRes = await api.get('/api/distribution-history');
          setDistributionHistory(histRes.data);
        } catch (histErr) {
          console.error('Failed to save distribution history:', histErr);
        }
      }
    } catch (err: any) {
      console.error('[sendEmails] エラー:', err);
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
        {/* テスト送信ボタン（スクレイピングデータがある場合のみ表示） */}
        {previewData && previewUrl && (
          <TestGmailSendButton 
            size="small" 
            variant="outlined"
            previewData={previewData}
            previewUrl={previewUrl}
          />
        )}
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

      {/* 重複警告 */}
      {duplicateWarning?.isDuplicate && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ⚠️ この物件は重複しています
          {duplicateWarning.source ? `（${duplicateWarning.source}）` : ''}
          {duplicateWarning.history?.sent_at ? `（${new Date(duplicateWarning.history.sent_at).toLocaleDateString('ja-JP')}）` : ''}
          {duplicateWarning.history?.sent_count ? `（${duplicateWarning.history.sent_count}件送信済み）` : ''}
        </Alert>
      )}
          {/* 当社の電話番号と隠しボタン */}
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              当社の電話番号: 097-533-2022
            </Typography>
            <Box
              onClick={() => setShowProviderInfo(!showProviderInfo)}
              sx={{
                width: 20,
                height: 20,
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                cursor: 'pointer',
                opacity: 0.3,
                transition: 'opacity 0.2s',
                '&:hover': {
                  opacity: 0.6,
                },
              }}
              title="販売元情報を表示"
            />
          </Box>

          {/* 販売元情報（隠しボタンクリック時に表示） */}
          {showProviderInfo && (
            <Box sx={{ mb: 2, p: 2, backgroundColor: '#f9f9f9', borderRadius: 1, border: '1px solid #ddd' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#666' }}>
                📞 販売元情報
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {previewData.provider_name && (
                  <Typography variant="body2">
                    <strong>会社名:</strong> {previewData.provider_name}
                  </Typography>
                )}
                {previewData.provider_phone && (
                  <Typography variant="body2">
                    <strong>電話番号:</strong> {previewData.provider_phone}
                  </Typography>
                )}
                {previewData.provider_hours && (
                  <Typography variant="body2">
                    <strong>営業時間:</strong> {previewData.provider_hours}
                  </Typography>
                )}
                {propertyUrl && (
                  <Typography variant="body2">
                    <strong>元のURL:</strong>{' '}
                    <a
                      href={propertyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: SECTION_COLORS.buyer.main, textDecoration: 'underline' }}
                    >
                      {propertyUrl}
                    </a>
                  </Typography>
                )}
              </Box>
            </Box>
          )}

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
              <Button 
                size="small" 
                variant="contained" 
                startIcon={<PrintIcon />}
                onClick={() => setShowPrintSheet(true)}
                sx={{ 
                  backgroundColor: '#666', 
                  color: '#fff',
                  '&:hover': { backgroundColor: '#555' } 
                }}
              >
                印刷
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

          {/* P台数フィルター（物件種別が「土地」以外の場合のみ表示） */}
          {!selectedPropertyTypes.includes('土地') && (
            <Grid item xs={12} md={4}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: '2px solid',
                  borderColor: selectedParking === '指定なし' ? '#ff9800' : 'transparent',
                  backgroundColor: selectedParking === '指定なし' ? 'rgba(255, 152, 0, 0.1)' : 'transparent',
                  animation: selectedParking === '指定なし' ? 'pulse 2s ease-in-out infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': {
                      boxShadow: '0 0 0 0 rgba(255, 152, 0, 0.7)',
                    },
                    '50%': {
                      boxShadow: '0 0 0 8px rgba(255, 152, 0, 0)',
                    },
                  },
                }}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    mb: 1, 
                    color: selectedParking === '指定なし' ? '#ff9800' : 'text.secondary',
                    fontWeight: selectedParking === '指定なし' ? 'bold' : 'normal',
                  }}
                >
                  P台数 {selectedParking === '指定なし' && '⚠️ 入力してください'}
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
          )}

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
          setPreviewMode('edit'); // プレビューモードをリセット
          setTestEmail(''); // テストメールアドレスをリセット
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Email送信（{checkedBuyers.length}件）</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            選択した買主に個別にメールを送信します
          </Typography>
          
          {/* タブ切り替え */}
          <Tabs value={previewMode} onChange={(e, newValue) => setPreviewMode(newValue)}>
            <Tab label="編集" value="edit" />
            <Tab label="プレビュー" value="preview" />
          </Tabs>
          
          {previewMode === 'edit' ? (
            <>
              {/* テスト送信用メールアドレス */}
              <TextField
                label="テスト送信用メールアドレス（任意）"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                fullWidth
                placeholder="test@example.com"
                helperText="入力すると、選択した買主の代わりにこのアドレスにテスト送信されます"
                type="email"
              />
              
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
                  helperText="入力したコメントは「他の画像はこちらから」の下に表示されます"
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
            </>
          ) : (
            <Box sx={{ 
              border: '1px solid #ddd', 
              borderRadius: 1, 
              p: 2, 
              maxHeight: '500px', 
              overflowY: 'auto',
              backgroundColor: '#f9f9f9'
            }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                件名: {emailSubject}
              </Typography>
              <Box 
                sx={{ mt: 2 }}
                dangerouslySetInnerHTML={{ __html: emailBody }}
              />
            </Box>
          )}
          
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
            setPreviewMode('edit'); // プレビューモードをリセット
            setTestEmail(''); // テストメールアドレスをリセット
          }}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={sendEmails}
            disabled={sending || (!testEmail.trim() && checkedBuyers.length === 0)}
          >
            {sending ? '送信中...' : testEmail.trim() ? 'テスト送信' : `送信 (${checkedBuyers.length}件)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 配信履歴 */}
      {distributionHistory.length > 0 && (
        <Paper sx={{ p: 2, mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">配信履歴（最新50件）</Typography>
            {distributionHistory.some((h: any) => !h.land_area && h.source_url) && (
              <Button
                size="small"
                variant="outlined"
                onClick={async () => {
                  try {
                    setSnackbar({ open: true, message: '土地面積を補完中...（約14秒）', severity: 'info' });
                    const res = await api.post('/api/distribution-history/backfill-land-area');
                    const histRes = await api.get('/api/distribution-history');
                    setDistributionHistory(histRes.data);
                    setSnackbar({ open: true, message: `土地面積を${res.data.updated}件補完しました`, severity: 'success' });
                  } catch (err) {
                    setSnackbar({ open: true, message: '土地面積の補完に失敗しました', severity: 'error' });
                  }
                }}
              >
                土地面積を補完
              </Button>
            )}
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>配信日</TableCell>
                  <TableCell>物件住所</TableCell>
                  <TableCell>金額</TableCell>
                  <TableCell>土地面積</TableCell>
                  <TableCell>種別</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell>送信数</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {distributionHistory.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell>{new Date(h.sent_at).toLocaleDateString('ja-JP')}</TableCell>
                    <TableCell>{h.property_address}</TableCell>
                    <TableCell>{h.price}</TableCell>
                    <TableCell>{h.land_area || '-'}</TableCell>
                    <TableCell>{h.property_type || '-'}</TableCell>
                    <TableCell>
                      {h.source_url ? (
                        <a href={h.source_url} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline' }}>
                          リンク
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{h.sent_count}件</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

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

      {/* 印刷シート（モーダル表示） */}
      {showPrintSheet && previewData && (
        <PropertyPrintSheet 
          data={previewData} 
          onClose={() => setShowPrintSheet(false)} 
        />
      )}
    </Container>
  );
}
