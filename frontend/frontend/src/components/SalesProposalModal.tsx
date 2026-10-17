/**
 * 販売提案書作成モーダル
 *
 * 機能：
 *   - 売主の物件情報・学校・交通情報を自動取得
 *   - スタッフが価格・購入ターゲット・その他指示を入力
 *   - ChatGPTの「くじら不動産｜売却提案書作成」プロジェクト向けの指示文を生成
 *   - 「作成指示をコピー」ボタンでクリップボードにコピー
 *   - 入力内容を localStorage に自動保存（誤操作による消失を防止）
 *   - 作成履歴を sales_proposals テーブルに保存（別途SQL実行が必要）
 *
 * 会社情報の切り替え：
 *   - 売主番号に「FI」が含まれる → 株式会社くじら不動産（福岡）
 *   - それ以外 → 株式会社いふう（大分）
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Grid, CircularProgress,
  IconButton, Chip, Divider, Tooltip, Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Check as CheckIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import SalesProposalImagePanel, {
  ProposalImage,
  MAX_PROPOSAL_IMAGES,
} from './SalesProposalImagePanel';

// ─── 会社情報 ─────────────────────────────────────────────────────────────────
const COMPANY_INFO = {
  FI: {
    name: '株式会社くじら不動産',
    address: '福岡市中央区舞鶴3-1-10',
    tel: '092-401-5331',
  },
  AA: {
    name: '株式会社いふう',
    address: '大分市舞鶴町1-3-30',
    tel: '097-533-2022',
  },
} as const;

// ─── 物件種別ラベル ────────────────────────────────────────────────────────────
// CallModePage は normalizePropertyType() で変換済み（apartment / house / land / other）
// sellers テーブルの生の値（マ / 戸 / 土 / 他）にも対応
const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'マンション',
  house: '戸建て',
  land: '土地',
  other: 'その他',
  マ: 'マンション',
  マンション: 'マンション',
  戸: '戸建て',
  '戸建て': '戸建て',
  土: '土地',
  土地: '土地',
  他: 'その他',
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  sellerId: string;
  sellerNumber: string;
  propertyAddress: string;
  propertyType: string;
  landArea?: number;
  buildingArea?: number;
  landAreaVerified?: number;
  buildingAreaVerified?: number;
  buildYear?: number;
  structure?: string;
  valuationAmount1?: number;
  valuationAmount2?: number;
  valuationAmount3?: number;
}

// ─── フォーム状態 ──────────────────────────────────────────────────────────────
interface FormState {
  marketPrice: string;
  challengePrice: string;
  proposedListingPrice: string;
  targetBuyers: string;
  otherInstructions: string;
  schoolInfo: string;
  transitInfo: string;
}

const EMPTY_FORM: FormState = {
  marketPrice: '',
  challengePrice: '',
  proposedListingPrice: '',
  targetBuyers: '',
  otherInstructions: '',
  schoolInfo: '',
  transitInfo: '',
};

// ─── ヘルパー ─────────────────────────────────────────────────────────────────
const fmtManEn = (yen?: number) =>
  yen ? `${Math.round(yen / 10000).toLocaleString()}万円` : '';

// ─── メインコンポーネント ──────────────────────────────────────────────────────
export default function SalesProposalModal({
  open, onClose,
  sellerId, sellerNumber,
  propertyAddress, propertyType,
  landArea, buildingArea,
  landAreaVerified, buildingAreaVerified,
  buildYear, structure,
  valuationAmount1, valuationAmount2, valuationAmount3,
}: Props) {
  const { employee } = useAuthStore();
  const isFI = sellerNumber.toUpperCase().startsWith('FI');
  const company = isFI ? COMPANY_INFO.FI : COMPANY_INFO.AA;
  const storageKey = `salesProposal_${sellerNumber}`;

  // フォーム状態
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // フェッチ状態
  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [infoFetched, setInfoFetched] = useState(false);
  // 学校情報の取得元（UIに表示して確認しやすくする）
  // 'doc2' = 添付資料2の保存済み値, 'api' = ライブAPI, null = 未取得
  const [schoolSource, setSchoolSource] = useState<'doc2' | 'api' | null>(null);

  // リフレッシュ確認ダイアログ（手動入力済みの内容を上書きする前に確認する）
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);

  // 添付画像（ブラウザメモリ内のみ・サーバーアップロードなし）
  const [attachedImages, setAttachedImages] = useState<ProposalImage[]>([]);

  // 添付画像のダウンロード中フラグ
  const [downloading, setDownloading] = useState(false);

  // コピー状態
  const [copied, setCopied] = useState(false);

  // 保存状態
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);

  // ─── モーダルが開くたびに localStorage から復元 ─────────────────────────────
  useEffect(() => {
    if (!open) {
      // モーダルを閉じる際に画像ObjectURLを解放（メモリリーク防止）
      setAttachedImages(prev => {
        prev.forEach(img => URL.revokeObjectURL(img.previewUrl));
        return [];
      });
      return;
    }
    setCopied(false);
    setSaveSuccess(false);
    setSaveError(null);
    setProposalId(null);
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormState>;
        setForm({ ...EMPTY_FORM, ...parsed });
        // 既に学校・交通情報が保存済みなら再取得しない
        if (parsed.schoolInfo || parsed.transitInfo) {
          setInfoFetched(true);
          return;
        }
      } else {
        setForm(EMPTY_FORM);
      }
    } catch {
      setForm(EMPTY_FORM);
    }
    setInfoFetched(false);
  }, [open, storageKey]);

  // ─── 学校・交通情報の未取得時に自動取得 ────────────────────────────────────
  useEffect(() => {
    if (open && !infoFetched) {
      fetchSchoolTransit(false); // force=false: 既存値を上書きしない
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, infoFetched]);

  // ─── フォームフィールドの更新（localStorage へ即時保存） ───────────────────
  const setField = useCallback((key: keyof FormState, value: string) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  // ─── 学校・交通情報の取得（優先順位あり）────────────────────────────────────
  //
  //  force = false（自動取得）: 既にフォームに値がある場合は上書きしない
  //  force = true （手動リフレッシュ）: 常に最新値で上書き
  //
  //  学校情報の取得優先順位:
  //    1. /api/sellers/${sellerId}/attached-document2（添付資料2の保存済み値）
  //    2. /api/nearby-map/school-walk（ライブAPI）→ 1 で取得できなかった場合のみ
  //    3. 空欄（手動入力へフォールバック）
  //
  //  交通アクセス: seller_transit_access テーブル経由（変更なし）
  //
  const fetchSchoolTransit = useCallback(async (force = false) => {
    if (!sellerNumber) return;
    setFetchingInfo(true);
    setFetchError(null);

    let schoolText = '';
    let transitText = '';
    let usedDoc2 = false;

    // ─ STEP 1: seller_attached_document2 から保存済み学校情報を取得（最優先） ─
    if (sellerId) {
      try {
        const docRes = await api.get(`/api/sellers/${sellerId}/attached-document2`);
        const doc = docRes.data ?? {};
        const parts: string[] = [];

        if (doc.elementary_school_name) {
          const walk = doc.elementary_school_walk
            ? `（徒歩${doc.elementary_school_walk}分）`
            : '';
          parts.push(`小学校：${doc.elementary_school_name}${walk}`);
        }
        if (doc.junior_high_school_name) {
          const walk = doc.junior_high_school_walk
            ? `（徒歩${doc.junior_high_school_walk}分）`
            : '';
          parts.push(`中学校：${doc.junior_high_school_name}${walk}`);
        }

        if (parts.length > 0) {
          schoolText = parts.join(' / ');
          usedDoc2 = true;
        }
      } catch {
        // 添付資料2の取得失敗はサイレント → ライブAPIにフォールバック
      }
    }

    // ─ STEP 2: doc2 に学校情報がない場合のみ、ライブAPIから取得 ──────────────
    if (!usedDoc2) {
      try {
        const coordRes = await api.get(`/api/sellers/by-number/${sellerNumber}`);
        const lat: number | null = coordRes.data.latitude ?? null;
        const lng: number | null = coordRes.data.longitude ?? null;
        const addr: string = coordRes.data.propertyAddress || propertyAddress;

        if (lat != null && lng != null) {
          const schoolRes = await api.get('/api/nearby-map/school-walk', {
            params: { lat, lng, ...(addr ? { propertyAddress: addr } : {}) },
          });
          const d = schoolRes.data;
          const parts: string[] = [];

          if (d.elementarySchool?.name) {
            const walkMin =
              d.elementarySchool.googleWalkMinutes ??
              (d.elementarySchool.distanceMeters
                ? Math.ceil(d.elementarySchool.distanceMeters / 80)
                : null);
            parts.push(
              `小学校：${d.elementarySchool.name}` +
                (walkMin != null ? `（徒歩${walkMin}分）` : ''),
            );
          }
          if (d.juniorHighSchool?.name) {
            const walkMin =
              d.juniorHighSchool.googleWalkMinutes ??
              (d.juniorHighSchool.distanceMeters
                ? Math.ceil(d.juniorHighSchool.distanceMeters / 80)
                : null);
            parts.push(
              `中学校：${d.juniorHighSchool.name}` +
                (walkMin != null ? `（徒歩${walkMin}分）` : ''),
            );
          }
          if (parts.length > 0) schoolText = parts.join(' / ');
        }
      } catch {
        // ライブAPI失敗もサイレント → 空欄のまま手動入力へ
      }
    }

    // ─ STEP 3: 交通アクセス（seller_transit_access テーブル・変更なし） ────────
    try {
      const transitRes = await api.get(`/api/transit-access/seller/${sellerNumber}`);
      const records: any[] = transitRes.data.data ?? [];
      const maxRank = isFI ? 3 : 1;
      const parts: string[] = [];

      for (let rank = 1; rank <= maxRank; rank++) {
        const st = records.find(r => r.transport_type === 'station' && r.rank === rank);
        if (st) {
          const name =
            st.is_manually_corrected && st.manual_name ? st.manual_name : st.name;
          const walk =
            st.is_manually_corrected && st.manual_walk_minutes != null
              ? st.manual_walk_minutes
              : st.walk_minutes;
          if (name) parts.push(`${name}駅${walk != null ? `（徒歩${walk}分）` : ''}`);
        }
        const bs = records.find(r => r.transport_type === 'bus_stop' && r.rank === rank);
        if (bs) {
          const name =
            bs.is_manually_corrected && bs.manual_name ? bs.manual_name : bs.name;
          const walk =
            bs.is_manually_corrected && bs.manual_walk_minutes != null
              ? bs.manual_walk_minutes
              : bs.walk_minutes;
          if (name) parts.push(`${name}バス停${walk != null ? `（徒歩${walk}分）` : ''}`);
        }
      }
      transitText = parts.join(' / ');
    } catch {
      // 交通取得失敗もサイレント
    }

    setFetchingInfo(false);
    setInfoFetched(true);
    setSchoolSource(usedDoc2 ? 'doc2' : (schoolText ? 'api' : null));

    // フォームに反映
    //   force=true（手動リフレッシュ）: 常に上書き
    //   force=false（自動取得）: 既に入力がある場合は上書きしない
    setForm(prev => {
      const next = {
        ...prev,
        schoolInfo: force ? schoolText : (prev.schoolInfo || schoolText),
        transitInfo: force ? transitText : (prev.transitInfo || transitText),
      };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [sellerId, sellerNumber, propertyAddress, isFI, storageKey]);

  // ─── 物件情報テキスト組み立て ──────────────────────────────────────────────
  const propertyTypeLabel = PROPERTY_TYPE_LABELS[propertyType] || propertyType || '不明';

  // 面積は「確認済み」があればそちらを優先
  const displayLandArea = landAreaVerified || landArea;
  const displayBuildingArea = buildingAreaVerified || buildingArea;

  const areaParts: string[] = [
    displayLandArea ? `土地${displayLandArea}㎡` : '',
    displayBuildingArea ? `建物${displayBuildingArea}㎡` : '',
    buildYear ? `築${buildYear}年` : '',
    structure ? `${structure}` : '',
  ].filter(Boolean);
  const areaText = areaParts.join(' / ') || '（未入力）';

  // 過去の査定価格（入力されている値を全部表示）
  const assessAmounts = [valuationAmount1, valuationAmount2, valuationAmount3]
    .filter((v): v is number => typeof v === 'number' && v > 0)
    .map(fmtManEn);
  const assessText = assessAmounts.length > 0 ? assessAmounts.join(' / ') : '（未入力）';

  // 周辺環境テキスト（学校 + 交通）
  const envParts = [form.schoolInfo, form.transitInfo].filter(Boolean);
  const envText = envParts.length > 0 ? envParts.join('\n') : '（未取得）';

  // ─── ChatGPT 指示文生成 ──────────────────────────────────────────────────

  // 画像加工ルール（添付画像がある場合のみ挿入）
  const IMAGE_RULES_TEXT = attachedImages.length > 0
    ? `
---
添付した画像がある場合は、提案書に使用する前に資料用として見やすく加工してください。

【画像加工ルール】
- 添付画像は実際の物件・周辺環境の参考画像として使用してください。
- 画像に人物が写っている場合は削除してください。
- 画像に車、生活用品、ゴミ、目立つ雑多な物が写っている場合は、必要に応じて整理してください。
- 電柱、電線、看板、画面上の不要なUI表示などが目立つ場合は、資料用として自然に整理してください。
- Google Map等のスクリーンショットを使用する場合は、地図サービスの画面表示・UI・余計な文字情報が目立たないように整理してください。
- 明るさ、傾き、トリミング、見やすさは資料向けに調整してください。
- ただし、建物形状、道路形状、敷地形状、周辺施設の位置関係など、物件判断に関わる重要な事実は変えないでください。
- 実際に写っていない建物や設備を新たに加えないでください。
- 実物と異なる印象を与える過度な演出はしないでください。
---

添付画像一覧（${attachedImages.length}枚）：
${attachedImages.map((img, i) =>
      `  ${i + 1}. ${img.type}${img.description ? ` / ${img.description}` : ''}（${img.file.name}）`
    ).join('\n')}

添付した画像がある場合は、その実画像を優先して使用してください。必要に応じて、人物・電柱・電線・不要物・画面UI等を資料用に自然に整理したうえで、提案書に掲載してください。建物や敷地の形状など重要な事実は変更しないでください。`
    : '';

  const PROMPT_SUFFIX = `以上の内容とプロジェクトに登録された参考画像をもとに、売主様にそのままお渡しできる、明るく高級感のあるA4縦1枚の販売価格・販売戦略提案書を画像生成してください。

レイアウトは物件の特徴や情報量に合わせて変更してください。白・ネイビー・ゴールド・淡いベージュを基調とし、価格・購入ターゲット・販売戦略が分かりやすい資料にしてください。

売主番号や社内情報は掲載せず、会社名・署名は指定されたものを使用してください。未確認情報は推測で追加しないでください。

必要な情報が揃っている場合は、追加質問をせず、そのまま画像生成を実行してください。`;

  const generatedPrompt =
    `以下の条件で、売主様向けの販売価格・販売戦略提案書を作成してください。

売主番号：${sellerNumber}
会社情報：${company.name} / ${company.address} / TEL：${company.tel}
所在地：${propertyAddress || '（未入力）'}
物件種別：${propertyTypeLabel}
面積：${areaText}
過去の査定価格：${assessText}
相場価格：${form.marketPrice || '（未入力）'}
チャレンジ価格：${form.challengePrice || '（未入力）'}
提案売出価格：${form.proposedListingPrice || '（未入力）'}
想定購入ターゲット：${form.targetBuyers || '（未入力）'}
学校・周辺環境：${envText}
その他の指示：${form.otherInstructions || 'なし'}

Supabaseから取得した物件情報とスタッフが指定した条件を利用してください。

売主番号は検索・会社署名判定に使用し、完成資料には表示しないでください。

プロジェクトに登録された参考画像をデザインの参考とし、物件に応じた構成でA4縦の画像を作成してください。

社内情報・未確認情報・架空の事実は掲載しないでください。
${IMAGE_RULES_TEXT}

${PROMPT_SUFFIX}`.trim();

  // ─── 添付画像のダウンロード（1枚: 直接 / 複数枚: ZIP） ─────────────────────
  const handleDownloadImages = async () => {
    if (attachedImages.length === 0 || downloading) return;
    setDownloading(true);
    try {
      if (attachedImages.length === 1) {
        // 1枚: 直接ダウンロード
        const img = attachedImages[0];
        const a = document.createElement('a');
        a.href = img.previewUrl;
        a.download = img.file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // 複数枚: ZIP にまとめてダウンロード
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        attachedImages.forEach((img, i) => {
          const prefix = String(i + 1).padStart(2, '0');
          const ext = img.file.name.split('.').pop() || 'jpg';
          const typePart = img.type.replace(/\s/g, '_');
          const descPart = img.description
            ? `_${img.description.replace(/[\s/\\:*?"<>|]/g, '_').slice(0, 20)}`
            : '';
          zip.file(`${prefix}_${typePart}${descPart}.${ext}`, img.file);
        });
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `提案書画像_${sellerNumber}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('[SalesProposalModal] 画像ダウンロードエラー:', err);
    } finally {
      setDownloading(false);
    }
  };

  // ─── クリップボードへコピー ───────────────────────────────────────────────
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
    } catch {
      // フォールバック（古いブラウザ対応）
      const el = document.createElement('textarea');
      el.value = generatedPrompt;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  };

  // ─── DB 保存 ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        seller_id: sellerId || null,
        seller_number: sellerNumber,
        market_price: form.marketPrice || null,
        challenge_price: form.challengePrice || null,
        proposed_listing_price: form.proposedListingPrice || null,
        target_buyers: form.targetBuyers || null,
        other_instructions: form.otherInstructions || null,
        school_info: form.schoolInfo || null,
        transit_info: form.transitInfo || null,
        generated_prompt: generatedPrompt,
        created_by: employee?.name || (employee as any)?.email || null,
      };

      if (proposalId) {
        await api.put(`/api/sales-proposals/${proposalId}`, payload);
      } else {
        const res = await api.post('/api/sales-proposals', payload);
        setProposalId(res.data.id);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      // テーブルが未作成の場合もユーザーフレンドリーなエラーを表示
      const msg = err.response?.data?.error || err.message || '';
      if (msg.includes('sales_proposals') && msg.includes('does not exist')) {
        setSaveError('保存テーブルが未作成です。管理者にSQLマイグレーションの実行を依頼してください。');
      } else {
        setSaveError(`保存に失敗しました（${msg}）`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { maxHeight: '95vh' } }}
    >
      {/* ── ヘッダー ── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          borderBottom: '2px solid',
          borderColor: isFI ? '#1B3A6B' : '#00695C',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
            📄 販売提案書作成
          </Typography>
          <Chip
            label={sellerNumber}
            size="small"
            sx={{
              bgcolor: isFI ? '#1B3A6B' : '#00695C',
              color: 'white',
              fontWeight: 'bold',
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {company.name}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* ── コンテンツ ── */}
      <DialogContent dividers sx={{ p: 2 }}>
        <Grid container spacing={2}>

          {/* ── 左カラム：入力フォーム ── */}
          <Grid item xs={12} md={6}>

            {/* 物件情報（自動取得・読み取り専用） */}
            <Box
              sx={{
                mb: 2, p: 1.5,
                bgcolor: isFI ? '#EBF0F9' : '#E8F5E9',
                borderRadius: 1,
                border: '1px solid',
                borderColor: isFI ? '#c5d3e8' : '#b2dfdb',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 'bold', mb: 1, color: isFI ? '#1B3A6B' : '#00695C' }}
              >
                📋 物件情報（Supabase 自動取得）
              </Typography>
              {[
                { label: '所在地', value: propertyAddress || '（未入力）' },
                { label: '種別', value: propertyTypeLabel },
                { label: '面積', value: areaText },
                { label: '過去の査定価格', value: assessText },
              ].map(({ label, value }) => (
                <Typography key={label} variant="body2" sx={{ mb: 0.4 }}>
                  <strong>{label}：</strong>{value}
                </Typography>
              ))}
            </Box>

            {/* 学校・交通情報（自動取得・手動編集可） */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  🏫 学校・周辺環境
                </Typography>
                <Tooltip title="添付資料2の保存値 → 学校区APIの順で再取得">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => {
                        // 手動入力済みの内容がある場合は確認ダイアログを表示
                        if (form.schoolInfo || form.transitInfo) {
                          setRefreshConfirmOpen(true);
                        } else {
                          setInfoFetched(false);
                          fetchSchoolTransit(true);
                        }
                      }}
                      disabled={fetchingInfo}
                    >
                      {fetchingInfo
                        ? <CircularProgress size={14} />
                        : <RefreshIcon sx={{ fontSize: 16 }} />
                      }
                    </IconButton>
                  </span>
                </Tooltip>
                {fetchingInfo && (
                  <Typography variant="caption" color="text.secondary">
                    取得中...
                  </Typography>
                )}
              </Box>
              <TextField
                fullWidth size="small" multiline rows={2}
                label="学校情報"
                placeholder="小学校：○○小学校（徒歩○分） / 中学校：○○中学校（徒歩○分）"
                value={form.schoolInfo}
                onChange={e => setField('schoolInfo', e.target.value)}
                sx={{ mb: 1 }}
                helperText={
                  schoolSource === 'doc2'
                    ? '✅ 添付資料2の保存済み値を使用（手動編集可）'
                    : schoolSource === 'api'
                    ? '⚠️ 学校区APIから取得（添付資料2に未保存）'
                    : '自動取得できない場合は手動で入力してください'
                }
                FormHelperTextProps={{
                  sx: {
                    color:
                      schoolSource === 'doc2' ? '#4caf50' :
                      schoolSource === 'api'  ? '#ff9800' :
                      'text.secondary',
                    fontWeight: schoolSource ? 'bold' : 'normal',
                  },
                }}
              />
              <TextField
                fullWidth size="small" multiline rows={2}
                label="交通アクセス"
                placeholder="○○駅（徒歩○分） / ○○バス停（徒歩○分）"
                value={form.transitInfo}
                onChange={e => setField('transitInfo', e.target.value)}
                helperText="自動取得できない場合は手動で入力してください"
              />
              {fetchError && (
                <Alert severity="warning" sx={{ mt: 0.5, py: 0.5 }} onClose={() => setFetchError(null)}>
                  {fetchError}
                </Alert>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* 価格入力 */}
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5 }}>
              💰 価格情報（スタッフ入力）
            </Typography>
            <TextField
              fullWidth size="small" label="相場価格"
              placeholder="例：1,900万～2,470万円"
              value={form.marketPrice}
              onChange={e => setField('marketPrice', e.target.value)}
              sx={{ mb: 1.5 }}
            />
            <TextField
              fullWidth size="small" label="チャレンジ価格"
              placeholder="例：2,470万円"
              value={form.challengePrice}
              onChange={e => setField('challengePrice', e.target.value)}
              sx={{ mb: 1.5 }}
            />
            <TextField
              fullWidth size="small" label="提案売出価格 *"
              placeholder="例：2,200万円"
              value={form.proposedListingPrice}
              onChange={e => setField('proposedListingPrice', e.target.value)}
              sx={{ mb: 2 }}
            />

            {/* 想定購入ターゲット */}
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              🎯 想定購入ターゲット
            </Typography>
            <TextField
              fullWidth size="small" multiline rows={3}
              placeholder="例：近隣の土地所有者、○○小学校区で探しているご家族"
              value={form.targetBuyers}
              onChange={e => setField('targetBuyers', e.target.value)}
              sx={{ mb: 2 }}
            />

            {/* その他の指示 */}
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              📝 その他の指示（任意）
            </Typography>
            <TextField
              fullWidth size="small" multiline rows={3}
              placeholder="例：現地写真なし、案内図なし、月極駐車場の利用を前提に提案"
              value={form.otherInstructions}
              onChange={e => setField('otherInstructions', e.target.value)}
            />

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              💾 入力内容はブラウザに自動保存されます（誤操作による消失を防止）
            </Typography>

            {/* 掲載画像（任意） */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              🖼️ 掲載画像（任意・最大{MAX_PROPOSAL_IMAGES}枚）
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              現地写真・Google Mapのスクリーンショット等を添付すると、指示文に画像加工ルールと一覧が自動追加されます
            </Typography>
            <SalesProposalImagePanel
              images={attachedImages}
              onImagesChange={setAttachedImages}
            />
            {attachedImages.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                ⚠️ 画像はブラウザ内のみ保存されます。モーダルを閉じると消えます。
              </Typography>
            )}
          </Grid>

          {/* ── 右カラム：生成された指示文プレビュー ── */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 500,
                border: '2px solid #1976d2',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              {/* プレビューヘッダー */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 2,
                  py: 1,
                  bgcolor: '#1976d2',
                  color: 'white',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  🤖 ChatGPT への作成指示文（プレビュー）
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={copied ? <CheckIcon /> : <CopyIcon />}
                  onClick={handleCopy}
                  sx={{
                    bgcolor: copied ? '#4caf50' : 'white',
                    color: copied ? 'white' : '#1976d2',
                    fontWeight: 'bold',
                    minWidth: 150,
                    '&:hover': {
                      bgcolor: copied ? '#388e3c' : '#e3f2fd',
                    },
                  }}
                >
                  {copied ? '✅ コピーしました！' : '作成指示をコピー'}
                </Button>
              </Box>

              {/* 指示文本文 */}
              <Box
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  p: 2,
                  bgcolor: '#fafafa',
                }}
              >
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    fontFamily: '"Noto Sans JP", sans-serif',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '0.78rem',
                    lineHeight: 1.8,
                    color: '#333',
                    m: 0,
                  }}
                >
                  {generatedPrompt}
                </Typography>
              </Box>

              {/* フッターヒント */}
              <Box
                sx={{
                  px: 2, py: 1,
                  bgcolor: attachedImages.length > 0 ? '#fff8e1' : '#e8f4fd',
                  borderTop: '1px solid',
                  borderColor: attachedImages.length > 0 ? '#ffe082' : '#b3d4f0',
                }}
              >
                {attachedImages.length > 0 ? (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#e65100', display: 'block', mb: 0.5 }}>
                      📋 ChatGPT への渡し方（画像あり）
                    </Typography>
                    {[
                      '「作成指示をコピー」で文章をコピー',
                      '「添付画像をダウンロード」でファイルを保存',
                      '（ZIPの場合は解凍する）',
                      'ChatGPT の「くじら不動産｜売却提案書作成」を開く',
                      '文章を貼り付け、画像ファイルをアップロード',
                      '送信',
                    ].map((step, i) => (
                      <Typography key={i} variant="caption" sx={{ display: 'block', color: '#5d4037', lineHeight: 1.6 }}>
                        {i < 2 || i >= 3 ? `${i + 1}. ` : '　　'}{step}
                      </Typography>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    💡 上記をコピーして ChatGPT の「くじら不動産｜売却提案書作成」プロジェクトに貼り付けてください
                  </Typography>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      {/* ── アクション ── */}
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
        {/* 保存結果フィードバック */}
        {saveSuccess && (
          <Typography variant="body2" color="success.main" sx={{ mr: 'auto' }}>
            ✅ 保存しました
          </Typography>
        )}
        {saveError && (
          <Typography variant="body2" color="error" sx={{ mr: 'auto', maxWidth: 400 }}>
            ❌ {saveError}
          </Typography>
        )}

        <Button onClick={onClose} color="inherit">
          閉じる
        </Button>

        {/* 履歴保存ボタン */}
        <Tooltip title="入力内容をサーバーに保存（作成履歴管理用）">
          <span>
            <Button
              variant="outlined"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {proposalId ? '更新' : '保存'}
            </Button>
          </span>
        </Tooltip>

        {/* 添付画像ダウンロードボタン（画像がある場合のみ表示） */}
        {attachedImages.length > 0 && (
          <Tooltip title={attachedImages.length > 1 ? `${attachedImages.length}枚をZIPでダウンロード` : '1枚をダウンロード'}>
            <span>
              <Button
                variant="outlined"
                color="warning"
                startIcon={downloading ? <CircularProgress size={16} /> : <DownloadIcon />}
                onClick={handleDownloadImages}
                disabled={downloading}
              >
                添付画像をダウンロード（{attachedImages.length}枚）
              </Button>
            </span>
          </Tooltip>
        )}

        {/* メインのコピーボタン */}
        <Button
          variant="contained"
          size="large"
          startIcon={copied ? <CheckIcon /> : <CopyIcon />}
          onClick={handleCopy}
          color={copied ? 'success' : 'primary'}
          sx={{ fontWeight: 'bold', minWidth: 160 }}
        >
          {copied ? 'コピーしました！' : '作成指示をコピー'}
        </Button>
      </DialogActions>
    </Dialog>

    {/* ── リフレッシュ確認ダイアログ ── */}
    {/* 手動入力済みの学校・交通情報を上書きする前に確認する */}
    <Dialog
      open={refreshConfirmOpen}
      onClose={() => setRefreshConfirmOpen(false)}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 'bold', pb: 1 }}>
        🔄 学校・交通情報を再取得しますか？
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>
          現在入力されている学校・交通情報を、添付資料2の保存値または学校区APIで上書きします。
        </Typography>
        <Typography variant="body2" color="text.secondary">
          手動で修正した内容がある場合は、再取得後に内容を確認してください。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => setRefreshConfirmOpen(false)}
          color="inherit"
        >
          キャンセル
        </Button>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={() => {
            setRefreshConfirmOpen(false);
            setInfoFetched(false);
            fetchSchoolTransit(true);
          }}
        >
          再取得して上書き
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
