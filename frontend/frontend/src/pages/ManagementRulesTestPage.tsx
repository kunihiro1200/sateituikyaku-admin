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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SearchIcon from '@mui/icons-material/Search';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';

const API_BASE_URL =
  import.meta.env.MODE === 'production'
    ? 'https://sateituikyaku-admin-backend.vercel.app'
    : import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 1リクエストの最大サイズ（Vercel制限4.5MB → Base64は約3MB相当のバイナリ）
const MAX_BYTES_PER_REQUEST = 3 * 1024 * 1024; // 3MB

interface CheckResult {
  key: string;
  label: string;
  content: string | null;
  found: boolean;
}

interface AnalyzeResponse {
  success: boolean;
  fileCount: number;
  results: CheckResult[];
}

interface FilePayload {
  name: string;
  mimeType: string;
  base64: string;
}

/**
 * PDFを指定バイト以下のチャンクに分割する
 * pdfjs-distでページごとに分割してBase64化
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
    const pageSize = page.base64.length * 0.75; // Base64→バイト換算
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

/**
 * Markdownテーブルをパースして行列データに変換
 */
function parseMarkdownTable(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line.split('|').map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);

  const headers = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow); // 2行目はセパレータなのでスキップ

  if (headers.length === 0) return null;
  return { headers, rows };
}

/**
 * テキストにMarkdownテーブルが含まれる場合、テキスト部分と表部分に分割して表示
 */
const ContentRenderer: React.FC<{ content: string }> = ({ content }) => {
  const parts = content.split(/((?:\|[^\n]+\|\n?)+)/g);

  return (
    <>
      {parts.map((part, i) => {
        const table = parseMarkdownTable(part);
        if (table && table.headers.length > 0) {
          return (
            <TableContainer key={i} component={Paper} variant="outlined" sx={{ mt: 1, mb: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                    {table.headers.map((h, j) => (
                      <TableCell key={j} sx={{ fontWeight: 'bold', fontSize: '0.8rem', py: 0.5 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {table.rows.map((row, j) => (
                    <TableRow key={j} sx={{ '&:last-child td': { border: 0 } }}>
                      {row.map((cell, k) => (
                        <TableCell key={k} sx={{ fontSize: '0.8rem', py: 0.5 }}>
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          );
        }
        return part.trim() ? (
          <Typography key={i} variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
            {part.trim()}
          </Typography>
        ) : null;
      })}
    </>
  );
};

/**
 * テキストの行数を数える
 */
function countLines(text: string): number {
  return text.split('\n').length;
}

/**
 * 条文を要約する
 */
async function summarizeContent(label: string, content: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/management-rules/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, content }),
  });
  if (!response.ok) throw new Error('要約に失敗しました');
  const data = await response.json();
  return data.summary;
}

/**
 * 要約ボタン付きコンテンツ表示
 */
const ContentWithSummary: React.FC<{ label: string; content: string }> = ({ label, content }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const showSummaryButton = countLines(content) >= 5 || content.length > 200;

  const handleSummarize = async () => {
    setSummarizing(true);
    setSummaryError(null);
    try {
      const result = await summarizeContent(label, content);
      setSummary(result);
    } catch (e: any) {
      setSummaryError(e.message);
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <Box>
      <ContentRenderer content={content} />
      {showSummaryButton && (
        <Box sx={{ mt: 1 }}>
          {!summary && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleSummarize}
              disabled={summarizing}
              startIcon={summarizing ? <CircularProgress size={14} /> : undefined}
              sx={{ fontSize: '0.75rem', py: 0.3 }}
            >
              {summarizing ? '要約中...' : '📝 要約を見る'}
            </Button>
          )}
          {summaryError && (
            <Typography variant="caption" color="error">{summaryError}</Typography>
          )}
          {summary && (
            <Box sx={{ mt: 1, p: 1, backgroundColor: '#fff8e1', borderRadius: 1, borderLeft: '3px solid #f9a825' }}>
              <Typography variant="caption" color="text.secondary" fontWeight="bold">
                📝 要約
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.3 }}>
                {summary}
              </Typography>
              <Button size="small" sx={{ fontSize: '0.7rem', mt: 0.5, p: 0 }} onClick={() => setSummary(null)}>
                閉じる
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

/**
 * 画像ファイルをBase64に変換
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * チャンクをAPIに送信
 */
async function analyzeChunk(files: FilePayload[]): Promise<CheckResult[]> {
  const response = await fetch(`${API_BASE_URL}/api/management-rules/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'サーバーエラー' }));
    throw new Error(errData.error?.message || errData.error || `HTTP ${response.status}`);
  }

  const data: AnalyzeResponse = await response.json();
  return data.results;
}

/**
 * 複数チャンクの結果をマージ（より詳しい内容を優先）
 */
function mergeResults(allResults: CheckResult[][]): CheckResult[] {
  if (allResults.length === 0) return [];
  const merged = allResults[0].map((r) => ({ ...r }));

  for (let i = 1; i < allResults.length; i++) {
    for (const result of allResults[i]) {
      const existing = merged.find((m) => m.key === result.key);
      if (!existing) continue;
      if (!existing.found && result.found) {
        existing.content = result.content;
        existing.found = true;
      } else if (existing.found && result.found && result.content) {
        // より長い（詳しい）内容を優先
        if ((result.content?.length ?? 0) > (existing.content?.length ?? 0) * 1.2) {
          existing.content = result.content;
        }
      }
    }
  }
  return merged;
}

const ManagementRulesTestPage: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

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
      const allChunkResults: CheckResult[][] = [];

      for (const file of files) {
        if (file.type === 'application/pdf') {
          // PDFはページ分割して送信
          setLoadingMessage(`PDFを変換中: ${file.name}`);
          const chunks = await splitPdfIntoChunks(file, MAX_BYTES_PER_REQUEST, (page, total) => {
            setLoadingMessage(`PDFを変換中: ${file.name} (${page}/${total}ページ)`);
          });

          for (let i = 0; i < chunks.length; i++) {
            setLoadingMessage(
              `Claude AIが解析中... (${i + 1}/${chunks.length}バッチ)`
            );
            setProgress(Math.round(((i + 1) / chunks.length) * 100));
            const chunkResults = await analyzeChunk(chunks[i]);
            allChunkResults.push(chunkResults);
          }
        } else {
          // 画像はそのまま送信
          setLoadingMessage(`Claude AIが解析中: ${file.name}`);
          const base64 = await fileToBase64(file);
          const chunkResults = await analyzeChunk([{
            name: file.name,
            mimeType: file.type,
            base64,
          }]);
          allChunkResults.push(chunkResults);
        }
      }

      setProgress(100);
      setResults(mergeResults(allChunkResults));
    } catch (err: any) {
      setError(err.message || '解析中にエラーが発生しました');
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setProgress(0);
    }
  };

  const foundCount = results?.filter((r) => r.found).length ?? 0;
  const totalCount = results?.length ?? 0;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        管理規約 解析テスト
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        管理規約のPDFまたは画像をアップロードすると、各項目の該当条文を自動で抽出します。
        テキストPDF・スキャンPDF両方に対応しています。
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          p: 3, mb: 2,
          border: dragOver ? '2px dashed #1976d2' : '2px dashed #ccc',
          backgroundColor: dragOver ? '#e3f2fd' : '#fafafa',
          cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('mgmt-file-input')?.click()}
      >
        <input
          id="mgmt-file-input"
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
          対応形式: PDF（テキスト・スキャン両対応）、JPEG、PNG
        </Typography>
      </Paper>

      {files.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {files.map((file, i) => (
            <Chip
              key={i}
              icon={file.type === 'application/pdf' ? <PictureAsPdfIcon /> : <ImageIcon />}
              label={`${file.name} (${(file.size / 1024).toFixed(0)}KB)`}
              onDelete={() => removeFile(i)}
              color={file.type === 'application/pdf' ? 'error' : 'primary'}
              variant="outlined"
              size="small"
            />
          ))}
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Button
        variant="contained"
        size="large"
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
        onClick={handleAnalyze}
        disabled={loading || files.length === 0}
        fullWidth
        sx={{ mb: loading ? 1 : 3 }}
      >
        {loading ? '解析中...' : '管理規約を解析する'}
      </Button>

      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress variant={progress > 0 ? 'determinate' : 'indeterminate'} value={progress} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
            {loadingMessage}
          </Typography>
        </Box>
      )}

      {results && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">解析結果</Typography>
            <Chip
              label={`${foundCount} / ${totalCount} 項目が見つかりました`}
              color={foundCount > 0 ? 'success' : 'default'}
            />
          </Box>
          <Divider sx={{ mb: 1 }} />
          <List disablePadding>
            {results.map((result, i) => (
              <React.Fragment key={result.key}>
                {i > 0 && <Divider component="li" />}
                <ListItem alignItems="flex-start" sx={{ py: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                    {result.found ? <CheckCircleIcon color="success" /> : <CancelIcon color="disabled" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="subtitle2" fontWeight="bold">{result.label}</Typography>}
                    secondary={
                      result.found ? (
                        <Box
                          sx={{ mt: 0.5, p: 1, backgroundColor: '#f0f7ff', borderRadius: 1, borderLeft: '3px solid #1976d2' }}
                        >
                          <ContentWithSummary label={result.label} content={result.content!} />
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                          該当する条文が見つかりませんでした
                        </Typography>
                      )
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default ManagementRulesTestPage;
