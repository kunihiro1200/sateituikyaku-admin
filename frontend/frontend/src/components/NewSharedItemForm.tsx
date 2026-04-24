import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
} from '@mui/material';
import { Close as CloseIcon, AttachFile as AttachFileIcon } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { SECTION_COLORS } from '../theme/sectionColors';
import {
  calculateNextId,
  toggleStaff,
  validateUrl,
  getTodayString,
  SHARING_LOCATIONS,
  CATEGORIES,
  uploadFileToStorage,
} from '../utils/sharedItemFormUtils';

interface NewSharedItemFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

interface UploadedFile {
  file: File;
  name: string;
  uploadedUrl?: string;
}

interface Staff {
  name: string;
  initials: string;
  is_active: boolean;
}

export default function NewSharedItemForm({ onSaved, onCancel }: NewSharedItemFormProps) {
  const color = SECTION_COLORS.sharedItems;
  const employee = useAuthStore((state) => state.employee);

  // 自動入力フィールド（読み取り専用）
  const [nextId, setNextId] = useState<string>('');
  const [today] = useState<string>(getTodayString());
  const [inputBy] = useState<string>(employee?.name || '');

  // スタッフ一覧
  const [staffList, setStaffList] = useState<Staff[]>([]);

  // フォームフィールド
  const [sharingLocation, setSharingLocation] = useState('');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sharingDate, setSharingDate] = useState('');
  const [staffNotShared, setStaffNotShared] = useState<string[]>([]);
  const [confirmationDate, setConfirmationDate] = useState('');
  const [pdfs, setPdfs] = useState<UploadedFile[]>([]);
  const [images, setImages] = useState<UploadedFile[]>([]);
  const [url, setUrl] = useState('');
  const [meetingContent, setMeetingContent] = useState('');

  // UI状態
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string>('');

  useEffect(() => {
    fetchNextId();
    fetchStaff();
  }, []);

  const fetchNextId = async () => {
    try {
      const response = await api.get('/api/shared-items');
      const items = response.data.data || [];
      const id = calculateNextId(items);
      setNextId(String(id));
    } catch (error) {
      console.error('ID取得エラー:', error);
      setNextId('1');
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await api.get('/api/shared-items/staff');
      setStaffList(response.data.data || []);
    } catch (error) {
      console.error('スタッフ取得エラー:', error);
    }
  };

  const handleStaffToggle = (name: string) => {
    setStaffNotShared((prev) => toggleStaff(prev, name));
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = files.map((f) => ({ file: f, name: f.name }));
    setPdfs((prev) => [...prev, ...newFiles].slice(0, 4));
    e.target.value = '';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = files.map((f) => ({ file: f, name: f.name }));
    setImages((prev) => [...prev, ...newFiles].slice(0, 4));
    e.target.value = '';
  };

  const removePdf = (index: number) => {
    setPdfs((prev) => prev.filter((_, i) => i !== index));
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!nextId) newErrors.nextId = 'IDの取得中です。しばらくお待ちください。';
    if (!sharingLocation) newErrors.sharingLocation = '共有場を選択してください';
    if (!category) newErrors.category = '項目を選択してください';
    if (!title.trim()) newErrors.title = 'タイトルを入力してください';
    if (url && !validateUrl(url).isValid) newErrors.url = '正しいURL形式で入力してください';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadFile = async (uploadedFile: UploadedFile, type: 'pdf' | 'image'): Promise<string> => {
    return await uploadFileToStorage(uploadedFile.file, type);
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setApiError('');

    try {
      // ファイルアップロード
      const pdfUrls: string[] = [];
      for (const pdf of pdfs) {
        const uploadedUrl = await uploadFile(pdf, 'pdf');
        pdfUrls.push(uploadedUrl);
      }

      const imageUrls: string[] = [];
      for (const img of images) {
        const uploadedUrl = await uploadFile(img, 'image');
        imageUrls.push(uploadedUrl);
      }

      // スプレッドシートに保存
      const payload: Record<string, string> = {
        'ID': nextId,
        '日付': today,
        '入力者': inputBy,
        '共有場': sharingLocation,
        '項目': category,
        'タイトル': title,
        '内容': content,
        '共有日': sharingDate,
        '共有できていない': staffNotShared.join(','),
        '確認日': confirmationDate,
        'PDF1': pdfUrls[0] || '',
        'PDF2': pdfUrls[1] || '',
        'PDF3': pdfUrls[2] || '',
        'PDF4': pdfUrls[3] || '',
        '画像１': imageUrls[0] || '',
        '画像２': imageUrls[1] || '',
        '画像３': imageUrls[2] || '',
        '画像４': imageUrls[3] || '',
        'URL': url,
        '打ち合わせ内容': meetingContent,
      };

      await api.post('/api/shared-items', payload);
      onSaved();
    } catch (error: any) {
      console.error('保存エラー:', error);
      setApiError(error.response?.data?.error || '保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {apiError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApiError('')}>
          {apiError}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* 自動入力フィールド（読み取り専用） */}
        <Grid item xs={4}>
          <Typography variant="caption" color="text.secondary">ID</Typography>
          <TextField
            fullWidth
            value={nextId}
            inputProps={{ readOnly: true }}
            size="small"
            sx={{ mt: 0.5 }}
          />
        </Grid>
        <Grid item xs={4}>
          <Typography variant="caption" color="text.secondary">日付</Typography>
          <TextField
            fullWidth
            value={today}
            inputProps={{ readOnly: true }}
            size="small"
            sx={{ mt: 0.5 }}
          />
        </Grid>
        <Grid item xs={4}>
          <Typography variant="caption" color="text.secondary">入力者</Typography>
          <TextField
            fullWidth
            value={inputBy}
            inputProps={{ readOnly: true }}
            size="small"
            sx={{ mt: 0.5 }}
          />
        </Grid>

        {/* 共有場（必須） */}
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">共有場 *</Typography>
          <TextField
            select
            fullWidth
            value={sharingLocation}
            onChange={(e) => setSharingLocation(e.target.value)}
            size="small"
            error={!!errors.sharingLocation}
            helperText={errors.sharingLocation}
            sx={{ mt: 0.5 }}
          >
            {SHARING_LOCATIONS.map((loc) => (
              <MenuItem key={loc} value={loc}>{loc}</MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* 項目（必須） */}
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">項目 *</Typography>
          <TextField
            select
            fullWidth
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            size="small"
            error={!!errors.category}
            helperText={errors.category}
            sx={{ mt: 0.5 }}
          >
            {CATEGORIES.map((cat) => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* タイトル（必須） */}
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">タイトル *</Typography>
          <TextField
            fullWidth
            multiline
            rows={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="small"
            error={!!errors.title}
            helperText={errors.title}
            sx={{ mt: 0.5 }}
          />
        </Grid>

        {/* 内容 */}
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">内容</Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            size="small"
            sx={{ mt: 0.5 }}
          />
        </Grid>

        {/* 確認日 */}
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">確認日</Typography>
          <TextField
            fullWidth
            type="date"
            value={confirmationDate}
            onChange={(e) => setConfirmationDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 0.5 }}
          />
        </Grid>

        {/* PDF添付 */}
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">PDF（最大4件）</Typography>
          <Box sx={{ mt: 0.5 }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<AttachFileIcon />}
              size="small"
              disabled={pdfs.length >= 4}
              sx={{ borderColor: color.main, color: color.main }}
            >
              PDFを選択
              <input
                type="file"
                accept="application/pdf"
                multiple
                hidden
                onChange={handlePdfChange}
              />
            </Button>
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {pdfs.map((pdf, i) => (
                <Chip
                  key={i}
                  label={pdf.name}
                  onDelete={() => removePdf(i)}
                  deleteIcon={<CloseIcon />}
                  size="small"
                  sx={{ bgcolor: `${color.main}15` }}
                />
              ))}
            </Box>
          </Box>
        </Grid>

        {/* 画像添付 */}
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">画像（最大4件）</Typography>
          <Box sx={{ mt: 0.5 }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<AttachFileIcon />}
              size="small"
              disabled={images.length >= 4}
              sx={{ borderColor: color.main, color: color.main }}
            >
              画像を選択
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                hidden
                onChange={handleImageChange}
              />
            </Button>
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {images.map((img, i) => (
                <Chip
                  key={i}
                  label={img.name}
                  onDelete={() => removeImage(i)}
                  deleteIcon={<CloseIcon />}
                  size="small"
                  sx={{ bgcolor: `${color.main}15` }}
                />
              ))}
            </Box>
          </Box>
        </Grid>

        {/* URL */}
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">URL</Typography>
          <TextField
            fullWidth
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            size="small"
            error={!!errors.url}
            helperText={errors.url}
            sx={{ mt: 0.5 }}
          />
        </Grid>

        {/* 共有できていないスタッフ */}
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">共有できていないスタッフ</Typography>
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {staffList.map((s) => {
              const initial = s.initials || s.name.charAt(0);
              const isSelected = staffNotShared.includes(s.name);
              return (
                <Button
                  key={s.name}
                  variant={isSelected ? 'contained' : 'outlined'}
                  onClick={() => handleStaffToggle(s.name)}
                  sx={{
                    minWidth: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    bgcolor: isSelected ? color.main : 'transparent',
                    color: isSelected ? '#fff' : color.main,
                    borderColor: color.main,
                    '&:hover': {
                      bgcolor: isSelected ? color.dark : `${color.light}30`,
                    },
                  }}
                  title={s.name}
                >
                  {initial}
                </Button>
              );
            })}
          </Box>
        </Grid>

        {/* 共有日 */}
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">共有日</Typography>
          <TextField
            fullWidth
            type="date"
            value={sharingDate}
            onChange={(e) => setSharingDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 0.5 }}
          />
        </Grid>

        {/* 打ち合わせ内容 */}
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">打ち合わせ内容</Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={meetingContent}
            onChange={(e) => setMeetingContent(e.target.value)}
            size="small"
            sx={{ mt: 0.5 }}
          />
        </Grid>
      </Grid>

      {/* ボタン */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={onCancel} disabled={saving}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark } }}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {saving ? '保存中...' : '保存'}
        </Button>
      </Box>
    </Box>
  );
}
