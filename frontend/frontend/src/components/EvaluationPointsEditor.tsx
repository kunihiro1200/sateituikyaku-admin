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
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

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
  const companyAddress = isFukuoka
    ? '〒810-0073 福岡市中央区舞鶴3-1-10'
    : '〒870-0044 大分県大分市舞鶴町1-3-30';
  const companyTel = isFukuoka ? 'TEL:092-401-5331' : 'TEL:097-533-2022';
  const companyMail = 'mail:tenant@ifoo-oita.com';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>おすすめポイント - ${propertyAddress}</title>
  <style>
    @page { margin: 12mm 15mm 20mm 15mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Hiragino Kaku Gothic Pro', 'Yu Gothic', 'MS Gothic', sans-serif;
      margin: 0;
      padding: 0;
      color: #333;
      line-height: 1.5;
    }
    .page-wrapper {
      padding: 10px 20px;
    }
    /* ヘッダー */
    .header-area {
      background: linear-gradient(135deg, #FF8C00, #FFD700);
      border-radius: 8px;
      padding: 14px 24px;
      margin-bottom: 14px;
      box-shadow: 0 3px 8px rgba(255, 140, 0, 0.3);
    }
    .header-title {
      font-size: 20pt;
      font-weight: bold;
      color: #fff;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
      margin: 0;
    }
    .header-subtitle {
      font-size: 9pt;
      color: #fff;
      margin-top: 2px;
      opacity: 0.9;
    }
    /* 物件情報 */
    .property-info {
      background: #f8f9fa;
      border-left: 4px solid #FF8C00;
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
      color: #222;
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
      border-bottom: 2px solid #FF8C00;
    }
    .section-header-icon {
      width: 24px;
      height: 24px;
      background: #FF8C00;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 14px;
      font-weight: bold;
    }
    .section-header-text {
      font-size: 12pt;
      font-weight: bold;
      color: #333;
    }
    .point-row {
      display: flex;
      align-items: flex-start;
      padding: 8px 8px;
      margin-bottom: 4px;
      border-radius: 6px;
      background: #FFFDE7;
      border-left: 4px solid #FFB300;
    }
    .point-row:nth-child(even) {
      background: #FFF8E1;
    }
    .point-number {
      min-width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #FF8C00, #FFA726);
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 11pt;
      margin-right: 12px;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(255, 140, 0, 0.3);
    }
    .point-text {
      font-size: 10.5pt;
      color: #333;
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
      border-bottom: 2px solid #F57C00;
    }
    .caution-header-icon {
      width: 24px;
      height: 24px;
      background: #F57C00;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 14px;
      font-weight: bold;
    }
    .caution-header-text {
      font-size: 11pt;
      font-weight: bold;
      color: #E65100;
    }
    .caution-row {
      display: flex;
      align-items: flex-start;
      padding: 7px 8px;
      margin-bottom: 4px;
      border-radius: 6px;
      background: #FFF3E0;
      border-left: 4px solid #F57C00;
    }
    .caution-row:nth-child(even) {
      background: #FFE0B2;
    }
    .caution-number {
      min-width: 24px;
      height: 24px;
      background: #F57C00;
      color: #fff;
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
      color: #4E342E;
      padding-top: 2px;
      line-height: 1.5;
    }
    /* ヘッダー内の会社情報（右上配置） */
    .header-area {
      position: relative;
    }
    .header-company {
      position: absolute;
      top: 10px;
      right: 16px;
      text-align: right;
    }
    .header-company-name {
      font-size: 9pt;
      font-weight: bold;
      color: #333;
    }
    .header-company-detail {
      font-size: 7.5pt;
      color: #555;
      margin-top: 1px;
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <div class="header-area">
      <div class="header-title">物件の評価ポイント！おすすめポイント！</div>
      <div class="header-subtitle">＊下記内容を中心に物件の特長や魅力についてお伝えいたします</div>
      <div class="header-company">
        <div class="header-company-name">${companyName}</div>
        <div class="header-company-detail">${companyAddress}</div>
        <div class="header-company-detail">${companyTel} ${companyMail}</div>
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
        {points.map((value, index) => (
          <Box key={`point-${index}`} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
            <Typography sx={{ minWidth: 28, fontWeight: 'bold', fontSize: '0.9rem' }}>
              {index + 1}
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={value}
              onChange={(e) => handlePointChange(index, e.target.value)}
              disabled={readOnly}
              placeholder={`おすすめポイント${index + 1}`}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#FFF8E1',
                }
              }}
            />
            {!readOnly && points.length > 1 && (
              <IconButton size="small" onClick={() => removePoint(index)} sx={{ color: 'text.secondary' }}>
                <RemoveCircleOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}
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
        {cautions.map((value, index) => (
          <Box key={`caution-${index}`} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
            <Typography sx={{ minWidth: 28, fontWeight: 'bold', fontSize: '0.9rem' }}>
              {index + 1}
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={value}
              onChange={(e) => handleCautionChange(index, e.target.value)}
              disabled={readOnly}
              placeholder={`注意点${index + 1}`}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#FFECB3',
                }
              }}
            />
            {!readOnly && cautions.length > 1 && (
              <IconButton size="small" onClick={() => removeCaution(index)} sx={{ color: 'text.secondary' }}>
                <RemoveCircleOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}
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
