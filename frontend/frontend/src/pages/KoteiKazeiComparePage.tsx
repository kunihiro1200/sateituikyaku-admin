import React, { useState, useCallback } from 'react';
import {
  Box, Button, Typography, Paper, CircularProgress, Alert, Chip,
  Divider, List, ListItem, ListItemIcon, ListItemText,
  LinearProgress, Snackbar, Grid, Tab, Tabs,
  IconButton, Tooltip,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SearchIcon from '@mui/icons-material/Search';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import LandscapeIcon from '@mui/icons-material/Landscape';
import HomeIcon from '@mui/icons-material/Home';
import FolderIcon from '@mui/icons-material/Folder';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

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

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
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
    const base64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
    pages.push({ name: `${file.name}_p${i}.jpg`, mimeType: 'image/jpeg', base64 });
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

async function localFilesToPayloads(files: File[], onProgress: (msg: string) => void): Promise<FilePayload[]> {
  const payloads: FilePayload[] = [];
  for (const file of files) {
    if (file.type === 'application/pdf') {
      onProgress(`PDFを変換中: ${file.name}`);
      const chunks = await splitPdfIntoChunks(file, MAX_BYTES_PER_REQUEST);
      for (const chunk of chunks) payloads.push(...chunk);
    } else {
      onProgress(`ファイルを準備中: ${file.name}`);
      payloads.push({ name: file.name, mimeType: file.type, base64: await fileToBase64(file) });
    }
  }
  return payloads;
}

async function driveFileToPayload(fileId: string, fileName: string): Promise<FilePayload> {
  const res = await api.get(`/api/drive/files/${fileId}/base64`);
  const { base64, mimeType } = res.data;
  return { name: fileName, mimeType, base64 };
}

const DIFF_TYPE_LABEL: Record<DiffItem['diffType'], string> = {
  only_in_toki: '謄本にのみ存在', only_in_kazei: '公課証明にのみ存在',
  area_mismatch: '面積が異なる', type_mismatch: '地目が異なる',
  attached_building: '付属建物の不一致',
};
const DIFF_TYPE_COLOR: Record<DiffItem['diffType'], 'error' | 'warning' | 'info'> = {
  only_in_toki: 'error', only_in_kazei: 'error',
  area_mismatch: 'warning', type_mismatch: 'warning', attached_building: 'info',
};

// ローカルファイルのドロップゾーン
const LocalDropZone: React.FC<{
  id: string; label: string; color: string;
  files: File[]; onAdd: (f: FileList | null) => void; onRemove: (i: number) => void;
}> = ({ id, label, color, files, onAdd, onRemove }) => {
  const [dragOver, setDragOver] = useState(false);
  return (
    <Box>
      <Paper variant="outlined" sx={{
        p: 2, textAlign: 'center', cursor: 'pointer',
        border: dragOver ? `2px dashed ${color}` : '2px dashed #ccc',
        backgroundColor: dragOver ? '#f5f5f5' : '#fafafa', transition: 'all 0.2s',
      }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onAdd(e.dataTransfer.files); }}
        onClick={() => document.getElementById(id)?.click()}
      >
        <input id={id} type="file" multiple
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          style={{ display: 'none' }} onChange={(e) => onAdd(e.target.files)} />
        <UploadFileIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary" fontWeight="bold">{label}</Typography>
        <Typography variant="caption" color="text.disabled">PDF・画像（複数可）</Typography>
      </Paper>
      {files.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {files.map((f, i) => (
            <Chip key={i} size="small"
              icon={f.type === 'application/pdf' ? <PictureAsPdfIcon /> : <ImageIcon />}
              label={`${f.name} (${(f.size / 1024).toFixed(0)}KB)`}
              onDelete={() => onRemove(i)} color={f.type === 'application/pdf' ? 'error' : 'default'} variant="outlined" />
          ))}
        </Box>
      )}
    </Box>
  );
};

// Google Driveファイル選択UI
const DriveFileSelector: React.FC<{
  label: string; color: string; storageUrl: string | null;
  selectedIds: string[]; onToggle: (file: DriveFile) => void;
}> = ({ label, color, storageUrl, selectedIds, onToggle }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    if (!storageUrl) { setError('格納先URLが設定されていません'); return; }
    // /folders/FOLDER_ID 形式でフォルダIDを抽出（GoogleDriveServiceと同じ正規表現）
    const match = storageUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const folderId = match ? match[1] : null;
    if (!folderId) { setError('格納先URLからフォルダIDを取得できませんでした'); return; }
    setLoading(true); setError(null);
    try {
      const res = await api.get('/api/drive/folders/contents', { params: { folderId } });
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const filtered = (res.data.files || []).filter((f: DriveFile) => allowed.includes(f.mimeType));
      setFiles(filtered);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [storageUrl]);

  React.useEffect(() => { loadFiles(); }, [loadFiles]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <FolderIcon sx={{ color }} />
        <Typography variant="body2" fontWeight="bold" color={color}>{label}</Typography>
        <Tooltip title="再読み込み"><IconButton size="small" onClick={loadFiles}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
      </Box>
      {!storageUrl && <Alert severity="warning" sx={{ mb: 1 }}>格納先URLが設定されていません</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {loading && <CircularProgress size={20} />}
      {files.length === 0 && !loading && !error && storageUrl && (
        <Typography variant="caption" color="text.secondary">PDF・画像ファイルが見つかりません</Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 200, overflowY: 'auto' }}>
        {files.map((f) => {
          const selected = selectedIds.includes(f.id);
          return (
            <Paper key={f.id} variant="outlined" sx={{
              p: 0.8, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
              bgcolor: selected ? '#e3f2fd' : 'white',
              borderColor: selected ? color : '#ccc', borderWidth: selected ? 2 : 1,
              '&:hover': { bgcolor: '#f5f5f5' },
            }} onClick={() => onToggle(f)}>
              {f.mimeType === 'application/pdf' ? <PictureAsPdfIcon fontSize="small" color="error" /> : <ImageIcon fontSize="small" color="primary" />}
              <Typography variant="caption" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</Typography>
              {selected && <CheckCircleIcon fontSize="small" sx={{ color }} />}
            </Paper>
          );
        })}
      </Box>
      {selectedIds.length > 0 && (
        <Typography variant="caption" color={color} fontWeight="bold" sx={{ mt: 0.5, display: 'block' }}>
          {selectedIds.length}ファイル選択中
        </Typography>
      )}
    </Box>
  );
};

const KoteiKazeiComparePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyNumber = searchParams.get('propertyNumber');
  const storageUrl = searchParams.get('storageUrl');

  // 入力タブ（0=ローカル、1=Google Drive）
  const [inputTab, setInputTab] = useState(0);

  // ローカルファイル
  const [tokiFiles, setTokiFiles] = useState<File[]>([]);
  const [kazeiFiles, setKazeiFiles] = useState<File[]>([]);

  // Google DriveファイルID選択
  const [tokiDriveFiles, setTokiDriveFiles] = useState<DriveFile[]>([]);
  const [kazeiDriveFiles, setKazeiDriveFiles] = useState<DriveFile[]>([]);

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

  const addLocalFiles = useCallback((setter: React.Dispatch<React.SetStateAction<File[]>>) =>
    (newFiles: FileList | null) => {
      if (!newFiles) return;
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      const valid = Array.from(newFiles).filter((f) => allowed.includes(f.type));
      if (valid.length > 0) setter((prev) => [...prev, ...valid]);
    }, []);

  const toggleDriveFile = (setter: React.Dispatch<React.SetStateAction<DriveFile[]>>) =>
    (file: DriveFile) => setter((prev) => prev.find((f) => f.id === file.id) ? prev.filter((f) => f.id !== file.id) : [...prev, file]);

  const hasInput = inputTab === 0
    ? (tokiFiles.length > 0 && kazeiFiles.length > 0)
    : (tokiDriveFiles.length > 0 && kazeiDriveFiles.length > 0);

  const handleAnalyze = async () => {
    if (!hasInput) { setError('謄本と公課証明の両方のファイルを選択してください'); return; }
    setLoading(true); setError(null); setDiffs(null); setProgress(0);
    try {
      let tokiPayloads: FilePayload[], kazeiPayloads: FilePayload[];

      if (inputTab === 0) {
        // ローカルファイル
        setLoadingMessage('謄本を準備中...');
        tokiPayloads = await localFilesToPayloads(tokiFiles, setLoadingMessage);
        setProgress(25);
        setLoadingMessage('公課証明を準備中...');
        kazeiPayloads = await localFilesToPayloads(kazeiFiles, setLoadingMessage);
      } else {
        // Google Drive
        setLoadingMessage('Google Driveから謄本を取得中...');
        tokiPayloads = await Promise.all(tokiDriveFiles.map((f) => driveFileToPayload(f.id, f.name)));
        setProgress(25);
        setLoadingMessage('Google Driveから公課証明を取得中...');
        kazeiPayloads = await Promise.all(kazeiDriveFiles.map((f) => driveFileToPayload(f.id, f.name)));
      }

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

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button variant="outlined" size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/work-tasks')} sx={{ whiteSpace: 'nowrap' }}>業務一覧</Button>
        <Typography variant="h5" fontWeight="bold">固定資産税公課証明 比較</Typography>
        {propertyNumber && <Chip label={propertyNumber} size="small" color="primary" variant="outlined" />}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        謄本（複数枚可）と固定資産税公課証明書を読み込み、地番・面積・付属建物などの差分を自動検出します。
      </Typography>

      {/* 入力方法タブ */}
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs value={inputTab} onChange={(_, v) => setInputTab(v)} sx={{ borderBottom: '1px solid #e0e0e0' }}>
          <Tab icon={<UploadFileIcon />} iconPosition="start" label="ローカルから選ぶ" />
          <Tab icon={<CloudDownloadIcon />} iconPosition="start" label="Google Driveから選ぶ" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {inputTab === 0 ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <LocalDropZone id="toki-file-input" label="謄本（登記事項証明書）" color="#1565c0"
                  files={tokiFiles} onAdd={addLocalFiles(setTokiFiles)}
                  onRemove={(i) => setTokiFiles((p) => p.filter((_, idx) => idx !== i))} />
              </Grid>
              <Grid item xs={12} md={6}>
                <LocalDropZone id="kazei-file-input" label="固定資産税公課証明書" color="#e65100"
                  files={kazeiFiles} onAdd={addLocalFiles(setKazeiFiles)}
                  onRemove={(i) => setKazeiFiles((p) => p.filter((_, idx) => idx !== i))} />
              </Grid>
            </Grid>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <DriveFileSelector label="謄本（登記事項証明書）" color="#1565c0"
                  storageUrl={storageUrl}
                  selectedIds={tokiDriveFiles.map((f) => f.id)}
                  onToggle={toggleDriveFile(setTokiDriveFiles)} />
              </Grid>
              <Grid item xs={12} md={6}>
                <DriveFileSelector label="固定資産税公課証明書" color="#e65100"
                  storageUrl={storageUrl}
                  selectedIds={kazeiDriveFiles.map((f) => f.id)}
                  onToggle={toggleDriveFile(setKazeiDriveFiles)} />
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Button variant="contained" size="large" fullWidth
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
        onClick={handleAnalyze} disabled={loading || !hasInput}
        sx={{ mb: loading ? 1 : 3, bgcolor: '#4a148c', '&:hover': { bgcolor: '#38006b' } }}
      >
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
                    <LandscapeIcon color="warning" />
                    <Typography variant="subtitle1" fontWeight="bold">土地の差分（{landDiffs.length}件）</Typography>
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
                    <HomeIcon color="warning" />
                    <Typography variant="subtitle1" fontWeight="bold">建物の差分（{buildingDiffs.length}件）</Typography>
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

      <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert>
      </Snackbar>
    </Box>
  );
};

export default KoteiKazeiComparePage;
