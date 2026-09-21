import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  Box,
  Tooltip,
  CircularProgress,
  TextField,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import PrintIcon from '@mui/icons-material/Print';
import HouseMakerModal from './HouseMakerModal';
import NearbyMapModal from './NearbyMapModal';
import { EvaluationPointsDisplay } from './EvaluationPointsEditor';
import type { BuyerDuplicateMatch } from './BuyerDuplicateCard';

export interface ViewingPreparationPopupProps {
  open: boolean;
  onClose: () => void;
  buyerNumber: string | null | undefined;
  propertyNumber: string | null | undefined;
  houseMaker?: string | null | undefined;
  googleMapUrl?: string | null | undefined;
  address?: string | null | undefined;
  buyer?: Record<string, any> | null;
  linkedProperties?: Array<Record<string, any>>;
  /** 他社物件情報（buyer.other_company_property）。値があれば他社物件とみなす */
  otherCompanyProperty?: string | null | undefined;
  /** 買主重複（同一人物の他レコード）。それぞれの内覧日で「何回目」を算出する */
  buyerDuplicates?: BuyerDuplicateMatch[];
}

// 固定リンク定数（ATBBのみ）
const FIXED_LINKS = [
  {
    label: 'ATBB',
    url: 'https://atbb.athome.jp/',
    description: '①詳細ページと②インフォシート1枚印刷',
  },
] as const;

interface CopyButtonProps {
  text: string;
  label: string;
}

/** 内覧日を YYYY/MM/DD 形式の文字列にする（表示用）。パースできなければ生値を返す */
function formatViewingDate(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return String(value).slice(0, 10);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

/** 内覧日を比較用のキー（YYYY-MM-DD）にする。無効なら null */
function viewingDateKey(value: string | Date | null | undefined): string | null {
  if (value == null || value === '') return null;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) {
    const s = String(value).slice(0, 10);
    return s || null;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 「今回が何回目の内覧か」を、買主重複（同一人物の他レコード）の内覧日から算出する。
 *
 * 考え方：
 * - この買主自身の viewing_date（今回の内覧）
 * - 買主重複それぞれの viewingDate
 * を集め、内覧日が入っているものだけを「1回の内覧」として数える。
 * 同じ内覧日の重複は1回に丸める。
 *
 * 過去（他レコード）に内覧日が1件も無ければ null（＝今回が初回、バッジ非表示）。
 *
 * @returns { count, ordinal, history } または null
 *   - count: 内覧の総回数（今回を含む）
 *   - ordinal: 今回が何回目か
 *   - history: 内覧日の一覧（新しい順）
 */
function computeViewingOrdinal(
  buyer?: Record<string, any> | null,
  buyerDuplicates?: BuyerDuplicateMatch[]
): { count: number; ordinal: number; history: string[] } | null {
  if (!buyer) return null;

  // 今回の内覧日（この買主レコード）
  const currentKey = viewingDateKey(buyer.viewing_date);

  // 買主重複それぞれの内覧日
  const dupKeys: string[] = [];
  for (const dup of buyerDuplicates || []) {
    const k = viewingDateKey(dup?.buyerInfo?.viewingDate);
    if (k) dupKeys.push(k);
  }

  // 他レコードに内覧日が1件も無ければ、複数回内覧の判定はできない → 非表示
  if (dupKeys.length === 0) {
    return null;
  }

  // 全内覧日（今回＋重複）をユニーク化
  const allKeys = new Set<string>();
  if (currentKey) allKeys.add(currentKey);
  for (const k of dupKeys) allKeys.add(k);

  const sortedDesc = Array.from(allKeys).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const count = sortedDesc.length;

  // 今回が何回目か：今回の内覧日が全体の中で古い方から数えて何番目か
  let ordinal = count;
  if (currentKey) {
    const sortedAsc = Array.from(allKeys).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    ordinal = sortedAsc.indexOf(currentKey) + 1;
  }

  const history = sortedDesc.map((k) => formatViewingDate(k));
  return { count, ordinal, history };
}

/** ワンクリックコピーボタン */
const CopyButton: React.FC<CopyButtonProps> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // navigator.clipboard が使用不可の場合のフォールバック
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Tooltip title={copied ? 'コピーしました！' : 'コピー'} placement="top">
      <Box
        component="span"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
        onClick={handleCopy}
      >
        <Typography
          component="span"
          sx={{
            fontWeight: 'bold',
            color: copied ? 'success.main' : 'text.primary',
          }}
        >
          {label}：{text}
        </Typography>
        {copied ? (
          <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
        ) : (
          <ContentCopyIcon sx={{ fontSize: 16, color: 'action.active' }} />
        )}
      </Box>
    </Tooltip>
  );
};

/**
 * 内覧準備ポップアップコンポーネント
 * 内覧前に必要な買主番号・物件番号のコピー機能と固定リンク2件を提供する
 */
export const ViewingPreparationPopup: React.FC<ViewingPreparationPopupProps> = ({
  open,
  onClose,
  buyerNumber,
  propertyNumber,
  houseMaker,
  googleMapUrl,
  address,
  buyer,
  linkedProperties,
  otherCompanyProperty,
  buyerDuplicates,
}) => {
  const hasBuyerNumber = buyerNumber != null && buyerNumber !== '';
  // 物件番号があるかどうか：propertyNumber プロップ、かつ linkedProperties に有効な物件番号を持つものがある
  const hasPropertyNumber = (propertyNumber != null && propertyNumber !== '')
    && (linkedProperties != null && linkedProperties.length > 0
        && linkedProperties.some((lp) => lp.property_number != null && lp.property_number !== ''));
  // 他社物件かどうか（buyer.other_company_property に値がある、または明示的に渡された）
  const otherCompanyValue = otherCompanyProperty ?? (buyer?.other_company_property as string | null | undefined);
  const isOtherCompanyProperty = !hasPropertyNumber
    && otherCompanyValue != null && String(otherCompanyValue).trim() !== '';
  // 2〜6の資料を表示するかどうか：自社物件（hasPropertyNumber）または他社物件
  const showMaterials = hasPropertyNumber || isOtherCompanyProperty;
  // 買主重複それぞれの内覧日から、今回が何回目かを算出（過去内覧が無ければ null）
  const viewingOrdinal = computeViewingOrdinal(buyer, buyerDuplicates);
  const [houseMakerModalOpen, setHouseMakerModalOpen] = useState(false);
  const [nearbyMapModalOpen, setNearbyMapModalOpen] = useState(false);
  const [printing1, setPrinting1] = useState(false);
  const [printing2, setPrinting2] = useState(false);
  const [printingCash, setPrintingCash] = useState(false);
  const [printingRepeater, setPrintingRepeater] = useState(false);
  const [printingCashRepeater, setPrintingCashRepeater] = useState(false);
  const [printingOther, setPrintingOther] = useState(false);

  // 他社物件の版（大分版 / 福岡版）。福岡版のとき property_number を 'FI' 扱いにして各ジェネレータの福岡分岐を有効化する
  const [otherRegion, setOtherRegion] = useState<'oita' | 'fukuoka'>('oita');
  // 他社物件の内覧準備資料（白黒）用の手入力フォーム
  const [manualInputOpen, setManualInputOpen] = useState(false);
  const [manualProp, setManualProp] = useState({
    address: '',
    property_type: '',
    price: '',
    floor_plan: '',
    structure: '',
    land_area: '',
    building_area: '',
    property_tax: '',
    management_fee: '',
    reserve_fund: '',
    parking: '',
    delivery: '',
    pre_viewing_notes: '',
  });

  // 他社物件情報（住所）を初期値として1回だけフォームにセット
  React.useEffect(() => {
    if (isOtherCompanyProperty && !manualProp.address) {
      const initAddr = (otherCompanyValue ? String(otherCompanyValue).trim() : '') || (address ? String(address).trim() : '');
      if (initAddr) setManualProp((prev) => ({ ...prev, address: initAddr }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOtherCompanyProperty, open]);

  // 手入力フォームの内容を印刷ジェネレータが受け取る物件オブジェクトに変換
  const buildManualProperty = (): Record<string, any> => {
    const num = (v: string) => {
      const n = Number(String(v).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) && String(v).trim() !== '' ? n : undefined;
    };
    return {
      // 福岡版はジェネレータの isFI 判定（property_number に 'FI' が含まれる）を有効にするため 'FI' を渡す
      property_number: otherRegion === 'fukuoka' ? 'FI' : '',
      address: manualProp.address || '',
      display_address: manualProp.address || '',
      property_type: manualProp.property_type || undefined,
      price: num(manualProp.price),
      floor_plan: manualProp.floor_plan || undefined,
      structure: manualProp.structure || undefined,
      land_area: num(manualProp.land_area),
      building_area: num(manualProp.building_area),
      property_tax: num(manualProp.property_tax),
      management_fee: num(manualProp.management_fee),
      reserve_fund: num(manualProp.reserve_fund),
      parking: manualProp.parking || undefined,
      delivery: manualProp.delivery || undefined,
      pre_viewing_notes: manualProp.pre_viewing_notes || undefined,
    };
  };

  function getTodayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }

  // 生成したHTMLをiframeで印刷する共通処理
  const printHtmlViaIframe = (html: string, setBusy: (v: boolean) => void) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { setBusy(false); document.body.removeChild(iframe); return; }
    doc.open(); doc.write(html); doc.close();
    const cleanup = () => { setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} setBusy(false); }, 1000); };
    const doPrint = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (_) {} cleanup(); };
    if (iframe.contentDocument?.readyState === 'complete') { setTimeout(doPrint, 800); }
    else { iframe.onload = () => setTimeout(doPrint, 800); setTimeout(doPrint, 2000); }
  };

  // 印刷対象の物件データ配列を取得する
  // - 他社物件: 手入力フォームの内容を1件の物件として返す
  // - 自社物件: linkedProperties を API から取得する
  const resolvePropertyDetails = async (): Promise<Record<string, any>[]> => {
    if (isOtherCompanyProperty) {
      return [buildManualProperty()];
    }
    const { default: api } = await import('../services/api');
    return Promise.all(
      (linkedProperties || []).map((lp: Record<string, any>) =>
        api.get(`/api/property-listings/${lp.property_number}`).then((r: any) => r.data)
      )
    );
  };

  // 汎用の印刷実行（バリアントごとのHTML生成関数を指定）
  const runPrint = (
    generatorKey: 'generateAllPagesHtml' | 'generateAllPagesCashHtml' | 'generateAllPagesRepeaterHtml' | 'generateAllPagesCashRepeaterHtml',
    setBusy: (v: boolean) => void,
  ) => {
    if (!buyer) return;
    // 他社物件は手入力フォームが必要
    if (!isOtherCompanyProperty && (!linkedProperties || linkedProperties.length === 0)) return;
    setBusy(true);
    resolvePropertyDetails().then((propertyDetails) => {
      import('../utils/printHtmlGenerators').then((mod) => {
        const generator = mod[generatorKey] as (b: Record<string, unknown>, p: Record<string, unknown>[], t: string) => string;
        const html = generator(buyer, propertyDetails, getTodayStr());
        printHtmlViaIframe(html, setBusy);
      }).catch(() => setBusy(false));
    }).catch(() => setBusy(false));
  };

  // 内覧準備資料１（白黒）印刷
  const handlePrint1 = () => runPrint('generateAllPagesHtml', setPrinting1);
  // 内覧準備資料（自己資金）印刷
  const handlePrintCash = () => runPrint('generateAllPagesCashHtml', setPrintingCash);
  // 内覧準備資料（リピーター）印刷
  const handlePrintRepeater = () => runPrint('generateAllPagesRepeaterHtml', setPrintingRepeater);
  // 内覧準備資料（自己資金・リピーター）印刷
  const handlePrintCashRepeater = () => {
    runPrint('generateAllPagesCashRepeaterHtml', setPrintingCashRepeater);
  };

  // 内覧準備資料２（カラー）印刷
  const handlePrint2 = () => {
    if (!buyer) return;
    setPrinting2(true);
    const propertyNumber = isOtherCompanyProperty
      ? (otherRegion === 'fukuoka' ? 'FI' : '')  // 他社物件は選択した版で福岡/大分を切替
      : ((linkedProperties && linkedProperties.length > 0)
        ? (linkedProperties[0].property_number || '')
        : '');
    import('../utils/printHtmlGenerators').then(({ generateViewingPrep2Html }) => {
      const html = generateViewingPrep2Html(buyer, getTodayStr(), propertyNumber);
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) { setPrinting2(false); document.body.removeChild(iframe); return; }
      doc.open(); doc.write(html); doc.close();
      const cleanup = () => { setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} setPrinting2(false); }, 1000); };
      const doPrint = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (_) {} cleanup(); };
      if (iframe.contentDocument?.readyState === 'complete') { setTimeout(doPrint, 1200); }
      else { iframe.onload = () => setTimeout(doPrint, 1200); setTimeout(doPrint, 5000); }
      setTimeout(() => { setPrinting2(false); }, 8000);
    }).catch(() => { setPrinting2(false); });
  };

  // その他資料（アフターメンテナンス＋e暮らしサポート）印刷
  const handlePrintOther = () => {
    setPrintingOther(true);
    import('../utils/printHtmlGenerators').then(({ generateOtherMaterialsHtml }) => {
      const html = generateOtherMaterialsHtml();
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) { setPrintingOther(false); document.body.removeChild(iframe); return; }
      doc.open(); doc.write(html); doc.close();
      const cleanup = () => { setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} setPrintingOther(false); }, 1000); };
      const doPrint = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (_) {} cleanup(); };
      if (iframe.contentDocument?.readyState === 'complete') { setTimeout(doPrint, 1200); }
      else { iframe.onload = () => setTimeout(doPrint, 1200); setTimeout(doPrint, 5000); }
      setTimeout(() => { setPrintingOther(false); }, 8000);
    }).catch(() => { setPrintingOther(false); });
  };

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>内覧準備資料</DialogTitle>
      <DialogContent>
        {/* 注意書き（赤色・太字） */}
        <Typography
          sx={{
            color: 'error.main',
            fontWeight: 'bold',
            mb: 2,
          }}
        >
          ※準備前にカレンダーに●をつけてください
        </Typography>

        {/* 内覧回数：買主重複の内覧日から「今回が何回目か」を表示 */}
        {viewingOrdinal && (
          <Box
            sx={{
              mb: 2,
              p: 1.2,
              borderRadius: 1,
              bgcolor: '#fff3e0',
              border: '1px solid #ffb74d',
            }}
          >
            <Typography sx={{ fontWeight: 'bold', color: '#e65100' }}>
              🔁 今回で {viewingOrdinal.ordinal} 回目の内覧（過去に他物件の内覧あり／計{viewingOrdinal.count}回）
            </Typography>
            {viewingOrdinal.history.length > 0 && (
              <Typography
                sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.3 }}
              >
                内覧日：{viewingOrdinal.history.join(' / ')}
              </Typography>
            )}
          </Box>
        )}

        {/* 他社物件：1・2の版（大分版 / 福岡版）を選択 */}
        {isOtherCompanyProperty && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography component="span" sx={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
              版（1・2に反映）：
            </Typography>
            <ToggleButtonGroup
              value={otherRegion}
              exclusive
              size="small"
              onChange={(_, val) => { if (val) setOtherRegion(val); }}
            >
              <ToggleButton value="oita">大分版（いふう）</ToggleButton>
              <ToggleButton value="fukuoka">福岡版（くじら不動産）</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        {/* 買主番号・物件番号コピーエリア */}
        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* 買主番号 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {hasBuyerNumber ? (
              <CopyButton text={buyerNumber as string} label="買主番号" />
            ) : (
              <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                買主番号：（未設定）
              </Typography>
            )}
          </Box>

          {/* 物件番号 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {hasPropertyNumber ? (
              <CopyButton text={propertyNumber as string} label="物件番号" />
            ) : (
              <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                物件番号：（未設定）
              </Typography>
            )}
          </Box>
        </Box>

        {/* リンク一覧（番号付きリスト） */}
        <List component="ol" sx={{ listStyleType: 'decimal', pl: 2 }}>
          {/* 内覧準備資料（白黒） */}
          <ListItem component="li" sx={{ display: 'list-item', py: 0.5 }}>
            <ListItemText
              primary={
                (hasPropertyNumber && linkedProperties && linkedProperties.length > 0) || isOtherCompanyProperty ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography component="span">内覧準備資料（白黒）：</Typography>
                    {isOtherCompanyProperty && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => setManualInputOpen(true)}
                        sx={{
                          bgcolor: '#455a64',
                          fontSize: '0.75rem',
                          '&:hover': { bgcolor: '#37474f' },
                        }}
                      >
                        内容を入力
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={printing1 ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
                      onClick={handlePrint1}
                      disabled={printing1 || !buyer || (!isOtherCompanyProperty && (!linkedProperties || linkedProperties.length === 0))}
                      sx={{
                        borderColor: '#4caf50',
                        color: '#2e7d32',
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: '#2e7d32', bgcolor: '#f1f8e9' },
                      }}
                    >
                      {printing1 ? '印刷中...' : '印刷'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={printingCash ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
                      onClick={handlePrintCash}
                      disabled={printingCash || !buyer || (!isOtherCompanyProperty && (!linkedProperties || linkedProperties.length === 0))}
                      sx={{
                        borderColor: '#1976d2',
                        color: '#1565c0',
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: '#1565c0', bgcolor: '#e3f2fd' },
                      }}
                    >
                      {printingCash ? '印刷中...' : '自己資金'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={printingRepeater ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
                      onClick={handlePrintRepeater}
                      disabled={printingRepeater || !buyer || (!isOtherCompanyProperty && (!linkedProperties || linkedProperties.length === 0))}
                      sx={{
                        borderColor: '#ff9800',
                        color: '#e65100',
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: '#e65100', bgcolor: '#fff3e0' },
                      }}
                    >
                      {printingRepeater ? '印刷中...' : 'リピーター'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={printingCashRepeater ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
                      onClick={handlePrintCashRepeater}
                      disabled={printingCashRepeater || !buyer || (!isOtherCompanyProperty && (!linkedProperties || linkedProperties.length === 0))}
                      sx={{
                        borderColor: '#9c27b0',
                        color: '#6a1b9a',
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: '#6a1b9a', bgcolor: '#f3e5f5' },
                      }}
                    >
                      {printingCashRepeater ? '印刷中...' : '自己資金(リピーター)'}
                    </Button>
                  </Box>
                ) : (
                  <Typography component="span">
                    内覧準備資料　<a href="https://docs.google.com/spreadsheets/d/1M9uVzHWD2ipzoY5Om3h3a2-_uQa9D_UGhpB5U4_nyRc/edit?gid=1575477339#gid=1575477339" target="_blank" rel="noopener noreferrer">こちらから</a>
                  </Typography>
                )
              }
            />
          </ListItem>
          {/* 内覧準備資料（カラー） */}
          {showMaterials && (
            <ListItem component="li" sx={{ display: 'list-item', py: 0.5 }}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography component="span">内覧準備資料（カラー）：</Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={printing2 ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
                      onClick={handlePrint2}
                      disabled={printing2 || !buyer}
                      sx={{
                        borderColor: '#f5c518',
                        color: '#b8860b',
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: '#b8860b', bgcolor: '#fffde7' },
                      }}
                    >
                      {printing2 ? '印刷中...' : '印刷'}
                    </Button>
                  </Box>
                }
              />
            </ListItem>
          )}
          {FIXED_LINKS.map((link, index) => (
            <ListItem
              key={index}
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Box>
                    <Typography component="span">
                      {link.label}：
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        {link.description ?? link.label}
                      </a>
                    </Typography>
                    {isOtherCompanyProperty && (
                      <Typography
                        component="div"
                        sx={{ color: 'error.main', fontSize: '0.8rem', fontWeight: 'bold', mt: 0.3 }}
                      >
                        他社へ資料取り寄せ
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
          {/* 近隣MAP（google_map_urlがある場合、または他社物件で住所がある場合に表示） */}
          {(googleMapUrl || (isOtherCompanyProperty && address && String(address).trim() !== '')) && (
            <ListItem
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Box>
                    <Typography component="span">
                      近隣MAP：
                      <Box
                        component="span"
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          '&:hover': { opacity: 0.7 },
                        }}
                        onClick={() => {
                          if (googleMapUrl) {
                            setNearbyMapModalOpen(true);
                          } else {
                            // 他社物件：URLが無いので「何でも近隣MAP」ページを開く
                            window.open('/buyers/nearby-map', '_blank');
                          }
                        }}
                      >
                        🗺️ クリックして表示
                      </Box>
                    </Typography>
                    <Typography
                      component="div"
                      sx={{ color: 'error.main', fontSize: '0.8rem', mt: 0.3 }}
                    >
                      ※＋を２回押して拡大表示して印刷してください。カラーの両面印刷です。
                    </Typography>
                    <Typography
                      component="div"
                      sx={{ color: 'error.main', fontSize: '0.8rem', mt: 0.3 }}
                    >
                      ※お客様資料に追加し渡す
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          )}
          {/* ハウスメーカー（house_makerフィールドに値がある場合のみ表示） */}
          {houseMaker && (
            <ListItem
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Typography component="span">
                    ハウスメーカー：{houseMaker}（
                    <Box
                      component="span"
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.7 },
                      }}
                      onClick={() => setHouseMakerModalOpen(true)}
                    >
                      詳細を見る
                    </Box>
                    ）
                  </Typography>
                }
              />
            </ListItem>
          )}
          {/* 評価ポイント！（システムから取得して物件ごとに表示） */}
          {linkedProperties && linkedProperties.length > 0 && linkedProperties
            .filter(lp => lp.property_number && (lp.property_number.startsWith('FI') || lp.property_number.startsWith('AA')))
            .map((lp, idx) => (
            <ListItem
              key={`eval-${lp.property_number}-${idx}`}
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Box>
                    <Typography component="span">
                      評価ポイント！{linkedProperties.filter(p => p.property_number?.startsWith('FI') || p.property_number?.startsWith('AA')).length > 1 ? `（${lp.property_number}）` : ''}：
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <EvaluationPointsDisplay
                        sellerNumber={lp.property_number}
                        propertyAddress={lp.display_address || lp.address}
                      />
                    </Box>
                  </Box>
                }
              />
            </ListItem>
          ))}
          {/* propertyNumber単体のフォールバック（linkedPropertiesがない場合） */}
          {(!linkedProperties || linkedProperties.length === 0) && propertyNumber && (propertyNumber.startsWith('FI') || propertyNumber.startsWith('AA')) && (
            <ListItem
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Box>
                    <Typography component="span">
                      評価ポイント！：
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <EvaluationPointsDisplay
                        sellerNumber={propertyNumber}
                      />
                    </Box>
                  </Box>
                }
              />
            </ListItem>
          )}
          {/* 他社物件の評価ポイント（物件番号が無いため未入力表示） */}
          {isOtherCompanyProperty && (
            <ListItem
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Box>
                    <Typography component="span">
                      評価ポイント！：
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        評価ポイント未入力
                      </Typography>
                    </Box>
                  </Box>
                }
              />
            </ListItem>
          )}
          {/* その他資料（アフターメンテナンス＋e暮らしサポート） - FI物件以外 */}
          {showMaterials && (() => {
            const propNum = ((linkedProperties?.[0]?.property_number as string) || '').toUpperCase();
            const isFI = propNum.includes('FI');
            return !isFI;
          })() && (
            <ListItem component="li" sx={{ display: 'list-item', py: 0.5 }}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography component="span">その他資料：</Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={printingOther ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
                      onClick={handlePrintOther}
                      disabled={printingOther}
                      sx={{
                        borderColor: '#ff7043',
                        color: '#d84315',
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: '#d84315', bgcolor: '#fbe9e7' },
                      }}
                    >
                      {printingOther ? '印刷中...' : '印刷'}
                    </Button>
                  </Box>
                }
                secondary={
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.3 }}>
                    アフターメンテナンスのご案内 / e暮らしサポートサービスのご案内
                  </Typography>
                }
              />
            </ListItem>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>

    {/* ハウスメーカーモーダル */}
    {houseMaker && (
      <HouseMakerModal
        open={houseMakerModalOpen}
        onClose={() => setHouseMakerModalOpen(false)}
        commentHtml={houseMaker}
        mode="buyer"
      />
    )}

    {/* 近隣MAPモーダル（自社物件でgoogle_map_urlがある場合のみ） */}
    {googleMapUrl && (
      <NearbyMapModal
        open={nearbyMapModalOpen}
        onClose={() => setNearbyMapModalOpen(false)}
        googleMapUrl={googleMapUrl}
        address={address || ''}
      />
    )}

    {/* 他社物件：内覧準備資料（白黒）の内容手入力ダイアログ */}
    <Dialog open={manualInputOpen} onClose={() => setManualInputOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>内覧準備資料（白黒）の内容を入力</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
          他社物件は物件データが無いため、印刷する内容をここで入力してください。空欄の項目は印刷されません。
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
          <TextField
            label="所在地・住居表示"
            value={manualProp.address}
            onChange={(e) => setManualProp((p) => ({ ...p, address: e.target.value }))}
            fullWidth
            size="small"
            multiline
          />
          <TextField
            label="種別"
            value={manualProp.property_type}
            onChange={(e) => setManualProp((p) => ({ ...p, property_type: e.target.value }))}
            fullWidth
            size="small"
            select
          >
            <MenuItem value="">（未選択）</MenuItem>
            <MenuItem value="マ">マンション</MenuItem>
            <MenuItem value="戸">戸建て</MenuItem>
            <MenuItem value="土">土地</MenuItem>
            <MenuItem value="他">その他</MenuItem>
          </TextField>
          <TextField
            label="価格（円）"
            value={manualProp.price}
            onChange={(e) => setManualProp((p) => ({ ...p, price: e.target.value }))}
            fullWidth
            size="small"
            placeholder="例: 25000000"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="間取り"
              value={manualProp.floor_plan}
              onChange={(e) => setManualProp((p) => ({ ...p, floor_plan: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="構造"
              value={manualProp.structure}
              onChange={(e) => setManualProp((p) => ({ ...p, structure: e.target.value }))}
              fullWidth
              size="small"
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="土地面積（m²）"
              value={manualProp.land_area}
              onChange={(e) => setManualProp((p) => ({ ...p, land_area: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="建物面積（m²）"
              value={manualProp.building_area}
              onChange={(e) => setManualProp((p) => ({ ...p, building_area: e.target.value }))}
              fullWidth
              size="small"
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="固定資産税（円）"
              value={manualProp.property_tax}
              onChange={(e) => setManualProp((p) => ({ ...p, property_tax: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="管理費（円）"
              value={manualProp.management_fee}
              onChange={(e) => setManualProp((p) => ({ ...p, management_fee: e.target.value }))}
              fullWidth
              size="small"
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="積立金（円）"
              value={manualProp.reserve_fund}
              onChange={(e) => setManualProp((p) => ({ ...p, reserve_fund: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="駐車場"
              value={manualProp.parking}
              onChange={(e) => setManualProp((p) => ({ ...p, parking: e.target.value }))}
              fullWidth
              size="small"
            />
          </Box>
          <TextField
            label="引渡し"
            value={manualProp.delivery}
            onChange={(e) => setManualProp((p) => ({ ...p, delivery: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            label="内覧前伝達事項"
            value={manualProp.pre_viewing_notes}
            onChange={(e) => setManualProp((p) => ({ ...p, pre_viewing_notes: e.target.value }))}
            fullWidth
            size="small"
            multiline
            minRows={2}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setManualInputOpen(false)} variant="outlined">閉じる</Button>
        <Button onClick={() => setManualInputOpen(false)} variant="contained">この内容で確定</Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default ViewingPreparationPopup;
