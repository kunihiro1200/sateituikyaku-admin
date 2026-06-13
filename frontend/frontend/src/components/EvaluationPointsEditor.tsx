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
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface EvaluationPointsData {
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
}

interface EvaluationPointsEditorProps {
  sellerId: string;
  propertyAddress?: string;
  readOnly?: boolean;
}

const EMPTY_DATA: EvaluationPointsData = {
  point_1: null,
  point_2: null,
  point_3: null,
  point_4: null,
  point_5: null,
  point_6: null,
  point_7: null,
  point_8: null,
  point_9: null,
  point_10: null,
  caution_1: null,
  caution_2: null,
  caution_3: null,
  caution_4: null,
};

export const EvaluationPointsEditor: React.FC<EvaluationPointsEditorProps> = ({
  sellerId,
  propertyAddress,
  readOnly = false,
}) => {
  const [data, setData] = useState<EvaluationPointsData>(EMPTY_DATA);
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
      setData({
        point_1: res.data.point_1 || null,
        point_2: res.data.point_2 || null,
        point_3: res.data.point_3 || null,
        point_4: res.data.point_4 || null,
        point_5: res.data.point_5 || null,
        point_6: res.data.point_6 || null,
        point_7: res.data.point_7 || null,
        point_8: res.data.point_8 || null,
        point_9: res.data.point_9 || null,
        point_10: res.data.point_10 || null,
        caution_1: res.data.caution_1 || null,
        caution_2: res.data.caution_2 || null,
        caution_3: res.data.caution_3 || null,
        caution_4: res.data.caution_4 || null,
      });
    } catch (err: any) {
      console.error('Failed to fetch evaluation points:', err);
      setError('評価ポイントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    if (sellerId) {
      fetchData();
    }
  }, [sellerId, fetchData]);

  const handleChange = (field: keyof EvaluationPointsData, value: string) => {
    setData(prev => ({ ...prev, [field]: value || null }));
    setIsDirty(true);
    setSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.put(`/api/sellers/${sellerId}/evaluation-points`, {
        ...data,
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

      {/* おすすめポイント（1〜10） */}
      <Box sx={{ mb: 3 }}>
        {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((num) => {
          const field = `point_${num}` as keyof EvaluationPointsData;
          return (
            <Box key={field} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
              <Typography sx={{ minWidth: 28, fontWeight: 'bold', fontSize: '0.9rem' }}>
                {num}
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={data[field] || ''}
                onChange={(e) => handleChange(field, e.target.value)}
                disabled={readOnly}
                placeholder={`おすすめポイント${num}`}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: '#FFF8E1',
                  } 
                }}
              />
            </Box>
          );
        })}
      </Box>

      {/* 注意点セクション */}
      <Divider sx={{ my: 2 }} />
      <Typography sx={{ fontWeight: 'bold', mb: 1.5, fontSize: '0.95rem' }}>
        ・注意点(告知事項等）
      </Typography>

      <Box sx={{ mb: 2 }}>
        {([1, 2, 3, 4] as const).map((num) => {
          const field = `caution_${num}` as keyof EvaluationPointsData;
          return (
            <Box key={field} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
              <Typography sx={{ minWidth: 28, fontWeight: 'bold', fontSize: '0.9rem' }}>
                {num}
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={data[field] || ''}
                onChange={(e) => handleChange(field, e.target.value)}
                disabled={readOnly}
                placeholder={`注意点${num}`}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: '#FFECB3',
                  } 
                }}
              />
            </Box>
          );
        })}
      </Box>

      {/* エラー・成功メッセージ */}
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 1 }}>
          保存しました
        </Alert>
      )}

      {/* 保存ボタン */}
      {!readOnly && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
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
  const [data, setData] = useState<EvaluationPointsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/api/evaluation-points/by-seller-number/${sellerNumber}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch evaluation points for buyer page:', err);
      } finally {
        setLoading(false);
      }
    };
    if (sellerNumber) fetch();
  }, [sellerNumber]);

  if (loading) return <CircularProgress size={16} />;
  if (!data) return <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>評価ポイント未入力</Typography>;

  const points = [
    data.point_1, data.point_2, data.point_3, data.point_4, data.point_5,
    data.point_6, data.point_7, data.point_8, data.point_9, data.point_10,
  ].filter(Boolean);
  const cautions = [data.caution_1, data.caution_2, data.caution_3, data.caution_4].filter(Boolean);

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
