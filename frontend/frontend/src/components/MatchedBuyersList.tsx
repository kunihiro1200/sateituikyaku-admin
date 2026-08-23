import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
} from '@mui/material';
import api from '../services/api';

const CONTACT_STATUS_OPTIONS = ['連絡済み', '連絡不要', '連絡未'] as const;

const TIMING_COLOR: Record<string, string> = {
  '今すぐ': '#d32f2f',
  '3ヶ月以内': '#f57c00',
  '半年以内': '#fbc02d',
  '1年以内': '#689f38',
  '1年以上・様子見': '#757575',
};

interface MatchCandidate {
  type: 'seller' | 'buyer';
  id: string;
  number: string | null;
  name: string | null;
  matchAreas: string[];
  matchAreaFreeText: string | null;
  matchTiming: string | null;
  matchPriceMin: number | null;
  matchPriceMax: number | null;
  matchMemo: string | null;
  matchUpdatedAt: string | null;
  matchReasons: string[];
  urgencyScore: number;
  contactStatus: string;
  timingFreshness: 'fresh' | 'warning' | 'expired';
}

interface MatchedBuyersListProps {
  sellerId: string;
}

const formatManYen = (yen: number | null | undefined): string => {
  if (yen == null) return '';
  return String(Math.round(yen / 10000));
};

/**
 * マッチングされた買主のリストを表示するコンポーネント
 * （マッチング条件の入力UI は含まない）
 */
const MatchedBuyersList: React.FC<MatchedBuyersListProps> = ({ sellerId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [contactSaving, setContactSaving] = useState<Record<string, boolean>>({});

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/sellers/${sellerId}/match-candidates`);
      setCandidates(res.data.candidates || []);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.error || 'マッチング候補の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const handleContactStatusChange = async (candidate: MatchCandidate, newStatus: string) => {
    setContactSaving((prev) => ({ ...prev, [candidate.id]: true }));
    try {
      await api.put(`/api/sellers/${sellerId}/match-candidates/${candidate.number}/contact-status`, {
        contactStatus: newStatus,
      });
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? { ...c, contactStatus: newStatus } : c))
      );
    } catch (e: any) {
      console.error('連絡状況の更新エラー:', e);
      alert('連絡状況の更新に失敗しました');
    } finally {
      setContactSaving((prev) => ({ ...prev, [candidate.id]: false }));
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          マッチング候補を読み込み中...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  if (candidates.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          条件に合う買主が見つかりませんでした。
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, px: 2, pt: 2 }}>
        マッチングされた買主（{candidates.length}件）
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>買主番号</TableCell>
            <TableCell>時期</TableCell>
            <TableCell>金額帯</TableCell>
            <TableCell>マッチ根拠</TableCell>
            <TableCell>連絡状況</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {candidates.map((c) => {
            const isStaleWarning = c.timingFreshness === 'warning';
            return (
              <TableRow key={c.id} sx={isStaleWarning ? { bgcolor: '#fff8e1' } : undefined}>
                <TableCell>
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    component="a"
                    href={c.type === 'seller' ? `/sellers/${c.id}` : `/buyers/${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {c.number || c.id}
                  </Typography>
                </TableCell>
                <TableCell>
                  {c.matchTiming && (
                    <Chip
                      label={c.matchTiming}
                      size="small"
                      sx={{
                        bgcolor: TIMING_COLOR[c.matchTiming] || '#757575',
                        color: '#fff',
                        fontSize: '0.7rem',
                      }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontSize="0.85rem">
                    {formatManYen(c.matchPriceMin)}〜{formatManYen(c.matchPriceMax)}万円
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {c.matchReasons.map((reason, idx) => (
                      <Chip key={idx} label={reason} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <ToggleButtonGroup
                    value={c.contactStatus || ''}
                    exclusive
                    onChange={(_, newStatus) => {
                      if (newStatus !== null) {
                        handleContactStatusChange(c, newStatus);
                      }
                    }}
                    size="small"
                    disabled={contactSaving[c.id]}
                  >
                    {CONTACT_STATUS_OPTIONS.map((status) => (
                      <ToggleButton key={status} value={status} sx={{ fontSize: '0.7rem', px: 1, py: 0.5 }}>
                        {status}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
};

export default MatchedBuyersList;
