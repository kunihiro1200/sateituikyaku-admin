import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Typography, TextField, InputAdornment, Divider, Paper, CircularProgress, Button, Snackbar, Alert } from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

// タブのタイトル・ファビコンを動的に設定
function usePageMeta(title: string) {
  useEffect(() => {
    document.title = title;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="#1565c0"/>
      <text x="16" y="22" font-size="11" font-family="'Hiragino Sans','Meiryo',sans-serif"
        font-weight="bold" fill="white" text-anchor="middle">計算</text>
    </svg>`;
    const svgUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = svgUrl;
  }, [title]);
}

/**
 * 仲介手数料を計算する
 * 売買価格が800万円以下 → 一律33万円（税込み）
 * 800万円超 → (売買価格 × 3% + 6万円) × 1.1（消費税10%）
 */
function calcCommission(price: number): number {
  if (price <= 0) return 0;
  if (price <= 8_000_000) {
    return 330_000;
  }
  const base = price * 0.03 + 60_000;
  return Math.floor(base * 1.1);
}

/** 金額を「万円」表示にフォーマット（端数は千円単位まで） */
function formatMan(yen: number): string {
  if (yen <= 0) return '—';
  const man = yen / 10_000;
  if (yen % 10_000 === 0) {
    return `${man.toLocaleString()}万円`;
  }
  return `${man.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}万円`;
}

/** 金額を「円」で3桁区切り表示 */
function formatYen(yen: number): string {
  if (yen <= 0) return '—';
  return `${yen.toLocaleString()}円`;
}

/** 坪単価を「万円/坪」でフォーマット */
function formatTsuboTanka(yen: number): string {
  if (yen <= 0) return '—';
  const man = yen / 10_000;
  return `${man.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}万円/坪`;
}

const API_BASE_URL =
  import.meta.env.MODE === 'production'
    ? 'https://sateituikyaku-admin-backend.vercel.app'
    : import.meta.env.VITE_API_URL || 'http://localhost:3000';

const TemodoriCalcPage = () => {
  usePageMeta('計算');

  const { sellerId } = useParams<{ sellerId: string }>();
  const [searchParams] = useSearchParams();

  // 売主番号がFI（またはF）で始まるかどうかを判定
  // URLパラメータのsellerIdはDB上の数値IDなのでFで始まらない場合がある
  // クエリパラメータ sellerNumber（例: FI731）を優先して判定する
  const sellerNumber = searchParams.get('sellerNumber') ?? sellerId ?? '';
  const isFSeller = sellerNumber.toUpperCase().startsWith('F');

  // seller情報の読み込み
  const [loadingSeller, setLoadingSeller] = useState(false);

  // 手元残計算
  const [priceInput, setPriceInput] = useState('');
  const priceYen = parseFloat(priceInput) > 0 ? Math.round(parseFloat(priceInput) * 10_000) : 0;
  const commission = calcCommission(priceYen);
  const temodori = priceYen > 0 ? priceYen - commission : 0;
  const isFlat = priceYen > 0 && priceYen <= 8_000_000;

  // 坪単価計算
  const [landAreaInput, setLandAreaInput] = useState('');
  const [tsuboPriceInput, setTsuboPriceInput] = useState('');
  const tsuboNum = parseFloat(landAreaInput) || 0;
  const sqmFromTsubo = tsuboNum > 0 ? tsuboNum * 3.30578 : 0;
  const tsuboPriceYen = parseFloat(tsuboPriceInput) > 0
    ? Math.round(parseFloat(tsuboPriceInput) * 10_000)
    : 0;
  const tsubotanka = tsuboNum > 0 && tsuboPriceYen > 0 ? tsuboPriceYen / tsuboNum : 0;

  // 譲渡所得税（取得費不明）計算
  const [jotoInput, setJotoInput] = useState('');
  const jotoYen = parseFloat(jotoInput) > 0 ? Math.round(parseFloat(jotoInput) * 10_000) : 0;
  const jotoCommission = calcCommission(jotoYen);
  const shotokuhi = jotoYen > 0 ? Math.round(jotoYen * 0.05) : 0;
  const rieki = jotoYen > 0 ? jotoYen - shotokuhi - jotoCommission : 0;
  const jotoZei = rieki > 0 ? Math.round(rieki * 0.20) : 0;
  const jotoTemodori = jotoYen > 0 ? jotoYen - jotoZei - jotoCommission : 0;
  const jotoIsFlat = jotoYen > 0 && jotoYen <= 8_000_000;

  // 収益物件 利回り計算
  const [chinryoInput, setChinryoInput] = useState(''); // 賃料（月額）万円
  const chinryoMonthYen = parseFloat(chinryoInput) > 0 ? Math.round(parseFloat(chinryoInput) * 10_000) : 0;
  const chinryoYearYen = chinryoMonthYen * 12; // 賃料（年）
  // 利回り3%〜11%の売買価格テーブル
  const YIELDS = [3, 4, 5, 6, 7, 8, 9, 10, 11];
  const yieldPrices = YIELDS.map((y) => ({
    yieldRate: y,
    price: chinryoYearYen > 0 ? Math.round(chinryoYearYen / (y / 100)) : 0,
  }));
  // 逆算：売買価格から利回りを計算
  const [shuuekiPriceInput, setShuuekiPriceInput] = useState(''); // 売買価格（万円）
  const shuuekiPriceYen = parseFloat(shuuekiPriceInput) > 0 ? Math.round(parseFloat(shuuekiPriceInput) * 10_000) : 0;
  const calcYield = chinryoYearYen > 0 && shuuekiPriceYen > 0
    ? (chinryoYearYen / shuuekiPriceYen) * 100
    : 0;

  // コピー通知用
  const [copySnackOpen, setCopySnackOpen] = useState(false);

  // トークテキスト（利回り別売買価格の説明文）生成
  const TALK_YIELDS_NORMAL = [5, 6, 7, 8, 9, 10];
  const TALK_YIELDS_F = [3, 4, 5, 6, 7, 8];
  const talkYieldPrices = TALK_YIELDS_NORMAL.map((y) => ({
    yieldRate: y,
    price: chinryoYearYen > 0 ? Math.round(chinryoYearYen / (y / 100)) : 0,
  }));
  const talkYieldPricesF = TALK_YIELDS_F.map((y) => ({
    yieldRate: y,
    price: chinryoYearYen > 0 ? Math.round(chinryoYearYen / (y / 100)) : 0,
  }));
  const chinryoManStr = parseFloat(chinryoInput) > 0 ? `${parseFloat(chinryoInput)}` : '';
  const nenkanChinryoStr = chinryoYearYen > 0 ? `${chinryoYearYen.toLocaleString()}円` : '';

  const buildTalkText = (): string => {
    if (chinryoMonthYen <= 0) return '';

    if (isFSeller) {
      // F付き売主：3〜8%の売出価格を表示、3%の価格を提案
      const rows = talkYieldPricesF
        .map(({ yieldRate, price }) => `　${yieldRate}％の場合　${price.toLocaleString()}円`)
        .join('\n');
      const price3 = talkYieldPricesF.find((r) => r.yieldRate === 3)?.price ?? 0;
      return [
        `現状の表面利回りの計算は、`,
        `月額賃料${chinryoManStr}万円で年間賃料は${nenkanChinryoStr}となります。`,
        ``,
        `各利回りの売り出し価格：`,
        rows,
        ``,
        `基本的に利回り５～６％が売れる目安となりますが、`,
        `売り出し価格は３％の${price3.toLocaleString()}円でも良いかと思いますが如何でしょうか？`,
      ].join('\n');
    } else {
      // 通常売主：5〜10%の売出価格を表示、6%の価格を提案
      const rows = talkYieldPrices
        .map(({ yieldRate, price }) => `　${yieldRate}％の場合　${price.toLocaleString()}円`)
        .join('\n');
      const price6 = talkYieldPrices.find((r) => r.yieldRate === 6)?.price ?? 0;
      return [
        `現状の表面利回りの計算は、`,
        `月額賃料${chinryoManStr}万円で年間賃料は${nenkanChinryoStr}となります。`,
        ``,
        `各利回りの売出価格：`,
        rows,
        ``,
        `基本的に利回り８～１０％が売れる目安となりますが、`,
        `売出価格は６％の${price6.toLocaleString()}円でも良いかと思います。如何でしょうか？`,
      ].join('\n');
    }
  };

  const talkText = buildTalkText();

  // 売買価格からの利回りトークテキスト生成
  const buildYieldTalkText = (): string => {
    if (calcYield <= 0) return '';
    const priceStr = `${shuuekiPriceYen.toLocaleString()}円`;
    return `ご希望の売買価格は${priceStr}とのことですが、この場合利回りは${calcYield.toFixed(2)}％となります。`;
  };

  const yieldTalkText = buildYieldTalkText();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySnackOpen(true);
    });
  };

  // seller情報取得してデフォルト値をセット
  useEffect(() => {
    if (!sellerId || sellerId === '0') return;

    const sessionToken = localStorage.getItem('session_token');
    if (!sessionToken) return;

    setLoadingSeller(true);
    fetch(`${API_BASE_URL}/api/sellers/${sellerId}`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('取得失敗');
        return res.json();
      })
      .then((data) => {
        const seller = data.seller || data;
        const property = seller?.property;

        // 土地面積：土地（当社調べ）優先、なければ物件情報の土地面積
        const landAreaVerified =
          property?.landAreaVerified ?? seller?.landAreaVerified ?? null;
        const landAreaSqm =
          landAreaVerified || property?.landArea || seller?.landArea || null;

        if (landAreaSqm) {
          const tsuboVal = Number(landAreaSqm) / 3.30578;
          setLandAreaInput(tsuboVal.toFixed(2));
        }

        // 査定額２（中間額）→ 万円に変換してセット
        const val2 =
          seller?.valuationAmount2 ?? seller?.valuation_amount2 ?? null;
        if (val2) {
          const val2Num = Number(val2);
          if (val2Num > 0) {
            const val2Man = Math.round(val2Num / 10000);
            const val2Str = String(val2Man);
            setTsuboPriceInput(val2Str);
            setPriceInput(val2Str);
            setJotoInput(val2Str);
          }
        }
      })
      .catch((e) => {
        console.warn('seller情報取得エラー:', e);
      })
      .finally(() => {
        setLoadingSeller(false);
      });
  }, [sellerId]);

  return (
    <>
      {/* ヘッダーバー */}
      <Box sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        bgcolor: '#1565c0', color: 'white',
        px: 3, py: 1.5,
        display: 'flex', alignItems: 'center', gap: 1.5,
        boxShadow: 3,
      }}>
        <CalculateIcon />
        <Typography variant="subtitle1" fontWeight="bold">
          計算
        </Typography>
        {loadingSeller && (
          <CircularProgress size={18} sx={{ color: 'white', ml: 1 }} />
        )}
      </Box>

      {/* 本文 */}
      <Box sx={{ pt: '72px', px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1000, mx: 'auto' }}>

        {/* 上段：手元残 + 坪単価 横並び */}
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
          mt: 3,
          alignItems: 'flex-start',
        }}>

          {/* 手元残計算セクション（薄い青背景） */}
          <Box sx={{ bgcolor: '#f0f4ff', borderRadius: 2, p: 2.5, flex: 1, minWidth: 0 }}>

            <Typography variant="subtitle1" fontWeight={700} color="#1565c0" mb={2}>
              🧮 手元残計算
            </Typography>

            <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" mb={0.5} fontWeight={600}>
                売買価格を入力してください
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                査定額２（中間額）がデフォルト値として設定されます
              </Typography>
              <TextField
                fullWidth
                type="number"
                label="売買価格"
                placeholder="例：3000"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">万円</InputAdornment>,
                  inputProps: { min: 0, step: 0.1 },
                }}
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '1.2rem', fontWeight: 600 } }}
                autoFocus
              />
            </Paper>

            {priceYen > 0 && (
              <Paper elevation={3} sx={{ p: 3, mt: 2.5, borderRadius: 2, border: '2px solid #1565c0' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="body1" color="text.secondary">売買価格</Typography>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h6" fontWeight={700}>{formatMan(priceYen)}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatYen(priceYen)}</Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                  <Box>
                    <Typography variant="body1" color="text.secondary">仲介手数料（税込）</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {isFlat ? '800万円以下 → 一律33万円' : '売買価格 × 3%＋6万円 × 消費税'}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h6" fontWeight={700} color="error.main">−{formatMan(commission)}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatYen(commission)}</Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5, borderWidth: 2, borderColor: '#1565c0' }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" fontWeight={800} color="#1565c0">手元残</Typography>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h5" fontWeight={800} color="#1565c0">{formatMan(temodori)}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatYen(temodori)}</Typography>
                  </Box>
                </Box>
              </Paper>
            )}

            <Box sx={{ mt: 2, p: 2, bgcolor: '#e8eaf6', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
                【仲介手数料の計算方法】
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
                ・800万円以下：一律 33万円（税込）
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
                ・800万円超：（売買価格 × 3% ＋ 6万円）× 消費税10%
              </Typography>
            </Box>
          </Box>

          {/* 坪単価セクション（薄い緑背景） */}
          <Box sx={{ bgcolor: '#f1f8e9', borderRadius: 2, p: 2.5, flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} color="#2e7d32" mb={2}>
              📐 坪単価計算
            </Typography>

            <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" mb={1.5} fontWeight={600}>
                土地面積
              </Typography>
              <TextField
                fullWidth
                type="number"
                label="土地面積"
                placeholder="例：50.0"
                value={landAreaInput}
                onChange={(e) => setLandAreaInput(e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">坪</InputAdornment>,
                  inputProps: { min: 0, step: 0.01 },
                }}
                helperText={
                  tsuboNum > 0
                    ? `約 ${sqmFromTsubo.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ㎡`
                    : '土地面積を入力（坪）'
                }
                sx={{ mb: 3 }}
              />
              <Typography variant="subtitle2" color="text.secondary" mb={1.5} fontWeight={600}>
                価格
              </Typography>
              <TextField
                fullWidth
                type="number"
                label="価格"
                placeholder="例：3000"
                value={tsuboPriceInput}
                onChange={(e) => setTsuboPriceInput(e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">万円</InputAdornment>,
                  inputProps: { min: 0, step: 0.1 },
                }}
                helperText="査定額２（中間額）がデフォルト値として設定されます"
              />
              {tsubotanka > 0 && (
                <>
                  <Divider sx={{ my: 2.5, borderWidth: 2, borderColor: '#2e7d32' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="h6" fontWeight={800} color="#2e7d32">坪単価</Typography>
                      {tsuboNum > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {tsuboNum}坪（約{sqmFromTsubo.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}㎡）
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h5" fontWeight={800} color="#2e7d32">
                        {formatTsuboTanka(tsubotanka)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {tsubotanka.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}円/坪
                      </Typography>
                    </Box>
                  </Box>
                </>
              )}
            </Paper>
          </Box>
        </Box>

        {/* 収益物件　利回り計算（全幅） - 譲渡所得税の前に表示 */}
        <Box sx={{ bgcolor: '#f3e5f5', borderRadius: 2, p: 2.5, mt: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} color="#6a1b9a" mb={2}>
            🏘️ 収益物件　利回り計算
          </Typography>

          {/* 賃料入力 */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" mb={0.5} fontWeight={600}>
              賃料（月額）を入力してください
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              入力すると賃料（年）・各利回りの売買価格が自動計算されます
            </Typography>
            <TextField
              type="number"
              label="賃料（月額）"
              placeholder="例：7"
              value={chinryoInput}
              onChange={(e) => setChinryoInput(e.target.value)}
              InputProps={{
                endAdornment: <InputAdornment position="end">万円</InputAdornment>,
                inputProps: { min: 0, step: 0.1 },
              }}
              sx={{
                width: { xs: '100%', sm: 280 },
                '& .MuiOutlinedInput-root': { fontSize: '1.2rem', fontWeight: 600 },
              }}
            />
          </Paper>

          {chinryoMonthYen > 0 && (
            <Paper elevation={3} sx={{ p: 3, mt: 2.5, borderRadius: 2, border: '2px solid #6a1b9a' }}>

              {/* 賃料（月・年）表示 */}
              <Box sx={{ display: 'flex', gap: 4, mb: 2.5, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">賃料（月額）</Typography>
                  <Typography variant="h6" fontWeight={700} color="#6a1b9a">
                    {formatMan(chinryoMonthYen)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">賃料（年）</Typography>
                  <Typography variant="h6" fontWeight={700} color="#6a1b9a">
                    {formatMan(chinryoYearYen)}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* 利回りテーブル */}
              <Typography variant="subtitle2" color="text.secondary" mb={1.5} fontWeight={600}>
                利回り別　売買価格
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 1 }}>
                {yieldPrices.map(({ yieldRate, price }) => {
                  const isHighlighted = isFSeller
                    ? yieldRate === 3 || yieldRate === 4
                    : yieldRate === 6 || yieldRate === 7;
                  return (
                  <Box
                    key={yieldRate}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      bgcolor: isHighlighted ? '#ede7f6' : '#fafafa',
                      border: isHighlighted ? '1.5px solid #6a1b9a' : '1px solid #e0e0e0',
                      borderRadius: 1.5,
                      px: 2,
                      py: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={isHighlighted ? 700 : 500}
                      color={isHighlighted ? '#6a1b9a' : 'text.secondary'}
                    >
                      {yieldRate}.00%
                    </Typography>
                    <Typography
                      variant="body1"
                      fontWeight={isHighlighted ? 800 : 600}
                      color={isHighlighted ? '#6a1b9a' : 'text.primary'}
                    >
                      {price > 0 ? `${Math.round(price / 10000).toLocaleString()}万円` : '—'}
                    </Typography>
                  </Box>
                  );
                })}
              </Box>
            </Paper>
          )}

          {/* トークテキスト（利回り別説明文） */}
          {talkText && (
            <Paper elevation={2} sx={{ p: 3, mt: 2.5, borderRadius: 2, border: '1.5px solid #ce93d8', bgcolor: '#fce4ec' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700} color="#6a1b9a">
                  💬 トーク文例
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon fontSize="small" />}
                  onClick={() => handleCopy(talkText)}
                  sx={{ ml: 2, flexShrink: 0, borderColor: '#6a1b9a', color: '#6a1b9a', '&:hover': { borderColor: '#4a148c', bgcolor: '#ede7f6' } }}
                >
                  コピー
                </Button>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.9,
                  color: '#37474f',
                  bgcolor: 'white',
                  p: 2,
                  borderRadius: 1,
                  border: '1px solid #e0e0e0',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.88rem',
                }}
              >
                {talkText}
              </Typography>
            </Paper>
          )}

          {/* 売買価格から利回り逆算 */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mt: 2.5 }}>
            <Typography variant="subtitle2" color="text.secondary" mb={0.5} fontWeight={600}>
              売買価格から利回りを計算
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              上記の賃料をもとに、売買価格を入力すると利回りが表示されます
            </Typography>
            <TextField
              type="number"
              label="売買価格"
              placeholder="例：1000"
              value={shuuekiPriceInput}
              onChange={(e) => setShuuekiPriceInput(e.target.value)}
              InputProps={{
                endAdornment: <InputAdornment position="end">万円</InputAdornment>,
                inputProps: { min: 0, step: 1 },
              }}
              sx={{
                width: { xs: '100%', sm: 280 },
                '& .MuiOutlinedInput-root': { fontSize: '1.2rem', fontWeight: 600 },
              }}
            />
            {calcYield > 0 && (
              <>
                <Divider sx={{ my: 2, borderWidth: 2, borderColor: '#6a1b9a' }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800} color="#6a1b9a">利回り</Typography>
                    <Typography variant="caption" color="text.secondary">
                      賃料（年）÷ 売買価格 × 100
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight={800} color="#6a1b9a">
                    {calcYield.toFixed(2)}%
                  </Typography>
                </Box>

                {/* 売買価格利回りトークテキスト */}
                {yieldTalkText && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: '#fce4ec', borderRadius: 1.5, border: '1px solid #ce93d8' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="caption" fontWeight={700} color="#6a1b9a">
                        💬 トーク文例
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ContentCopyIcon fontSize="small" />}
                        onClick={() => handleCopy(yieldTalkText)}
                        sx={{ ml: 2, flexShrink: 0, borderColor: '#6a1b9a', color: '#6a1b9a', '&:hover': { borderColor: '#4a148c', bgcolor: '#ede7f6' } }}
                      >
                        コピー
                      </Button>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        lineHeight: 1.9,
                        color: '#37474f',
                        bgcolor: 'white',
                        p: 1.5,
                        borderRadius: 1,
                        border: '1px solid #e0e0e0',
                        fontSize: '0.88rem',
                      }}
                    >
                      {yieldTalkText}
                    </Typography>
                  </Box>
                )}
              </>
            )}
            {chinryoMonthYen === 0 && (
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                ※ 先に賃料（月額）を入力してください
              </Typography>
            )}
          </Paper>

          <Box sx={{ mt: 2, p: 2, bgcolor: '#e1bee7', borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
              【計算方法】
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
              ・賃料（年）＝ 賃料（月額）× 12
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
              ・売買価格（各利回り）＝ 賃料（年）÷ 利回り
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
              ・利回り ＝ 賃料（年）÷ 売買価格 × 100
            </Typography>
          </Box>
        </Box>

        {/* 譲渡所得税（取得費不明）手元残計算（全幅） */}
        <Box sx={{ bgcolor: '#fff8e1', borderRadius: 2, p: 2.5, mt: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} color="#e65100" mb={2}>
            🏦 譲渡所得税（取得費不明）の手元残計算
          </Typography>

          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" mb={0.5} fontWeight={600}>
              売買価格を入力してください
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              査定額２（中間額）がデフォルト値として設定されます
            </Typography>
            <TextField
              type="number"
              label="売買価格"
              placeholder="例：3000"
              value={jotoInput}
              onChange={(e) => setJotoInput(e.target.value)}
              InputProps={{
                endAdornment: <InputAdornment position="end">万円</InputAdornment>,
                inputProps: { min: 0, step: 0.1 },
              }}
              sx={{
                width: { xs: '100%', sm: 320 },
                '& .MuiOutlinedInput-root': { fontSize: '1.2rem', fontWeight: 600 },
              }}
            />
          </Paper>

          {jotoYen > 0 && (
            <Paper elevation={3} sx={{ p: 3, mt: 2.5, borderRadius: 2, border: '2px solid #e65100' }}>

              {/* 売買価格 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="body1" color="text.secondary">売買価格</Typography>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" fontWeight={700}>{formatMan(jotoYen)}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatYen(jotoYen)}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* 取得費 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Box>
                  <Typography variant="body1" color="text.secondary">取得費（概算）</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    売買価格 × 5%
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" fontWeight={700} color="text.secondary">−{formatMan(shotokuhi)}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatYen(shotokuhi)}</Typography>
                </Box>
              </Box>

              {/* 仲介手数料 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                <Box>
                  <Typography variant="body1" color="text.secondary">仲介手数料（税込）</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {jotoIsFlat ? '800万円以下 → 一律33万円' : '売買価格 × 3%＋6万円 × 消費税'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" fontWeight={700} color="text.secondary">−{formatMan(jotoCommission)}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatYen(jotoCommission)}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* 利益 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Box>
                  <Typography variant="body1" fontWeight={600} color="text.primary">利益</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    売買価格 − 取得費 − 仲介手数料
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" fontWeight={700} color="text.primary">{formatMan(rieki)}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatYen(rieki)}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* 譲渡所得税 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                <Box>
                  <Typography variant="body1" color="error.main" fontWeight={600}>譲渡所得税</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    利益 × 20%
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" fontWeight={700} color="error.main">−{formatMan(jotoZei)}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatYen(jotoZei)}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 1.5, borderWidth: 2, borderColor: '#e65100' }} />

              {/* 手元残 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" fontWeight={800} color="#e65100">手元残</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    売買価格 − 譲渡所得税 − 仲介手数料
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h5" fontWeight={800} color="#e65100">{formatMan(jotoTemodori)}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatYen(jotoTemodori)}</Typography>
                </Box>
              </Box>
            </Paper>
          )}

          <Box sx={{ mt: 2, p: 2, bgcolor: '#ffe0b2', borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
              【計算方法】取得費不明の場合、売買価格の5%を概算取得費として使用します
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
              ・取得費（概算）＝ 売買価格 × 5%
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
              ・利益 ＝ 売買価格 − 取得費 − 仲介手数料
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
              ・譲渡所得税 ＝ 利益 × 20%
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
              ・手元残 ＝ 売買価格 − 譲渡所得税 − 仲介手数料
            </Typography>
          </Box>
        </Box>


      </Box>

      {/* コピー完了通知 */}
      <Snackbar
        open={copySnackOpen}
        autoHideDuration={2000}
        onClose={() => setCopySnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setCopySnackOpen(false)} severity="success" sx={{ width: '100%' }}>
          コピーしました
        </Alert>
      </Snackbar>
    </>
  );
};

export default TemodoriCalcPage;
