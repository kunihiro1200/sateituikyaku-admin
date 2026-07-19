import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PrintIcon from '@mui/icons-material/Print';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

/** ドラッグ可能な行コンポーネント */
interface SortableItemProps {
  id: string;
  index: number;
  value: string;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  readOnly: boolean;
  canRemove: boolean;
  placeholder: string;
  bgColor: string;
}

const SortableItem: React.FC<SortableItemProps> = ({
  id,
  index,
  value,
  onChange,
  onRemove,
  readOnly,
  canRemove,
  placeholder,
  bgColor,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}
    >
      {!readOnly && (
        <IconButton
          size="small"
          {...attributes}
          {...listeners}
          sx={{ cursor: 'grab', color: 'text.secondary', '&:active': { cursor: 'grabbing' } }}
        >
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
      )}
      <Typography sx={{ minWidth: 28, fontWeight: 'bold', fontSize: '0.9rem' }}>
        {index + 1}
      </Typography>
      <TextField
        fullWidth
        size="small"
        value={value}
        onChange={(e) => onChange(index, e.target.value)}
        disabled={readOnly}
        placeholder={placeholder}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: bgColor,
          }
        }}
      />
      {!readOnly && canRemove && (
        <IconButton size="small" onClick={() => onRemove(index)} sx={{ color: 'text.secondary' }}>
          <RemoveCircleOutlineIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

/**
 * おすすめポイント印刷用HTML生成（お客様提出用・カラーデザイン版）
 */
function generateEvaluationPrintHtml(
  allPoints: string[],
  allCautions: string[],
  propertyAddress: string,
  isFukuoka: boolean,
): string {
  const pointRows = allPoints.map((p, i) => `
    <div class="point-row">
      <div class="point-number">${i + 1}</div>
      <div class="point-text">${p}</div>
    </div>
  `).join('');

  const cautionRows = allCautions.map((c, i) => `
    <div class="caution-row">
      <div class="caution-number">${i + 1}</div>
      <div class="caution-text">${c}</div>
    </div>
  `).join('');

  const companyName = isFukuoka ? '株式会社くじら不動産' : '株式会社いふう';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>おすすめポイント - ${propertyAddress}</title>
  <style>
    @page { margin: 12mm 15mm 20mm 15mm; size: A4; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    body {
      font-family: 'Hiragino Kaku Gothic Pro', 'Yu Gothic', 'MS Gothic', sans-serif;
      margin: 0;
      padding: 0;
      color: #2C2C2C;
      line-height: 1.5;
    }
    .page-wrapper {
      padding: 10px 20px;
    }
    /* ヘッダー */
    .header-area {
      background: linear-gradient(135deg, #1B2A4A, #2C3E6B) !important;
      border-radius: 8px;
      padding: 14px 24px;
      margin-bottom: 14px;
      border: 2px solid #B8860B;
    }
    .header-title {
      font-size: 20pt;
      font-weight: bold;
      color: #DAA520 !important;
      margin: 0;
    }
    .header-subtitle {
      font-size: 9pt;
      color: #E8D5A3 !important;
      margin-top: 2px;
      font-weight: bold;
    }
    /* 物件情報 */
    .property-info {
      background: #F7F5F0 !important;
      border-left: 4px solid #B8860B;
      padding: 10px 16px;
      margin-bottom: 12px;
      border-radius: 0 6px 6px 0;
    }
    .property-label {
      font-size: 9pt;
      color: #666;
      margin-bottom: 2px;
    }
    .property-address {
      font-size: 12pt;
      font-weight: bold;
      color: #1B2A4A;
    }
    .description {
      font-size: 10pt;
      color: #555;
      margin-bottom: 16px;
      padding-left: 4px;
    }
    /* おすすめポイント */
    .points-section {
      margin-bottom: 20px;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #B8860B;
    }
    .section-header-icon {
      width: 24px;
      height: 24px;
      background: #1B2A4A !important;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #DAA520 !important;
      font-size: 14px;
      font-weight: bold;
    }
    .section-header-text {
      font-size: 12pt;
      font-weight: bold;
      color: #1B2A4A;
    }
    .point-row {
      display: flex;
      align-items: flex-start;
      padding: 8px 8px;
      margin-bottom: 4px;
      border-radius: 6px;
      background: #FAFAF7 !important;
      border-left: 4px solid #B8860B;
    }
    .point-row:nth-child(even) {
      background: #F5F3ED !important;
    }
    .point-number {
      min-width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #1B2A4A, #2C3E6B) !important;
      color: #DAA520 !important;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 11pt;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .point-text {
      font-size: 10.5pt;
      color: #2C2C2C;
      padding-top: 4px;
      line-height: 1.6;
    }
    /* 注意点 */
    .caution-section {
      margin-top: 20px;
    }
    .caution-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #8B4513;
    }
    .caution-header-icon {
      width: 24px;
      height: 24px;
      background: #8B4513 !important;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff !important;
      font-size: 14px;
      font-weight: bold;
    }
    .caution-header-text {
      font-size: 11pt;
      font-weight: bold;
      color: #8B4513;
    }
    .caution-row {
      display: flex;
      align-items: flex-start;
      padding: 7px 8px;
      margin-bottom: 4px;
      border-radius: 6px;
      background: #FDF8F3 !important;
      border-left: 4px solid #8B4513;
    }
    .caution-row:nth-child(even) {
      background: #F9F0E7 !important;
    }
    .caution-number {
      min-width: 24px;
      height: 24px;
      background: #8B4513 !important;
      color: #fff !important;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 10pt;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .caution-text {
      font-size: 10pt;
      color: #3E2723;
      padding-top: 2px;
      line-height: 1.5;
    }
    /* 会社情報（サブタイトル行の右端） */
    .header-subtitle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 2px;
    }
    .header-company-name {
      font-size: 9pt;
      font-weight: bold;
      color: #E8D5A3 !important;
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <div class="header-area">
      <div class="header-title">物件の評価ポイント！おすすめポイント！</div>
      <div class="header-subtitle-row">
        <div class="header-subtitle">＊下記内容を中心に物件の特長や魅力についてお伝えいたします</div>
        <div class="header-company-name">${companyName}</div>
      </div>
    </div>

    <div class="property-info">
      <div class="property-label">物件</div>
      <div class="property-address">${propertyAddress}</div>
    </div>

    <div class="points-section">
      <div class="section-header">
        <div class="section-header-icon">★</div>
        <div class="section-header-text">おすすめポイント</div>
      </div>
      ${pointRows}
    </div>

    ${allCautions.length > 0 ? `
    <div class="caution-section">
      <div class="caution-header">
        <div class="caution-header-icon">！</div>
        <div class="caution-header-text">注意点（告知事項等）</div>
      </div>
      ${cautionRows}
    </div>
    ` : ''}

  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

interface EvaluationPointsEditorProps {
  sellerId: string;
  propertyAddress?: string;
  sellerNumber?: string;
  readOnly?: boolean;
}

interface SaveData {
  point_1: string | null;
  point_2: string | null;
  point_3: string | null;
  point_4: string | null;
  point_5: string | null;
  point_6: string | null;
  point_7: string | null;
  point_8: string | null;
  point_9: string | null;
  point_10: string | null;
  caution_1: string | null;
  caution_2: string | null;
  caution_3: string | null;
  caution_4: string | null;
  extra_points: string[];
  extra_cautions: string[];
}

export const EvaluationPointsEditor: React.FC<EvaluationPointsEditorProps> = ({
  sellerId,
  propertyAddress,
  sellerNumber,
  readOnly = false,
}) => {
  // おすすめポイントを配列で管理（初期10行）
  const [points, setPoints] = useState<string[]>(Array(10).fill(''));
  // 注意点を配列で管理（初期4行）
  const [cautions, setCautions] = useState<string[]>(Array(4).fill(''));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { user } = useAuthStore();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/api/sellers/${sellerId}/evaluation-points`);
      const d = res.data;

      // 固定10ポイント + 追加分
      const basePoints = [
        d.point_1 || '', d.point_2 || '', d.point_3 || '', d.point_4 || '', d.point_5 || '',
        d.point_6 || '', d.point_7 || '', d.point_8 || '', d.point_9 || '', d.point_10 || '',
      ];
      const extraPoints: string[] = d.extra_points || [];
      setPoints([...basePoints, ...extraPoints]);

      // 固定4注意点 + 追加分
      const baseCautions = [d.caution_1 || '', d.caution_2 || '', d.caution_3 || '', d.caution_4 || ''];
      const extraCautions: string[] = d.extra_cautions || [];
      setCautions([...baseCautions, ...extraCautions]);
    } catch (err: any) {
      console.error('Failed to fetch evaluation points:', err);
      setError('評価ポイントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    if (sellerId) fetchData();
  }, [sellerId, fetchData]);

  const handlePointChange = (index: number, value: string) => {
    setPoints(prev => { const next = [...prev]; next[index] = value; return next; });
    setIsDirty(true);
    setSuccess(false);
  };

  const handleCautionChange = (index: number, value: string) => {
    setCautions(prev => { const next = [...prev]; next[index] = value; return next; });
    setIsDirty(true);
    setSuccess(false);
  };

  const addPoint = () => {
    setPoints(prev => [...prev, '']);
    setIsDirty(true);
  };

  const removePoint = (index: number) => {
    if (points.length <= 1) return;
    setPoints(prev => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const addCaution = () => {
    setCautions(prev => [...prev, '']);
    setIsDirty(true);
  };

  const removeCaution = (index: number) => {
    if (cautions.length <= 1) return;
    setCautions(prev => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  // ドラッグ&ドロップ
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const pointIds = points.map((_, i) => `point-${i}`);
  const cautionIds = cautions.map((_, i) => `caution-${i}`);

  const handlePointDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pointIds.indexOf(active.id as string);
    const newIndex = pointIds.indexOf(over.id as string);
    setPoints(prev => arrayMove(prev, oldIndex, newIndex));
    setIsDirty(true);
  };

  const handleCautionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cautionIds.indexOf(active.id as string);
    const newIndex = cautionIds.indexOf(over.id as string);
    setCautions(prev => arrayMove(prev, oldIndex, newIndex));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // 固定10 + 追加分に分ける
      const saveData: SaveData = {
        point_1: points[0] || null,
        point_2: points[1] || null,
        point_3: points[2] || null,
        point_4: points[3] || null,
        point_5: points[4] || null,
        point_6: points[5] || null,
        point_7: points[6] || null,
        point_8: points[7] || null,
        point_9: points[8] || null,
        point_10: points[9] || null,
        caution_1: cautions[0] || null,
        caution_2: cautions[1] || null,
        caution_3: cautions[2] || null,
        caution_4: cautions[3] || null,
        extra_points: points.slice(10).filter(p => p.trim() !== ''),
        extra_cautions: cautions.slice(4).filter(c => c.trim() !== ''),
      };

      await api.put(`/api/sellers/${sellerId}/evaluation-points`, {
        ...saveData,
        updated_by: user?.name || user?.email || null,
      });
      setSuccess(true);
      setIsDirty(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save evaluation points:', err);
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  /** 印刷用ウィンドウを開く */
  const handlePrint = () => {
    const allPoints = points.filter(p => p.trim() !== '');
    const allCautions = cautions.filter(c => c.trim() !== '');
    const isFukuoka = sellerNumber?.startsWith('FI');
    const html = generateEvaluationPrintHtml(allPoints, allCautions, propertyAddress || '', !!isFukuoka);

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 1 }}>
      {/* ヘッダー */}
      <Box sx={{
        bgcolor: '#FFFF00',
        px: 2,
        py: 1,
        mb: 2,
        borderRadius: 1,
        display: 'inline-block',
      }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
          物件の評価ポイント！おすすめポイント！
        </Typography>
      </Box>

      {/* 物件名 */}
      {propertyAddress && (
        <Typography sx={{ fontWeight: 'bold', mb: 2, fontSize: '0.95rem' }}>
          物件：{propertyAddress}
        </Typography>
      )}

      <Typography sx={{ mb: 2, fontSize: '0.85rem', color: 'text.secondary' }}>
        ＊下記内容を中心に物件の特長や魅力についてお伝えいたします！
      </Typography>

      {/* おすすめポイント */}
      <Box sx={{ mb: 2 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePointDragEnd}>
          <SortableContext items={pointIds} strategy={verticalListSortingStrategy}>
            {points.map((value, index) => (
              <SortableItem
                key={pointIds[index]}
                id={pointIds[index]}
                index={index}
                value={value}
                onChange={handlePointChange}
                onRemove={removePoint}
                readOnly={readOnly}
                canRemove={points.length > 1}
                placeholder={`おすすめポイント${index + 1}`}
                bgColor="#FFF8E1"
              />
            ))}
          </SortableContext>
        </DndContext>
        {!readOnly && (
          <Button
            size="small"
            startIcon={<AddCircleOutlineIcon />}
            onClick={addPoint}
            sx={{ ml: 4 }}
          >
            行を追加
          </Button>
        )}
      </Box>

      {/* 注意点セクション */}
      <Divider sx={{ my: 2 }} />
      <Typography sx={{ fontWeight: 'bold', mb: 1.5, fontSize: '0.95rem' }}>
        ・注意点(告知事項等）
      </Typography>

      <Box sx={{ mb: 2 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCautionDragEnd}>
          <SortableContext items={cautionIds} strategy={verticalListSortingStrategy}>
            {cautions.map((value, index) => (
              <SortableItem
                key={cautionIds[index]}
                id={cautionIds[index]}
                index={index}
                value={value}
                onChange={handleCautionChange}
                onRemove={removeCaution}
                readOnly={readOnly}
                canRemove={cautions.length > 1}
                placeholder={`注意点${index + 1}`}
                bgColor="#FFECB3"
              />
            ))}
          </SortableContext>
        </DndContext>
        {!readOnly && (
          <Button
            size="small"
            startIcon={<AddCircleOutlineIcon />}
            onClick={addCaution}
            sx={{ ml: 4 }}
          >
            行を追加
          </Button>
        )}
      </Box>

      {/* エラー・成功メッセージ */}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1 }}>保存しました</Alert>}

      {/* 保存・印刷ボタン */}
      {!readOnly && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
            印刷
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !isDirty}
            color={isDirty ? 'primary' : 'inherit'}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

/** 読み取り専用の評価ポイント表示（買主ページ用） */
export const EvaluationPointsDisplay: React.FC<{
  sellerNumber: string;
  propertyAddress?: string;
}> = ({ sellerNumber, propertyAddress }) => {
  const [points, setPoints] = useState<string[]>([]);
  const [cautions, setCautions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEval = async () => {
      try {
        const res = await api.get(`/api/evaluation-points/by-seller-number/${sellerNumber}`);
        if (res.data) {
          const d = res.data;
          const basePoints = [
            d.point_1, d.point_2, d.point_3, d.point_4, d.point_5,
            d.point_6, d.point_7, d.point_8, d.point_9, d.point_10,
          ].filter(Boolean) as string[];
          const extraPts: string[] = d.extra_points || [];
          setPoints([...basePoints, ...extraPts]);

          const baseCautions = [d.caution_1, d.caution_2, d.caution_3, d.caution_4].filter(Boolean) as string[];
          const extraCau: string[] = d.extra_cautions || [];
          setCautions([...baseCautions, ...extraCau]);
        }
      } catch (err) {
        console.error('Failed to fetch evaluation points for buyer page:', err);
      } finally {
        setLoading(false);
      }
    };
    if (sellerNumber) fetchEval();
  }, [sellerNumber]);

  const handlePrint = () => {
    const isFukuoka = sellerNumber?.startsWith('FI');
    const html = generateEvaluationPrintHtml(points, cautions, propertyAddress || '', !!isFukuoka);

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  if (loading) return <CircularProgress size={16} />;
  if (points.length === 0 && cautions.length === 0) {
    return <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>評価ポイント未入力</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
        印刷
      </Button>
    </Box>
  );
};

export default EvaluationPointsEditor;
