import React, { useState } from 'react';
import {
  Box, Button, Typography, Paper, CircularProgress, Alert, Chip,
  Divider, List, ListItem, ListItemIcon, ListItemText,
  LinearProgress, Snackbar, Grid,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import LandscapeIcon from '@mui/icons-material/Landscape';
import HomeIcon from '@mui/icons-material/Home';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import ImageSelectorModal, { ImageFile } from '../components/ImageSelectorModal';

const MAX_BYTES_PER_REQUEST = 3 * 1024 * 1024;

interface DiffItem {
  category: 'land' | 'building';
  diffType: 'only_in_toki' | 'only_in_kazei' | 'area_mismatch' | 'type_mismatch' | 'attached_building';
  description: string;
  tokiValue?: string;
  kazeiValue?: string;
  chiban?: string;
}

interface ParsedDocument {
  lands: Array<{ chiban: string; type?: string; area?: string }>;
  buildings: Array<{ kaokuBango?: string; chiban?: string; kind?: string; structure?: string; area?: string; isAttached?: boolean }>;
}

interface FilePayload {
  name: string;
  mimeType: string;
  base64: string;
}

async function splitPdfIntoChunks(file: File, maxBytes: number): Promise<FilePayload[][]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: FilePayload[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({ name: `${file.name}_p${i}.jpg`, mimeType: 'image/jpeg', base64: canvas.toDataURL('image/jpeg', 0.75).split(',')[1] });
  }
  const chunks: FilePayload[][] = [];
  let cur: FilePayload[] = [], curSize = 0;
  for (const p of pages) {
    const sz = p.base64.length * 0.75;
    if (curSize + sz > maxBytes && cur.length > 0) { chunks.push(cur); cur = []; curSize = 0; }
    cur.push(p); curSize += sz;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function imageFilesToPayloads(images: ImageFile[], onProgress: (msg: string) => void): Promise<FilePayload[]> {
  const payloads: FilePayload[] = [];
  for (const img of images) {
    if (img.source === 'drive' && img.driveFileId) {
      onProgress(`Google Driveから取得中: ${img.name}`);
      const res = await api.get(`/api/drive/files/${img.driveFileId}/base64`);
      payloads.push({ name: img.name, mimeType: res.data.mimeType, base64: res.data.base64 });
    } else if (img.source === 'local' && img.localFile) {
      onProgress(`ファイルを準備中: ${img.name}`);
      if (img.mimeType === 'application/pdf') {
        const chunks = await splitPdfIntoChunks(img.localFile, MAX_BYTES_PER_REQUEST);
        for (const chunk of chunks) payloads.push(...chunk);
      } else {
        payloads.push({ name: img.name, mimeType: img.mimeType, base64: await fileToBase64(img.localFile) });
      }
    }
  }
  return payloads;
}

const DIFF_TYPE_LABEL: Record<DiffItem['diffType'], string> = {
  only_in_toki: '謄本にのみ存在', only_in_kazei: '公課証明にのみ存在',
  area_mismatch: '面積が異なる', type_mismatch: '地目が異なる', attached_building: '付属建物の不一致',
};
const DIFF_TYPE_COLOR: Record<DiffItem['diffType'], 'error' | 'warning' | 'info'> = {
  only_in_toki: 'error', only_in_kazei: 'error',
  area_mismatch: 'warning', type_mismatch: 'warning', attached_building: 'info',
};

const KoteiKazeiComparePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyNumber = searchParams.get('propertyNumber');

  // 選択済みファイル
  const [tokiImages, setTokiImages] = useState<ImageFile[]>([]);
  const [kazeiImages, setKazeiImages] = useState<ImageFile[]>([]);

  // ImageSelectorModal 開閉（'toki' | 'kazei' | null）
  const [selectorOpen, setSelectorOpen] = useState<'toki' | 'kazei' | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [diffs, setDiffs] = useState<DiffItem[] | null>(null);
  const [tokiData, setTokiData] = useState<ParsedDocument | null>(null);
  const [kazeiData, setKazeiData] = useState<ParsedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // 保存済みデータ読み込み
  React.useEffect(() => {
    if (!propertyNumber) return;
    api.get(`/api/kotei-kazei-compare/${encodeURIComponent(propertyNumber)}`)
      .then((res) => {
        const json = res.data;
        if (json.data) {
          setDiffs(json.data.diffs); setTokiData(json.data.toki_data);
          setKazeiData(json.data.kazei_data); setSavedAt(json.data.analyzed_at); setIsFromCache(true);
        }
      }).catch(() => {});
  }, [propertyNumber]);

  // ImageSelectorModal確定時
  const handleSelectorConfirm = (target: 'toki' | 'kazei') => (images: ImageFile[]) => {
    if (target === 'toki') setTokiImages(images);
    else setKazeiImages(images);
    setSelectorOpen(null);
  };

  const handleAnalyze = async () => {
    if (tokiImages.length === 0 || kazeiImages.length === 0) {
      setError('謄本と公課証明の両方のファイルを選択してください'); return;
    }
    setLoading(true); setError(null); setDiffs(null); setProgress(0);
    try {
      setLoadingMessage('謄本を準備中...');
      const tokiPayloads = await imageFilesToPayloads(tokiImages, setLoadingMessage);
      setProgress(25);
      setLoadingMessage('公課証明を準備中...');
      const kazeiPayloads = await imageFilesToPayloads(kazeiImages, setLoadingMessage);
      setProgress(50);
      setLoadingMessage('Claude AIが謄本と公課証明を比較解析中...');
      const response = await api.post('/api/kotei-kazei-compare/analyze', {
        tokiFiles: tokiPayloads, kazeiFiles: kazeiPayloads,
      });
      setProgress(90);
      const data = response.data;
      setDiffs(data.diffs); setTokiData(data.toki); setKazeiData(data.kazei);
      setIsFromCache(false); setProgress(100);
      if (propertyNumber) {
        setSaving(true);
        try {
          await api.post('/api/kotei-kazei-compare/save', {
            propertyNumber, toki: data.toki, kazei: data.kazei, diffs: data.diffs,
          });
          setSavedAt(new Date().toISOString());
          setSnackbarMessage('比較結果を保存しました'); setSnackbarSeverity('success'); setSnackbarOpen(true);
        } catch { } finally { setSaving(false); }
      }
    } catch (err: any) {
      setError(err.message || '解析中にエラーが発生しました');
    } finally { setLoading(false); setLoadingMessage(''); setProgress(0); }
  };

  const landDiffs = diffs?.filter((d) => d.category === 'land') ?? [];
  const buildingDiffs = diffs?.filter((d) => d.category === 'building') ?? [];

  // ファイル一覧チップを表示するヘルパー
  const renderFileChips = (images: ImageFile[]) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
      {images.map((img) => (
        <Chip key={img.id} size="small"
          icon={img.mimeType === 'application/pdf' ? <PictureAsPdfIcon /> : <ImageIcon />}
          label={img.name}
          color={img.mimeType === 'application/pdf' ? 'error' : 'default'}
          variant="outlined" />
      ))}
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button variant="outlined" size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/work-tasks')} sx={{ whiteSpace: 'nowrap' }}>業務一覧</Button>
        <Typography variant="h5" fontWeight="bold">固定資産税公課証明 比較</Typography>
        {propertyNumber && <Chip label={propertyNumber} size="small" color="primary" variant="outlined" />}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        謄本（複数枚可）と固定資産税公課証明書を読み込み、地番・面積・付属建物などの差分を自動検出します。
      </Typography>

      {/* ファイル選択エリア（2カラム） */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* 謄本 */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" color="#1565c0">
                📄 謄本（登記事項証明書）
              </Typography>
              <Button variant="contained" size="small" startIcon={<FolderOpenIcon />}
                onClick={() => setSelectorOpen('toki')}
                sx={{ bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' } }}>
                ファイルを選ぶ
              </Button>
            </Box>
            {tokiImages.length === 0
              ? <Typography variant="caption" color="text.secondary">ファイルが選択されていません</Typography>
              : renderFileChips(tokiImages)}
          </Paper>
        </Grid>

        {/* 公課証明 */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" color="#e65100">
                📄 固定資産税公課証明書
              </Typography>
              <Button variant="contained" size="small" startIcon={<FolderOpenIcon />}
                onClick={() => setSelectorOpen('kazei')}
                sx={{ bgcolor: '#e65100', '&:hover': { bgcolor: '#bf360c' } }}>
                ファイルを選ぶ
              </Button>
            </Box>
            {kazeiImages.length === 0
              ? <Typography variant="caption" color="text.secondary">ファイルが選択されていません</Typography>
              : renderFileChips(kazeiImages)}
          </Paper>
        </Grid>
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Button variant="contained" size="large" fullWidth
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
        onClick={handleAnalyze}
        disabled={loading || tokiImages.length === 0 || kazeiImages.length === 0}
        sx={{ mb: loading ? 1 : 3, bgcolor: '#4a148c', '&:hover': { bgcolor: '#38006b' } }}>
        {loading ? '解析中...' : '謄本と公課証明を比較する'}
      </Button>

      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress variant={progress > 0 ? 'determinate' : 'indeterminate'} value={progress} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>{loadingMessage}</Typography>
        </Box>
      )}

      {diffs !== null && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {saving && <CircularProgress size={16} />}
            {savedAt && !saving && (
              <Chip label={`保存済み ${new Date(savedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                size="small" color="success" variant="outlined" icon={<SaveIcon />} />
            )}
            {isFromCache && <Chip label="前回の保存済み結果" size="small" color="warning" variant="outlined" />}
            <Chip label={diffs.length === 0 ? '✓ 差分なし' : `⚠ 差分 ${diffs.length}件`}
              color={diffs.length === 0 ? 'success' : 'error'} sx={{ fontWeight: 700 }} />
            {landDiffs.length > 0 && <Chip label={`土地 ${landDiffs.length}件`} size="small" color="warning" variant="outlined" icon={<LandscapeIcon />} />}
            {buildingDiffs.length > 0 && <Chip label={`建物 ${buildingDiffs.length}件`} size="small" color="warning" variant="outlined" icon={<HomeIcon />} />}
          </Box>

          {diffs.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              <Typography variant="h6" color="success.main" fontWeight="bold">差分は検出されませんでした</Typography>
              <Typography variant="body2" color="text.secondary">謄本と公課証明の内容は一致しています</Typography>
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ p: 2 }}>
              {landDiffs.length > 0 && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <LandscapeIcon color="warning" /><Typography variant="subtitle1" fontWeight="bold">土地の差分（{landDiffs.length}件）</Typography>
                  </Box>
                  <List disablePadding sx={{ mb: 2 }}>
                    {landDiffs.map((diff, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <Divider component="li" />}
                        <ListItem alignItems="flex-start" sx={{ py: 1 }}>
                          <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}><WarningAmberIcon color={DIFF_TYPE_COLOR[diff.diffType]} /></ListItemIcon>
                          <ListItemText
                            primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="subtitle2" fontWeight="bold">{diff.description}</Typography>
                              <Chip label={DIFF_TYPE_LABEL[diff.diffType]} size="small" color={DIFF_TYPE_COLOR[diff.diffType]} variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
                            </Box>}
                            secondary={<Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {diff.tokiValue && <Box sx={{ p: 1, bgcolor: '#e3f2fd', borderRadius: 1, borderLeft: '3px solid #1565c0' }}><Typography variant="caption" color="#1565c0" fontWeight="bold">謄本：</Typography><Typography variant="body2">{diff.tokiValue}</Typography></Box>}
                              {diff.kazeiValue && <Box sx={{ p: 1, bgcolor: '#fff3e0', borderRadius: 1, borderLeft: '3px solid #e65100' }}><Typography variant="caption" color="#e65100" fontWeight="bold">公課証明：</Typography><Typography variant="body2">{diff.kazeiValue}</Typography></Box>}
                            </Box>} />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </>
              )}
              {landDiffs.length > 0 && buildingDiffs.length > 0 && <Divider sx={{ my: 2 }} />}
              {buildingDiffs.length > 0 && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <HomeIcon color="warning" /><Typography variant="subtitle1" fontWeight="bold">建物の差分（{buildingDiffs.length}件）</Typography>
                  </Box>
                  <List disablePadding>
                    {buildingDiffs.map((diff, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <Divider component="li" />}
                        <ListItem alignItems="flex-start" sx={{ py: 1 }}>
                          <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}><WarningAmberIcon color={DIFF_TYPE_COLOR[diff.diffType]} /></ListItemIcon>
                          <ListItemText
                            primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="subtitle2" fontWeight="bold">{diff.description}</Typography>
                              <Chip label={DIFF_TYPE_LABEL[diff.diffType]} size="small" color={DIFF_TYPE_COLOR[diff.diffType]} variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
                            </Box>}
                            secondary={<Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {diff.tokiValue && <Box sx={{ p: 1, bgcolor: '#e3f2fd', borderRadius: 1, borderLeft: '3px solid #1565c0' }}><Typography variant="caption" color="#1565c0" fontWeight="bold">謄本：</Typography><Typography variant="body2">{diff.tokiValue}</Typography></Box>}
                              {diff.kazeiValue && <Box sx={{ p: 1, bgcolor: '#fff3e0', borderRadius: 1, borderLeft: '3px solid #e65100' }}><Typography variant="caption" color="#e65100" fontWeight="bold">公課証明：</Typography><Typography variant="body2">{diff.kazeiValue}</Typography></Box>}
                            </Box>} />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </>
              )}
            </Paper>
          )}

          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {tokiData && <Paper variant="outlined" sx={{ p: 1.5, flex: 1, minWidth: 200 }}>
              <Typography variant="caption" color="#1565c0" fontWeight="bold">📄 謄本 読み取り内容</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>土地: {tokiData.lands.length}筆　建物: {tokiData.buildings.filter((b) => !b.isAttached).length}棟　付属: {tokiData.buildings.filter((b) => b.isAttached).length}棟</Typography>
            </Paper>}
            {kazeiData && <Paper variant="outlined" sx={{ p: 1.5, flex: 1, minWidth: 200 }}>
              <Typography variant="caption" color="#e65100" fontWeight="bold">📄 公課証明 読み取り内容</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>土地: {kazeiData.lands.length}筆　建物: {kazeiData.buildings.filter((b) => !b.isAttached).length}棟　付属: {kazeiData.buildings.filter((b) => b.isAttached).length}棟</Typography>
            </Paper>}
          </Box>
        </Box>
      )}

      {/* ImageSelectorModal（謄本用） */}
      <ImageSelectorModal
        open={selectorOpen === 'toki'}
        onConfirm={handleSelectorConfirm('toki')}
        onCancel={() => setSelectorOpen(null)}
        initialSelected={tokiImages}
      />

      {/* ImageSelectorModal（公課証明用） */}
      <ImageSelectorModal
        open={selectorOpen === 'kazei'}
        onConfirm={handleSelectorConfirm('kazei')}
        onCancel={() => setSelectorOpen(null)}
        initialSelected={kazeiImages}
      />

      <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert>
      </Snackbar>
    </Box>
  );
};

export default KoteiKazeiComparePage;
