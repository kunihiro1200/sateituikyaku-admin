/**
 * TransitAccessPanel.tsx
 * 物件の交通アクセス情報（Google Maps Places API より自動取得）を表示・操作するパネル。
 *
 * レイアウト:
 *   - 独立したセクション（Paper）として物件情報の直下に配置
 *   - 最寄り駅 と 最寄りバス停 を横並び 2 列で表示
 *
 * 店舗判定:
 *   - seller_number に "fi"（大文字小文字不問）を含む → 福岡店（駅3件・バス停3件）
 *   - 含まない → 大分店（駅1件・バス停1件）
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, CircularProgress, IconButton, Alert, Tooltip,
  Checkbox, Chip, Button, Dialog, DialogTitle,
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
  // 博多駅への交通情報（FI売主の駅のみ）
  transit_to_hakata_minutes: number | null;
  transit_to_hakata_text: string | null;
  data_source: string;
  fetched_at: string | null;
  fetch_error: string | null;
}

interface TransitAccessPanelProps {
  sellerNumber: string;
}

// ────────────────────────────────────────────
// ヘルパー関数
// ────────────────────────────────────────────

function getDisplayName(r: TransitRecord): string {
  return r.is_manually_corrected && r.manual_name ? r.manual_name : (r.name ?? '');
}

function getDisplayLineName(r: TransitRecord): string | null {
  return r.is_manually_corrected && r.manual_line_name !== null
    ? r.manual_line_name
    : r.line_name;
}

function getDisplayWalkMinutes(r: TransitRecord): number | null {
  return r.is_manually_corrected && r.manual_walk_minutes !== null
    ? r.manual_walk_minutes
    : r.walk_minutes;
}

function buildAdText(r: TransitRecord): string {
  const name = getDisplayName(r);
  const line = getDisplayLineName(r);
  const mins = getDisplayWalkMinutes(r);
  if (!name) return '';
  const minsStr = mins != null ? `徒歩${mins}分` : '';
  return line ? `${name}（${line}）${minsStr}` : `${name} ${minsStr}`;
}

function getDaysSinceFetch(fetchedAt: string | null): number | null {
  if (!fetchedAt) return null;
  return Math.floor((Date.now() - new Date(fetchedAt).getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

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

  // ─── データ読み込み ───────────────────────────────────────────────
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

  useEffect(() => { loadData(); }, [loadData]);

  // ─── 再取得 ──────────────────────────────────────────────────────
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

  // ─── チェックボックス ──────────────────────────────────────────────
  const handleToggleSelected = async (record: TransitRecord) => {
    const newVal = !record.is_selected;
    setRecords(prev => prev.map(r => r.id === record.id ? { ...r, is_selected: newVal } : r));
    try {
      await api.patch(`/api/transit-access/seller/${sellerNumber}/${record.id}`, { is_selected: newVal });
    } catch {
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, is_selected: !newVal } : r));
    }
  };

  // ─── 編集ダイアログを開く ──────────────────────────────────────────
  const openEdit = (record: TransitRecord) => {
    setEditTarget(record);
    setEditName(getDisplayName(record));
    setEditLineName(getDisplayLineName(record) ?? '');
    setEditWalkMinutes(String(getDisplayWalkMinutes(record) ?? ''));
  };

  // ─── 手動修正を保存 ────────────────────────────────────────────────
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
      setRecords(prev => prev.map(r => r.id === editTarget.id ? res.data.data : r));
      setEditTarget(null);
    } catch (err: any) {
      console.error('[TransitAccessPanel] save edit error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ─── 手動修正をクリア ──────────────────────────────────────────────
  const handleClearEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await api.patch(
        `/api/transit-access/seller/${sellerNumber}/${editTarget.id}`,
        { is_manually_corrected: false, manual_name: null, manual_line_name: null, manual_walk_minutes: null }
      );
      setRecords(prev => prev.map(r => r.id === editTarget.id ? res.data.data : r));
      setEditTarget(null);
    } catch (err: any) {
      console.error('[TransitAccessPanel] clear edit error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ─── 確認済みトグル ────────────────────────────────────────────────
  const handleToggleConfirmed = async (record: TransitRecord) => {
    const newVal = !record.is_confirmed;
    setRecords(prev => prev.map(r => r.id === record.id ? { ...r, is_confirmed: newVal } : r));
    try {
      await api.patch(`/api/transit-access/seller/${sellerNumber}/${record.id}`, { is_confirmed: newVal });
    } catch {
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, is_confirmed: !newVal } : r));
    }
  };

  // ─── 派生データ ────────────────────────────────────────────────────
  const stations = records.filter(r => r.transport_type === 'station');
  const busStops = records.filter(r => r.transport_type === 'bus_stop');
  const selectedRecords = records.filter(r => r.is_selected);
  const isBusy = loading || fetching;

  const fetchedAt = records[0]?.fetched_at ?? null;
  const storeType = records[0]?.store_type ?? null;
  const daysSince = getDaysSinceFetch(fetchedAt);
  const isStale = daysSince != null && daysSince >= 30;

  // ─── レンダリング ──────────────────────────────────────────────────
  return (
    <>
      <Paper elevation={1} sx={{ p: 1, mb: 1 }}>
        {/* ─── ヘッダー行 ──────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.72rem', color: 'text.secondary' }}>
            🚉 交通アクセス
          </Typography>

          {storeType === 'fukuoka' && (
            <Chip label="福岡" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#e3f2fd', color: '#1565c0' }} />
          )}
          {storeType === 'oita' && (
            <Chip label="大分" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#e8f5e9', color: '#2e7d32' }} />
          )}

          {fetchedAt && (
            <Typography variant="caption" sx={{ fontSize: '0.62rem', color: isStale ? 'warning.main' : 'text.disabled' }}>
              {isStale ? `⚠️ ${daysSince}日前` : `取得: ${formatDate(fetchedAt)}`}
            </Typography>
          )}

          <Tooltip title="Google Maps Places API より自動取得。路線名/運行事業者は✏️ボタンで手動入力できます。" placement="top">
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', cursor: 'help' }}>ℹ️</Typography>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          {isBusy ? (
            <CircularProgress size={14} />
          ) : (
            <Tooltip title={records.length > 0 ? '再取得（選択状態・手動修正は保持）' : '交通アクセスを取得する'} placement="top">
              <IconButton size="small" onClick={handleFetch} sx={{ p: 0.25 }}>
                <RefreshIcon sx={{ fontSize: '0.95rem' }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* ─── エラー ──────────────────────────────────────────────── */}
        {fetchError && (
          <Alert severity="warning" sx={{ py: 0, px: 1, mb: 0.5, fontSize: '0.68rem', '& .MuiAlert-message': { py: 0.3 } }}>
            {fetchError}
          </Alert>
        )}

        {/* ─── 未取得 ──────────────────────────────────────────────── */}
        {!loading && records.length === 0 && !fetchError && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
              未取得 —
            </Typography>
            <Typography
              component="span" variant="caption"
              onClick={handleFetch}
              sx={{ fontSize: '0.7rem', color: 'primary.main', cursor: 'pointer', textDecoration: 'underline' }}
            >
              取得する
            </Typography>
          </Box>
        )}

        {/* ─── 2列レイアウト（駅 | バス停）────────────────────────── */}
        {records.length > 0 && (
          <>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              {/* 左列: 最寄り駅 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 'bold', color: 'text.secondary', display: 'block', mb: 0.2 }}>
                  🚉 最寄り駅
                </Typography>
                {stations.length > 0
                  ? stations.map(r => (
                      <TransitRow
                        key={r.id}
                        record={r}
                        onToggleSelected={handleToggleSelected}
                        onEdit={openEdit}
                        onToggleConfirmed={handleToggleConfirmed}
                      />
                    ))
                  : <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                      該当する駅が見つかりませんでした
                    </Typography>
                }
              </Box>

              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

              {/* 右列: 最寄りバス停 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 'bold', color: 'text.secondary', display: 'block', mb: 0.2 }}>
                  🚌 最寄りバス停
                </Typography>
                {busStops.length > 0
                  ? busStops.map(r => (
                      <TransitRow
                        key={r.id}
                        record={r}
                        onToggleSelected={handleToggleSelected}
                        onEdit={openEdit}
                        onToggleConfirmed={handleToggleConfirmed}
                      />
                    ))
                  : <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                      該当するバス停が見つかりませんでした
                    </Typography>
                }
              </Box>
            </Box>

            {/* ─── 広告掲載プレビュー ────────────────────────────── */}
            {selectedRecords.length > 0 && (
              <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid #e0e0e0' }}>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 'bold' }}>
                  📋 広告掲載プレビュー：
                </Typography>
                {selectedRecords.map(r => (
                  <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.1 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.primary' }}>
                      {buildAdText(r)}
                    </Typography>
                    {r.is_estimated_distance && !r.is_manually_corrected && (
                      <Tooltip title="Directions API が利用できず直線距離から推定した値です。✏️で手動修正してください。" placement="top">
                        <Typography component="span" sx={{ fontSize: '0.6rem', color: 'warning.main', cursor: 'help' }}>⚠️推定</Typography>
                      </Tooltip>
                    )}
                    {r.is_manually_corrected && (
                      <Chip label="修正済" size="small" sx={{ height: 14, fontSize: '0.58rem', bgcolor: '#fff3e0', color: '#e65100' }} />
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </Paper>

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
            fullWidth size="small" sx={{ mb: 1.5, mt: 0.5 }}
          />
          <TextField
            label="路線名 / バス運行事業者"
            value={editLineName}
            onChange={e => setEditLineName(e.target.value)}
            fullWidth size="small"
            helperText="例: JR日豊本線 / 大分バス"
            sx={{ mb: 1.5 }}
          />
          <TextField
            label="徒歩分数（分）"
            value={editWalkMinutes}
            onChange={e => setEditWalkMinutes(e.target.value)}
            fullWidth size="small" type="number"
            inputProps={{ min: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          {editTarget?.is_manually_corrected && (
            <Button onClick={handleClearEdit} disabled={saving} size="small" color="warning" sx={{ mr: 'auto', fontSize: '0.75rem' }}>
              修正をクリア
            </Button>
          )}
          <Button onClick={() => setEditTarget(null)} size="small" disabled={saving}>キャンセル</Button>
          <Button onClick={handleSaveEdit} variant="contained" size="small" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ────────────────────────────────────────────
// 1行分の交通機関レコード表示
// ────────────────────────────────────────────

const RANK_BADGE = ['①', '②', '③'];

interface TransitRowProps {
  record: TransitRecord;
  onToggleSelected: (r: TransitRecord) => void;
  onEdit: (r: TransitRecord) => void;
  onToggleConfirmed: (r: TransitRecord) => void;
}

const TransitRow: React.FC<TransitRowProps> = ({ record: r, onToggleSelected, onEdit, onToggleConfirmed }) => {
  const displayName = getDisplayName(r);
  const displayLine = getDisplayLineName(r);
  const displayMins = getDisplayWalkMinutes(r);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.3,
        py: 0.15,
        px: 0.3,
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
        sx={{ p: 0.15, '& .MuiSvgIcon-root': { fontSize: '0.95rem' } }}
      />

      {/* 順位 */}
      <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.disabled', minWidth: 13, flexShrink: 0 }}>
        {RANK_BADGE[r.rank - 1] ?? r.rank}
      </Typography>

      {/* 名称・路線・距離 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* 名称 */}
        <Typography
          variant="caption"
          sx={{ fontSize: '0.7rem', color: 'text.primary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {displayName || '—'}
          {displayLine && (
            <Typography component="span" sx={{ fontSize: '0.62rem', color: 'text.secondary', ml: 0.3 }}>
              （{displayLine}）
            </Typography>
          )}
        </Typography>

        {/* 徒歩分数 — 目立つ色で表示 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          {displayMins != null && (
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.primary', fontWeight: 600 }}>
              徒歩{displayMins}分
            </Typography>
          )}
          {r.walk_distance_m != null && (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
              ({r.walk_distance_m}m)
            </Typography>
          )}
          {r.is_estimated_distance && !r.is_manually_corrected && (
            <Typography component="span" sx={{ fontSize: '0.58rem', color: 'warning.main' }}>推定</Typography>
          )}
          {r.is_manually_corrected && (
            <Chip label="修正" size="small" sx={{ height: 13, fontSize: '0.57rem', bgcolor: '#fff3e0', color: '#e65100' }} />
          )}
        </Box>

        {/* 博多駅までの経路情報（FI売主の駅のみ） */}
        {r.transport_type === 'station' && r.transit_to_hakata_text && (
          <Typography variant="caption" sx={{ fontSize: '0.62rem', color: '#1565c0', display: 'block' }}>
            🚇 {r.transit_to_hakata_text}
          </Typography>
        )}
      </Box>

      {/* 確認済みアイコン */}
      {r.is_confirmed && (
        <CheckCircleOutlineIcon sx={{ fontSize: '0.8rem', color: 'success.main', flexShrink: 0 }} />
      )}

      {/* 編集ボタン */}
      <Tooltip title="手動修正（路線名・徒歩分数を入力）" placement="top">
        <IconButton size="small" onClick={() => onEdit(r)} sx={{ p: 0.15, flexShrink: 0 }}>
          <EditIcon sx={{ fontSize: '0.78rem', color: 'text.disabled' }} />
        </IconButton>
      </Tooltip>

      {/* 確認済みトグルボタン */}
      <Tooltip title={r.is_confirmed ? '確認済みを解除' : '確認済みにする'} placement="top">
        <IconButton size="small" onClick={() => onToggleConfirmed(r)} sx={{ p: 0.15, flexShrink: 0 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: '0.78rem', color: r.is_confirmed ? 'success.main' : 'text.disabled' }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default TransitAccessPanel;
