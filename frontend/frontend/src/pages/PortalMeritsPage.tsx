import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Button, Divider } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import api from '../services/api';

// ── タブのタイトル・ファビコンを動的に設定 ──
function usePageMeta(title: string) {
  useEffect(() => {
    // タイトル
    document.title = title;

    // 赤背景に白文字「物件」のSVGファビコン
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="#bf360c"/>
      <text x="16" y="22" font-size="13" font-family="'Hiragino Sans','Meiryo',sans-serif"
        font-weight="bold" fill="white" text-anchor="middle">物件</text>
    </svg>`;
    const svgUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    // 既存ファビコンを差し替え
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = svgUrl;

    // アンマウント時は元に戻さない（別タブなので不要）
  }, [title]);
}

// テキストをカテゴリ別にパースして整形表示
function ParsedMerits({ text }: { text: string }) {
  const lines = text.split('\n');
  const sections: { heading: string; items: string[] }[] = [];
  let current: { heading: string; items: string[] } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[・•\-]/.test(line)) {
      if (!current) {
        current = { heading: '', items: [] };
        sections.push(current);
      }
      current.items.push(line.replace(/^[・•\-]\s*/, ''));
    } else {
      current = { heading: line, items: [] };
      sections.push(current);
    }
  }

  return (
    <>
      {sections.map((sec, idx) => (
        <Box key={idx} sx={{ mb: 2.5 }}>
          {sec.heading && (
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 'bold',
                color: '#1a237e',
                borderLeft: '5px solid #1a237e',
                pl: 1.5,
                mb: 1,
                fontSize: '1rem',
              }}
            >
              {sec.heading}
            </Typography>
          )}
          {sec.items.map((item, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5, pl: 1 }}>
              <Typography component="span" sx={{ color: '#1976d2', fontWeight: 'bold', mt: '2px', flexShrink: 0 }}>
                ・
              </Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.8, fontSize: '0.95rem' }}>
                {item}
              </Typography>
            </Box>
          ))}
          {idx < sections.length - 1 && <Divider sx={{ mt: 2 }} />}
        </Box>
      ))}
    </>
  );
}

const PortalMeritsPage = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [text, setText] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  // タブのタイトル・ファビコンを設定（住所が取得できたら更新）
  usePageMeta(address ? `物件の長所 | ${address}` : '物件の長所');

  const generate = async () => {
    setLoading(true);
    setError(null);
    setText(null);
    try {
      const res = await api.post(`/api/sellers/${sellerId}/portal-merits`);
      setText(res.data.text || '');
      setAddress(res.data.address || '');
    } catch (e: any) {
      setError(e?.response?.data?.error || '生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    generate();
  }, [sellerId]);

  if (loading) {
    return (
      <Box sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', gap: 3, bgcolor: '#f5f5f5',
      }}>
        <CircularProgress size={64} thickness={4} />
        <Typography variant="h6" color="text.secondary">
          ChatGPTが物件の長所を生成中です...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          20〜40秒ほどかかります。このタブはそのままにして他の作業をどうぞ。
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2 }}>
        <Typography color="error">{error}</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={generate}>再試行</Button>
      </Box>
    );
  }

  return (
    <>
      {/* ツールバー */}
      <Box className="no-print" sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        bgcolor: '#bf360c', color: 'white', px: 3, py: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: 3,
      }}>
        <Box>
          <Typography variant="subtitle1" fontWeight="bold">
            🏡 物件の長所
          </Typography>
          {address && (
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              {address}
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={generate}
          sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: 'white' } }}
        >
          再生成
        </Button>
      </Box>

      {/* 本文 */}
      <Box sx={{ pt: '60px', px: { xs: 2, sm: 4 }, pb: 6, maxWidth: 800, mx: 'auto' }}>
        {text && <ParsedMerits text={text} />}
      </Box>
    </>
  );
};

export default PortalMeritsPage;
