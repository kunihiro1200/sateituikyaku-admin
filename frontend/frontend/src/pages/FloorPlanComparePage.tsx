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
import ImageIcon from '@mui/icons-material/Image';
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
// 比較結果の行表示コンポーネント
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
// ファイル選択パネル（フォルダURL入力後に表示）
// ============================================================

interface FileSelectorProps {
  label: string;
  url: string;
  onUrlChange: (v: string) => void;
  files: DriveFileItem[] | null;
  loadingFiles: boolean;
  selectedFileId: string | null;
  onSelectFile: (id: string | null) => void;
  onLoadFiles: () => void;
  helperText: string;
}

function FileSelector({
  label, url, onUrlChange, files, loadingFiles,
  selectedFileId, onSelectFile, onLoadFiles, helperText,
}: FileSelectorProps) {
  const isFolderUrl = url.includes('/folders/');

  return (
    <Box>
      <TextField
        label={label}
        placeholder="https://drive.google.com/drive/folders/..."
        value={url}
        onChange={(e) => {
          onUrlChange(e.target.value);
          onSelectFile(null); // URL変更時は選択リセット
        }}
        fullWidth
        size="small"
        helperText={helperText}
        InputProps={{
          startAdornment: (
            <FolderOpenIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
          ),
        }}
      />

      {/* フォルダURLの場合: ファイル一覧を読み込むボタン */}
      {isFolderUrl && url.trim() && (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={loadingFiles ? <CircularProgress size={14} /> : <FolderOpenIcon />}
            onClick={onLoadFiles}
            disabled={loadingFiles}
          >
            {loadingFiles ? 'ファイル一覧を読み込み中...' : 'フォルダ内のファイルを確認'}
          </Button>
        </Box>
      )}

      {/* ファイル一覧 */}
      {files && files.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            フォルダ内のファイル（クリックして間取り図を指定、または自動選択のままにする）
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {/* 自動選択オプション */}
            <Tooltip title="AIが自動で間取り図を選択します">
              <Box
                onClick={() => onSelectFile(null)}
                sx={{
                  border: selectedFileId === null ? '2px solid' : '1px solid',
                  borderColor: selectedFileId === null ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  p: 0.75,
                  cursor: 'pointer',
                  bgcolor: selectedFileId === null ? 'primary.50' : 'background.paper',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: 100,
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <AutoFixHighIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                <Typography variant="caption" fontWeight={selectedFileId === null ? 'bold' : 'normal'}>
                  自動選択
                </Typography>
              </Box>
            </Tooltip>

            {/* 各ファイル */}
            {files.map(file => (
              <Tooltip key={file.id} title={file.name}>
                <Box
                  onClick={() => onSelectFile(file.id === selectedFileId ? null : file.id)}
                  sx={{
                    border: selectedFileId === file.id ? '2px solid' : '1px solid',
                    borderColor: selectedFileId === file.id ? 'primary.main'
                      : file.likelyFloorPlan === 'yes' ? 'success.light'
                      : file.likelyFloorPlan === 'no' ? 'error.light'
                      : 'divider',
                    borderRadius: 1,
                    p: 0.5,
                    cursor: 'pointer',
                    bgcolor: selectedFileId === file.id ? 'primary.50' : 'background.paper',
                    width: 80,
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  {/* サムネイル */}
                  <Box
                    component="img"
                    src={file.thumbnailUrl}
                    alt={file.name}
                    onError={(e: any) => { e.target.style.display = 'none'; }}
                    sx={{
                      width: '100%',
                      height: 60,
                      objectFit: 'cover',
                      borderRadius: 0.5,
                      display: 'block',
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 0.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '10px',
                    }}
                  >
                    {file.name}
                  </Typography>
                  {/* 間取り図判定バッジ */}
                  {file.likelyFloorPlan === 'yes' && (
                    <Chip label="間取り図" size="small" color="success"
                      sx={{ fontSize: '9px', height: 14, mt: 0.25, '& .MuiChip-label': { px: 0.5 } }} />
                  )}
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}

      {files && files.length === 0 && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          フォルダ内に画像ファイル（JPG/PNG）が見つかりませんでした
        </Alert>
      )}
    </Box>
  );
}

// ============================================================
// メインページ
// ============================================================

export default function FloorPlanComparePage() {
  const [originalUrl, setOriginalUrl] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');

  const [originalFiles, setOriginalFiles] = useState<DriveFileItem[] | null>(null);
  const [publishedFiles, setPublishedFiles] = useState<DriveFileItem[] | null>(null);
  const [loadingOriginalFiles, setLoadingOriginalFiles] = useState(false);
  const [loadingPublishedFiles, setLoadingPublishedFiles] = useState(false);

  const [selectedOriginalFileId, setSelectedOriginalFileId] = useState<string | null>(null);
  const [selectedPublishedFileId, setSelectedPublishedFileId] = useState<string | null>(null);

  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{
    originalFileName: string;
    publishedFileName: string;
    originalSelectionNote: string;
    publishedSelectionNote: string;
    originalFetched: boolean;
    publishedFetched: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // フォルダ内ファイル一覧を取得
  const loadFiles = async (url: string, side: 'original' | 'published') => {
    const setLoading = side === 'original' ? setLoadingOriginalFiles : setLoadingPublishedFiles;
    const setFiles = side === 'original' ? setOriginalFiles : setPublishedFiles;

    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/floor-plan-compare/list-files`, {
        params: { url },
        timeout: 30000,
      });
      setFiles(res.data.files || []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'ファイル一覧の取得に失敗しました';
      setError(msg);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  // 比較実行
  const handleCompare = async () => {
    if (!originalUrl.trim() || !publishedUrl.trim()) {
      setError('元図面のURLと作成後図面のURLを両方入力してください');
      return;
    }

    setComparing(true);
    setResult(null);
    setResultMeta(null);
    setError(null);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/floor-plan-compare/from-url`,
        {
          originalUrl: originalUrl.trim(),
          publishedUrl: publishedUrl.trim(),
          originalFileId: selectedOriginalFileId || undefined,
          publishedFileId: selectedPublishedFileId || undefined,
        },
        { timeout: 180000 } // 3分タイムアウト
      );

      setResult(res.data.result);
      setResultMeta({
        originalFileName: res.data.originalFileName,
        publishedFileName: res.data.publishedFileName,
        originalSelectionNote: res.data.originalSelectionNote,
        publishedSelectionNote: res.data.publishedSelectionNote,
        originalFetched: res.data.originalFetched,
        publishedFetched: res.data.publishedFetched,
      });
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
  const canCompare = originalUrl.trim() && publishedUrl.trim() && !comparing;

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
            GoogleドライブのフォルダURLを入力すると、AIが間取り図を自動識別して比較します
          </Typography>
        </Box>

        {/* 入力フォーム */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            フォルダURLを入力
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            GoogleドライブのフォルダURLを入力してください。フォルダ内の画像ファイルを自動スキャンし、
            間取り図を識別して比較します。フォルダは「リンクを知っている全員が閲覧可能」に設定してください。
          </Alert>

          <Stack spacing={3}>
            {/* 元図面 */}
            <FileSelector
              label="図面A（元図面・原本）のフォルダURL"
              url={originalUrl}
              onUrlChange={(v) => { setOriginalUrl(v); setOriginalFiles(null); }}
              files={originalFiles}
              loadingFiles={loadingOriginalFiles}
              selectedFileId={selectedOriginalFileId}
              onSelectFile={setSelectedOriginalFileId}
              onLoadFiles={() => loadFiles(originalUrl, 'original')}
              helperText="白黒・手書き・CADデータなど、もとの図面が入ったフォルダ"
            />

            <Divider>
              <CompareArrowsIcon sx={{ color: 'text.secondary' }} />
            </Divider>

            {/* 作成後図面 */}
            <FileSelector
              label="図面B（作成後の間取り図）のフォルダURL"
              url={publishedUrl}
              onUrlChange={(v) => { setPublishedUrl(v); setPublishedFiles(null); }}
              files={publishedFiles}
              loadingFiles={loadingPublishedFiles}
              selectedFileId={selectedPublishedFileId}
              onSelectFile={setSelectedPublishedFileId}
              onLoadFiles={() => loadFiles(publishedUrl, 'published')}
              helperText="カラー・整形済みの掲載用間取り図が入ったフォルダ"
            />
          </Stack>

          {/* 比較ボタン */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={comparing ? <CircularProgress size={20} color="inherit" /> : <CompareArrowsIcon />}
              onClick={handleCompare}
              disabled={!canCompare}
              sx={{ minWidth: 220 }}
            >
              {comparing ? 'AI比較中...' : '比較を実行'}
            </Button>
          </Box>

          {comparing && (
            <Alert severity="info" sx={{ mt: 2 }}>
              AIがフォルダ内の画像を解析して間取り図を識別しています。
              1〜3分程度かかります。そのままお待ちください。
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
        {resultMeta && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#f9f9f9' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              使用した図面ファイル
            </Typography>
            <Stack spacing={0.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ImageIcon sx={{ fontSize: 16, color: resultMeta.originalFetched ? 'success.main' : 'error.main' }} />
                <Typography variant="body2">
                  <strong>図面A（元図面）:</strong> {resultMeta.originalFileName}
                  {resultMeta.originalSelectionNote && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      （{resultMeta.originalSelectionNote}）
                    </Typography>
                  )}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ImageIcon sx={{ fontSize: 16, color: resultMeta.publishedFetched ? 'success.main' : 'error.main' }} />
                <Typography variant="body2">
                  <strong>図面B（作成後）:</strong> {resultMeta.publishedFileName}
                  {resultMeta.publishedSelectionNote && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      （{resultMeta.publishedSelectionNote}）
                    </Typography>
                  )}
                </Typography>
              </Box>
            </Stack>
            {(!resultMeta.originalFetched || !resultMeta.publishedFetched) && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                一部の図面を取得できませんでした。フォルダ内のファイルを確認してください。
              </Alert>
            )}
          </Paper>
        )}

        {/* 比較結果 */}
        {result && stats && (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6" fontWeight="bold">
                比較結果
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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

            {/* 再比較ボタン */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<CompareArrowsIcon />}
                onClick={handleCompare}
                disabled={comparing}
              >
                再比較する
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
            <Typography variant="body2" component="div">
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li style={{ marginBottom: 8 }}>
                  GoogleドライブでフォルダのURLをコピーする
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    フォルダを右クリック →「共有」→「リンクを知っている全員が閲覧可能」に設定 →「リンクをコピー」
                  </Typography>
                </li>
                <li style={{ marginBottom: 8 }}>
                  元図面フォルダのURLと、作成後図面フォルダのURLをそれぞれ入力する
                </li>
                <li style={{ marginBottom: 8 }}>
                  「フォルダ内のファイルを確認」ボタンでサムネイルを確認し、必要に応じて比較したいファイルを選択する
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    選択しない場合はAIが自動で間取り図を識別します
                  </Typography>
                </li>
                <li style={{ marginBottom: 8 }}>
                  「比較を実行」ボタンをクリックする（1〜3分かかります）
                </li>
              </ol>
            </Typography>
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
