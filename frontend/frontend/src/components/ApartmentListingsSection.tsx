/**
 * ApartmentListingsSection
 *
 * マンション種別の物件に表示する「同一棟の売り出し」セクション。
 * ApartmentBuildingInfoSection とは独立した Paper コンポーネント。
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import api from '../services/api';

interface ListingItem {
  url: string;
  floor: number | null;
  area_sqm: number | null;
  price_yen: number | null;
  price_label: string | null;
  room_type: string | null;
}

interface ApartmentListingsSectionProps {
  sellerNumber: string;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export const ApartmentListingsSection: React.FC<ApartmentListingsSectionProps> = ({
  sellerNumber,
}) => {
  const [listings, setListings] = useState<ListingItem[] | null | undefined>(undefined);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DB から保存済みデータ読み込み
  const loadData = useCallback(async () => {
    if (!sellerNumber) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/apartment-info/seller/${sellerNumber}`);
      const d = res.data.data;
      setListings(d?.listings ?? null);
      setFetchedAt(d?.listings_fetched_at ?? null);
    } catch {
      // サイレント
    } finally {
      setLoading(false);
    }
  }, [sellerNumber]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // SUUMO / AtHome から売り出し物件を取得
  const handleFetch = async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await api.post(`/api/apartment-info/seller/${sellerNumber}/fetch-listings`);
      setListings(res.data.listings ?? []);
      setFetchedAt(new Date().toISOString());
    } catch (err: any) {
      setError(err?.response?.data?.error ?? '売り出し情報の取得に失敗しました');
    } finally {
      setFetching(false);
    }
  };

  const isBusy = loading || fetching;

  return (
    <Paper sx={{ p: 2, mb: 3, bgcolor: '#f3f8ff', border: '1px solid #b3d1f5' }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
          🏷️ 同一棟の売り出し
        </Typography>
        <Tooltip
          title="SUUMO・AtHome・DuckDuckGo で同一マンションの現在の売り出し物件を検索します。"
          placement="top"
        >
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', cursor: 'help' }}>
            ℹ️
          </Typography>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        {isBusy ? (
          <CircularProgress size={14} sx={{ mr: 0.5 }} />
        ) : (
          <Typography
            component="span"
            variant="caption"
            sx={{
              fontSize: '0.7rem',
              color: 'primary.main',
              cursor: 'pointer',
              textDecoration: 'underline',
              '&:hover': { color: 'primary.dark' },
            }}
            onClick={handleFetch}
          >
            {listings != null ? '再確認' : '確認する'}
          </Typography>
        )}
      </Box>

      {/* エラー */}
      {error && (
        <Alert severity="warning" sx={{ py: 0, px: 1, mb: 0.75, fontSize: '0.68rem', '& .MuiAlert-message': { py: 0.3 } }}>
          {error}
        </Alert>
      )}

      {/* ロード中 */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
          <CircularProgress size={12} />
          <Typography variant="caption" color="text.secondary">読み込み中...</Typography>
        </Box>
      )}

      {/* 未確認 */}
      {!loading && listings === null && !error && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
            未確認 —
          </Typography>
          <Typography
            component="span"
            variant="caption"
            sx={{
              fontSize: '0.7rem',
              color: 'primary.main',
              cursor: 'pointer',
              textDecoration: 'underline',
              '&:hover': { color: 'primary.dark' },
            }}
            onClick={handleFetch}
          >
            確認する
          </Typography>
        </Box>
      )}

      {/* データなし */}
      {!loading && listings !== null && listings !== undefined && listings.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
          現在売り出し中の物件はありません
          {fetchedAt && `（確認: ${formatDate(fetchedAt)}）`}
        </Typography>
      )}

      {/* 一覧表示 */}
      {listings && listings.length > 0 && (
        <Box>
          {listings.map((item, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                py: 0.5,
                borderBottom: idx < listings.length - 1 ? '1px solid #d0e4f8' : 'none',
                flexWrap: 'wrap',
              }}
            >
              {/* 価格 */}
              <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.8rem', minWidth: 72 }}>
                {item.price_label ?? (item.price_yen ? `${(item.price_yen / 10000).toLocaleString()}万円` : '—')}
              </Typography>
              {/* 間取り */}
              {item.room_type && (
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  {item.room_type}
                </Typography>
              )}
              {/* 階数 */}
              {item.floor != null && (
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  {item.floor}階
                </Typography>
              )}
              {/* 専有面積 */}
              {item.area_sqm != null && (
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  {item.area_sqm}m²
                </Typography>
              )}
              {/* URL リンク */}
              {item.url && (
                <Typography
                  component="a"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="caption"
                  sx={{ fontSize: '0.65rem', color: 'primary.main', ml: 'auto' }}
                >
                  詳細→
                </Typography>
              )}
            </Box>
          ))}
          {fetchedAt && (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled', mt: 0.5, display: 'block' }}>
              確認: {formatDate(fetchedAt)}
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default ApartmentListingsSection;
