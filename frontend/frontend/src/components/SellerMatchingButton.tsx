import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import api from '../services/api';

interface MatchCandidate {
  id: string;
  number: string | null;
  matchTiming: string | null;
  matchPriceMin: number | null;
  matchPriceMax: number | null;
  matchAreaFreeText: string | null;
  matchMemo: string | null;
  matchReasons: string[];
}

interface SellerMatchingButtonProps {
  buyerNumber: string;
  /** 希望時期が未入力かどうか（呼び出し元で判定した最新の値を渡す） */
  isDesiredTimingMissing: boolean;
  /**
   * 検索前に呼び出される。未保存の変更（希望時期の選択など）を保存するために使う。
   * バックエンドは保存済みのDB値を見て検索するため、検索前に必ず保存を完了させる必要がある。
   */
  onBeforeSearch?: () => Promise<void>;
}

const formatManYen = (yen: number | null): string => {
  if (yen == null) return '';
  return String(Math.round(yen / 10000));
};

/**
 * 「売主をマッチング」ボタン。
 * 買主の希望条件（desired_area / price_range_* / desired_timing）を使って、
 * 追客中でない専任・一般媒介・他決→専任の売主候補を検索する。
 * 希望時期が未入力の場合は検索前にエラーを表示する。
 */
const SellerMatchingButton: React.FC<SellerMatchingButtonProps> = ({ buyerNumber, isDesiredTimingMissing, onBeforeSearch }) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<MatchCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (isDesiredTimingMissing) {
      setError('「希望時期」が未入力です。プルダウンから選択して保存してから、再度お試しください。');
      setCandidates(null);
      setOpen(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 未保存の変更（希望時期の選択など）があれば先に保存する
      if (onBeforeSearch) {
        await onBeforeSearch();
      }
      const res = await api.get(`/api/buyers/${buyerNumber}/match-candidates`);
      if (res.data.missingRequiredFields && res.data.missingRequiredFields.length > 0) {
        setError('「希望時期」が未入力です。プルダウンから選択して保存してから、再度お試しください。');
        setCandidates(null);
        setOpen(true);
      } else {
        const matchedCandidates = res.data.candidates || [];
        setCandidates(matchedCandidates);
        
        // 該当の売主が1件の場合は通話モードページを直接開く
        if (matchedCandidates.length === 1) {
          const candidate = matchedCandidates[0];
          window.open(`/call-mode/${candidate.id}`, '_blank');
        } else {
          // 0件または2件以上の場合はダイアログを表示
          setOpen(true);
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'マッチング検索に失敗しました');
      setCandidates(null);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="secondary"
        size="small"
        startIcon={loading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <SearchIcon fontSize="small" />}
        onClick={handleClick}
        disabled={loading}
      >
        🔍 売主をマッチング
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          マッチング結果（売主候補）
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {!error && candidates && candidates.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              条件に合う売主が見つかりませんでした。希望エリア・価格帯を確認してください。
            </Typography>
          )}
          {!error && candidates && candidates.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {candidates.map((c) => (
                <Box key={c.id} sx={{ p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight="bold"
                      component="a"
                      href={`/sellers/${c.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'primary.main', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {c.number || c.id}
                    </Typography>
                    {c.matchTiming && <Chip label={c.matchTiming} size="small" color="warning" />}
                  </Box>
                  {(c.matchPriceMin || c.matchPriceMax) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      金額帯: {c.matchPriceMin ? `${formatManYen(c.matchPriceMin)}万円` : '下限なし'} 〜 {c.matchPriceMax ? `${formatManYen(c.matchPriceMax)}万円` : '上限なし'}
                    </Typography>
                  )}
                  {c.matchAreaFreeText && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      エリア（自由入力）: {c.matchAreaFreeText}
                    </Typography>
                  )}
                  {c.matchMemo && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                      メモ: {c.matchMemo}
                    </Typography>
                  )}
                  {c.matchReasons.length > 0 && (
                    <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {c.matchReasons.map((r, idx) => (
                        <Chip key={idx} label={r} size="small" variant="outlined" />
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SellerMatchingButton;
