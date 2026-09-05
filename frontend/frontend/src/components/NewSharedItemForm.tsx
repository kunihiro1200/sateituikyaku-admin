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
  comment?: string; // 画像用コメント
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
    setPdfs((prev) => [...prev, ...newFiles].slice(0, 10));
    e.target.value = '';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = files.map((f) => ({ file: f, name: f.name, comment: '' }));
    setImages((prev) => [...prev, ...newFiles].slice(0, 10));
    e.target.value = '';
  };

  const removePdf = (index: number) => {
    setPdfs((prev) => prev.filter((_, i) => i !== index));
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const updateImageComment = (index: number, comment: string) => {
    setImages((prev) => 
      prev.map((img, i) => i === index ? { ...img, comment } : img)
    );
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
        'PDF1': pdfUrls[0] || '',
        'PDF2': pdfUrls[1] || '',
        'PDF3': pdfUrls[2] || '',
        'PDF4': pdfUrls[3] || '',
        'PDF5': pdfUrls[4] || '',
        'PDF6': pdfUrls[5] || '',
        'PDF7': pdfUrls[6] || '',
        'PDF8': pdfUrls[7] || '',
        'PDF9': pdfUrls[8] || '',
        'PDF10': pdfUrls[9] || '',
        '画像１': imageUrls[0] || '',
        '画像２': imageUrls[1] || '',
        '画像３': imageUrls[2] || '',
        '画像４': imageUrls[3] || '',
        'URL': url,
        '打ち合わせ内容': meetingContent,
      };

      await api.post('/api/shared-items', payload);

      // 画像コメントは別途DBに保存
      if (images.some(img => img.comment)) {
        const comments: Record<number, string> = {};
        images.forEach((img, index) => {
          if (img.comment) {
            comments[index + 1] = img.comment;
          }
        });
        try {
          await api.put(`/api/shared-items/${nextId}/image-comments`, { comments });
        } catch (commentError) {
          console.error('Failed to save image comments:', commentError);
          // コメント保存失敗は全体の保存を止めない
        }
      }

      // 画像5〜10は別途DBに保存
      if (imageUrls.slice(4).some(url => url)) {
        const dbImages: Record<number, string> = {
          5: imageUrls[4] || '',
          6: imageUrls[5] || '',
          7: imageUrls[6] || '',
          8: imageUrls[7] || '',
          9: imageUrls[8] || '',
          10: imageUrls[9] || '',
        };
        try {
          await api.put(`/api/shared-items/${nextId}/images`, { images: dbImages });
        } catch (imageError) {
          console.error('Failed to save images 5-10:', imageError);
          // 画像保存失敗は全体の保存を止めない
        }
      }

      // 契約率チーム・物件数チームの場合、「問い」をDBのteam-answersにも保存
      // （詳細ページの「問い」表示はDBの shared_item_team_answers.question を参照するため）
      if (['契約率チーム', '物件数チーム'].includes(sharingLocation)) {
        try {
          await api.put(`/api/shared-items/${nextId}/team-answers`, { question: title });
        } catch (teamAnswerError) {
          console.error('問いの保存に失敗しました:', teamAnswerError);
        }
      }

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

        {/* タイトル／問い（必須） */}
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">
            {['契約率チーム', '物件数チーム'].includes(sharingLocation) ? '問い *' : 'タイトル *'}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={['契約率チーム', '物件数チーム'].includes(sharingLocation) ? 3 : 2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="small"
            error={!!errors.title}
            helperText={errors.title}
            sx={{ mt: 0.5 }}
          />
        </Grid>

        {/* 内容（チームモードでは非表示） */}
        {!['契約率チーム', '物件数チーム'].includes(sharingLocation) && (
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
        )}

        {/* PDF添付 */}
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">PDF（最大10件）</Typography>
          <Box sx={{ mt: 0.5 }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<AttachFileIcon />}
              size="small"
              disabled={pdfs.length >= 10}
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
          <Typography variant="caption" color="text.secondary">画像（最大10件）</Typography>
          <Box sx={{ mt: 0.5 }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<AttachFileIcon />}
              size="small"
              disabled={images.length >= 10}
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
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {images.map((img, i) => (
                <Box key={i} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 1.5, bgcolor: '#fafafa' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: color.main }}>
                      画像 {i + 1}: {img.name}
                    </Typography>
                    <IconButton size="small" onClick={() => removeImage(i)} sx={{ color: '#f44336' }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <TextField
                    fullWidth
                    placeholder={`画像 ${i + 1} のコメントを入力`}
                    value={img.comment || ''}
                    onChange={(e) => updateImageComment(i, e.target.value)}
                    size="small"
                    multiline
                    rows={2}
                    sx={{ 
                      mt: 1,
                      '& .MuiOutlinedInput-root': { 
                        bgcolor: '#fff',
                        fontSize: '0.9rem',
                      },
                      '& .MuiInputBase-input': {
                        color: '#d32f2f',
                        fontWeight: '600',
                      }
                    }}
                  />
                </Box>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <TextField
              fullWidth
              type="date"
              value={sharingDate}
              onChange={(e) => setSharingDate(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark }, whiteSpace: 'nowrap', flexShrink: 0 }}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {saving ? '保存中...' : '保存'}
            </Button>
          </Box>
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
