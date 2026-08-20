import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, Typography, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, CircularProgress } from '@mui/material';
import { ExpandMore, ExpandLess, Close as CloseIcon } from '@mui/icons-material';
import api from '../services/api';

interface SellerMatchSidebarItem {
  sellerId: string;
  sellerNumber: string | null;
  isFi: boolean;
  matchContactStatus: string | null;
  buyerMatchCount: number;
  topUrgencyScore: number;
}

/**
 * 売主リストサイドバーの「マッチング」セクション。
 * 追客中（追客中/他決→追客/除外後追客中）の売主のうち、
 * 買主の希望条件とマッチしている件数を福岡/大分別に表示する。
 * 既存の StatusCategory フィルタシステムとは独立して動作する
 * （既存のサイドバーロジックへの影響を避けるため）。
 */
const SellerMatchingSidebarSection: React.FC = () => {
  const [counts, setCounts] = useState<{ fukuoka: number; oita: number } | null>(null);
  const [expandedArea, setExpandedArea] = useState<'fukuoka' | 'oita' | null>(null);
  const [items, setItems] = useState<SellerMatchSidebarItem[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    api.get('/api/sellers/match-sidebar-counts')
      .then((res) => setCounts(res.data))
      .catch(() => setCounts({ fukuoka: 0, oita: 0 }));
  }, []);

  const handleClick = async (area: 'fukuoka' | 'oita') => {
    setExpandedArea(area);
    setLoadingList(true);
    setListOpen(true);
    try {
      const res = await api.get('/api/sellers/match-sidebar-list', { params: { area } });
      setItems(res.data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  };

  if (!counts || (counts.fukuoka === 0 && counts.oita === 0)) return null;

  const renderButton = (area: 'fukuoka' | 'oita', label: string, count: number) => {
    if (count === 0) return null;
    const isExpanded = expandedArea === area && listOpen;
    return (
      <Button
        fullWidth
        onClick={() => handleClick(area)}
        sx={{
          justifyContent: 'space-between',
          textAlign: 'left',
          fontSize: '0.85rem',
          py: 1,
          pl: 1.5,
          pr: 1.5,
          color: isExpanded ? 'white' : '#6a1b9a',
          bgcolor: isExpanded ? '#6a1b9a' : 'transparent',
          borderRadius: 1,
          '&:hover': { bgcolor: isExpanded ? '#6a1b9a' : '#6a1b9a22' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span>🔍 {label}</span>
          <Chip label={count} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
        </Box>
        {isExpanded ? <ExpandLess /> : <ExpandMore />}
      </Button>
    );
  };

  return (
    <>
      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'grey.200', bgcolor: '#f3e5f5', borderRadius: 1, px: 0.5 }}>
        <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', color: '#6a1b9a', fontWeight: 'bold', fontSize: '0.75rem' }}>
          ── マッチング通知 ──
        </Typography>
        {renderButton('oita', '大分マッチング', counts.oita)}
        {renderButton('fukuoka', '福岡マッチング', counts.fukuoka)}
      </Box>

      <Dialog open={listOpen} onClose={() => setListOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          マッチング通知（{expandedArea === 'fukuoka' ? '福岡' : '大分'}）
          <IconButton size="small" onClick={() => setListOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {loadingList && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          {!loadingList && items && items.length === 0 && (
            <Typography variant="body2" color="text.secondary">対象の売主がありません。</Typography>
          )}
          {!loadingList && items && items.map((item) => (
            <Box
              key={item.sellerId}
              sx={{ p: 1.5, mb: 1, border: '1px solid #e0e0e0', borderRadius: 1, cursor: 'pointer' }}
              onClick={() => {
                window.open(`/sellers/${item.sellerId}/call`, '_blank');
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: 'primary.main' }}>
                  {item.sellerNumber || item.sellerId}
                </Typography>
                <Chip label={`買主候補 ${item.buyerMatchCount}件`} size="small" color="secondary" />
              </Box>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SellerMatchingSidebarSection;
