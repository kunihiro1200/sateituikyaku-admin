import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  Alert,
  LinearProgress,
  Tooltip,
  Chip,
  Divider,
} from '@mui/material';
import {
  PictureAsPdf,
  Image as ImageIcon,
  InsertDriveFile,
  Delete,
  Download,
  OpenInNew,
  CloudUpload,
  Folder,
  Close as CloseIcon,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  webViewLink: string;
  webContentLink: string;
}

// アップロード予定ファイルの状態管理
interface PendingFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
}

interface DocumentModalProps {
  open: boolean;
  onClose: () => void;
  sellerNumber: string;
  onFolderUrlReady?: (url: string) => void;
  onSalesCasesExtracted?: (cases: Array<{ floor: number | null; exclusiveArea: number | null; price: number | null; yearMonth: string | null }>) => void;
}

const DocumentModal = ({ open, onClose, sellerNumber, onFolderUrlReady, onSalesCasesExtracted }: DocumentModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folderUrl, setFolderUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 全体の進捗（0-100）
  const [uploadedCount, setUploadedCount] = useState(0);
  const [extractingFileId, setExtractingFileId] = useState<string | null>(null); // 読み取り中のファイルID
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 選択されたがまだアップロードしていないファイル一覧
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadResult, setUploadResult] = useState<{ uploaded: number; failed: { fileName: string; reason: string }[] } | null>(null);

  // ドラッグ&ドロップ用
  const [dragActive, setDragActive] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const loadFolder = useCallback(async () => {
    if (!sellerNumber) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/api/drive/folders/${sellerNumber}`);
      setFiles(response.data.files || []);
      const url = response.data.folderUrl || '';
      setFolderUrl(url);
      if (url && onFolderUrlReady) {
        onFolderUrlReady(url);
      }
    } catch (err: any) {
      console.error('Error loading folder:', err);
      if (err.response?.data?.code === 'GOOGLE_AUTH_REQUIRED') {
        setError('Google認証が必要です。管理者に連絡してください。');
      } else {
        setError(err.response?.data?.error || 'フォルダの読み込みに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, [sellerNumber]);

  useEffect(() => {
    if (open && sellerNumber) {
      loadFolder();
    }
    // モーダルを開くたびにpendingFilesをリセット
    if (open) {
      setPendingFiles([]);
      setUploadResult(null);
    }
  }, [open, sellerNumber, loadFolder]);

  // pending から1件削除
  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // ファイルを受け取ったら即アップロード（ファイル選択・ドロップ共通）
  const uploadFilesDirectly = async (newFiles: File[]) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const valid = newFiles.filter((f) => allowed.includes(f.type));
    if (valid.length === 0) {
      setError('PDF・JPEG・PNG・GIF・WebP以外のファイルは無視されました');
      return;
    }
    if (valid.length < newFiles.length) {
      setError('PDF・JPEG・PNG・GIF・WebP以外のファイルは無視されました');
    }

    // pendingFilesに追加してアップロード開始
    const toUpload: PendingFile[] = valid.map((f) => ({
      id: `${Date.now()}-${f.name}`,
      file: f,
      status: 'uploading' as const,
    }));

    setPendingFiles((prev) => [...prev, ...toUpload]);
    setUploading(true);
    setUploadProgress(0);
    setUploadedCount(0);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      const fileNames: string[] = [];

      toUpload.forEach((pf) => {
        formData.append('files', pf.file, pf.file.name);
        fileNames.push(pf.file.name);
      });
      formData.append('fileNames', JSON.stringify(fileNames));

      const response = await api.post(
        `/api/drive/folders/${sellerNumber}/files/batch`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadProgress(progress);
            setUploadedCount(Math.round((progress / 100) * toUpload.length));
          },
        }
      );

      const { uploaded, errors } = response.data;

      const errorMap = new Map<string, string>(
        (errors || []).map((e: { fileName: string; reason: string }) => [e.fileName, e.reason])
      );

      const uploadedIds = new Set(toUpload.map((f) => f.id));
      setPendingFiles((prev) =>
        prev.map((f) => {
          if (!uploadedIds.has(f.id)) return f;
          const errReason = errorMap.get(f.file.name);
          return {
            ...f,
            status: errReason ? ('error' as const) : ('done' as const),
            errorMessage: errReason,
          };
        })
      );

      setUploadResult({ uploaded, failed: errors || [] });

      await loadFolder();

      // 完了したファイルを1秒後に除去
      setTimeout(() => {
        setPendingFiles((prev) => prev.filter((f) => f.status !== 'done'));
      }, 1000);
    } catch (err: any) {
      console.error('Error batch uploading:', err);
      setError(err.response?.data?.error || 'アップロードに失敗しました');
      const uploadedIds = new Set(toUpload.map((f) => f.id));
      setPendingFiles((prev) =>
        prev.map((f) =>
          uploadedIds.has(f.id) && f.status === 'uploading'
            ? { ...f, status: 'error' as const, errorMessage: 'アップロードに失敗しました' }
            : f
        )
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadedCount(0);
    }
  };

  // input[type=file] の change ハンドラー（複数対応）
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (selected && selected.length > 0) {
      uploadFilesDirectly(Array.from(selected));
    }
    // 同じファイルを再選択できるようにリセット
    event.target.value = '';
  };

  // ドラッグ&ドロップ
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFilesDirectly(Array.from(e.dataTransfer.files));
    }
  };

  const handleDelete = async (fileId: string) => {
    setDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/drive/files/${fileId}`);
      setDeleteConfirm(null);
      await loadFolder();
    } catch (err: any) {
      console.error('Error deleting file:', err);
      setError(err.response?.data?.error || 'ファイルの削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') return <PictureAsPdf color="error" />;
    if (mimeType.startsWith('image/')) return <ImageIcon color="primary" />;
    return <InsertDriveFile />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = pendingFiles.filter((f) => f.status === 'pending').length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Folder color="primary" />
            <Typography variant="h6">ドキュメント管理 - {sellerNumber}</Typography>
          </Box>
          {folderUrl && (
            <Tooltip title="Google Driveで開く">
              <IconButton
                href={folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                color="primary"
              >
                <OpenInNew />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* アップロード結果通知 */}
        {uploadResult && (
          <Alert
            severity={uploadResult.failed.length > 0 ? 'warning' : 'success'}
            sx={{ mb: 2 }}
            onClose={() => setUploadResult(null)}
          >
            {uploadResult.uploaded}件アップロード完了
            {uploadResult.failed.length > 0 && (
              <>
                {' '}/ {uploadResult.failed.length}件失敗：
                {uploadResult.failed.map((f) => f.fileName).join(', ')}
              </>
            )}
          </Alert>
        )}

        {/* ファイル選択エリア（ドラッグ&ドロップ + クリック） */}
        <Box
          ref={dropRef}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          sx={{
            border: 2,
            borderStyle: 'dashed',
            borderColor: dragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 2,
            textAlign: 'center',
            bgcolor: dragActive ? 'action.hover' : 'grey.50',
            mb: 2,
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          }}
          onClick={() => document.getElementById('doc-modal-file-input')?.click()}
        >
          <CloudUpload sx={{ fontSize: 36, color: 'grey.400', mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            クリックまたはドラッグ&ドロップでファイルを選択
          </Typography>
          <Typography variant="caption" color="text.secondary">
            PDF・画像（複数可）
          </Typography>
          <input
            id="doc-modal-file-input"
            type="file"
            hidden
            multiple
            accept=".pdf,image/*"
            onChange={handleFileInputChange}
          />
        </Box>

        {/* アップロード待ち/中/完了ファイル一覧 */}
        {pendingFiles.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {uploading
                  ? `アップロード中...（${pendingFiles.filter((f) => f.status === 'uploading').length}件）`
                  : `処理済みファイル`}
              </Typography>
            </Box>

            {/* アップロード進捗バー */}
            {uploading && (
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    アップロード中...
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {uploadProgress}%
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}

            <List dense>
              {pendingFiles.map((pf) => (
                <ListItem
                  key={pf.id}
                  sx={{
                    border: '1px solid',
                    borderColor:
                      pf.status === 'error'
                        ? 'error.main'
                        : pf.status === 'done'
                        ? 'success.main'
                        : 'divider',
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor:
                      pf.status === 'done'
                        ? 'success.50'
                        : pf.status === 'error'
                        ? 'error.50'
                        : 'transparent',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {pf.status === 'done' ? (
                      <CheckCircle color="success" fontSize="small" />
                    ) : pf.status === 'error' ? (
                      <ErrorIcon color="error" fontSize="small" />
                    ) : pf.status === 'uploading' ? (
                      <CircularProgress size={18} />
                    ) : (
                      getFileIcon(pf.file.type)
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" noWrap title={pf.file.name}>
                        {pf.file.name}
                      </Typography>
                    }
                    secondary={
                      pf.status === 'error' ? (
                        <Typography variant="caption" color="error">
                          {pf.errorMessage}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(pf.file.size)}
                          {pf.status === 'done' && ' • 完了'}
                          {pf.status === 'uploading' && ' • アップロード中...'}
                        </Typography>
                      )
                    }
                  />
                  {pf.status === 'pending' && (
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => removePendingFile(pf.id)}
                        disabled={uploading}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {pendingFiles.length > 0 && files.length > 0 && <Divider sx={{ mb: 2 }} />}

        {/* アップロード済みファイル一覧 */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : files.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography color="text.secondary" variant="body2">
              アップロード済みファイルはありません
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                アップロード済み
              </Typography>
              <Chip label={`${files.length}件`} size="small" variant="outlined" />
            </Box>

            {/* 売買事例一括読み取りボタン */}
            {onSalesCasesExtracted && files.some((f) => f.mimeType.startsWith('image/')) && (
              <Box sx={{ mb: 1.5 }}>
                <Button
                  variant="contained"
                  color="secondary"
                  size="small"
                  disabled={extractingFileId !== null}
                  startIcon={extractingFileId !== null ? <CircularProgress size={16} color="inherit" /> : <span>🤖</span>}
                  onClick={async () => {
                    const imageFiles = files.filter((f) => f.mimeType.startsWith('image/'));
                    if (imageFiles.length === 0) return;
                    setError(null);
                    const allCases: any[] = [];
                    for (const imgFile of imageFiles) {
                      try {
                        setExtractingFileId(imgFile.id);
                        const res = await api.post(`/api/drive/files/${imgFile.id}/extract-sales-cases`);
                        if (res.data.cases && res.data.cases.length > 0) {
                          allCases.push(...res.data.cases);
                        }
                      } catch {
                        // 1枚失敗しても続行
                      }
                    }
                    setExtractingFileId(null);
                    if (allCases.length > 0) {
                      onSalesCasesExtracted(allCases);
                      onClose();
                    } else {
                      setError('売買事例が見つかりませんでした。');
                    }
                  }}
                >
                  {extractingFileId !== null
                    ? `読み取り中...（画像${files.filter((f) => f.mimeType.startsWith('image/')).length}枚）`
                    : `🤖 売買事例を一括読み取り（スクショのみ・${files.filter((f) => f.mimeType.startsWith('image/')).length}枚）`}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  ※ 複数枚あれば全て読み取って合算します
                </Typography>
              </Box>
            )}
            <List dense>
              {files.map((file) => (
                <ListItem
                  key={file.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 0.5,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {getFileIcon(file.mimeType)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        component="a"
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="body2"
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {file.name}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(file.size)} • {formatDate(file.modifiedTime)}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    {/* 売買事例を読み取るボタン（画像ファイルのみ、onSalesCasesExtractedが渡された場合のみ表示） */}
                    {onSalesCasesExtracted && file.mimeType.startsWith('image/') && (
                      <Tooltip title="売買事例をAIで読み取る">
                        <IconButton
                          size="small"
                          color="secondary"
                          disabled={extractingFileId === file.id}
                          onClick={async () => {
                            try {
                              setExtractingFileId(file.id);
                              setError(null);
                              const res = await api.post(`/api/drive/files/${file.id}/extract-sales-cases`);
                              if (res.data.cases && res.data.cases.length > 0) {
                                onSalesCasesExtracted(res.data.cases);
                                onClose();
                              } else {
                                setError('売買事例が見つかりませんでした。');
                              }
                            } catch (err: any) {
                              setError(err.response?.data?.error || '読み取りに失敗しました');
                            } finally {
                              setExtractingFileId(null);
                            }
                          }}
                        >
                          {extractingFileId === file.id ? <CircularProgress size={18} /> : <span style={{ fontSize: 16 }}>🤖</span>}
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="ダウンロード">
                      <IconButton
                        href={file.webContentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                      >
                        <Download />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="削除">
                      <IconButton
                        onClick={() => setDeleteConfirm(file.id)}
                        size="small"
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </>
        )}

        {/* 削除確認ダイアログ */}
        <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
          <DialogTitle>ファイルを削除しますか？</DialogTitle>
          <DialogContent>
            <Typography>この操作は取り消せません。</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirm(null)} disabled={deleting}>
              キャンセル
            </Button>
            <Button
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              color="error"
              disabled={deleting}
            >
              {deleting ? <CircularProgress size={20} /> : '削除'}
            </Button>
          </DialogActions>
        </Dialog>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocumentModal;
