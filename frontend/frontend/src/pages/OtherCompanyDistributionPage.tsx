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
  TextField,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
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
}

// エリア選択肢（①～㊸）
const AREA_OPTIONS = [
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧',
  '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯',
  '⑰', '⑱', '⑲', '⑳', '㉑', '㉒', '㉓', '㉔',
  '㉕', '㉖', '㉗', '㉘', '㉙', '㉚', '㉛', '㉜',
  '㉝', '㉞', '㉟', '㊱', '㊲', '㊳',
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  // 価格帯を表示用にフォーマット
  const formatPriceRange = (buyer: Buyer): string => {
    const prices = [
      buyer.price_range_house,
      buyer.price_range_apartment,
      buyer.price_range_land,
    ].filter(Boolean);
    return prices.length > 0 ? prices[0]! : '-';
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
                  <MenuItem key={area} value={area}>{area}</MenuItem>
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
        ) : isMobile ? (
          // モバイル表示（カード形式）
          <Box sx={{ p: 2 }}>
            {buyers.map(buyer => (
              <Card
                key={buyer.buyer_number}
                sx={{
                  mb: 2,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: `${SECTION_COLORS.buyer.main}10`,
                  },
                }}
                onClick={() => navigate(`/buyers/${buyer.buyer_number}`)}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {buyer.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    買主番号: {buyer.buyer_number}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    希望エリア: {buyer.desired_area}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    希望種別: {buyer.desired_property_type}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    希望価格: {formatPriceRange(buyer)}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : (
          // デスクトップ表示（テーブル形式）
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>買主番号</TableCell>
                  <TableCell>氏名</TableCell>
                  <TableCell>希望エリア</TableCell>
                  <TableCell>希望種別</TableCell>
                  <TableCell>希望価格</TableCell>
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
                    <TableCell>{formatPriceRange(buyer)}</TableCell>
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
