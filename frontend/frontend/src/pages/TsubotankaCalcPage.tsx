import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { SECTION_COLORS } from '../theme/sectionColors';

// 坪換算係数（1㎡ = 0.3025坪）
const SQM_TO_TSUBO = 0.3025;

interface LocationState {
  landAreaSqm?: number | null;  // 土地面積（㎡）
  price?: number | null;        // 現状価格（円単位）
}

// 仲介手数料計算（万円単位）
// 800万円以下: 一律33万円（税込）
// 800万円超: (売買価格 × 3% + 6万円) × 1.1（税込）
const calcChuckai = (priceMan: number): number => {
  if (priceMan <= 800) return 33;
  return Math.round((priceMan * 0.03 + 6) * 1.1 * 10) / 10;
};

export default function TsubotankaCalcPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const state = location.state as LocationState | null;

  // 坪数（入力値）
  const [tsuboInput, setTsuboInput] = useState<string>('');
  // 現状価格（万円単位で入力）
  const [priceInput, setPriceInput] = useState<string>('');

  // 初期値をstate（同タブ遷移）またはsessionStorage（新タブ）から設定
  useEffect(() => {
    const stored = sessionStorage.getItem(`tsubotanka_${propertyNumber}`);
    const data: LocationState | null = stored ? JSON.parse(stored) : state;

    if (data?.landAreaSqm) {
      const tsubo = data.landAreaSqm * SQM_TO_TSUBO;
      setTsuboInput(String(Math.round(tsubo * 10) / 10));
    }
    if (data?.price && data.price > 0) {
      const man = Math.floor(data.price / 10000);
      setPriceInput(String(man));
    }
  }, []);

  const tsubo = parseFloat(tsuboInput) || 0;
  const priceMan = parseFloat(priceInput) || 0; // 万円単位

  // 坪単価を1万円刻みで下げ、売買価格 = 坪単価 × 坪数 を表示
  const calcRows = () => {
    if (tsubo <= 0 || priceMan <= 0) return [];

    const rows: { price: number; tsubotanka: number; isCurrentPrice: boolean }[] = [];

    // 現状の坪単価（小数点1桁）
    const currentTsubotanka = Math.round((priceMan / tsubo) * 10) / 10;

    // 1行目：現状価格（入力値）と坪単価
    rows.push({
      price: priceMan,
      tsubotanka: currentTsubotanka,
      isCurrentPrice: true,
    });

    // 2行目以降：坪単価を1万円刻みで下げ、売買価格 = 坪単価（整数） × 坪数
    let t = Math.floor(currentTsubotanka); // 現状坪単価の切り捨て整数から開始
    while (t >= 1 && rows.length <= 30) {
      const price = Math.round(t * tsubo); // 坪単価 × 坪数（万円）
      rows.push({
        price,
        tsubotanka: t,
        isCurrentPrice: false,
      });
      t--;
    }

    return rows;
  };

  const rows = calcRows();

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton
          onClick={() => navigate(`/property-listings/${propertyNumber}/report`)}
          size="small"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight="bold" color={SECTION_COLORS.property.main}>
          坪単価計算
        </Typography>
        {propertyNumber && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {propertyNumber}
          </Typography>
        )}
      </Box>

      {/* 入力エリア */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2 }}>
          {/* 坪数入力 */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
              坪数
            </Typography>
            <TextField
              value={tsuboInput}
              onChange={(e) => setTsuboInput(e.target.value)}
              placeholder="例: 80"
              size="small"
              fullWidth
              type="number"
              inputProps={{ step: '0.1', min: '0' }}
              InputProps={{
                endAdornment: (
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                    坪
                  </Typography>
                ),
              }}
            />
            {state?.landAreaSqm && (
              <Typography variant="caption" color="text.secondary">
                土地面積 {state.landAreaSqm}㎡ から換算
              </Typography>
            )}
          </Box>

          {/* 現状価格入力 */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
              現状価格
            </Typography>
            <TextField
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="例: 3000"
              size="small"
              fullWidth
              type="number"
              inputProps={{ step: '10', min: '0' }}
              InputProps={{
                endAdornment: (
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                    万円
                  </Typography>
                ),
              }}
            />
          </Box>
        </Box>

        {/* 現在の坪単価 */}
        {tsubo > 0 && priceMan > 0 && (
          <Box sx={{ mt: 2, p: 1.5, backgroundColor: SECTION_COLORS.property.light || '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              現在の坪単価：
              <Typography component="span" variant="body1" fontWeight="bold" color={SECTION_COLORS.property.main}>
                {Math.round((priceMan / tsubo) * 10) / 10} 万円/坪
              </Typography>
            </Typography>
          </Box>
        )}
      </Paper>

      {/* 坪単価テーブル */}
      {rows.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="body2" fontWeight="bold" color="text.secondary" sx={{ mb: 2 }}>
            坪単価 → 売買価格 一覧（1万円刻み）
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>坪</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', fontSize: '0.8rem' }}>
                    坪単価
                  </TableCell>
                  <TableCell sx={{ width: 60, fontSize: '0.8rem' }} />
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', fontSize: '0.8rem' }}>
                    売買価格
                  </TableCell>
                  <TableCell sx={{ width: 24 }} />
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', fontSize: '0.8rem' }}>
                    仲介手数料
                  </TableCell>
                  <TableCell sx={{ width: 24 }} />
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', fontSize: '0.8rem' }}>
                    手元残
                  </TableCell>
                  <TableCell sx={{ width: 24 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index) => {
                  const chuckai = calcChuckai(row.price);
                  const temotozan = Math.round((row.price - chuckai) * 10) / 10;
                  return (
                  <TableRow
                    key={index}
                    sx={{
                      backgroundColor: row.isCurrentPrice
                        ? '#fff3e0'
                        : index % 2 === 0
                        ? 'white'
                        : '#fafafa',
                    }}
                  >
                    {/* 坪数列（最初の行のみ表示） */}
                    <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                      {index === 0 ? `${tsubo} 坪` : ''}
                    </TableCell>
                    {/* 坪単価 */}
                    <TableCell sx={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: row.isCurrentPrice ? 'bold' : 'normal', color: row.isCurrentPrice ? SECTION_COLORS.property.main : 'inherit' }}>
                      {row.tsubotanka}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      万円/坪
                    </TableCell>
                    {/* 売買価格 */}
                    <TableCell sx={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: row.isCurrentPrice ? 'bold' : 'normal' }}>
                      {row.isCurrentPrice ? (
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                          <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                            現状価格→
                          </Typography>
                          <span>{row.price.toLocaleString('ja-JP')}</span>
                        </Box>
                      ) : (
                        row.price.toLocaleString('ja-JP')
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      万円
                    </TableCell>
                    {/* 仲介手数料 */}
                    <TableCell sx={{ textAlign: 'right', fontSize: '0.85rem', color: '#c62828' }}>
                      {chuckai.toLocaleString('ja-JP')}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      万円
                    </TableCell>
                    {/* 手元残 */}
                    <TableCell sx={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', color: '#1b5e20' }}>
                      {temotozan.toLocaleString('ja-JP')}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      万円
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* 入力前のメッセージ */}
      {rows.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            坪数と現状価格を入力すると、坪単価の一覧が表示されます。
          </Typography>
        </Paper>
      )}
    </Container>
  );
}
