/**
 * 画像内の会社情報を手動矩形選択→白塗り→当社テキスト描画するコンポーネント
 * TashaPropertyPanelから呼び出される
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon, Undo as UndoIcon } from '@mui/icons-material';
import api from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName: string;
  propertyNumber: string;
  ownCompanyLines: string[];
  onReplaced: () => void;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ImageCompanyReplacer({
  open, onClose, imageUrl, imageName, propertyNumber, ownCompanyLines, onReplaced,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // 画像を読み込んでCanvasに描画
  useEffect(() => {
    if (!open || !imageUrl) return;
    setImgLoaded(false);
    setRects([]);
    setPreviewMode(false);
    setError(null);

    // CORS回避: fetchでBlobとして取得し、objectURLで読み込む
    fetch(imageUrl)
      .then(res => res.blob())
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          imgRef.current = img;
          drawCanvas(img, []);
          setImgLoaded(true);
        };
        img.onerror = () => setError('画像の読み込みに失敗しました');
        img.src = objectUrl;
      })
      .catch(() => setError('画像の取得に失敗しました'));
  }, [open, imageUrl]);

  const drawCanvas = useCallback((img: HTMLImageElement, rectsToDraw: Rect[], tempRect?: Rect) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvasサイズを画像に合わせる（表示は縮小）
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;

    // 元画像を描画
    ctx.drawImage(img, 0, 0);

    // 確定済み矩形を白塗り＋テキスト描画
    rectsToDraw.forEach(rect => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      // テキスト描画（矩形内に収まるサイズで）
      const maxFontSize = Math.floor(rect.height / (ownCompanyLines.length * 1.6));
      const maxFontByWidth = Math.floor(rect.width / 20); // 幅から推定
      const fontSize = Math.min(maxFontSize, maxFontByWidth, 24); // 最大24px
      ctx.fillStyle = '#000000';
      ctx.font = `${fontSize}px sans-serif`;
      const lineH = fontSize * 1.5;
      const startY = rect.y + fontSize + 4;
      ownCompanyLines.forEach((line, i) => {
        ctx.fillText(line, rect.x + 6, startY + i * lineH);
      });
    });

    // ドラッグ中の矩形（赤い点線）
    if (tempRect) {
      ctx.strokeStyle = '#d32f2f';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(tempRect.x, tempRect.y, tempRect.width, tempRect.height);
      ctx.setLineDash([]);
      // 半透明の白
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(tempRect.x, tempRect.y, tempRect.width, tempRect.height);
    }
  }, [ownCompanyLines]);

  // Canvas座標を取得
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // 表示サイズと実サイズの比率（CSSで縮小されている場合を考慮）
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (previewMode) return;
    const pos = getCanvasCoords(e);
    setStartPos(pos);
    setDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !startPos || previewMode) return;
    const pos = getCanvasCoords(e);
    const rect: Rect = {
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
    };
    setCurrentRect(rect);
    if (imgRef.current) drawCanvas(imgRef.current, rects, rect);
  };

  const handleMouseUp = () => {
    if (!drawing || !currentRect || previewMode) {
      setDrawing(false);
      return;
    }
    // 最小サイズチェック（小さすぎるクリックは無視）
    if (currentRect.width > 20 && currentRect.height > 20) {
      const newRects = [...rects, currentRect];
      setRects(newRects);
      if (imgRef.current) drawCanvas(imgRef.current, newRects);
    }
    setCurrentRect(null);
    setDrawing(false);
    setStartPos(null);
  };

  const handleUndo = () => {
    const newRects = rects.slice(0, -1);
    setRects(newRects);
    if (imgRef.current) drawCanvas(imgRef.current, newRects);
  };

  const handlePreview = () => {
    setPreviewMode(true);
    if (imgRef.current) drawCanvas(imgRef.current, rects);
  };

  const handleSave = async () => {
    if (!imgRef.current || rects.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      // 保存用に新しいCanvasで確実に再描画
      const img = imgRef.current;
      const saveCanvas = document.createElement('canvas');
      saveCanvas.width = img.width;
      saveCanvas.height = img.height;
      const ctx = saveCanvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      // 全矩形を白塗り＋テキスト描画
      rects.forEach(rect => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        const maxFontSize = Math.floor(rect.height / (ownCompanyLines.length * 1.6));
        const maxFontByWidth = Math.floor(rect.width / 20);
        const fontSize = Math.min(maxFontSize, maxFontByWidth, 24);
        ctx.fillStyle = '#000000';
        ctx.font = `${fontSize}px sans-serif`;
        const lineH = fontSize * 1.5;
        const startY = rect.y + fontSize + 4;
        ownCompanyLines.forEach((line, i) => {
          ctx.fillText(line, rect.x + 6, startY + i * lineH);
        });
      });

      const dataUrl = saveCanvas.toDataURL('image/jpeg', 0.92);
      const base64 = dataUrl.split(',')[1];
      await api.post(`/api/ai/tasha-property-image/${propertyNumber}`, {
        imageBase64: base64,
        mediaType: 'image/jpeg',
        fileName: imageName.replace(/\.[^.]+$/, '_replaced.jpg'),
      });
      onReplaced();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight="bold">
          会社情報を差し替え — マウスドラッグで範囲選択
        </Typography>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        {!previewMode && (
          <Alert severity="info" sx={{ mb: 2 }}>
            画像内の会社情報エリアをマウスでドラッグして囲んでください。囲んだ部分が白塗り→当社情報に差し替えられます。
          </Alert>
        )}
        {previewMode && (
          <Alert severity="success" sx={{ mb: 2 }}>
            プレビュー中です。問題なければ「保存」を押してください。
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ position: 'relative', textAlign: 'center', overflow: 'auto', maxHeight: '65vh' }}>
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              cursor: previewMode ? 'default' : 'crosshair',
              border: '1px solid #ccc',
              display: imgLoaded ? 'inline-block' : 'none',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          {!imgLoaded && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!previewMode ? (
          <>
            <Button onClick={handleUndo} disabled={rects.length === 0} startIcon={<UndoIcon />}>
              元に戻す
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1, textAlign: 'center' }}>
              {rects.length > 0 ? `${rects.length}箇所選択済み` : '範囲を選択してください'}
            </Typography>
            <Button onClick={onClose}>キャンセル</Button>
            <Button
              variant="contained"
              disabled={rects.length === 0}
              onClick={handlePreview}
              sx={{ bgcolor: '#7b1fa2', '&:hover': { bgcolor: '#6a1b9a' } }}
            >
              プレビュー
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => { setPreviewMode(false); if (imgRef.current) drawCanvas(imgRef.current, rects); }}>
              戻って修正
            </Button>
            <Button onClick={onClose}>キャンセル</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
            >
              {saving ? '保存中...' : '保存する'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
