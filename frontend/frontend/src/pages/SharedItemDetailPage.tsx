import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';
import { uploadFileToStorage } from '../utils/sharedItemFormUtils';

interface SharedItem {
  id: string;
  [key: string]: any;
}

interface Staff {
  name: string;
  is_normal: boolean;
}

interface NewFile {
  file: File;
  name: string;
}

export default function SharedItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const color = SECTION_COLORS.sharedItems;
  const [item, setItem] = useState<SharedItem | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 追加ファイル
  const [newPdfs, setNewPdfs] = useState<NewFile[]>([]);
  const [newImages, setNewImages] = useState<NewFile[]>([]);

  useEffect(() => {
    fetchItem();
    fetchStaff();
  }, [id]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/shared-items');
      const items = response.data.data || [];
      const foundItem = items.find((i: SharedItem) => i.id === id);
      setItem(foundItem || null);
    } catch (error) {
      console.error('Failed to fetch shared item:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await api.get('/api/shared-items/staff');
      setStaff(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    }
  };

  const handleBack = () => navigate('/shared-items');

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const existingCount = [1, 2, 3, 4].filter((n) => item && item[`PDF${n}`]).length;
    const remaining = 4 - existingCount - newPdfs.length;
    setNewPdfs((prev) => [...prev, ...files.slice(0, remaining).map((f) => ({ file: f, name: f.name }))]);
    e.target.value = '';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const existingCount = [1, 2, 3, 4].filter((n) => item && item[`画像${n}`]).length;
    const remaining = 4 - existingCount - newImages.length;
    setNewImages((prev) => [...prev, ...files.slice(0, remaining).map((f) => ({ file: f, name: f.name }))]);
    e.target.value = '';
  };

  const uploadFile = async (newFile: NewFile, type: 'pdf' | 'image'): Promise<string> => {
    return await uploadFileToStorage(newFile.file, type);
  };

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    setApiError('');
    setSaveSuccess(false);

    try {
      // 既存PDF/画像URLを取得
      const pdfUrls = [1, 2, 3, 4].map((n) => item[`PDF${n}`] || '');
      const imageUrls = [1, 2, 3, 4].map((n) => item[`画像${n}`] || '');

      // 新規PDFをアップロードして空きスロットに追加
      for (const newPdf of newPdfs) {
        const url = await uploadFile(newPdf, 'pdf');
        const emptyIdx = pdfUrls.findIndex((u) => !u);
        if (emptyIdx !== -1) pdfUrls[emptyIdx] = url;
      }

      // 新規画像をアップロードして空きスロットに追加
      for (const newImg of newImages) {
        const url = await uploadFile(newImg, 'image');
        const emptyIdx = imageUrls.findIndex((u) => !u);
        if (emptyIdx !== -1) imageUrls[emptyIdx] = url;
      }

      const payload: Record<string, string> = {
        'PDF1': pdfUrls[0],
        'PDF2': pdfUrls[1],
        'PDF3': pdfUrls[2],
        'PDF4': pdfUrls[3],
        '画像1': imageUrls[0],
        '画像2': imageUrls[1],
        '画像3': imageUrls[2],
        '画像4': imageUrls[3],
      };

      await api.put(`/api/shared-items/${item.id}`, payload);

      pageDataCache.invalidate(CACHE_KEYS.SHARED_ITEMS);
      setItem((prev) => (prev ? { ...prev, ...payload } : prev));
      setNewPdfs([]);
      setNewImages([]);
      setSaveSuccess(true);
    } catch (error: any) {
      console.error('Save error:', error);
      setApiError(error.response?.data?.error || '保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography>読み込み中...</Typography>
      </Container>
    );
  }

  if (!item) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography>データが見つかりませんでした</Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>戻る</Button>
      </Container>
    );
  }

  const existingPdfUrls = [1, 2, 3, 4].map((n) => item[`PDF${n}`]).filter(Boolean);
  const existingImageUrls = [1, 2, 3, 4].map((n) => item[`画像${n}`]).filter(Boolean);
  const canAddPdf = existingPdfUrls.length + newPdfs.length < 4;
  const canAddImage = existingImageUrls.length + newImages.length < 4;
  const hasChanges = newPdfs.length > 0 || newImages.length > 0;

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ color: color.main }}>
            戻る
          </Button>
          <Typography variant="h5" fontWeight="bold" sx={{ color: color.main }}>
            共有詳細
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark } }}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {saving ? '保存中...' : '保存'}
        </Button>
      </Box>

      {apiError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApiError('')}>{apiError}</Alert>
      )}
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess(false)}>保存しました</Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* 日付・入力者 */}
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">日付</Typography>
            <TextField fullWidth value={item['日付'] || ''} disabled size="small"
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">入力者</Typography>
            <TextField fullWidth value={item['入力者'] || ''} disabled size="small"
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>

          {/* 共有場・項目 */}
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">共有場</Typography>
            <TextField fullWidth value={item['共有場'] || ''} disabled size="small"
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">項目</Typography>
            <TextField fullWidth value={item['項目'] || ''} disabled size="small"
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>

          {/* タイトル */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">タイトル</Typography>
            <TextField fullWidth value={item['タイトル'] || ''} disabled
              sx={{ mt: 1,
                '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: color.main, fontWeight: 'bold', fontSize: '1.1rem' },
                '& .MuiOutlinedInput-root': { bgcolor: `${color.light}15` },
              }} />
          </Grid>

          {/* 内容 */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">内容</Typography>
            <TextField fullWidth multiline rows={4} value={item['内容'] || ''} disabled
              sx={{ mt: 1,
                '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: color.dark, fontWeight: 500 },
                '& .MuiOutlinedInput-root': { bgcolor: `${color.light}15` },
              }} />
          </Grid>

          {/* 共有日・確認日 */}
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">共有日</Typography>
            <TextField fullWidth type="date" value={item['共有日'] || ''} disabled size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">確認日</Typography>
            <TextField fullWidth type="date" value={item['確認日'] || ''} disabled size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>

          {/* 共有できていないスタッフ */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">共有できていないスタッフ</Typography>
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {staff.map((s, index) => {
                const initial = s.name.charAt(0);
                const notSharedList = item['共有できていない']
                  ? item['共有できていない'].split(',').map((n: string) => n.trim())
                  : [];
                const isNotShared = notSharedList.includes(s.name);
                return (
                  <Button key={index} variant={isNotShared ? 'contained' : 'outlined'}
                    sx={{
                      minWidth: '48px', height: '48px', borderRadius: '50%',
                      fontSize: '1.2rem', fontWeight: 'bold',
                      bgcolor: isNotShared ? color.main : 'transparent',
                      color: isNotShared ? '#fff' : color.main,
                      borderColor: color.main,
                      '&:hover': { bgcolor: isNotShared ? color.dark : `${color.light}30` },
                    }}
                    title={s.name}
                  >{initial}</Button>
                );
              })}
            </Box>
          </Grid>

          {/* PDF */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">PDF</Typography>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {existingPdfUrls.map((url, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
                  <Typography sx={{ mr: 0.5 }}>📄</Typography>
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    style={{ color: color.main, wordBreak: 'break-all', fontSize: '0.85rem' }}>
                    {decodeURIComponent(url.split('/').pop() || `PDF${i + 1}`)}
                  </a>
                </Box>
              ))}
              {newPdfs.map((f, i) => (
                <Chip key={i} label={f.name} size="small"
                  onDelete={() => setNewPdfs((prev) => prev.filter((_, idx) => idx !== i))}
                  deleteIcon={<CloseIcon />}
                  sx={{ bgcolor: `${color.main}15`, alignSelf: 'flex-start' }}
                />
              ))}
              {canAddPdf && (
                <Button component="label" variant="outlined" startIcon={<AttachFileIcon />} size="small"
                  sx={{ alignSelf: 'flex-start', borderColor: color.main, color: color.main }}>
                  PDFを追加
                  <input type="file" accept="application/pdf" multiple hidden onChange={handlePdfChange} />
                </Button>
              )}
            </Box>
          </Grid>

          {/* 画像 */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">画像</Typography>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {existingImageUrls.map((url, i) => (
                <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <img src={url} alt={`画像${i + 1}`}
                    style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 4, border: '1px solid #e0e0e0' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    style={{ color: color.main, fontSize: '0.75rem', wordBreak: 'break-all' }}>
                    {decodeURIComponent(url.split('/').pop() || `画像${i + 1}`)}
                  </a>
                </Box>
              ))}
              {newImages.map((f, i) => (
                <Chip key={i} label={f.name} size="small"
                  onDelete={() => setNewImages((prev) => prev.filter((_, idx) => idx !== i))}
                  deleteIcon={<CloseIcon />}
                  sx={{ bgcolor: `${color.main}15`, alignSelf: 'flex-start' }}
                />
              ))}
              {canAddImage && (
                <Button component="label" variant="outlined" startIcon={<AttachFileIcon />} size="small"
                  sx={{ alignSelf: 'flex-start', borderColor: color.main, color: color.main }}>
                  画像を追加
                  <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden onChange={handleImageChange} />
                </Button>
              )}
            </Box>
          </Grid>

          {/* URL */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">URL</Typography>
            {item['URL'] && item['URL'] !== 'http://' ? (
              <Box sx={{ mt: 1, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
                <a href={item['URL']} target="_blank" rel="noopener noreferrer"
                  style={{ color: color.main, wordBreak: 'break-all' }}>
                  {item['URL']}
                </a>
              </Box>
            ) : (
              <TextField fullWidth value={item['URL'] || ''} disabled size="small"
                sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#aaa' } }} />
            )}
          </Grid>

          {/* 打ち合わせ内容 */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">打ち合わせ内容</Typography>
            <TextField fullWidth multiline rows={3} value={item['打ち合わせ内容'] || ''} disabled
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}
