/**
 * ApartmentBuildingInfoSection
 *
 * マンション種別の物件に表示する「外部建物情報」セクション。
 * Jina AI Search + Claude API でWeb情報を自動取得・保存する。
 *
 * 設計: HazardInfoPanel と同じパターン
 *   - 画面を開いたとき: DB キャッシュを読み込んで表示
 *   - 「取得」ボタン: POST /api/apartment-info/seller/:sellerNumber/fetch
 *   - 「再取得」ボタン: 同上（上書き保存）
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../services/api';

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

interface ApartmentBuildingData {
  id: string;
  seller_number: string;
  building_name: string | null;
  management_company: string | null;
  built_year_month: string | null;
  total_floors_above: number | null;
  total_floors_below: number | null;
  total_units: number | null;
  structure: string | null;
  developer_company: string | null;
  construction_company: string | null;
  management_type: string | null;
  has_elevator: string | null;
  large_repair_history: string | null;
  data_source: string | null;
  fetched_at: string | null;
  fetch_error: string | null;
}

interface ApartmentBuildingInfoSectionProps {
  sellerNumber: string;
}

// ────────────────────────────────────────────
// 表示ヘルパー
// ────────────────────────────────────────────

/** null の場合に「—」を表示 */
function Val({ v }: { v: string | number | null | undefined }) {
  if (v === null || v === undefined || v === '') {
    return (
      <Typography component="span" variant="body2" color="text.disabled">
        —
      </Typography>
    );
  }
  return <Typography component="span" variant="body2">{v}</Typography>;
}

/** YYYY-MM → YYYY年M月（築N年） */
function formatBuiltYearMonth(ym: string | null): string | null {
  if (!ym) return null;
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const age = new Date().getFullYear() - year;
  return `${year}年${month}月（築${age}年）`;
}

/** 地上N階 / 地下N階 を結合 */
function formatFloors(above: number | null, below: number | null): string | null {
  if (above == null && below == null) return null;
  const parts: string[] = [];
  if (above != null) parts.push(`地上${above}階`);
  if (below != null && below > 0) parts.push(`地下${below}階`);
  return parts.length > 0 ? parts.join(' / ') : null;
}

/** YYYY-MM-DDTHH:mm:ss → YYYY/M/D */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// ────────────────────────────────────────────
// 1行分の表示コンポーネント
// ────────────────────────────────────────────

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <Grid item xs={6}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', lineHeight: 1.3 }}
      >
        {label}
      </Typography>
      <Val v={value} />
    </Grid>
  );
}

// ────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────

export const ApartmentBuildingInfoSection: React.FC<ApartmentBuildingInfoSectionProps> = ({
  sellerNumber,
}) => {
  const [data, setData] = useState<ApartmentBuildingData | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);   // DB 読み込み中
  const [fetching, setFetching] = useState(false); // Web 取得中
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── DB キャッシュ読み込み ──
  const loadData = useCallback(async () => {
    if (!sellerNumber) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.get(`/api/apartment-info/seller/${sellerNumber}`);
      setData(res.data.data ?? null);
    } catch {
      // サイレント（未取得状態として扱う）
    } finally {
      setLoading(false);
    }
  }, [sellerNumber]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Web 取得 ──
  const handleFetch = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await api.post(`/api/apartment-info/seller/${sellerNumber}/fetch`);
      setData(res.data.data ?? null);
      if (res.data.fetchError) {
        setFetchError(res.data.fetchError);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ?? '建物情報の取得に失敗しました';
      setFetchError(msg);
    } finally {
      setFetching(false);
    }
  };

  const isBusy = loading || fetching;

  // 取得済みフィールドが1つでもあるか
  const hasAnyData =
    data &&
    (data.building_name ||
      data.management_company ||
      data.built_year_month ||
      data.total_floors_above ||
      data.total_units ||
      data.structure ||
      data.developer_company ||
      data.construction_company ||
      data.management_type ||
      data.has_elevator);

  return (
    <Paper sx={{ p: 2, mb: 3, bgcolor: '#fff8e1', border: '1px solid #ffe082' }}>
      {/* ── ヘッダー行 ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 0.5 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}
        >
          🏢 外部建物情報
        </Typography>
        <Tooltip
          title="Jina AI Search（Web検索）と Claude API を使用してマンション建物情報を自動取得します。取得できる項目はWebに公開されている情報に限られます。"
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
          <Tooltip
            title={data ? '再取得（最新情報に更新）' : '建物情報をWebから取得する'}
            placement="top"
          >
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

      {/* ── エラー表示 ── */}
      {fetchError && (
        <Alert
          severity="warning"
          sx={{
            py: 0,
            px: 1,
            mb: 1,
            fontSize: '0.68rem',
            '& .MuiAlert-message': { py: 0.3 },
          }}
        >
          {fetchError}
        </Alert>
      )}

      {/* ── ロード中 ── */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            読み込み中...
          </Typography>
        </Box>
      )}

      {/* ── 未取得状態 ── */}
      {!loading && data === null && !fetchError && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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

      {/* ── データ初期ロード前（undefined）── */}
      {data === undefined && !loading && !fetchError && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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

      {/* ── データ表示 ── */}
      {data && (
        <>
          {/* fetch_error があるがデータも保存済みの場合 */}
          {data.fetch_error && !fetchError && (
            <Alert
              severity="warning"
              sx={{
                py: 0,
                px: 1,
                mb: 1,
                fontSize: '0.65rem',
                '& .MuiAlert-message': { py: 0.3 },
              }}
            >
              前回取得エラー: {data.fetch_error}
            </Alert>
          )}

          {hasAnyData ? (
            <Grid container spacing={0.75}>
              {data.building_name && (
                <Grid item xs={12}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', lineHeight: 1.3 }}
                  >
                    マンション名
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {data.building_name}
                  </Typography>
                </Grid>
              )}
              {data.building_name && <Grid item xs={12}><Divider sx={{ my: 0.25 }} /></Grid>}
              <InfoRow
                label="管理会社"
                value={data.management_company}
              />
              <InfoRow
                label="築年月"
                value={formatBuiltYearMonth(data.built_year_month)}
              />
              <InfoRow
                label="階数"
                value={formatFloors(data.total_floors_above, data.total_floors_below)}
              />
              <InfoRow
                label="総戸数"
                value={data.total_units != null ? `${data.total_units}戸` : null}
              />
              <InfoRow
                label="建物構造"
                value={data.structure}
              />
              <InfoRow
                label="管理形態"
                value={data.management_type}
              />
              <InfoRow
                label="エレベーター"
                value={data.has_elevator}
              />
              <InfoRow
                label="分譲会社"
                value={data.developer_company}
              />
              <InfoRow
                label="施工会社"
                value={data.construction_company}
              />
              {data.large_repair_history && (
                <Grid item xs={12}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', lineHeight: 1.3 }}
                  >
                    大規模修繕
                  </Typography>
                  <Typography variant="body2">{data.large_repair_history}</Typography>
                </Grid>
              )}
            </Grid>
          ) : (
            <Typography variant="caption" color="text.secondary">
              情報が取得できませんでした。再取得を試してください。
            </Typography>
          )}

          {/* 取得日時・出典 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexWrap: 'wrap',
              mt: 0.75,
              pt: 0.5,
              borderTop: '1px solid #ffe082',
            }}
          >
            {data.fetched_at && (
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                取得: {formatDate(data.fetched_at)}
              </Typography>
            )}
            {data.data_source && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.6rem',
                  color: 'text.disabled',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 200,
                }}
              >
                ／ 出典: {data.data_source}
              </Typography>
            )}
          </Box>
        </>
      )}
    </Paper>
  );
};

export default ApartmentBuildingInfoSection;
