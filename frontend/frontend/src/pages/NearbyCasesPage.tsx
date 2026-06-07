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

// バックエンドから返る種別識別子
type CaseType = 'tochi' | 'chukoikkodate' | 'manshon';

interface NearbyCase {
  case_type: CaseType;
  title: string;
  price: string;
  address: string;
  // 土地専用
  area?: string;
  tsubo?: string;
  tsubo_tanka?: string;
  building_condition?: string;
  // 中古一戸建て・マンション共通
  built_year?: string;
  // 中古一戸建て専用
  building_area?: string;
  // マンション専用
  exclusive_area?: string;
  floor_plan?: string;
  url: string;
}

export default function NearbyCasesPage() {
  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const hiddenTableRef = useRef<HTMLDivElement>(null);

  const state = location.state as LocationState | null;

  const [cases, setCases] = useState<NearbyCase[]>([]);
  const [caseType, setCaseType] = useState<CaseType>('tochi');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [suumoUrl, setSuumoUrl] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [price, setPrice] = useState<number | null>(null);
  const [landArea, setLandArea] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState<string>('');
  const [checkedUrls, setCheckedUrls] = useState<Set<string>>(new Set());

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
      setCaseType(res.data.case_type || 'tochi');
      setSourceUrl(res.data.source_url || '');
    } catch (err: any) {
      setError(err.response?.data?.error || '周辺事例の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 土地用の計算値
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

  // 種別ラベル
  const caseTypeLabel =
    caseType === 'chukoikkodate' ? '中古一戸建て' :
    caseType === 'manshon' ? '中古マンション' : '土地';

  // コピー用HTMLを生成
  const buildHtml = () => {
    let headerCols = '';
    let rows = '';

    if (caseType === 'tochi') {
      headerCols = `<th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd">所在地</th>
        <th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd;text-align:right">価格</th>
        <th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd;text-align:right">面積</th>`;
      rows = copyTargetCases.map((c, i) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
          <td style="padding:5px 10px;border:1px solid #ddd;text-align:center">${i + 1}</td>
          <td style="padding:5px 10px;border:1px solid #ddd">${c.address !== '-' ? c.address : ''}</td>
          <td style="padding:5px 10px;border:1px solid #ddd;text-align:right">${c.price}　<strong><u>（${c.tsubo_tanka}）</u></strong></td>
          <td style="padding:5px 10px;border:1px solid #ddd;text-align:right">${c.area}</td>
        </tr>`).join('');
    } else if (caseType === 'chukoikkodate') {
      headerCols = `<th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd">所在地</th>
        <th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd;text-align:right">価格</th>
        <th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd;text-align:right">建物面積</th>
        <th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd">築年月</th>`;
      rows = copyTargetCases.map((c, i) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
          <td style="padding:5px 10px;border:1px solid #ddd;text-align:center">${i + 1}</td>
          <td style="padding:5px 10px;border:1px solid #ddd">${c.address !== '-' ? c.address : ''}</td>
          <td style="padding:5px 10px;border:1px solid #ddd;text-align:right">${c.price}</td>
          <td style="padding:5px 10px;border:1px solid #ddd;text-align:right">${c.building_area || '-'}</td>
          <td style="padding:5px 10px;border:1px solid #ddd">${c.built_year || '-'}</td>
        </tr>`).join('');
    } else {
      // マンション
      headerCols = `<th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd">所在地</th>
        <th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd;text-align:right">価格</th>
        <th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd;text-align:right">専有面積</th>
        <th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd">築年月</th>
        <th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd">間取り</th>`;
      rows = copyTargetCases.map((c, i) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
          <td style="padding:5px 10px;border:1px solid #ddd;text-align:center">${i + 1}</td>
          <td style="padding:5px 10px;border:1px solid #ddd">${c.address !== '-' ? c.address : ''}</td>
          <td style="padding:5px 10px;border:1px solid #ddd;text-align:right">${c.price}</td>
          <td style="padding:5px 10px;border:1px solid #ddd;text-align:right">${c.exclusive_area || '-'}</td>
          <td style="padding:5px 10px;border:1px solid #ddd">${c.built_year || '-'}</td>
          <td style="padding:5px 10px;border:1px solid #ddd">${c.floor_plan || '-'}</td>
        </tr>`).join('');
    }

    // 対象物件行（土地のみ坪単価表示）
    const targetRow = targetPriceMan && caseType === 'tochi' ? `
      <tr style="background:#fff8e1;font-weight:bold">
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center;color:#e65100">★</td>
        <td style="padding:5px 10px;border:1px solid #ddd">${address}（対象物件）</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right">${targetPriceMan.toLocaleString('ja-JP')}万円　<strong><u>（${targetTsubotanka ? `${targetTsubotanka}万円/坪` : '-'}）</u></strong></td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right">${landArea ? `${landArea}㎡` : '-'}（${targetTsubo ? `${targetTsubo}坪` : '-'}）</td>
      </tr>` : targetPriceMan ? `
      <tr style="background:#fff8e1;font-weight:bold">
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center;color:#e65100">★</td>
        <td style="padding:5px 10px;border:1px solid #ddd">${address}（対象物件）</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:right">${targetPriceMan.toLocaleString('ja-JP')}万円</td>
        <td style="padding:5px 10px;border:1px solid #ddd">-</td>
        <td style="padding:5px 10px;border:1px solid #ddd">-</td>
      </tr>` : '';

    return `
      <p style="font-size:13px;font-family:sans-serif;margin-bottom:6px">
        【周辺${caseTypeLabel}事例】SUUMO掲載中（${new Date().toLocaleDateString('ja-JP')}）
      </p>
      <table style="border-collapse:collapse;font-size:13px;font-family:sans-serif">
        <thead>
          <tr>
            <th style="padding:5px 10px;border:1px solid #ddd;background:#e3f2fd;text-align:center">No</th>
            ${headerCols}
          </tr>
        </thead>
        <tbody>
          ${rows}
          ${targetRow}
        </tbody>
      </table>
      <p style="font-size:11px;color:#888;margin-top:6px">出典：SUUMO　半径1km圏内</p>`;
  };

  // 別タブでHTMLプレビューを開く
  const handleOpenPreview = () => {
    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>周辺事例コピー用</title>
  <style>
    body { font-family: sans-serif; padding: 20px; background: #f5f5f5; margin: 0; }
    .instructions {
      background: #fff3cd; border: 2px solid #ffc107; border-radius: 6px;
      padding: 12px 16px; margin-bottom: 16px; font-size: 15px; color: #333;
      line-height: 1.8;
    }
    .instructions .step { font-size: 17px; font-weight: bold; color: #e65100; }
    .content { background: white; padding: 16px; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="instructions">
    <div class="step">① このページ内でCtrl+A（全選択）</div>
    <div class="step">② Ctrl+C（コピー）</div>
    <div class="step">③ Gmailの本文欄でCtrl+V（貼り付け）</div>
    <br>
    ⚠️ Gmailが「書式なしテキスト」モードの場合：作成画面の下部「A」ボタンをクリックして<strong>「書式付きテキスト」に切り替え</strong>てから貼り付けてください。
  </div>
  <div class="content">
    ${buildHtml()}
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleCopy = () => {
    const el = hiddenTableRef.current;
    if (!el) return;
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel?.removeAllRanges();
    sel?.addRange(range);
    const ok = document.execCommand('copy');
    sel?.removeAllRanges();
    if (ok) {
      const n = checkedUrls.size > 0 ? `${checkedUrls.size}件を` : '';
      setSnackbar({
        open: true,
        message: `${n}コピーしました。Gmailの本文でCtrl+Vで貼り付けてください。`,
        severity: 'success',
      });
    } else {
      setSnackbar({ open: true, message: 'コピーに失敗しました。', severity: 'error' });
    }
  };

  // ── テーブルヘッダー（種別ごと） ──
  const renderTableHead = () => {
    if (caseType === 'tochi') {
      return (
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
      );
    }
    if (caseType === 'chukoikkodate') {
      return (
        <TableRow sx={{ backgroundColor: '#e8f5e9' }}>
          <TableCell padding="checkbox" sx={{ width: 40 }}>
            <Checkbox size="small" checked={isAllChecked} indeterminate={isIndeterminate} onChange={handleCheckAll} />
          </TableCell>
          <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', width: 36 }}>No</TableCell>
          <TableCell sx={{ fontWeight: 'bold', minWidth: 160 }}>所在地</TableCell>
          <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>価格</TableCell>
          <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>建物面積</TableCell>
          <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            築年月 <span style={{ color: '#c62828', fontSize: '0.75rem' }}>必須</span>
          </TableCell>
        </TableRow>
      );
    }
    // マンション
    return (
      <TableRow sx={{ backgroundColor: '#f3e5f5' }}>
        <TableCell padding="checkbox" sx={{ width: 40 }}>
          <Checkbox size="small" checked={isAllChecked} indeterminate={isIndeterminate} onChange={handleCheckAll} />
        </TableCell>
        <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', width: 36 }}>No</TableCell>
        <TableCell sx={{ fontWeight: 'bold', minWidth: 160 }}>所在地</TableCell>
        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>価格</TableCell>
        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>専有面積</TableCell>
        <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          築年月 <span style={{ color: '#c62828', fontSize: '0.75rem' }}>必須</span>
        </TableCell>
        <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>間取り</TableCell>
      </TableRow>
    );
  };

  // ── テーブル行（種別ごと） ──
  const renderRow = (c: NearbyCase, i: number) => {
    const isChecked = checkedUrls.has(c.url);
    const rowBg = isChecked ? '#e8f5e9' : i % 2 === 0 ? 'white' : '#fafafa';
    const hoverBg = isChecked ? '#c8e6c9' : '#f0f0f0';
    const addressCell = (
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
    );

    if (caseType === 'tochi') {
      return (
        <TableRow key={i} onClick={() => handleCheck(c.url)} sx={{ cursor: 'pointer', backgroundColor: rowBg, '&:hover': { backgroundColor: hoverBg } }}>
          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
            <Checkbox size="small" checked={isChecked} onChange={() => handleCheck(c.url)} />
          </TableCell>
          <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{i + 1}</TableCell>
          {addressCell}
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
    }

    if (caseType === 'chukoikkodate') {
      const hasBuiltYear = c.built_year && c.built_year !== '-';
      return (
        <TableRow key={i} onClick={() => handleCheck(c.url)} sx={{ cursor: 'pointer', backgroundColor: rowBg, '&:hover': { backgroundColor: hoverBg } }}>
          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
            <Checkbox size="small" checked={isChecked} onChange={() => handleCheck(c.url)} />
          </TableCell>
          <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{i + 1}</TableCell>
          {addressCell}
          <TableCell sx={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{c.price}</TableCell>
          <TableCell sx={{ textAlign: 'right', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{c.building_area || '-'}</TableCell>
          <TableCell sx={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            {hasBuiltYear
              ? <Typography component="span" sx={{ fontSize: '0.82rem', fontWeight: 'bold' }}>{c.built_year}</Typography>
              : <Typography component="span" sx={{ fontSize: '0.75rem', color: '#c62828' }}>未取得</Typography>
            }
          </TableCell>
        </TableRow>
      );
    }

    // マンション
    const hasBuiltYear = c.built_year && c.built_year !== '-';
    return (
      <TableRow key={i} onClick={() => handleCheck(c.url)} sx={{ cursor: 'pointer', backgroundColor: rowBg, '&:hover': { backgroundColor: hoverBg } }}>
        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
          <Checkbox size="small" checked={isChecked} onChange={() => handleCheck(c.url)} />
        </TableCell>
        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{i + 1}</TableCell>
        {addressCell}
        <TableCell sx={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{c.price}</TableCell>
        <TableCell sx={{ textAlign: 'right', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{c.exclusive_area || '-'}</TableCell>
        <TableCell sx={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
          {hasBuiltYear
            ? <Typography component="span" sx={{ fontSize: '0.82rem', fontWeight: 'bold' }}>{c.built_year}</Typography>
            : <Typography component="span" sx={{ fontSize: '0.75rem', color: '#c62828' }}>未取得</Typography>
          }
        </TableCell>
        <TableCell sx={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{c.floor_plan || '-'}</TableCell>
      </TableRow>
    );
  };

  const headerBgColor =
    caseType === 'chukoikkodate' ? '#e8f5e9' :
    caseType === 'manshon' ? '#f3e5f5' : '#e3f2fd';

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
        {cases.length > 0 && (
          <Chip
            label={caseTypeLabel}
            size="small"
            sx={{
              ml: 1,
              backgroundColor:
                caseType === 'chukoikkodate' ? '#e8f5e9' :
                caseType === 'manshon' ? '#f3e5f5' : '#e3f2fd',
              fontWeight: 'bold',
            }}
          />
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
            {caseType === 'tochi' && targetTsubo && (
              <Typography variant="body2">面積：<strong>{landArea}㎡（{targetTsubo}坪）</strong></Typography>
            )}
            {caseType === 'tochi' && targetTsubotanka && (
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
            startIcon={<ContentCopyIcon />}
            onClick={handleCopy}
            sx={{ backgroundColor: '#1a73e8', '&:hover': { backgroundColor: '#1557b0' } }}
          >
            {checkedUrls.size > 0 ? `選択${checkedUrls.size}件をコピー` : 'メール用テーブルをコピー'}
          </Button>
        )}
        {cases.length > 0 && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<OpenInNewIcon />}
            onClick={handleOpenPreview}
            sx={{ borderColor: '#1a73e8', color: '#1a73e8' }}
          >
            {checkedUrls.size > 0 ? `選択${checkedUrls.size}件をプレビューで開く` : 'プレビューで開く（確実）'}
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
              周辺{caseTypeLabel}（{cases.length}件）
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
                {renderTableHead()}
              </TableHead>
              <TableBody>
                {cases.map((c, i) => renderRow(c, i))}
                {/* ★対象物件行（土地のみ） */}
                {targetPriceMan && caseType === 'tochi' && (
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

      {/* コピー用隠しテーブル */}
      <div
        ref={hiddenTableRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '-9999px',
          left: 0,
          width: '800px',
          pointerEvents: 'none',
          zIndex: -1,
          background: 'white',
        }}
        dangerouslySetInnerHTML={{ __html: buildHtml() }}
      />

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
