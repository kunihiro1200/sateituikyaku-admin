import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

const API_BASE_URL = 'https://sateituikyaku-admin-backend.vercel.app';

// ============================================================
// 比較結果の1行表示
// ============================================================
function ResultLine({ line }: { line: string }) {
  const trimmed = (line || '').trim();

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
  if (trimmed === '') return <Box sx={{ height: 4 }} />;

  return (
    <Typography variant="body2" sx={{ py: 0.25 }}>
      {trimmed}
    </Typography>
  );
}

// ============================================================
// メインページ
// ============================================================
export default function FloorPlanComparePage() {
  const [folderUrl, setFolderUrl] = useState('');
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState('');
  const [foundFiles, setFoundFiles] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCompare = async () => {
    const url = folderUrl.trim();
    if (!url) {
      setErrorMsg('フォルダURLを入力してください');
      return;
    }
    setComparing(true);
    setResult('');
    setFoundFiles([]);
    setErrorMsg('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/floor-plan-compare/from-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderUrl: url }),
        signal: AbortSignal.timeout(180000),
      });

      const data = await response.json();

      if (!response.ok) {
        const errText = typeof data.error === 'string' ? data.error
          : data.error?.message ? String(data.error.message)
          : '比較中にエラーが発生しました';
        setErrorMsg(errText);
        return;
      }

      setResult(typeof data.result === 'string' ? data.result : '');
      setFoundFiles(Array.isArray(data.foundFiles) ? data.foundFiles.map(String) : []);
    } catch (err: any) {
      setErrorMsg(err?.message ? String(err.message) : '通信エラーが発生しました');
    } finally {
      setComparing(false);
    }
  };

  // 結果の統計
  const lines = result ? result.split('\n') : [];
  const okCount = lines.filter(l => l.includes('✅')).length;
  const warnCount = lines.filter(l => l.includes('⚠️')).length;
  const unknownCount = lines.filter(l => l.includes('❓')).length;

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
            GoogleドライブのフォルダURLを入力するだけで、AIが間取り図を自動識別して差異を洗い出します
          </Typography>
        </Box>

        {/* 入力フォーム */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            フォルダURLを入力
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            元図面と作成後の間取り図が入っているGoogleドライブのフォルダURLを入力してください。
            AIがフォルダ内の画像を自動スキャンして間取り図を識別し、差異を洗い出します。
          </Alert>

          <TextField
            label="GoogleドライブのフォルダURL"
            placeholder="https://drive.google.com/drive/folders/..."
            value={folderUrl}
            onChange={(e) => {
              setFolderUrl(e.target.value);
              setResult('');
              setErrorMsg('');
            }}
            fullWidth
            size="small"
            helperText="フォルダは「リンクを知っている全員が閲覧可能」に設定してください"
            InputProps={{
              startAdornment: <FolderOpenIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
            }}
          />

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={comparing
                ? <CircularProgress size={20} color="inherit" />
                : <CompareArrowsIcon />
              }
              onClick={handleCompare}
              disabled={!folderUrl.trim() || comparing}
              sx={{ minWidth: 220 }}
            >
              {comparing ? 'AI比較中...' : '差異を洗い出す'}
            </Button>
          </Box>

          {comparing && (
            <Alert severity="info" sx={{ mt: 2 }}>
              AIがフォルダ内の画像を解析して間取り図を識別しています。1〜3分程度かかります。
            </Alert>
          )}
        </Paper>

        {/* エラー */}
        {errorMsg !== '' && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {errorMsg}
          </Alert>
        )}

        {/* 使用ファイル情報 */}
        {result !== '' && foundFiles.length > 0 && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#f9f9f9' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              {`比較に使用した図面ファイル（${foundFiles.length}枚）`}
            </Typography>
            {foundFiles.map((name, idx) => (
              <Typography key={idx} variant="body2">
                {`図面${idx + 1}: ${String(name)}`}
              </Typography>
            ))}
          </Paper>
        )}

        {/* 比較結果 */}
        {result !== '' && (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6" fontWeight="bold">
                差異チェック結果
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={<CheckCircleOutlineIcon />}
                  label={`一致 ${okCount}件`}
                  color="success"
                  size="small"
                />
                {warnCount > 0 && (
                  <Chip
                    icon={<WarningAmberIcon />}
                    label={`差異あり ${warnCount}件`}
                    color="warning"
                    size="small"
                  />
                )}
                {unknownCount > 0 && (
                  <Chip
                    icon={<HelpOutlineIcon />}
                    label={`判定不可 ${unknownCount}件`}
                    color="default"
                    size="small"
                  />
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box>
              {lines.map((line, idx) => (
                <ResultLine key={idx} line={line} />
              ))}
            </Box>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<CompareArrowsIcon />}
                onClick={handleCompare}
                disabled={comparing}
              >
                再チェックする
              </Button>
            </Box>
          </Paper>
        )}

        {/* 使い方ガイド */}
        {result === '' && !comparing && (
          <Paper sx={{ p: 3, bgcolor: '#fff8e1' }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              使い方
            </Typography>
            <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
              <Box component="li" sx={{ mb: 1 }}>
                <Typography variant="body2">
                  元図面と作成後の間取り図が両方入っているGoogleドライブのフォルダを開く
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 1 }}>
                <Typography variant="body2">
                  フォルダを右クリック →「共有」→「リンクを知っている全員が閲覧可能」に設定 →「リンクをコピー」
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 1 }}>
                <Typography variant="body2">
                  コピーしたURLを上の入力欄に貼り付けて「差異を洗い出す」をクリック
                </Typography>
              </Box>
            </Box>
            <Alert severity="info" sx={{ mt: 2 }}>
              <strong>対応形式:</strong> JPG・PNG（フォルダ内に複数の画像があっても間取り図を自動識別します）
              <br />
              <strong>非対応:</strong> PDFファイル（JPG/PNGに変換してからご利用ください）
            </Alert>
          </Paper>
        )}

      </Container>
    </Box>
  );
}
