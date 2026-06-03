import { useEffect, useState } from 'react';
import { Box, Typography, TextField, InputAdornment, Divider, Paper } from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';

// ── タブのタイトル・ファビコンを動的に設定 ──
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
    // 800万円以下は一律33万円（税込み）
    return 330_000;
  }
  // 800万円超：売買価格 × 3% + 6万円 に消費税
  const base = price * 0.03 + 60_000;
  return Math.floor(base * 1.1);
}

/** 金額を「万円」表示にフォーマット（端数は千円単位まで） */
function formatMan(yen: number): string {
  if (yen <= 0) return '—';
  const man = yen / 10_000;
  // 万の位で割り切れるなら整数表示、そうでなければ小数1位
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

const TemodoriCalcPage = () => {
  usePageMeta('手元残計算');

  // 売買価格（万円単位で入力）
  const [priceInput, setPriceInput] = useState('');

  // 入力値を円換算
  const priceYen = parseFloat(priceInput) > 0 ? Math.round(parseFloat(priceInput) * 10_000) : 0;

  // 仲介手数料（円）
  const commission = calcCommission(priceYen);

  // 手元残（売買価格 − 仲介手数料）
  const temodori = priceYen > 0 ? priceYen - commission : 0;

  // 800万円以下かどうかのフラグ
  const isFlat = priceYen > 0 && priceYen <= 8_000_000;

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
          手元残計算
        </Typography>
      </Box>

      {/* 本文 */}
      <Box sx={{ pt: '72px', px: { xs: 2, sm: 4 }, pb: 6, maxWidth: 480, mx: 'auto' }}>

        {/* 売買価格入力 */}
        <Paper elevation={2} sx={{ p: 3, mt: 3, borderRadius: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" mb={1.5} fontWeight={600}>
            売買価格を入力してください
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
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '1.2rem',
                fontWeight: 600,
              },
            }}
            autoFocus
          />
        </Paper>

        {/* 計算結果 */}
        {priceYen > 0 && (
          <Paper elevation={3} sx={{ p: 3, mt: 2.5, borderRadius: 2, border: '2px solid #1565c0' }}>

            {/* 売買価格 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="body1" color="text.secondary">
                売買価格
              </Typography>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h6" fontWeight={700} color="text.primary">
                  {formatMan(priceYen)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatYen(priceYen)}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* 仲介手数料 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
              <Box>
                <Typography variant="body1" color="text.secondary">
                  仲介手数料（税込）
                </Typography>
                {isFlat ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    800万円以下 → 一律33万円
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    売買価格 × 3%＋6万円 × 消費税
                  </Typography>
                )}
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h6" fontWeight={700} color="error.main">
                  −{formatMan(commission)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatYen(commission)}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 1.5, borderWidth: 2, borderColor: '#1565c0' }} />

            {/* 手元残 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" fontWeight={800} color="#1565c0">
                手元残
              </Typography>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h5" fontWeight={800} color="#1565c0">
                  {formatMan(temodori)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatYen(temodori)}
                </Typography>
              </Box>
            </Box>
          </Paper>
        )}

        {/* 計算式の注記 */}
        <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1.5 }}>
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
    </>
  );
};

export default TemodoriCalcPage;
