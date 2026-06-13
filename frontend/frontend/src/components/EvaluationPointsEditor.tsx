import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Paper,
  IconButton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PrintIcon from '@mui/icons-material/Print';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

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

    const pointRows = allPoints.map((p, i) => `
      <tr>
        <td style="width:30px;font-weight:bold;text-align:center;padding:6px 4px;">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #333;background:#FFF8E1;">${p}</td>
      </tr>
      <tr><td colspan="2" style="height:4px;"></td></tr>
    `).join('');

    const cautionRows = allCautions.map((c, i) => `
      <tr>
        <td style="width:30px;font-weight:bold;text-align:center;padding:6px 4px;">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #333;background:#FFECB3;">${c}</td>
      </tr>
      <tr><td colspan="2" style="height:4px;"></td></tr>
    `).join('');

    const isFukuoka = sellerNumber?.startsWith('FI');
    const companyInfo = isFukuoka
      ? '株式会社くじら不動産<br>〒810-0073 福岡市中央区舞鶴3-1-10<br>TEL:092-401-5331 mail:tenant@ifoo-oita.com'
      : '株式会社いふう<br>〒870-0044 大分県大分市舞鶴町1-3-30<br>TEL:097-533-2022 mail:tenant@ifoo-oita.com';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>評価ポイント - ${propertyAddress || ''}</title>
  <style>
    @page { margin: 15mm; size: A4; }
    body { font-family: 'Hiragino Kaku Gothic Pro', 'MS Gothic', sans-serif; margin: 0; padding: 20px; }
    .header { background: #FFFF00; display: inline-block; padding: 8px 16px; font-size: 18pt; font-weight: bold; margin-bottom: 16px; }
    .property { font-weight: bold; font-size: 12pt; margin-bottom: 12px; }
    .description { font-size: 10pt; margin-bottom: 16px; color: #333; }
    table { width: 100%; border-collapse: collapse; }
    .section-title { font-weight: bold; font-size: 11pt; margin: 20px 0 10px 0; }
    .footer { position: fixed; bottom: 15mm; right: 15mm; text-align: right; font-size: 9pt; color: #333; }
  </style>
</head>
<body>
  <div class="header">物件の評価ポイント！おすすめポイント！</div>
  <div class="property">物件：${propertyAddress || ''}</div>
  <div class="description">＊下記内容を中心に物件の特長や魅力についてお伝えいたします！</div>
  <table>${pointRows}</table>
  <div class="section-title">・注意点(告知事項等）</div>
  <table>${cautionRows}</table>
  <div class="footer">${companyInfo}</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

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

  if (loading) return <CircularProgress size={16} />;
  if (points.length === 0 && cautions.length === 0) {
    return <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>評価ポイント未入力</Typography>;
  }

  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#FFFDE7' }}>
      {propertyAddress && (
        <Typography sx={{ fontWeight: 'bold', fontSize: '0.8rem', mb: 0.5 }}>
          物件：{propertyAddress}
        </Typography>
      )}
      {points.length > 0 && (
        <Box sx={{ mb: cautions.length > 0 ? 1 : 0 }}>
          <Typography sx={{ fontWeight: 'bold', fontSize: '0.8rem', mb: 0.3 }}>
            おすすめポイント
          </Typography>
          {points.map((p, i) => (
            <Typography key={i} sx={{ fontSize: '0.78rem', pl: 1 }}>
              {i + 1}. {p}
            </Typography>
          ))}
        </Box>
      )}
      {cautions.length > 0 && (
        <Box>
          <Typography sx={{ fontWeight: 'bold', fontSize: '0.8rem', mb: 0.3, color: 'error.main' }}>
            注意点
          </Typography>
          {cautions.map((c, i) => (
            <Typography key={i} sx={{ fontSize: '0.78rem', pl: 1, color: 'error.main' }}>
              {i + 1}. {c}
            </Typography>
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default EvaluationPointsEditor;
