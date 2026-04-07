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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';

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

export default function OtherCompanyDistributionPage() {
  const navigate = useNavigate();

  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('指定なし');
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.buyer.main }}>
          他社物件新着配信
        </Typography>
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
                    <TableCell>買主番号</TableCell>
                    <TableCell>氏名</TableCell>
                    <TableCell>希望エリア</TableCell>
                    <TableCell>希望種別</TableCell>
                    <TableCell>希望価格（戸建）</TableCell>
                    <TableCell>希望価格（マンション）</TableCell>
                    <TableCell>希望価格（土地）</TableCell>
                    <TableCell>最新状況</TableCell>
                    <TableCell>受付日</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {buyers.map(buyer => (
                    <TableRow
                      key={buyer.buyer_number}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/buyers/${buyer.buyer_number}`)}
                    >
                      <TableCell>{buyer.buyer_number}</TableCell>
                      <TableCell>{buyer.name}</TableCell>
                      <TableCell>{buyer.desired_area}</TableCell>
                      <TableCell>{buyer.desired_property_type}</TableCell>
                      <TableCell>{buyer.price_range_house || '-'}</TableCell>
                      <TableCell>{buyer.price_range_apartment || '-'}</TableCell>
                      <TableCell>{buyer.price_range_land || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={buyer.latest_status || '-'}
                          size="small"
                          color="default"
                        />
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
    </Container>
  );
}
