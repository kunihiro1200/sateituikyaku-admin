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

/**
 * ファイルをBase64に変換
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
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

    try {
      setLoadingMessage('ファイルを読み込み中...');

      // ファイルをBase64に変換してそのまま送信（PDF変換不要）
      const filePayloads = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          mimeType: file.type,
          base64: await fileToBase64(file),
        }))
      );

      setLoadingMessage('Claude AIが管理規約を解析中... （しばらくお待ちください）');

      const response = await fetch(`${API_BASE_URL}/api/management-rules/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filePayloads }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'サーバーエラー' }));
        throw new Error(errData.error?.message || errData.error || `HTTP ${response.status}`);
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
        管理規約のPDFまたは画像をアップロードすると、各項目の該当条文を自動で抽出します。
        テキストPDF・スキャンPDF両方に対応しています。
      </Typography>

      {/* アップロードエリア */}
      <Paper
        variant="outlined"
        sx={{
          p: 3, mb: 2,
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
          対応形式: PDF（テキスト・スキャン両対応）、JPEG、PNG（複数ファイル可）
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
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
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
        {loading ? '解析中...' : '管理規約を解析する'}
      </Button>

      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
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
