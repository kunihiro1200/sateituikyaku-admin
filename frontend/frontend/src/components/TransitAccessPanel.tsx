/**
 * TransitAccessPanel.tsx
 * 物件の交通アクセス情報（Google Maps Places API より自動取得）を表示・操作するパネル。
 *
 * 機能:
 *   - 最寄り駅・バス停の自動取得と表示
 *   - 広告掲載候補のチェックボックス選択
 *   - 路線名/運行事業者・徒歩分数の手動修正
 *   - 広告掲載用テキストのプレビュー
 *   - 再取得（選択状態・手動修正は上書きしない）
 *
 * 店舗判定:
 *   - 売主番号に "fi"（大文字小文字不問）を含む → 福岡店（駅3件・バス停3件）
 *   - 含まない → 大分店（駅1件・バス停1件）
 *
 * Google Maps 利用規約:
 *   - Places API データは 30 日以内の再表示用として DB に保存
 *   - fetched_at が 30 日超過の場合は更新推奨バナーを表示
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, IconButton, Alert, Tooltip,
  Checkbox, FormControlLabel, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import api from '../services/api';

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

export interface TransitRecord {
  id: string;
  seller_number: string;
  store_type: 'fukuoka' | 'oita' | 'unknown';
  transport_type: 'station' | 'bus_stop';
  rank: number;
  name: string | null;
  line_name: string | null;
  walk_distance_m: number | null;
  walk_minutes: number | null;
  is_estimated_distance: boolean;
  place_id: string | null;
  place_lat: number | null;
  place_lng: number | null;
  is_selected: boolean;
  is_manually_corrected: boolean;
  manual_name: string | null;
  manual_line_name: string | null;
  manual_walk_minutes: number | null;
  is_confirmed: boolean;
  confirmed_at: string | null;
  data_source: string;
  fetched_at: string | null;
  fetch_error: string | null;
}

interface TransitAccessPanelProps {
  sellerNumber: string;
}

// ────────────────────────────────────────────
// 表示用ヘルパー
// ────────────────────────────────────────────

/** 広告に使用する名称（手動修正値を優先） */
function getDisplayName(r: TransitRecord): string {
  return r.is_manually_corrected && r.manual_name ? r.manual_name : (r.name ?? '');
}

/** 広告に使用する路線名/運行事業者（手動修正値を優先） */
function getDisplayLineName(r: TransitRecord): string | null {
  return r.is_manually_corrected && r.manual_line_name !== null
    ? r.manual_line_name
    : r.line_name;
}

/** 広告に使用する徒歩分数（手動修正値を優先） */
function getDisplayWalkMinutes(r: TransitRecord): number | null {
  return r.is_manually_corrected && r.manual_walk_minutes !== null
    ? r.manual_walk_minutes
    : r.walk_minutes;
}

/** 広告掲載用のテキストを生成する */
function buildAdText(r: TransitRecord): string {
  const name = getDisplayName(r);
  const line = getDisplayLineName(r);
  const mins = getDisplayWalkMinutes(r);
  if (!name) return '';
  const minsStr = mins != null ? `徒歩${mins}分` : '';
  return line ? `${name}（${line}）${minsStr}` : `${name} ${minsStr}`;
}

/** fetched_at から経過日数を計算する */
function getDaysSinceFetch(fetchedAt: string | null): number | null {
  if (!fetchedAt) return null;
  return Math.floor((Date.now() - new Date(fetchedAt).getTime()) / (1000 * 60 * 60 * 24));
}

/** 取得日時の表示文字列（YYYY/M/D） */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// ────────────────────────────────────────────
// 交通種別ラベル
// ────────────────────────────────────────────

const TRANSPORT_LABEL: Record<string, string> = {
  station: '🚉 最寄り駅',
  bus_stop: '🚌 最寄りバス停',
};

// ────────────────────────────────────────────
// TransitAccessPanel 本体
// ────────────────────────────────────────────

const TransitAccessPanel: React.FC<TransitAccessPanelProps> = ({ sellerNumber }) => {
  const [records, setRecords] = useState<TransitRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 手動修正ダイアログ
  const [editTarget, setEditTarget] = useState<TransitRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editLineName, setEditLineName] = useState('');
  const [editWalkMinutes, setEditWalkMinutes] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── データ読み込み ────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!sellerNumber) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.get(`/api/transit-access/seller/${sellerNumber}`);
      setRecords(res.data.data ?? []);
    } catch (err: any) {
      console.error('[TransitAccessPanel] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [sellerNumber]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── 再取得 ────────────────────────────────────────────────────────────
  const handleFetch = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await api.post(`/api/transit-access/seller/${sellerNumber}/fetch`);
      setRecords(res.data.data ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? '交通アクセス情報の取得に失敗しました';
      setFetchError(msg);
    } finally {
      setFetching(false);
    }
  };

  // ─── チェックボックス（広告掲載候補の選択/解除）──────────────────────
  const handleToggleSelected = async (record: TransitRecord) => {
    const newVal = !record.is_selected;
    // 楽観的更新
    setRecords(prev =>
      prev.map(r => (r.id === record.id ? { ...r, is_selected: newVal } : r))
    );
    try {
      await api.patch(`/api/transit-access/seller/${sellerNumber}/${record.id}`, {
        is_selected: newVal,
      });
    } catch (err: any) {
      console.error('[TransitAccessPanel] toggle error:', err);
      // 失敗時は元に戻す
      setRecords(prev =>
        prev.map(r => (r.id === record.id ? { ...r, is_selected: !newVal } : r))
      );
    }
  };

  // ─── 手動修正ダイアログを開く ──────────────────────────────────────────
  const openEdit = (record: TransitRecord) => {
    setEditTarget(record);
    setEditName(getDisplayName(record));
    setEditLineName(getDisplayLineName(record) ?? '');
    setEditWalkMinutes(String(getDisplayWalkMinutes(record) ?? ''));
  };

  // ─── 手動修正を保存 ────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    const minutes = parseInt(editWalkMinutes, 10);
    try {
      const res = await api.patch(
        `/api/transit-access/seller/${sellerNumber}/${editTarget.id}`,
        {
          is_manually_corrected: true,
          manual_name: editName.trim() || null,
          manual_line_name: editLineName.trim() || null,
          manual_walk_minutes: isNaN(minutes) ? null : minutes,
        }
      );
      setRecords(prev =>
        prev.map(r => (r.id === editTarget.id ? res.data.data : r))
      );
      setEditTarget(null);
    } catch (err: any) {
      console.error('[TransitAccessPanel] save edit error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ─── 手動修正をクリア ──────────────────────────────────────────────────
  const handleClearEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await api.patch(
        `/api/transit-access/seller/${sellerNumber}/${editTarget.id}`,
        {
          is_manually_corrected: false,
          manual_name: null,
          manual_line_name: null,
          manual_walk_minutes: null,
        }
      );
      setRecords(prev =>
        prev.map(r => (r.id === editTarget.id ? res.data.data : r))
      );
      setEditTarget(null);
    } catch (err: any) {
      console.error('[TransitAccessPanel] clear edit error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ─── 確認済みトグル ────────────────────────────────────────────────────
  const handleToggleConfirmed = async (record: TransitRecord) => {
    const newVal = !record.is_confirmed;
    setRecords(prev =>
      prev.map(r => (r.id === record.id ? { ...r, is_confirmed: newVal } : r))
    );
    try {
      await api.patch(`/api/transit-access/seller/${sellerNumber}/${record.id}`, {
        is_confirmed: newVal,
      });
    } catch (err: any) {
      console.error('[TransitAccessPanel] confirm error:', err);
      setRecords(prev =>
        prev.map(r => (r.id === record.id ? { ...r, is_confirmed: !newVal } : r))
      );
    }
  };

  // ─── 派生データ ────────────────────────────────────────────────────────
  const stations = records.filter(r => r.transport_type === 'station');
  const busStops = records.filter(r => r.transport_type === 'bus_stop');
  const selectedRecords = records.filter(r => r.is_selected);
  const isBusy = loading || fetching;

  // 取得日時（全レコード共通 → 最初のレコードを使用）
  const fetchedAt = records[0]?.fetched_at ?? null;
  const storeType = records[0]?.store_type ?? null;
  const daysSince = getDaysSinceFetch(fetchedAt);
  const isStale = daysSince != null && daysSince >= 30;

  // ─── レンダリング ──────────────────────────────────────────────────────
  return (
    <>
      <Box
        sx={{
          bgcolor: '#f0f4f8',
          borderRadius: 1,
          p: 1,
          border: '1px solid #dce3ea',
          mt: 1,
        }}
      >
        {/* ─── ヘッダー行 ─────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.3, gap: 0.5 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 'bold', fontSize: '0.7rem', color: 'text.secondary' }}
          >
            🚉 交通アクセス
          </Typography>

          {/* 店舗ラベル */}
          {storeType === 'fukuoka' && (
            <Chip label="福岡" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#e3f2fd', color: '#1565c0' }} />
          )}
          {storeType === 'oita' && (
            <Chip label="大分" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#e8f5e9', color: '#2e7d32' }} />
          )}

          {/* 取得日時 */}
          {fetchedAt && (
            <Typography variant="caption" sx={{ fontSize: '0.62rem', color: isStale ? 'warning.main' : 'text.disabled' }}>
              {isStale ? `⚠️ ${daysSince}日前` : `取得: ${formatDate(fetchedAt)}`}
            </Typography>
          )}

          <Tooltip
            title="Google Maps Places API より自動取得。路線名/運行事業者は自動取得できないため手動入力してください。✏️ボタンで修正できます。"
            placement="top"
          >
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', cursor: 'help' }}>
              ℹ️
            </Typography>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          {/* 再取得ボタン */}
          {isBusy ? (
            <CircularProgress size={14} sx={{ mr: 0.5 }} />
          ) : (
            <Tooltip title={records.length > 0 ? '再取得（選択状態・手動修正は保持）' : '交通アクセスを取得する'} placement="top">
              <IconButton size="small" onClick={handleFetch} disabled={isBusy} sx={{ p: 0.25 }}>
                <RefreshIcon sx={{ fontSize: '0.95rem' }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* ─── エラー表示 ──────────────────────────────────────────── */}
        {fetchError && (
          <Alert
            severity="warning"
            sx={{ py: 0, px: 1, mb: 0.5, fontSize: '0.68rem', '& .MuiAlert-message': { py: 0.3 } }}
          >
            {fetchError}
          </Alert>
        )}

        {/* ─── 未取得状態 ──────────────────────────────────────────── */}
        {!loading && records.length === 0 && !fetchError && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
              未取得 —
            </Typography>
            <Typography
              component="span"
              variant="caption"
              onClick={handleFetch}
              sx={{
                fontSize: '0.7rem',
                color: 'primary.main',
                cursor: 'pointer',
                textDecoration: 'underline',
                '&:hover': { color: 'primary.dark' },
              }}
            >
              取得する
            </Typography>
          </Box>
        )}

        {/* ─── データ表示 ──────────────────────────────────────────── */}
        {records.length > 0 && (
          <>
            {/* 駅セクション */}
            {stations.length > 0 && (
              <TransitSection
                title={TRANSPORT_LABEL['station']}
                records={stations}
                onToggleSelected={handleToggleSelected}
                onEdit={openEdit}
                onToggleConfirmed={handleToggleConfirmed}
              />
            )}
            {stations.length === 0 && !loading && (
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled', display: 'block', mb: 0.3 }}>
                🚉 該当する駅が見つかりませんでした
              </Typography>
            )}

            {/* バス停セクション */}
            {busStops.length > 0 && (
              <TransitSection
                title={TRANSPORT_LABEL['bus_stop']}
                records={busStops}
                onToggleSelected={handleToggleSelected}
                onEdit={openEdit}
                onToggleConfirmed={handleToggleConfirmed}
              />
            )}
            {busStops.length === 0 && !loading && (
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled', display: 'block', mb: 0.3 }}>
                🚌 該当するバス停が見つかりませんでした
              </Typography>
            )}

            {/* 広告掲載プレビュー */}
            {selectedRecords.length > 0 && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 'bold', display: 'block', mb: 0.3 }}>
                  📋 広告掲載プレビュー
                </Typography>
                {selectedRecords.map(r => (
                  <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.2 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.primary' }}>
                      {buildAdText(r)}
                    </Typography>
                    {r.is_estimated_distance && !r.is_manually_corrected && (
                      <Tooltip title="Directions API が利用できず直線距離から推定した値です。実際の距離と異なる場合があります。✏️ で手動修正してください。" placement="top">
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'warning.main', cursor: 'help' }}>⚠️推定</Typography>
                      </Tooltip>
                    )}
                    {r.is_manually_corrected && (
                      <Chip label="修正済" size="small" sx={{ height: 14, fontSize: '0.58rem', bgcolor: '#fff3e0', color: '#e65100' }} />
                    )}
                  </Box>
                ))}
              </>
            )}
          </>
        )}
      </Box>

      {/* ─── 手動修正ダイアログ ──────────────────────────────────── */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.9rem', pb: 1 }}>
          手動修正
          {editTarget && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.3 }}>
              取得値: {editTarget.name}
              {editTarget.walk_minutes != null ? ` 徒歩${editTarget.walk_minutes}分` : ''}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="名称（駅名・バス停名）"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 1.5, mt: 0.5 }}
          />
          <TextField
            label="路線名 / バス運行事業者"
            value={editLineName}
            onChange={e => setEditLineName(e.target.value)}
            fullWidth
            size="small"
            helperText="例: JR日豊本線 / 大分バス"
            sx={{ mb: 1.5 }}
          />
          <TextField
            label="徒歩分数（分）"
            value={editWalkMinutes}
            onChange={e => setEditWalkMinutes(e.target.value)}
            fullWidth
            size="small"
            type="number"
            inputProps={{ min: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          {editTarget?.is_manually_corrected && (
            <Button
              onClick={handleClearEdit}
              disabled={saving}
              size="small"
              color="warning"
              sx={{ mr: 'auto', fontSize: '0.75rem' }}
            >
              修正をクリア
            </Button>
          )}
          <Button onClick={() => setEditTarget(null)} size="small" disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={handleSaveEdit} variant="contained" size="small" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ────────────────────────────────────────────
// 交通機関セクション（駅 or バス停のリスト）
// ────────────────────────────────────────────

interface TransitSectionProps {
  title: string;
  records: TransitRecord[];
  onToggleSelected: (r: TransitRecord) => void;
  onEdit: (r: TransitRecord) => void;
  onToggleConfirmed: (r: TransitRecord) => void;
}

const TransitSection: React.FC<TransitSectionProps> = ({
  title,
  records,
  onToggleSelected,
  onEdit,
  onToggleConfirmed,
}) => (
  <Box sx={{ mb: 0.5 }}>
    <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 'bold', color: 'text.secondary', display: 'block', mb: 0.2 }}>
      {title}
    </Typography>
    {records.map(r => {
      const displayName = getDisplayName(r);
      const displayLine = getDisplayLineName(r);
      const displayMins = getDisplayWalkMinutes(r);
      const distStr = r.walk_distance_m != null ? `${r.walk_distance_m}m` : '';

      return (
        <Box
          key={r.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.3,
            py: 0.1,
            px: 0.5,
            borderRadius: 0.5,
            bgcolor: r.is_selected ? 'rgba(25,118,210,0.06)' : 'transparent',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.03)' },
          }}
        >
          {/* チェックボックス */}
          <Checkbox
            size="small"
            checked={r.is_selected}
            onChange={() => onToggleSelected(r)}
            sx={{ p: 0.2, '& .MuiSvgIcon-root': { fontSize: '1rem' } }}
          />

          {/* 順位バッジ */}
          <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.disabled', minWidth: 12 }}>
            {r.rank === 1 ? '①' : r.rank === 2 ? '②' : '③'}
          </Typography>

          {/* 名称・路線・距離 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.7rem',
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}
            >
              {displayName || '—'}
              {displayLine && (
                <Typography component="span" sx={{ fontSize: '0.62rem', color: 'text.secondary', ml: 0.5 }}>
                  {displayLine}
                </Typography>
              )}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
              {displayMins != null ? `徒歩${displayMins}分` : ''}
              {distStr && ` (${distStr})`}
              {r.is_estimated_distance && !r.is_manually_corrected && (
                <Typography component="span" sx={{ fontSize: '0.6rem', color: 'warning.main', ml: 0.3 }}>
                  推定
                </Typography>
              )}
            </Typography>
          </Box>

          {/* 修正済みチップ */}
          {r.is_manually_corrected && (
            <Chip
              label="修正"
              size="small"
              sx={{ height: 14, fontSize: '0.58rem', bgcolor: '#fff3e0', color: '#e65100' }}
            />
          )}

          {/* 確認済みチップ */}
          {r.is_confirmed && (
            <Tooltip title={`確認済み`} placement="top">
              <CheckCircleOutlineIcon sx={{ fontSize: '0.85rem', color: 'success.main' }} />
            </Tooltip>
          )}

          {/* 編集ボタン */}
          <Tooltip title="手動修正（路線名・徒歩分数を入力）" placement="top">
            <IconButton size="small" onClick={() => onEdit(r)} sx={{ p: 0.2 }}>
              <EditIcon sx={{ fontSize: '0.8rem', color: 'text.disabled' }} />
            </IconButton>
          </Tooltip>

          {/* 確認済みボタン */}
          <Tooltip title={r.is_confirmed ? '確認済みを解除' : '確認済みにする'} placement="top">
            <IconButton
              size="small"
              onClick={() => onToggleConfirmed(r)}
              sx={{ p: 0.2 }}
            >
              <CheckCircleOutlineIcon
                sx={{ fontSize: '0.8rem', color: r.is_confirmed ? 'success.main' : 'text.disabled' }}
              />
            </IconButton>
          </Tooltip>
        </Box>
      );
    })}
  </Box>
);

export default TransitAccessPanel;
