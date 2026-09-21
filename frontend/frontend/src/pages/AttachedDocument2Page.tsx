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
  Checkbox,
  FormControlLabel,
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
  landAreaVerified?: number;
  buildingArea?: number;
  buildingAreaVerified?: number;
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
    landAreaVerified?: number;
    buildingArea?: number;
    buildingAreaVerified?: number;
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
  // マンション用
  currently_listed_same_building_checked: boolean;
  same_building_sold_case_checked: boolean;
  nearby_mansion_sold_case_checked: boolean;
  management_fee: string;
  repair_reserve_fund: string;
  // マンション以外用
  current_nearby_listing: string;
  past_sold_case: string;
  boundary_stake: string;
  road_width: string;
  road_contact: string;
}

const EMPTY_FIELDS: DocumentFields = {
  elementary_school: '',
  junior_high_school: '',
  nearest_station: '',
  nearest_bus_stop: '',
  currently_listed_same_building_checked: false,
  same_building_sold_case_checked: false,
  nearby_mansion_sold_case_checked: false,
  management_fee: '',
  repair_reserve_fund: '',
  current_nearby_listing: '',
  past_sold_case: '',
  boundary_stake: '',
  road_width: '',
  road_contact: '',
};

type TextFieldKey = 'elementary_school' | 'junior_high_school' | 'nearest_station' | 'nearest_bus_stop';

const BASE_TEXT_FIELDS: Array<{ key: TextFieldKey; label: string }> = [
  { key: 'elementary_school', label: '小学校' },
  { key: 'junior_high_school', label: '中学校' },
  { key: 'nearest_station', label: '最寄り駅' },
  { key: 'nearest_bus_stop', label: '最寄りバス停' },
];

/** 万円表示のフォーマット */
const formatManYen = (amount?: number): string => {
  if (!amount) return '-';
  return `${Math.round(amount / 10000).toLocaleString()}万円`;
};

/** 印刷用の枠付きテキスト表示の共通スタイル */
const printFieldBoxSx = {
  width: '100%',
  minHeight: '6mm',
  border: '1px solid #999',
  borderRadius: '2px',
  px: 0.8,
  py: 0.4,
  fontSize: '9pt',
  whiteSpace: 'pre-wrap' as const,
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
        currently_listed_same_building_checked: !!d.currently_listed_same_building_checked,
        same_building_sold_case_checked: !!d.same_building_sold_case_checked,
        nearby_mansion_sold_case_checked: !!d.nearby_mansion_sold_case_checked,
        management_fee: d.management_fee || '',
        repair_reserve_fund: d.repair_reserve_fund || '',
        current_nearby_listing: d.current_nearby_listing || '',
        past_sold_case: d.past_sold_case || '',
        boundary_stake: d.boundary_stake || '',
        road_width: d.road_width || '',
        road_contact: d.road_contact || '',
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

  const handleFieldChange = (key: keyof DocumentFields, value: string | boolean) => {
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
  const landAreaVerified = seller?.property?.landAreaVerified ?? seller?.landAreaVerified;
  const buildingArea = seller?.property?.buildingArea ?? seller?.buildingArea;
  const buildingAreaVerified = seller?.property?.buildingAreaVerified ?? seller?.buildingAreaVerified;
  const buildYear = seller?.property?.buildYear ?? seller?.buildYear;
  const structure = seller?.property?.structure || seller?.structure || '-';
  const floorPlan = seller?.property?.floorPlan || seller?.floorPlan || '-';
  const currentStatus = seller?.property?.sellerSituation || seller?.property?.currentStatus || seller?.currentStatus || '-';

  // 種別がマンション（マ / マンション / apartment）かどうか判定
  const isMansionType = propertyType === 'apartment' || propertyType === 'マ' || propertyType === 'マンション';

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
            <Box sx={{ mb: 1.5, pb: 1, borderBottom: '2px solid #000' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '15pt', color: '#000' }}>
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
                <Paper variant="outlined" sx={{ p: 1, height: '100%' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '10pt', mb: 0.5 }}>物件情報</Typography>
                  <Box sx={{ fontSize: '8.5pt', lineHeight: 1.6 }}>
                    <div><strong>住所：</strong>{propertyAddress}</div>
                    <div><strong>種別：</strong>{propertyType}　<strong>現況：</strong>{currentStatus}</div>
                    <div>
                      <strong>土地：</strong>{landArea ? `${landArea}㎡` : '-'}
                      {landAreaVerified ? `（当社調べ：${landAreaVerified}㎡）` : ''}
                    </div>
                    <div>
                      <strong>建物：</strong>{buildingArea ? `${buildingArea}㎡` : '-'}
                      {buildingAreaVerified ? `（当社調べ：${buildingAreaVerified}㎡）` : ''}
                    </div>
                    <div><strong>築年：</strong>{buildYear || '-'}　<strong>構造：</strong>{structure}　<strong>間取り：</strong>{floorPlan}</div>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 1, height: '100%' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '10pt', mb: 0.5 }}>売主情報</Typography>
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
                <Paper variant="outlined" sx={{ p: 1 }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', color: 'text.secondary' }}>査定額</Typography>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '11pt' }}>{valuationDisplay}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 1 }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', color: 'text.secondary' }}>訪問予定日時</Typography>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '11pt' }}>{visitSchedule}</Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* コメント内容 */}
            <Paper variant="outlined" sx={{ p: 1, mb: 1.5 }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', color: 'text.secondary', mb: 0.3 }}>
                コメント内容
              </Typography>
              <Typography sx={{ fontSize: '8.5pt', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {commentText || '（コメントなし）'}
              </Typography>
            </Paper>

            {/* 下部：小学校・中学校・最寄り駅・最寄りバス停 */}
            <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
              {BASE_TEXT_FIELDS.map((f, idx) => (
                <Box
                  key={f.key}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 0.9,
                    borderBottom: idx < BASE_TEXT_FIELDS.length - 1 ? '1px solid #ccc' : 'none',
                  }}
                >
                  <Typography sx={{ width: 190, flexShrink: 0, fontWeight: 'bold', fontSize: '9.5pt' }}>
                    {f.label}
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    value={fields[f.key]}
                    onChange={(e) => handleFieldChange(f.key, e.target.value)}
                    className="no-print input-field"
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9.5pt' } }}
                  />
                  <Box className="print-only-field" sx={printFieldBoxSx}>
                    {fields[f.key] || '\u00A0'}
                  </Box>
                </Box>
              ))}
            </Paper>

            {/* 種別で分岐するセクション */}
            {isMansionType ? (
              <>
                {/* マンション：横並びチェックボックス3種 */}
                <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9.5pt', mb: 0.8 }}>近隣募集・成約事例</Typography>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={fields.currently_listed_same_building_checked}
                          onChange={(e) => handleFieldChange('currently_listed_same_building_checked', e.target.checked)}
                          className="no-print"
                        />
                      }
                      label={<Typography sx={{ fontSize: '9.5pt' }}>現在募集中（同マンション）</Typography>}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={fields.same_building_sold_case_checked}
                          onChange={(e) => handleFieldChange('same_building_sold_case_checked', e.target.checked)}
                          className="no-print"
                        />
                      }
                      label={<Typography sx={{ fontSize: '9.5pt' }}>同マンションの成約事例</Typography>}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={fields.nearby_mansion_sold_case_checked}
                          onChange={(e) => handleFieldChange('nearby_mansion_sold_case_checked', e.target.checked)}
                          className="no-print"
                        />
                      }
                      label={<Typography sx={{ fontSize: '9.5pt' }}>周辺のマンションの成約事例</Typography>}
                    />
                    {/* 印刷用：チェックボックス（□/■で表現） */}
                    <Box className="print-only-field" sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', fontSize: '9.5pt' }}>
                      <span>{fields.currently_listed_same_building_checked ? '☑' : '☐'} 現在募集中（同マンション）</span>
                      <span>{fields.same_building_sold_case_checked ? '☑' : '☐'} 同マンションの成約事例</span>
                      <span>{fields.nearby_mansion_sold_case_checked ? '☑' : '☐'} 周辺のマンションの成約事例</span>
                    </Box>
                  </Box>
                </Paper>

                {/* マンション：管理費・修繕積立金（横並び） */}
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontWeight: 'bold', fontSize: '9.5pt', flexShrink: 0 }}>管理費</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        value={fields.management_fee}
                        onChange={(e) => handleFieldChange('management_fee', e.target.value)}
                        className="no-print input-field"
                        sx={{ '& .MuiOutlinedInput-root': { fontSize: '9.5pt' } }}
                      />
                      <Box className="print-only-field" sx={printFieldBoxSx}>{fields.management_fee || '\u00A0'}</Box>
                    </Box>
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontWeight: 'bold', fontSize: '9.5pt', flexShrink: 0 }}>修繕積立金</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        value={fields.repair_reserve_fund}
                        onChange={(e) => handleFieldChange('repair_reserve_fund', e.target.value)}
                        className="no-print input-field"
                        sx={{ '& .MuiOutlinedInput-root': { fontSize: '9.5pt' } }}
                      />
                      <Box className="print-only-field" sx={printFieldBoxSx}>{fields.repair_reserve_fund || '\u00A0'}</Box>
                    </Box>
                  </Box>
                </Paper>
              </>
            ) : (
              <>
                {/* マンション以外：現在の近隣募集中・過去成約事例 */}
                <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
                  {[
                    { key: 'current_nearby_listing' as const, label: '現在の近隣募集中' },
                    { key: 'past_sold_case' as const, label: '過去成約事例' },
                  ].map((f, idx) => (
                    <Box
                      key={f.key}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        py: 0.9,
                        borderBottom: idx === 0 ? '1px solid #ccc' : 'none',
                      }}
                    >
                      <Typography sx={{ width: 190, flexShrink: 0, fontWeight: 'bold', fontSize: '9.5pt', pt: 0.7 }}>
                        {f.label}
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        multiline
                        minRows={2}
                        value={fields[f.key]}
                        onChange={(e) => handleFieldChange(f.key, e.target.value)}
                        className="no-print input-field"
                        sx={{ '& .MuiOutlinedInput-root': { fontSize: '9.5pt' } }}
                      />
                      <Box className="print-only-field" sx={{ ...printFieldBoxSx, minHeight: '14mm' }}>
                        {fields[f.key] || '\u00A0'}
                      </Box>
                    </Box>
                  ))}
                </Paper>

                {/* マンション以外：境界標・道路幅・接道（横並び） */}
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {[
                      { key: 'boundary_stake' as const, label: '境界標（杭）' },
                      { key: 'road_width' as const, label: '道路幅' },
                      { key: 'road_contact' as const, label: '接道' },
                    ].map((f) => (
                      <Box key={f.key} sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '9.5pt' }}>{f.label}</Typography>
                        <TextField
                          fullWidth
                          size="small"
                          variant="outlined"
                          value={fields[f.key]}
                          onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          className="no-print input-field"
                          sx={{ '& .MuiOutlinedInput-root': { fontSize: '9.5pt' } }}
                        />
                        <Box className="print-only-field" sx={printFieldBoxSx}>{fields[f.key] || '\u00A0'}</Box>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              </>
            )}
          </Box>
        </Container>
      </Box>
    </>
  );
}
