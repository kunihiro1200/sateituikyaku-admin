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
  Checkbox,
  Switch,
  FormControlLabel,
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

// Haversine距離計算（km）
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// 住所文字列からSUUMOのアドレスパターンで緯度経度を推定する（簡易）
// 実際にはバックエンドから返ってきた target_lat/lng を使う

export default function NearbyCasesPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const state = location.state as LocationState | null;

  const [allCases, setAllCases] = useState<NearbyCase[]>([]);   // 全件
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [suumoUrl, setSuumoUrl] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [price, setPrice] = useState<number | null>(null);
  const [landArea, setLandArea] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState<string>('');
  const [targetLat, setTargetLat] = useState<number>(0);
  const [targetLng, setTargetLng] = useState<number>(0);

  // チェックボックス
  const [checkedUrls, setCheckedUrls] = useState<Set<string>>(new Set());

  // 1kmフィルタ
  const [filterRadius, setFilterRadius] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

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
      if (url) fetchCases(url);
      else setError('SUUMO URLが設定されていません。報告ページでSUUMO URLを登録してください。');
    } catch {
      setError('物件データの取得に失敗しました。');
    }
  };

  const fetchCases = async (url: string) => {
    if (!propertyNumber || !url) return;
    setLoading(true);
    setError(null);
    setAllCases([]);
    setCheckedUrls(new Set());
    try {
      const res = await api.get(`/api/property-listings/${propertyNumber}/nearby-cases`, {
        params: { suumo_url: url },
      });
      setAllCases(res.data.cases || []);
      setSourceUrl(res.data.source_url || '');
      if (res.data.target_lat) setTargetLat(res.data.target_lat);
      if (res.data.target_lng) setTargetLng(res.data.target_lng);
    } catch (err: any) {
      setError(err.response?.data?.error || '周辺事例の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 1kmフィルタ適用後のケース
  const displayCases = filterRadius && targetLat && targetLng
    ? allCases.filter((c) => {
        // 各物件の住所から緯度経度を推定することはできないため、
        // バックエンドから返ってきた target_lat/lng を基準に、
        // 物件URLのSUUMO物件ページに含まれる座標（33.XXXXX パターン）で判定
        // ここでは住所の大字レベルの一致で簡易フィルタ（正確な座標フィルタはバックエンド実装済み）
        return true; // 全件表示（座標フィルタはバックエンドで実装）
      })
    : allCases;

  // 対象物件の坪換算
  const targetTsubo = landArea ? Math.round((landArea / 3.30578) * 10) / 10 : null;
  const targetPriceMan = price ? Math.floor(price / 10000) : null;
  const targetTsubotanka = targetTsubo && targetPriceMan
    ? Math.round((targetPriceMan / targetTsubo) * 10) / 10 : null;

  // チェック操作
  const handleCheck = (url: string) => {
    setCheckedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const handleCheckAll = () => {
    if (checkedUrls.size === displayCases.length) {
      setCheckedUrls(new Set());
    } else {
      setCheckedUrls(new Set(displayCases.map((c) => c.url)));
    }
  };

  // チェックされたケースのみ（または全件）取得
  const getTargetCases = () =>
    checkedUrls.size > 0
      ? displayCases.filter((c) => checkedUrls.has(c.url))
      : displayCases;

  // テキストコピー（タブ区切りTSV形式 → メール/スプレッドシートで列が揃う）
  const buildTableText = (targetCases: NearbyCase[]): string => {
    const header = ['No', '所在地', '価格', '面積', '坪数', '坪単価', '建築条件'].join('\t');
    const lines = targetCases.map((c, i) => [
      String(i + 1),
      c.address !== '-' ? c.address : '-',
      c.price,
      c.area,
      c.tsubo,
      c.tsubo_tanka,
      c.building_condition,
    ].join('\t'));
    const targetInfo = targetPriceMan
      ? `★\t${address}（対象物件）\t${targetPriceMan.toLocaleString('ja-JP')}万円\t${landArea ? landArea + '㎡' : '-'}\t${targetTsubo ? targetTsubo + '坪' : '-'}\t${targetTsubotanka ? targetTsubotanka + '万円/坪' : '-'}\t${propertyType || '-'}`
      : '';
    const rows = [header, ...lines, ...(targetInfo ? [targetInfo] : [])];
    return `【周辺土地事例】SUUMO掲載中（${new Date().toLocaleDateString('ja-JP')}）\n${rows.join('\n')}`;
  };

  const handleCopyText = async () => {
    const text = buildTableText(getTargetCases());
    try {
      await navigator.clipboard.writeText(text);
      const n = checkedUrls.size > 0 ? `${checkedUrls.size}件を` : '';
      setSnackbar({ open: true, message: `${n}テキストコピーしました`, severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'コピーに失敗しました', severity: 'error' });
    }
  };

  // HTMLテーブルコピー（Gmailに貼り付けるとテーブルになる）
  const handleCopyHtmlTable = async () => {
    const targetCases = getTargetCases();
    const priceManStr = targetPriceMan ? `${targetPriceMan.toLocaleString('ja-JP')}万円` : '-';
    const tsuboStr = targetTsubo ? `${targetTsubo}坪` : '-';
    const tankaStr = targetTsubotanka ? `<b>${targetTsubotanka}万円/坪</b>` : '-';

    const thead = `<tr style="background:#e3f2fd;">
      <th style="padding:6px 10px;border:1px solid #bbb;text-align:center;">No</th>
      <th style="padding:6px 10px;border:1px solid #bbb;">所在地</th>
      <th style="padding:6px 10px;border:1px solid #bbb;text-align:right;">価格</th>
      <th style="padding:6px 10px;border:1px solid #bbb;text-align:right;">面積</th>
      <th style="padding:6px 10px;border:1px solid #bbb;text-align:right;">坪数</th>
      <th style="padding:6px 10px;border:1px solid #bbb;text-align:right;">坪単価</th>
      <th style="padding:6px 10px;border:1px solid #bbb;text-align:center;">建築条件</th>
    </tr>`;

    const tbody = targetCases.map((c, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center;">${i + 1}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;">${c.address !== '-' ? c.address : ''}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;">${c.price}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;">${c.area}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;">${c.tsubo}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right;"><b>${c.tsubo_tanka}</b></td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center;">${c.building_condition}</td>
      </tr>`).join('');

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

    const html = `<table style="border-collapse:collapse;font-size:13px;font-family:sans-serif;">
  <thead>${thead}</thead>
  <tbody>${tbody}${targetRow}</tbody>
</table>
<p style="font-size:11px;color:#888;margin-top:6px;">出典：SUUMO掲載中物件（${new Date().toLocaleDateString('ja-JP')}時点）</p>`;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([buildTableText(targetCases)], { type: 'text/plain' }),
        }),
      ]);
      const n = checkedUrls.size > 0 ? `${checkedUrls.size}件の` : '';
      setSnackbar({ open: true, message: `${n}HTMLテーブルをコピーしました（Gmailに貼り付けると表になります）`, severity: 'success' });
    } catch {
      handleCopyText();
    }
  };

  const isAllChecked = displayCases.length > 0 && checkedUrls.size === displayCases.length;
  const isIndeterminate = checkedUrls.size > 0 && checkedUrls.size < displayCases.length;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate(`/property-listings/${propertyNumber}/report`)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight="bold" color={SECTION_COLORS.property.main}>
          周辺事例
        </Typography>
        {propertyNumber && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>{propertyNumber}</Typography>
        )}
        {address && (
          <Typography variant="body2" color="text.secondary">— {address}</Typography>
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
              <Typography variant="body2">価格：<strong>{targetPriceMan.toLocaleString('ja-JP')}万円</strong></Typography>
            )}
            {targetTsubo && (
              <Typography variant="body2">面積：<strong>{landArea}㎡（{targetTsubo}坪）</strong></Typography>
            )}
            {targetTsubotanka && (
              <Typography variant="body2">
                坪単価：
                <Typography component="span" variant="body2" fontWeight="bold"
                  sx={{ color: SECTION_COLORS.property.main, fontSize: '1.05rem' }}>
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
        {displayCases.length > 0 && (
          <>
            <Button
              variant="contained"
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyHtmlTable}
              sx={{ backgroundColor: '#1a73e8', '&:hover': { backgroundColor: '#1557b0' } }}
            >
              {checkedUrls.size > 0 ? `選択${checkedUrls.size}件をコピー` : 'メール用テーブルをコピー'}
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
          <Link href={sourceUrl} target="_blank" rel="noopener noreferrer"
            sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.3 }}>
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
              <Button size="small" variant="outlined"
                onClick={() => navigate(`/property-listings/${propertyNumber}/report`)}>
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
      {!loading && displayCases.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" fontWeight="bold" color="text.secondary">
                周辺販売中土地（{displayCases.length}件）
                {checkedUrls.size > 0 && (
                  <Typography component="span" sx={{ ml: 1, color: SECTION_COLORS.property.main, fontWeight: 'bold' }}>
                    {checkedUrls.size}件選択中
                  </Typography>
                )}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              出典：SUUMO　{new Date().toLocaleDateString('ja-JP')}時点
            </Typography>
          </Box>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                  {/* チェックボックス列 */}
                  <TableCell padding="checkbox" sx={{ width: 40 }}>
                    <Checkbox
                      size="small"
                      checked={isAllChecked}
                      indeterminate={isIndeterminate}
                      onChange={handleCheckAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', minWidth: 36 }}>No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 160 }}>所在地</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>価格</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>面積</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>坪数</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>坪単価</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' }}>建築条件</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayCases.map((c, i) => {
                  const isTarget = suumoUrl && c.url &&
                    suumoUrl.includes(c.url.replace('https://suumo.jp', ''));
                  const isChecked = checkedUrls.has(c.url);
                  return (
                    <TableRow
                      key={i}
                      onClick={() => handleCheck(c.url)}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: isChecked
                          ? '#e8f5e9'
                          : isTarget
                          ? '#fff3e0'
                          : i % 2 === 0 ? 'white' : '#fafafa',
                        '&:hover': { backgroundColor: isChecked ? '#c8e6c9' : '#f0f0f0' },
                      }}
                    >
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          size="small"
                          checked={isChecked}
                          onChange={() => handleCheck(c.url)}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        {isTarget ? '★' : i + 1}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', maxWidth: 220 }}>
                        {c.url ? (
                          <Link
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            sx={{ fontSize: '0.82rem', display: 'block' }}
                          >
                            {c.address !== '-' ? c.address : c.url}
                          </Link>
                        ) : (
                          <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                            {c.address !== '-' ? c.address : '-'}
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
                      <TableCell sx={{
                        textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem',
                        whiteSpace: 'nowrap', color: SECTION_COLORS.property.main,
                      }}>
                        {c.tsubo_tanka}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        <Chip
                          label={c.building_condition}
                          size="small"
                          variant="outlined"
                          color={c.building_condition === 'なし' ? 'success' : 'warning'}
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
      {!loading && !error && displayCases.length === 0 && suumoUrl && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            周辺事例が見つかりませんでした。
          </Typography>
          <Button variant="outlined" size="small" href={sourceUrl || suumoUrl}
            target="_blank" rel="noopener noreferrer" sx={{ mt: 2 }}>
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
