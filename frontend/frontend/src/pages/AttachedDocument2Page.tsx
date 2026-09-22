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
  elementary_school_name: string;
  elementary_school_walk: string;
  junior_high_school_name: string;
  junior_high_school_walk: string;
  nearest_station_name: string;
  nearest_station_walk: string;
  nearest_bus_stop_name: string;
  nearest_bus_stop_walk: string;
  currently_listed_same_building_checked: boolean;
  same_building_sold_case_checked: boolean;
  nearby_mansion_sold_case_checked: boolean;
  management_fee: string;
  repair_reserve_fund: string;
  current_nearby_listing_checked: boolean;
  past_sold_case_checked: boolean;
  boundary_stake: string;
  road_width: string;
  road_contact: string;
  property_tax: string;
  parking: string;
  pet: string;
  site_check_memo1: string;
  site_check_memo2: string;
  site_check_memo3: string;
  site_check_memo4: string;
  hazard_map: string;
  mortgage_info: string;
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
  hazard_map: '',
  mortgage_info: '',
};

const fmt = (amount?: number) =>
  amount ? `${Math.round(amount / 10000).toLocaleString()}万円` : '';

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
        hazard_map: d.hazard_map || '',
        mortgage_info: d.mortgage_info || '',
      });
      setIsDirty(false);
    } catch (err: any) {
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

  // ── 物件情報 ──
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
  const isMansion       = propertyType === 'apartment' || propertyType === 'マ' || propertyType === 'マンション';

  const valuationDisplay = seller?.valuationText
    ? seller.valuationText
    : [seller?.valuationAmount1, seller?.valuationAmount2, seller?.valuationAmount3]
        .filter((v): v is number => !!v).map(fmt).join(' 〜 ') || '-';
  const visitSchedule = fmtDatetime((seller?.appointmentDate as string) || (seller?.visitDate as string));

  // ── 印刷HTML生成（文字列連結方式でバックティック入れ子を回避） ──
  const generatePrintHtml = (): string => {
    const cb = (checked: boolean) => checked ? '☑' : '☐';
    const lt = (landArea ? landArea + '㎡' : '-') + (landVerified ? '　（当社調べ：' + landVerified + '㎡）' : '');
    const bt = (buildArea ? buildArea + '㎡' : '-') + (buildVerified ? '　（当社調べ：' + buildVerified + '㎡）' : '');

    // 種別分岐HTML（マンション/非マンション）
    const mansionSection = isMansion
      ? '<table class="info-table" style="margin-bottom:4pt"><tr><td class="lbl" colspan="2">近隣募集・成約事例</td></tr>'
        + '<tr><td colspan="2" style="padding:4pt 6pt;font-size:9pt;">'
        + cb(fields.currently_listed_same_building_checked) + ' 現在募集中（同マンション）　'
        + cb(fields.same_building_sold_case_checked) + ' 同マンションの成約事例　'
        + cb(fields.nearby_mansion_sold_case_checked) + ' 周辺のマンションの成約事例'
        + '</td></tr></table>'
        + '<table class="info-table" style="margin-bottom:4pt"><tr>'
        + '<td class="lbl" style="width:60pt">管理費</td><td class="val">' + (fields.management_fee || '') + '</td>'
        + '<td class="lbl" style="width:60pt">修繕積立金</td><td class="val">' + (fields.repair_reserve_fund || '') + '</td>'
        + '</tr></table>'
      : '<table class="info-table" style="margin-bottom:4pt"><tr><td colspan="4" style="padding:4pt 6pt;font-size:9pt;">'
        + cb(fields.current_nearby_listing_checked) + ' 現在の近隣募集中　'
        + cb(fields.past_sold_case_checked) + ' 過去成約事例'
        + '</td></tr></table>'
        + '<table class="info-table" style="margin-bottom:4pt"><tr>'
        + '<td class="lbl" style="width:60pt">境界標（杭）</td><td class="val">' + (fields.boundary_stake || '') + '</td>'
        + '<td class="lbl" style="width:50pt">道路幅</td><td class="val">' + (fields.road_width || '') + '</td>'
        + '<td class="lbl" style="width:40pt">接道</td><td class="val">' + (fields.road_contact || '') + '</td>'
        + '</tr></table>';

    const mansionConfirmRows = isMansion
      ? '<tr><td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">□ 温泉</td>'
        + '<td colspan="2" style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">'
        + '管理会社　　　変更料　　　　　使用料　　　　/月<br>自主管理　ルールや管理方法<br>無の場合新たに引込できる？</td></tr>'
        + '<tr><td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">□ ペット</td>'
        + '<td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">' + (fields.pet || '') + '</td>'
        + '<td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">※可　OR　不可　頭数や種別</td></tr>'
      : '';

    const roadRows = [1, 2, 3, 4].map(() =>
      '<tr>'
      + '<td style="border:1pt solid #000;padding:3pt 5pt;height:14pt;"></td>'
      + '<td style="border:1pt solid #000;padding:3pt 5pt;text-align:center;">▼</td>'
      + '<td style="border:1pt solid #000;padding:3pt 5pt;text-align:center;">▼</td>'
      + '<td style="border:1pt solid #000;padding:3pt 5pt;">　　　　m</td>'
      + '<td style="border:1pt solid #000;padding:3pt 5pt;">　　　　m</td>'
      + '</tr>'
    ).join('');

    const CSS = '@page{size:A4;margin:8mm}'
      + '*{box-sizing:border-box}'
      + 'html,body{height:100%;margin:0;padding:0}'
      + 'body{font-family:\'Hiragino Kaku Gothic Pro\',\'Yu Gothic\',\'MS Gothic\',sans-serif;font-size:9pt;color:#000}'
      + '.page{display:flex;flex-direction:column;height:277mm}'
      + 'h1{font-size:13pt;font-weight:bold;margin:0 0 1pt;border-bottom:2pt solid #000;padding-bottom:2pt;flex-shrink:0}'
      + '.sub{font-size:8pt;color:#555;margin-bottom:4pt;flex-shrink:0}'
      + '.row2{display:flex;gap:5pt;margin-bottom:5pt;flex-shrink:0}'
      + '.row2>div{flex:1;border:1pt solid #888;padding:4pt}'
      + '.stitle{font-weight:bold;font-size:8.5pt;border-bottom:1pt solid #ccc;padding-bottom:2pt;margin-bottom:3pt}'
      + '.iline{font-size:8pt;line-height:1.6}'
      + '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:5pt;margin-bottom:5pt;flex-shrink:0}'
      + '.box{border:1pt solid #888;padding:4pt}'
      + '.blbl{font-size:7pt;color:#555}'
      + '.bval{font-size:10pt;font-weight:bold}'
      + '.cbox{border:1pt solid #888;padding:5pt;margin-bottom:5pt;font-size:7.5pt;white-space:pre-wrap;line-height:1.45;overflow:hidden;flex:1;min-height:0}'
      + '.clbl{font-size:7pt;color:#555;font-weight:bold;margin-bottom:2pt}'
      + '.tblock{flex-shrink:0}'
      + '.it{width:100%;border-collapse:collapse;margin-bottom:4pt;border:1pt solid #888}'
      + '.it td{border:1pt solid #888;padding:2pt 4pt;font-size:8pt;vertical-align:middle}'
      + '.lbl{background:#f0f0f0;font-weight:bold;white-space:nowrap;width:52pt}'
      + '.val{min-height:12pt}'
      + '.narrow{width:48pt}'
      + 'textarea{width:100%;box-sizing:border-box;font-family:inherit;font-size:8pt;border:none;outline:none;resize:none;background:transparent;padding:0}';

    // ── 1枚目 ──
    const page1 = '<div class="page">'
      + '<h1>添付資料２</h1>'
      + (seller?.sellerNumber ? '<div class="sub">売主番号：' + seller.sellerNumber + '</div>' : '')
      + '<div class="row2">'
      + '<div><div class="stitle">物件情報</div><div class="iline">'
      + '<div><strong>住所：</strong>' + propertyAddress + '</div>'
      + '<div><strong>種別：</strong>' + propertyType + '　<strong>現況：</strong>' + currentStatus + '</div>'
      + '<div><strong>土地：</strong>' + lt + '</div>'
      + '<div><strong>建物：</strong>' + bt + '</div>'
      + '<div><strong>築年：</strong>' + (buildYear || '-') + '　<strong>構造：</strong>' + structure + '　<strong>間取り：</strong>' + floorPlan + '</div>'
      + '</div></div>'
      + '<div><div class="stitle">売主情報</div><div class="iline">'
      + '<div><strong>氏名：</strong>' + (seller?.name || '-') + '</div>'
      + '<div><strong>住所：</strong>' + (seller?.address || '-') + '</div>'
      + '</div></div>'
      + '</div>'
      + '<div class="grid2">'
      + '<div class="box"><div class="blbl">査定額</div><div class="bval">' + valuationDisplay + '</div></div>'
      + '<div class="box"><div class="blbl">訪問予定日時</div><div class="bval">' + visitSchedule + '</div></div>'
      + '</div>'
      + '<div class="cbox"><div class="clbl">コメント内容</div>'
      + (seller?.comments || '（コメントなし）').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      + '</div>'
      + '<div class="tblock">'
      + '<table class="it"><tr>'
      + '<td class="lbl">ハザードマップ</td><td class="val" style="color:' + (fields.hazard_map ? '#000' : '#bbb') + '">' + (fields.hazard_map || '水害、土砂災害') + '</td>'
      + '<td class="lbl">抵当権</td><td class="val" style="color:' + (fields.mortgage_info ? '#000' : '#bbb') + '">' + (fields.mortgage_info || '抵当権の種類と抵当権先') + '</td>'
      + '</tr></table>'
      + '<table class="it"><tr>'
      + '<td class="lbl">小学校</td><td class="val">' + (fields.elementary_school_name || '') + '</td><td class="val narrow">' + (fields.elementary_school_walk || '') + '</td>'
      + '<td class="lbl">中学校</td><td class="val">' + (fields.junior_high_school_name || '') + '</td><td class="val narrow">' + (fields.junior_high_school_walk || '') + '</td>'
      + '</tr><tr>'
      + '<td class="lbl">最寄り駅</td><td class="val">' + (fields.nearest_station_name || '') + '</td><td class="val narrow">' + (fields.nearest_station_walk || '') + '</td>'
      + '<td class="lbl">最寄りバス停</td><td class="val">' + (fields.nearest_bus_stop_name || '') + '</td><td class="val narrow">' + (fields.nearest_bus_stop_walk || '') + '</td>'
      + '</tr></table>'
      + mansionSection
      + '<table class="it"><tr>'
      + '<td class="lbl" style="width:52pt">固定資産税</td>'
      + '<td class="val">' + (fields.property_tax || '<span style="color:#bbb;font-size:7.5pt">' + (isMansion ? 'マンションは５年以内に軽減税率あり' : '戸建ては３年以内に軽減税率あり') + '</span>') + '</td>'
      + '<td class="lbl" style="width:44pt">駐車場</td>'
      + '<td class="val">' + (fields.parking || '<span style="color:#bbb;font-size:7.5pt">' + (isMansion ? '機械式の場合　高さ、奥行き、幅を確認' : '堀車庫の場合は高さ、幅、奥行き M') + '</span>') + '</td>'
      + (isMansion ? '<td class="lbl" style="width:36pt">ペット</td><td class="val">' + (fields.pet || '') + '</td>' : '')
      + '</tr></table>'
      + '</div>'
      + '</div>';

    // ── 2枚目 ──
    const T = '<td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top">';
    const TB = '<td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;vertical-align:top;font-weight:bold;width:80pt">';
    const page2 = '<div style="page-break-before:always;display:flex;flex-direction:column;height:277mm">'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:6pt">'
      + '<tr><td colspan="3" style="background:#222;color:#fff;font-size:10pt;font-weight:bold;padding:5pt 6pt">現地調査</td></tr>'
      + '<tr>'
      + T + '□ memo<br><br><textarea style="min-height:20pt">' + (fields.site_check_memo1 || '') + '</textarea></td>'
      + TB + '境界、越境</td>'
      + T + '・目視で確認、できない場合は<br>　売主または隣地の方に聞く<br>・区画整理地域であらわれる場合が多い</td>'
      + '</tr><tr>'
      + T + '□ memo<br><br><textarea style="min-height:40pt">' + (fields.site_check_memo2 || '') + '</textarea></td>'
      + TB + '配水管（上水）<br>浄化槽</td>'
      + T + '・量水器boxを開け、メーターが回っていないか、何mm口径か、水道番号調べる<br>・配管の太さは目視でどちらが太いかチェック<br>配水管（下水）公共下水の場合問題なし。浄化槽の場合、一般か集中かの確認<br>・集中浄化槽の場合、場所と管理人（会社）費用負担がどこで発生するか（自治会費なども）確認。<br>・以前浄化槽の使用をしていた場合、埋設している可能性が高い（要登記記載）</td>'
      + '</tr><tr>'
      + T + '□ memo<br><br><textarea style="min-height:20pt">' + (fields.site_check_memo3 || '') + '</textarea></td>'
      + TB + '擁壁、<br>崖の確認</td>'
      + T + '基本的に目視で確認、測量<br>・すでに許可が下りているかどうか<br>開発登録簿を確認（市役所の開発指導課）<br>・その他の法令に引っかかっていないか確認</td>'
      + '</tr><tr>'
      + T + '□ memo<br><br><textarea style="min-height:20pt">' + (fields.site_check_memo4 || '') + '</textarea></td>'
      + TB + '都市ガス<br>or<br>プロパンガス</td>'
      + T + 'お家の引き込み管を見る<br>・プロパンガスの場合、LPガスと記載または設置場所がある</td>'
      + '</tr></table>'
      + '<table style="width:100%;border-collapse:collapse">'
      + '<tr><td colspan="3" style="background:#222;color:#fff;font-size:10pt;font-weight:bold;padding:5pt 6pt">確認事項</td></tr>'
      + '<tr><td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt;width:100pt">□ 固定資産税</td>'
      + '<td colspan="2" style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">' + (fields.property_tax || '') + '</td></tr>'
      + '<tr><td colspan="3" style="border:1pt solid #888;padding:3pt 5pt;font-size:8pt">※新築の場合軽減税率あり（戸建では3年以内、マンションは5年以内）</td></tr>'
      + '<tr><td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">□ 駐車場</td>'
      + '<td colspan="2" style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">' + (fields.parking || (isMansion ? '機械式の場合　高さ、奥行き、幅を確認' : '堀車庫の場合は高さ、幅、奥行き M')) + '</td></tr>'
      + '<tr><td style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">□ 内覧時</td>'
      + '<td colspan="2" style="border:1pt solid #888;padding:3pt 5pt;font-size:8.5pt">曜日・時間　　　　　　　立会有無　　連絡<br>空家の場合　鍵（現地　　　　　　　　1200・事務所）</td></tr>'
      + mansionConfirmRows
      + '<tr><td colspan="3" style="border:1pt solid #888;padding:3pt 5pt;font-size:8pt">※不具合箇所・リフォーム履歴等は告知書付帯設備表で確認</td></tr>'
      + '</table>'
      + '</div>';

    // ── 3枚目 ──
    const B = (s: string) => '<td style="border:1pt solid #000;padding:3pt 5pt;' + s + '">';
    const isFukuoka = !!(seller?.sellerNumber?.startsWith('FI'));

    // 取得書類一覧（大分版 / 福岡版）
    const items: [string, string][] = isFukuoka ? [
      // ── 福岡市役所４F でまとめて取得 ──
      ['建築概要書', '福岡市役所４F　６番窓口　PCで物件検索、証明書の交付申請　２〜３日後発行'],
      ['用途地域図、関連規制情報案内表（写し）', '福岡市役所４F　都市計画課'],
      ['市道以外の確認、証明書', '福岡市役所４F奥の窓口'],
      // ── WEB取得 ──
      ['道路台帳図', 'WEB取得'],
      ['上水道の前面道路の配管図', 'WEB取得'],
      ['公共下水か浄化槽か「下水道管図」を調べても不明な場合は確認する', 'WEB取得'],
      // ── その他 ──
      ['固定資産税公課証明', '博多区役所２F（委任状、本人確認書の写し）'],
      ['上水道の敷地内配管図', 'おそらく水道局'],
    ] : [
      ['固定資産税公課証明', ''],
      ['建築概要書＆証明書', ''],
      ['用途地域図（別府は備考欄に記入）<br>（宅地造成工事規制区域か必ず確認）', '景観　環境　居住誘導　宅地造成'],
      ['道路台帳図（別府の場合はゼンリンの住宅情報より<br>目視等を取得後、役所で確認）', ''],
      ['市道証明書（市道の場合のみ）', '番号：'],
      ['別府市：指定道路図の番号（例：10）', '番号：'],
      ['道路種類確認（市道でない場合その管轄がどこなのか）<br>（位置指定道路確認）', ''],
      ['上水道の前面道路の配管図', ''],
      ['上水道の敷地内配管図', ''],
      ['公共下水か浄化槽か「下水道管図」を調べても不明な場合は確認する', ''],
      ['<span style="font-size:7.5pt">※別府市：公共下水の場合　下水道台帳施設平面図の番号（例：71-3-(3)）</span>', '<span style="font-size:7.5pt">番号：</span>'],
    ];
    const page3 = '<div style="page-break-before:always;font-family:\'Hiragino Kaku Gothic Pro\',\'Yu Gothic\',\'MS Gothic\',sans-serif;font-size:8.5pt;color:#000">'
      + '<h2 style="text-align:center;font-size:13pt;margin:0 0 6pt;border:2pt solid #000;padding:4pt">【取得書類】</h2>'
      + '<p style="font-size:8pt;margin:0 0 4pt">取得前に「ぜんりん」「熊本」「下水道管図」を印刷していくこと。<br>「自分の住所記載の印鑑」を忘れないこと。　※別府の場合は「下水道管図」は印刷不可</p>'
      + '<div style="display:flex;gap:6pt;margin-bottom:8pt;align-items:center">'
      + '<span style="font-weight:bold">物件名 【</span>'
      + '<div style="flex:1;border-bottom:1pt solid #000;min-height:12pt;font-size:9pt;padding-bottom:1pt">' + propertyAddress + '</div>'
      + '<span style="font-weight:bold">】</span>'
      + '<span style="margin-left:10pt">年　　月　　日</span>'
      + '</div>'
      + '<div style="font-weight:bold;font-size:9.5pt;background:#000;color:#fff;padding:3pt 6pt;margin-bottom:0">1．取得書類一覧</div>'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:8pt;font-size:8pt">'
      + '<thead><tr style="background:#ddd">'
      + B('width:55%') + '項　　目</td>'
      + B('width:12%') + '取得者</td>'
      + B('width:12%') + '日　付</td>'
      + B('') + '備　考</td>'
      + '</tr></thead><tbody>'
      + items.map(([item, note]) =>
          '<tr>' + B('') + item + '</td>' + B('') + '</td>' + B('') + '</td>' + B('font-size:7.5pt') + note + '</td></tr>'
        ).join('')
      + '</tbody></table>'
      + '<div style="font-weight:bold;font-size:9.5pt;background:#000;color:#fff;padding:3pt 6pt;margin-bottom:0">2．接道の状況</div>'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:4pt;font-size:8pt">'
      + '<thead><tr style="background:#ddd">'
      + B('width:18%') + '接道方向</td>'
      + B('width:18%') + '公・私道の別</td>'
      + B('width:24%') + '接面道路の種類※</td>'
      + B('width:20%') + '幅　員</td>'
      + B('') + '接道長さ</td>'
      + '</tr></thead><tbody>'
      + roadRows
      + '</tbody></table>'
      + '<p style="font-size:7pt;margin:0 0 6pt;line-height:1.6">'
      + '※道路の種類　ア、建築基準法第42条第1項第1号の道路　イ、同条第1項第2号の道路　ウ、同条第1項第3号の道路　エ、同条第1項第4号の道路<br>'
      + 'オ、同条第1項第5号の道路（位置指定道路）（指定番号：　　年　月　日　第　　　号）<br>'
      + 'カ、同条第2項道路（幅員4m以上16m未満のため、道路中心線から（12m－0.3m）後退した線が敷地と道路の境界線とみなされます。）<br>'
      + 'キ、建築基準法第42条の道路に該当しません。（原則として建築不可、ただし例外あり。）'
      + '</p>'
      + '<div style="font-weight:bold;font-size:9.5pt;background:#000;color:#fff;padding:3pt 6pt;margin-bottom:0">3．ライフライン（上下水道等）</div>'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:4pt;font-size:8pt">'
      + '<thead><tr style="background:#ddd">'
      + B('width:4%') + '</td>'
      + B('width:12%') + '項　目</td>'
      + B('width:38%') + '直ちに利用可能な施設※</td>'
      + B('') + '配管等の状況</td>'
      + '</tr></thead><tbody>'
      + '<tr>'
      + B('text-align:center;vertical-align:middle') + '①</td>'
      + B('font-weight:bold;vertical-align:middle') + '飲用水</td>'
      + B('') + '水道（公営）　▼</td>'
      + B('font-size:7.5pt;line-height:1.7') + '前面道路配管　（□有　□無）　口径（　　　mm）<br>敷地内引込管　（□有　□無）　口径（　　　mm）<br>私設管の有無　（□有　□無　▼）</td>'
      + '</tr><tr>'
      + B('text-align:center;vertical-align:middle') + '②</td>'
      + B('font-weight:bold;vertical-align:middle') + '汚水</td>'
      + B('font-size:7.5pt;line-height:1.7') + '□ 公共下水　□ 個別浄化槽（合併）<br>□ 個別浄化槽（単独）　□ 集中浄化槽<br>□ 浸透式　□ 無</td>'
      + B('font-size:7.5pt;line-height:1.7') + '前面道路配管　（□有　□無）<br>私設管の有無　（□有　□無）<br>浄化槽施設の必要（□有　□無）</td>'
      + '</tr><tr>'
      + B('text-align:center;vertical-align:middle') + '③</td>'
      + B('font-weight:bold;vertical-align:middle') + '雑排水</td>'
      + B('font-size:7.5pt;line-height:1.7') + '□ 公共下水　□ 個別浄化槽（合併）<br>□ 個別浄化槽（単独）　□ 集中浄化槽<br>□ 側溝等　□ 浸透式　□ 無</td>'
      + B('font-size:7.5pt;line-height:1.7') + '前面道路配管　（□有　□無）<br>私設管の有無　（□有　□無）</td>'
      + '</tr><tr>'
      + B('text-align:center;vertical-align:middle') + '④</td>'
      + B('font-weight:bold;vertical-align:middle') + '雨水</td>'
      + B('font-size:7.5pt;line-height:1.7') + '□ 公共下水　□ 側溝<br>□ 浸透式　□ 無</td>'
      + B('font-size:7.5pt') + '浄化槽への雨水の流入はできません。</td>'
      + '</tr></tbody></table>'
      + '<p style="font-size:7pt;margin:0;line-height:1.6">'
      + '※大分市東野台の上水道は由布市で管理しており、電話で確認できます。下記に電話後、住所と地図をFAXで送付してください。<br>'
      + '「由布市　伐聞庁舎水道課」　TEL：097-583-1111（代表）　FAX：097-583-1719'
      + '</p>'
      + '</div>';

    return '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">'
      + '<title>添付資料２ - ' + (seller?.sellerNumber || '') + '</title>'
      + '<style>' + CSS + '</style></head><body>'
      + page1 + page2 + page3
      + '<script>window.onload=function(){window.print();}<\/script>'
      + '</body></html>';
  };

  const handlePrint = async () => {
    if (isDirty) { const ok = await handleSave(); if (!ok) return; }
    const html = generatePrintHtml();
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  // ── 画面入力：横2列ヘルパー（名称 + 徒歩分） ──
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
      <TextField size="small" variant="outlined" placeholder="学校名・駅名等"
        value={fields[nameKey] as string} onChange={(e) => set(nameKey, e.target.value)}
        sx={{ flex: 2, '& .MuiOutlinedInput-root': { fontSize: '9.5pt' }, '& input::placeholder': { color: '#bbb', opacity: 1 } }}
        inputProps={{ style: { color: fields[nameKey] ? '#000' : '#bbb' } }} />
      <TextField size="small" variant="outlined" placeholder="徒歩○分"
        value={fields[walkKey] as string} onChange={(e) => set(walkKey, e.target.value)}
        sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '9.5pt' }, '& input::placeholder': { color: '#bbb', opacity: 1 } }}
        inputProps={{ style: { color: fields[walkKey] ? '#000' : '#bbb' } }} />
    </Box>
  );

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <>
      <style>{`@media screen { .print-page { max-width: 800px; margin: 0 auto; } }`}</style>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Box className="no-print" sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBack />} variant="outlined" size="small"
            onClick={() => { if (window.history.length > 1) { navigate(-1); } else { window.close(); } }}>戻る</Button>
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
            <Box sx={{ mb: 1.5, pb: 0.5, borderBottom: '2px solid #000' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '14pt' }}>添付資料２</Typography>
              {seller?.sellerNumber && (
                <Typography sx={{ fontSize: '9pt', color: 'text.secondary' }}>売主番号：{seller.sellerNumber}</Typography>
              )}
            </Box>

            <Grid container spacing={1} sx={{ mb: 1 }} alignItems="stretch">
              <Grid item xs={6} sx={{ display: 'flex' }}>
                <Paper variant="outlined" sx={{ p: 1, width: '100%' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9.5pt', mb: 0.3, borderBottom: '1px solid #ccc', pb: 0.3 }}>物件情報</Typography>
                  <Box sx={{ fontSize: '8.5pt', lineHeight: 1.7 }}>
                    <div><strong>住所：</strong>{propertyAddress}</div>
                    <div><strong>種別：</strong>{propertyType}　<strong>現況：</strong>{currentStatus}</div>
                    <div><strong>土地：</strong>{landArea ? `${landArea}㎡` : '-'}{landVerified ? <span style={{ marginLeft: 4 }}>（当社調べ：{landVerified}㎡）</span> : ''}</div>
                    <div><strong>建物：</strong>{buildArea ? `${buildArea}㎡` : '-'}{buildVerified ? <span style={{ marginLeft: 4 }}>（当社調べ：{buildVerified}㎡）</span> : ''}</div>
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

            <Grid container spacing={1} sx={{ mb: 1 }}>
              <Grid item xs={6}><Paper variant="outlined" sx={{ p: 0.8 }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '8pt', color: '#555' }}>査定額</Typography>
                <Typography sx={{ fontWeight: 'bold', fontSize: '10.5pt' }}>{valuationDisplay}</Typography>
              </Paper></Grid>
              <Grid item xs={6}><Paper variant="outlined" sx={{ p: 0.8 }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '8pt', color: '#555' }}>訪問予定日時</Typography>
                <Typography sx={{ fontWeight: 'bold', fontSize: '10.5pt' }}>{visitSchedule}</Typography>
              </Paper></Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '8pt', color: '#555', mb: 0.3 }}>コメント内容</Typography>
              <Typography sx={{ fontSize: '8pt', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{seller?.comments || '（コメントなし）'}</Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
              <Grid container spacing={1.5}>
                {/* ハザードマップ */}
                <Grid item xs={6}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', mb: 0.4 }}>ハザードマップ</Typography>
                  <TextField fullWidth size="small" value={fields.hazard_map}
                    onChange={(e) => set('hazard_map', e.target.value)}
                    placeholder="水害、土砂災害"
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' }, '& input::placeholder': { color: '#bbb', opacity: 1 } }} />
                </Grid>
                {/* 抵当権 */}
                <Grid item xs={6}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', mb: 0.4 }}>抵当権</Typography>
                  <TextField fullWidth size="small" value={fields.mortgage_info}
                    onChange={(e) => set('mortgage_info', e.target.value)}
                    placeholder="抵当権の種類と抵当権先"
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' }, '& input::placeholder': { color: '#bbb', opacity: 1 } }} />
                </Grid>
              </Grid>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
              <Grid container spacing={1} sx={{ mb: 0.5 }}>
                <Grid item xs={6}><RowPair label="小学校" nameKey="elementary_school_name" walkKey="elementary_school_walk" /></Grid>
                <Grid item xs={6}><RowPair label="中学校" nameKey="junior_high_school_name" walkKey="junior_high_school_walk" /></Grid>
              </Grid>
              <Grid container spacing={1}>
                <Grid item xs={6}><RowPair label="最寄り駅" nameKey="nearest_station_name" walkKey="nearest_station_walk" /></Grid>
                <Grid item xs={6}><RowPair label="最寄りバス停" nameKey="nearest_bus_stop_name" walkKey="nearest_bus_stop_walk" /></Grid>
              </Grid>
            </Paper>

            {isMansion ? (
              <>
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
                        label={<Typography sx={{ fontSize: '9pt' }}>{c.label}</Typography>} />
                    ))}
                  </Box>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
                  <Grid container spacing={2}>
                    {([{ key: 'management_fee' as const, label: '管理費' }, { key: 'repair_reserve_fund' as const, label: '修繕積立金' }]).map((f) => (
                      <Grid item xs={6} key={f.key}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontWeight: 'bold', fontSize: '9.5pt', flexShrink: 0, width: 72 }}>{f.label}</Typography>
                          <TextField fullWidth size="small" value={fields[f.key]} onChange={(e) => set(f.key, e.target.value)} sx={{ '& .MuiOutlinedInput-root': { fontSize: '9.5pt' } }} />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </>
            ) : (
              <>
                <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {([{ key: 'current_nearby_listing_checked' as const, label: '現在の近隣募集中' }, { key: 'past_sold_case_checked' as const, label: '過去成約事例' }]).map((c) => (
                      <FormControlLabel key={c.key}
                        control={<Checkbox size="small" checked={fields[c.key]} onChange={(e) => set(c.key, e.target.checked)} />}
                        label={<Typography sx={{ fontSize: '9pt' }}>{c.label}</Typography>} />
                    ))}
                  </Box>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
                  <Grid container spacing={2}>
                    {([{ key: 'boundary_stake' as const, label: '境界標（杭）' }, { key: 'road_width' as const, label: '道路幅' }, { key: 'road_contact' as const, label: '接道' }]).map((f) => (
                      <Grid item xs={4} key={f.key}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '9.5pt', mb: 0.4 }}>{f.label}</Typography>
                        <TextField fullWidth size="small" value={fields[f.key]} onChange={(e) => set(f.key, e.target.value)} sx={{ '& .MuiOutlinedInput-root': { fontSize: '9.5pt' } }} />
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </>
            )}

            <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flex: 2 }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0 }}>固定資産税</Typography>
                  <TextField fullWidth size="small" value={fields.property_tax} onChange={(e) => set('property_tax', e.target.value)}
                    placeholder={isMansion ? 'マンションは５年以内に軽減税率あり' : '戸建ては３年以内に軽減税率あり'}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' }, '& input::placeholder': { fontSize: '8pt', color: '#bbb' } }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flex: 2 }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0 }}>駐車場</Typography>
                  <TextField fullWidth size="small" value={fields.parking} onChange={(e) => set('parking', e.target.value)}
                    placeholder={isMansion ? '機械式の場合　高さ、奥行き、幅を確認' : '堀車庫の場合は高さ、幅、奥行き M'}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' }, '& input::placeholder': { fontSize: '8pt', color: '#bbb' } }} />
                </Box>
                {isMansion && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flex: 1 }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0 }}>ペット</Typography>
                    <TextField fullWidth size="small" value={fields.pet} onChange={(e) => set('pet', e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' } }} />
                  </Box>
                )}
              </Box>
            </Paper>

            <Box sx={{ mt: 3, pt: 2, borderTop: '3px dashed #aaa' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '10pt', mb: 1, color: '#555' }}>▼ 2枚目：現地調査チェックリスト</Typography>
              <Paper variant="outlined" sx={{ mb: 1 }}>
                <Box sx={{ p: 0.8, bgcolor: '#222', borderRadius: '3px 3px 0 0' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '10pt', color: '#fff' }}>現地調査</Typography>
                </Box>
                {([
                  { key: 'site_check_memo1' as const, label: '境界、越境' },
                  { key: 'site_check_memo2' as const, label: '配水管（上水）浄化槽' },
                  { key: 'site_check_memo3' as const, label: '擁壁、崖の確認' },
                  { key: 'site_check_memo4' as const, label: '都市ガス or プロパンガス' },
                ]).map((row, idx, arr) => (
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
