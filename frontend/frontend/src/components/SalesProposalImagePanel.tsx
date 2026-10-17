/**
 * 販売提案書作成モーダル用 画像添付パネル
 *
 * 機能：
 *   - PNG/JPG/JPEG/WebP ドラッグ&ドロップ・複数一括選択（最大10枚）
 *   - サムネイルグリッド表示
 *   - @dnd-kit/sortable による並べ替え
 *   - 種別セレクト（現地写真/外観/室内/周辺施設/Google Map/その他）
 *   - 説明テキスト入力（任意）
 *   - 削除ボタン
 *
 * 注意：
 *   - 画像はブラウザメモリ内のみ管理（サーバーアップロードなし）
 *   - previewUrl は URL.createObjectURL() で生成 → モーダルを閉じる際に revoke すること
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Box, Typography, IconButton, TextField, Select, MenuItem,
  FormControl, Tooltip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  AddPhotoAlternate as AddPhotoIcon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── 定数 ─────────────────────────────────────────────────────────────────────
const IMAGE_TYPES = ['現地写真', '外観', '室内', '周辺施設', 'Google Map', 'その他'] as const;
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';
export const MAX_PROPOSAL_IMAGES = 10;

// ─── 型定義 ───────────────────────────────────────────────────────────────────
export interface ProposalImage {
  id: string;
  file: File;
  previewUrl: string;           // URL.createObjectURL() の返り値
  type: (typeof IMAGE_TYPES)[number];
  description: string;
}

// ─── 各サムネイルカード（Sortable対応） ─────────────────────────────────────
interface CardProps {
  image: ProposalImage;
  index: number;
  onRemove: (id: string) => void;
  onTypeChange: (id: string, type: ProposalImage['type']) => void;
  onDescriptionChange: (id: string, desc: string) => void;
}

function SortableImageCard({ image, index, onRemove, onTypeChange, onDescriptionChange }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: image.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        position: 'relative',
        border: '1px solid #d0d7de',
        borderRadius: 1,
        p: 0.75,
        bgcolor: 'white',
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
      }}
    >
      {/* 番号バッジ */}
      <Box
        sx={{
          position: 'absolute', top: 4, left: 24,
          bgcolor: 'rgba(0,0,0,0.55)', color: 'white',
          borderRadius: '50%', width: 18, height: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 'bold', zIndex: 2,
        }}
      >
        {index + 1}
      </Box>

      {/* ドラッグハンドル */}
      <Box
        {...attributes}
        {...listeners}
        sx={{
          position: 'absolute', top: 4, left: 4, zIndex: 3,
          cursor: 'grab', color: '#bdbdbd',
          '&:hover': { color: '#616161' },
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <DragIcon sx={{ fontSize: 16 }} />
      </Box>

      {/* 削除ボタン */}
      <Tooltip title="削除">
        <IconButton
          size="small"
          onClick={() => onRemove(image.id)}
          sx={{
            position: 'absolute', top: 2, right: 2, zIndex: 3,
            width: 22, height: 22,
            bgcolor: 'rgba(255,255,255,0.85)',
            '&:hover': { bgcolor: 'rgba(244,67,54,0.1)' },
          }}
        >
          <DeleteIcon sx={{ fontSize: 14, color: '#f44336' }} />
        </IconButton>
      </Tooltip>

      {/* サムネイル */}
      <Box sx={{ mt: 0.5, mb: 0.75 }}>
        <img
          src={image.previewUrl}
          alt={image.description || image.type}
          style={{
            width: '100%',
            height: 90,
            objectFit: 'cover',
            borderRadius: 3,
            display: 'block',
          }}
        />
      </Box>

      {/* ファイル名 */}
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: '#757575',
          fontSize: '0.65rem',
          mb: 0.5,
        }}
        title={image.file.name}
      >
        {image.file.name}
      </Typography>

      {/* 種別セレクト */}
      <FormControl size="small" fullWidth sx={{ mb: 0.5 }}>
        <Select
          value={image.type}
          onChange={e => onTypeChange(image.id, e.target.value as ProposalImage['type'])}
          sx={{ fontSize: '0.72rem', '& .MuiSelect-select': { py: 0.4 } }}
        >
          {IMAGE_TYPES.map(t => (
            <MenuItem key={t} value={t} sx={{ fontSize: '0.72rem' }}>
              {t}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 説明テキスト */}
      <TextField
        size="small"
        fullWidth
        placeholder="説明（任意）"
        value={image.description}
        onChange={e => onDescriptionChange(image.id, e.target.value)}
        inputProps={{ style: { fontSize: '0.72rem', padding: '3px 6px' } }}
      />
    </Box>
  );
}

// ─── メインコンポーネント ──────────────────────────────────────────────────────
interface Props {
  images: ProposalImage[];
  onImagesChange: (images: ProposalImage[]) => void;
}

export default function SalesProposalImagePanel({ images, onImagesChange }: Props) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ─── ファイルを追加（重複・上限チェック） ──────────────────────────────────
  const addFiles = useCallback((rawFiles: File[]) => {
    const remaining = MAX_PROPOSAL_IMAGES - images.length;
    if (remaining <= 0) return;

    const valid = rawFiles
      .filter(f => ACCEPTED_MIME.includes(f.type))
      .slice(0, remaining);

    if (valid.length === 0) return;

    const newImages: ProposalImage[] = valid.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      type: '現地写真',
      description: '',
    }));

    onImagesChange([...images, ...newImages]);
  }, [images, onImagesChange]);

  // ─── ファイル入力ハンドラ ───────────────────────────────────────────────────
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addFiles(files);
    e.target.value = '';
  };

  // ─── ドロップゾーン ────────────────────────────────────────────────────────
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) addFiles(files);
  };

  // ─── dnd-kit 並べ替え ──────────────────────────────────────────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex(img => img.id === active.id);
    const newIndex = images.findIndex(img => img.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onImagesChange(arrayMove(images, oldIndex, newIndex));
    }
  };

  const handleRemove = useCallback((id: string) => {
    const img = images.find(i => i.id === id);
    if (img) URL.revokeObjectURL(img.previewUrl);
    onImagesChange(images.filter(i => i.id !== id));
  }, [images, onImagesChange]);

  const handleTypeChange = useCallback((id: string, type: ProposalImage['type']) => {
    onImagesChange(images.map(i => i.id === id ? { ...i, type } : i));
  }, [images, onImagesChange]);

  const handleDescriptionChange = useCallback((id: string, desc: string) => {
    onImagesChange(images.map(i => i.id === id ? { ...i, description: desc } : i));
  }, [images, onImagesChange]);

  const canAdd = images.length < MAX_PROPOSAL_IMAGES;

  return (
    <Box>
      {/* ドロップゾーン */}
      <Box
        onClick={() => canAdd && fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (canAdd) setIsDraggingOver(true); }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        sx={{
          border: `2px dashed ${isDraggingOver ? '#1976d2' : '#ccc'}`,
          borderRadius: 1,
          p: 1.5,
          textAlign: 'center',
          cursor: canAdd ? 'pointer' : 'default',
          bgcolor: isDraggingOver ? '#e3f2fd' : '#fafafa',
          mb: images.length > 0 ? 1.5 : 0,
          transition: 'border-color 0.2s, background-color 0.2s',
          '&:hover': canAdd
            ? { bgcolor: '#f0f8ff', borderColor: '#90caf9' }
            : {},
        }}
      >
        <AddPhotoIcon sx={{ color: '#b0bec5', fontSize: 28, mb: 0.25 }} />
        <Typography variant="body2" sx={{ color: '#78909c', fontSize: '0.78rem', lineHeight: 1.4 }}>
          {canAdd
            ? 'クリックまたはドラッグ&ドロップ'
            : `最大${MAX_PROPOSAL_IMAGES}枚に達しました`}
        </Typography>
        <Typography variant="caption" sx={{ color: '#90a4ae' }}>
          {canAdd
            ? `PNG / JPG / WebP（最大${MAX_PROPOSAL_IMAGES}枚・複数選択可）`
            : ''}
          {images.length > 0 && canAdd && ` ─ 現在 ${images.length} / ${MAX_PROPOSAL_IMAGES} 枚`}
        </Typography>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </Box>

      {/* サムネイルグリッド（dnd-kit Sortable） */}
      {images.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map(img => img.id)}
            strategy={rectSortingStrategy}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1,
              }}
            >
              {images.map((image, index) => (
                <SortableImageCard
                  key={image.id}
                  image={image}
                  index={index}
                  onRemove={handleRemove}
                  onTypeChange={handleTypeChange}
                  onDescriptionChange={handleDescriptionChange}
                />
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      )}
    </Box>
  );
}
