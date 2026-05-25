import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  Snackbar,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SearchIcon from '@mui/icons-material/Search';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_BASE_URL =
  import.meta.env.MODE === 'production'
    ? 'https://sateituikyaku-admin-backend.vercel.app'
    : import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 1リクエストの最大サイズ（Vercel制限4.5MB → Base64は約3MB相当のバイナリ）
const MAX_BYTES_PER_REQUEST = 3 * 1024 * 1024; // 3MB

interface GaiyoshoResult {
  key: string;
  label: string;
  content: string | null;
  found: boolean;
  cell: string | null;
  type?: string;
}

interface FilePayload {
  name: string;
  mimeType: string;
  base64: string;
}

/**
 * PDFを指定バイト以下のチャンクに分割する
 */
async function splitPdfIntoChunks(
  file: File,
  maxBytes: number,
  onProgress?: (page: number, total: number) => void
): Promise<FilePayload[][]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  const pages: FilePayload[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages);

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    const base64 = dataUrl.split(',')[1];

    pages.push({
      name: `${file.name}_p${pageNum}.jpg`,
      mimeType: 'image/jpeg',
      base64,
    });
  }

  // ページをサイズ制限内のチャンクに分割
  const chunks: FilePayload[][] = [];
  let currentChunk: FilePayload[] = [];
  let currentSize = 0;

  for (const page of pages) {
    const pageSize = page.base64.length * 0.75;
    if (currentSize + pageSize > maxBytes && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }
    currentChunk.push(page);
    currentSize += pageSize;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  return chunks;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 全ファイルを1つのリクエストにまとめて送信する
 * バラバラな書類を横断的にまとめて解析するため、分割せず一括送信
 */
async function analyzeAllFiles(files: FilePayload[]): Promise<GaiyoshoResult[]> {
  const response = await fetch(`${API_BASE_URL}/api/kenchiku-gaiyosho/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || `APIエラー: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

const KenchikuGaiyoshoPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyNumber = searchParams.get('propertyNumber');
  const spreadsheetUrl = searchParams.get('spreadsheetUrl');

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<GaiyoshoResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [writing, setWriting] = useState(false);
  const [writeSuccess, setWriteSuccess] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [isFromCache, setIsFromCache] = React.useState(false);

  // ページ表示時に保存済みデータを読み込む
  React.useEffect(() => {
    if (!propertyNumber) return;
    fetch(`${API_BASE_URL}/api/kenchiku-gaiyosho/${encodeURIComponent(propertyNumber)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.results) {
          setResults(json.data.results);
          setSavedAt(json.data.analyzed_at);
          setIsFromCache(true);
        }
      })
      .catch(() => {});
  }, [propertyNumber]);

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    const valid = Array.from(newFiles).filter((f) => allowed.includes(f.type));
    if (valid.length === 0) {
      setError('対応ファイル形式: JPEG, PNG, GIF, WebP, PDF');
      return;
    }
    setFiles((prev) => [...prev, ...valid]);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('ファイルを選択してください');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setProgress(0);

    try {
      // 全ファイルをBase64に変換（PDFはJPEGページに展開）
      const allPayloads: FilePayload[] = [];

      for (const file of files) {
        if (file.type === 'application/pdf') {
          setLoadingMessage(`PDFを変換中: ${file.name}`);
          const chunks = await splitPdfIntoChunks(file, MAX_BYTES_PER_REQUEST, (page, total) => {
            setLoadingMessage(`PDFを変換中: ${file.name} (${page}/${total}ページ)`);
          });
          // PDFのページを全て追加
          for (const chunk of chunks) {
            allPayloads.push(...chunk);
          }
        } else {
          setLoadingMessage(`ファイルを準備中: ${file.name}`);
          const base64 = await fileToBase64(file);
          allPayloads.push({ name: file.name, mimeType: file.type, base64 });
        }
      }

      // 全ファイルをまとめてClaude AIに送信（バラバラな書類を横断解析）
      setLoadingMessage(`Claude AIが${allPayloads.length}枚の書類を解析中...`);
      setProgress(50);

      const merged = await analyzeAllFiles(allPayloads);

      setProgress(100);
      setResults(merged);
      setIsFromCache(false);

      // 物件番号がある場合は自動保存
      if (propertyNumber) {
        setSaving(true);
        try {
          await fetch(`${API_BASE_URL}/api/kenchiku-gaiyosho/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyNumber, results: merged }),
          });
          setSavedAt(new Date().toISOString());
        } catch {
          // 保存失敗は無視
        } finally {
          setSaving(false);
        }
      }
    } catch (err: any) {
      setError(err.message || '解析中にエラーが発生しました');
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setProgress(0);
    }
  };

  // 重説シートへの書き込み
  const handleWriteToSheet = async () => {
    if (!results || !spreadsheetUrl) return;

    setWriting(true);
    setWriteError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/kenchiku-gaiyosho/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetUrl, results }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '書き込みに失敗しました');
      }

      setWriteSuccess(true);
      setSnackbarMessage(data.message || '重説シートへの書き込みが完了しました');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (err: any) {
      setWriteError(err.message || '書き込み中にエラーが発生しました');
      setSnackbarMessage(err.message || '書き込み中にエラーが発生しました');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setWriting(false);
    }
  };

  const foundCount = results?.filter((r) => r.found).length ?? 0;
  const totalCount = results?.length ?? 0;
  const writableCount = results?.filter((r) => r.found && r.cell).length ?? 0;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/work-tasks')}
          sx={{ whiteSpace: 'nowrap' }}
        >
          業務一覧
        </Button>
        <Typography variant="h5" fontWeight="bold">
          建築概要書 解析
        </Typography>
        {propertyNumber && (
          <Chip label={propertyNumber} size="small" color="primary" variant="outlined" />
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        都市計画図・用途地域図・建築計画概要書・開発登録簿・重説資料・建築確認済証・検査済証などの書類（複数枚）をまとめてアップロードすると、Claude AIが横断的に解析し、重説シートの各セルへ自動入力します。
      </Typography>

      {/* ファイルアップロードエリア */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          mb: 2,
          border: dragOver ? '2px dashed #2e7d32' : '2px dashed #ccc',
          backgroundColor: dragOver ? '#e8f5e9' : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.2s',
          textAlign: 'center',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('gaiyosho-file-input')?.click()}
      >
        <input
          id="gaiyosho-file-input"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => addFiles(e.target.files)}
        />
        <UploadFileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body1" color="text.secondary">
          ここにファイルをドロップ、またはクリックして選択
        </Typography>
        <Typography variant="caption" color="text.disabled">
          複数ファイル対応（PDF・JPEG・PNG）｜都市計画図・建築計画概要書・確認済証など何枚でも
        </Typography>
      </Paper>

      {files.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            選択中のファイル（{files.length}枚）—— 全てまとめてClaude AIで解析します
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {files.map((file, i) => (
              <Chip
                key={i}
                icon={file.type === 'application/pdf' ? <PictureAsPdfIcon /> : <ImageIcon />}
                label={`${file.name} (${(file.size / 1024).toFixed(0)}KB)`}
                onDelete={() => removeFile(i)}
                color={file.type === 'application/pdf' ? 'error' : 'success'}
                variant="outlined"
                size="small"
              />
            ))}
          </Box>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        size="large"
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
        onClick={handleAnalyze}
        disabled={loading || files.length === 0}
        fullWidth
        sx={{ mb: loading ? 1 : 3, bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
      >
        {loading ? '解析中...' : `建築概要書を解析する（${files.length}枚）`}
      </Button>

      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress
            variant={progress > 0 ? 'determinate' : 'indeterminate'}
            value={progress}
            color="success"
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}
          >
            {loadingMessage}
          </Typography>
        </Box>
      )}

      {results && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography variant="h6" fontWeight="bold">
              解析結果
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {saving && <CircularProgress size={16} />}
              {savedAt && !saving && (
                <Chip
                  label={`保存済み ${new Date(savedAt).toLocaleString('ja-JP', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`}
                  size="small"
                  color="success"
                  variant="outlined"
                />
              )}
              <Chip
                label={`${foundCount} / ${totalCount} 項目が見つかりました`}
                color={foundCount > 0 ? 'success' : 'default'}
              />
              {/* 書き込みボタン：キャッシュ時は再解析を促す */}
              {spreadsheetUrl && writableCount > 0 && (
                isFromCache ? (
                  <Chip
                    label="⚠️ 再解析してから書き込んでください"
                    size="small"
                    color="warning"
                    variant="filled"
                    sx={{ fontWeight: 700 }}
                  />
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={
                      writing ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />
                    }
                    onClick={handleWriteToSheet}
                    disabled={writing || writeSuccess}
                    sx={{
                      bgcolor: writeSuccess ? '#2e7d32' : '#1565c0',
                      '&:hover': { bgcolor: writeSuccess ? '#1b5e20' : '#0d47a1' },
                      fontWeight: 700,
                    }}
                  >
                    {writing
                      ? '書き込み中...'
                      : writeSuccess
                      ? '✓ 書き込み完了'
                      : `重説シートに書き込む（${writableCount}項目）`}
                  </Button>
                )
              )}
              {!spreadsheetUrl && (
                <Chip
                  label="スプシURLなし（書き込み不可）"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>

          {writeError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {writeError}
            </Alert>
          )}

          {/* キャッシュ読み込み時の警告 */}
          {isFromCache && (
            <Alert severity="warning" sx={{ mb: 2 }} icon={false}>
              ⚠️ これは前回の保存済み解析結果です。<strong>書類を再アップロードして再解析してから書き込んでください。</strong>
            </Alert>
          )}

          <Divider sx={{ mb: 1 }} />

          {/* 書き込み可能な項目（セルマッピングあり） */}
          {results.some((r) => r.cell) && (
            <>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, color: '#1565c0', mb: 1, mt: 1 }}
              >
                📝 重説シートへの書き込み対象項目
              </Typography>
              <List disablePadding sx={{ mb: 2 }}>
                {results
                  .filter((r) => r.cell)
                  .map((result, i) => (
                    <React.Fragment key={result.key}>
                      {i > 0 && <Divider component="li" />}
                      <ListItem alignItems="flex-start" sx={{ py: 1 }}>
                        <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                          {result.found ? (
                            <CheckCircleIcon color="success" />
                          ) : (
                            <CancelIcon color="disabled" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="subtitle2" fontWeight="bold">
                                {result.label.split('\n')[0]}
                              </Typography>
                              <Chip
                                label={`セル: ${result.cell}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                              {result.type === 'boolean' && (
                                <Chip
                                  label="チェックボックス"
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem', height: 20 }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            result.found ? (
                              <Box
                                sx={{
                                  mt: 0.5,
                                  p: 1,
                                  backgroundColor: '#f0f7ff',
                                  borderRadius: 1,
                                  borderLeft: '3px solid #1976d2',
                                }}
                              >
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                  {result.type === 'boolean'
                                    ? (result.content === 'true' ? '✓ チェックあり（TRUE）' : '□ チェックなし（FALSE）')
                                    : result.content}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography
                                variant="body2"
                                color="text.disabled"
                                sx={{ mt: 0.5 }}
                              >
                                該当する内容が見つかりませんでした
                              </Typography>
                            )
                          }
                        />
                      </ListItem>
                    </React.Fragment>
                  ))}
              </List>
            </>
          )}
        </Paper>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default KenchikuGaiyoshoPage;
