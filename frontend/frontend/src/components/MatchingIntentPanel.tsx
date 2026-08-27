import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Autocomplete,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import api from '../services/api';
import { ALL_AREA_OPTIONS } from '../utils/buyerDesiredConditionsOptions';

const CONTACT_STATUS_OPTIONS = ['連絡済み', '連絡不要', '連絡未'] as const;

export const MATCH_TIMING_OPTIONS = ['今すぐ', '3ヶ月以内', '半年以内', '1年以内', '1年以上・様子見'] as const;

// 物件種別の選択肢
export const PROPERTY_TYPE_OPTIONS = ['マンション', '戸建て', '土地', 'その他'] as const;

const TIMING_COLOR: Record<string, string> = {
  '今すぐ': '#d32f2f',
  '3ヶ月以内': '#f57c00',
  '半年以内': '#fbc02d',
  '1年以内': '#689f38',
  '1年以上・様子見': '#757575',
};

interface MatchIntentData {
  matchIntentType?: string;
  matchAreas?: string[];
  matchAreaFreeText?: string | null;
  matchTiming?: string | null;
  matchPriceMin?: number | null;
  matchPriceMax?: number | null;
  matchMemo?: string | null;
  matchContactStatus?: string | null;
  matchPropertyTypes?: string[]; // 物件種別配列
  matchUpdatedAt?: string | null; // マッチング更新日時（これがあればマッチング有効）
}

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
  matchPropertyTypes: string[]; // 物件種別配列
  matchMemo: string | null;
  matchUpdatedAt: string | null;
  matchReasons: string[];
  urgencyScore: number;
  contactStatus: string;
  timingFreshness: 'fresh' | 'warning' | 'expired';
}

interface MatchingIntentPanelProps {
  entityType: 'seller' | 'buyer';
  entityId: string; // seller: UUID(id), buyer: buyer_number
  initialData?: MatchIntentData;
  /**
   * entityType='seller' の場合のみ有効。
   * 'sell'（デフォルト）: 売却条件を入力し、買主候補を検索する（既存の match-intent系エンドポイント）。
   * 'buy': 購入条件を入力し、他の売主（売却中）候補を検索する（buy-match-intent系エンドポイント）。
   * 売主は買い替え等で両方の意図を同時に持ちうるため、同じ売主に対して2つのパネルを並べて使う。
   */
  direction?: 'sell' | 'buy';
}

const formatManYen = (yen: number | null | undefined): string => {
  if (yen == null) return '';
  return String(Math.round(yen / 10000));
};

const parseManYenToYen = (man: string): number | null => {
  const trimmed = man.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 10000);
};

/**
 * 売主・買主の「マッチング欄」入力パネル。
 * 種別・エリア・時期・金額を構造化入力し、保存後に相手候補を検索できる。
 */
const MatchingIntentPanel: React.FC<MatchingIntentPanelProps> = ({ entityType, entityId, initialData, direction = 'sell' }) => {
  const [areas, setAreas] = useState<string[]>(initialData?.matchAreas || []);
  const [areaFreeText, setAreaFreeText] = useState<string>(initialData?.matchAreaFreeText || '');
  const [timing, setTiming] = useState<string>(initialData?.matchTiming || '');
  const [priceMin, setPriceMin] = useState<string>(formatManYen(initialData?.matchPriceMin));
  const [priceMax, setPriceMax] = useState<string>(formatManYen(initialData?.matchPriceMax));
  const [memo, setMemo] = useState<string>(initialData?.matchMemo || '');
  const [propertyTypes, setPropertyTypes] = useState<string[]>(initialData?.matchPropertyTypes || []);
  const [matchUpdatedAt, setMatchUpdatedAt] = useState<string | null>(initialData?.matchUpdatedAt || null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MatchCandidate[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [contactSaving, setContactSaving] = useState<Record<string, boolean>>({});

  // エリア自動計算用の状態
  const [calculatingAreas, setCalculatingAreas] = useState(false);
  const [areaCalculationError, setAreaCalculationError] = useState<string | null>(null);

  // entityId/direction（表示対象そのもの）が変わった時だけ入力欄をリセットする。
  // initialData は呼び出し元（CallModePage等）で毎レンダリングごとに新しいオブジェクトとして
  // 生成されるため、依存配列に入れると親の再レンダリングだけで入力中の値が上書きされてしまう
  // （例: エリアを自由入力してもタイプ中に他の操作で親が再レンダリングされると消える不具合）。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setAreas(initialData?.matchAreas || []);
    setAreaFreeText(initialData?.matchAreaFreeText || '');
    setTiming(initialData?.matchTiming || '');
    setPriceMin(formatManYen(initialData?.matchPriceMin));
    setPriceMax(formatManYen(initialData?.matchPriceMax));
    setMemo(initialData?.matchMemo || '');
    setPropertyTypes(initialData?.matchPropertyTypes || []);
    setMatchUpdatedAt(initialData?.matchUpdatedAt || null);
  }, [entityId, direction]);

  // 🚨 重要: matchUpdatedAtは別のuseEffectで管理（親の再レンダリングでも常に最新の値を反映）
  useEffect(() => {
    setMatchUpdatedAt(initialData?.matchUpdatedAt || null);
  }, [initialData?.matchUpdatedAt]);

  const basePath = entityType === 'seller' ? `/api/sellers/${entityId}` : `/api/buyers/${entityId}`;
  // 「買いたい」方向（売主が買い替え等で購入希望を持つケース）は独立したエンドポイント群を使う
  const intentPath = direction === 'buy' ? `${basePath}/buy-match-intent` : `${basePath}/match-intent`;
  const candidatesPath = direction === 'buy' ? `${basePath}/buy-match-candidates` : `${basePath}/match-candidates`;
  const contactStatusPathFor = useCallback((candidateId: string) =>
    direction === 'buy'
      ? `${basePath}/buy-match-candidates/${candidateId}/contact-status`
      : `${basePath}/match-candidates/${candidateId}/contact-status`,
    [basePath, direction]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await api.put(intentPath, {
        matchAreas: areas,
        matchAreaFreeText: areaFreeText.trim() || null,
        matchTiming: timing || null,
        matchPriceMin: parseManYenToYen(priceMin),
        matchPriceMax: parseManYenToYen(priceMax),
        matchMemo: memo.trim() || null,
        matchPropertyTypes: propertyTypes,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e: any) {
      setSaveError(e?.response?.data?.error?.message || e?.response?.data?.error || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [intentPath, areas, areaFreeText, timing, priceMin, priceMax, memo, propertyTypes]);

  const handleSearch = useCallback(async () => {
    setSearching(true);
    setSearchError(null);
    try {
      // 🚨 既にマッチングが有効（matchUpdatedAtがある）な場合は、無効化する
      if (matchUpdatedAt) {
        // マッチングを無効化（削除）
        await api.delete(intentPath);
        
        // 🚨 重要: 即座にリロード（他の処理を一切実行しない）
        window.location.reload();
        return;
      }

      // 検索前に最新の入力内容を保存しておく（保存し忘れたまま検索するのを防ぐ）
      await api.put(intentPath, {
        matchAreas: areas,
        matchAreaFreeText: areaFreeText.trim() || null,
        matchTiming: timing || null,
        matchPriceMin: parseManYenToYen(priceMin),
        matchPriceMax: parseManYenToYen(priceMax),
        matchMemo: memo.trim() || null,
        matchPropertyTypes: propertyTypes,
      });

      const res = await api.get(candidatesPath);
      setCandidates(res.data.candidates || []);
      setHasSearched(true);
      setMatchUpdatedAt(new Date().toISOString()); // マッチング有効化
    } catch (e: any) {
      setSearchError(e?.response?.data?.error?.message || e?.response?.data?.error || 'マッチング検索に失敗しました');
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  }, [intentPath, candidatesPath, areas, areaFreeText, timing, priceMin, priceMax, memo, propertyTypes, matchUpdatedAt]);

  // 保存済みの検索結果を取得する（GETのみ・保存はしない）。
  // ページを開いた時点で、既存のマッチング条件に対する候補を自動表示するために使う。
  const fetchExistingCandidates = useCallback(async () => {
    setSearching(true);
    setSearchError(null);
    try {
      const res = await api.get(candidatesPath);
      setCandidates(res.data.candidates || []);
      setHasSearched(true);
    } catch (e: any) {
      setSearchError(e?.response?.data?.error?.message || e?.response?.data?.error || 'マッチング検索に失敗しました');
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  }, [candidatesPath]);

  // パネルが表示されたら、保存済みのマッチング条件に対する候補を自動的に表示する
  // （手動で「🔍 マッチング」ボタンを押さなくても、既存の結果がそのまま見られるようにする）。
  // 🚨 重要: matchUpdatedAtがnullの場合（マッチング無効化）は候補を取得しない
  useEffect(() => {
    setHasSearched(false);
    setCandidates(null);
    
    // マッチングが有効な場合のみ候補を取得
    if (matchUpdatedAt) {
      fetchExistingCandidates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, direction, matchUpdatedAt]);

  // 各候補（相手）の連絡状況を更新する。相手ごとに個別のペアとして記録する。
  const handleContactStatusChange = useCallback(async (candidate: MatchCandidate, newStatus: string) => {
    setContactSaving((prev) => ({ ...prev, [candidate.id]: true }));
    try {
      await api.put(contactStatusPathFor(candidate.id), { contactStatus: newStatus });
      setCandidates((prev) =>
        prev ? prev.map((c) => (c.id === candidate.id ? { ...c, contactStatus: newStatus } : c)) : prev
      );
    } catch (e: any) {
      setSearchError(e?.response?.data?.error?.message || e?.response?.data?.error || '連絡状況の更新に失敗しました');
    } finally {
      setContactSaving((prev) => ({ ...prev, [candidate.id]: false }));
    }
  }, [contactStatusPathFor]);

  // 「買いたい」方向の場合、相手は必ず「売りたい」売主（entityTypeに関係なく）
  const counterpartLabel = direction === 'buy' ? '売主' : (entityType === 'seller' ? '買主' : '売主');

  // エリア自動計算（売りたい方向かつseller entityTypeの場合のみ有効）
  const handleCalculateAreas = useCallback(async () => {
    if (direction !== 'sell' || entityType !== 'seller') return;
    
    setCalculatingAreas(true);
    setAreaCalculationError(null);
    try {
      const res = await api.post(`/api/sellers/${entityId}/calculate-distribution-areas`);
      if (res.data.success && res.data.areas && res.data.areas.length > 0) {
        // 計算されたエリアを設定
        setAreas(res.data.areas);
        // 成功メッセージを表示（オプション）
        console.log('[Area Calculation Success]', {
          areas: res.data.areas,
          formatted: res.data.formatted,
          propertyAddress: res.data.propertyAddress,
          city: res.data.city
        });
      } else {
        setAreaCalculationError('エリアの計算に失敗しました。物件住所またはGoogle Map URLを確認してください。');
      }
    } catch (e: any) {
      console.error('[Area Calculation Error]', e);
      setAreaCalculationError(
        e?.response?.data?.message || 
        e?.response?.data?.error || 
        'エリアの自動計算に失敗しました'
      );
    } finally {
      setCalculatingAreas(false);
    }
  }, [direction, entityType, entityId]);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {direction === 'buy'
          ? `ここに入力した購入条件だけを使って売却中の${counterpartLabel}候補を検索します（コメント欄のAI解析は行いません）。`
          : `ここに入力した内容だけを使って${counterpartLabel}候補を検索します（コメント欄のAI解析は行いません）。`}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* エリア */}
        <Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
            <Autocomplete
              multiple
              size="small"
              options={ALL_AREA_OPTIONS.map((o) => o.value)}
              value={areas}
              onChange={(_, newValue) => setAreas(newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} label="エリア（既存エリアから選択）" placeholder="エリアを選択" />
              )}
              sx={{ flex: 1 }}
            />
            {/* 売りたい方向の場合のみエリア自動計算ボタンを表示 */}
            {direction === 'sell' && entityType === 'seller' && (
              <Button
                variant="outlined"
                size="small"
                onClick={handleCalculateAreas}
                disabled={calculatingAreas}
                sx={{ minWidth: '120px', height: '40px' }}
              >
                {calculatingAreas ? <CircularProgress size={18} /> : '物件住所から自動'}
              </Button>
            )}
          </Box>
          {areaCalculationError && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              {areaCalculationError}
            </Typography>
          )}
          {direction === 'sell' && entityType === 'seller' && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              ヒント: 「物件住所から自動」ボタンで物件リストの配信エリア番号と同じロジックでエリアを自動選択できます
            </Typography>
          )}
        </Box>
        <TextField
          size="small"
          label="エリア（自由入力・既存選択肢にない地名）"
          placeholder="例: 舞鶴町"
          value={areaFreeText}
          onChange={(e) => setAreaFreeText(e.target.value)}
          helperText="既存エリアに無い地名はここに入力してください。相手側の入力と部分一致で判定します"
        />

        {/* 時期 */}
        <FormControl size="small" fullWidth>
          <InputLabel id="match-timing-label">時期</InputLabel>
          <Select
            labelId="match-timing-label"
            label="時期"
            value={timing}
            onChange={(e) => setTiming(e.target.value)}
          >
            <MenuItem value="">未選択</MenuItem>
            {MATCH_TIMING_OPTIONS.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 種別（複数選択） */}
        <Box>
          <Autocomplete
            multiple
            size="small"
            options={[...PROPERTY_TYPE_OPTIONS]}
            value={propertyTypes}
            onChange={(_, newValue) => setPropertyTypes(newValue)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
              ))
            }
            renderInput={(params) => (
              <TextField {...params} label="種別（複数選択可）" placeholder="種別を選択" />
            )}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            複数選択した場合、いずれかの種別が一致すればマッチングします
          </Typography>
        </Box>

        {/* 金額（万円） */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            label="金額 下限（万円）"
            type="number"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="金額 上限（万円）"
            type="number"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            sx={{ flex: 1 }}
          />
        </Box>

        {/* 補足メモ */}
        <TextField
          size="small"
          label="補足メモ（マッチング判定には使用しません）"
          multiline
          minRows={2}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
            onClick={handleSave}
            disabled={saving}
          >
            保存
          </Button>
          <Button
            variant="contained"
            size="small"
            color={matchUpdatedAt ? "error" : "secondary"}
            startIcon={searching ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <SearchIcon fontSize="small" />}
            onClick={handleSearch}
            disabled={searching}
          >
            {matchUpdatedAt ? '❌ マッチングを解除' : `🔍 ${counterpartLabel}をマッチング`}
          </Button>
          {saveSuccess && <Typography variant="caption" color="success.main">保存しました</Typography>}
          {saveError && <Typography variant="caption" color="error">{saveError}</Typography>}
        </Box>
      </Box>

      {/* マッチング結果テーブル（常設表示。候補が複数になっても各行に連絡状況ボタンを持つ） */}
      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
          マッチング結果（{counterpartLabel}候補）
        </Typography>
        {searchError && <Alert severity="error" sx={{ mb: 2 }}>{searchError}</Alert>}
        {!searchError && hasSearched && candidates && candidates.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            条件に合う{counterpartLabel}が見つかりませんでした。エリア・金額を入力してから再度検索してください。
          </Typography>
        )}
        {!hasSearched && searching && (
          <Typography variant="body2" color="text.secondary">
            読み込み中...
          </Typography>
        )}
        {!hasSearched && !searching && (
          <Typography variant="body2" color="text.secondary">
            「🔍 {counterpartLabel}をマッチング」を押すと候補が表示されます。
          </Typography>
        )}
        {!searchError && candidates && candidates.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{counterpartLabel}番号</TableCell>
                <TableCell>時期</TableCell>
                <TableCell>種別・金額帯</TableCell>
                <TableCell>マッチ根拠</TableCell>
                <TableCell>連絡状況</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {candidates.map((c) => {
                const isStaleWarning = c.timingFreshness === 'warning';
                const isContacted = c.contactStatus !== '連絡未';
                console.log(`[MatchingIntentPanel] Candidate ${c.number || c.id}: contactStatus="${c.contactStatus}", isContacted=${isContacted}`);
                return (
                <TableRow 
                  key={c.id} 
                  sx={
                    isContacted 
                      ? { 
                          bgcolor: '#f5f5f5 !important', 
                          opacity: '0.6 !important',
                          '& > *': { opacity: '0.6 !important' }
                        } // 連絡済み・連絡不要はグレーアウト
                      : isStaleWarning 
                        ? { bgcolor: '#fff8e1' } // 連絡未で時期経過は黄色
                        : undefined // 連絡未で通常は白
                  }
                >
                  <TableCell>
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      component="a"
                      href={c.type === 'seller' ? `/sellers/${c.number}/call` : `/buyers/${c.number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'primary.main', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {c.number || c.id}{c.name ? `（${c.name}）` : ''}
                    </Typography>
                    {c.matchMemo && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        メモ: {c.matchMemo}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.matchTiming && (
                      <Chip
                        label={c.matchTiming}
                        size="small"
                        sx={{ bgcolor: TIMING_COLOR[c.matchTiming] || '#9e9e9e', color: 'white' }}
                      />
                    )}
                    {isStaleWarning && (
                      <Typography variant="caption" sx={{ display: 'block', color: '#e65100', fontWeight: 'bold', mt: 0.5 }}>
                        ⚠️ 要確認（時期経過）
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {/* 種別 */}
                    {c.matchPropertyTypes && c.matchPropertyTypes.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                        {c.matchPropertyTypes.map((type, idx) => (
                          <Chip
                            key={idx}
                            label={type}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        ))}
                      </Box>
                    )}
                    {/* 金額帯 */}
                    {(c.matchPriceMin || c.matchPriceMax) ? (
                      <Typography variant="caption">
                        {c.matchPriceMin ? `${formatManYen(c.matchPriceMin)}万` : '下限なし'} 〜 {c.matchPriceMax ? `${formatManYen(c.matchPriceMax)}万` : '上限なし'}
                      </Typography>
                    ) : '-'}
                    {c.matchAreaFreeText && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {c.matchAreaFreeText}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 220 }}>
                      {c.matchReasons.map((r, idx) => {
                        const isWarningReason = r.startsWith('⚠️');
                        return (
                          <Chip
                            key={idx}
                            label={r}
                            size="small"
                            variant={isWarningReason ? 'filled' : 'outlined'}
                            sx={isWarningReason ? { bgcolor: '#ffe0b2', color: '#e65100', fontWeight: 'bold' } : undefined}
                          />
                        );
                      })}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ToggleButtonGroup
                        value={c.contactStatus}
                        exclusive
                        size="small"
                        onChange={(_, newValue) => {
                          if (newValue) handleContactStatusChange(c, newValue);
                        }}
                        disabled={!!contactSaving[c.id]}
                      >
                        {CONTACT_STATUS_OPTIONS.map((opt) => (
                          <ToggleButton key={opt} value={opt} sx={{ fontSize: '0.7rem', py: 0.25, px: 0.75 }}>
                            {opt}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                      {contactSaving[c.id] && <CircularProgress size={14} />}
                    </Box>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
};

export default MatchingIntentPanel;
