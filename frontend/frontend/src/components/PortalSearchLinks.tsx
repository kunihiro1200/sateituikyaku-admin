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

/** 物件種別の正規化結果 */
type PropertyKind = 'house' | 'mansion' | 'land' | 'other';

interface PortalCategory {
  kind: PropertyKind;
  label: string;
}

/**
 * 物件種別を正規化する
 */
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

/**
 * 住所から「市区町村＋町名」のみを抽出する（番地・丁目・マンション名は除去）
 * 例: "福岡市西区下山門2丁目10-18モントーレ姪浜ウエストコート306" → "福岡市西区下山門"
 */
function extractSearchKeyword(address: string): string {
  if (!address) return '';
  // 都道府県を除去
  let s = address.replace(/^(北海道|東京都|大阪府|京都府|.{2,3}県)/, '');
  // 「丁目」より後ろを全部除去（番地・マンション名等も含むため）
  s = s.replace(/[0-9０-９]+丁目.*$/, '');
  s = s.replace(/[一二三四五六七八九十百]+丁目.*$/, '');
  // 数字が続く部分（番地）以降を除去
  s = s.replace(/[0-9０-９]+[-－ー番地号].*$/, '');
  return s.trim();
}

/**
 * SUUMO 検索URL
 * フリーワード検索: /ms/chuko/?fw=キーワード（マンション）
 *                  /kodate/chuko/?fw=キーワード（一戸建て）
 *                  /tochi/?fw=キーワード（土地）
 * 築年数フィルタ: cn=築年数以内（例: cn=30 = 築30年以内）
 */
function buildSuumoUrl(keyword: string, category: PortalCategory, buildYear?: number): string {
  const fw = encodeURIComponent(keyword);
  const currentYear = new Date().getFullYear();
  // 築年-5年より新しい物件 = 築(currentYear - (buildYear-5))年以内
  const yearMin = buildYear && buildYear > 0 ? buildYear - 5 : undefined;
  const ageMax = yearMin ? currentYear - yearMin : undefined;

  if (category.kind === 'mansion') {
    let url = `https://suumo.jp/ms/chuko/?fw=${fw}`;
    if (ageMax && ageMax > 0) url += `&cn=${ageMax}`;
    return url;
  } else if (category.kind === 'land') {
    return `https://suumo.jp/tochi/?fw=${fw}`;
  } else {
    let url = `https://suumo.jp/kodate/chuko/?fw=${fw}`;
    if (ageMax && ageMax > 0) url += `&cn=${ageMax}`;
    return url;
  }
}

/**
 * athome 検索URL
 * keyword パラメータを使う
 * 中古マンション: /mansion/chuko/list/
 * 中古一戸建て:   /kodate/chuko/list/
 * 土地:          /tochi/list/
 */
function buildAthomeUrl(keyword: string, category: PortalCategory, buildYear?: number): string {
  const kw = encodeURIComponent(keyword);
  const yearMin = buildYear && buildYear > 0 ? buildYear - 5 : undefined;
  const yearMax = buildYear && buildYear > 0 ? buildYear + 5 : undefined;

  if (category.kind === 'mansion') {
    let url = `https://www.athome.co.jp/mansion/chuko/list/?keyword=${kw}`;
    if (yearMin && yearMax) url += `&CONSTRUCT_YEAR_FROM=${yearMin}&CONSTRUCT_YEAR_TO=${yearMax}`;
    return url;
  } else if (category.kind === 'land') {
    return `https://www.athome.co.jp/tochi/list/?keyword=${kw}`;
  } else {
    let url = `https://www.athome.co.jp/kodate/chuko/list/?keyword=${kw}`;
    if (yearMin && yearMax) url += `&CONSTRUCT_YEAR_FROM=${yearMin}&CONSTRUCT_YEAR_TO=${yearMax}`;
    return url;
  }
}

/**
 * HOME'S 検索URL（keyword パラメータで直接動作）
 */
function buildHomesUrl(keyword: string, category: PortalCategory, buildYear?: number): string {
  const encoded = encodeURIComponent(keyword);
  const yearMin = buildYear && buildYear > 0 ? buildYear - 5 : undefined;
  const yearMax = buildYear && buildYear > 0 ? buildYear + 5 : undefined;

  if (category.kind === 'mansion') {
    let url = `https://www.homes.co.jp/mansion/chuko/list/?keyword=${encoded}`;
    if (yearMin && yearMax) url += `&build_year_from=${yearMin}&build_year_to=${yearMax}`;
    return url;
  } else if (category.kind === 'land') {
    return `https://www.homes.co.jp/tochi/list/?keyword=${encoded}`;
  } else {
    let url = `https://www.homes.co.jp/kodate/chuko/list/?keyword=${encoded}`;
    if (yearMin && yearMax) url += `&build_year_from=${yearMin}&build_year_to=${yearMax}`;
    return url;
  }
}

/**
 * Yahoo!不動産 検索URL
 * type: 1=マンション, 2=一戸建て, 3=土地
 */
function buildYahooRealEstateUrl(keyword: string, category: PortalCategory, buildYear?: number): string {
  const typeCode = category.kind === 'mansion' ? '1' : category.kind === 'land' ? '3' : '2';
  const yearMin = buildYear && buildYear > 0 ? buildYear - 5 : undefined;
  const yearMax = buildYear && buildYear > 0 ? buildYear + 5 : undefined;

  let url = `https://realestate.yahoo.co.jp/used/search?q=${encodeURIComponent(keyword)}&type=${typeCode}`;
  if (yearMin && yearMax) url += `&build_year_min=${yearMin}&build_year_max=${yearMax}`;
  return url;
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

  // 検索キーワード（市区町村＋町名のみ、番地・マンション名は除去）
  const keyword = useMemo(
    () => extractSearchKeyword(propertyAddress ?? ''),
    [propertyAddress]
  );

  const hasAddress = keyword.length > 0;

  // 各サイトのURL
  const urls = useMemo(() => {
    if (!hasAddress) return null;
    return {
      suumo: buildSuumoUrl(keyword, category, buildYear),
      athome: buildAthomeUrl(keyword, category, buildYear),
      homes: buildHomesUrl(keyword, category, buildYear),
      yahoo: buildYahooRealEstateUrl(keyword, category, buildYear),
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
          ※ 各ボタンをクリックすると条件付き検索が別タブで開きます
        </Typography>
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* ポータルサイトボタン */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {/* SUUMO */}
        <Tooltip title={`SUUMOで「${keyword}」の${category.label}を検索`} arrow>
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
        <Tooltip title={`athomeで「${keyword}」の${category.label}を検索`} arrow>
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
        <Tooltip title={`HOME'Sで「${keyword}」の${category.label}を検索`} arrow>
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
        <Tooltip title={`Yahoo!不動産で「${keyword}」の${category.label}を検索`} arrow>
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
