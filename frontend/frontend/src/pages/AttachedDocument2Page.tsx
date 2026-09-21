import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Container,
  TextField,
  Grid,
} from '@mui/material';
import { ArrowBack, Print as PrintIcon, Save as SaveIcon } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface SellerData {
  id: string;
  sellerNumber?: string;
  name?: string;
  address?: string;
  postalCode?: string;
  propertyAddress?: string;
  property_address?: string;
  propertyType?: string;
  landArea?: number;
  buildingArea?: number;
  buildYear?: number;
  structure?: string;
  floorPlan?: string;
  currentStatus?: string;
  comments?: string;
  valuationAmount1?: number;
  valuationAmount2?: number;
  valuationAmount3?: number;
  valuationText?: string;
  appointmentDate?: string;
  visitDate?: string;
  visitTime?: string;
  property?: {
    address?: string;
    landArea?: number;
    buildingArea?: number;
    buildYear?: number;
    structure?: string;
    floorPlan?: string;
    propertyType?: string;
    sellerSituation?: string;
    currentStatus?: string;
  };
}

interface DocumentFields {
  elementary_school: string;
  junior_high_school: string;
  nearest_station: string;
  nearest_bus_stop: string;
  currently_listed_same_building: string;
  other_nearby_cases: string;
  comparison_list: string;
}

const EMPTY_FIELDS: DocumentFields = {
  elementary_school: '',
  junior_high_school: '',
  nearest_station: '',
  nearest_bus_stop: '',
  currently_listed_same_building: '',
  other_nearby_cases: '',
  comparison_list: '',
};

const FIELD_LABELS: Array<{ key: keyof DocumentFields; label: string; multiline?: boolean }> = [
  { key: 'elementary_school', label: '小学校' },
  { key: 'junior_high_school', label: '中学校' },
  { key: 'nearest_station', label: '最寄り駅' },
  { key: 'nearest_bus_stop', label: '最寄りバス停' },
  { key: 'currently_listed_same_building', label: '現在募集中（同マンション）', multiline: true },
  { key: 'other_nearby_cases', label: '他の周辺事例', multiline: true },
  { key: 'comparison_list', label: '比較リスト', multiline: true },
];

/** 万円表示のフォーマット */
const formatManYen = (amount?: number): string => {
  if (!amount) return '-';
  return `${Math.round(amount / 10000).toLocaleString()}万円`;
};

/** ⚠️ new Date() を使用しない（UTC解釈で+9時間ずれるため）文字列を直接パース */
const formatDateTime = (raw?: string): string => {
  if (!raw) return '-';
  const s = String(raw);
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
  }
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    return `${dateOnly[1]}/${dateOnly[2]}/${dateOnly[3]}`;
  }
  return s;
};

export default function AttachedDocument2Page() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employee } = useAuthStore();

  const [seller, setSeller] = useState<SellerData | null>(null);
  const [fields, setFields] = useState<DocumentFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [sellerRes, docRes] = await Promise.all([
        api.get<SellerData>(`/api/sellers/${id}`),
        api.get(`/api/sellers/${id}/attached-document2`),
      ]);
      setSeller(sellerRes.data);
      const d = docRes.data || {};
      setFields({
        elementary_school: d.elementary_school || '',
        junior_high_school: d.junior_high_school || '',
        nearest_station: d.nearest_station || '',
        nearest_bus_stop: d.nearest_bus_stop || '',
        currently_listed_same_building: d.currently_listed_same_building || '',
        other_nearby_cases: d.other_nearby_cases || '',
        comparison_list: d.comparison_list || '',
      });
      setIsDirty(false);
    } catch (err: any) {
      console.error('Failed to fetch attached-document2 data:', err);
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFieldChange = (key: keyof DocumentFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaveSuccess(false);
  };

  const handleSave = async (): Promise<boolean> => {
    if (!id) return false;
    try {
      setSaving(true);
      setError(null);
      await api.put(`/api/sellers/${id}/attached-document2`, {
        ...fields,
        updated_by: employee?.name || employee?.email || null,
      });
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      return true;
    } catch (err: any) {
      console.error('Failed to save attached-document2 data:', err);
      setError('保存に失敗しました');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    if (isDirty) {
      const ok = await handleSave();
      if (!ok) return;
    }
    window.print();
  };

  // 物件情報：property優先、なければsellerの直接フィールド
  const propertyAddress = seller?.property?.address || seller?.propertyAddress || seller?.property_address || '-';
  const propertyType = seller?.property?.propertyType || seller?.propertyType || '-';
  const landArea = seller?.property?.landArea ?? seller?.landArea;
  const buildingArea = seller?.property?.buildingArea ?? seller?.buildingArea;
  const buildYear = seller?.property?.buildYear ?? seller?.buildYear;
  const structure = seller?.property?.structure || seller?.structure || '-';
  const floorPlan = seller?.property?.floorPlan || seller?.floorPlan || '-';
  const currentStatus = seller?.property?.sellerSituation || seller?.property?.currentStatus || seller?.currentStatus || '-';

  // 査定額：valuationText（テキスト形式）があれば優先、なければ1/2/3を表示
  const valuationDisplay = seller?.valuationText
    ? seller.valuationText
    : [seller?.valuationAmount1, seller?.valuationAmount2, seller?.valuationAmount3]
        .filter((v): v is number => !!v)
        .map((v) => formatManYen(v))
        .join(' 〜 ') || '-';

  // 訪問予定日時：appointmentDateを優先、なければvisitDate
  const visitSchedule = formatDateTime((seller?.appointmentDate as string) || (seller?.visitDate as string));

  const commentText = seller?.comments || '';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <style>{`
        .print-only-field { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only-field { display: block !important; }
          body { margin: 0; padding: 0; }
          .print-page { width: 190mm; margin: 0 auto; }
          @page { size: A4; margin: 8mm; }
        }
        @media screen {
          .print-page { max-width: 800px; margin: 0 auto; }
        }
      `}</style>

      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* 画面ヘッダー */}
        <Box
          className="no-print"
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Button startIcon={<ArrowBack />} variant="outlined" onClick={() => navigate(-1)} size="small">
            戻る
          </Button>
          <Typography variant="h6" fontWeight="bold">
            添付資料２
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Button
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              variant="outlined"
              onClick={handleSave}
              disabled={saving || !isDirty}
              size="small"
              color={isDirty ? 'primary' : 'inherit'}
            >
              {saving ? '保存中...' : '保存'}
            </Button>
            <Button
              startIcon={<PrintIcon />}
              variant="contained"
              onClick={handlePrint}
              size="small"
              disabled={saving}
              sx={{ bgcolor: '#37474f', '&:hover': { bgcolor: '#263238' } }}
            >
              印刷
            </Button>
          </Box>
        </Box>

        {error && (
          <Box className="no-print" sx={{ px: 2, pt: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}
        {saveSuccess && (
          <Box className="no-print" sx={{ px: 2, pt: 2 }}>
            <Alert severity="success">保存しました</Alert>
          </Box>
        )}

        <Container maxWidth="md" sx={{ py: 3 }}>
          <Box className="print-page">
            {/* 印刷用タイトル */}
            <Box sx={{ mb: 1.5, pb: 1, borderBottom: '2px solid #1a237e' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '15pt', color: '#1a237e' }}>
                添付資料２
              </Typography>
              {seller?.sellerNumber && (
                <Typography sx={{ fontSize: '9pt', color: 'text.secondary' }}>
                  売主番号：{seller.sellerNumber}
                </Typography>
              )}
            </Box>

            {/* 物件情報・売主情報（2列） */}
            <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 1, height: '100%', bgcolor: '#f0f7f4' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '10pt', mb: 0.5 }}>📍 物件情報</Typography>
                  <Box sx={{ fontSize: '8.5pt', lineHeight: 1.6 }}>
                    <div><strong>住所：</strong>{propertyAddress}</div>
                    <div><strong>種別：</strong>{propertyType}　<strong>現況：</strong>{currentStatus}</div>
                    <div>
                      <strong>土地：</strong>{landArea ? `${landArea}㎡` : '-'}　
                      <strong>建物：</strong>{buildingArea ? `${buildingArea}㎡` : '-'}
                    </div>
                    <div><strong>築年：</strong>{buildYear || '-'}　<strong>構造：</strong>{structure}　<strong>間取り：</strong>{floorPlan}</div>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 1, height: '100%', bgcolor: '#f0f4ff' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '10pt', mb: 0.5 }}>👤 売主情報</Typography>
                  <Box sx={{ fontSize: '8.5pt', lineHeight: 1.6 }}>
                    <div><strong>氏名：</strong>{seller?.name || '-'}</div>
                    <div><strong>住所：</strong>{seller?.address || '-'}</div>
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            {/* 査定額・訪問予定日時 */}
            <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 1, bgcolor: '#fff8e1' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', color: 'text.secondary' }}>査定額</Typography>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '11pt' }}>{valuationDisplay}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 1, bgcolor: '#fce4ec' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', color: 'text.secondary' }}>訪問予定日時</Typography>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '11pt' }}>{visitSchedule}</Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* コメント内容 */}
            <Paper variant="outlined" sx={{ p: 1, mb: 1.5, bgcolor: '#fafafa' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', color: 'text.secondary', mb: 0.3 }}>
                コメント内容
              </Typography>
              <Typography sx={{ fontSize: '8.5pt', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {commentText || '（コメントなし）'}
              </Typography>
            </Paper>

            {/* 下部：項目 + 入力欄 */}
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              {FIELD_LABELS.map((f, idx) => (
                <Box
                  key={f.key}
                  sx={{
                    display: 'flex',
                    alignItems: f.multiline ? 'flex-start' : 'center',
                    gap: 1.5,
                    py: 0.9,
                    borderBottom: idx < FIELD_LABELS.length - 1 ? '1px solid #e0e0e0' : 'none',
                  }}
                >
                  <Typography
                    sx={{
                      width: 190,
                      flexShrink: 0,
                      fontWeight: 'bold',
                      fontSize: '9.5pt',
                      pt: f.multiline ? 0.7 : 0,
                    }}
                  >
                    {f.label}
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    multiline={f.multiline}
                    minRows={f.multiline ? 2 : 1}
                    value={fields[f.key]}
                    onChange={(e) => handleFieldChange(f.key, e.target.value)}
                    className="no-print input-field"
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9.5pt' } }}
                  />
                  {/* 印刷用：枠付きテキスト表示（TextFieldは印刷時に枠が乱れやすいため専用表示） */}
                  <Box
                    className="print-only-field"
                    sx={{
                      width: '100%',
                      minHeight: f.multiline ? '14mm' : '6mm',
                      border: '1px solid #999',
                      borderRadius: '2px',
                      px: 0.8,
                      py: 0.4,
                      fontSize: '9pt',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {fields[f.key] || '\u00A0'}
                  </Box>
                </Box>
              ))}
            </Paper>
          </Box>
        </Container>
      </Box>
    </>
  );
}
