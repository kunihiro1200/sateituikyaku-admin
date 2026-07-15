/**
 * 他社物件（FT/OT番号）専用パネル
 * - 保存済み画像の表示・印刷
 * - 物件の削除
 * PropertyListingDetailPage でこの物件番号が FT/OT の場合に表示する
 */
import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Print as PrintIcon,
  PictureAsPdf as PictureAsPdfIcon,
  ZoomIn as ZoomInIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  AddPhotoAlternate as AddPhotoAlternateIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface TashaImage {
  name: string;
  path: string;
  url: string;
  size?: number;
  createdAt?: string;
}

interface Props {
  propertyNumber: string;
  onDeleted: () => void;
}

export default function TashaPropertyPanel({ propertyNumber, onDeleted }: Props) {
  const [images, setImages] = useState<TashaImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const isFT = propertyNumber.startsWith('FT');
  const chipColor = isFT ? '#1565c0' : '#2e7d32';
  const prefectureLabel = isFT ? '福岡' : '大分';

  useEffect(() => {
    fetchImages();
  }, [propertyNumber]);

  const fetchImages = async () => {
    setLoadingImages(true);
    try {
      const res = await api.get(`/api/ai/tasha-property-image/${propertyNumber}`);
      setImages(res.data.images || []);
    } catch {
      setImages([]);
    } finally {
      setLoadingImages(false);
    }
  };

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        let mediaType = file.type;
        if (!mediaType || mediaType === 'application/octet-stream') {
          const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
          const extMap: Record<string, string> = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
            gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
          };
          mediaType = extMap[ext] ?? 'image/jpeg';
        }
        const base64 = await toBase64(file);
        await api.post(`/api/ai/tasha-property-image/${propertyNumber}`, {
          imageBase64: base64,
          mediaType,
          fileName: file.name,
        });
      }
      await fetchImages();
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || '画像アップロードに失敗しました');
    } finally {
      setUploading(false);
      if (addFileInputRef.current) addFileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/ai/tasha-property/${propertyNumber}`);
      setDeleteDialogOpen(false);
      onDeleted();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.error || '削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const imagesHtml = images
      .filter(img => !img.name.endsWith('.pdf'))
      .map(img => `
        <div style="page-break-inside:avoid; margin-bottom:16px;">
          <img src="${img.url}" style="max-width:100%; max-height:90vh; object-fit:contain;" />
        </div>
      `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${propertyNumber} 物件概要書</title>
          <style>
            body { margin: 0; padding: 16px; font-family: sans-serif; }
            h2 { font-size: 14px; margin-bottom: 8px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h2>${propertyNumber}（他社物件 / ${prefectureLabel}）</h2>
          ${imagesHtml || '<p>印刷可能な画像がありません</p>'}
          <script>window.onload = function(){ window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const isPdf = (name: string) => name.toLowerCase().endsWith('.pdf');

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        border: `2px solid ${chipColor}22`,
        bgcolor: `${chipColor}05`,
        borderRadius: 2,
      }}
    >
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`他社物件 / ${prefectureLabel}`}
            size="small"
            sx={{ bgcolor: chipColor, color: 'white', fontWeight: 'bold' }}
          />
          <Typography variant="body2" color="text.secondary">
            スプシ同期対象外 · DBのみ管理
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {images.filter(img => !isPdf(img.name)).length > 0 && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{ borderColor: chipColor, color: chipColor }}
            >
              印刷
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={uploading ? <CircularProgress size={14} /> : <AddPhotoAlternateIcon />}
            onClick={() => addFileInputRef.current?.click()}
            disabled={uploading}
            sx={{ borderColor: chipColor, color: chipColor }}
          >
            {uploading ? 'アップロード中...' : '画像を追加'}
          </Button>
          <input
            ref={addFileInputRef}
            type="file"
            accept="image/*,.pdf,application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={handleAddImage}
          />
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            この物件を削除
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* 画像一覧 */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        登録時の概要書画像
      </Typography>

      {uploadError && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setUploadError(null)}>{uploadError}</Alert>
      )}

      {loadingImages ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">画像を読み込み中...</Typography>
        </Box>
      ) : images.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
          保存された画像がありません
        </Typography>
      ) : (
        <Box ref={printRef}>
          <Grid container spacing={1.5}>
            {images.map((img) => (
              <Grid item key={img.path} xs={6} sm={4} md={3}>
                {isPdf(img.name) ? (
                  <Box
                    component="a"
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 120,
                      bgcolor: '#ffebee',
                      borderRadius: 1,
                      border: '1px solid #ef9a9a',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#ffcdd2' },
                      gap: 0.5,
                    }}
                  >
                    <PictureAsPdfIcon sx={{ color: '#c62828', fontSize: 40 }} />
                    <Typography variant="caption" sx={{ color: '#c62828', textAlign: 'center', px: 1, wordBreak: 'break-all' }}>
                      {img.name}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">クリックで開く</Typography>
                  </Box>
                ) : (
                  <Box sx={{ position: 'relative', '&:hover .zoom-btn': { opacity: 1 } }}>
                    <Box
                      component="img"
                      src={img.url}
                      alt={img.name}
                      sx={{
                        width: '100%',
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 1,
                        border: '1px solid #eee',
                        display: 'block',
                        cursor: 'pointer',
                      }}
                      onClick={() => setLightboxUrl(img.url)}
                    />
                    <Tooltip title="拡大">
                      <IconButton
                        className="zoom-btn"
                        size="small"
                        onClick={() => setLightboxUrl(img.url)}
                        sx={{
                          position: 'absolute', top: 4, right: 4,
                          bgcolor: 'rgba(0,0,0,0.5)', color: 'white',
                          opacity: 0, transition: 'opacity 0.2s',
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                        }}
                      >
                        <ZoomInIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <WarningIcon color="error" />
          他社物件を削除
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            <strong>{propertyNumber}</strong> をDBから削除します。
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ・物件リストから完全に削除されます<br />
            ・保存済みの画像もすべて削除されます<br />
            ・この操作は取り消せません
          </Typography>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>キャンセル</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
          >
            {deleting ? '削除中...' : '削除する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ライトボックス */}
      <Dialog
        open={!!lightboxUrl}
        onClose={() => setLightboxUrl(null)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <IconButton onClick={() => setLightboxUrl(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 1, textAlign: 'center', bgcolor: '#000' }}>
          {lightboxUrl && (
            <Box
              component="img"
              src={lightboxUrl}
              sx={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
