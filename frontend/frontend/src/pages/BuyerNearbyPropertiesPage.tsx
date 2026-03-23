import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  IconButton,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Checkbox,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface PropertyListing {
  id: string;
  property_number: string;
  address: string;
  display_address?: string;
  property_type: string;
  price: number;
  atbb_status: string;
  sales_assignee?: string;
  floor_plan?: string;
  pet_consultation?: string;
  parking?: string;
  property_about?: string;
  pre_viewing_notes?: string;
  latitude?: number;
  longitude?: number;
}

interface BuyerInfo {
  buyer_number: string;
  name: string;
  email?: string;
  phone_number?: string;
}

const PUBLIC_BASE = 'https://property-site-frontend-kappa.vercel.app/public/properties';
const SIGNATURE_EMAIL = `\n\n*********************\n株式会社いふう\n大分市舞鶴町1-3-30\nTEL:097-533-2022（10時～18時）\nMail:tenant@ifoo-oita.com\n定休日：水曜\n*********************`;
const SIGNATURE_SMS = `\n\n株式会社いふう`;

export default function BuyerNearbyPropertiesPage() {
  const { buyer_number } = useParams<{ buyer_number: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const propertyNumber = searchParams.get('propertyNumber');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseProperty, setBaseProperty] = useState<PropertyListing | null>(null);
  const [nearbyProperties, setNearbyProperties] = useState<PropertyListing[]>([]);
  const [buyer, setBuyer] = useState<BuyerInfo | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // メール/SMSダイアログ
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  useEffect(() => {
    if (propertyNumber) {
      fetchAll();
    }
  }, [propertyNumber]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [nearbyRes, buyerRes] = await Promise.all([
        api.get(`/api/buyers/${buyer_number}/nearby-properties`, { params: { propertyNumber } }),
        api.get(`/api/buyers/${buyer_number}`),
      ]);
      setBaseProperty(nearbyRes.data.baseProperty);
      setNearbyProperties(nearbyRes.data.nearbyProperties || []);
      setBuyer(buyerRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // チェックボックス操作
  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === nearbyProperties.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(nearbyProperties.map(p => p.property_number)));
    }
  };

  const checkedProperties = nearbyProperties.filter(p => checkedIds.has(p.property_number));

  // URLリスト生成（チェックした物件）
  const buildUrlList = (props: PropertyListing[]) =>
    props.map(p => `${PUBLIC_BASE}/${p.property_number}`).join('\n');

  // メール本文生成
  const buildEmailBody = (props: PropertyListing[]) => {
    const buyerName = buyer?.name || '';
    const baseAddr = baseProperty?.address || '';
    const urls = buildUrlList(props);
    return `${buyerName}様\nこの度は${baseAddr}のお問合せをいただきありがとうございます。\n近隣の物件として下記物件もございますのでご興味ございましたら、お問合せくださいませ。\n\n${urls}${SIGNATURE_EMAIL}`;
  };

  // SMS本文生成
  const buildSmsBody = (props: PropertyListing[]) => {
    const buyerName = buyer?.name || '';
    const baseAddr = baseProperty?.address || '';
    const urls = buildUrlList(props);
    return `${buyerName}様\nこの度は${baseAddr}のお問合せをいただきありがとうございます。\n近隣の物件として下記物件もございますのでご興味ございましたら、お問合せくださいませ。\n\n${urls}${SIGNATURE_SMS}`;
  };

  const openEmailDialog = () => {
    const baseAddr = baseProperty?.address || '';
    setEmailSubject(`${baseAddr}の近隣物件のご紹介`);
    setEmailBody(buildEmailBody(checkedProperties));
    setEmailDialogOpen(true);
  };

  const openSmsDialog = () => {
    setSmsBody(buildSmsBody(checkedProperties));
    setSmsDialogOpen(true);
  };

  const sendEmail = async () => {
    if (!buyer) return;
    setSending(true);
    try {
      await api.post('/api/gmail/send', {
        buyerId: buyer.buyer_number,
        subject: emailSubject,
        body: emailBody,
        senderEmail: 'tenant@ifoo-oita.com',
        propertyIds: checkedProperties.map(p => p.id),
      });
      setEmailDialogOpen(false);
      setSnackbar({ open: true, message: 'メールを送信しました', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'メール送信に失敗しました', severity: 'error' });
    } finally {
      setSending(false);
    }
  };

  const sendSms = async () => {
    if (!buyer) return;
    setSending(true);
    try {
      await api.post(`/api/buyers/${buyer.buyer_number}/sms-history`, {
        templateId: 'nearby-properties',
        templateName: '近隣物件のご紹介',
        phoneNumber: buyer.phone_number || '',
        message: smsBody,
      });
      setSmsDialogOpen(false);
      setSnackbar({ open: true, message: 'SMS送信を記録しました', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'SMS送信に失敗しました', severity: 'error' });
    } finally {
      setSending(false);
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return '-';
    return `${(price / 10000).toFixed(0)}万円`;
  };

  const calcDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const formatDistance = (property: PropertyListing): string => {
    if (!baseProperty?.latitude || !baseProperty?.longitude) return '-';
    if (!property.latitude || !property.longitude) return '-';
    const d = calcDistanceKm(baseProperty.latitude, baseProperty.longitude, property.latitude, property.longitude);
    return `${d.toFixed(1)}km`;
  };

  const formatPropertyAbout = (property: PropertyListing) => {
    let text = property.property_about || property.pre_viewing_notes;
    if (!text) return '-';
    text = text.replace(/【こちらの物件について】\s*/g, '');
    return text;
  };

  const hasApartment = nearbyProperties.some(p => p.property_type === 'マンション');
  const allChecked = nearbyProperties.length > 0 && checkedIds.size === nearbyProperties.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate(`/buyers/${buyer_number}`)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          近隣物件 ({nearbyProperties.length}件)
        </Typography>
        <Button
          variant="contained"
          startIcon={<EmailIcon />}
          disabled={checkedIds.size === 0}
          onClick={openEmailDialog}
        >
          Email送信 ({checkedIds.size})
        </Button>
        <Button
          variant="outlined"
          startIcon={<SmsIcon />}
          disabled={checkedIds.size === 0}
          onClick={openSmsDialog}
        >
          SMS送信 ({checkedIds.size})
        </Button>
      </Box>

      {/* 基準物件 */}
      {baseProperty && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>基準物件</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip label={`物件番号: ${baseProperty.property_number}`} />
            <Chip label={`住所: ${baseProperty.address}`} />
            <Chip label={`価格: ${formatPrice(baseProperty.price)}`} />
            <Chip label={`種別: ${baseProperty.property_type}`} />
          </Box>
        </Paper>
      )}

      {/* 近隣物件テーブル */}
      <Paper>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">近隣物件一覧 ({nearbyProperties.length}件)</Typography>
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
                <TableCell>物件番号</TableCell>
                <TableCell>住所</TableCell>
                <TableCell>種別</TableCell>
                <TableCell align="right">価格</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>担当</TableCell>
                <TableCell>間取り</TableCell>
                {hasApartment && <TableCell>ペット</TableCell>}
                <TableCell>駐車場</TableCell>
                <TableCell align="right">距離</TableCell>
                <TableCell>内覧前伝達事項</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {nearbyProperties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasApartment ? 12 : 11} align="center">
                    近隣物件が見つかりませんでした
                  </TableCell>
                </TableRow>
              ) : (
                nearbyProperties.map((property) => (
                  <TableRow
                    key={property.id}
                    hover
                    selected={checkedIds.has(property.property_number)}
                  >
                    <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={checkedIds.has(property.property_number)}
                        onChange={() => toggleCheck(property.property_number)}
                      />
                    </TableCell>
                    <TableCell
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/property-listings/${property.property_number}`)}
                    >
                      {property.property_number}
                    </TableCell>
                    <TableCell>{property.display_address || property.address}</TableCell>
                    <TableCell>{property.property_type}</TableCell>
                    <TableCell align="right">{formatPrice(property.price)}</TableCell>
                    <TableCell>
                      <Chip
                        label={property.atbb_status}
                        size="small"
                        color={property.atbb_status?.includes('公開中') ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{property.sales_assignee || '-'}</TableCell>
                    <TableCell>{property.floor_plan || '-'}</TableCell>
                    {hasApartment && (
                      <TableCell>
                        {property.property_type === 'マンション' ? (property.pet_consultation || '-') : '-'}
                      </TableCell>
                    )}
                    <TableCell>{property.parking || '-'}</TableCell>
                    <TableCell align="right">{formatDistance(property)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '300px', minWidth: '200px' }}>
                      {formatPropertyAbout(property)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* メール送信ダイアログ */}
      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Email送信</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            宛先: {buyer?.email || '（メールアドレス未登録）'}
          </Typography>
          <TextField
            label="件名"
            value={emailSubject}
            onChange={e => setEmailSubject(e.target.value)}
            fullWidth
          />
          <TextField
            label="本文"
            value={emailBody}
            onChange={e => setEmailBody(e.target.value)}
            multiline
            rows={14}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={sendEmail}
            disabled={sending || !buyer?.email}
          >
            {sending ? '送信中...' : '送信'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SMS送信ダイアログ */}
      <Dialog open={smsDialogOpen} onClose={() => setSmsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>SMS送信</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            送信先: {buyer?.phone_number || '（電話番号未登録）'}
          </Typography>
          <TextField
            label="本文"
            value={smsBody}
            onChange={e => setSmsBody(e.target.value)}
            multiline
            rows={12}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSmsDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={sendSms}
            disabled={sending || !buyer?.phone_number}
          >
            {sending ? '記録中...' : '送信記録'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        message={snackbar.message}
      />
    </Container>
  );
}
