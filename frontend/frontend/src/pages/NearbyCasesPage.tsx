import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Alert,
  Snackbar,
  Link,
  Chip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ContentCopy as ContentCopyIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';

interface LocationState {
  suumoUrl?: string;
  address?: string;
  price?: number | null;
  landArea?: number | null;
  propertyType?: string;
}

interface NearbyCase {
  title: string;
  price: string;
  address: string;
  area: string;
  tsubo: string;
  tsubo_tanka: string;
  building_condition: string;
  url: string;
}

// 価格文字列を万円の数値に変換（比較用）
const parsePriceMan = (priceStr: string): number => {
  if (!priceStr || priceStr === '-') return 0;
  // 「1260万円」→ 1260、「1193万5000円〜1302万8000円」→ 1193（最小値）
  const m = priceStr.match(/([0-9,]+)万/);
  if (!m) return 0;
  return parseInt(m[1].replace(',', ''), 10);
};

// メール貼り付け用のテキスト表を生成
const buildTableText = (
  cases: NearbyCase[],
  targetPrice: number | null,
  targetAddress: string
): string => {
  const header = `【周辺土地事例】（SUUMO掲載中）\n${'─'.repeat(80)}\n`;
  const colHeader = `  No │ 所在地                   │ 価格        │ 面積（坪）  │ 坪単価     │ 建築条件\n`;
  const separator = `────┼──────────────────────────┼─────────────┼─────────────┼────────────┼──────────\n`;

  const rows = cases
    .map((c, i) => {
      const no = String(i + 1).padStart(3, ' ');
      const addr = c.address.slice(0, 22).padEnd(22, '　');
      const price = c.price.padEnd(11, '　');
      const area = `${c.area} (${c.tsubo})`.slice(0, 11).padEnd(11, '　');
      const tanka = c.tsubo_tanka.padEnd(10, '　');
      const cond = c.building_condition;
      return `  ${no} │ ${addr} │ ${price} │ ${area} │ ${tanka} │ ${cond}`;
    })
    .join('\n');

  const targetInfo = targetPrice
    ? `\n${'─'.repeat(80)}\n★ 対象物件（${targetAddress}）: ${Math.floor(targetPrice / 10000).toLocaleString('ja-JP')}万円`
    : '';

  return header + colHeader + separator + rows + targetInfo;
};

export default function NearbyCasesPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const state = location.state as LocationState | null;

  const [cases, setCases] = useState<NearbyCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [suumoUrl, setSuumoUrl] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [price, setPrice] = useState<number | null>(null);
  const [landArea, setLandArea] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // 初期データをstate（同タブ遷移）またはsessionStorage（新タブ）から読み込む
  useEffect(() => {
    const stored = sessionStorage.getItem(`nearby_cases_${propertyNumber}`);
    const data: LocationState | null = stored ? JSON.parse(stored) : state;

    if (data) {
      setSuumoUrl(data.suumoUrl || '');
      setAddress(data.address || '');
      setPrice(data.price ?? null);
      setLandArea(data.landArea ?? null);
      setPropertyType(data.propertyType || '');

      if (data.suumoUrl) {
        fetchCases(data.suumoUrl);
      } else {
        setError('SUUMO URLが設定されていません。報告ページでSUUMO URLを登録してください。');
      }
    } else {
      // stateもsessionStorageもない場合はAPIから物件情報を取得
      fetchPropertyData();
    }
  }, [propertyNumber]);

  const fetchPropertyData = async () => {
    if (!propertyNumber) return;
    try {
      const res = await api.get(`/api/property-listings/${propertyNumber}`);
      const d = res.data;
      const url = d.suumo_url || '';
      setSuumoUrl(url);
      setAddress(d.address || d.property_address || '');
      setPrice(d.price ?? null);
      setLandArea(d.land_area ?? null);
      setPropertyType(d.property_type || '');
      if (url) {
        fetchCases(url);
      } else {
        setError('SUUMO URLが設定されていません。報告ページでSUUMO URLを登録してください。');
      }
    } catch {
      setError('物件データの取得に失敗しました。');
    }
  };

  const fetchCases = async (url: string) => {
    if (!propertyNumber || !url) return;
    setLoading(true);
    setError(null);
    setCases([]);
    try {
      const res = await api.get(`/api/property-listings/${propertyNumber}/nearby-cases`, {
        params: { suumo_url: url },
      });
      setCases(res.data.cases || []);
      setSourceUrl(res.data.source_url || '');
    } catch (err: any) {
      const msg = err.response?.data?.error || '周辺事例の取得に失敗しました';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 自物件の坪単価を計算
  const targetTsubo = landArea ? Math.round((landArea / 3.30578) * 10) / 10 : null;
  const targetPriceMan = price ? Math.floor(price / 10000) : null;
  const targetTsubotanka =
    targetTsubo && targetPriceMan
      ? Math.round((targetPriceMan / targetTsubo) * 10) / 10
      : null;

  // クリップボードにテキスト表をコピー
  const handleCopyText = async () => {
    const text = buildTableText(cases, price, address);
    try {
      await navigator.clipboard.writeText(text);
      setSnackbar({ open: true, message: 'メール貼り付け用テキストをコピーしました', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'コピーに失敗しました', severity: 'error' });
    }
  };

  // HTML表をクリップボードにコピー（Gmailに貼り付けるとテーブル形式になる）
  const handleCopyHtmlTable = async () => {
    const priceManStr = targetPriceMan ? `${targetPriceMan.toLocaleString('ja-JP')}万円` : '-';
    const tsuboStr = targetTsubo ? `${targetTsubo}坪` : '-';
    const tankaStr = targetTsubotanka ? `<b>${targetTsubotanka}万円/坪</b>` : '-';

    const theadHtml = `
      <tr style="background:#e3f2fd;">
        <th style="padding:6px 10px;border:1px solid #bbb;text-align:center;">No</th>
        <th style="padding:6px 10px;border:1px solid #bbb;">所在地</th>
        <th style="padding:6px 10px;border:1px solid #bbb;text-align:right;">価格</th>
        <th style="padding:6px 10px;border:1px solid #bbb;text-align:right;">面積</th>
        <th style="padding:6px 10px;border:1px solid #bbb;text-align:right;">坪数</th>
        <th style="padding:6px 10px;border:1px solid #bbb;text-align:right;">坪単価</th>
        <th style="padding:6px 10px;border:1px solid #bbb;text-align:center;">建築条件</th>
      </tr>`;

    const tbodyHtml = cases
      .map(
        (c, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center;">${i + 1}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;">${c.address !== '-' ? c.address : ''}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;">${c.price}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;">${c.area}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;">${c.tsubo}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;"><b>${c.tsubo_tanka}</b></td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center;">${c.building_condition}</td>
      </tr>`
      )
      .join('');

    // 対象物件行
    const targetRow = `
      <tr style="background:#fff8e1;font-weight:bold;">
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center;">★</td>
        <td style="padding:5px 10px;border:1px solid #ddd;">${address}（対象物件）</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;">${priceManStr}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;">${landArea ? `${landArea}㎡` : '-'}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;">${tsuboStr}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;">${tankaStr}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center;">${propertyType || '-'}</td>
      </tr>`;

    const html = `
<table style="border-collapse:collapse;font-size:13px;font-family:sans-serif;">
  <thead>${theadHtml}</thead>
  <tbody>${tbodyHtml}${targetRow}</tbody>
</table>
<p style="font-size:11px;color:#888;margin-top:6px;">出典：SUUMO掲載中物件（${new Date().toLocaleDateString('ja-JP')}時点）</p>`;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([buildTableText(cases, price, address)], { type: 'text/plain' }),
        }),
      ]);
      setSnackbar({ open: true, message: 'HTMLテーブルをコピーしました（Gmailに貼り付けると表になります）', severity: 'success' });
    } catch {
      // ClipboardItemが非対応の場合はテキストのみコピー
      handleCopyText();
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <IconButton
          onClick={() => navigate(`/property-listings/${propertyNumber}/report`)}
          size="small"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight="bold" color={SECTION_COLORS.property.main}>
          周辺事例
        </Typography>
        {propertyNumber && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {propertyNumber}
          </Typography>
        )}
        {address && (
          <Typography variant="body2" color="text.secondary">
            — {address}
          </Typography>
        )}
      </Box>

      {/* 対象物件の情報 */}
      {(targetPriceMan || targetTsubo) && (
        <Paper sx={{ p: 2, mb: 2, backgroundColor: '#fff8e1', border: '1px solid #ffe082' }}>
          <Typography variant="body2" fontWeight="bold" color="text.secondary" sx={{ mb: 0.5 }}>
            ★ 対象物件（{propertyNumber}）
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            {targetPriceMan && (
              <Typography variant="body2">
                価格：<strong>{targetPriceMan.toLocaleString('ja-JP')}万円</strong>
              </Typography>
            )}
            {targetTsubo && (
              <Typography variant="body2">
                面積：<strong>{landArea}㎡（{targetTsubo}坪）</strong>
              </Typography>
            )}
            {targetTsubotanka && (
              <Typography variant="body2">
                坪単価：
                <Typography
                  component="span"
                  variant="body2"
                  fontWeight="bold"
                  sx={{ color: SECTION_COLORS.property.main, fontSize: '1.05rem' }}
                >
                  {targetTsubotanka}万円/坪
                </Typography>
              </Typography>
            )}
            {propertyType && <Chip label={propertyType} size="small" />}
          </Box>
        </Paper>
      )}

      {/* アクションボタン */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {cases.length > 0 && (
          <>
            <Button
              variant="contained"
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyHtmlTable}
              sx={{
                backgroundColor: '#1a73e8',
                '&:hover': { backgroundColor: '#1557b0' },
              }}
            >
              メール用テーブルをコピー
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyText}
              sx={{ borderColor: '#666', color: '#666' }}
            >
              テキストをコピー
            </Button>
          </>
        )}
        <Button
          variant="outlined"
          size="small"
          startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={() => suumoUrl && fetchCases(suumoUrl)}
          disabled={loading || !suumoUrl}
        >
          再取得
        </Button>
        {sourceUrl && (
          <Link
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.3 }}
          >
            SUUMO一覧を開く <OpenInNewIcon sx={{ fontSize: '0.9rem' }} />
          </Link>
        )}
      </Box>

      {/* エラー表示 */}
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
          {!suumoUrl && (
            <Box sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => navigate(`/property-listings/${propertyNumber}/report`)}
              >
                報告ページでSUUMO URLを登録する
              </Button>
            </Box>
          )}
        </Alert>
      )}

      {/* ローディング */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              SUUMOから周辺事例を取得中...
            </Typography>
          </Box>
        </Box>
      )}

      {/* 周辺事例テーブル */}
      {!loading && cases.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="body2" fontWeight="bold" color="text.secondary">
              周辺販売中土地（{cases.length}件）
            </Typography>
            <Typography variant="caption" color="text.secondary">
              出典：SUUMO　{new Date().toLocaleDateString('ja-JP')}時点
            </Typography>
          </Box>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', minWidth: 36 }}>No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 180 }}>物件名・所在地</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>価格</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>面積</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>坪数</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>坪単価</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' }}>建築条件</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cases.map((c, i) => {
                  const isTarget =
                    suumoUrl && c.url && suumoUrl.includes(c.url.replace('https://suumo.jp', ''));
                  return (
                    <TableRow
                      key={i}
                      sx={{
                        backgroundColor: isTarget
                          ? '#fff3e0'
                          : i % 2 === 0
                          ? 'white'
                          : '#fafafa',
                        '&:hover': { backgroundColor: '#f0f0f0' },
                      }}
                    >
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        {isTarget ? '★' : i + 1}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', maxWidth: 260 }}>
                        {c.url ? (
                          <Link
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontSize: '0.82rem', display: 'block', mb: 0.3 }}
                          >
                            {c.title}
                          </Link>
                        ) : (
                          <Typography variant="body2" sx={{ fontSize: '0.82rem', mb: 0.3 }}>
                            {c.title}
                          </Typography>
                        )}
                        {c.address !== '-' && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {c.address}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {c.price}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {c.area}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {c.tsubo}
                      </TableCell>
                      {/* 坪単価は太字で強調 */}
                      <TableCell
                        sx={{
                          textAlign: 'right',
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          whiteSpace: 'nowrap',
                          color: SECTION_COLORS.property.main,
                        }}
                      >
                        {c.tsubo_tanka}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        <Chip
                          label={c.building_condition}
                          size="small"
                          variant="outlined"
                          color={c.building_condition === 'なし' ? 'success' : c.building_condition === 'あり' ? 'warning' : 'default'}
                          sx={{ fontSize: '0.72rem', height: 20 }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* 取得結果が0件 */}
      {!loading && !error && cases.length === 0 && suumoUrl && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            周辺事例が見つかりませんでした。SUUMOのエリアページに物件が掲載されていない可能性があります。
          </Typography>
          <Button
            variant="outlined"
            size="small"
            href={sourceUrl || suumoUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mt: 2 }}
          >
            SUUMOで直接確認する
          </Button>
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
