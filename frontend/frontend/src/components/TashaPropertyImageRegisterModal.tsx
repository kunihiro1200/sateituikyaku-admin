// v2 - PDF対応・複数ファイル一括登録
/**
 * 他社物件 画像一括登録モーダル
 * 複数の物件概要書画像をドロップ/選択 → 1枚ずつClaude AIが読み取り → 確認してproperty_listingsに登録
 */
import { useState, useCallback, useRef } from 'react';
import { fixImageOrientationToBase64 } from '../utils/imageOrientationFix';
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
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  AutoFixHigh as AutoFixHighIcon,
  SkipNext as SkipNextIcon,
  NavigateNext as NavigateNextIcon,
  PictureAsPdf as PictureAsPdfIcon,
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

// 1枚分の処理状態
interface ImageItem {
  file: File;
  previewUrl: string;
  status: 'pending' | 'analyzing' | 'ready' | 'registered' | 'skipped' | 'error';
  previewData?: PreviewData;
  editedValues?: Partial<ExtractedProperty>;
  registeredNumber?: string;
  errorMessage?: string;
  rotation?: 0 | 90 | 180 | 270; // 手動回転（度）
}

interface Props {
  open: boolean;
  onClose: () => void;
  onRegistered: (propertyNumbers: string[]) => void;
}

export default function TashaPropertyImageRegisterModal({ open, onClose, onRegistered }: Props) {
  const [step, setStep] = useState<'upload' | 'process' | 'done'>('upload');
  const [items, setItems] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setStep('upload');
    setItems([]);
    setCurrentIndex(0);
    setGlobalError(null);
    setIsAnalyzing(false);
    setIsRegistering(false);
    // objectURLを解放
    items.forEach(item => URL.revokeObjectURL(item.previewUrl));
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // ファイルを受け取って items に追加し、1枚目の解析を開始
  const processFiles = useCallback(async (files: File[]) => {
    // image/* に限らず、拡張子ベースでも判定（typeが空の場合に対応）。PDFも可。
    const imageExts = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|avif|pdf)$/i;
    const imageFiles = files.filter(f =>
      f.type.startsWith('image/') ||
      f.type === 'application/pdf' ||
      imageExts.test(f.name) ||
      f.type === ''
    );
    // ファイルが1件もない場合はエラー表示
    if (imageFiles.length === 0) {
      setGlobalError('画像またはPDFファイルを選択してください（JPEG・PNG・WebP・PDF 等）');
      return;
    }

    const newItems: ImageItem[] = imageFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
    }));

    setItems(newItems);
    setCurrentIndex(0);
    setStep('process');
    setGlobalError(null);

    // 1枚目を即座に解析開始（newItemsを直接渡してstateの非同期更新を回避）
    await analyzeItem(newItems, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyzeItem = async (itemList: ImageItem[], index: number) => {
    setIsAnalyzing(true);

    // status を analyzing に更新
    setItems(prev => prev.map((it, i) => i === index ? { ...it, status: 'analyzing' } : it));

    try {
      const file = itemList[index].file;
      // EXIF回転補正しながらbase64化
      const { base64, mediaType: fixedMediaType } = await fixImageOrientationToBase64(file);

      // MIMEタイプが空の場合は拡張子から推定
      let mediaType = fixedMediaType || file.type;
      if (!mediaType || mediaType === 'application/octet-stream') {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const extMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg',
          png: 'image/png', gif: 'image/gif',
          webp: 'image/webp', bmp: 'image/png',
          heic: 'image/jpeg', avif: 'image/webp',
          pdf: 'application/pdf',
        };
        mediaType = extMap[ext] ?? 'image/jpeg';
      }

      const res = await api.post('/api/ai/extract-property-preview', {
        imageBase64: base64,
        mediaType,
      });

      setItems(prev => prev.map((it, i) =>
        i === index
          ? {
              ...it,
              status: 'ready',
              previewData: res.data,
              editedValues: { ...res.data.extracted },
            }
          : it
      ));
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || '解析失敗';
      setItems(prev => prev.map((it, i) =>
        i === index ? { ...it, status: 'error', errorMessage: msg } : it
      ));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) processFiles(files);
    // 同じファイルを再選択できるようリセット
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleRegister = async () => {
    const item = items[currentIndex];
    if (!item || item.status !== 'ready') return;
    setIsRegistering(true);

    try {
      const { base64: orientedBase64, mediaType: fixedMediaType } = await fixImageOrientationToBase64(item.file);
      let mediaType = fixedMediaType || item.file.type || 'image/jpeg';

      // 手動回転が指定されている場合はCanvasで回転
      let finalBase64 = orientedBase64;
      const rotation = item.rotation ?? 0;
      if (rotation !== 0 && mediaType !== 'application/pdf') {
        finalBase64 = await new Promise<string>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const swap = rotation === 90 || rotation === 270;
            canvas.width = swap ? img.height : img.width;
            canvas.height = swap ? img.width : img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            resolve(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
          };
          img.src = `data:image/jpeg;base64,${orientedBase64}`;
        });
      }

      const res = await api.post('/api/ai/extract-and-register-property', {
        imageBase64: finalBase64,
        mediaType,
        overrides: item.editedValues,
      });

      const registeredNumber = res.data.propertyNumber;

      // 登録成功後、画像をStorageに保存
      try {
        await api.post(`/api/ai/tasha-property-image/${registeredNumber}`, {
          imageBase64: finalBase64,
          mediaType,
          fileName: item.file.name,
        });
      } catch (imgErr) {
        console.warn('[TashaRegister] 画像保存失敗（登録は成功）:', imgErr);
      }

      setItems(prev => prev.map((it, i) =>
        i === currentIndex
          ? { ...it, status: 'registered', registeredNumber }
          : it
      ));
      goToNext(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || '登録失敗';
      setItems(prev => prev.map((it, i) =>
        i === currentIndex ? { ...it, errorMessage: msg } : it
      ));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSkip = () => {
    setItems(prev => prev.map((it, i) =>
      i === currentIndex ? { ...it, status: 'skipped' } : it
    ));
    goToNext(false);
  };

  const goToNext = async (registered: boolean) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= items.length) {
      // 全枚数処理完了
      const registered_numbers = items
        .filter(it => it.status === 'registered')
        .map(it => it.registeredNumber!)
        .filter(Boolean);
      // 最後に登録したものも含める
      onRegistered(registered_numbers);
      setStep('done');
      return;
    }

    setCurrentIndex(nextIndex);

    // 次の画像がまだ解析されていなければ解析する
    const nextItem = items[nextIndex];
    if (nextItem.status === 'pending') {
      await analyzeItem(items, nextIndex);
    }
  };

  const setFieldForCurrent = (key: keyof ExtractedProperty, value: string | number | null) => {
    setItems(prev => prev.map((it, i) =>
      i === currentIndex
        ? { ...it, editedValues: { ...it.editedValues, [key]: value } }
        : it
    ));
  };

  // 現在の画像を90度回転する
  const handleRotate = () => {
    setItems(prev => prev.map((it, i) => {
      if (i !== currentIndex) return it;
      const current = it.rotation ?? 0;
      const next = ((current + 90) % 360) as 0 | 90 | 180 | 270;
      return { ...it, rotation: next };
    }));
  };

  // 現在のアイテム
  const currentItem = items[currentIndex];
  const editedValues = currentItem?.editedValues ?? {};
  const previewData = currentItem?.previewData;

  const getField = (key: keyof ExtractedProperty): string => {
    const v = editedValues[key] ?? previewData?.extracted[key] ?? '';
    return v != null ? String(v) : '';
  };

  const prefectureLabel = previewData?.preview.prefecture_label ?? '';
  const propertyNumber = previewData?.preview.property_number ?? '';
  const prefixColor = previewData?.preview.prefix === 'FT' ? '#1565c0' : '#2e7d32';

  // 進捗カウント
  const registeredCount = items.filter(it => it.status === 'registered').length;
  const skippedCount = items.filter(it => it.status === 'skipped').length;
  const doneCount = registeredCount + skippedCount + items.filter(it => it.status === 'error').length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoFixHighIcon sx={{ color: '#7b1fa2' }} />
          <Typography variant="h6" fontWeight="bold">他社物件を画像から登録</Typography>
          {step === 'process' && (
            <Chip
              label={`${currentIndex + 1} / ${items.length} 枚`}
              size="small"
              sx={{ bgcolor: '#7b1fa2', color: 'white', fontWeight: 'bold' }}
            />
          )}
        </Box>
        <IconButton onClick={handleClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      {/* 進捗バー */}
      {step === 'process' && items.length > 1 && (
        <LinearProgress
          variant="determinate"
          value={(doneCount / items.length) * 100}
          sx={{ mx: 3, mb: 1, borderRadius: 1, bgcolor: '#e1bee7', '& .MuiLinearProgress-bar': { bgcolor: '#7b1fa2' } }}
        />
      )}

      <DialogContent sx={{ pt: step === 'process' ? 1 : 2 }}>

        {/* STEP 1: アップロード */}
        {step === 'upload' && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              物件概要書の画像を<strong>複数枚まとめて</strong>アップロードできます。
              1枚ずつAIが読み取り、確認してから登録します。
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
              <CloudUploadIcon sx={{ fontSize: 64, color: '#ccc', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                ここに画像をドロップ、またはクリックして選択
              </Typography>
              <Typography variant="caption" color="text.disabled">
                複数枚同時に選択可 / JPEG・PNG・WebP・PDF 対応
              </Typography>
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp,.heic,.avif,.pdf,application/pdf"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {globalError && <Alert severity="error" sx={{ mt: 2 }}>{globalError}</Alert>}
          </Box>
        )}

        {/* STEP 2: 1枚ずつ確認・登録 */}
        {step === 'process' && currentItem && (
          <Box>
            {/* サムネイル一覧 */}
            {items.length > 1 && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2, overflowX: 'auto', pb: 1 }}>
                {items.map((item, i) => (
                  <Box
                    key={i}
                    sx={{
                      position: 'relative',
                      flexShrink: 0,
                      width: 60,
                      height: 45,
                      borderRadius: 1,
                      overflow: 'hidden',
                      border: i === currentIndex ? '2px solid #7b1fa2' : '2px solid transparent',
                      opacity: item.status === 'skipped' || item.status === 'error' ? 0.4 : 1,
                    }}
                  >
                    {item.file.type === 'application/pdf' || item.file.name.endsWith('.pdf') ? (
                      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#ffebee' }}>
                        <PictureAsPdfIcon sx={{ color: '#c62828', fontSize: 28 }} />
                      </Box>
                    ) : (
                      <Box
                        component="img"
                        src={item.previewUrl}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                    {item.status === 'registered' && (
                      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(46,125,50,0.6)' }}>
                        <CheckCircleIcon sx={{ color: 'white', fontSize: 20 }} />
                      </Box>
                    )}
                    {item.status === 'analyzing' && (
                      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.4)' }}>
                        <CircularProgress size={16} sx={{ color: 'white' }} />
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {/* 解析中 */}
            {currentItem.status === 'analyzing' && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress sx={{ color: '#7b1fa2', mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Claude AIが画像を解析中... ({currentIndex + 1}/{items.length}枚目)
                </Typography>
              </Box>
            )}

            {/* エラー */}
            {currentItem.status === 'error' && (
              <Box sx={{ py: 2 }}>
                <Alert severity="error" sx={{ mb: 2 }}>{currentItem.errorMessage}</Alert>
                {currentItem.file.type === 'application/pdf' || currentItem.file.name.endsWith('.pdf') ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
                    <PictureAsPdfIcon sx={{ color: '#c62828' }} />
                    <Typography variant="body2">{currentItem.file.name}</Typography>
                  </Box>
                ) : (
                  <Box
                    component="img"
                    src={currentItem.previewUrl}
                    sx={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 1 }}
                  />
                )}
              </Box>
            )}

            {/* 確認・編集フォーム */}
            {currentItem.status === 'ready' && previewData && (
              <Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {currentItem.file.type === 'application/pdf' || currentItem.file.name.endsWith('.pdf') ? (
                    <Box sx={{ width: 160, height: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#ffebee', borderRadius: 1, border: '1px solid #ef9a9a', flexShrink: 0, gap: 0.5 }}>
                      <PictureAsPdfIcon sx={{ color: '#c62828', fontSize: 40 }} />
                      <Typography variant="caption" sx={{ color: '#c62828', textAlign: 'center', px: 1, wordBreak: 'break-all' }}>
                        {currentItem.file.name}
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ flexShrink: 0 }}>
                      <Box
                        component="img"
                        src={currentItem.previewUrl}
                        sx={{
                          width: 160,
                          height: 110,
                          objectFit: 'contain',
                          borderRadius: 1,
                          border: '1px solid #eee',
                          display: 'block',
                          transform: `rotate(${currentItem.rotation ?? 0}deg)`,
                          transition: 'transform 0.3s',
                          // 90/270度回転時ははみ出さないようにする
                          ...(((currentItem.rotation ?? 0) === 90 || (currentItem.rotation ?? 0) === 270)
                            ? { width: 110, height: 160 } : {}),
                        }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleRotate}
                        sx={{ mt: 0.5, width: '100%', fontSize: '0.7rem' }}
                        startIcon={<span style={{ fontSize: '1rem' }}>↻</span>}
                      >
                        回転
                      </Button>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      AIが以下の情報を読み取りました。修正してから登録してください。
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={`物件番号: ${propertyNumber}`}
                        sx={{ fontWeight: 'bold', bgcolor: prefixColor, color: 'white' }}
                      />
                      <Chip label={`他社物件 / ${prefectureLabel}`} variant="outlined" color="secondary" />
                    </Box>
                  </Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <TextField label="所在地 *" fullWidth size="small"
                      value={getField('address')}
                      onChange={e => setFieldForCurrent('address', e.target.value)} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="種別" fullWidth size="small"
                      value={getField('property_type')}
                      onChange={e => setFieldForCurrent('property_type', e.target.value)} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="価格（円）" fullWidth size="small" type="number"
                      value={editedValues.price ?? previewData.extracted.price ?? ''}
                      onChange={e => setFieldForCurrent('price', e.target.value ? Number(e.target.value) : null)}
                      helperText={
                        (editedValues.price ?? previewData.extracted.price)
                          ? `${(((editedValues.price ?? previewData.extracted.price) as number) / 10000).toLocaleString()}万円`
                          : ''
                      }
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="土地面積" fullWidth size="small"
                      value={getField('land_area')}
                      onChange={e => setFieldForCurrent('land_area', e.target.value)} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="建物面積" fullWidth size="small"
                      value={getField('building_area')}
                      onChange={e => setFieldForCurrent('building_area', e.target.value)} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="交通アクセス" fullWidth size="small"
                      value={getField('access')}
                      onChange={e => setFieldForCurrent('access', e.target.value)} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="用途地域" fullWidth size="small"
                      value={getField('youto_chiiki')}
                      onChange={e => setFieldForCurrent('youto_chiiki', e.target.value)} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="建蔽率" fullWidth size="small"
                      value={getField('building_coverage_ratio')}
                      onChange={e => setFieldForCurrent('building_coverage_ratio', e.target.value)} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="容積率" fullWidth size="small"
                      value={getField('floor_area_ratio')}
                      onChange={e => setFieldForCurrent('floor_area_ratio', e.target.value)} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="道路接道" fullWidth size="small"
                      value={getField('road_access')}
                      onChange={e => setFieldForCurrent('road_access', e.target.value)} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="備考" fullWidth size="small" multiline rows={2}
                      value={getField('remarks')}
                      onChange={e => setFieldForCurrent('remarks', e.target.value)} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="発行会社（他社）→ 特記に保存"
                      fullWidth size="small" multiline rows={2}
                      value={getField('issuing_company')}
                      onChange={e => setFieldForCurrent('issuing_company', e.target.value)}
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

                {currentItem.errorMessage && (
                  <Alert severity="error" sx={{ mt: 1 }}>{currentItem.errorMessage}</Alert>
                )}
              </Box>
            )}
          </Box>
        )}

        {/* STEP 3: 全完了 */}
        {step === 'done' && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: 72, color: '#2e7d32', mb: 2 }} />
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              処理完了！
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
              {items.filter(it => it.status === 'registered').map(it => (
                <Chip
                  key={it.registeredNumber}
                  label={it.registeredNumber}
                  sx={{ fontWeight: 'bold', bgcolor: '#2e7d32', color: 'white' }}
                />
              ))}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {registeredCount}件登録 / {skippedCount}件スキップ
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {step === 'upload' && (
          <Button onClick={handleClose}>キャンセル</Button>
        )}

        {step === 'process' && (
          <>
            <Button onClick={handleClose} disabled={isAnalyzing || isRegistering}>閉じる</Button>

            {/* エラー時はスキップのみ */}
            {currentItem?.status === 'error' && (
              <Button
                variant="outlined"
                startIcon={<SkipNextIcon />}
                onClick={handleSkip}
              >
                スキップして次へ
              </Button>
            )}

            {/* 解析完了時：スキップ + 登録 */}
            {currentItem?.status === 'ready' && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<SkipNextIcon />}
                  onClick={handleSkip}
                  disabled={isRegistering}
                >
                  スキップ
                </Button>
                <Button
                  variant="contained"
                  onClick={handleRegister}
                  disabled={isRegistering || !getField('address')}
                  startIcon={isRegistering ? <CircularProgress size={16} color="inherit" /> : <NavigateNextIcon />}
                  sx={{ bgcolor: '#7b1fa2', '&:hover': { bgcolor: '#6a1b9a' } }}
                >
                  {isRegistering
                    ? '登録中...'
                    : currentIndex + 1 < items.length
                    ? 'この内容で登録して次へ'
                    : 'この内容で登録して完了'}
                </Button>
              </>
            )}
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
