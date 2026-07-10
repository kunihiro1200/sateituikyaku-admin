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
  /** SUUMOの種別日本語（検索クエリに使う） */
  suumoLabel: string;
  /** athomeの種別日本語（検索クエリに使う） */
  athomeLabel: string;
}

/**
 * 物件種別を正規化する
 */
function resolvePortalCategory(propertyType: string | undefined): PortalCategory {
  const t = propertyType ?? '';
  if (t === '戸' || t === '戸建' || t === '戸建て' || t === 'detached_house') {
    return { kind: 'house', label: '戸建て', suumoLabel: '中古一戸建て', athomeLabel: '中古一戸建て' };
  }
  if (t === 'マ' || t === 'マンション' || t === 'apartment') {
    return { kind: 'mansion', label: 'マンション', suumoLabel: '中古マンション', athomeLabel: '中古マンション' };
  }
  if (t === '土' || t === '土地' || t === 'land') {
    return { kind: 'land', label: '土地', suumoLabel: '土地', athomeLabel: '土地' };
  }
  return { kind: 'house', label: '戸建て', suumoLabel: '中古一戸建て', athomeLabel: '中古一戸建て' };
}

/**
 * 住所から「市区町村＋町名」のみを抽出する（番地・丁目・マンション名は除去）
 * 例: "福岡市西区下山門2丁目10-18モントーレ姪浜ウエストコート306" → "福岡市西区下山門"
 */
function extractSearchKeyword(address: string): string {
  if (!address) return '';
  // 都道府県を除去
  let s = address.replace(/^(北海道|東京都|大阪府|京都府|.{2,3}県)/, '');
  // 「丁目」「番地」「号」より後ろを全部除去
  s = s.replace(/[0-9０-９]+丁目.*$/, '');
  s = s.replace(/[一二三四五六七八九十百]+丁目.*$/, '');
  // 数字が続く部分（番地）以降を除去
  s = s.replace(/[0-9０-９]+[-－ー番地号].*$/, '');
  // 末尾の空白を除去
  return s.trim();
}

/**
 * Google検索URL（site: 指定）を生成する
 * 各サイトのBot検知を回避し、かつ確実に検索結果を表示できる
 */
function buildGoogleSearchUrl(
  keyword: string,
  site: string,
  typeLabel: string,
  buildYear?: number
): string {
  const yearMin = buildYear && buildYear > 0 ? buildYear - 5 : undefined;
  const yearMax = buildYear && buildYear > 0 ? buildYear + 5 : undefined;

  let query = `site:${site} ${keyword} ${typeLabel} 募集中`;
  if (yearMin && yearMax) {
    query += ` 築${String(yearMin).slice(2)}年〜築${String(yearMax).slice(2)}年`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * SUUMO 検索URL（動作確認済みのパス形式）
 * https://suumo.jp/jj/bukken/ichiran/JJ010FJ001/ 形式はパラメータ多数必要のため
 * Google経由が最も確実
 */
function buildSuumoUrl(keyword: string, category: PortalCategory, buildYear?: number): string {
  return buildGoogleSearchUrl(keyword, 'suumo.jp', category.suumoLabel, buildYear);
}

/**
 * athome 検索URL
 * /please_wait/ にリダイレクトされるBot検知があるため Google経由
 */
function buildAthomeUrl(keyword: string, category: PortalCategory, buildYear?: number): string {
  return buildGoogleSearchUrl(keyword, 'athome.co.jp', category.athomeLabel, buildYear);
}

/**
 * HOME'S 検索URL
 * keyword パラメータが使えるが、キーワードは市区町村+町名のみにする
 */
function buildHomesUrl(keyword: string, category: PortalCategory, buildYear?: number): string {
  const encoded = encodeURIComponent(keyword);
  const yearMin = buildYear && buildYear > 0 ? buildYear - 5 : undefined;
  const yearMax = buildYear && buildYear > 0 ? buildYear + 5 : undefined;

  let baseUrl = '';
  if (category.kind === 'mansion') {
    baseUrl = `https://www.homes.co.jp/mansion/chuko/list/?keyword=${encoded}`;
    if (yearMin && yearMax) {
      baseUrl += `&build_year_from=${yearMin}&build_year_to=${yearMax}`;
    }
  } else if (category.kind === 'land') {
    baseUrl = `https://www.homes.co.jp/tochi/list/?keyword=${encoded}`;
  } else {
    baseUrl = `https://www.homes.co.jp/kodate/chuko/list/?keyword=${encoded}`;
    if (yearMin && yearMax) {
      baseUrl += `&build_year_from=${yearMin}&build_year_to=${yearMax}`;
    }
  }
  return baseUrl;
}

/**
 * Yahoo!不動産 検索URL
 */
function buildYahooRealEstateUrl(keyword: string, buildYear?: number): string {
  return buildGoogleSearchUrl(keyword, 'realestate.yahoo.co.jp', '中古 募集中', buildYear);
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
          ※ SUUMO・athome・Yahoo不動産はGoogle経由で検索します。HOME'Sは直接検索です。
        </Typography>
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* ポータルサイトボタン */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {/* SUUMO */}
        <Tooltip title={`Google経由でSUUMOの「${keyword}」${category.label}を検索`} arrow>
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
        <Tooltip title={`Google経由でathomeの「${keyword}」${category.label}を検索`} arrow>
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
        <Tooltip title={`HOME'Sで「${keyword}」の${category.label}を直接検索`} arrow>
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
        <Tooltip title={`Google経由でYahoo!不動産の「${keyword}」${category.label}を検索`} arrow>
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
