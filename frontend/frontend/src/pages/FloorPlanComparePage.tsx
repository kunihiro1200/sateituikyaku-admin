import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Paper,
  TextField,
  Typography,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import axios from 'axios';

// バックエンドAPIのベースURL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sateituikyaku-admin-backend.vercel.app';

/**
 * 比較結果テキストを行ごとに解析してスタイル付きで表示する
 */
function ResultLine({ line }: { line: string }) {
  const trimmed = line.trim();

  if (trimmed.startsWith('✅')) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}>
        <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 20, mt: 0.2, flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: 'success.dark' }}>
          {trimmed.replace(/^✅\s*/, '')}
        </Typography>
      </Box>
    );
  }

  if (trimmed.startsWith('⚠️')) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}>
        <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 20, mt: 0.2, flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 500 }}>
          {trimmed.replace(/^⚠️\s*/, '')}
        </Typography>
      </Box>
    );
  }

  if (trimmed.startsWith('❓')) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}>
        <HelpOutlineIcon sx={{ color: 'text.secondary', fontSize: 20, mt: 0.2, flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {trimmed.replace(/^❓\s*/, '')}
        </Typography>
      </Box>
    );
  }

  if (trimmed.startsWith('## ')) {
    return (
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2, mb: 0.5, color: 'primary.main' }}>
        {trimmed.replace(/^##\s*/, '')}
      </Typography>
    );
  }

  if (trimmed === '') {
    return <Box sx={{ height: 4 }} />;
  }

  return (
    <Typography variant="body2" sx={{ py: 0.25, color: 'text.primary' }}>
      {trimmed}
    </Typography>
  );
}

/**
 * 比較結果から統計を集計する
 */
function parseStats(result: string) {
  const lines = result.split('\n');
  let ok = 0;
  let warn = 0;
  let unknown = 0;
  for (const line of lines) {
    if (line.includes('✅')) ok++;
    else if (line.includes('⚠️')) warn++;
    else if (line.includes('❓')) unknown++;
  }
  return { ok, warn, unknown };
}

export default function FloorPlanComparePage() {
  const [originalUrl, setOriginalUrl] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [originalFetched, setOriginalFetched] = useState(false);
  const [publishedFetched, setPublishedFetched] = useState(false);

  const handleCompare = async () => {
    if (!originalUrl.trim() || !publishedUrl.trim()) {
      setError('元図面のURLと作成後図面のURLを両方入力してください');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/floor-plan-compare/from-url`,
        {
          originalUrl: originalUrl.trim(),
          publishedUrl: publishedUrl.trim(),
        },
        { timeout: 120000 } // 2分タイムアウト
      );

      setResult(response.data.result);
      setOriginalFetched(response.data.originalFetched);
      setPublishedFetched(response.data.publishedFetched);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err.message ||
        '比較中にエラーが発生しました。しばらく待ってから再試行してください。';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const stats = result ? parseStats(result) : null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', py: 4 }}>
      <Container maxWidth="md">
        {/* ヘッダー */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <CompareArrowsIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            間取り図 比較チェック
          </Typography>
          <Typography variant="body1" color="text.secondary">
            元図面と作成後の間取り図を比較して、窓・扉・部屋数などの差異を自動検出します
          </Typography>
        </Box>

        {/* 入力フォーム */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            図面URLを入力
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            GoogleドライブのファイルURL（共有リンク）または画像URLを入力してください。
            ファイルは「リンクを知っている全員が閲覧可能」に設定してください。
          </Typography>

          <Stack spacing={2}>
            <TextField
              label="図面A（元図面・原本）のURL"
              placeholder="https://drive.google.com/file/d/... または https://drive.google.com/open?id=..."
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              fullWidth
              size="small"
              helperText="白黒・手書き・CADデータなど、もとの図面"
            />
            <TextField
              label="図面B（作成後の間取り図）のURL"
              placeholder="https://drive.google.com/file/d/... または https://drive.google.com/open?id=..."
              value={publishedUrl}
              onChange={(e) => setPublishedUrl(e.target.value)}
              fullWidth
              size="small"
              helperText="カラー・整形済みの掲載用間取り図"
            />
          </Stack>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CompareArrowsIcon />}
              onClick={handleCompare}
              disabled={loading || !originalUrl.trim() || !publishedUrl.trim()}
              sx={{ minWidth: 200 }}
            >
              {loading ? '比較中...' : '比較を実行'}
            </Button>
          </Box>

          {loading && (
            <Alert severity="info" sx={{ mt: 2 }}>
              AIが図面を解析しています。30秒〜2分程度かかります。そのままお待ちください。
            </Alert>
          )}
        </Paper>

        {/* エラー表示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* 取得状況 */}
        {result && (
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              icon={originalFetched ? <CheckCircleOutlineIcon /> : <WarningAmberIcon />}
              label={originalFetched ? '図面A: 取得成功' : '図面A: 取得失敗'}
              color={originalFetched ? 'success' : 'warning'}
              size="small"
            />
            <Chip
              icon={publishedFetched ? <CheckCircleOutlineIcon /> : <WarningAmberIcon />}
              label={publishedFetched ? '図面B: 取得成功' : '図面B: 取得失敗'}
              color={publishedFetched ? 'success' : 'warning'}
              size="small"
            />
          </Box>
        )}

        {/* 比較結果 */}
        {result && stats && (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6" fontWeight="bold">
                比較結果
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  icon={<CheckCircleOutlineIcon />}
                  label={`一致 ${stats.ok}件`}
                  color="success"
                  size="small"
                />
                {stats.warn > 0 && (
                  <Chip
                    icon={<WarningAmberIcon />}
                    label={`差異あり ${stats.warn}件`}
                    color="warning"
                    size="small"
                  />
                )}
                {stats.unknown > 0 && (
                  <Chip
                    icon={<HelpOutlineIcon />}
                    label={`判定不可 ${stats.unknown}件`}
                    color="default"
                    size="small"
                  />
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box>
              {result.split('\n').map((line, idx) => (
                <ResultLine key={idx} line={line} />
              ))}
            </Box>
          </Paper>
        )}

        {/* 使い方ガイド */}
        {!result && !loading && (
          <Paper sx={{ p: 3, bgcolor: '#fff8e1' }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              使い方
            </Typography>
            <Typography variant="body2" component="div">
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li style={{ marginBottom: 8 }}>
                  GoogleドライブでファイルをJPGまたはPNG形式で保存する
                </li>
                <li style={{ marginBottom: 8 }}>
                  ファイルを右クリック →「共有」→「リンクを知っている全員が閲覧可能」に設定する
                </li>
                <li style={{ marginBottom: 8 }}>
                  「リンクをコピー」してURLを上の入力欄に貼り付ける
                </li>
                <li style={{ marginBottom: 8 }}>
                  「比較を実行」ボタンをクリックする（30秒〜2分かかります）
                </li>
              </ol>
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              <strong>対応形式:</strong> JPG・PNG（GoogleドライブURL または 直接画像URL）
              <br />
              <strong>非対応:</strong> PDFファイル（JPG/PNGに変換してからご利用ください）
            </Alert>
          </Paper>
        )}
      </Container>
    </Box>
  );
}
