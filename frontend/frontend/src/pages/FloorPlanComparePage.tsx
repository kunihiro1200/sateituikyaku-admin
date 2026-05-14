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
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sateituikyaku-admin-backend.vercel.app';

// ============================================================
// 型定義
// ============================================================

interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  likelyFloorPlan: 'yes' | 'no' | 'maybe';
  thumbnailUrl: string;
  viewUrl: string;
}

// ============================================================
// 比較結果の行表示
// ============================================================

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
  if (trimmed === '') return <Box sx={{ height: 4 }} />;

  return (
    <Typography variant="body2" sx={{ py: 0.25 }}>
      {trimmed}
    </Typography>
  );
}

function parseStats(result: string) {
  const lines = result.split('\n');
  let ok = 0, warn = 0, unknown = 0;
  for (const line of lines) {
    if (line.includes('✅')) ok++;
    else if (line.includes('⚠️')) warn++;
    else if (line.includes('❓')) unknown++;
  }
  return { ok, warn, unknown };
}

// ============================================================
// メインページ
// ============================================================

export default function FloorPlanComparePage() {
  const [folderUrl, setFolderUrl] = useState('');

  // ファイル一覧プレビュー
  const [files, setFiles] = useState<DriveFileItem[] | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // 手動選択（任意）
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // 比較結果
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [foundFiles, setFoundFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // フォルダ内ファイル一覧を取得
  const handleLoadFiles = async () => {
    if (!folderUrl.trim()) return;
    setLoadingFiles(true);
    setFiles(null);
    setSelectedFileIds([]);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/floor-plan-compare/list-files`, {
        params: { url: folderUrl.trim() },
        timeout: 30000,
      });
      setFiles(res.data.files || []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'ファイル一覧の取得に失敗しました';
      setError(msg);
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  // ファイル選択トグル
  const toggleFileSelect = (fileId: string) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  // 比較実行
  const handleCompare = async () => {
    if (!folderUrl.trim()) {
      setError('フォルダURLを入力してください');
      return;
    }
    setComparing(true);
    setResult(null);
    setFoundFiles([]);
    setError(null);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/floor-plan-compare/from-folder`,
        {
          folderUrl: folderUrl.trim(),
          selectedFileIds: selectedFileIds.length >= 2 ? selectedFileIds : undefined,
        },
        { timeout: 180000 }
      );
      setResult(res.data.result);
      setFoundFiles(res.data.foundFiles || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err.message ||
        '比較中にエラーが発生しました。しばらく待ってから再試行してください。';
      setError(msg);
    } finally {
      setComparing(false);
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
              setFiles(null);
              setSelectedFileIds([]);
              setResult(null);
              setError(null);
            }}
            fullWidth
            size="small"
            helperText="フォルダは「リンクを知っている全員が閲覧可能」に設定してください"
            InputProps={{
              startAdornment: <FolderOpenIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
            }}
          />

          {/* ファイル確認ボタン */}
          {folderUrl.includes('/folders/') && (
            <Box sx={{ mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={loadingFiles ? <CircularProgress size={14} /> : <FolderOpenIcon />}
                onClick={handleLoadFiles}
                disabled={loadingFiles}
              >
                {loadingFiles ? 'ファイル一覧を読み込み中...' : 'フォルダ内のファイルを確認（任意）'}
              </Button>
            </Box>
          )}

          {/* ファイル一覧サムネイル */}
          {files && files.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                フォルダ内のファイル一覧 — 比較したいファイルを2枚以上クリックして選択できます（選択しない場合はAIが自動選択）
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {/* 自動選択オプション */}
                <Tooltip title="AIが自動で間取り図を選択します">
                  <Box
                    onClick={() => setSelectedFileIds([])}
                    sx={{
                      border: selectedFileIds.length === 0 ? '2px solid' : '1px solid',
                      borderColor: selectedFileIds.length === 0 ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      p: 1,
                      cursor: 'pointer',
                      bgcolor: selectedFileIds.length === 0 ? 'primary.50' : 'background.paper',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                      width: 80,
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    <AutoFixHighIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                    <Typography variant="caption" fontWeight={selectedFileIds.length === 0 ? 'bold' : 'normal'} textAlign="center">
                      自動選択
                    </Typography>
                  </Box>
                </Tooltip>

                {/* 各ファイル */}
                {files.map(file => {
                  const isSelected = selectedFileIds.includes(file.id);
                  return (
                    <Tooltip key={file.id} title={file.name}>
                      <Box
                        onClick={() => toggleFileSelect(file.id)}
                        sx={{
                          border: isSelected ? '2px solid' : '1px solid',
                          borderColor: isSelected ? 'primary.main'
                            : file.likelyFloorPlan === 'yes' ? 'success.light'
                            : file.likelyFloorPlan === 'no' ? 'grey.300'
                            : 'divider',
                          borderRadius: 1,
                          p: 0.5,
                          cursor: 'pointer',
                          bgcolor: isSelected ? 'primary.50' : 'background.paper',
                          width: 80,
                          opacity: file.likelyFloorPlan === 'no' ? 0.5 : 1,
                          '&:hover': { borderColor: 'primary.main', opacity: 1 },
                        }}
                      >
                        <Box
                          component="img"
                          src={file.thumbnailUrl}
                          alt={file.name}
                          onError={(e: any) => { e.target.style.display = 'none'; }}
                          sx={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 0.5, display: 'block' }}
                        />
                        <Typography variant="caption" sx={{
                          display: 'block', mt: 0.25,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '10px',
                        }}>
                          {file.name}
                        </Typography>
                        {file.likelyFloorPlan === 'yes' && (
                          <Chip label="間取り図" size="small" color="success"
                            sx={{ fontSize: '9px', height: 14, mt: 0.25, '& .MuiChip-label': { px: 0.5 } }} />
                        )}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
              {selectedFileIds.length > 0 && selectedFileIds.length < 2 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  比較するには2枚以上選択してください（現在 {selectedFileIds.length} 枚）
                </Alert>
              )}
            </Box>
          )}

          {files && files.length === 0 && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              フォルダ内に画像ファイル（JPG/PNG）が見つかりませんでした
            </Alert>
          )}

          {/* 比較ボタン */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={comparing ? <CircularProgress size={20} color="inherit" /> : <CompareArrowsIcon />}
              onClick={handleCompare}
              disabled={!folderUrl.trim() || comparing || (selectedFileIds.length > 0 && selectedFileIds.length < 2)}
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

        {/* エラー表示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* 使用ファイル情報 */}
        {result && foundFiles.length > 0 && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#f9f9f9' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              比較に使用した図面ファイル（{foundFiles.length}枚）
            </Typography>
            <Stack spacing={0.5}>
              {foundFiles.map((name, idx) => (
                <Typography key={idx} variant="body2">
                  {`図面${idx + 1}: ${name}`}
                </Typography>
              ))}
            </Stack>
          </Paper>
        )}

        {/* 比較結果 */}
        {result && stats && (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6" fontWeight="bold">
                差異チェック結果
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip icon={<CheckCircleOutlineIcon />} label={`一致 ${stats.ok}件`} color="success" size="small" />
                {stats.warn > 0 && (
                  <Chip icon={<WarningAmberIcon />} label={`差異あり ${stats.warn}件`} color="warning" size="small" />
                )}
                {stats.unknown > 0 && (
                  <Chip icon={<HelpOutlineIcon />} label={`判定不可 ${stats.unknown}件`} color="default" size="small" />
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box>
              {result.split('\n').map((line, idx) => (
                <ResultLine key={idx} line={line} />
              ))}
            </Box>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button variant="outlined" startIcon={<CompareArrowsIcon />} onClick={handleCompare} disabled={comparing}>
                再チェックする
              </Button>
            </Box>
          </Paper>
        )}

        {/* 使い方ガイド */}
        {!result && !comparing && (
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
