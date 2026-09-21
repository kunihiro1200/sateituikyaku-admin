import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Container,
  TextField,
  Grid,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { ArrowBack, Print as PrintIcon, Save as SaveIcon } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface SellerData {
  id: string;
  sellerNumber?: string;
  name?: string;
  address?: string;
  propertyAddress?: string;
  property_address?: string;
  propertyType?: string;
  landArea?: number;
  landAreaVerified?: number;
  buildingArea?: number;
  buildingAreaVerified?: number;
  buildYear?: number;
  structure?: string;
  floorPlan?: string;
  currentStatus?: string;
  comments?: string;
  valuationAmount1?: number;
  valuationAmount2?: number;
  valuationAmount3?: number;
  valuationText?: string;
  appointmentDate?: string;
  visitDate?: string;
  property?: {
    address?: string;
    landArea?: number;
    landAreaVerified?: number;
    buildingArea?: number;
    buildingAreaVerified?: number;
    buildYear?: number;
    structure?: string;
    floorPlan?: string;
    propertyType?: string;
    sellerSituation?: string;
    currentStatus?: string;
  };
}

interface DocumentFields {
  // 学校・駅（名称 + 徒歩分）
  elementary_school_name: string;
  elementary_school_walk: string;
  junior_high_school_name: string;
  junior_high_school_walk: string;
  nearest_station_name: string;
  nearest_station_walk: string;
  nearest_bus_stop_name: string;
  nearest_bus_stop_walk: string;
  // マンション用チェックボックス
  currently_listed_same_building_checked: boolean;
  same_building_sold_case_checked: boolean;
  nearby_mansion_sold_case_checked: boolean;
  // マンション用テキスト
  management_fee: string;
  repair_reserve_fund: string;
  // マンション以外用チェックボックス
  current_nearby_listing_checked: boolean;
  past_sold_case_checked: boolean;
  // マンション以外用テキスト
  boundary_stake: string;
  road_width: string;
  road_contact: string;
  // 共通
  property_tax: string;
  parking: string;
  pet: string;
  // 現地調査チェックリスト memo
  site_check_memo1: string;
  site_check_memo2: string;
  site_check_memo3: string;
  site_check_memo4: string;
}

const EMPTY_FIELDS: DocumentFields = {
  elementary_school_name: '',
  elementary_school_walk: '',
  junior_high_school_name: '',
  junior_high_school_walk: '',
  nearest_station_name: '',
  nearest_station_walk: '',
  nearest_bus_stop_name: '',
  nearest_bus_stop_walk: '',
  currently_listed_same_building_checked: false,
  same_building_sold_case_checked: false,
  nearby_mansion_sold_case_checked: false,
  management_fee: '',
  repair_reserve_fund: '',
  current_nearby_listing_checked: false,
  past_sold_case_checked: false,
  boundary_stake: '',
  road_width: '',
  road_contact: '',
  property_tax: '',
  parking: '',
  pet: '',
  site_check_memo1: '',
  site_check_memo2: '',
  site_check_memo3: '',
  site_check_memo4: '',
};

/** 万円表示 */
const fmt = (amount?: number) =>
  amount ? `${Math.round(amount / 10000).toLocaleString()}万円` : '';

/** ⚠️ new Date() 不使用（UTC→JST ズレ回避） */
const fmtDatetime = (raw?: string): string => {
  if (!raw) return '-';
  const s = String(raw);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (d) return `${d[1]}/${d[2]}/${d[3]}`;
  return s;
};

export default function AttachedDocument2Page() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employee } = useAuthStore();

  const [seller, setSeller] = useState<SellerData | null>(null);
  const [fields, setFields] = useState<DocumentFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [sellerRes, docRes] = await Promise.all([
        api.get<SellerData>(`/api/sellers/${id}`),
        api.get(`/api/sellers/${id}/attached-document2`),
      ]);
      setSeller(sellerRes.data);
      const d = docRes.data || {};
      setFields({
        elementary_school_name: d.elementary_school_name || '',
        elementary_school_walk: d.elementary_school_walk || '',
        junior_high_school_name: d.junior_high_school_name || '',
        junior_high_school_walk: d.junior_high_school_walk || '',
        nearest_station_name: d.nearest_station_name || '',
        nearest_station_walk: d.nearest_station_walk || '',
        nearest_bus_stop_name: d.nearest_bus_stop_name || '',
        nearest_bus_stop_walk: d.nearest_bus_stop_walk || '',
        currently_listed_same_building_checked: !!d.currently_listed_same_building_checked,
        same_building_sold_case_checked: !!d.same_building_sold_case_checked,
        nearby_mansion_sold_case_checked: !!d.nearby_mansion_sold_case_checked,
        management_fee: d.management_fee || '',
        repair_reserve_fund: d.repair_reserve_fund || '',
        current_nearby_listing_checked: !!d.current_nearby_listing_checked,
        past_sold_case_checked: !!d.past_sold_case_checked,
        boundary_stake: d.boundary_stake || '',
        road_width: d.road_width || '',
        road_contact: d.road_contact || '',
        property_tax: d.property_tax || '',
        parking: d.parking || '',
        pet: d.pet || '',
        site_check_memo1: d.site_check_memo1 || '',
        site_check_memo2: d.site_check_memo2 || '',
        site_check_memo3: d.site_check_memo3 || '',
        site_check_memo4: d.site_check_memo4 || '',
      });
      setIsDirty(false);
    } catch (err: any) {
      console.error('Failed to fetch attached-document2 data:', err);
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const set = (key: keyof DocumentFields, value: string | boolean) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaveSuccess(false);
  };

  const handleSave = async (): Promise<boolean> => {
    if (!id) return false;
    try {
      setSaving(true);
      setError(null);
      await api.put(`/api/sellers/${id}/attached-document2`, {
        ...fields,
        updated_by: employee?.name || employee?.email || null,
      });
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      return true;
    } catch (err: any) {
      setError('保存に失敗しました');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── 物件情報（property優先、なければseller直接フィールド） ──
  const propertyAddress = seller?.property?.address || seller?.propertyAddress || seller?.property_address || '-';
  const propertyType    = seller?.property?.propertyType || seller?.propertyType || '-';
  const landArea        = seller?.property?.landArea ?? seller?.landArea;
  const landVerified    = seller?.property?.landAreaVerified ?? seller?.landAreaVerified;
  const buildArea       = seller?.property?.buildingArea ?? seller?.buildingArea;
  const buildVerified   = seller?.property?.buildingAreaVerified ?? seller?.buildingAreaVerified;
  const buildYear       = seller?.property?.buildYear ?? seller?.buildYear;
  const structure       = seller?.property?.structure || seller?.structure || '-';
  const floorPlan       = seller?.property?.floorPlan || seller?.floorPlan || '-';
  const currentStatus   = seller?.property?.sellerSituation || seller?.property?.currentStatus || seller?.currentStatus || '-';

  const isMansion = propertyType === 'apartment' || propertyType === 'マ' || propertyType === 'マンション';

  const valuationDisplay = seller?.valuationText
    ? seller.valuationText
    : [seller?.valuationAmount1, seller?.valuationAmount2, seller?.valuationAmount3]
        .filter((v): v is number => !!v).map(fmt).join(' 〜 ') || '-';

  const visitSchedule = fmtDatetime((seller?.appointmentDate as string) || (seller?.visitDate as string));

  // ── 印刷用HTMLを別ウィンドウで開く ──
  const generatePrintHtml = () => {
    const cb = (checked: boolean) => checked ? '☑' : '☐';
    const landText = (landArea ? `${landArea}㎡` : '-') + (landVerified ? `　（当社調べ：${landVerified}㎡）` : '');
    const buildText = (buildArea ? `${buildArea}㎡` : '-') + (buildVerified ? `　（当社調べ：${buildVerified}㎡）` : '');

    const mansionSection = isMansion ? `
      <table class="info-table" style="margin-bottom:6pt">
        <tr><td class="lbl" colspan="2">近隣募集・成約事例</td></tr>
        <tr><td colspan="2" style="padding:4pt 6pt;font-size:9pt;">
          ${cb(fields.currently_listed_same_building_checked)} 現在募集中（同マンション）　
          ${cb(fields.same_building_sold_case_checked)} 同マンションの成約事例　
          ${cb(fields.nearby_mansion_sold_case_checked)} 周辺のマンションの成約事例
        </td></tr>
      </table>
      <table class="info-table" style="margin-bottom:6pt">
        <tr>
          <td class="lbl" style="width:60pt">管理費</td>
          <td class="val">${fields.management_fee || ''}</td>
          <td class="lbl" style="width:60pt">修繕積立金</td>
          <td class="val">${fields.repair_reserve_fund || ''}</td>
        </tr>
      </table>` : `
      <table class="info-table" style="margin-bottom:6pt">
        <tr><td colspan="4" style="padding:4pt 6pt;font-size:9pt;">
          ${cb(fields.current_nearby_listing_checked)} 現在の近隣募集中　
          ${cb(fields.past_sold_case_checked)} 過去成約事例
        </td></tr>
      </table>
      <table class="info-table" style="margin-bottom:6pt">
        <tr>
          <td class="lbl" style="width:60pt">境界標（杭）</td>
          <td class="val">${fields.boundary_stake || ''}</td>
          <td class="lbl" style="width:50pt">道路幅</td>
          <td class="val">${fields.road_width || ''}</td>
          <td class="lbl" style="width:40pt">接道</td>
          <td class="val">${fields.road_contact || ''}</td>
        </tr>
      </table>`;


    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>添付資料２ - ${seller?.sellerNumber || ''}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; padding: 0; }
  body { font-family: 'Hiragino Kaku Gothic Pro','Yu Gothic','MS Gothic',sans-serif; font-size: 9pt; color: #000; }
  .page { display: flex; flex-direction: column; height: 277mm; padding: 0; }
  h1 { font-size: 13pt; font-weight: bold; margin: 0 0 1pt; border-bottom: 2pt solid #000; padding-bottom: 2pt; flex-shrink: 0; }
  .sub { font-size: 8pt; color: #555; margin-bottom: 4pt; flex-shrink: 0; }
  .row2 { display: flex; gap: 5pt; margin-bottom: 5pt; flex-shrink: 0; }
  .row2 > div { flex: 1; border: 1pt solid #888; padding: 4pt; }
  .section-title { font-weight: bold; font-size: 8.5pt; border-bottom: 1pt solid #ccc; padding-bottom: 2pt; margin-bottom: 3pt; }
  .info-line { font-size: 8pt; line-height: 1.6; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 5pt; margin-bottom: 5pt; flex-shrink: 0; }
  .box { border: 1pt solid #888; padding: 4pt; }
  .box-lbl { font-size: 7pt; color: #555; }
  .box-val { font-size: 10pt; font-weight: bold; }
  .comment-box { border: 1pt solid #888; padding: 5pt; margin-bottom: 5pt; font-size: 7.5pt; white-space: pre-wrap; line-height: 1.45; overflow: hidden; flex: 1; min-height: 0; }
  .comment-lbl { font-size: 7pt; color: #555; font-weight: bold; margin-bottom: 2pt; }
  .tables-block { flex-shrink: 0; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 4pt; border: 1pt solid #888; }
  .info-table td { border: 1pt solid #888; padding: 2pt 4pt; font-size: 8pt; vertical-align: middle; }
  .lbl { background: #f0f0f0; font-weight: bold; white-space: nowrap; width: 52pt; }
  .val { min-height: 12pt; }
  .narrow { width: 48pt; }
  textarea { width: 100%; box-sizing: border-box; font-family: inherit; font-size: 8pt; border: none; outline: none; resize: none; background: transparent; padding: 0; }
</style>
</head>
<body>
<div class="page">
  <h1>添付資料２</h1>
  ${seller?.sellerNumber ? `<div class="sub">売主番号：${seller.sellerNumber}</div>` : ''}

  <div class="row2">
    <div>
      <div class="section-title">物件情報</div>
      <div class="info-line">
        <div><strong>住所：</strong>${propertyAddress}</div>
        <div><strong>種別：</strong>${propertyType}　<strong>現況：</strong>${currentStatus}</div>
        <div><strong>土地：</strong>${landText}</div>
        <div><strong>建物：</strong>${buildText}</div>
        <div><strong>築年：</strong>${buildYear || '-'}　<strong>構造：</strong>${structure}　<strong>間取り：</strong>${floorPlan}</div>
      </div>
    </div>
    <div>
      <div class="section-title">売主情報</div>
      <div class="info-line">
        <div><strong>氏名：</strong>${seller?.name || '-'}</div>
        <div><strong>住所：</strong>${seller?.address || '-'}</div>
      </div>
    </div>
  </div>

  <div class="grid2">
    <div class="box"><div class="box-lbl">査定額</div><div class="box-val">${valuationDisplay}</div></div>
    <div class="box"><div class="box-lbl">訪問予定日時</div><div class="box-val">${visitSchedule}</div></div>
  </div>

  <div class="comment-box">
    <div class="comment-lbl">コメント内容</div>
    ${(seller?.comments || '（コメントなし）').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
  </div>

  <div class="tables-block">
  <table class="info-table">
    <tr>
      <td class="lbl">小学校</td><td class="val">${fields.elementary_school_name || ''}</td><td class="val narrow">${fields.elementary_school_walk || ''}</td>
      <td class="lbl">中学校</td><td class="val">${fields.junior_high_school_name || ''}</td><td class="val narrow">${fields.junior_high_school_walk || ''}</td>
    </tr>
    <tr>
      <td class="lbl">最寄り駅</td><td class="val">${fields.nearest_station_name || ''}</td><td class="val narrow">${fields.nearest_station_walk || ''}</td>
      <td class="lbl">最寄りバス停</td><td class="val">${fields.nearest_bus_stop_name || ''}</td><td class="val narrow">${fields.nearest_bus_stop_walk || ''}</td>
    </tr>
  </table>

  ${mansionSection}

  <table class="info-table">
    <tr>
      <td class="lbl" style="width:52pt">固定資産税</td>
      <td class="val">${fields.property_tax || `<span style="color:#bbb;font-size:7.5pt">${isMansion ? 'マンションは５年以内に軽減税率あり' : '戸建ては３年以内に軽減税率あり'}</span>`}</td>
      <td class="lbl" style="width:44pt">駐車場</td>
      <td class="val">${fields.parking || `<span style="color:#bbb;font-size:7.5pt">${isMansion ? '機械式の場合　高さ、奥行き、幅を確認' : '堀車庫の場合は高さ、幅、奥行き M'}</span>`}</td>
      ${isMansion ? `<td class="lbl" style="width:36pt">ペット</td><td class="val">${fields.pet || ''}</td>` : ''}
    </tr>
  </table>
  </div>
</div>

<div class="page" style="page-break-before: always;">
  <table class="info-table" style="margin-bottom:6pt">
    <tr><td colspan="3" class="lbl" style="background:#222;color:#fff;font-size:10pt;padding:5pt 6pt;width:auto">現地調査</td></tr>
    <tr>
      <td style="border:1pt solid #888;padding:3pt 5pt;width:52pt;font-size:8.5pt;vertical-align:top">□ memo<br><br><textarea style="width:100%;border:none;font-size:8pt;resize:none;font-family:inherit;min-height:20pt">${fields.site_check_memo1 || ''}</textarea></td>
      <td style="border:1pt solid #888;padding:3pt 5pt;width:80pt;font-size:8.5pt;vertical-align:top;font-weight:bold">境界、越境</td>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top">・目視で確認、できない場合は<br>　売主または隣地の方に聞く<br>・区画整理地域であらわれる場合が多い</td>
    </tr>
    <tr>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top">□ memo<br><br><textarea style="width:100%;border:none;font-size:8pt;resize:none;font-family:inherit;min-height:40pt">${fields.site_check_memo2 || ''}</textarea></td>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top;font-weight:bold">配水管（上水）<br>浄化槽</td>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top">・量水器boxを開け、メーターが回っていないか、何mm口径か、水道番号調べる<br>・配管の太さは目視でどちらが太いかチェック<br>配水管（下水）公共下水の場合問題なし。浄化槽の場合、一般か集中かの確認<br>・集中浄化槽の場合、場所と管理人（会社）費用負担がどこで発生するか（自治会費なども）確認。<br>・以前浄化槽の使用をしていた場合、埋設している可能性が高い（要登記記載）</td>
    </tr>
    <tr>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top">□ memo<br><br><textarea style="width:100%;border:none;font-size:8pt;resize:none;font-family:inherit;min-height:20pt">${fields.site_check_memo3 || ''}</textarea></td>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top;font-weight:bold">擁壁、<br>崖の確認</td>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top">基本的に目視で確認、測量<br>・すでに許可が下りているかどうか<br>開発登録簿を確認（市役所の開発指導課）<br>・その他の法令に引っかかっていないか確認</td>
    </tr>
    <tr>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top">□ memo<br><br><textarea style="width:100%;border:none;font-size:8pt;resize:none;font-family:inherit;min-height:20pt">${fields.site_check_memo4 || ''}</textarea></td>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top;font-weight:bold">都市ガス<br>or<br>プロパンガス</td>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top">お家の引き込み管を見る<br>・プロパンガスの場合、LPガスと記載または設置場所がある</td>
    </tr>
  </table>

  <table class="info-table">
    <tr><td colspan="3" class="lbl" style="background:#222;color:#fff;font-size:10pt;padding:5pt 6pt;width:auto">確認事項</td></tr>
    <tr>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;width:100pt">□ 固定資産税</td>
      <td colspan="2" style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">${fields.property_tax || ''}</td>
    </tr>
    <tr>
      <td colspan="3" style="border:1pt solid #888;padding:3pt 5pt;font-size:8pt">※新築の場合軽減税率あり（戸建では3年以内、マンションは5年以内）</td>
    </tr>
    <tr>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">□ 駐車場</td>
      <td colspan="2" style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">${fields.parking || `<span style="color:#bbb">${isMansion ? '機械式の場合　高さ、奥行き、幅を確認' : '堀車庫の場合は高さ、幅、奥行き M'}</span>`}</td>
    </tr>
    <tr>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">□ 内覧時</td>
      <td colspan="2" style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">曜日・時間　　　　　　　立会有無　　連絡<br>空家の場合　鍵（現地　　　　　　　　1200・事務所）</td>
    </tr>
    ${isMansion ? `
    <tr>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">□ 温泉</td>
      <td colspan="2" style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">管理会社　　　変更料　　　　　使用料　　　　/月<br>自主管理　ルールや管理方法<br>無の場合新たに引込できる？</td>
    </tr>
    <tr>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">□ ペット</td>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">${fields.pet || ''}</td>
      <td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">※可　OR　不可　頭数や種別</td>
    </tr>` : ''}
    <tr>
      <td colspan="3" style="border:1pt solid #888;padding:3pt 5pt;font-size:8pt">※不具合箇所・リフォーム履歴等は告知書付帯設備表で確認</td>
    </tr>
  </table>
</div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
  };

  const handlePrint = async () => {
    if (isDirty) { const ok = await handleSave(); if (!ok) return; }
    const html = generatePrintHtml();
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  // ── ヘルパー：横2列入力行（名称 + 徒歩分） ──
  const RowPair = ({
    label,
    nameKey,
    walkKey,
  }: {
    label: string;
    nameKey: keyof DocumentFields;
    walkKey: keyof DocumentFields;
  }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.8, borderBottom: '1px solid #ccc' }}>
      <Typography sx={{ width: 90, flexShrink: 0, fontWeight: 'bold', fontSize: '9.5pt' }}>{label}</Typography>
      <TextField
        size="small" variant="outlined" placeholder="学校名・駅名等"
        value={fields[nameKey] as string}
        onChange={(e) => set(nameKey, e.target.value)}
        sx={{ flex: 2, '& .MuiOutlinedInput-root': { fontSize: '9.5pt' }, '& input::placeholder': { color: '#bbb', opacity: 1 } }}
        inputProps={{ style: { color: fields[nameKey] ? '#000' : '#bbb' } }}
      />
      <TextField
        size="small" variant="outlined" placeholder="徒歩○分"
        value={fields[walkKey] as string}
        onChange={(e) => set(walkKey, e.target.value)}
        sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '9.5pt' }, '& input::placeholder': { color: '#bbb', opacity: 1 } }}
        inputProps={{ style: { color: fields[walkKey] ? '#000' : '#bbb' } }}
      />
    </Box>
  );

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <>
      <style>{`
        @media screen { .print-page { max-width: 800px; margin: 0 auto; } }
      `}</style>

      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* ヘッダー（印刷時非表示） */}
        <Box className="no-print" sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBack />} variant="outlined" onClick={() => { if (window.history.length > 1) { navigate(-1); } else { window.close(); } }} size="small">戻る</Button>
          <Typography variant="h6" fontWeight="bold">添付資料２（試作中）</Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Button startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              variant="outlined" onClick={handleSave} disabled={saving || !isDirty} size="small"
              color={isDirty ? 'primary' : 'inherit'}>
              {saving ? '保存中...' : '保存'}
            </Button>
            <Button startIcon={<PrintIcon />} variant="contained" onClick={handlePrint} size="small" disabled={saving}
              sx={{ bgcolor: '#37474f', '&:hover': { bgcolor: '#263238' } }}>
              印刷
            </Button>
          </Box>
        </Box>

        {error && <Box className="no-print" sx={{ px: 2, pt: 2 }}><Alert severity="error">{error}</Alert></Box>}
        {saveSuccess && <Box className="no-print" sx={{ px: 2, pt: 2 }}><Alert severity="success">保存しました</Alert></Box>}

        <Container maxWidth="md" sx={{ py: 3 }}>
          <Box className="print-page">

            {/* タイトル */}
            <Box sx={{ mb: 1.5, pb: 0.5, borderBottom: '2px solid #000' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '14pt' }}>添付資料２</Typography>
              {seller?.sellerNumber && (
                <Typography sx={{ fontSize: '9pt', color: 'text.secondary' }}>売主番号：{seller.sellerNumber}</Typography>
              )}
            </Box>

            {/* ── 物件情報・売主情報（横2列、高さを合わせる） ── */}
            <Grid container spacing={1} sx={{ mb: 1 }} alignItems="stretch">
              <Grid item xs={6} sx={{ display: 'flex' }}>
                <Paper variant="outlined" sx={{ p: 1, width: '100%' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9.5pt', mb: 0.3, borderBottom: '1px solid #ccc', pb: 0.3 }}>物件情報</Typography>
                  <Box sx={{ fontSize: '8.5pt', lineHeight: 1.7 }}>
                    <div><strong>住所：</strong>{propertyAddress}</div>
                    <div><strong>種別：</strong>{propertyType}　<strong>現況：</strong>{currentStatus}</div>
                    <div>
                      <strong>土地：</strong>
                      {landArea ? `${landArea}㎡` : '-'}
                      {landVerified ? <span style={{ marginLeft: 4 }}>（当社調べ：{landVerified}㎡）</span> : ''}
                    </div>
                    <div>
                      <strong>建物：</strong>
                      {buildArea ? `${buildArea}㎡` : '-'}
                      {buildVerified ? <span style={{ marginLeft: 4 }}>（当社調べ：{buildVerified}㎡）</span> : ''}
                    </div>
                    <div><strong>築年：</strong>{buildYear || '-'}　<strong>構造：</strong>{structure}　<strong>間取り：</strong>{floorPlan}</div>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={6} sx={{ display: 'flex' }}>
                <Paper variant="outlined" sx={{ p: 1, width: '100%' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9.5pt', mb: 0.3, borderBottom: '1px solid #ccc', pb: 0.3 }}>売主情報</Typography>
                  <Box sx={{ fontSize: '8.5pt', lineHeight: 1.7 }}>
                    <div><strong>氏名：</strong>{seller?.name || '-'}</div>
                    <div><strong>住所：</strong>{seller?.address || '-'}</div>
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            {/* 査定額・訪問予定日時 */}
            <Grid container spacing={1} sx={{ mb: 1 }}>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 0.8 }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '8pt', color: '#555' }}>査定額</Typography>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '10.5pt' }}>{valuationDisplay}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 0.8 }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '8pt', color: '#555' }}>訪問予定日時</Typography>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '10.5pt' }}>{visitSchedule}</Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* コメント */}
            <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '8pt', color: '#555', mb: 0.3 }}>コメント内容</Typography>
              <Typography sx={{ fontSize: '8pt', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {seller?.comments || '（コメントなし）'}
              </Typography>
            </Paper>

            {/* ── 学校・駅（全種別共通） ── */}
            <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
              {/* 小学校・中学校 横並び */}
              <Grid container spacing={1} sx={{ mb: 0.5 }}>
                <Grid item xs={6}>
                  <RowPair label="小学校" nameKey="elementary_school_name" walkKey="elementary_school_walk" />
                </Grid>
                <Grid item xs={6}>
                  <RowPair label="中学校" nameKey="junior_high_school_name" walkKey="junior_high_school_walk" />
                </Grid>
              </Grid>
              {/* 最寄り駅・バス停 横並び */}
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <RowPair label="最寄り駅" nameKey="nearest_station_name" walkKey="nearest_station_walk" />
                </Grid>
                <Grid item xs={6}>
                  <RowPair label="最寄りバス停" nameKey="nearest_bus_stop_name" walkKey="nearest_bus_stop_walk" />
                </Grid>
              </Grid>
            </Paper>

            {/* ── 種別分岐セクション ── */}
            {isMansion ? (
              <>
                {/* マンション：チェックボックス3種 */}
                <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', mb: 0.5 }}>近隣募集・成約事例</Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {([
                      { key: 'currently_listed_same_building_checked' as const, label: '現在募集中（同マンション）' },
                      { key: 'same_building_sold_case_checked' as const, label: '同マンションの成約事例' },
                      { key: 'nearby_mansion_sold_case_checked' as const, label: '周辺のマンションの成約事例' },
                    ]).map((c) => (
                      <FormControlLabel key={c.key}
                        control={<Checkbox size="small" checked={fields[c.key]} onChange={(e) => set(c.key, e.target.checked)} />}
                        label={<Typography sx={{ fontSize: '9pt' }}>{c.label}</Typography>}
                      />
                    ))}
                  </Box>
                </Paper>

                {/* マンション：管理費・修繕積立金（横並び） */}
                <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
                  <Grid container spacing={2}>
                    {([
                      { key: 'management_fee' as const, label: '管理費' },
                      { key: 'repair_reserve_fund' as const, label: '修繕積立金' },
                    ]).map((f) => (
                      <Grid item xs={6} key={f.key}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontWeight: 'bold', fontSize: '9.5pt', flexShrink: 0, width: 72 }}>{f.label}</Typography>
                          <TextField fullWidth size="small" value={fields[f.key]} onChange={(e) => set(f.key, e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { fontSize: '9.5pt' } }} />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </>
            ) : (
              <>
                {/* マンション以外：チェックボックス2種 横並び */}
                <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {([
                      { key: 'current_nearby_listing_checked' as const, label: '現在の近隣募集中' },
                      { key: 'past_sold_case_checked' as const, label: '過去成約事例' },
                    ]).map((c) => (
                      <FormControlLabel key={c.key}
                        control={<Checkbox size="small" checked={fields[c.key]} onChange={(e) => set(c.key, e.target.checked)} />}
                        label={<Typography sx={{ fontSize: '9pt' }}>{c.label}</Typography>}
                      />
                    ))}
                  </Box>
                </Paper>

                {/* 境界標・道路幅・接道（横並び） */}
                <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
                  <Grid container spacing={2}>
                    {([
                      { key: 'boundary_stake' as const, label: '境界標（杭）' },
                      { key: 'road_width' as const, label: '道路幅' },
                      { key: 'road_contact' as const, label: '接道' },
                    ]).map((f) => (
                      <Grid item xs={4} key={f.key}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '9.5pt', mb: 0.4 }}>{f.label}</Typography>
                        <TextField fullWidth size="small" value={fields[f.key]} onChange={(e) => set(f.key, e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { fontSize: '9.5pt' } }} />
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </>
            )}

            {/* ── 固定資産税・駐車場・ペット（最下部） ── */}
            <Paper variant="outlined" sx={{ p: 1 }}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {/* 固定資産税（全種別共通） */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flex: 2 }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0 }}>固定資産税</Typography>
                  <TextField
                    fullWidth size="small"
                    value={fields.property_tax}
                    onChange={(e) => set('property_tax', e.target.value)}
                    placeholder={isMansion ? 'マンションは５年以内に軽減税率あり' : '戸建ては３年以内に軽減税率あり'}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' }, '& input::placeholder': { fontSize: '8pt', color: '#bbb' } }}
                  />
                </Box>
                {/* 駐車場（全種別共通） */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flex: 2 }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0 }}>駐車場</Typography>
                  <TextField
                    fullWidth size="small"
                    value={fields.parking}
                    onChange={(e) => set('parking', e.target.value)}
                    placeholder={isMansion ? '機械式の場合　高さ、奥行き、幅を確認' : '堀車庫の場合は高さ、幅、奥行き M'}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' }, '& input::placeholder': { fontSize: '8pt', color: '#bbb' } }}
                  />
                </Box>
                {/* ペット（マンションのみ） */}
                {isMansion && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flex: 1 }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0 }}>ペット</Typography>
                    <TextField
                      fullWidth size="small"
                      value={fields.pet}
                      onChange={(e) => set('pet', e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' } }}
                    />
                  </Box>
                )}
              </Box>
            </Paper>

            {/* ── 2枚目：現地調査チェックリスト ── */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '3px dashed #aaa' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '10pt', mb: 1, color: '#555' }}>
                ▼ 2枚目：現地調査チェックリスト
              </Typography>

              {/* 現地調査 */}
              <Paper variant="outlined" sx={{ mb: 1 }}>
                <Box sx={{ p: 0.8, bgcolor: '#222', borderRadius: '3px 3px 0 0' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '10pt', color: '#fff' }}>現地調査</Typography>
                </Box>
                {[
                  { key: 'site_check_memo1' as const, label: '境界、越境' },
                  { key: 'site_check_memo2' as const, label: '配水管（上水）浄化槽' },
                  { key: 'site_check_memo3' as const, label: '擁壁、崖の確認' },
                  { key: 'site_check_memo4' as const, label: '都市ガス or プロパンガス' },
                ].map((row, idx, arr) => (
                  <Box key={row.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.8, borderBottom: idx < arr.length - 1 ? '1px solid #ccc' : 'none' }}>
                    <Typography sx={{ fontSize: '8.5pt', color: '#555', flexShrink: 0 }}>□ memo</Typography>
                    <Typography sx={{ fontSize: '8.5pt', width: 100, flexShrink: 0, fontWeight: 'bold' }}>{row.label}</Typography>
                    <TextField fullWidth size="small" value={fields[row.key]} onChange={(e) => set(row.key, e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { fontSize: '8.5pt' } }} />
                  </Box>
                ))}
              </Paper>
            </Box>

          </Box>
        </Container>
      </Box>
    </>
  );
}
