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
 * pdfjs-distを動的インポートして使用
 */
async function pdfToImages(file: File, onProgress?: (page: number, total: number) => void): Promise<FilePayload[]> {
  // 動的インポート（バンドルサイズ削減）
  const pdfjsLib = await import('pdfjs-dist');

  // workerのパスを設定（Viteのpublicディレクトリから配信）
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const images: FilePayload[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages);

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // 高解像度で取得

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    // JPEG形式でBase64に変換（品質0.85）
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];

    images.push({
      name: `${file.name}_page${pageNum}.jpg`,
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
      const base64 = dataUrl.split(',')[1];
      resolve({ name: file.name, mimeType: file.type, base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ManagementRulesTestPage: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // ファイル追加
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

  // ドラッグ&ドロップ
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  // ファイル削除
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 解析実行
  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('ファイルを選択してください');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const allPayloads: FilePayload[] = [];

      for (const file of files) {
        if (file.type === 'application/pdf') {
          setLoadingMessage(`PDFを画像に変換中: ${file.name}`);
          const images = await pdfToImages(file, (page, total) => {
            setLoadingMessage(`PDFを画像に変換中: ${file.name} (${page}/${total}ページ)`);
          });
          allPayloads.push(...images);
        } else {
          setLoadingMessage(`画像を読み込み中: ${file.name}`);
          const payload = await imageToBase64(file);
          allPayloads.push(payload);
        }
      }

      setLoadingMessage('AIが管理規約を解析中...');

      const response = await fetch(`${API_BASE_URL}/api/management-rules/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: allPayloads }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'サーバーエラー' }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data: AnalyzeResponse = await response.json();
      setResults(data.results);
    } catch (err: any) {
      setError(err.message || '解析中にエラーが発生しました');
    } finally {
      setLoading(false);
      setLoadingMessage('');
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
        PDFは自動的にページごとの画像に変換されます。
      </Typography>

      {/* ファイルアップロードエリア */}
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
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
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

      {/* 選択済みファイル一覧 */}
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

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 解析ボタン */}
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

      {/* ローディング進捗 */}
      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
            {loadingMessage}
          </Typography>
        </Box>
      )}

      {/* 結果表示 */}
      {results && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              解析結果
            </Typography>
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
                    {result.found ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <CancelIcon color="disabled" />
                    )}
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
                          sx={{
                            mt: 0.5,
                            p: 1,
                            backgroundColor: '#f0f7ff',
                            borderRadius: 1,
                            borderLeft: '3px solid #1976d2',
                          }}
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
