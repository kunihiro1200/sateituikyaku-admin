import React, { useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Chip,
  Divider,
  Tooltip,
} from '@mui/material';
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';

interface PortalSearchLinksProps {
  /** 物件住所（例: 福岡市早良区賀茂2丁目） */
  propertyAddress?: string;
  /** 種別（英語値 or スプレッドシート略称） */
  propertyType?: string;
  /** 築年（西暦 例: 2005） */
  buildYear?: number;
}

type SuumoCategory = 'kodate' | 'ms' | 'tochi';
type AthomeCategory = 'kodate' | 'mansion' | 'tochi';
type HomesCategory = 'kodate' | 'mansion' | 'tochi';

interface PortalCategory {
  suumo: SuumoCategory;
  athome: AthomeCategory;
  homes: HomesCategory;
  label: string;
}

/**
 * 物件種別を各ポータルサイト用の検索カテゴリに変換する
 */
function resolvePortalCategory(propertyType: string | undefined): PortalCategory {
  const t = propertyType ?? '';
  const normalized =
    t === '戸' || t === '戸建' || t === '戸建て' || t === 'detached_house'
      ? 'house'
      : t === 'マ' || t === 'マンション' || t === 'apartment'
      ? 'mansion'
      : t === '土' || t === '土地' || t === 'land'
      ? 'land'
      : 'house'; // デフォルトは戸建て

  if (normalized === 'mansion') {
    return { suumo: 'ms', athome: 'mansion', homes: 'mansion', label: 'マンション' };
  } else if (normalized === 'land') {
    return { suumo: 'tochi', athome: 'tochi', homes: 'tochi', label: '土地' };
  }
  return { suumo: 'kodate', athome: 'kodate', homes: 'kodate', label: '戸建て' };
}

/**
 * SUUMO 中古戸建て / 中古マンション / 土地 検索URLを生成する
 * 
 * SUUMO の検索URLは地域コードが必要なため、テキスト検索（キーワード）を使う
 * URL形式: https://suumo.jp/jj/bukken/ichiran/JJ010FJ001/?ar=030&bs=011&ta=40&sc=...&kb=1&kt=9999999&skb=0&skt=9999&cn=9999
 */
function buildSuumoUrl(
  address: string,
  category: 'kodate' | 'ms' | 'tochi' | null,
  buildYear?: number
): string {
  const keyword = encodeURIComponent(address);

  // 築年数フィルタ（SUUMOはkenchikuDate系パラメータ）
  // kt=築年上限(西暦), kb=築年下限(西暦)
  // SUUMOは「新築・築〇年以内」形式のため、ここはキーワード検索URLに絞り込み情報を付与
  let url = '';

  const yearMin = buildYear ? buildYear - 5 : undefined;
  const yearMax = buildYear ? buildYear + 5 : undefined;

  if (category === 'ms') {
    // 中古マンション
    url = `https://suumo.jp/ms/chuko/search/?ar=&bs=&keyword=${keyword}`;
    if (yearMin && yearMax) {
      url += `&kenchiku_year_from=${yearMin}&kenchiku_year_to=${yearMax}`;
    }
  } else if (category === 'tochi') {
    // 土地
    url = `https://suumo.jp/tochi/search/?keyword=${keyword}`;
  } else {
    // 中古一戸建て（デフォルト）
    url = `https://suumo.jp/kodate/chuko/search/?ar=&bs=&keyword=${keyword}`;
    if (yearMin && yearMax) {
      url += `&kenchiku_year_from=${yearMin}&kenchiku_year_to=${yearMax}`;
    }
  }

  return url;
}

/**
 * athome 検索URLを生成する
 * URL形式: https://www.athome.co.jp/kodate/chuko/list/?EPROPERTY_TYPE=chuko&...
 */
function buildAthomeUrl(
  address: string,
  category: 'kodate' | 'mansion' | 'tochi' | null,
  buildYear?: number
): string {
  const keyword = encodeURIComponent(address);

  const yearMin = buildYear ? buildYear - 5 : undefined;
  const yearMax = buildYear ? buildYear + 5 : undefined;

  let baseUrl = '';
  if (category === 'mansion') {
    baseUrl = `https://www.athome.co.jp/mansion/chuko/list/?LARGE_SCALE_FLG=1&keyword=${keyword}`;
    if (yearMin && yearMax) {
      baseUrl += `&CONSTRUCT_YEAR_FROM=${yearMin}&CONSTRUCT_YEAR_TO=${yearMax}`;
    }
  } else if (category === 'tochi') {
    baseUrl = `https://www.athome.co.jp/tochi/list/?keyword=${keyword}`;
  } else {
    // 中古一戸建て
    baseUrl = `https://www.athome.co.jp/kodate/chuko/list/?LARGE_SCALE_FLG=1&keyword=${keyword}`;
    if (yearMin && yearMax) {
      baseUrl += `&CONSTRUCT_YEAR_FROM=${yearMin}&CONSTRUCT_YEAR_TO=${yearMax}`;
    }
  }

  return baseUrl;
}

/**
 * HOME'S 検索URLを生成する
 * URL形式: https://www.homes.co.jp/kodate/chuko/list/?keyword=...
 */
function buildHomesUrl(
  address: string,
  category: 'kodate' | 'mansion' | 'tochi' | null,
  buildYear?: number
): string {
  const keyword = encodeURIComponent(address);
  const yearMin = buildYear ? buildYear - 5 : undefined;
  const yearMax = buildYear ? buildYear + 5 : undefined;

  let baseUrl = '';
  if (category === 'mansion') {
    baseUrl = `https://www.homes.co.jp/mansion/chuko/list/?keyword=${keyword}`;
    if (yearMin && yearMax) {
      baseUrl += `&build_year_from=${yearMin}&build_year_to=${yearMax}`;
    }
  } else if (category === 'tochi') {
    baseUrl = `https://www.homes.co.jp/tochi/list/?keyword=${keyword}`;
  } else {
    baseUrl = `https://www.homes.co.jp/kodate/chuko/list/?keyword=${keyword}`;
    if (yearMin && yearMax) {
      baseUrl += `&build_year_from=${yearMin}&build_year_to=${yearMax}`;
    }
  }

  return baseUrl;
}

/**
 * Yahoo!不動産 検索URLを生成する
 */
function buildYahooRealEstateUrl(
  address: string,
  buildYear?: number
): string {
  const keyword = encodeURIComponent(address);
  const yearMin = buildYear ? buildYear - 5 : undefined;
  const yearMax = buildYear ? buildYear + 5 : undefined;

  let baseUrl = `https://realestate.yahoo.co.jp/used/search?q=${keyword}`;
  if (yearMin && yearMax) {
    baseUrl += `&build_year_min=${yearMin}&build_year_max=${yearMax}`;
  }
  return baseUrl;
}

/**
 * 住所の「市区町村＋町名」を抽出して検索に使いやすい形にする
 * 例: "福岡市早良区賀茂2丁目10番11号" → "福岡市早良区賀茂"
 */
function extractSearchKeyword(address: string): string {
  if (!address) return '';
  // 都道府県を除去
  let s = address.replace(/^(北海道|東京都|大阪府|京都府|.{2,3}県)/, '');
  // 番地・号を除去（数字-数字-数字 or 数字番数字号 など）
  s = s.replace(/\d+番地?\d*号?$/, '').replace(/[0-9０-９]+[-－ー][0-9０-９]+[-－ー]?[0-9０-９]*$/, '');
  // 丁目以降を除去
  s = s.replace(/\d+丁目.*$/, '').replace(/[一二三四五六七八九十]+丁目.*$/, '');
  return s.trim();
}

/**
 * PortalSearchLinks コンポーネント
 * 
 * 物件の住所・種別・築年数をもとに各ポータルサイトの検索URLを生成してボタン表示する
 */
const PortalSearchLinks: React.FC<PortalSearchLinksProps> = ({
  propertyAddress,
  propertyType,
  buildYear,
}) => {
  const category = useMemo(() => resolvePortalCategory(propertyType), [propertyType]);

  // 検索キーワード（市区町村＋町名）
  const keyword = useMemo(
    () => extractSearchKeyword(propertyAddress ?? ''),
    [propertyAddress]
  );

  const hasAddress = keyword.length > 0;

  // 各サイトのURL
  const urls = useMemo(() => {
    if (!hasAddress) return null;
    return {
      suumo: buildSuumoUrl(keyword, category.suumo, buildYear),
      athome: buildAthomeUrl(keyword, category.athome, buildYear),
      homes: buildHomesUrl(keyword, category.homes, buildYear),
      yahoo: buildYahooRealEstateUrl(keyword, buildYear),
    };
  }, [keyword, category, buildYear, hasAddress]);

  // 条件の説明文
  const conditionText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`種別: ${category.label}`);
    if (buildYear && buildYear > 0) {
      parts.push(`築年: ${buildYear - 5}年〜${buildYear + 5}年`);
    }
    if (keyword) {
      parts.push(`エリア: ${keyword}`);
    }
    return parts.join('　／　');
  }, [category, buildYear, keyword]);

  if (!hasAddress) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="text.secondary">
          物件住所が設定されていないため検索リンクを生成できません
        </Typography>
      </Box>
    );
  }

  const buttonStyle = {
    fontWeight: 'bold',
    fontSize: '0.8rem',
    px: 1.5,
    py: 0.5,
    minWidth: 0,
    borderRadius: 1.5,
    textTransform: 'none' as const,
    gap: 0.5,
  };

  return (
    <Box sx={{ p: 1 }}>
      {/* 検索条件の表示 */}
      <Box sx={{ mb: 1.5, p: 1, bgcolor: '#f5f5f5', borderRadius: 1, border: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
          🔍 検索条件（自動生成）
        </Typography>
        <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#333' }}>
          {conditionText}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.7rem' }}>
          ※ 各ボタンをクリックすると、条件付き検索が別タブで開きます
        </Typography>
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* ポータルサイトボタン */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {/* SUUMO */}
        <Tooltip title={`SUUMO で「${keyword}」の${category.label}を検索`} arrow>
          <Button
            variant="contained"
            size="small"
            href={urls!.suumo}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon sx={{ fontSize: '0.85rem' }} />}
            sx={{
              ...buttonStyle,
              bgcolor: '#31a736',
              '&:hover': { bgcolor: '#268a2b' },
            }}
          >
            SUUMO
          </Button>
        </Tooltip>

        {/* athome */}
        <Tooltip title={`athome で「${keyword}」の${category.label}を検索`} arrow>
          <Button
            variant="contained"
            size="small"
            href={urls!.athome}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon sx={{ fontSize: '0.85rem' }} />}
            sx={{
              ...buttonStyle,
              bgcolor: '#e64a19',
              '&:hover': { bgcolor: '#bf360c' },
            }}
          >
            athome
          </Button>
        </Tooltip>

        {/* HOME'S */}
        <Tooltip title={`HOME'S で「${keyword}」の${category.label}を検索`} arrow>
          <Button
            variant="contained"
            size="small"
            href={urls!.homes}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon sx={{ fontSize: '0.85rem' }} />}
            sx={{
              ...buttonStyle,
              bgcolor: '#1565c0',
              '&:hover': { bgcolor: '#0d47a1' },
            }}
          >
            HOME&apos;S
          </Button>
        </Tooltip>

        {/* Yahoo!不動産 */}
        <Tooltip title={`Yahoo!不動産 で「${keyword}」の${category.label}を検索`} arrow>
          <Button
            variant="contained"
            size="small"
            href={urls!.yahoo}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon sx={{ fontSize: '0.85rem' }} />}
            sx={{
              ...buttonStyle,
              bgcolor: '#7b1fa2',
              '&:hover': { bgcolor: '#6a1b9a' },
            }}
          >
            Yahoo!不動産
          </Button>
        </Tooltip>
      </Box>

      {/* 築年数フィルタの補足 */}
      {buildYear && buildYear > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            築年フィルタ:
          </Typography>
          <Chip
            label={`${buildYear - 5}年以降`}
            size="small"
            sx={{ fontSize: '0.7rem', height: 20 }}
            color="default"
          />
          <Typography variant="caption" color="text.secondary">〜</Typography>
          <Chip
            label={`${buildYear + 5}年以前`}
            size="small"
            sx={{ fontSize: '0.7rem', height: 20 }}
            color="default"
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            ※サイトによって築年フィルタに対応していない場合があります
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default PortalSearchLinks;
