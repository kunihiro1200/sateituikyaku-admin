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
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SearchIcon from '@mui/icons-material/Search';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';

// APIベースURL（api.tsと同じパターン）
const API_BASE_URL =
  import.meta.env.MODE === 'production'
    ? 'https://sateituikyaku-admin-backend.vercel.app'
    : import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 1回のリクエストに含める最大ページ数（TPMレート制限対策で小さめに）
const PAGES_PER_CHUNK = 2;

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
 * PDFを各ページの画像（JPEG）に変換する
 */
async function pdfToImages(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<FilePayload[]> {
  const pdfjsLib = await import('pdfjs-dist');

  // workerをCDNから読み込む（バージョン固定）
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const totalPages = pdf.numPages;
  const images: FilePayload[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages);

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    // 白背景を塗る（透明だとJPEGで黒くなる）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64 = dataUrl.split(',')[1];

    // base64が空でないか確認
    if (!base64 || base64.length < 100) {
      console.warn(`[PDF変換] ページ${pageNum}のbase64が空です`);
      continue;
    }

    console.log(`[PDF変換] p${pageNum}: ${Math.round(base64.length * 0.75 / 1024)}KB`);

    images.push({
      name: `${file.name}_p${pageNum}.jpg`,
      mimeType: 'image/jpeg',
      base64,
    });
  }

  return images;
}

/**
 * 画像ファイルをBase64に変換する
 */
function imageToBase64(file: File): Promise<FilePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ name: file.name, mimeType: file.type, base64: dataUrl.split(',')[1] });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * ページ配列をN枚ずつのチャンクに分割
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * 指定ミリ秒待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 1チャンク分をAPIに送信して結果を取得（レート制限時は自動リトライ）
 */
async function analyzeChunk(pages: FilePayload[], retries = 3): Promise<CheckResult[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(`${API_BASE_URL}/api/management-rules/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: pages }),
    });

    if (response.ok) {
      const data: AnalyzeResponse = await response.json();
      return data.results;
    }

    const errData = await response.json().catch(() => ({ error: 'サーバーエラー' }));

    // レート制限（429 or 500でrate_limit_exceeded）の場合はリトライ
    const isRateLimit =
      response.status === 429 ||
      (response.status === 500 && errData?.error?.code === 'rate_limit_exceeded');

    if (isRateLimit && attempt < retries) {
      // 10秒待ってリトライ
      await sleep(10000);
      continue;
    }

    throw new Error(errData?.error?.message || errData?.error || `HTTP ${response.status}`);
  }

  throw new Error('リトライ上限に達しました');
}

/**
 * 複数チャンクの結果をマージ
 * - nullだった項目は後のチャンクで見つかれば上書き
 * - 「参照」のみの内容（第○条参照）より実際の条文が見つかれば上書き
 */
function mergeResults(allResults: CheckResult[][]): CheckResult[] {
  if (allResults.length === 0) return [];

  const merged = allResults[0].map((r) => ({ ...r }));

  for (let i = 1; i < allResults.length; i++) {
    for (const result of allResults[i]) {
      const existing = merged.find((m) => m.key === result.key);
      if (!existing) continue;

      if (!existing.found && result.found) {
        // まだ見つかっていない → 上書き
        existing.content = result.content;
        existing.found = true;
      } else if (existing.found && result.found && result.content) {
        // 両方見つかっている場合、より詳しい内容（文字数が多い）を優先
        const currentLen = existing.content?.length ?? 0;
        const newLen = result.content.length;
        if (newLen > currentLen * 1.2) {
          // 20%以上長い場合は新しい方が詳しいと判断して上書き
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
      // Step1: 全ファイルを画像に変換
      const allPages: FilePayload[] = [];

      for (const file of files) {
        if (file.type === 'application/pdf') {
          setLoadingMessage(`PDFを変換中: ${file.name}`);
          const images = await pdfToImages(file, (page, total) => {
            setLoadingMessage(`PDFを変換中: ${file.name} (${page}/${total}ページ)`);
          });
          // 各ページのサイズをログ出力（デバッグ用）
          images.forEach((img, i) => {
            console.log(`[PDF変換] ${img.name}: base64長=${img.base64.length}, 推定サイズ=${Math.round(img.base64.length * 0.75 / 1024)}KB`);
          });
          allPages.push(...images);
        } else {
          setLoadingMessage(`画像を読み込み中: ${file.name}`);
          allPages.push(await imageToBase64(file));
        }
      }

      // Step2: ページをチャンクに分割してAPIに送信
      const chunks = chunkArray(allPages, PAGES_PER_CHUNK);
      const allChunkResults: CheckResult[][] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkNum = i + 1;
        setLoadingMessage(
          `AIが解析中... (${chunkNum}/${chunks.length}バッチ、${allPages.length}ページ中 ${Math.min(chunkNum * PAGES_PER_CHUNK, allPages.length)}ページ完了)`
        );
        setProgress(Math.round((i / chunks.length) * 100));

        const chunkResults = await analyzeChunk(chunks[i]);
        allChunkResults.push(chunkResults);

        // チャンク間に5秒待機（レート制限対策）
        if (i < chunks.length - 1) {
          setLoadingMessage(`次のバッチを準備中... (${chunkNum + 1}/${chunks.length})`);
          await sleep(5000);
        }
      }

      setProgress(100);
      setLoadingMessage('結果をまとめています...');

      // Step3: 結果をマージ
      const merged = mergeResults(allChunkResults);
      setResults(merged);
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
        管理規約の画像またはPDFをアップロードすると、各項目の該当条文を自動で抽出します。
        PDFは自動的にページごとの画像に変換し、複数バッチに分けて解析します。
      </Typography>

      {/* アップロードエリア */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          mb: 2,
          border: dragOver ? '2px dashed #1976d2' : '2px dashed #ccc',
          backgroundColor: dragOver ? '#e3f2fd' : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.2s',
          textAlign: 'center',
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
          対応形式: JPEG, PNG, GIF, WebP, PDF（複数ファイル可）
        </Typography>
      </Paper>

      {/* 選択済みファイル */}
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
        sx={{ mb: loading ? 1 : 3 }}
      >
        {loading ? '処理中...' : '管理規約を解析する'}
      </Button>

      {/* 進捗表示 */}
      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress variant={progress > 0 ? 'determinate' : 'indeterminate'} value={progress} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
            {loadingMessage}
          </Typography>
        </Box>
      )}

      {/* 結果 */}
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
                    {result.found
                      ? <CheckCircleIcon color="success" />
                      : <CancelIcon color="disabled" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2" fontWeight="bold">
                        {result.label}
                      </Typography>
                    }
                    secondary={
                      result.found ? (
                        <Typography
                          variant="body2"
                          color="text.primary"
                          sx={{ mt: 0.5, p: 1, backgroundColor: '#f0f7ff', borderRadius: 1, borderLeft: '3px solid #1976d2' }}
                        >
                          {result.content}
                        </Typography>
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
