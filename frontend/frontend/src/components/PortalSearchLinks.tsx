import React, { useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Divider,
} from '@mui/material';
import { OpenInNew as OpenInNewIcon, Map as MapIcon, Search as SearchIcon } from '@mui/icons-material';

interface PortalSearchLinksProps {
  /** 物件住所（例: 大分市舞鶴町1丁目） */
  propertyAddress?: string;
  /** 種別（英語値 or スプレッドシート略称） */
  propertyType?: string;
  /** 築年（西暦 例: 2005） */
  buildYear?: number;
}

/** 物件種別の正規化結果 */
type PropertyKind = 'house' | 'mansion' | 'land' | 'other';

interface PortalCategory {
  kind: PropertyKind;
  label: string;
}

function resolvePortalCategory(propertyType: string | undefined): PortalCategory {
  const t = propertyType ?? '';
  if (t === '戸' || t === '戸建' || t === '戸建て' || t === 'detached_house') {
    return { kind: 'house', label: '戸建て' };
  }
  if (t === 'マ' || t === 'マンション' || t === 'apartment') {
    return { kind: 'mansion', label: 'マンション' };
  }
  if (t === '土' || t === '土地' || t === 'land') {
    return { kind: 'land', label: '土地' };
  }
  return { kind: 'house', label: '戸建て' };
}

// ============================================================
// エリア定義
// ============================================================

interface AreaConfig {
  /** 表示名 */
  label: string;
  /** athome 地図URL（種別ごと） */
  athomeMapUrl: Record<PropertyKind, string>;
  /** athome 住所検索URL（種別ごと） */
  athomeListUrl: Record<PropertyKind, string>;
}

/**
 * 住所に含まれるキーワードからエリアを判定する
 * 順番重要：より具体的なものを先に書く（「別府」を「大分」より先に）
 */
const AREA_CONFIGS: Array<{ keywords: string[]; config: AreaConfig }> = [
  {
    keywords: ['別府'],
    config: {
      label: '別府市',
      athomeMapUrl: {
        mansion: 'https://www.athome.co.jp/mansion/chuko/oita/map/list/?LAT=33.28462795555556&LON=131.49125743333306&CRN=beppu',
        house:   'https://www.athome.co.jp/kodate/chuko/oita/map/list/?LAT=33.28462795555556&LON=131.49125743333306&CRN=beppu',
        land:    'https://www.athome.co.jp/tochi/oita/map/list/?LAT=33.28462795555556&LON=131.49125743333306&CRN=beppu',
        other:   'https://www.athome.co.jp/mansion/chuko/oita/map/list/?LAT=33.28462795555556&LON=131.49125743333306&CRN=beppu',
      },
      athomeListUrl: {
        mansion: 'https://www.athome.co.jp/mansion/chuko/oita/list/?pref=44&cities=beppu&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1&sort=95&limit=30',
        house:   'https://www.athome.co.jp/kodate/chuko/oita/list/?pref=44&cities=beppu&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1&sort=95&limit=30',
        land:    'https://www.athome.co.jp/tochi/oita/list/?pref=44&cities=beppu&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1',
        other:   'https://www.athome.co.jp/mansion/chuko/oita/list/?pref=44&cities=beppu&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1&sort=95&limit=30',
      },
    },
  },
  {
    keywords: ['大分'],
    config: {
      label: '大分市',
      athomeMapUrl: {
        mansion: 'https://www.athome.co.jp/mansion/chuko/oita/map/list/?LAT=33.2395496&LON=131.609348025&CRN=oita',
        house:   'https://www.athome.co.jp/kodate/chuko/oita/map/list/?LAT=33.2395496&LON=131.609348025&CRN=oita',
        land:    'https://www.athome.co.jp/tochi/oita/map/list/?LAT=33.2395496&LON=131.609348025&CRN=oita',
        other:   'https://www.athome.co.jp/mansion/chuko/oita/map/list/?LAT=33.2395496&LON=131.609348025&CRN=oita',
      },
      athomeListUrl: {
        mansion: 'https://www.athome.co.jp/mansion/chuko/oita/list/?pref=44&cities=oita&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1',
        house:   'https://www.athome.co.jp/kodate/chuko/oita/list/?pref=44&cities=oita&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1',
        land:    'https://www.athome.co.jp/tochi/oita/list/?pref=44&cities=oita&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1',
        other:   'https://www.athome.co.jp/mansion/chuko/oita/list/?pref=44&cities=oita&basic=kp120,kp001,kt424,kt101,ke001,kn001,kj001&kod=&q=1',
      },
    },
  },
];

/**
 * 住所からエリア設定を取得する
 */
function detectArea(address: string): AreaConfig | null {
  for (const entry of AREA_CONFIGS) {
    if (entry.keywords.some(kw => address.includes(kw))) {
      return entry.config;
    }
  }
  return null;
}

// ============================================================
// PortalSearchLinks コンポーネント
// ============================================================

const PortalSearchLinks: React.FC<PortalSearchLinksProps> = ({
  propertyAddress,
  propertyType,
}) => {
  const category = useMemo(() => resolvePortalCategory(propertyType), [propertyType]);
  const area = useMemo(() => detectArea(propertyAddress ?? ''), [propertyAddress]);

  if (!propertyAddress) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="text.secondary">
          物件住所が設定されていないため検索リンクを生成できません
        </Typography>
      </Box>
    );
  }

  if (!area) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="text.secondary">
          対応エリア外です（現在対応: 大分市・別府市）
        </Typography>
      </Box>
    );
  }

  const mapUrl = area.athomeMapUrl[category.kind];
  const listUrl = area.athomeListUrl[category.kind];

  const btnBase = {
    fontWeight: 'bold',
    fontSize: '0.82rem',
    px: 2,
    py: 0.75,
    borderRadius: 1.5,
    textTransform: 'none' as const,
  };

  return (
    <Box sx={{ p: 1 }}>
      {/* 検索条件バッジ */}
      <Box sx={{ mb: 1.5, p: 1, bgcolor: '#f5f5f5', borderRadius: 1, border: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
          🔍 検索条件
        </Typography>
        <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#333' }}>
          エリア: {area.label}　／　種別: {category.label}
        </Typography>
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* athome ボタン群 */}
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.75, display: 'block' }}>
        athome
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {/* 地図ボタン */}
        <Button
          variant="contained"
          size="small"
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<MapIcon sx={{ fontSize: '1rem' }} />}
          endIcon={<OpenInNewIcon sx={{ fontSize: '0.8rem' }} />}
          sx={{
            ...btnBase,
            bgcolor: '#e64a19',
            '&:hover': { bgcolor: '#bf360c' },
          }}
        >
          athome 地図
        </Button>

        {/* 住所検索ボタン */}
        <Button
          variant="contained"
          size="small"
          href={listUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<SearchIcon sx={{ fontSize: '1rem' }} />}
          endIcon={<OpenInNewIcon sx={{ fontSize: '0.8rem' }} />}
          sx={{
            ...btnBase,
            bgcolor: '#e64a19',
            '&:hover': { bgcolor: '#bf360c' },
          }}
        >
          athome 住所検索
        </Button>
      </Box>
    </Box>
  );
};

export default PortalSearchLinks;
