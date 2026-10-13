/**
 * HazardInfoPanel.tsx
 * 物件のハザード情報（国土交通省 不動産情報ライブラリAPIより自動取得）を表示するパネル
 *
 * 表示項目:
 *   ① 洪水浸水想定区域（想定最大規模）XKT026
 *   ② 雨水出水（内水氾濫）          自治体確認（API未整備）
 *   ③ 高潮浸水想定区域               XKT027
 *   ④ 津波浸水想定                   XKT028
 *   ⑤ 土砂災害警戒区域（黄）         XKT029
 *   ⑥ 土砂災害特別警戒区域（赤）     XKT029
 *
 * ⚠️ 重要事項説明に利用する際は、自治体の最新ハザードマップを必ず確認すること
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Tooltip,
  IconButton, Alert
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import api from '../services/api';

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

export interface HazardData {
  id: string;
  seller_number: string;
  latitude: number | null;
  longitude: number | null;
  // ① 洪水
  flood: string | null;
  flood_depth_rank: number | null;
  flood_depth_label: string | null;
  flood_river_name: string | null;
  // ② 雨水出水
  inland_flood: string;  // 常に 'unavailable'
  // ③ 高潮
  storm_surge: string | null;
  storm_surge_depth: string | null;
  // ④ 津波
  tsunami: string | null;
  tsunami_depth: string | null;
  // ⑤ 土砂（黄）
  landslide_yellow: string | null;
  landslide_yellow_type: string | null;
  // ⑥ 土砂（赤）
  landslide_red: string | null;
  landslide_red_type: string | null;
  // メタデータ
  fetched_at: string | null;
  fetch_error: string | null;
  data_source: string;
}

interface HazardInfoPanelProps {
  sellerNumber: string;
}

// ────────────────────────────────────────────
// ステータスChipコンポーネント
// ────────────────────────────────────────────

function HazardChip({ status, detail }: { status: string | null | undefined; detail?: string | null }) {
  if (status === null || status === undefined) {
    // 未取得
    return (
      <Chip
        label="未取得"
        size="small"
        variant="outlined"
        sx={{ fontSize: '0.62rem', height: 18, color: '#bdbdbd', borderColor: '#e0e0e0' }}
      />
    );
  }
  if (status === 'inside') {
    const label = detail ? `区域内（${detail}）` : '区域内';
    return (
      <Tooltip title={detail || '区域内'} placement="top">
        <Chip
          label={label}
          size="small"
          sx={{
            fontSize: '0.62rem',
            height: 18,
            maxWidth: 130,
            bgcolor: '#ffebee',
            color: '#c62828',
            border: '1px solid #ef9a9a',
            '& .MuiChip-label': {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              px: 0.8,
            },
          }}
        />
      </Tooltip>
    );
  }
  if (status === 'outside') {
    return (
      <Chip
        label="区域外"
        size="small"
        sx={{ fontSize: '0.62rem', height: 18, bgcolor: '#e8f5e9', color: '#2e7d32' }}
      />
    );
  }
  if (status === 'error') {
    return (
      <Chip
        label="取得失敗"
        size="small"
        sx={{ fontSize: '0.62rem', height: 18, bgcolor: '#fff3e0', color: '#e65100' }}
      />
    );
  }
  if (status === 'unavailable') {
    return (
      <Tooltip
        title="雨水出水（内水氾濫）は国土数値情報APIに未整備のため、自治体のハザードマップを確認してください"
        placement="top"
      >
        <Chip
          label="自治体確認"
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.62rem', height: 18, color: '#9e9e9e', borderColor: '#bdbdbd' }}
        />
      </Tooltip>
    );
  }
  return null;
}

// ────────────────────────────────────────────
// 表示項目定義
// ────────────────────────────────────────────

const HAZARD_ITEMS: Array<{
  label: string;
  statusKey: keyof HazardData;
  detailFn: (d: HazardData) => string | null | undefined;
}> = [
  {
    label: '洪水',
    statusKey: 'flood',
    detailFn: (d) => d.flood === 'inside' ? (d.flood_depth_label ?? undefined) : null,
  },
  {
    label: '内水氾濫',
    statusKey: 'inland_flood',
    detailFn: () => null,
  },
  {
    label: '高潮',
    statusKey: 'storm_surge',
    detailFn: (d) => d.storm_surge === 'inside' ? (d.storm_surge_depth ?? undefined) : null,
  },
  {
    label: '津波',
    statusKey: 'tsunami',
    detailFn: (d) => d.tsunami === 'inside' ? (d.tsunami_depth ?? undefined) : null,
  },
  {
    label: '土砂(黄)',
    statusKey: 'landslide_yellow',
    detailFn: (d) => d.landslide_yellow === 'inside' ? (d.landslide_yellow_type ?? undefined) : null,
  },
  {
    label: '土砂(赤)',
    statusKey: 'landslide_red',
    detailFn: (d) => d.landslide_red === 'inside' ? (d.landslide_red_type ?? undefined) : null,
  },
];

// ────────────────────────────────────────────
// HazardInfoPanel本体
// ────────────────────────────────────────────

export const HazardInfoPanel: React.FC<HazardInfoPanelProps> = ({ sellerNumber }) => {
  const [hazardData, setHazardData] = useState<HazardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 保存済みデータを読み込む
  const loadHazardData = useCallback(async () => {
    if (!sellerNumber) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.get(`/api/hazard-info/seller/${sellerNumber}`);
      setHazardData(res.data.data ?? null);
    } catch (err: any) {
      console.error('[HazardInfoPanel] load error:', err);
      // 読み込みエラーはサイレント（データなし状態として扱う）
    } finally {
      setLoading(false);
    }
  }, [sellerNumber]);

  useEffect(() => {
    loadHazardData();
  }, [loadHazardData]);

  // Reinfolib API から再取得
  const handleFetch = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await api.post(`/api/hazard-info/seller/${sellerNumber}/fetch`);
      setHazardData(res.data.data ?? null);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'ハザード情報の取得に失敗しました';
      setFetchError(msg);
    } finally {
      setFetching(false);
    }
  };

  // 取得日時フォーマット（YYYY/M/D）
  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  const isBusy = loading || fetching;

  return (
    <Box sx={{ bgcolor: '#f0f4f8', borderRadius: 1, p: 1, border: '1px solid #dce3ea' }}>
      {/* ヘッダー行 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.3, gap: 0.5 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 'bold', fontSize: '0.7rem', color: 'text.secondary' }}
        >
          🛡️ ハザード情報
        </Typography>
        <Tooltip
          title="国土交通省 不動産情報ライブラリ（Reinfolib）APIより自動取得。地図ピン位置に基づくため、敷地との誤差がある場合は地図セクションでピン位置を確認・修正してください。"
          placement="top"
        >
          <Typography
            variant="caption"
            sx={{ fontSize: '0.65rem', color: 'text.disabled', cursor: 'help' }}
          >
            ℹ️
          </Typography>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        {isBusy ? (
          <CircularProgress size={14} sx={{ mr: 0.5 }} />
        ) : (
          <Tooltip title={hazardData ? '再取得（最新データに更新）' : 'ハザード情報を取得する'} placement="top">
            <IconButton
              size="small"
              onClick={handleFetch}
              disabled={isBusy}
              sx={{ p: 0.25 }}
            >
              <RefreshIcon sx={{ fontSize: '0.95rem' }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* エラー表示 */}
      {fetchError && (
        <Alert
          severity="warning"
          sx={{ py: 0, px: 1, mb: 0.5, fontSize: '0.68rem', '& .MuiAlert-message': { py: 0.3 } }}
        >
          {fetchError}
        </Alert>
      )}

      {/* 未取得状態 */}
      {!loading && !hazardData && !fetchError && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
            未取得 —
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
            取得する
          </Typography>
        </Box>
      )}

      {/* ハザードデータ表示 */}
      {hazardData && (
        <>
          {/* 6項目 2列グリッド */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              rowGap: '3px',
              columnGap: '6px',
              mb: 0.4,
            }}
          >
            {HAZARD_ITEMS.map(({ label, statusKey, detailFn }) => {
              const status = hazardData[statusKey] as string | null | undefined;
              const detail = detailFn(hazardData);
              return (
                <Box key={statusKey} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontSize: '0.65rem', color: 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {label}
                  </Typography>
                  <HazardChip status={status} detail={detail} />
                </Box>
              );
            })}
          </Box>

          {/* 取得日時・出典 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mb: 0.3 }}>
            {hazardData.fetched_at && (
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                取得: {formatDate(hazardData.fetched_at)} ／ {hazardData.data_source}
              </Typography>
            )}
            {hazardData.fetch_error && !fetchError && (
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'warning.main' }}>
                （前回取得エラーあり）
              </Typography>
            )}
          </Box>
        </>
      )}

      {/* 重要事項説明への注意書き */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.25, mt: 0.25 }}>
        <WarningAmberIcon sx={{ fontSize: '0.75rem', color: '#f57c00', mt: '1px', flexShrink: 0 }} />
        <Typography
          variant="caption"
          sx={{ fontSize: '0.6rem', color: '#e65100', lineHeight: 1.4 }}
        >
          重説利用時は自治体の最新ハザードマップを確認してください
        </Typography>
      </Box>
    </Box>
  );
};

export default HazardInfoPanel;
