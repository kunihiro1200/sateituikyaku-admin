/**
 * 他社物件 画像登録モーダル
 * 物件概要書の画像をドロップ/選択 → Claude AIが読み取り → 確認してproperty_listingsに登録
 */
import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  TextField,
  Grid,
  Divider,
  IconButton,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  AutoFixHigh as AutoFixHighIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface ExtractedProperty {
  prefecture: string;
  address: string;
  price: number | null;
  property_type: string;
  land_area: string | null;
  building_area: string | null;
  floor_plan: string | null;
  build_year: number | null;
  access: string | null;
  youto_chiiki: string | null;
  building_coverage_ratio: string | null;
  floor_area_ratio: string | null;
  road_access: string | null;
  remarks: string | null;
  raw_address_prefecture: string;
  issuing_company: string | null;
}

interface PreviewData {
  extracted: ExtractedProperty;
  preview: {
    property_number: string;
    prefix: 'FT' | 'OT';
    prefecture_label: string;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onRegistered: (propertyNumber: string) => void;
}

export default function TashaPropertyImageRegisterModal({ open, onClose, onRegistered }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<ExtractedProperty>>({});
  const [registeredNumber, setRegisteredNumber] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleReset = () => {
    setStep('upload');
    setImageFile(null);
    setImagePreviewUrl(null);
    setLoading(false);
    setError(null);
    setPreview(null);
    setEditedValues({});
    setRegisteredNumber('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processImage = useCallback(async (file: File) => {
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setError(null);
    setLoading(true);

    try {
      // ファイルをBase64に変換
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // "data:image/jpeg;base64,XXXX" → "XXXX"
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mediaType = file.type || 'image/jpeg';

      const res = await api.post('/api/ai/extract-property-preview', {
        imageBase64: base64,
        mediaType,
      });

      setPreview(res.data);
      setEditedValues(res.data.extracted);
      setStep('preview');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || '画像解析に失敗しました';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleRegister = async () => {
    if (!imageFile || !preview) return;
    setLoading(true);
    setError(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const res = await api.post('/api/ai/extract-and-register-property', {
        imageBase64: base64,
        mediaType: imageFile.type || 'image/jpeg',
        overrides: editedValues,
      });

      setRegisteredNumber(res.data.propertyNumber);
      setStep('done');
      onRegistered(res.data.propertyNumber);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || '登録に失敗しました';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getField = (key: keyof ExtractedProperty) =>
    (editedValues[key] ?? preview?.extracted[key] ?? '') as string;

  const setField = (key: keyof ExtractedProperty, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const prefectureLabel = preview?.preview.prefecture_label || '';
  const propertyNumber = preview?.preview.property_number || '';
  const prefixColor = preview?.preview.prefix === 'FT' ? '#1565c0' : '#2e7d32';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoFixHighIcon sx={{ color: '#7b1fa2' }} />
          <Typography variant="h6" fontWeight="bold">他社物件を画像から登録</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* STEP 1: 画像アップロード */}
        {step === 'upload' && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              物件概要書の画像をアップロードすると、Claude AIが内容を読み取って自動入力します。
              住所が福岡なら <strong>FT番号</strong>、大分なら <strong>OT番号</strong> で登録されます。
            </Typography>

            <Box
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              sx={{
                border: `2px dashed ${isDragging ? '#7b1fa2' : '#ccc'}`,
                borderRadius: 2,
                p: 6,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: isDragging ? '#f3e5f5' : '#fafafa',
                transition: 'all 0.2s',
                '&:hover': { borderColor: '#7b1fa2', bgcolor: '#f3e5f5' },
              }}
            >
              {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <CircularProgress sx={{ color: '#7b1fa2' }} />
                  <Typography variant="body2" color="text.secondary">
                    Claude AIが画像を解析中...
                  </Typography>
                </Box>
              ) : (
                <>
                  <CloudUploadIcon sx={{ fontSize: 64, color: '#ccc', mb: 1 }} />
                  <Typography variant="body1" color="text.secondary">
                    ここに画像をドロップ、またはクリックして選択
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    JPEG / PNG / WebP 対応
                  </Typography>
                </>
              )}
            </Box>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
            )}
          </Box>
        )}

        {/* STEP 2: AI抽出結果の確認・編集 */}
        {step === 'preview' && preview && (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              {imagePreviewUrl && (
                <Box
                  component="img"
                  src={imagePreviewUrl}
                  alt="アップロード画像"
                  sx={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 1, border: '1px solid #eee' }}
                />
              )}
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  AIが以下の情報を読み取りました。必要に応じて修正してから登録してください。
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip
                    label={`物件番号: ${propertyNumber}`}
                    sx={{ fontWeight: 'bold', bgcolor: prefixColor, color: 'white', fontSize: '0.9rem' }}
                  />
                  <Chip
                    label={`他社物件 / ${prefectureLabel}`}
                    variant="outlined"
                    color="secondary"
                  />
                </Box>
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="所在地 *"
                  fullWidth
                  size="small"
                  value={getField('address')}
                  onChange={e => setField('address', e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="種別"
                  fullWidth
                  size="small"
                  value={getField('property_type')}
                  onChange={e => setField('property_type', e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="価格（円）"
                  fullWidth
                  size="small"
                  type="number"
                  value={editedValues.price ?? preview.extracted.price ?? ''}
                  onChange={e => setEditedValues(prev => ({ ...prev, price: e.target.value ? Number(e.target.value) : null }))}
                  helperText={
                    (editedValues.price ?? preview.extracted.price)
                      ? `${((editedValues.price ?? preview.extracted.price ?? 0) / 10000).toLocaleString()}万円`
                      : ''
                  }
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="土地面積"
                  fullWidth
                  size="small"
                  value={getField('land_area')}
                  onChange={e => setField('land_area', e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="建物面積"
                  fullWidth
                  size="small"
                  value={getField('building_area')}
                  onChange={e => setField('building_area', e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="交通アクセス"
                  fullWidth
                  size="small"
                  value={getField('access')}
                  onChange={e => setField('access', e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="用途地域"
                  fullWidth
                  size="small"
                  value={getField('youto_chiiki')}
                  onChange={e => setField('youto_chiiki', e.target.value)}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="建蔽率"
                  fullWidth
                  size="small"
                  value={getField('building_coverage_ratio')}
                  onChange={e => setField('building_coverage_ratio', e.target.value)}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="容積率"
                  fullWidth
                  size="small"
                  value={getField('floor_area_ratio')}
                  onChange={e => setField('floor_area_ratio', e.target.value)}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="道路接道"
                  fullWidth
                  size="small"
                  value={getField('road_access')}
                  onChange={e => setField('road_access', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="備考"
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  value={getField('remarks')}
                  onChange={e => setField('remarks', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="発行会社（他社）→ 特記に保存"
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  value={getField('issuing_company')}
                  onChange={e => setField('issuing_company', e.target.value)}
                  helperText="画像左下の不動産会社情報。特記欄に自動保存されます。"
                  sx={{ '& .MuiInputLabel-root': { color: '#7b1fa2' } }}
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ p: 1.5, bgcolor: '#f3e5f5', borderRadius: 1, border: '1px solid #ce93d8' }}>
                  <Typography variant="caption" sx={{ color: '#7b1fa2', fontWeight: 'bold' }}>
                    当社情報（取引業者欄に自動設定）
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: '#555', mt: 0.5 }}>
                    {prefectureLabel === '福岡'
                      ? '株式会社くじら不動産　福岡市中央区舞鶴3-1-10　TEL:092-401-5331'
                      : '株式会社いふう　大分市舞鶴町1-3-30　TEL:097-533-2022'}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
            )}
          </Box>
        )}

        {/* STEP 3: 登録完了 */}
        {step === 'done' && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 72, color: '#2e7d32', mb: 2 }} />
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
              登録完了！
            </Typography>
            <Chip
              label={registeredNumber}
              sx={{ fontWeight: 'bold', bgcolor: prefixColor, color: 'white', fontSize: '1rem', mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              {prefectureLabel}の他社物件として物件リストに追加されました。
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {step === 'upload' && (
          <Button onClick={handleClose}>キャンセル</Button>
        )}
        {step === 'preview' && (
          <>
            <Button onClick={handleReset} disabled={loading}>やり直す</Button>
            <Button onClick={handleClose} disabled={loading}>キャンセル</Button>
            <Button
              variant="contained"
              onClick={handleRegister}
              disabled={loading || !getField('address')}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ bgcolor: '#7b1fa2', '&:hover': { bgcolor: '#6a1b9a' } }}
            >
              {loading ? '登録中...' : 'この内容で登録する'}
            </Button>
          </>
        )}
        {step === 'done' && (
          <>
            <Button onClick={handleReset}>別の画像を登録</Button>
            <Button variant="contained" onClick={handleClose}>閉じる</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
