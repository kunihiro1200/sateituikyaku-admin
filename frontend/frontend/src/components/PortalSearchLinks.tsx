import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Divider,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Link,
  Chip,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Map as MapIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface PortalSearchLinksProps {
  /** 売主ID（UUID） */
  sellerId?: string;
  /** 物件住所（例: 大分市舞鶴町1丁目） */
  propertyAddress?: string;
  /** 種別（英語値 or スプレッドシート略称） */
  propertyType?: string;
  /** 築年（西暦 例: 2005） */
  buildYear?: number;
}

type CaseType = 'tochi' | 'chukoikkodate' | 'manshon';

interface NearbyCase {
  case_type: CaseType;
  title: string;
  price: string;
  address: string;
  area?: string;
  tsubo?: string;
  tsubo_tanka?: string;
  building_condition?: string;
  built_year?: string;
  building_area?: string;
  land_area_str?: string;
  exclusive_area?: string;
  floor_plan?: string;
  url: string;
}

// ============================================================
// athome エリア固定URL定義
// ============================================================
interface AthomeAreaConfig {
  label: string;
  mapUrl: Record<string, string>;
  listUrl: Record<string, string>;
}

const ATHOME_AREAS: Array<{ keywords: string[]; config: AthomeAreaConfig }> = [
  {
    keywords: ['別府'],
    config: {
      label: '別府市',
      mapUrl: {
        mansion: 'https://www.athome.co.jp/mansion/chuko/oita/map/list/?LAT=33.28462795555556&LON=131.49125743333306&CRN=beppu',
        house:   'https://www.athome.co.jp/kodate/chuko/oita/map/list/?LAT=33.28462795555556&LON=131.49125743333306&CRN=beppu',
        land:    'https://www.athome.co.jp/tochi/oita/map/list/?LAT=33.28462795555556&LON=131.49125743333306&CRN=beppu',
      },
      listUrl: {
        mansion: 'https://www.athome.co.jp/mansion/chuko/oita/list/?pref=44&cities=beppu&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1&sort=95&limit=30',
        house:   'https://www.athome.co.jp/kodate/chuko/oita/list/?pref=44&cities=beppu&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1&sort=95&limit=30',
        land:    'https://www.athome.co.jp/tochi/oita/list/?pref=44&cities=beppu&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1',
      },
    },
  },
  {
    keywords: ['大分'],
    config: {
      label: '大分市',
      mapUrl: {
        mansion: 'https://www.athome.co.jp/mansion/chuko/oita/map/list/?LAT=33.2395496&LON=131.609348025&CRN=oita',
        house:   'https://www.athome.co.jp/kodate/chuko/oita/map/list/?LAT=33.2395496&LON=131.609348025&CRN=oita',
        land:    'https://www.athome.co.jp/tochi/oita/map/list/?LAT=33.2395496&LON=131.609348025&CRN=oita',
      },
      listUrl: {
        mansion: 'https://www.athome.co.jp/mansion/chuko/oita/list/?pref=44&cities=oita&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1',
        house:   'https://www.athome.co.jp/kodate/chuko/oita/list/?pref=44&cities=oita&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1',
        land:    'https://www.athome.co.jp/tochi/oita/list/?pref=44&cities=oita&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1',
      },
    },
  },
];

function detectAthomeArea(address: string): AthomeAreaConfig | null {
  for (const entry of ATHOME_AREAS) {
    if (entry.keywords.some(kw => address.includes(kw))) return entry.config;
  }
  return null;
}

function resolveKind(propertyType: string | undefined): 'mansion' | 'house' | 'land' {
  const t = propertyType ?? '';
  if (t === 'マ' || t === 'マンション' || t === 'apartment') return 'mansion';
  if (t === '土' || t === '土地'       || t === 'land')      return 'land';
  return 'house';
}

function kindLabel(kind: 'mansion' | 'house' | 'land'): string {
  return kind === 'mansion' ? 'マンション' : kind === 'land' ? '土地' : '戸建て';
}

function caseTypeLabel(ct: CaseType): string {
  return ct === 'manshon' ? '中古マンション' : ct === 'chukoikkodate' ? '中古一戸建て' : '土地';
}

// ============================================================
// PortalSearchLinks コンポーネント
// ============================================================
const PortalSearchLinks: React.FC<PortalSearchLinksProps> = ({
  sellerId,
  propertyAddress,
  propertyType,
  buildYear,
}) => {
  const kind = useMemo(() => resolveKind(propertyType), [propertyType]);
  const athomeArea = useMemo(() => detectAthomeArea(propertyAddress ?? ''), [propertyAddress]);

  // ── SUUMO周辺事例 ──
  const [cases, setCases] = useState<NearbyCase[]>([]);
  const [caseType, setCaseType] = useState<CaseType>('chukoikkodate');
  const [sourceUrl, setSourceUrl] = useState('');
  const [areaLabel, setAreaLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const fetchSuumoCases = async () => {
    if (!sellerId) return;
    setLoading(true);
    setError(null);
    setCases([]);
    setFetched(false);
    try {
      const res = await api.get(`/api/sellers/${sellerId}/nearby-cases-suumo`);
      setCases(res.data.cases || []);
      setCaseType(res.data.case_type || 'chukoikkodate');
      setSourceUrl(res.data.source_url || '');
      setAreaLabel(res.data.area_label || '');
      setFetched(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'SUUMO周辺事例の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!propertyAddress) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="text.secondary">
          物件住所が設定されていないため検索リンクを生成できません
        </Typography>
      </Box>
    );
  }

  const btnBase = {
    fontWeight: 'bold',
    fontSize: '0.82rem',
    px: 2,
    py: 0.75,
    borderRadius: 1.5,
    textTransform: 'none' as const,
  };

  const headerBg =
    caseType === 'manshon' ? '#f3e5f5' :
    caseType === 'chukoikkodate' ? '#e8f5e9' : '#e3f2fd';

  return (
    <Box sx={{ p: 1 }}>

      {/* ── athome ボタン群 ── */}
      {athomeArea ? (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.75, display: 'block' }}>
            athome（{athomeArea.label} / {kindLabel(kind)}）
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="contained" size="small"
              href={athomeArea.mapUrl[kind] ?? athomeArea.mapUrl['house']}
              target="_blank" rel="noopener noreferrer"
              startIcon={<MapIcon sx={{ fontSize: '1rem' }} />}
              endIcon={<OpenInNewIcon sx={{ fontSize: '0.8rem' }} />}
              sx={{ ...btnBase, bgcolor: '#e64a19', '&:hover': { bgcolor: '#bf360c' } }}
            >
              athome 地図
            </Button>
            <Button
              variant="contained" size="small"
              href={athomeArea.listUrl[kind] ?? athomeArea.listUrl['house']}
              target="_blank" rel="noopener noreferrer"
              startIcon={<SearchIcon sx={{ fontSize: '1rem' }} />}
              endIcon={<OpenInNewIcon sx={{ fontSize: '0.8rem' }} />}
              sx={{ ...btnBase, bgcolor: '#e64a19', '&:hover': { bgcolor: '#bf360c' } }}
            >
              athome 住所検索
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            athome: 対応エリア外（現在対応: 大分市・別府市）
          </Typography>
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* ── SUUMO 周辺事例 ── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
            📊 SUUMO 周辺事例（半径1km）
          </Typography>
          {buildYear && buildYear > 0 && (
            <Chip
              label={`築${buildYear - 5}〜${buildYear + 5}年 ※参考`}
              size="small"
              sx={{ fontSize: '0.68rem', height: 18 }}
            />
          )}
        </Box>

        {!fetched && !loading && (
          <Button
            variant="outlined" size="small"
            onClick={fetchSuumoCases}
            disabled={!sellerId}
            startIcon={<SearchIcon />}
            sx={{ ...btnBase, borderColor: '#31a736', color: '#31a736', '&:hover': { borderColor: '#1a7a1e', bgcolor: '#f1fbf2' } }}
          >
            SUUMOで周辺事例を取得
          </Button>
        )}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">SUUMOから取得中（10〜30秒）...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="warning" sx={{ mt: 1, py: 0.5, fontSize: '0.78rem' }}
            action={
              <Button size="small" onClick={fetchSuumoCases}>再試行</Button>
            }
          >
            {error}
          </Alert>
        )}

        {fetched && !loading && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                {areaLabel} / {caseTypeLabel(caseType)}（{cases.length}件）
              </Typography>
              {sourceUrl && (
                <Link href={sourceUrl} target="_blank" rel="noopener noreferrer"
                  sx={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 0.3 }}>
                  SUUMO一覧 <OpenInNewIcon sx={{ fontSize: '0.85rem' }} />
                </Link>
              )}
              <Button size="small" variant="outlined" onClick={fetchSuumoCases}
                startIcon={<RefreshIcon sx={{ fontSize: '0.9rem' }} />}
                sx={{ fontSize: '0.72rem', py: 0.25, px: 1, minWidth: 0 }}>
                再取得
              </Button>
            </Box>

            {cases.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                周辺事例が見つかりませんでした
              </Typography>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ fontSize: '0.78rem' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: headerBg }}>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5, whiteSpace: 'nowrap' }}>No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5, minWidth: 140 }}>所在地</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap' }}>価格</TableCell>
                      {caseType === 'tochi' && <>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap' }}>面積</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap' }}>坪単価</TableCell>
                      </>}
                      {caseType === 'chukoikkodate' && <>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap' }}>建物面積</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap' }}>土地面積</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5, whiteSpace: 'nowrap' }}>築年月</TableCell>
                      </>}
                      {caseType === 'manshon' && <>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap' }}>専有面積</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5, whiteSpace: 'nowrap' }}>築年月</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5, whiteSpace: 'nowrap' }}>間取り</TableCell>
                      </>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cases.map((c, i) => (
                      <TableRow key={i} sx={{ '&:nth-of-type(even)': { bgcolor: '#fafafa' } }}>
                        <TableCell sx={{ fontSize: '0.72rem', py: 0.5, color: 'text.secondary' }}>{i + 1}</TableCell>
                        <TableCell sx={{ fontSize: '0.72rem', py: 0.5, maxWidth: 200 }}>
                          {c.url ? (
                            <Link href={c.url} target="_blank" rel="noopener noreferrer"
                              sx={{ fontSize: '0.72rem', display: 'block' }}>
                              {c.address !== '-' ? c.address : c.url}
                            </Link>
                          ) : (
                            <span>{c.address !== '-' ? c.address : '-'}</span>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap' }}>{c.price}</TableCell>
                        {caseType === 'tochi' && <>
                          <TableCell sx={{ fontSize: '0.72rem', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap' }}>{c.area}</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem', fontWeight: 'bold', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap', color: '#1976d2' }}>{c.tsubo_tanka}</TableCell>
                        </>}
                        {caseType === 'chukoikkodate' && <>
                          <TableCell sx={{ fontSize: '0.72rem', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap' }}>{c.building_area || '-'}</TableCell>
                          <TableCell sx={{ fontSize: '0.72rem', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap' }}>{c.land_area_str || '-'}</TableCell>
                          <TableCell sx={{ fontSize: '0.72rem', py: 0.5, whiteSpace: 'nowrap' }}>{c.built_year || '-'}</TableCell>
                        </>}
                        {caseType === 'manshon' && <>
                          <TableCell sx={{ fontSize: '0.72rem', py: 0.5, textAlign: 'right', whiteSpace: 'nowrap' }}>{c.exclusive_area || '-'}</TableCell>
                          <TableCell sx={{ fontSize: '0.72rem', py: 0.5, whiteSpace: 'nowrap' }}>{c.built_year || '-'}</TableCell>
                          <TableCell sx={{ fontSize: '0.72rem', py: 0.5, whiteSpace: 'nowrap' }}>{c.floor_plan || '-'}</TableCell>
                        </>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PortalSearchLinks;
