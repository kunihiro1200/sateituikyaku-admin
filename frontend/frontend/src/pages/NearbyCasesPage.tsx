import { useState, useEffect, useRef } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ContentCopy as ContentCopyIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  TableChart as TableChartIcon,
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

export default function NearbyCasesPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const previewRef = useRef<HTMLDivElement>(null);

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
  const [checkedUrls, setCheckedUrls] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

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
      if (data.suumoUrl) fetchCases(data.suumoUrl);
      else setError('SUUMO URLが設定されていません。報告ページでSUUMO URLを登録してください。');
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
      else setError('SUUMO URLが設定されていません。');
    } catch {
      setError('物件データの取得に失敗しました。');
    }
  };

  const fetchCases = async (url: string) => {
    if (!propertyNumber || !url) return;
    setLoading(true);
    setError(null);
    setCases([]);
    setCheckedUrls(new Set());
    try {
      const res = await api.get(`/api/property-listings/${propertyNumber}/nearby-cases`, {
        params: { suumo_url: url },
      });
      setCases(res.data.cases || []);
      setSourceUrl(res.data.source_url || '');
    } catch (err: any) {
      setError(err.response?.data?.error || '周辺事例の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const targetTsubo = landArea ? Math.round((landArea / 3.30578) * 10) / 10 : null;
  const targetPriceMan = price ? Math.floor(price / 10000) : null;
  const targetTsubotanka = targetTsubo && targetPriceMan
    ? Math.round((targetPriceMan / targetTsubo) * 10) / 10 : null;

  const handleCheck = (url: string) => {
    setCheckedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };
  const handleCheckAll = () => {
    if (checkedUrls.size === cases.length) setCheckedUrls(new Set());
    else setCheckedUrls(new Set(cases.map((c) => c.url)));
  };
  const isAllChecked = cases.length > 0 && checkedUrls.size === cases.length;
  const isIndeterminate = checkedUrls.size > 0 && checkedUrls.size < cases.length;
  const copyTargetCases = checkedUrls.size > 0 ? cases.filter((c) => checkedUrls.has(c.url)) : cases;

  // プレビューダイアログを開く
  const handleOpenPreview = () => {
    setCopyDone(false);
    setPreviewOpen(true);
  };

  // ダイアログ内のテーブルを全選択してコピー
  const handleSelectAndCopy = () => {
    if (!previewRef.current) return;
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(previewRef.current);
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand('copy');
    setCopyDone(true);
    setSnackbar({ open: true, message: 'コピーしました。Gmailに貼り付けてください。', severity: 'success' });
  };

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
        {cases.length > 0 && (
          <Button
            variant="contained"
            size="small"
            startIcon={<TableChartIcon />}
            onClick={handleOpenPreview}
            sx={{ backgroundColor: '#1a73e8', '&:hover': { backgroundColor: '#1557b0' } }}
          >
            {checkedUrls.size > 0 ? `選択${checkedUrls.size}件をメール用にコピー` : 'メール用テーブルをコピー'}
          </Button>
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
      {!loading && cases.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="body2" fontWeight="bold" color="text.secondary">
              周辺販売中土地（{cases.length}件）
              {checkedUrls.size > 0 && (
                <Typography component="span" sx={{ ml: 1, color: SECTION_COLORS.property.main, fontWeight: 'bold' }}>
                  {checkedUrls.size}件選択中
                </Typography>
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              出典：SUUMO　{new Date().toLocaleDateString('ja-JP')}時点　半径1km圏内
            </Typography>
          </Box>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                  <TableCell padding="checkbox" sx={{ width: 40 }}>
                    <Checkbox size="small" checked={isAllChecked} indeterminate={isIndeterminate} onChange={handleCheckAll} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', width: 36 }}>No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 160 }}>所在地</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>価格</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>面積</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>坪数</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>坪単価</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' }}>建築条件</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cases.map((c, i) => {
                  const isChecked = checkedUrls.has(c.url);
                  return (
                    <TableRow key={i} onClick={() => handleCheck(c.url)} sx={{
                      cursor: 'pointer',
                      backgroundColor: isChecked ? '#e8f5e9' : i % 2 === 0 ? 'white' : '#fafafa',
                      '&:hover': { backgroundColor: isChecked ? '#c8e6c9' : '#f0f0f0' },
                    }}>
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox size="small" checked={isChecked} onChange={() => handleCheck(c.url)} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{i + 1}</TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', maxWidth: 220 }}>
                        {c.url ? (
                          <Link href={c.url} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            sx={{ fontSize: '0.82rem', display: 'block' }}>
                            {c.address !== '-' ? c.address : c.url}
                          </Link>
                        ) : (
                          <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                            {c.address !== '-' ? c.address : '-'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{c.price}</TableCell>
                      <TableCell sx={{ textAlign: 'right', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{c.area}</TableCell>
                      <TableCell sx={{ textAlign: 'right', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{c.tsubo}</TableCell>
                      <TableCell sx={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap', color: SECTION_COLORS.property.main }}>
                        {c.tsubo_tanka}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        <Chip label={c.building_condition} size="small" variant="outlined"
                          color={c.building_condition === 'なし' ? 'success' : 'warning'}
                          sx={{ fontSize: '0.72rem', height: 20 }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* ★対象物件行 */}
                {targetPriceMan && (
                  <TableRow sx={{ backgroundColor: '#fff8e1', borderTop: '2px solid #ffe082' }}>
                    <TableCell padding="checkbox" />
                    <TableCell sx={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#e65100' }}>★</TableCell>
                    <TableCell sx={{ fontSize: '0.82rem', fontWeight: 'bold' }}>{address}（対象物件）</TableCell>
                    <TableCell sx={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {targetPriceMan.toLocaleString('ja-JP')}万円
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{landArea ? `${landArea}㎡` : '-'}</TableCell>
                    <TableCell sx={{ textAlign: 'right', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{targetTsubo ? `${targetTsubo}坪` : '-'}</TableCell>
                    <TableCell sx={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap', color: SECTION_COLORS.property.main }}>
                      {targetTsubotanka ? `${targetTsubotanka}万円/坪` : '-'}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center', fontSize: '0.82rem' }}>{propertyType || '-'}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* 取得結果が0件 */}
      {!loading && !error && cases.length === 0 && suumoUrl && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">周辺事例が見つかりませんでした。</Typography>
          <Button variant="outlined" size="small" href={sourceUrl || suumoUrl}
            target="_blank" rel="noopener noreferrer" sx={{ mt: 2 }}>
            SUUMOで直接確認する
          </Button>
        </Paper>
      )}

      {/* ============================================================
          メール用プレビューダイアログ
          ここにHTMLテーブルを表示し、「全選択してコピー」ボタンで
          クリップボードにコピーする
          ============================================================ */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold">メール貼り付け用プレビュー</Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={handleSelectAndCopy}
              sx={{
                backgroundColor: copyDone ? '#388e3c' : '#1a73e8',
                '&:hover': { backgroundColor: copyDone ? '#2e7d32' : '#1557b0' },
              }}
            >
              {copyDone ? '✓ コピー済み' : '全選択してコピー'}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            「全選択してコピー」を押した後、Gmailの本文にCtrl+V（またはCmd+V）で貼り付けてください
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {/* このdivの内容がそのままコピーされる */}
          <div ref={previewRef} style={{ userSelect: 'text', cursor: 'text' }}>
            <p style={{ fontSize: '13px', fontFamily: 'sans-serif', marginBottom: '6px' }}>
              【周辺土地事例】SUUMO掲載中（{new Date().toLocaleDateString('ja-JP')}）
            </p>
            <table style={{ borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'sans-serif', width: '100%' }}>
              <tbody>
                {/* ヘッダー行 */}
                <tr style={{ background: '#e3f2fd', fontWeight: 'bold' }}>
                  {['No', '所在地', '価格', '面積', '坪数', '坪単価', '建築条件'].map((h) => (
                    <td key={h} style={{ padding: '6px 10px', border: '1px solid #bbb' }}>{h}</td>
                  ))}
                </tr>
                {/* データ行 */}
                {copyTargetCases.map((c, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9f9f9' }}>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd' }}>{c.address !== '-' ? c.address : ''}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>{c.price}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>{c.area}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>{c.tsubo}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>
                      <strong>{c.tsubo_tanka}</strong>
                    </td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'center' }}>{c.building_condition}</td>
                  </tr>
                ))}
                {/* ★対象物件行 */}
                {targetPriceMan && (
                  <tr style={{ background: '#fff8e1', fontWeight: 'bold' }}>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'center', color: '#e65100' }}>★</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd' }}>{address}（対象物件）</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>
                      {targetPriceMan.toLocaleString('ja-JP')}万円
                    </td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>
                      {landArea ? `${landArea}㎡` : '-'}
                    </td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>
                      {targetTsubo ? `${targetTsubo}坪` : '-'}
                    </td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>
                      <strong>{targetTsubotanka ? `${targetTsubotanka}万円/坪` : '-'}</strong>
                    </td>
                    <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'center' }}>-</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
              出典：SUUMO　半径1km圏内
            </p>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
