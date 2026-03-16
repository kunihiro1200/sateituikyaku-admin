import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Chip,
  Link,
  IconButton,
  Button,
  Checkbox,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';
import EmailConfirmationModal from '../components/EmailConfirmationModal';

interface BuyerCandidate {
  buyer_number: string;
  name: string | null;
  latest_status: string | null;
  desired_area: string | null;
  desired_property_type: string | null;
  reception_date: string | null;
  email: string | null;
  phone_number: string | null;
  inquiry_property_address: string | null;
}

interface BuyerCandidateResponse {
  candidates: BuyerCandidate[];
  total: number;
  property: {
    property_number: string;
    property_type: string | null;
    sales_price: number | null;
    distribution_areas: string | null;
    address: string | null;
  };
}

export default function BuyerCandidateListPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<BuyerCandidateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  useEffect(() => {
    if (propertyNumber) {
      fetchCandidates();
    }
  }, [propertyNumber]);

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/property-listings/${propertyNumber}/buyer-candidates`);
      setData(response.data);
    } catch (err: any) {
      console.error('Failed to fetch buyer candidates:', err);
      setError(err.response?.data?.error || '買主候補の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyerClick = (buyerNumber: string) => {
    navigate(`/buyers/${buyerNumber}`);
  };

  const handleBack = () => {
    navigate(`/property-listings/${propertyNumber}`);
  };

  // チェックボックスの全選択/全解除
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedBuyers(new Set(data?.candidates.map(c => c.buyer_number) || []));
    } else {
      setSelectedBuyers(new Set());
    }
  };

  // 個別のチェックボックス選択
  const handleSelectBuyer = (buyerNumber: string) => {
    const newSelected = new Set(selectedBuyers);
    if (newSelected.has(buyerNumber)) {
      newSelected.delete(buyerNumber);
    } else {
      newSelected.add(buyerNumber);
    }
    setSelectedBuyers(newSelected);
  };

  // メール送信（確認モーダルを開く）
  const handleSendEmail = () => {
    if (selectedBuyers.size === 0) {
      setSnackbar({ open: true, message: '買主を選択してください', severity: 'warning' });
      return;
    }
    if (!data) return;

    const selectedCandidates = data.candidates.filter(c => selectedBuyers.has(c.buyer_number));
    const candidatesWithEmail = selectedCandidates.filter(c => c.email && c.email.trim() !== '');

    if (candidatesWithEmail.length === 0) {
      setSnackbar({ open: true, message: '選択された買主にメールアドレスが登録されていません', severity: 'error' });
      return;
    }

    const publicUrl = `https://property-site-frontend-kappa.vercel.app/public/properties/${propertyNumber}`;
    const address = data.property.address || '物件';
    const subject = `${address}にご興味のある方へ、もうすぐ売りに出します！事前に内覧可能です！`;

    // 1件選択時: 実際の買主名を表示、複数件: {氏名}プレースホルダー
    let bodyTemplate: string;
    if (candidatesWithEmail.length === 1) {
      const buyerName = candidatesWithEmail[0].name || 'お客様';
      bodyTemplate = `${buyerName}様\n\nお世話になります。株式会社いふうの不動産事業部です。\n\n${address}を近々売りに出すことになりました！\nもしご興味がございましたら、誰よりも早く内覧することが可能となっておりますので、このメールにご返信頂けると嬉しいです。\n\n物件詳細: ${publicUrl}\n\nよろしくお願いいたします。\n━━━━━━━━━━━━━━━━\n大分市中央町1-3-30\n株式会社いふう\nTEL:097-533-2022\n━━━━━━━━━━━━━━━━`;
    } else {
      bodyTemplate = `{氏名}様\n\nお世話になります。株式会社いふうの不動産事業部です。\n\n${address}を近々売りに出すことになりました！\nもしご興味がございましたら、誰よりも早く内覧することが可能となっておりますので、このメールにご返信頂けると嬉しいです。\n\n物件詳細: ${publicUrl}\n\nよろしくお願いいたします。\n━━━━━━━━━━━━━━━━\n大分市中央町1-3-30\n株式会社いふう\nTEL:097-533-2022\n━━━━━━━━━━━━━━━━`;
    }

    setEmailSubject(subject);
    setEmailBody(bodyTemplate);
    setEmailModalOpen(true);
  };

  // メール送信確認後の実際の送信処理
  const handleConfirmSendEmail = async (subject: string, body: string) => {
    if (!data) return;

    const selectedCandidates = data.candidates.filter(c => selectedBuyers.has(c.buyer_number));
    const candidatesWithEmail = selectedCandidates.filter(c => c.email && c.email.trim() !== '');

    setSnackbar({ open: true, message: `メール送信中... (${candidatesWithEmail.length}件)`, severity: 'info' });

    const results = await Promise.allSettled(
      candidatesWithEmail.map(async (candidate) => {
        const buyerName = candidate.name || 'お客様';
        // {氏名}を実際の買主名に置換
        const personalizedBody = body.replace(/\{氏名\}/g, buyerName);
        return await api.post('/api/emails/send-distribution', {
          recipients: [candidate.email!],
          subject: subject,
          body: personalizedBody,
          from: 'tenant@ifoo-oita.com',
          cc: 'tenant@ifoo-oita.com',
        });
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    if (failedCount === 0) {
      setSnackbar({ open: true, message: `メールを送信しました (${successCount}件)\n各買主に個別に送信されました。`, severity: 'success' });
    } else {
      setSnackbar({ open: true, message: `メール送信が完了しました\n成功: ${successCount}件\n失敗: ${failedCount}件`, severity: 'warning' });
    }

    setSelectedBuyers(new Set());
  };

  // SMS送信機能
  const handleSendSms = async () => {
    if (selectedBuyers.size === 0) {
      setSnackbar({ open: true, message: '買主を選択してください', severity: 'warning' });
      return;
    }
    if (!data) return;

    const selectedCandidates = data.candidates.filter(c => selectedBuyers.has(c.buyer_number));
    const candidatesWithPhone = selectedCandidates.filter(c => c.phone_number && c.phone_number.trim() !== '');

    if (candidatesWithPhone.length === 0) {
      setSnackbar({ open: true, message: '選択された買主に電話番号が登録されていません', severity: 'error' });
      return;
    }

    const publicUrl = `https://property-site-frontend-kappa.vercel.app/public/properties/${propertyNumber}`;
    const address = data.property.address || '物件';
    const messageTemplate = `{name}様\n\n株式会社いふうです。\n${address}を近々売りに出すことになりました！\n誰よりも早く内覧可能です。ご興味がございましたらご返信ください。\n\n物件詳細: ${publicUrl}\n\n株式会社いふう\nTEL:097-533-2022`;

    try {
      setSnackbar({ open: true, message: `SMS送信中... (${candidatesWithPhone.length}件)`, severity: 'info' });

      const recipients = candidatesWithPhone.map(candidate => ({
        phoneNumber: candidate.phone_number!,
        name: candidate.name || 'お客様',
      }));

      const response = await api.post('/api/sms/send-bulk', {
        recipients,
        message: messageTemplate,
      });

      const result = response.data;
      if (result.failedCount === 0) {
        setSnackbar({ open: true, message: `SMSを送信しました (${result.successCount}件)\n各買主に個別に送信されました。`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: `SMS送信が完了しました\n成功: ${result.successCount}件\n失敗: ${result.failedCount}件`, severity: 'warning' });
      }

      setSelectedBuyers(new Set());
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      let errorMessage = 'SMS送信に失敗しました。';
      if (error.response?.status === 503) {
        errorMessage = 'SMS送信サービスが設定されていません。管理者に連絡してください。';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string | null): 'success' | 'warning' | 'default' => {
    if (!status) return 'default';
    if (status.includes('A')) return 'success';
    if (status.includes('B')) return 'warning';
    return 'default';
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            {error || 'データの取得に失敗しました'}
          </Typography>
          <Button variant="contained" onClick={handleBack} sx={{ mt: 2 }}>
            物件詳細に戻る
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3, zoom: '0.6' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack} size="large">
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon sx={{ color: SECTION_COLORS.property.main, fontSize: 32 }} />
              <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
                買主候補リスト
              </Typography>
              <Chip
                label={`${data.total}件`}
                size="medium"
                sx={{ bgcolor: SECTION_COLORS.property.main, color: 'white', fontWeight: 'bold' }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 5 }}>
              物件番号: {data.property.property_number}
              {data.property.distribution_areas && (
                <Typography component="span" variant="body2" fontWeight="bold" sx={{ ml: 2, color: SECTION_COLORS.property.main }}>
                  配信エリア: {data.property.distribution_areas}
                </Typography>
              )}
            </Typography>
          </Box>
        </Box>

        {/* SMS・メール送信ボタン */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {selectedBuyers.size > 0 && (
            <Typography variant="body1" color="text.secondary">
              {selectedBuyers.size}件選択中
            </Typography>
          )}
          <Button
            variant="outlined"
            startIcon={<SmsIcon />}
            onClick={handleSendSms}
            disabled={selectedBuyers.size === 0}
            sx={{
              borderColor: SECTION_COLORS.property.main,
              color: SECTION_COLORS.property.main,
              '&:hover': { borderColor: SECTION_COLORS.property.dark, backgroundColor: `${SECTION_COLORS.property.main}08` },
            }}
          >
            SMS送信
          </Button>
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
            onClick={handleSendEmail}
            disabled={selectedBuyers.size === 0}
            sx={{
              bgcolor: SECTION_COLORS.property.main,
              '&:hover': { bgcolor: SECTION_COLORS.property.dark },
            }}
          >
            メール送信
          </Button>
        </Box>
      </Box>

      {/* Property Info */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>物件情報</Typography>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">物件番号</Typography>
            <Typography variant="body1" fontWeight="medium">{data.property.property_number}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">所在地</Typography>
            <Typography variant="body1" fontWeight="medium">{data.property.address || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">種別</Typography>
            <Typography variant="body1" fontWeight="medium">{data.property.property_type || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">価格</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.property.sales_price ? `¥${data.property.sales_price.toLocaleString()}` : '-'}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Candidates Table */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            条件: 最新状況がA/B/C/不明を含む買主（受付日の最新順、最大50件）
          </Typography>
        </Box>

        {data.candidates.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">該当する買主候補がありません</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedBuyers.size > 0 && selectedBuyers.size < data.candidates.length}
                      checked={data.candidates.length > 0 && selectedBuyers.size === data.candidates.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem' }}>買主番号</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem' }}>氏名</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem' }}>メールアドレス</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem' }}>最新状況</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem' }}>問い合わせ物件住所</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem' }}>希望エリア</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem' }}>希望種別</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem' }}>受付日</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.candidates.map((candidate) => {
                  const isSelected = selectedBuyers.has(candidate.buyer_number);
                  return (
                    <TableRow
                      key={candidate.buyer_number}
                      hover
                      selected={isSelected}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: `${SECTION_COLORS.property.main}08` } }}
                    >
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onChange={() => handleSelectBuyer(candidate.buyer_number)} />
                      </TableCell>
                      <TableCell onClick={() => handleBuyerClick(candidate.buyer_number)}>
                        <Link
                          component="button"
                          variant="body1"
                          onClick={(e) => { e.stopPropagation(); handleBuyerClick(candidate.buyer_number); }}
                          sx={{ fontWeight: 'bold', color: SECTION_COLORS.property.main, fontSize: '1rem' }}
                        >
                          {candidate.buyer_number}
                        </Link>
                      </TableCell>
                      <TableCell onClick={() => handleBuyerClick(candidate.buyer_number)} sx={{ fontSize: '1rem' }}>
                        {candidate.name || '-'}
                      </TableCell>
                      <TableCell onClick={() => handleBuyerClick(candidate.buyer_number)} sx={{ fontSize: '1rem' }}>
                        {candidate.email || '-'}
                      </TableCell>
                      <TableCell onClick={() => handleBuyerClick(candidate.buyer_number)}>
                        {candidate.latest_status ? (
                          <Chip label={candidate.latest_status} size="small" color={getStatusColor(candidate.latest_status)} />
                        ) : '-'}
                      </TableCell>
                      <TableCell onClick={() => handleBuyerClick(candidate.buyer_number)} sx={{ fontSize: '1rem' }}>
                        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {candidate.inquiry_property_address || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell onClick={() => handleBuyerClick(candidate.buyer_number)} sx={{ fontSize: '1rem' }}>
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {candidate.desired_area || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell onClick={() => handleBuyerClick(candidate.buyer_number)} sx={{ fontSize: '1rem' }}>
                        {candidate.desired_property_type || '-'}
                      </TableCell>
                      <TableCell onClick={() => handleBuyerClick(candidate.buyer_number)} sx={{ fontSize: '1rem' }}>
                        {formatDate(candidate.reception_date)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* メール送信確認モーダル */}
      <EmailConfirmationModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        onConfirm={handleConfirmSendEmail}
        recipientCount={
          data?.candidates.filter(c => selectedBuyers.has(c.buyer_number) && c.email && c.email.trim() !== '').length || 0
        }
        defaultSubject={emailSubject}
        defaultBody={emailBody}
      />
    </Container>
  );
}
