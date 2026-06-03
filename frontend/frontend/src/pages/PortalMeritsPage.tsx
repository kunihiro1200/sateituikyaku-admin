import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Button, Divider } from '@mui/material';
import { Refresh as RefreshIcon, Print as PrintIcon } from '@mui/icons-material';
import api from '../services/api';

// ── タブのタイトル・ファビコンを動的に設定 ──
function usePageMeta(title: string) {
  useEffect(() => {
    document.title = title;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="#bf360c"/>
      <text x="16" y="22" font-size="13" font-family="'Hiragino Sans','Meiryo',sans-serif"
        font-weight="bold" fill="white" text-anchor="middle">物件</text>
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

// テキストをカテゴリ別にパースして整形表示
function ParsedMerits({ text }: { text: string }) {
  const lines = text.split('\n');
  const sections: { heading: string; items: string[] }[] = [];
  let current: { heading: string; items: string[] } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // 見出し判定：【...】形式、または「・」「-」で始まらない行
    // ただし箇条書き行（・ • - で始まる）は見出しではない
    const isBullet = /^[・•\-]/.test(line);
    // 【...】形式は確実に見出し
    const isBracketHeading = /^【.+】/.test(line);

    if (isBracketHeading) {
      // 【カテゴリ名】 → 見出しとして扱う（【】を除去して表示）
      const heading = line.replace(/^【/, '').replace(/】.*$/, '');
      current = { heading, items: [] };
      sections.push(current);
    } else if (isBullet) {
      // 箇条書き行
      if (!current) {
        current = { heading: '', items: [] };
        sections.push(current);
      }
      current.items.push(line.replace(/^[・•\-]\s*/, ''));
    } else {
      // 「・」なしの通常テキスト行 → 見出しとして扱う
      current = { heading: line, items: [] };
      sections.push(current);
    }
  }

  return (
    <>
      {sections.map((sec, idx) => (
        <Box key={idx} className="merit-section" sx={{ mb: 1.2 }}>
          {sec.heading && (
            <Typography
              className="merit-heading"
              variant="subtitle2"
              sx={{
                fontWeight: 'bold',
                color: '#1a237e',
                borderLeft: '4px solid #1a237e',
                pl: 1,
                mb: 0.5,
                fontSize: '0.88rem',
              }}
            >
              {sec.heading}
            </Typography>
          )}
          {sec.items.map((item, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.3, mb: 0.2, pl: 0.5 }}>
              <Typography component="span" sx={{ color: '#1976d2', fontWeight: 'bold', flexShrink: 0, fontSize: '0.8rem', lineHeight: 1.6 }}>
                ・
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6, fontSize: '0.8rem' }}>
                {item}
              </Typography>
            </Box>
          ))}
          {idx < sections.length - 1 && <Divider sx={{ mt: 1 }} />}
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

  // タブのタイトル・ファビコンを設定
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
      {/* 印刷用グローバルCSS */}
      <style>{`
        @media print {
          /* ツールバーを非表示 */
          .no-print { display: none !important; }

          /* A4・余白最小・白黒 */
          @page {
            size: A4 portrait;
            margin: 14mm 12mm 10mm 12mm;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color: #000 !important;
            background: white !important;
            font-size: 8pt !important;
          }

          /* コンテナ幅をA4に合わせる */
          .print-container {
            padding-top: 4mm !important;
            max-width: 100% !important;
          }

          /* タイトル行 */
          .print-title {
            font-size: 11pt !important;
            font-weight: bold !important;
            margin-bottom: 4mm !important;
            border-bottom: 1pt solid #000 !important;
            padding-bottom: 2mm !important;
          }

          /* セクション見出しを白黒・小サイズに */
          .merit-heading {
            font-size: 8.5pt !important;
            color: #000 !important;
            border-left: 3pt solid #000 !important;
            margin-bottom: 1mm !important;
            padding-left: 3mm !important;
          }

          /* 箇条書き本文 */
          .merit-section {
            margin-bottom: 3mm !important;
          }

          /* 区切り線を細く */
          hr, [class*="MuiDivider"] {
            border-color: #ccc !important;
            margin: 2mm 0 !important;
          }

          /* 全フォント強制 */
          * {
            font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif !important;
            line-height: 1.5 !important;
          }
        }
      `}</style>

      {/* ツールバー（印刷時非表示） */}
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={generate}
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: 'white' } }}
          >
            再生成
          </Button>
          {text && (
            <Button
              variant="contained"
              size="small"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
              sx={{ bgcolor: 'white', color: '#bf360c', fontWeight: 'bold', '&:hover': { bgcolor: '#fbe9e7' } }}
            >
              A4印刷
            </Button>
          )}
        </Box>
      </Box>

      {/* 本文 */}
      <Box
        className="print-container"
        sx={{ pt: '80px', px: { xs: 2, sm: 4 }, pb: 6, maxWidth: 800, mx: 'auto' }}
      >
        {/* 印刷時のみ表示するタイトル行 */}
        {text && (
          <Box className="print-title" sx={{ display: 'none', '@media print': { display: 'block' } }}>
            🏡 物件の長所　{address && `— ${address}`}
          </Box>
        )}
        {text && <ParsedMerits text={text} />}
      </Box>
    </>
  );
};

export default PortalMeritsPage;
