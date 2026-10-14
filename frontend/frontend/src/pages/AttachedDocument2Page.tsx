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
  Tooltip,
} from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';
import { ArrowBack, Print as PrintIcon, Save as SaveIcon, AutoFixHigh as AutoFixHighIcon } from '@mui/icons-material';
import api from '../services/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';
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
  hazard_map_confirmed: boolean;  // 自治体の最新ハザードマップ確認済み
  mortgage_info: string;
  // 新規フィールド（道路の種類・売却理由・境界・ガス・排水・建築会社・管理会社）
  road_type: string;
  sale_reason: string;
  boundary_info: string;
  gas_propane: boolean;
  gas_city_gas: boolean;
  drainage_public: boolean;
  drainage_septic: boolean;
  drainage_cesspool: boolean;
  construction_company: string;
  management_company: string;
  // 訪問時記入フィールド
  exterior_reform: string;
  interior_reform: string;
  defects: string;
  solar_panel: string;
  incident_info: string;
  minpaku: string;
  // 【特典】チェックボックス
  tokuten_cleaning: boolean;
  tokuten_garden: boolean;
  tokuten_wallpaper: boolean;
  tokuten_removal: boolean;
  tokuten_warranty: boolean;
  tokuten_fee_discount: boolean;
  tokuten_bridge_loan: boolean;
  tokuten_key_exchange: boolean;
  // 学校確認チェックボックス
  elementary_school_confirmed: boolean;
  junior_high_school_confirmed: boolean;
  // 交通アクセス確認チェックボックス
  nearest_station_confirmed: boolean;
  nearest_bus_stop_confirmed: boolean;
  // マンション建物情報（外部建物情報から自動補完）
  mansion_building_name: string;
  mansion_built_year_month: string;
  mansion_floors_above: string;
  mansion_floors_below: string;
  mansion_total_units: string;
  mansion_structure: string;
  mansion_developer: string;
  mansion_management_type: string;
  mansion_has_elevator: string;
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
  hazard_map_confirmed: false,
  mortgage_info: '',
  road_type: '',
  sale_reason: '',
  boundary_info: '',
  gas_propane: false,
  gas_city_gas: false,
  drainage_public: false,
  drainage_septic: false,
  drainage_cesspool: false,
  construction_company: '',
  management_company: '',
  exterior_reform: '',
  interior_reform: '',
  defects: '',
  solar_panel: '',
  incident_info: '',
  minpaku: '',
  tokuten_cleaning: false,
  tokuten_garden: false,
  tokuten_wallpaper: false,
  tokuten_removal: false,
  tokuten_warranty: false,
  tokuten_fee_discount: false,
  tokuten_bridge_loan: false,
  tokuten_key_exchange: false,
  elementary_school_confirmed: false,
  junior_high_school_confirmed: false,
  nearest_station_confirmed: false,
  nearest_bus_stop_confirmed: false,
  // マンション建物情報
  mansion_building_name: '',
  mansion_built_year_month: '',
  mansion_floors_above: '',
  mansion_floors_below: '',
  mansion_total_units: '',
  mansion_structure: '',
  mansion_developer: '',
  mansion_management_type: '',
  mansion_has_elevator: '',
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

// ── 学校行：「徒歩X分」形式 + 確認チェックボックス ──
const SchoolRowWithConfirm = ({
  label,
  nameKey,
  walkKey,
  confirmedKey,
  fields,
  onSet,
  onConfirmChange,
}: {
  label: string;
  nameKey: keyof DocumentFields;
  walkKey: keyof DocumentFields;
  confirmedKey: keyof DocumentFields;
  fields: DocumentFields;
  onSet: (key: keyof DocumentFields, value: string | boolean) => void;
  onConfirmChange: (key: keyof DocumentFields, value: boolean) => void;
}) => {
  const walkValue = (fields[walkKey] as string) || '';
  const isConfirmed = fields[confirmedKey] as boolean;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.8, borderBottom: '1px solid #ccc' }}>
      <Typography sx={{ width: 70, flexShrink: 0, fontWeight: 'bold', fontSize: '9.5pt' }}>{label}</Typography>
      <TextField size="small" variant="outlined" placeholder="学校名"
        value={fields[nameKey] as string}
        onChange={(e) => onSet(nameKey, e.target.value)}
        sx={{ flex: 2, '& .MuiOutlinedInput-root': { fontSize: '9pt' } }} />
      <TextField size="small" variant="outlined"
        value={walkValue}
        placeholder="17〜22"
        onChange={(e) => onSet(walkKey, e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start" sx={{ mr: 0 }}>
            <Typography sx={{ fontSize: '8.5pt', color: '#555', whiteSpace: 'nowrap' }}>徒歩</Typography>
          </InputAdornment>,
          endAdornment: <InputAdornment position="end">
            <Typography sx={{ fontSize: '8.5pt', color: '#555' }}>分</Typography>
          </InputAdornment>,
        }}
        sx={{ width: 100, '& .MuiOutlinedInput-root': { fontSize: '9pt', pl: 0.3 } }} />
      <FormControlLabel
        control={
          <Checkbox size="small" checked={isConfirmed}
            onChange={(e) => onConfirmChange(confirmedKey, e.target.checked)}
            sx={{ p: 0.3 }} color="success" />
        }
        label={
          <Typography sx={{ fontSize: '8pt', color: isConfirmed ? '#2e7d32' : '#999', whiteSpace: 'nowrap' }}>
            {isConfirmed ? '✓確認済' : '確認'}
          </Typography>
        }
        sx={{ ml: 0, mr: 0 }}
      />
    </Box>
  );
};

// ── 交通アクセス行：「名称 + 徒歩○分」形式 + 確認チェックボックス ──
// （SchoolRowWithConfirm と同じ構造。トップレベル定義でフォーカス外れを防ぐ）
const TransitRowWithConfirm = ({
  label,
  nameKey,
  walkKey,
  confirmedKey,
  fields,
  onSet,
  onConfirmChange,
}: {
  label: string;
  nameKey: keyof DocumentFields;
  walkKey: keyof DocumentFields;
  confirmedKey: keyof DocumentFields;
  fields: DocumentFields;
  onSet: (key: keyof DocumentFields, value: string | boolean) => void;
  onConfirmChange: (key: keyof DocumentFields, value: boolean) => void;
}) => {
  const walkValue = (fields[walkKey] as string) || '';
  const isConfirmed = fields[confirmedKey] as boolean;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.8, borderBottom: '1px solid #ccc' }}>
      <Typography sx={{ width: 70, flexShrink: 0, fontWeight: 'bold', fontSize: '9.5pt' }}>{label}</Typography>
      <TextField size="small" variant="outlined" placeholder="駅名・バス停名"
        value={fields[nameKey] as string}
        onChange={(e) => onSet(nameKey, e.target.value)}
        sx={{ flex: 2, '& .MuiOutlinedInput-root': { fontSize: '9pt' } }} />
      <TextField size="small" variant="outlined"
        value={walkValue}
        placeholder="8"
        onChange={(e) => onSet(walkKey, e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start" sx={{ mr: 0 }}>
            <Typography sx={{ fontSize: '8.5pt', color: '#555', whiteSpace: 'nowrap' }}>徒歩</Typography>
          </InputAdornment>,
          endAdornment: <InputAdornment position="end">
            <Typography sx={{ fontSize: '8.5pt', color: '#555' }}>分</Typography>
          </InputAdornment>,
        }}
        sx={{ width: 100, '& .MuiOutlinedInput-root': { fontSize: '9pt', pl: 0.3 } }} />
      <FormControlLabel
        control={
          <Checkbox size="small" checked={isConfirmed}
            onChange={(e) => onConfirmChange(confirmedKey, e.target.checked)}
            sx={{ p: 0.3 }} color="success" />
        }
        label={
          <Typography sx={{ fontSize: '8pt', color: isConfirmed ? '#2e7d32' : '#999', whiteSpace: 'nowrap' }}>
            {isConfirmed ? '✓確認済' : '確認'}
          </Typography>
        }
        sx={{ ml: 0, mr: 0 }}
      />
    </Box>
  );
};

// ── 画面入力：横2列ヘルパー（名称 + 徒歩分） ──
// ※ コンポーネントをトップレベルに定義することで、
//    再レンダー時に新しい型として扱われてフォーカスが外れるバグを防ぐ
const RowPair = ({  label,
  nameKey,
  walkKey,
  fields,
  onSet,
}: {
  label: string;
  nameKey: keyof DocumentFields;
  walkKey: keyof DocumentFields;
  fields: DocumentFields;
  onSet: (key: keyof DocumentFields, value: string | boolean) => void;
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.8, borderBottom: '1px solid #ccc' }}>
    <Typography sx={{ width: 90, flexShrink: 0, fontWeight: 'bold', fontSize: '9.5pt' }}>{label}</Typography>
    <TextField size="small" variant="outlined" placeholder="学校名・駅名等"
      value={fields[nameKey] as string} onChange={(e) => onSet(nameKey, e.target.value)}
      sx={{ flex: 2, '& .MuiOutlinedInput-root': { fontSize: '9.5pt' }, '& input::placeholder': { color: '#bbb', opacity: 1 } }}
      inputProps={{ style: { color: fields[nameKey] ? '#000' : '#bbb' } }} />
    <TextField size="small" variant="outlined" placeholder="徒歩○分"
      value={fields[walkKey] as string} onChange={(e) => onSet(walkKey, e.target.value)}
      sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '9.5pt' }, '& input::placeholder': { color: '#bbb', opacity: 1 } }}
      inputProps={{ style: { color: fields[walkKey] ? '#000' : '#bbb' } }} />
  </Box>
);

// ────────────────────────────────────────────
// ハザード情報からテキストを生成するヘルパー
// ────────────────────────────────────────────
function buildHazardText(h: any): string {
  const parts: string[] = [];
  if (h.flood === 'inside') {
    parts.push(h.flood_depth_label ? `洪水（${h.flood_depth_label}）` : '洪水区域内');
  }
  if (h.storm_surge === 'inside') {
    parts.push(h.storm_surge_depth ? `高潮（${h.storm_surge_depth}）` : '高潮区域内');
  }
  if (h.tsunami === 'inside') {
    parts.push(h.tsunami_depth ? `津波（${h.tsunami_depth}）` : '津波区域内');
  }
  if (h.landslide_yellow === 'inside') {
    parts.push(h.landslide_yellow_type ? `土砂警戒区域（黄）（${h.landslide_yellow_type}）` : '土砂災害警戒区域（黄）');
  }
  if (h.landslide_red === 'inside') {
    parts.push(h.landslide_red_type ? `土砂特別警戒区域（赤）（${h.landslide_red_type}）` : '土砂災害特別警戒区域（赤）');
  }
  return parts.join('、');
}

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
  const [hazardSuggestion, setHazardSuggestion] = useState<string | null>(null);
  const [schoolFetching, setSchoolFetching] = useState(false);
  const [schoolFetchError, setSchoolFetchError] = useState<string | null>(null);
  const [transitFetching, setTransitFetching] = useState(false);
  const [transitFetchError, setTransitFetchError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [sellerRes, docRes] = await Promise.all([
        api.get<SellerData>(`/api/sellers/${id}`),
        api.get(`/api/sellers/${id}/attached-document2`),
      ]);
      const sellerData = sellerRes.data;
      setSeller(sellerData);
      const d = docRes.data || {};

      // ハザード情報を取得して自動入力テキストを生成（売主番号が必要）
      let autoHazardText = '';
      if (sellerData.sellerNumber) {
        try {
          const hazardRes = await api.get(`/api/hazard-info/seller/${sellerData.sellerNumber}`);
          const h = hazardRes.data?.data;
          if (h && h.fetched_at) {
            const suggestion = buildHazardText(h);
            setHazardSuggestion(suggestion || null);
            autoHazardText = suggestion;
          }
        } catch { /* ハザード取得失敗はサイレント（添付資料2の読み込みには影響しない）*/ }
      }
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
        hazard_map: d.hazard_map || autoHazardText,
        hazard_map_confirmed: !!d.hazard_map_confirmed,
        mortgage_info: d.mortgage_info || '',
        road_type: d.road_type || '',
        sale_reason: d.sale_reason || '',
        boundary_info: d.boundary_info || '',
        gas_propane: !!d.gas_propane,
        gas_city_gas: !!d.gas_city_gas,
        drainage_public: !!d.drainage_public,
        drainage_septic: !!d.drainage_septic,
        drainage_cesspool: !!d.drainage_cesspool,
        construction_company: d.construction_company || '',
        management_company: d.management_company || '',
        exterior_reform: d.exterior_reform || '',
        interior_reform: d.interior_reform || '',
        defects: d.defects || '',
        solar_panel: d.solar_panel || '',
        incident_info: d.incident_info || '',
        minpaku: d.minpaku || '',
        tokuten_cleaning: !!d.tokuten_cleaning,
        tokuten_garden: !!d.tokuten_garden,
        tokuten_wallpaper: !!d.tokuten_wallpaper,
        tokuten_removal: !!d.tokuten_removal,
        tokuten_warranty: !!d.tokuten_warranty,
        tokuten_fee_discount: !!d.tokuten_fee_discount,
        tokuten_bridge_loan: !!d.tokuten_bridge_loan,
        tokuten_key_exchange: !!d.tokuten_key_exchange,
        elementary_school_confirmed: !!d.elementary_school_confirmed,
        junior_high_school_confirmed: !!d.junior_high_school_confirmed,
        nearest_station_confirmed: !!d.nearest_station_confirmed,
        nearest_bus_stop_confirmed: !!d.nearest_bus_stop_confirmed,
        // マンション建物情報（DBに保存済みがあればそちらを使い、なければ外部建物情報から補完）
        mansion_building_name:    d.mansion_building_name    || '',
        mansion_built_year_month: d.mansion_built_year_month || '',
        mansion_floors_above:     d.mansion_floors_above     != null ? String(d.mansion_floors_above)  : '',
        mansion_floors_below:     d.mansion_floors_below     != null ? String(d.mansion_floors_below)  : '',
        mansion_total_units:      d.mansion_total_units      != null ? String(d.mansion_total_units)   : '',
        mansion_structure:        d.mansion_structure        || '',
        mansion_developer:        d.mansion_developer        || '',
        mansion_management_type:  d.mansion_management_type  || '',
        mansion_has_elevator:     d.mansion_has_elevator     || '',
      });

      // 交通アクセスを自動補完（seller_attached_document2 に未保存の場合のみ transit_access から読み込む）
      if (!d.nearest_station_name && !d.nearest_bus_stop_name && sellerData.sellerNumber) {
        try {
          const transitRes = await api.get(`/api/transit-access/seller/${sellerData.sellerNumber}`);
          const transitRecords: Array<{
            transport_type: string; rank: number;
            name: string | null; walk_minutes: number | null;
            is_manually_corrected: boolean; manual_name: string | null; manual_walk_minutes: number | null;
          }> = transitRes.data.data ?? [];
          const station = transitRecords.find(r => r.transport_type === 'station' && r.rank === 1);
          const busStop = transitRecords.find(r => r.transport_type === 'bus_stop' && r.rank === 1);
          const getName = (r: typeof station) =>
            (r?.is_manually_corrected && r?.manual_name) ? r.manual_name! : (r?.name ?? '');
          const getWalk = (r: typeof station) =>
            (r?.is_manually_corrected && r?.manual_walk_minutes != null)
              ? String(r.manual_walk_minutes)
              : (r?.walk_minutes != null ? String(r.walk_minutes) : '');
          if (station || busStop) {
            setFields(prev => ({
              ...prev,
              ...(station ? { nearest_station_name: getName(station), nearest_station_walk: getWalk(station) } : {}),
              ...(busStop  ? { nearest_bus_stop_name: getName(busStop), nearest_bus_stop_walk: getWalk(busStop) } : {}),
            }));
          }
        } catch { /* 自動補完失敗はサイレント（必須ではないため） */ }
      }

      // マンション建物情報が未入力の場合、seller_apartment_building_info から自動補完
      // （保存済みの値がある場合は上書きしない）
      const fetchedPropertyType = sellerData.property?.propertyType || (sellerData as any).propertyType || '';
      const isMansionType = fetchedPropertyType === 'apartment' || fetchedPropertyType === 'マ' || fetchedPropertyType === 'マンション';
      if (isMansionType) {
        try {
          const sellerNum = sellerData.sellerNumber;
          if (sellerNum) {
            const apartRes = await api.get(`/api/apartment-info/seller/${sellerNum}`);
            const ai = apartRes.data.data;
            if (ai) {
              setFields((prev) => {
                // 取得済み情報を「・」区切りでまとめたテキストを生成
                const buildMansionInfoText = (): string => {
                  const parts: string[] = [];
                  if (ai.built_year_month) {
                    // YYYY-MM → YYYY年M月
                    const m = ai.built_year_month.match(/^(\d{4})-(\d{2})$/);
                    parts.push(m ? `${m[1]}年${parseInt(m[2], 10)}月` : ai.built_year_month);
                  }
                  if (ai.total_floors_above != null) parts.push(`地上${ai.total_floors_above}階`);
                  if (ai.total_units        != null) parts.push(`${ai.total_units}戸`);
                  if (ai.structure)                  parts.push(ai.structure);
                  if (ai.management_type)            parts.push(ai.management_type);
                  if (ai.has_elevator)               parts.push(`EV:${ai.has_elevator}`);
                  if (ai.construction_company)       parts.push(`施工:${ai.construction_company}`);
                  return parts.join('・');
                };

                return {
                  ...prev,
                  // 保存済みが空の場合のみ自動補完（手動入力を上書きしない）
                  mansion_building_name:    prev.mansion_building_name    || buildMansionInfoText(),
                  // 管理会社・施工会社は既存フィールドへも補完
                  management_company:       prev.management_company       || ai.management_company   || '',
                  construction_company:     prev.construction_company     || ai.construction_company || '',
                };
              });
            }
          }
        } catch { /* 自動補完失敗はサイレント */ }
      }

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

  // ---- 学校情報の自動入力 ----
  const handleSchoolAutoFetch = async () => {
    if (!seller?.sellerNumber) return;
    setSchoolFetching(true);
    setSchoolFetchError(null);
    try {
      // 1. 物件座標を取得
      const coordRes = await api.get(`/api/sellers/by-number/${seller.sellerNumber}`);
      const lat: number = coordRes.data.latitude;
      const lng: number = coordRes.data.longitude;
      if (!lat || !lng) {
        setSchoolFetchError('物件の座標が未設定です。通話モードの地図で位置を設定してください。');
        return;
      }

      // 2. バックエンドで学校名・座標・道路距離を一括取得（Routes API / Directions API はバックエンドで処理）
      const res = await api.get('/api/nearby-map/school-walk', { params: { lat, lng } });
      const data = res.data;

      // 徒歩時間文字列生成
      const computeWalk = (meters: number): string => String(Math.ceil(meters / 80));

      // 3. フォームに反映（編集可能な状態で）
      if (data.elementarySchool?.name) {
        set('elementary_school_name', data.elementarySchool.name);
        const meters = data.elementarySchool.distanceMeters;
        if (meters) set('elementary_school_walk', computeWalk(meters));
      }
      if (data.juniorHighSchool?.name) {
        set('junior_high_school_name', data.juniorHighSchool.name);
        const meters = data.juniorHighSchool.distanceMeters;
        if (meters) set('junior_high_school_walk', computeWalk(meters));
      } else if (data.juniorHighSchool?.notAvailableReason === 'REINFOLIB_API_KEY_NOT_SET') {
        setSchoolFetchError(
          '⚠️ 中学校区はREINFOLIB_API_KEY未設定のため取得できませんでした（小学校は取得済み）。'
        );
      }
    } catch (err: any) {
      setSchoolFetchError(err.response?.data?.error || '学校情報の取得に失敗しました');
    } finally {
      setSchoolFetching(false);
    }
  };

  // ---- 学校確認チェックボックスの即時保存 ----
  const handleConfirmChange = async (key: keyof DocumentFields, value: boolean) => {
    set(key, value); // フォーム状態を更新
    if (!id) return;
    try {
      await api.patch(`/api/sellers/${id}/attached-document2/school`, { [key]: value });
    } catch (err) {
      console.error('[AttachedDocument2] 確認状態の保存失敗:', err);
    }
  };

  // ---- 交通アクセス自動入力（seller_transit_access の rank=1 を取得）----

  const handleTransitAutoFetch = async () => {
    console.log('[TransitAutoFetch] START seller:', seller?.sellerNumber ?? 'undefined');
    if (!seller?.sellerNumber) {
      setTransitFetchError('売主番号が取得できませんでした。ページを再読み込みしてください。');
      return;
    }
    setTransitFetching(true);
    setTransitFetchError(null);
    try {
      console.log('[TransitAutoFetch] calling API for:', seller.sellerNumber);
      const res = await api.get(`/api/transit-access/seller/${seller.sellerNumber}`);
      const records: Array<{
        transport_type: 'station' | 'bus_stop';
        rank: number;
        name: string | null;
        line_name: string | null;
        walk_minutes: number | null;
        is_manually_corrected: boolean;
        manual_name: string | null;
        manual_line_name: string | null;
        manual_walk_minutes: number | null;
      }> = res.data.data ?? [];

      console.log('[TransitAutoFetch] records:', records.length, records);

      const station  = records.find(r => r.transport_type === 'station'  && r.rank === 1);
      const busStop  = records.find(r => r.transport_type === 'bus_stop' && r.rank === 1);

      const getDisplayName = (r: typeof station) =>
        (r?.is_manually_corrected && r.manual_name) ? r.manual_name! : (r?.name ?? '');
      const getDisplayWalk = (r: typeof station) =>
        (r?.is_manually_corrected && r.manual_walk_minutes != null)
          ? String(r.manual_walk_minutes)
          : (r?.walk_minutes != null ? String(r.walk_minutes) : '');

      if (station) {
        set('nearest_station_name', getDisplayName(station));
        set('nearest_station_walk', getDisplayWalk(station));
      }
      if (busStop) {
        set('nearest_bus_stop_name', getDisplayName(busStop));
        set('nearest_bus_stop_walk', getDisplayWalk(busStop));
      }

      if (!station && !busStop) {
        setTransitFetchError(`交通アクセス情報が見つかりませんでした（売主番号: ${seller.sellerNumber}）。通話モードページで取得してください。`);
      }
    } catch (err: any) {
      setTransitFetchError(err.response?.data?.error || '交通アクセス情報の取得に失敗しました');
    } finally {
      setTransitFetching(false);
    }
  };

  // ---- 交通アクセス確認チェックボックスの即時保存 ----
  const handleTransitConfirmChange = async (key: keyof DocumentFields, value: boolean) => {
    set(key, value);
    if (!id) return;
    try {
      await api.patch(`/api/sellers/${id}/attached-document2/transit`, { [key]: value });
    } catch (err) {
      console.error('[AttachedDocument2] 交通確認状態の保存失敗:', err);
    }
  };

  const handleSave = async (): Promise<boolean> => {    if (!id) return false;
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
      // エラー詳細をコンソールに出力してデバッグ用情報を残す
      console.error('[AttachedDocument2] 保存エラー:', err?.response?.status, err?.response?.data || err?.message);
      const detail = err?.response?.data?.error || err?.message || '';
      setError(`保存に失敗しました${detail ? `（${detail}）` : ''}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // コメントのHTMLタグを完全除去するヘルパー
  const stripHtml = (html: string): string => {
    if (!html) return '';
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };
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
  const isFukuoka = !!(seller?.sellerNumber?.startsWith('FI'));
  const hazardLabel = isFukuoka
    ? 'ハザードマップ（埋蔵文化、航空法等　福岡MAPより全確認）'
    : 'ハザードマップ（埋蔵文化等　大分MAPより全確認）';

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
      ? '<table class="it" style="margin-bottom:3pt"><tr><td class="lbl" colspan="2">近隣募集・成約事例</td></tr>'
        + '<tr><td colspan="2" style="padding:3pt;font-size:7.5pt;">'
        + cb(fields.currently_listed_same_building_checked) + ' 現在募集中（同マンション）　'
        + cb(fields.same_building_sold_case_checked) + ' 同マンションの成約事例　'
        + cb(fields.nearby_mansion_sold_case_checked) + ' 周辺のマンションの成約事例'
        + '</td></tr></table>'
        + '<div style="text-align:center;padding:3pt;margin-bottom:3pt;font-size:7.5pt;font-weight:bold;letter-spacing:1pt">＝＝＝＝＝ここから訪問時記入＝＝＝＝＝</div>'
        + '<table class="it" style="margin-bottom:3pt"><tr>'
        + '<td class="lbl" style="width:54pt">管理費</td><td class="val">' + (fields.management_fee || '') + '</td>'
        + '<td class="lbl" style="width:54pt">修繕積立金</td><td class="val">' + (fields.repair_reserve_fund || '') + '</td>'
        + '</tr></table>'
      : '<table class="it" style="margin-bottom:3pt"><tr><td colspan="4" style="padding:3pt;font-size:7.5pt;">'
        + cb(fields.current_nearby_listing_checked) + ' 現在の近隣募集中　'
        + cb(fields.past_sold_case_checked) + ' 過去成約事例'
        + '</td></tr></table>'
        + '<div style="text-align:center;padding:3pt;margin-bottom:3pt;font-size:7.5pt;font-weight:bold;letter-spacing:1pt">＝＝＝＝＝ここから訪問時記入＝＝＝＝＝</div>'
        + '<table class="it" style="margin-bottom:3pt"><tr>'
        + '<td class="lbl" style="width:60pt">境界標（杭）</td><td class="val">' + (fields.boundary_stake || '') + '</td>'
        + '<td class="lbl" style="width:44pt">道路幅</td><td class="val">' + (fields.road_width || '') + '</td>'
        + '<td class="lbl" style="width:36pt">接道</td><td class="val">' + (fields.road_contact || '') + '</td>'
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
      + '.page{display:block}'
      + 'h1{font-size:13pt;font-weight:bold;margin:0 0 1pt;border-bottom:2pt solid #000;padding-bottom:2pt}'
      + '.sub{font-size:8pt;color:#555;margin-bottom:4pt}'
      + '.row2{display:flex;gap:4pt;margin-bottom:3pt}'
      + '.row2>div{flex:1;border:1pt solid #888;padding:3pt}'
      + '.stitle{font-weight:bold;font-size:8.5pt;border-bottom:1pt solid #ccc;padding-bottom:2pt;margin-bottom:3pt}'
      + '.iline{font-size:8pt;line-height:1.6}'
      + '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:3pt;margin-bottom:3pt}'
      + '.box{border:1pt solid #888;padding:4pt}'
      + '.blbl{font-size:7pt;color:#555}'
      + '.bval{font-size:10pt;font-weight:bold}'
      + '.cbox{border:1pt solid #888;padding:4pt;margin-bottom:4pt;overflow:hidden;height:60mm;display:flex;flex-direction:column}'
      + '.clbl{font-size:7pt;color:#555;font-weight:bold;margin-bottom:2pt}'
      + '.tblock{}'
      + '.it{width:100%;border-collapse:collapse;margin-bottom:3pt;border:1pt solid #888}'
      + '.it td{border:1pt solid #888;padding:2pt 3pt;font-size:7.5pt;vertical-align:middle}'
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
      + '<div class="cbox">'
      + '<div class="clbl">コメント内容</div>'
      + '<div style="flex:1;overflow:hidden;white-space:pre-wrap;font-size:7.5pt;line-height:1.45;min-height:0">'
      + (seller?.comments ? stripHtml(seller.comments) : '（コメントなし）')
      + '</div>'
      + '<div style="flex-shrink:0;border-top:1pt dashed #aaa;padding-top:3pt;font-size:8pt;white-space:normal;line-height:1.7">'
      + '<strong>【特典】</strong>　'
      + cb(fields.tokuten_cleaning) + ' 室内クリーニング　'
      + cb(fields.tokuten_garden) + ' 庭の除草、草刈り　'
      + cb(fields.tokuten_wallpaper) + ' クロスの張替え　'
      + cb(fields.tokuten_removal) + ' 残置物撤去　'
      + cb(fields.tokuten_warranty) + ' 設備の1年間無償保証　'
      + cb(fields.tokuten_fee_discount) + ' 最低価格を下回った場合 仲介手数料２％　'
      + cb(fields.tokuten_bridge_loan) + ' つなぎ融資'
      + cb(fields.tokuten_key_exchange) + ' 鍵交換'
      + '</div>'
      + '</div>'
      + '<div class="tblock">'
      + '<table class="it"><tr>'
      + '<td class="lbl" style="font-size:6.5pt;white-space:normal;line-height:1.3">' + (isFukuoka ? 'ハザードマップ（埋蔵文化、航空法等　福岡MAPより全確認）' : 'ハザードマップ（埋蔵文化等　大分MAPより全確認）') + '</td><td class="val">' + (fields.hazard_map || '') + '</td>'
      + '<td class="lbl">道路の種類</td><td class="val">' + (fields.road_type || '') + '</td>'
      + '</tr></table>'
      + '<table class="it"><tr>'
      + '<td class="lbl">小学校</td><td class="val">' + (fields.elementary_school_name || '') + '</td><td class="val narrow">' + (fields.elementary_school_walk || '') + '</td>'
      + '<td class="lbl">中学校</td><td class="val">' + (fields.junior_high_school_name || '') + '</td><td class="val narrow">' + (fields.junior_high_school_walk || '') + '</td>'
      + '</tr><tr>'
      + '<td class="lbl">最寄り駅</td><td class="val">' + (fields.nearest_station_name || '') + '</td><td class="val narrow">' + (fields.nearest_station_walk || '') + '</td>'
      + '<td class="lbl">最寄りバス停</td><td class="val">' + (fields.nearest_bus_stop_name || '') + '</td><td class="val narrow">' + (fields.nearest_bus_stop_walk || '') + '</td>'
      + '</tr></table>'
      + mansionSection
      + '<table class="it" style="margin-bottom:3pt"><tr>'
      + '<td class="lbl" style="width:48pt">売却理由</td><td class="val">' + (fields.sale_reason || '') + '</td>'
      + '<td class="lbl" style="width:36pt">境界</td><td class="val" style="font-size:7pt;color:' + (fields.boundary_info ? '#000' : '#aaa') + '">' + (fields.boundary_info || '□杭　印あり　□杭　印なし　□越境物（　　）') + '</td>'
      + '</tr></table>'
      + '<table class="it" style="margin-bottom:3pt"><tr>'
      + '<td class="lbl" style="width:30pt">ガス</td>'
      + '<td style="border:1pt solid #888;padding:2pt 3pt;font-size:7.5pt">' + cb(fields.gas_propane) + ' プロパン　' + cb(fields.gas_city_gas) + ' 都市ガス</td>'
      + '<td class="lbl" style="width:30pt">排水</td>'
      + '<td style="border:1pt solid #888;padding:2pt 3pt;font-size:7.5pt">' + cb(fields.drainage_public) + ' 公共下水　' + cb(fields.drainage_septic) + ' 浄化槽　' + cb(fields.drainage_cesspool) + ' 汲み取り</td>'
      + '</tr></table>'
      + (isMansion ? '<table class="it" style="margin-bottom:3pt"><tr><td class="lbl" style="width:48pt">管理会社</td><td class="val" colspan="3">' + (fields.management_company || '') + '</td></tr></table>' : '')
      + '<table class="it"><tr>'
      + '<td class="lbl" style="width:52pt">固定資産税</td>'
      + '<td class="val">' + (fields.property_tax || '<span style="color:#bbb;font-size:7.5pt">' + (isMansion ? 'マンションは５年以内に軽減税率あり' : '戸建ては３年以内に軽減税率あり') + '</span>') + '</td>'
      + '<td class="lbl" style="width:44pt">駐車場</td>'
      + '<td class="val">' + (fields.parking || '<span style="color:#bbb;font-size:7.5pt">' + (isMansion ? '機械式の場合　高さ、奥行き、幅を確認' : '堀車庫の場合は高さ、幅、奥行き M') + '</span>') + '</td>'
      + (isMansion ? '<td class="lbl" style="width:36pt">ペット</td><td class="val">' + (fields.pet || '') + '</td>' : '')
      + '</tr></table>'
      + '<table class="it" style="margin-bottom:3pt"><tr>'
      + '<td class="lbl" style="width:70pt">建築会社</td><td class="val">' + (fields.construction_company || '') + '</td>'
      + '<td class="lbl" style="width:70pt">外観リフォーム</td><td class="val">' + (fields.exterior_reform || '') + '</td>'
      + '</tr></table>'
      + '<table class="it" style="margin-bottom:3pt"><tr>'
      + '<td class="lbl" style="width:70pt">内装リフォーム</td><td class="val">' + (fields.interior_reform || '') + '</td>'
      + '<td class="lbl" style="width:70pt;white-space:normal;line-height:1.3">雨漏れ、シロアリ等の不具合</td><td class="val">' + (fields.defects || '') + '</td>'
      + '</tr></table>'
      + '<table class="it" style="margin-bottom:3pt"><tr>'
      + '<td class="lbl" style="width:40pt">太陽光</td><td class="val" style="color:' + (fields.solar_panel ? '#000' : '#aaa') + '">' + (fields.solar_panel || '　Kw　買取保証期間　年　月') + '</td>'
      + '</tr></table>'
      + '<table class="it" style="margin-bottom:0"><tr>'
      + '<td class="lbl" style="width:70pt">事件、事故</td><td class="val">' + (fields.incident_info || '') + '</td>'
      + '<td class="lbl" style="width:40pt">民泊</td><td class="val">' + (fields.minpaku || '') + '</td>'
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
    // isFukuoka はコンポーネントスコープで定義済み（generatePrintHtml はクロージャとしてアクセス）

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
              <Typography sx={{ fontSize: '8pt', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {seller?.comments ? stripHtml(seller.comments) : '（コメントなし）'}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '8.5pt', mb: 0.8 }}>【特典】</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                {([
                  { key: 'tokuten_cleaning'     as const, label: '室内クリーニング' },
                  { key: 'tokuten_garden'        as const, label: '庭の除草、草刈り' },
                  { key: 'tokuten_wallpaper'     as const, label: 'クロスの張替え' },
                  { key: 'tokuten_removal'       as const, label: '残置物撤去' },
                  { key: 'tokuten_warranty'      as const, label: '設備の1年間無償保証' },
                  { key: 'tokuten_fee_discount'  as const, label: '最低価格を下回った場合 仲介手数料２％' },
                  { key: 'tokuten_bridge_loan'   as const, label: 'つなぎ融資' },
                  { key: 'tokuten_key_exchange'  as const, label: '鍵交換' },
                ]).map((c) => (
                  <FormControlLabel key={c.key} sx={{ width: '50%', m: 0 }}
                    control={<Checkbox size="small" checked={fields[c.key]} onChange={(e) => set(c.key, e.target.checked)} />}
                    label={<Typography sx={{ fontSize: '9pt' }}>{c.label}</Typography>} />
                ))}
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
              <Grid container spacing={1.5}>
                {/* ハザードマップ */}
                <Grid item xs={7}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '8pt' }}>{hazardLabel}</Typography>
                    {hazardSuggestion && (
                      <Tooltip title={`ハザード情報から入力: ${hazardSuggestion}`} placement="top">
                        <Button
                          size="small"
                          variant="outlined"
                          color="info"
                          startIcon={<AutoFixHighIcon sx={{ fontSize: '0.75rem !important' }} />}
                          onClick={() => set('hazard_map', hazardSuggestion)}
                          sx={{ fontSize: '0.6rem', py: 0.1, px: 0.8, minWidth: 0, height: 20, lineHeight: 1 }}
                        >
                          自動入力
                        </Button>
                      </Tooltip>
                    )}
                  </Box>
                  <TextField fullWidth size="small" value={fields.hazard_map}
                    onChange={(e) => set('hazard_map', e.target.value)}
                    placeholder="水害、土砂災害"
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' }, '& input::placeholder': { color: '#bbb', opacity: 1 } }} />
                </Grid>
                {/* ハザード確認チェックボックス */}
                <Grid item xs={2} sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '8pt', mb: 0.4 }}>ハザード確認</Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={fields.hazard_map_confirmed}
                        onChange={(e) => set('hazard_map_confirmed', e.target.checked)}
                        sx={{ p: 0.5, color: fields.hazard_map_confirmed ? 'success.main' : undefined,
                              '&.Mui-checked': { color: 'success.main' } }}
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '7.5pt', lineHeight: 1.3,
                        color: fields.hazard_map_confirmed ? 'success.dark' : 'text.secondary' }}>
                        自治体MAP<br />確認済み
                      </Typography>
                    }
                    sx={{ m: 0, alignItems: 'flex-start' }}
                  />
                </Grid>
                {/* 道路の種類 */}
                <Grid item xs={3}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', mb: 0.4 }}>道路の種類</Typography>
                  <TextField fullWidth size="small" value={fields.road_type}
                    onChange={(e) => set('road_type', e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' } }} />
                </Grid>
              </Grid>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '9pt' }}>交通・周辺環境</Typography>
                <Tooltip title="物件座標から小学校・中学校を自動検索して入力します（編集可能）">
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={handleSchoolAutoFetch}
                    disabled={schoolFetching}
                    startIcon={schoolFetching ? <CircularProgress size={11} color="inherit" /> : <AutoFixHighIcon />}
                    sx={{ ml: 'auto', fontSize: '9px', py: 0.2, px: 0.8, minWidth: 0 }}
                  >
                    {schoolFetching ? '取得中...' : '学校を自動入力'}
                  </Button>
                </Tooltip>
              </Box>
              {schoolFetchError && (
                <Alert severity="error" sx={{ mb: 0.5, py: 0, fontSize: '8pt' }} onClose={() => setSchoolFetchError(null)}>
                  {schoolFetchError}
                </Alert>
              )}
              <Grid container spacing={1} sx={{ mb: 0.5 }}>
                <Grid item xs={6}>
                  <SchoolRowWithConfirm label="小学校" nameKey="elementary_school_name" walkKey="elementary_school_walk"
                    confirmedKey="elementary_school_confirmed" fields={fields} onSet={set} onConfirmChange={handleConfirmChange} />
                </Grid>
                <Grid item xs={6}>
                  <SchoolRowWithConfirm label="中学校" nameKey="junior_high_school_name" walkKey="junior_high_school_walk"
                    confirmedKey="junior_high_school_confirmed" fields={fields} onSet={set} onConfirmChange={handleConfirmChange} />
                </Grid>
              </Grid>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.3 }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '8.5pt', color: '#555' }}>最寄り駅・バス停</Typography>
                <Tooltip title="交通アクセスパネルで取得済みの最寄り駅・バス停（1位）を自動入力します（編集可能）">
                  <Button
                    size="small" variant="outlined" color="primary"
                    onClick={handleTransitAutoFetch}
                    disabled={transitFetching}
                    startIcon={transitFetching ? <CircularProgress size={11} color="inherit" /> : <AutoFixHighIcon />}
                    sx={{ ml: 'auto', fontSize: '9px', py: 0.2, px: 0.8, minWidth: 0 }}
                  >
                    {transitFetching ? '取得中...' : '交通を自動入力'}
                  </Button>
                </Tooltip>
              </Box>
              {transitFetchError && (
                <Alert severity="error" sx={{ mb: 0.5, py: 0, fontSize: '8pt' }} onClose={() => setTransitFetchError(null)}>
                  {transitFetchError}
                </Alert>
              )}
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TransitRowWithConfirm label="最寄り駅" nameKey="nearest_station_name" walkKey="nearest_station_walk"
                    confirmedKey="nearest_station_confirmed" fields={fields} onSet={set} onConfirmChange={handleTransitConfirmChange} />
                </Grid>
                <Grid item xs={6}>
                  <TransitRowWithConfirm label="最寄りバス停" nameKey="nearest_bus_stop_name" walkKey="nearest_bus_stop_walk"
                    confirmedKey="nearest_bus_stop_confirmed" fields={fields} onSet={set} onConfirmChange={handleTransitConfirmChange} />
                </Grid>
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

                {/* ── マンション建物情報（外部建物情報から自動補完・編集可能） ── */}
                <Paper variant="outlined" sx={{ p: 1, mb: 1, bgcolor: '#fffde7' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', mb: 0.5 }}>マンション建物情報</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={fields.mansion_building_name}
                    onChange={(e) => set('mansion_building_name', e.target.value)}
                    placeholder="例: 2010年8月・地上10階・45戸・RC造・全部委託・EV:あり・施工:吉原建設"
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' }, bgcolor: '#fff' }}
                  />
                </Paper>

                <Box sx={{ textAlign: 'center', py: 0.8, mb: 1 }}>
                  <Typography sx={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#666', letterSpacing: 1 }}>
                    ＝＝＝＝＝ここから訪問時記入＝＝＝＝＝
                  </Typography>
                </Box>
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
                <Box sx={{ textAlign: 'center', py: 0.8, mb: 1 }}>
                  <Typography sx={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#666', letterSpacing: 1 }}>
                    ＝＝＝＝＝ここから訪問時記入＝＝＝＝＝
                  </Typography>
                </Box>
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

            {/* ─── 新規フィールド（固定資産税の上） ─── */}
            <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
              {/* 売却理由 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.6, borderBottom: '1px solid #eee' }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0, width: 76 }}>売却理由</Typography>
                <TextField fullWidth size="small" value={fields.sale_reason}
                  onChange={(e) => set('sale_reason', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' } }} />
              </Box>
              {/* 境界 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.6, borderBottom: '1px solid #eee' }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0, width: 76 }}>境界</Typography>
                <TextField fullWidth size="small" value={fields.boundary_info}
                  onChange={(e) => set('boundary_info', e.target.value)}
                  placeholder="□杭　印あり　□杭　印なし　□越境物（　　）"
                  sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' }, '& input::placeholder': { color: '#bbb', opacity: 1, fontSize: '8pt' } }} />
              </Box>
              {/* ガス・排水 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.6, flexWrap: 'wrap', borderBottom: '1px solid #eee' }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0 }}>ガス</Typography>
                <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={fields.gas_propane} onChange={(e) => set('gas_propane', e.target.checked)} />} label={<Typography sx={{ fontSize: '9pt' }}>プロパン</Typography>} />
                <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={fields.gas_city_gas} onChange={(e) => set('gas_city_gas', e.target.checked)} />} label={<Typography sx={{ fontSize: '9pt' }}>都市ガス</Typography>} />
                <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0, ml: 2 }}>排水</Typography>
                <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={fields.drainage_public} onChange={(e) => set('drainage_public', e.target.checked)} />} label={<Typography sx={{ fontSize: '9pt' }}>公共下水</Typography>} />
                <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={fields.drainage_septic} onChange={(e) => set('drainage_septic', e.target.checked)} />} label={<Typography sx={{ fontSize: '9pt' }}>浄化槽</Typography>} />
                <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={fields.drainage_cesspool} onChange={(e) => set('drainage_cesspool', e.target.checked)} />} label={<Typography sx={{ fontSize: '9pt' }}>汲み取り</Typography>} />
              </Box>
              {/* 建築会社 → 固定資産税の下セクションに移動 */}
              {/* 管理会社（マンションのみ） */}
              {isMansion && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.6 }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0, width: 76 }}>管理会社</Typography>
                  <TextField fullWidth size="small" value={fields.management_company}
                    onChange={(e) => set('management_company', e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' } }} />
                </Box>
              )}
            </Paper>

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

            {/* ─── 訪問時記入フィールド（固定資産税の下） ─── */}
            <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
              {[
                { key: 'construction_company' as const, label: '建築会社' },
                { key: 'exterior_reform'       as const, label: '外観リフォーム' },
                { key: 'interior_reform'       as const, label: '内装リフォーム' },
                { key: 'defects'               as const, label: '雨漏れ、シロアリ等の不具合' },
                { key: 'incident_info'         as const, label: '事件、事故' },
                { key: 'minpaku'               as const, label: '民泊' },
              ].map((f, idx, arr) => (
                <Box key={f.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.6, borderBottom: idx < arr.length - 1 || fields.solar_panel !== undefined ? '1px solid #eee' : 'none' }}>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0, width: 140 }}>{f.label}</Typography>
                  <TextField fullWidth size="small" value={fields[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' } }} />
                </Box>
              ))}
              {/* 太陽光 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.6 }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '9pt', flexShrink: 0, width: 140 }}>太陽光</Typography>
                <TextField fullWidth size="small" value={fields.solar_panel}
                  onChange={(e) => set('solar_panel', e.target.value)}
                  placeholder="　Kw　買取保証期間　年　月"
                  sx={{ '& .MuiOutlinedInput-root': { fontSize: '9pt' }, '& input::placeholder': { color: '#bbb', opacity: 1 } }} />
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
