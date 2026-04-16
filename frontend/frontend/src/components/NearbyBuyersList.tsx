import React, { useState, useEffect } from 'react';
import {
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
  Alert,
  Chip,
  Link,
  Checkbox,
  Button,
  Snackbar,
} from '@mui/material';
import { Email as EmailIcon, Sms as SmsIcon } from '@mui/icons-material';
import api from '../services/api';
import EmailConfirmationModal from './EmailConfirmationModal';
import { buildPrintContent } from './nearbyBuyersPrintUtils';

interface NearbyBuyer {
  buyer_number: string;
  name: string;
  distribution_areas: string[];
  latest_status: string;
  viewing_date: string;
  reception_date?: string;
  inquiry_hearing?: string;
  viewing_result_follow_up?: string;
  email?: string;
  phone_number?: string;
  property_address?: string | null;
  inquiry_property_type?: string | null;
  inquiry_price?: number | null;
}

interface NearbyBuyersListProps {
  sellerId: string;
  propertyNumber?: string;
  onCountChange?: (count: number) => void;
}

interface PropertyDetails {
  address: string | null;
  landArea: number | null;
  buildingArea: number | null;
  buildYear: number | null;
  floorPlan: string | null;
}

const NearbyBuyersList = ({ sellerId, propertyNumber, onCountChange }: NearbyBuyersListProps) => {
  const [buyers, setBuyers] = useState<NearbyBuyer[]>([]);
  const [matchedAreas, setMatchedAreas] = useState<string[]>([]);
  const [propertyAddress, setPropertyAddress] = useState<string | null>(null);
  const [propertyNumberState, setPropertyNumberState] = useState<string | null>(null);
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [expandedAreaBuyer, setExpandedAreaBuyer] = useState<string | null>(null);
  const [isNameHidden, setIsNameHidden] = useState<boolean>(false);

  // ソート状態
  const [sortConfig, setSortConfig] = useState<{
    key: keyof NearbyBuyer | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // 配布エリアの短縮表示（括弧の前まで）
  const getShortArea = (area: string): string => {
    const parenIndex = area.indexOf('（');
    if (parenIndex > 0) return area.substring(0, parenIndex);
    return area;
  };

  // 配布エリアの詳細（括弧内）
  const getAreaDetail = (area: string): string | null => {
    const parenIndex = area.indexOf('（');
    if (parenIndex > 0) return area.substring(parenIndex);
    return null;
  };

  const handleAreaClick = (buyerNumber: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedAreaBuyer(expandedAreaBuyer === buyerNumber ? null : buyerNumber);
  };

  const handleSort = (key: keyof NearbyBuyer) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedBuyers = React.useMemo(() => {
    if (!sortConfig.key) return buyers;
    return [...buyers].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      if (sortConfig.key === 'viewing_date') {
        const aDate = new Date(aValue as string).getTime();
        const bDate = new Date(bValue as string).getTime();
        return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
      }
      if (sortConfig.key === 'inquiry_price') {
        const aNum = Number(aValue);
        const bNum = Number(bValue);
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortConfig.direction === 'asc'
        ? aStr.localeCompare(bStr, 'ja')
        : bStr.localeCompare(aStr, 'ja');
    });
  }, [buyers, sortConfig]);

  useEffect(() => {
    const fetchNearbyBuyers = async () => {
      try {
        setLoading(true);
        setError(null);
        setMessage(null);
        const response = await api.get(`/api/sellers/${sellerId}/nearby-buyers`);
        setBuyers(response.data.buyers || []);
        setMatchedAreas(response.data.matchedAreas || []);
        setPropertyAddress(response.data.propertyAddress);
        setPropertyDetails(response.data.propertyDetails || null);
        if (onCountChange) onCountChange((response.data.buyers || []).length);
        if (propertyNumber) {
          setPropertyNumberState(propertyNumber);
        } else {
          try {
            const sellerResponse = await api.get(`/api/sellers/${sellerId}`);
            const propertyNum = sellerResponse.data.propertyNumber;
            if (propertyNum) setPropertyNumberState(propertyNum);
          } catch (err) {
            console.warn('[NearbyBuyersList] Failed to fetch seller property number:', err);
          }
        }
        if (response.data.message) setMessage(response.data.message);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    if (sellerId) fetchNearbyBuyers();
  }, [sellerId, propertyNumber]);

  const handleBuyerClick = (buyerNumber: string) => {
    window.open(`/buyers/${buyerNumber}`, '_blank');
  };

  const getSortIcon = (key: keyof NearbyBuyer) => {
    if (sortConfig.key !== key) return ' ⇅';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedBuyers(new Set(sortedBuyers.map(b => b.buyer_number)));
    } else {
      setSelectedBuyers(new Set());
    }
  };

  const handleSelectBuyer = (buyerNumber: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelected = new Set(selectedBuyers);
    if (newSelected.has(buyerNumber)) {
      newSelected.delete(buyerNumber);
    } else {
      newSelected.add(buyerNumber);
    }
    setSelectedBuyers(newSelected);
  };

  // 名前非表示トグル
  const handleToggleNameHidden = () => {
    setIsNameHidden(prev => !prev);
  };

  // PDF印刷
  const handlePrint = () => {
    if (selectedBuyers.size === 0) {
      setSnackbar({ open: true, message: '印刷する行を選択してください', severity: 'warning' });
      return;
    }

    // 印刷用スタイルを動的に挿入
    const style = document.createElement('style');
    style.id = 'nearby-buyers-print-style';
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #nearby-buyers-print-root { display: block !important; }
      }
    `;
    document.head.appendChild(style);

    // 印刷用コンテンツをbodyに追加
    const printRoot = document.createElement('div');
    printRoot.id = 'nearby-buyers-print-root';
    printRoot.innerHTML = buildPrintContent(buyers, selectedBuyers, isNameHidden);
    document.body.appendChild(printRoot);

    // 印刷後にクリーンアップ
    const cleanup = () => {
      if (document.head.contains(style)) document.head.removeChild(style);
      if (document.body.contains(printRoot)) document.body.removeChild(printRoot);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    window.print();
  };

  // メール送信処理
  const handleSendEmail = async () => {
    if (selectedBuyers.size === 0) {
      setSnackbar({ open: true, message: '買主を選択してください', severity: 'warning' });
      return;
    }
    const selectedCandidates = sortedBuyers.filter(b => selectedBuyers.has(b.buyer_number));
    const candidatesWithEmail = selectedCandidates.filter(
      b => b.email && typeof b.email === 'string' && b.email.trim() !== ''
    );
    if (candidatesWithEmail.length === 0) {
      setSnackbar({ open: true, message: '選択された買主にメールアドレスが登録されていません', severity: 'error' });
      return;
    }
    const effectivePropertyNumber = propertyNumber || propertyNumberState;
    const publicUrl = effectivePropertyNumber
      ? `https://property-site-frontend-kappa.vercel.app/public/properties/${effectivePropertyNumber}`
      : '';
    const address = propertyAddress || '物件';
    const subject = `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`;
    let propertyInfoSection = '';
    if (propertyDetails) {
      const infoLines: string[] = [];
      if (propertyDetails.address) infoLines.push(`住所: ${propertyDetails.address}`);
      if (propertyDetails.landArea) infoLines.push(`土地面積: ${propertyDetails.landArea}㎡`);
      if (propertyDetails.buildingArea) infoLines.push(`建物面積: ${propertyDetails.buildingArea}㎡`);
      if (propertyDetails.buildYear) {
        const age = new Date().getFullYear() - propertyDetails.buildYear;
        infoLines.push(`築年: ${age}年`);
      }
      if (propertyDetails.floorPlan) infoLines.push(`間取り: ${propertyDetails.floorPlan}`);
      infoLines.push(`価格: 未定`);
      if (infoLines.length > 0) propertyInfoSection = '\n\n【物件情報】\n' + infoLines.join('\n');
    }
    const signature = `よろしくお願いいたします。\n×××××××××××××××\n大分市舞鶴町1-3-30\n株式会社いふう\nTEL:097-533-2022\n×××××××××××××××`;
    let bodyTemplate: string;
    if (candidatesWithEmail.length === 1) {
      const buyerName = candidatesWithEmail[0].name || 'お客様';
      bodyTemplate = `${buyerName}様\nお世話になります。不動産会社の株式会社いふうです。\n${address}を近々売りに出すことになりました！${propertyInfoSection}\n\nもしご興味がございましたら、誰よりも早く内覧することが可能となっておりますので、このメールにご返信頂ければと思います。\n${publicUrl ? `物件詳細：${publicUrl}\n\n` : ''}${signature}`;
    } else {
      bodyTemplate = `{氏名}様\nお世話になります。不動産会社の株式会社いふうです。\n${address}を近々売りに出すことになりました！${propertyInfoSection}\n\nもしご興味がございましたら、誰よりも早く内覧することが可能となっておりますので、このメールにご返信頂ければと思います。\n${publicUrl ? `物件詳細：${publicUrl}\n\n` : ''}${signature}`;
    }
    setEmailSubject(subject);
    setEmailBody(bodyTemplate);
    setEmailModalOpen(true);
  };

  const handleConfirmSendEmail = async (subject: string, body: string) => {
    const selectedCandidates = sortedBuyers.filter(b => selectedBuyers.has(b.buyer_number));
    const candidatesWithEmail = selectedCandidates.filter(
      b => b.email && typeof b.email === 'string' && b.email.trim() !== ''
    );
    try {
      setSnackbar({ open: true, message: `メール送信中... (${candidatesWithEmail.length}件)`, severity: 'info' });
      const results = await Promise.allSettled(
        candidatesWithEmail.map(async (candidate) => {
          const buyerName = candidate.name || 'お客様';
          const personalizedBody = body.replace(/{氏名}/g, buyerName);
          const effectivePropertyNumber = propertyNumber || propertyNumberState;
          return await api.post('/api/emails/send-distribution', {
            senderAddress: 'tenant@ifoo-oita.com', // 送信元アドレスを追加
            recipients: [{ email: candidate.email!, buyerNumber: candidate.buyer_number }], // buyer_numberを追加
            subject,
            body: personalizedBody,
            propertyNumber: effectivePropertyNumber || undefined, // 物件番号を追加
          });
        })
      );
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount === 0) {
        setSnackbar({ open: true, message: `メールを送信しました (${successCount}件)`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: `メール送信完了\n成功: ${successCount}件\n失敗: ${failedCount}件`, severity: 'warning' });
      }
      setSelectedBuyers(new Set());
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message || 'メール送信に失敗しました', severity: 'error' });
      throw error;
    }
  };

  // SMS送信処理
  const handleSendSms = async () => {
    if (selectedBuyers.size === 0) {
      setSnackbar({ open: true, message: '買主を選択してください', severity: 'warning' });
      return;
    }
    const selectedCandidates = sortedBuyers.filter(b => selectedBuyers.has(b.buyer_number));
    const candidatesWithPhone = selectedCandidates.filter(
      b => b.phone_number && typeof b.phone_number === 'string' && b.phone_number.trim() !== ''
    );
    if (candidatesWithPhone.length === 0) {
      setSnackbar({ open: true, message: '選択された買主に電話番号が登録されていません', severity: 'error' });
      return;
    }
    const effectivePropertyNumber = propertyNumber || propertyNumberState;
    const publicUrl = effectivePropertyNumber
      ? `https://property-site-frontend-kappa.vercel.app/public/properties/${effectivePropertyNumber}`
      : '';
    const address = propertyAddress || '物件';
    const firstCandidate = candidatesWithPhone[0];
    const buyerName = firstCandidate.name || 'お客様';
    let propertyInfoSection = '';
    if (propertyDetails) {
      const infoLines: string[] = [];
      if (propertyDetails.address) infoLines.push(`住所: ${propertyDetails.address}`);
      if (propertyDetails.landArea) infoLines.push(`土地面積: ${propertyDetails.landArea}㎡`);
      if (propertyDetails.buildingArea) infoLines.push(`建物面積: ${propertyDetails.buildingArea}㎡`);
      if (propertyDetails.buildYear) {
        const age = new Date().getFullYear() - propertyDetails.buildYear;
        infoLines.push(`築年: ${age}年`);
      }
      if (propertyDetails.floorPlan) infoLines.push(`間取り: ${propertyDetails.floorPlan}`);
      infoLines.push(`価格: 未定`);
      if (infoLines.length > 0) propertyInfoSection = '\n\n【物件情報】\n' + infoLines.join('\n');
    }
    const smsMessage = `${buyerName}様\n株式会社いふうです。\n${address}を近々売りに出すことになりました！${propertyInfoSection}\n\n誰よりも早く内覧可能です。ご興味がございましたらご返信ください。\n${publicUrl ? `${publicUrl}\n\n` : ''}株式会社いふう TEL:097-533-2022`;
    try {
      window.open(`sms:${firstCandidate.phone_number}?body=${encodeURIComponent(smsMessage)}`, '_blank');
      setSnackbar({
        open: true,
        message: candidatesWithPhone.length === 1
          ? `${buyerName}様へのSMSアプリを開きました`
          : `${buyerName}様へのSMSアプリを開きました（${candidatesWithPhone.length}件選択中、1件目のみ表示）`,
        severity: candidatesWithPhone.length === 1 ? 'success' : 'info',
      });
    } catch (error: any) {
      setSnackbar({ open: true, message: 'SMSアプリを開けませんでした', severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>;
  if (message) return <Alert severity="info" sx={{ mb: 2 }}>{message}</Alert>;
  if (buyers.length === 0) return <Alert severity="info" sx={{ mb: 2 }}>該当する買主はいません</Alert>;

  return (
    <Box>
      {/* エリア情報 */}
      {propertyAddress && matchedAreas.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            物件住所: {propertyAddress}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">該当エリア:</Typography>
            {matchedAreas.map((area, index) => (
              <Chip key={index} label={area} size="small" color="primary" variant="outlined" />
            ))}
          </Box>
        </Box>
      )}

      {/* アクションボタン */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<EmailIcon />}
          onClick={handleSendEmail}
          disabled={selectedBuyers.size === 0}
        >
          メール送信 ({selectedBuyers.size})
        </Button>
        <Button
          variant="contained"
          startIcon={<SmsIcon />}
          onClick={handleSendSms}
          disabled={selectedBuyers.size === 0}
          color="secondary"
        >
          SMS送信 ({selectedBuyers.size})
        </Button>
        <Button
          variant={isNameHidden ? 'contained' : 'outlined'}
          color="warning"
          onClick={handleToggleNameHidden}
        >
          {isNameHidden ? '名前表示' : '名前非表示'}
        </Button>
        <Button
          variant="outlined"
          onClick={handlePrint}
        >
          PDF
        </Button>
      </Box>

      {/* 買主リストテーブル */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedBuyers.size > 0 && selectedBuyers.size < sortedBuyers.length}
                  checked={sortedBuyers.length > 0 && selectedBuyers.size === sortedBuyers.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('buyer_number')}>
                買主番号{getSortIcon('buyer_number')}
              </TableCell>
              <TableCell sx={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
                名前{getSortIcon('name')}
              </TableCell>
              <TableCell sx={{ minWidth: 80, maxWidth: 150 }}>配布エリア</TableCell>
              <TableCell>問合せ物件情報</TableCell>
              <TableCell sx={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('inquiry_price')}>
                価格{getSortIcon('inquiry_price')}
              </TableCell>
              <TableCell>ヒアリング/内覧結果</TableCell>
              <TableCell sx={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('latest_status')}>
                最新状況{getSortIcon('latest_status')}
              </TableCell>
              <TableCell sx={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('viewing_date')}>
                内覧日{getSortIcon('viewing_date')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedBuyers.map((buyer) => {
              const hearingOrResult = buyer.viewing_result_follow_up || buyer.inquiry_hearing || '-';
              const isAreaExpanded = expandedAreaBuyer === buyer.buyer_number;
              return (
                <TableRow
                  key={buyer.buyer_number}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleBuyerClick(buyer.buyer_number)}
                  selected={selectedBuyers.has(buyer.buyer_number)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedBuyers.has(buyer.buyer_number)}
                      onChange={(e) => handleSelectBuyer(buyer.buyer_number, e as any)}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      component="button"
                      variant="body2"
                      onClick={(e) => { e.stopPropagation(); handleBuyerClick(buyer.buyer_number); }}
                      sx={{ textDecoration: 'none' }}
                    >
                      {buyer.buyer_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {isNameHidden ? (
                        <Box sx={{ position: 'relative', display: 'inline-block' }}>
                          <Typography variant="body2" sx={{ visibility: 'hidden', userSelect: 'none' }}>
                            {buyer.name || '-'}
                          </Typography>
                          <Box sx={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            height: '6px',
                            backgroundColor: 'black',
                            borderRadius: '1px',
                          }} />
                        </Box>
                      ) : (
                        <Typography variant="body2">{buyer.name || '-'}</Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {buyer.reception_date ? new Date(buyer.reception_date).toLocaleDateString('ja-JP') : '-'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ minWidth: 80, maxWidth: 150 }}>
                    {buyer.distribution_areas && buyer.distribution_areas.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {buyer.distribution_areas.map((area, index) => {
                          const shortArea = getShortArea(area);
                          const detail = getAreaDetail(area);
                          return (
                            <Chip
                              key={index}
                              label={isAreaExpanded && detail ? (
                                <span>{shortArea}<span style={{ fontSize: '0.85em', color: '#666' }}>{detail}</span></span>
                              ) : shortArea}
                              size="small"
                              variant="outlined"
                              onClick={(e) => detail ? handleAreaClick(buyer.buyer_number, e) : undefined}
                              sx={{ cursor: detail ? 'pointer' : 'default' }}
                            />
                          );
                        })}
                      </Box>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography variant="body2">種別: {buyer.inquiry_property_type || '-'}</Typography>
                      <Typography variant="body2" sx={{ maxWidth: 250 }}>問合せ住所: {buyer.property_address || '-'}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {buyer.inquiry_price ? `${buyer.inquiry_price.toLocaleString()}万円` : '-'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxWidth: 300 }}>
                      {hearingOrResult}
                    </Typography>
                  </TableCell>
                  <TableCell>{buyer.latest_status || '-'}</TableCell>
                  <TableCell>
                    {buyer.viewing_date ? new Date(buyer.viewing_date).toLocaleDateString('ja-JP') : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {buyers.length}件の買主が見つかりました
      </Typography>

      <EmailConfirmationModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        onConfirm={handleConfirmSendEmail}
        defaultSubject={emailSubject}
        defaultBody={emailBody}
        recipientCount={sortedBuyers.filter(b => selectedBuyers.has(b.buyer_number) && b.email).length}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NearbyBuyersList;
