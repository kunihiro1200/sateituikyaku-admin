/**
 * 売上目標管理ダッシュボード（大分店）
 * 優先表示順: ①累計達成率 ②年間見通し ③月別集計 ④担当者別 ⑤詳細一覧
 * 店舗判定: 物件番号FI除外＝大分店（担当者所属で判定しない）
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container, Box, Typography, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, IconButton, TextField, Chip,
  Card, CardContent, Grid,
  LinearProgress,
  Accordion, AccordionSummary, AccordionDetails,
  Tooltip, Divider,
  CircularProgress, Snackbar, Alert,
  useTheme, useMediaQuery,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip as ChartTooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
ChartJS.register(CategoryScale,LinearScale,BarElement,LineElement,PointElement,Title,ChartTooltip,Legend,Filler);
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { supabase } from '../config/supabase';
import api from '../services/api';
import PageNavigation from '../components/PageNavigation';
import { useAuthStore } from '../store/authStore';
import { SECTION_COLORS } from '../theme/sectionColors';

// ============================================================
// 定数
// ============================================================
const FISCAL_YEAR = '2026-2027';
const FY_START_DATE = '2026-10-01';
const FY_END_DATE = '2027-09-30';
const FY_START_MONTH = '2026-10';
const FY_END_MONTH = '2027-09';
const FY_MONTHS = [
  '2026-10','2026-11','2026-12',
  '2027-01','2027-02','2027-03',
  '2027-04','2027-05','2027-06',
  '2027-07','2027-08','2027-09',
];
const PREV_FY_START_DATE = '2025-10-01';
const PREV_FY_END_DATE   = '2026-09-30';
const DEFAULT_STORE_TARGET = 120_000_000;
const BOTH_HAND_RATE = 0.65;
const PROPERTY_COLOR = SECTION_COLORS.property.main;

function _computeCurrentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
}
const CURRENT_MONTH = _computeCurrentMonth();
const YTD_MONTHS = FY_MONTHS.filter(m => m <= CURRENT_MONTH);
const PREV_YTD_MONTHS = YTD_MONTHS.map(m => { const [y,mo]=m.split('-'); return `${+y-1}-${mo}`; });

const STAFF_LIST = ['山本','角井','林田','麻生','裏','国広'];
const STAFF_BUTTONS = ['全員','山本','角井','林田','麻生','裏','国広'] as const;
const STAFF_BUTTONS_FUKUOKA = ['全員','裏','国広'] as const;
const STAFF_PATTERNS: Record<string,string[]> = {
  山本:['山本','山','Y'], 角井:['角井','I'], 林田:['林','林田'],
  麻生:['麻生','麻'], 裏:['裏','U'], 国広:['K','国広'],
};

// ============================================================
// 型定義
// ============================================================
interface SettledProperty {
  property_number: string;
  sales_assignee?: string|null;
  settlement_date?: string|null;
  total_commission?: number|null;
  commission_from_seller?: number|null;
  commission_from_buyer?: number|null;
  price?: number|null;
}
interface ActiveListing {
  property_number: string;
  sales_assignee?: string|null;
  price?: number|null;
  commission_from_seller?: number|null;
  address?: string|null;
  display_address?: string|null;
  seller_name?: string|null;
}
interface ProspectRecord {
  property_number: string;
  prospect_rank?: string|null;
  settlement_expected_month?: string|null;
  manager_check_status?: string|null;
}
interface ActiveListingWithProspect extends ActiveListing { prospect?: ProspectRecord; }
interface ContractRecord {
  property_number: string; settlement_month: string|null; settlement_date: string|null;
  staff: string; commission: number;
  property_name?: string;  // E列：物件名
  contract_type?: string;  // M列：契約形態
  category: 'actual'|'contracted';
}
interface AnnualTarget {
  id?: string; fiscal_year: string; store_name: string; staff_name: string; target_amount: number;
}
interface MonthlyTarget {
  id?: string; fiscal_year: string; month: string; store_name: string;
  staff_name: string; target_amount: number;
}
interface MonthRow {
  month: string; target: number; hasTarget: boolean;
  actual: number; contracted: number; forecast: number; prevActual: number; prevCumActual: number;
  isFuture: boolean; isCurrentMonth: boolean;
  actualCount: number; contractedCount: number; forecastCount: number;
  cumTarget: number; cumActual: number;
  monthRate: number|null; cumRate: number|null; yoy: number|null;
}

// ============================================================
// ユーティリティ
// ============================================================
function shiftMonthByYear(month: string, years: number): string {
  const [y,m] = month.split('-');
  return `${+y+years}-${m}`;
}
function matchesStaff(assignee: string|undefined|null, staffName: string): boolean {
  if (staffName === '全員') return true;
  if (!assignee) return false;
  return (STAFF_PATTERNS[staffName] ?? []).some(p => assignee.includes(p));
}
function calcSellerCommission(price?: number|null, cfSeller?: number|null): number {
  if (cfSeller && cfSeller > 0) return cfSeller;
  if (!price || price <= 0) return 0;
  if (price >= 8_000_000) return Math.round((price*0.03+60_000)*1.1);
  return 330_000;
}
function calcExpectedRevenue(sc: number): number {
  return Math.round(sc*(BOTH_HAND_RATE*2+(1-BOTH_HAND_RATE)));
}
function getActualCommission(p: SettledProperty): number {
  if (p.total_commission && p.total_commission > 0) return p.total_commission;
  const s=p.commission_from_seller??0, b=p.commission_from_buyer??0;
  if (s+b>0) return s+b;
  return calcExpectedRevenue(calcSellerCommission(p.price));
}
function getSettlementMonth(d: string): string { return d.substring(0,7); }
function formatPrice(amount: number): string {
  if (amount<=0) return '-';
  const man=amount/10_000;
  return `${man%1===0?man.toFixed(0):man.toFixed(1)}万円`;
}
function formatMonth(yyyymm: string): string {
  const [y,m]=yyyymm.split('-');
  return `${y}年${parseInt(m,10)}月`;
}
function rateColor(rate: number|null): string {
  if (rate===null) return '#757575';
  if (rate>=100) return '#2e7d32';
  if (rate>=80) return '#fb8c00';
  return '#c62828';
}
function rateChipSx(rate: number|null) {
  const c=rateColor(rate);
  const bg=rate===null?'#f5f5f5':rate>=100?'#e8f5e9':rate>=80?'#fff3e0':'#ffebee';
  return {bgcolor:bg,color:c,fontWeight:'bold',fontSize:'0.7rem'};
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function SalesDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isFukuoka = searchParams.get('store') === 'fukuoka';
  const STORE_NAME  = isFukuoka ? '福岡店' : '大分店';
  const STORE_LABEL = isFukuoka ? '福岡店（FI番号）' : '大分店（FI除外）';
  const STORE_COLOR = isFukuoka ? '#e65100' : PROPERTY_COLOR; // 大分=青、福岡=オレンジ
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { employee } = useAuthStore();

  // ── データ状態 ──
  const [settled, setSettled] = useState<SettledProperty[]>([]);
  const [prevYearSettled, setPrevYearSettled] = useState<SettledProperty[]>([]);
  const [listings, setListings] = useState<ActiveListing[]>([]);
  const [prospects, setProspects] = useState<ProspectRecord[]>([]);
  const [annualTargets, setAnnualTargets] = useState<AnnualTarget[]>([]);
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTarget[]>([]);
  const [contracted, setContracted] = useState<ContractRecord[]>([]);
  const [contractedError, setContractedError] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);

  // ── 選択・展開状態 ──
  const [selectedStaff, setSelectedStaff] = useState<string>('全員');
  const [expandedStaff, setExpandedStaff] = useState<string|null>(null);

  // ── 編集状態 ──
  const [editingMonth, setEditingMonth] = useState<{month:string;staffName:string}|null>(null);
  const [editMonthVal, setEditMonthVal] = useState('');
  const [editingAnnual, setEditingAnnual] = useState<string|null>(null);
  const [editAnnualVal, setEditAnnualVal] = useState('');
  const [saving, setSaving] = useState(false);

  const [snackbar, setSnackbar] = useState<{open:boolean;message:string;severity:'success'|'error'}>(
    {open:false,message:'',severity:'success'}
  );

  // ── 成約見込み詳細モーダル ──
  const [forecastModal, setForecastModal] = useState<{
    open: boolean; staffName: string; items: ActiveListingWithProspect[];
  }>({ open: false, staffName: '', items: [] });

  const openForecastModal = (staffName: string, items: ActiveListingWithProspect[]) => {
    setForecastModal({ open: true, staffName, items });
  };

  // ── 売買契約済み詳細モーダル ──
  const [contractedModal, setContractedModal] = useState<{
    open: boolean; title: string; items: ContractRecord[];
  }>({ open: false, title: '', items: [] });

  const openContractedModal = (title: string, items: ContractRecord[]) => {
    setContractedModal({ open: true, title, items });
  };

  // ── データ取得 ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 店舗フィルタ（大分=FI除外、福岡=FI含む）を構築する共通ヘルパー
      const applyStoreFilter = (q: any) =>
        isFukuoka
          ? q.ilike('property_number', '%FI%')
          : q.not('property_number', 'ilike', '%FI%');

      const [sR,pR,lR,prR,atR,mtR] = await Promise.all([
        applyStoreFilter(
          supabase.from('property_listings')
            .select('property_number,sales_assignee,settlement_date,total_commission,commission_from_seller,commission_from_buyer,price')
            .not('settlement_date','is',null)
            .gte('settlement_date',FY_START_DATE).lte('settlement_date',FY_END_DATE)
        ).order('settlement_date',{ascending:true}),
        applyStoreFilter(
          supabase.from('property_listings')
            .select('property_number,sales_assignee,settlement_date,total_commission,commission_from_seller,commission_from_buyer,price')
            .not('settlement_date','is',null)
            .gte('settlement_date',PREV_FY_START_DATE).lte('settlement_date',PREV_FY_END_DATE)
        ),
        applyStoreFilter(
          supabase.from('property_listings')
            .select('property_number,sales_assignee,price,commission_from_seller,address,display_address,seller_name')
            .eq('atbb_status','専任・公開中')
        ),
        supabase.from('property_contract_prospects')
          .select('property_number,prospect_rank,settlement_expected_month,manager_check_status')
          .not('settlement_expected_month','is',null)
          .gte('settlement_expected_month',FY_START_MONTH).lte('settlement_expected_month',FY_END_MONTH),
        supabase.from('sales_targets').select('*').eq('fiscal_year',FISCAL_YEAR).eq('store_name',STORE_NAME),
        supabase.from('monthly_sales_targets').select('*').eq('fiscal_year',FISCAL_YEAR).eq('store_name',STORE_NAME),
      ]);
      setSettled(sR.data??[]);
      setPrevYearSettled(pR.data??[]);
      setListings(lR.data??[]);
      setProspects(prR.data??[]);
      setAnnualTargets(atR.data??[]);
      setMonthlyTargets(mtR.data??[]);
      // スプレッドシートの売買契約済み（大分店のみ・福岡は別途）
      if (!isFukuoka) {
        try {
          const cr = await api.get<{contracts:ContractRecord[]}>('/api/sales/contracts');
          setContracted((cr.data.contracts??[]).filter(c=>c.category==='contracted'));
          setContractedError(null);
        } catch {
          setContractedError('スプレッドシート取得エラー');
          setContracted([]);
        }
      } else {
        // 福岡版：専用シートから取得
        try {
          const cr = await api.get<{contracts:ContractRecord[]}>('/api/sales/contracts?store=fukuoka');
          setContracted((cr.data.contracts??[]).filter(c=>c.category==='contracted'));
          setContractedError(null);
        } catch {
          setContractedError('スプレッドシート取得エラー（福岡シート）');
          setContracted([]);
        }
      }
    } catch(err) {
      setSnackbar({open:true,message:'データ取得失敗',severity:'error'});
    } finally { setLoading(false); }
  },[isFukuoka, STORE_NAME]);

  useEffect(()=>{fetchData();},[fetchData]);

  // ── ヘルパー ──
  const getAnnualTarget = useCallback((staffName:string) =>
    annualTargets.find(t=>t.staff_name===staffName)?.target_amount??0,[annualTargets]);
  const getMonthTarget = useCallback((month:string, staffName:string) =>
    monthlyTargets.find(t=>t.month===month&&t.staff_name===staffName)?.target_amount??0,[monthlyTargets]);
  const monthlyTargetSum = useCallback((staffName:string) =>
    FY_MONTHS.reduce((s,m)=>s+getMonthTarget(m,staffName),0),[getMonthTarget]);

  // ── フィルタ済みデータ ──
  const staffKey = selectedStaff==='全員'?'':selectedStaff;
  const filteredSettled = useMemo(()=>
    selectedStaff==='全員'?settled:settled.filter(p=>matchesStaff(p.sales_assignee,selectedStaff))
  ,[settled,selectedStaff]);
  const filteredPrevYear = useMemo(()=>
    selectedStaff==='全員'?prevYearSettled:prevYearSettled.filter(p=>matchesStaff(p.sales_assignee,selectedStaff))
  ,[prevYearSettled,selectedStaff]);
  const filteredContracted = useMemo(()=>
    selectedStaff==='全員'?contracted:contracted.filter(c=>matchesStaff(c.staff,selectedStaff))
  ,[contracted,selectedStaff]);
  const forecastItems = useMemo(():ActiveListingWithProspect[]=>{
    const pm=new Map(prospects.map(p=>[p.property_number,p]));
    return listings.map(l=>({...l,prospect:pm.get(l.property_number)}))
      .filter(l=>l.prospect?.settlement_expected_month);
  },[listings,prospects]);
  const filteredForecast = useMemo(()=>
    selectedStaff==='全員'?forecastItems:forecastItems.filter(p=>matchesStaff(p.sales_assignee,selectedStaff))
  ,[forecastItems,selectedStaff]);

  // ── 月別データ（12ヶ月） ──
  const monthRows = useMemo(():MonthRow[]=>{
    let cumTarget=0, cumActual=0, prevCum=0;
    return FY_MONTHS.map(month=>{
      const isFuture=month>CURRENT_MONTH;
      const isCurrentMonth=month===CURRENT_MONTH;
      const prevMonth=shiftMonthByYear(month,-1);
      const mySettled=filteredSettled.filter(p=>p.settlement_date&&getSettlementMonth(p.settlement_date)===month);
      const myContracted=filteredContracted.filter(c=>c.settlement_month===month);
      const myForecast=filteredForecast.filter(p=>p.prospect?.settlement_expected_month===month);
      const myPrev=filteredPrevYear.filter(p=>p.settlement_date&&getSettlementMonth(p.settlement_date)===prevMonth);
      const target=getMonthTarget(month,staffKey);
      const hasTarget=target>0;
      const actual=mySettled.reduce((s,p)=>s+getActualCommission(p),0);
      const contracted=myContracted.reduce((s,c)=>s+(c.commission??0),0);
      const forecast=myForecast.reduce((s,p)=>{
        const sc=calcSellerCommission(p.price,p.commission_from_seller);
        return s+calcExpectedRevenue(sc);
      },0);
      const prevActual=myPrev.reduce((s,p)=>s+getActualCommission(p),0);
      if (!isFuture){ cumTarget+=target; cumActual+=actual; }
      prevCum+=prevActual;
      const monthRate=hasTarget&&!isFuture?Math.round(actual/target*100):null;
      const cumRate=cumTarget>0?Math.round(cumActual/cumTarget*100):null;
      const yoy=prevActual>0?Math.round(actual/prevActual*100):null;
      return {month,target,hasTarget,actual,contracted,forecast,prevActual,prevCumActual:prevCum,
        isFuture,isCurrentMonth,actualCount:mySettled.length,contractedCount:myContracted.length,
        forecastCount:myForecast.length,cumTarget,cumActual,monthRate,cumRate,yoy};
    });
  },[filteredSettled,filteredContracted,filteredForecast,filteredPrevYear,monthlyTargets,staffKey]);

  // ── グラフデータ ──
  const MONTH_LABELS = FY_MONTHS.map(m=>{const[,mo]=m.split('-');return`${parseInt(mo)}月`;});
  const STAFF_COLORS_MAP: Record<string,string> = {
    山本:'#e53935',角井:'#1e88e5',林田:'#43a047',麻生:'#fb8c00',裏:'#8e24aa',国広:'#00acc1',
  };

  const barChartData = useMemo(()=>({
    labels: MONTH_LABELS,
    datasets:[
      {label:'今期実績（決済済み）',
        data:monthRows.map(m=>parseFloat((m.actual/10_000).toFixed(1))),
        backgroundColor:monthRows.map(m=>m.isCurrentMonth?'#1b5e20':m.isFuture?'#e0e0e0':'#43a047'),
        borderColor:'#2e7d32',borderWidth:1,borderRadius:4},
      {label:'今期目標',
        data:monthRows.map(m=>parseFloat((m.target/10_000).toFixed(1))),
        type:'line' as const,borderColor:'#1565c0',backgroundColor:'transparent',
        borderWidth:2,borderDash:[6,3],pointRadius:5,pointBackgroundColor:'#1565c0',tension:0.2},
      {label:'前期実績',
        data:monthRows.map(m=>parseFloat((m.prevActual/10_000).toFixed(1))),
        backgroundColor:'rgba(158,158,158,0.6)',borderColor:'#757575',borderWidth:1,borderRadius:4},
    ],
  }),[monthRows]);

  const lineChartData = useMemo(()=>({
    labels: MONTH_LABELS,
    datasets:[
      {label:'今期 累計実績',
        data:monthRows.map(m=>parseFloat((m.cumActual/10_000).toFixed(1))),
        borderColor:'#2e7d32',backgroundColor:'rgba(46,125,50,0.1)',fill:true,tension:0.3,pointRadius:5,borderWidth:2.5},
      {label:'今期 累計目標',
        data:monthRows.map(m=>parseFloat((m.cumTarget/10_000).toFixed(1))),
        borderColor:'#1565c0',backgroundColor:'transparent',borderDash:[6,3],tension:0.2,pointRadius:5,borderWidth:2},
      {label:'前期 累計実績',
        data:monthRows.map(m=>parseFloat((m.prevCumActual/10_000).toFixed(1))),
        borderColor:'#9e9e9e',backgroundColor:'transparent',tension:0.3,pointRadius:4,borderWidth:1.5},
    ],
  }),[monthRows]);

  const allStaffBarData = useMemo(()=>({
    labels: MONTH_LABELS,
    datasets: STAFF_LIST.map(name=>({
      label: name,
      data: FY_MONTHS.map(month=>{
        const pats=STAFF_PATTERNS[name]??[];
        return parseFloat((
          settled.filter(p=>pats.some(pat=>(p.sales_assignee??'').includes(pat))&&
            p.settlement_date&&getSettlementMonth(p.settlement_date)===month)
            .reduce((s,p)=>s+getActualCommission(p),0)/10_000
        ).toFixed(1));
      }),
      backgroundColor:(STAFF_COLORS_MAP[name]||'#9e9e9e')+'cc',
      borderColor:STAFF_COLORS_MAP[name]||'#9e9e9e',
      borderWidth:1,borderRadius:3,
    })),
  }),[settled]);

  const chartBarOptions = useMemo(()=>({
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{position:'top' as const,labels:{font:{size:13},padding:12}},
      tooltip:{callbacks:{label:(ctx:any)=>`${ctx.dataset.label}: ${ctx.parsed.y}万円`}}},
    scales:{x:{ticks:{font:{size:12}},grid:{display:false}},
      y:{beginAtZero:true,ticks:{callback:(v:any)=>`${v}万`,font:{size:12}}}},
  }),[]);

  const chartLineOptions = useMemo(()=>({
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{position:'top' as const,labels:{font:{size:13},padding:12}},
      tooltip:{callbacks:{label:(ctx:any)=>`${ctx.dataset.label}: ${ctx.parsed.y}万円`}}},
    scales:{x:{ticks:{font:{size:12}},grid:{color:'rgba(0,0,0,0.05)'}},
      y:{beginAtZero:true,ticks:{callback:(v:any)=>`${v}万`,font:{size:12}}}},
  }),[]);

  // ── YTD累計 ──
  const ytdData = useMemo(()=>{
    const ytdRows=monthRows.filter(m=>YTD_MONTHS.includes(m.month));
    const actual=ytdRows.reduce((s,m)=>s+m.actual,0);
    const target=ytdRows.reduce((s,m)=>s+m.target,0);
    const missingCount=ytdRows.filter(m=>!m.hasTarget).length;
    const rate=target>0?Math.round(actual/target*100):null;
    const gap=actual-target;
    const prevActual=PREV_YTD_MONTHS.reduce((s,pm)=>
      s+filteredPrevYear.filter(p=>p.settlement_date&&getSettlementMonth(p.settlement_date)===pm)
        .reduce((ss,p)=>ss+getActualCommission(p),0),0);
    const yoyRatio=prevActual>0?Math.round(actual/prevActual*100):null;
    const label=YTD_MONTHS.length===1?formatMonth(YTD_MONTHS[0])
      :`${formatMonth(YTD_MONTHS[0])}〜${formatMonth(YTD_MONTHS[YTD_MONTHS.length-1])}`;
    const prevLabel=PREV_YTD_MONTHS.length===1?formatMonth(PREV_YTD_MONTHS[0])
      :`${formatMonth(PREV_YTD_MONTHS[0])}〜${formatMonth(PREV_YTD_MONTHS[PREV_YTD_MONTHS.length-1])}`;
    return {label,prevLabel,actual,target,rate,gap,prevActual,yoyRatio,missingCount};
  },[monthRows,filteredPrevYear]);

  // ── 年間見通し ──
  const annualSummary = useMemo(()=>{
    const actual=filteredSettled.reduce((s,p)=>s+getActualCommission(p),0);
    const contractedAmt=filteredContracted.reduce((s,c)=>s+(c.commission??0),0);
    const forecast=filteredForecast.reduce((s,p)=>{
      const sc=calcSellerCommission(p.price,p.commission_from_seller);
      return s+calcExpectedRevenue(sc);
    },0);
    const projected=actual+contractedAmt+forecast;
    const annualTarget=getAnnualTarget(staffKey);
    const projRate=annualTarget>0?Math.round(projected/annualTarget*100):null;
    return {actual,contracted:contractedAmt,forecast,projected,annualTarget,projRate,
      actualCount:filteredSettled.length,contractedCount:filteredContracted.length,forecastCount:filteredForecast.length};
  },[filteredSettled,filteredContracted,filteredForecast,annualTargets,staffKey]);

  // ── 担当者別集計（全員表示用） ──
  const staffSummaries = useMemo(()=>STAFF_LIST.map(name=>{
    const pats=STAFF_PATTERNS[name]??[];
    const myS=settled.filter(p=>pats.some(pat=>(p.sales_assignee??'').includes(pat)));
    const myPrev=prevYearSettled.filter(p=>pats.some(pat=>(p.sales_assignee??'').includes(pat)));
    const myCon=contracted.filter(c=>pats.some(pat=>(c.staff??'').includes(pat)));
    const myFor=forecastItems.filter(p=>pats.some(pat=>(p.sales_assignee??'').includes(pat)));
    const actual=myS.reduce((s,p)=>s+getActualCommission(p),0);
    const ytdActual=YTD_MONTHS.reduce((s,m)=>
      s+myS.filter(p=>p.settlement_date&&getSettlementMonth(p.settlement_date)===m)
        .reduce((ss,p)=>ss+getActualCommission(p),0),0);
    const ytdTarget=YTD_MONTHS.reduce((s,m)=>s+getMonthTarget(m,name),0);
    const ytdRate=ytdTarget>0?Math.round(ytdActual/ytdTarget*100):null;
    const prevYtdActual=PREV_YTD_MONTHS.reduce((s,pm)=>
      s+myPrev.filter(p=>p.settlement_date&&getSettlementMonth(p.settlement_date)===pm)
        .reduce((ss,p)=>ss+getActualCommission(p),0),0);
    const yoy=prevYtdActual>0?Math.round(ytdActual/prevYtdActual*100):null;
    const annualTarget=getAnnualTarget(name);
    const contractedAmt=myCon.reduce((s,c)=>s+(c.commission??0),0);
    const forecastAmt=myFor.reduce((s,p)=>{
      const sc=calcSellerCommission(p.price,p.commission_from_seller);
      return s+calcExpectedRevenue(sc);
    },0);
    const projected=actual+contractedAmt+forecastAmt;
    const projRate=annualTarget>0?Math.round(projected/annualTarget*100):null;
    return {name,actual,ytdActual,ytdTarget,ytdRate,prevYtdActual,yoy,
      contracted:contractedAmt,forecast:forecastAmt,projected,annualTarget,projRate,
      actualCount:myS.length,contractedCount:myCon.length,forecastCount:myFor.length};
  }),[settled,prevYearSettled,contracted,forecastItems,monthlyTargets,annualTargets]);

  // ── 担当者月別（展開時） ──
  const staffMonthRows = useMemo(()=>{
    if (!expandedStaff) return [];
    const pats=STAFF_PATTERNS[expandedStaff]??[];
    const myS=settled.filter(p=>pats.some(pat=>(p.sales_assignee??'').includes(pat)));
    const myPrev=prevYearSettled.filter(p=>pats.some(pat=>(p.sales_assignee??'').includes(pat)));
    let cumT=0,cumA=0;
    return FY_MONTHS.map(month=>{
      const isFuture=month>CURRENT_MONTH;
      const prevM=shiftMonthByYear(month,-1);
      const actual=myS.filter(p=>p.settlement_date&&getSettlementMonth(p.settlement_date)===month)
        .reduce((s,p)=>s+getActualCommission(p),0);
      const prevActual=myPrev.filter(p=>p.settlement_date&&getSettlementMonth(p.settlement_date)===prevM)
        .reduce((s,p)=>s+getActualCommission(p),0);
      const target=getMonthTarget(month,expandedStaff);
      if (!isFuture){cumT+=target;cumA+=actual;}
      return {month,target,hasTarget:target>0,actual,prevActual,isFuture,
        monthRate:target>0&&!isFuture?Math.round(actual/target*100):null,
        cumTarget:cumT,cumActual:cumA,cumRate:cumT>0?Math.round(cumA/cumT*100):null};
    });
  },[expandedStaff,settled,prevYearSettled,monthlyTargets]);

  // ── 目標保存 ──
  const handleSaveMonthTarget = async (month:string, sKey:string, val:string) => {
    if (!employee) return;
    setSaving(true);
    try {
      const man=parseFloat(val);
      if (isNaN(man)||man<0) throw new Error('正の数値を入力してください');
      const amount=Math.round(man*10_000);
      const row:MonthlyTarget={fiscal_year:FISCAL_YEAR,month,store_name:STORE_NAME,staff_name:sKey,target_amount:amount};
      const {error}=await supabase.from('monthly_sales_targets')
        .upsert(row,{onConflict:'fiscal_year,month,store_name,staff_name'});
      if (error) throw error;
      setMonthlyTargets(prev=>[...prev.filter(t=>!(t.month===month&&t.staff_name===sKey)),row]);
      setEditingMonth(null);
      setSnackbar({open:true,message:'月別目標を保存しました',severity:'success'});
    } catch(err:any) {
      setSnackbar({open:true,message:err.message??'保存失敗',severity:'error'});
    } finally { setSaving(false); }
  };

  const handleSaveAnnualTarget = async (sKey:string, val:string) => {
    if (!employee) return;
    setSaving(true);
    try {
      const man=parseFloat(val);
      if (isNaN(man)||man<0) throw new Error('正の数値を入力してください');
      const amount=Math.round(man*10_000);
      const row:AnnualTarget={fiscal_year:FISCAL_YEAR,store_name:STORE_NAME,staff_name:sKey,target_amount:amount};
      const {error}=await supabase.from('sales_targets')
        .upsert(row,{onConflict:'fiscal_year,store_name,staff_name'});
      if (error) throw error;
      setAnnualTargets(prev=>[...prev.filter(t=>t.staff_name!==sKey),row]);

      // 月別目標が未設定の場合は12ヶ月に均等自動配分
      const existing=monthlyTargets.filter(t=>t.staff_name===sKey&&t.fiscal_year===FISCAL_YEAR);
      if (existing.length===0 && sKey!=='') {
        const base=Math.floor(amount/12);
        const remainder=amount-base*12;
        const monthlyRows:MonthlyTarget[]=FY_MONTHS.map((month,i)=>({
          fiscal_year:FISCAL_YEAR,month,store_name:STORE_NAME,staff_name:sKey,
          target_amount:i===11?base+remainder:base,
        }));
        const {error:me}=await supabase.from('monthly_sales_targets')
          .upsert(monthlyRows,{onConflict:'fiscal_year,month,store_name,staff_name'});
        if (!me) setMonthlyTargets(prev=>[...prev.filter(t=>t.staff_name!==sKey),...monthlyRows]);
        setSnackbar({open:true,message:`年間目標を保存し、月別目標を12ヶ月均等配分しました（約${Math.round(man/12)}万円/月）`,severity:'success'});
      } else {
        setSnackbar({open:true,message:'年間目標を保存しました（月別目標は既存設定を維持）',severity:'success'});
      }
      setEditingAnnual(null);
    } catch(err:any) {
      setSnackbar({open:true,message:err.message??'保存失敗',severity:'error'});
    } finally { setSaving(false); }
  };

  // ============================================================
  // JSX
  // ============================================================
  const isAchieved = ytdData.rate !== null && ytdData.rate >= 100;
  const ytdBorderColor = ytdData.rate === null ? '#1565c0' : isAchieved ? '#2e7d32' : '#c62828';

  const TC = {px:1.25,py:1.25,fontSize:'15px',whiteSpace:'nowrap' as const};
  const TH = {...TC,fontWeight:'bold',bgcolor:'#1565c0',color:'#fff',fontSize:'15px'};

  function EditableMonthCell({month, sKey, currentTarget}: {month:string;sKey:string;currentTarget:number}) {
    const isEditing = editingMonth?.month===month && editingMonth?.staffName===sKey;
    if (isEditing) return (
      <Box sx={{display:'flex',gap:0.5,alignItems:'center',minWidth:140}}>
        <TextField size="small" value={editMonthVal} onChange={e=>setEditMonthVal(e.target.value)}
          type="number" label="万円単位で入力" sx={{width:140}} inputProps={{min:0}} autoFocus
          helperText="例: 500 → 500万円"
          onKeyDown={e=>{if(e.key==='Enter') handleSaveMonthTarget(month,sKey,editMonthVal);}}/>
        <IconButton size="small" color="primary" disabled={saving}
          onClick={()=>handleSaveMonthTarget(month,sKey,editMonthVal)}><SaveIcon sx={{fontSize:'1rem'}}/></IconButton>
        <IconButton size="small" disabled={saving} onClick={()=>setEditingMonth(null)}><CancelIcon sx={{fontSize:'1rem'}}/></IconButton>
      </Box>
    );
    return (
      <Box sx={{display:'flex',alignItems:'center',gap:0.25}}>
        <Typography variant="body2" sx={{fontSize:'0.8rem',minWidth:60}}>
          {currentTarget>0?formatPrice(currentTarget):<span style={{color:'#bbb'}}>未設定</span>}
        </Typography>
        <Tooltip title="目標を設定（万円単位）"><IconButton size="small"
          onClick={()=>{setEditingMonth({month,staffName:sKey});setEditMonthVal(currentTarget>0?(currentTarget/10_000).toString():'');}}>
          <EditIcon sx={{fontSize:'0.8rem',color:PROPERTY_COLOR}}/></IconButton></Tooltip>
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={isMobile?{px:1,py:2}:{py:3}}>
      {/* ヘッダー */}
      <Box sx={{display:'flex',alignItems:'center',mb:2,gap:1,flexWrap:'wrap'}}>
        <IconButton onClick={()=>navigate('/property-listings')} size="small"><ArrowBackIcon/></IconButton>
        <AssessmentIcon sx={{color:STORE_COLOR}}/>
        <Typography variant={isMobile?'subtitle1':'h5'} fontWeight="bold" sx={{color:STORE_COLOR}}>
          売上目標管理{isFukuoka?' — 福岡店':''}
        </Typography>
        <Chip label={`${STORE_LABEL} ${FISCAL_YEAR.replace('-','〜')}年度`} size="small"
          sx={{bgcolor:isFukuoka?'#fff3e0':'#e3f2fd',color:STORE_COLOR,fontWeight:500}}/>
        <Tooltip title={isFukuoka?'店舗判定：物件番号FI含む＝福岡店':'店舗判定：物件番号FI除外＝大分店（担当者所属では判定しない）'}>
          <Chip label={isFukuoka?'FI含む＝福岡店':'FI除外＝大分店'} size="small" variant="outlined"
            sx={{fontSize:'0.7rem',color:'text.secondary',cursor:'help'}}/>
        </Tooltip>
        <Box sx={{ml:'auto',display:'flex',gap:1,alignItems:'center'}}>
          <Tooltip title="再読み込み"><IconButton size="small" onClick={fetchData} disabled={loading}>
            <RefreshIcon fontSize="small"/></IconButton></Tooltip>
        </Box>
      </Box>
      <PageNavigation/>

      {loading ? (
        <Box sx={{display:'flex',justifyContent:'center',py:10}}><CircularProgress/></Box>
      ) : (<>

      {/* 担当者切替 */}
      <Box sx={{display:'flex',gap:1,flexWrap:'wrap',mt:2,mb:2.5}}>
        {(isFukuoka ? STAFF_BUTTONS_FUKUOKA : STAFF_BUTTONS).map(staff=>(
          <Button key={staff} variant={selectedStaff===staff?'contained':'outlined'} size="medium"
            onClick={()=>{setSelectedStaff(staff);setExpandedStaff(null);}}
            sx={{fontSize:'15px',fontWeight:'bold',minWidth:72,
              ...(selectedStaff===staff
                ?{bgcolor:PROPERTY_COLOR,'&:hover':{bgcolor:SECTION_COLORS.property.dark}}
                :{borderColor:PROPERTY_COLOR,color:PROPERTY_COLOR,'&:hover':{bgcolor:'#e3f2fd'}})}}>
            {staff}
          </Button>
        ))}
      </Box>

      {/* ──────────────────────────────────────────── */}
      {/* ① 最優先：今月までの累計目標達成率           */}
      {/* ──────────────────────────────────────────── */}
      <Paper sx={{p:3,mb:2.5,border:`3px solid ${ytdBorderColor}`,borderRadius:2}} elevation={3}>
        <Box sx={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',mb:2,flexWrap:'wrap',gap:1}}>
          <Box>
            <Typography variant="overline" sx={{color:'text.secondary',display:'block'}}>
              今月までの累計達成率
            </Typography>
            <Typography variant="h6" fontWeight="bold" sx={{color:PROPERTY_COLOR}}>
              {selectedStaff==='全員'?`${STORE_NAME}全体`:selectedStaff} — {ytdData.label}
            </Typography>
            {ytdData.missingCount>0 && (
              <Chip label={`注意：${ytdData.missingCount}ヶ月分の月別目標が未設定`} size="small"
                sx={{mt:0.5,bgcolor:'#fff3e0',color:'#e65100',fontSize:'0.7rem'}}/>
            )}
          </Box>
          <Box sx={{textAlign:'right'}}>
            {ytdData.rate !== null ? (
              <>
                <Typography variant="h2" fontWeight="bold" sx={{color:ytdBorderColor,lineHeight:1}}>
                  {ytdData.rate}%
                </Typography>
                <Box sx={{display:'flex',alignItems:'center',gap:0.5,justifyContent:'flex-end',mt:0.5}}>
                  {isAchieved
                    ? <CheckCircleIcon sx={{color:'#2e7d32',fontSize:'1.1rem'}}/>
                    : <WarningAmberIcon sx={{color:'#c62828',fontSize:'1.1rem'}}/>}
                  <Typography variant="caption" sx={{color:ytdBorderColor,fontWeight:'bold'}}>
                    {isAchieved?'目標達成中':'目標未達'}
                  </Typography>
                </Box>
              </>
            ) : (
              <Typography variant="h4" sx={{color:'#9e9e9e'}}>月別目標未設定</Typography>
            )}
          </Box>
        </Box>

        {ytdData.rate !== null && (
          <Box sx={{mb:2.5}}>
            <LinearProgress variant="determinate" value={Math.min(100,ytdData.rate)}
              sx={{height:20,borderRadius:10,bgcolor:'#e0e0e0',
                '& .MuiLinearProgress-bar':{
                  bgcolor:ytdData.rate>=100?'#2e7d32':ytdData.rate>=80?'#fb8c00':'#c62828',borderRadius:10}}}/>
            <Box sx={{display:'flex',justifyContent:'space-between',mt:0.5}}>
              <Typography variant="caption" color="text.secondary">0</Typography>
              <Typography variant="caption" color="text.secondary">
                累計目標 {formatPrice(ytdData.target)}
              </Typography>
            </Box>
          </Box>
        )}

        <Grid container spacing={2}>
          {[
            {label:'累計目標（月別目標の合計）',value:ytdData.target,color:'#37474f',note:ytdData.missingCount>0?'一部未設定':undefined},
            {label:'累計実績（決済済みのみ）',value:ytdData.actual,color:'#2e7d32'},
            {label:`目標との差額`,
              value:Math.abs(ytdData.gap),
              color:ytdData.gap>=0?'#2e7d32':'#c62828',
              prefix:ytdData.target>0?(ytdData.gap>=0?'▲ ':' ▼ '):undefined},
            {label:`前年同期（${ytdData.prevLabel}）`,value:ytdData.prevActual,color:'#546e7a',
              note:ytdData.yoyRatio!=null?`前年比 ${ytdData.yoyRatio}%`:undefined},
          ].map(item=>(
            <Grid item xs={6} sm={3} key={item.label}>
              <Typography variant="caption" color="text.secondary" sx={{display:'block',fontSize:'0.7rem'}}>
                {item.label}
              </Typography>
              <Typography variant="h6" fontWeight="bold"
                sx={{color:item.color,lineHeight:1.3,whiteSpace:'nowrap'}}>
                {item.prefix??''}{item.value>0?formatPrice(item.value):'-'}
              </Typography>
              {item.note && (
                <Typography variant="caption"
                  sx={{color:ytdData.yoyRatio&&ytdData.yoyRatio>=100?'#2e7d32':'#e65100',fontSize:'0.7rem'}}>
                  {item.note}
                </Typography>
              )}
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* ──────────────────────────────────────────── */}
      {/* グラフ（全員=大分店全体、個人=担当者別）      */}
      {/* ──────────────────────────────────────────── */}
      {selectedStaff==='全員' ? (<>
        <Paper sx={{p:2.5,mb:2}} elevation={1}>
          <Typography sx={{fontSize:'17px',fontWeight:'bold',color:STORE_COLOR,mb:1.5}}>
            📊 {STORE_NAME}全体 — 月別実績 vs 目標 vs 前期
          </Typography>
          <Box sx={{height:280}}>
            <Bar data={barChartData} options={chartBarOptions as any}/>
          </Box>
        </Paper>
        <Paper sx={{p:2.5,mb:2}} elevation={1}>
          <Typography sx={{fontSize:'17px',fontWeight:'bold',color:STORE_COLOR,mb:1.5}}>
            📈 {STORE_NAME}全体 — 累計推移（今期 vs 前期 vs 目標）
          </Typography>
          <Box sx={{height:260}}>
            <Line data={lineChartData} options={chartLineOptions as any}/>
          </Box>
        </Paper>
        <Paper sx={{p:2.5,mb:2}} elevation={1}>
          <Typography sx={{fontSize:'17px',fontWeight:'bold',color:'#37474f',mb:1.5}}>
            👥 担当者別 月別実績比較（今期）
          </Typography>
          <Box sx={{height:280}}>
            <Bar data={allStaffBarData} options={{
              ...chartBarOptions,
              plugins:{...chartBarOptions.plugins,
                title:{display:false}},
            } as any}/>
          </Box>
        </Paper>
      </>) : (<>
        <Paper sx={{p:2.5,mb:2}} elevation={1}>
          <Typography sx={{fontSize:'17px',fontWeight:'bold',color:PROPERTY_COLOR,mb:1.5}}>
            📊 {selectedStaff} — 月別実績 vs 目標 vs 前期
          </Typography>
          <Box sx={{height:280}}>
            <Bar data={barChartData} options={chartBarOptions as any}/>
          </Box>
        </Paper>
        <Paper sx={{p:2.5,mb:2}} elevation={1}>
          <Typography sx={{fontSize:'17px',fontWeight:'bold',color:PROPERTY_COLOR,mb:1.5}}>
            📈 {selectedStaff} — 累計推移（今期 vs 前期 vs 目標）
          </Typography>
          <Box sx={{height:260}}>
            <Line data={lineChartData} options={chartLineOptions as any}/>
          </Box>
        </Paper>
      </>)}

      {/* ──────────────────────────────────────────── */}
      {/* ② 年間見通しパネル                           */}
      {/* ──────────────────────────────────────────── */}
      <Paper sx={{p:2,mb:2,border:'1px solid #e0e0e0'}} elevation={1}>
        <Box sx={{display:'flex',alignItems:'center',mb:1.5,gap:1,flexWrap:'wrap'}}>
          <TrendingUpIcon sx={{color:PROPERTY_COLOR}}/>
          <Typography variant="subtitle1" fontWeight="bold">年間見通し（{FISCAL_YEAR}）</Typography>
          {editingAnnual===staffKey ? (
            <Box sx={{display:'flex',gap:0.5,alignItems:'center',ml:1}}>
              <TextField size="small" value={editAnnualVal} onChange={e=>setEditAnnualVal(e.target.value)}
                label="年間目標（万円単位で入力）" type="number" sx={{width:180}} inputProps={{min:0}}
                helperText="例: 2000 → 2000万円"/>
              <Button size="small" variant="contained" disabled={saving}
                onClick={()=>handleSaveAnnualTarget(staffKey,editAnnualVal)} startIcon={<SaveIcon/>}>保存</Button>
              <Button size="small" variant="outlined" color="inherit" disabled={saving}
                onClick={()=>setEditingAnnual(null)}>取消</Button>
            </Box>
          ) : (
            <Box sx={{display:'flex',alignItems:'center',gap:0.5,ml:1}}>
              <Typography variant="body2" color="text.secondary">
                年間目標：{annualSummary.annualTarget>0?formatPrice(annualSummary.annualTarget):'未設定'}
              </Typography>
              <Tooltip title="年間目標を編集">
                <IconButton size="small"
                  onClick={()=>{setEditingAnnual(staffKey);setEditAnnualVal(
                    annualSummary.annualTarget>0?(annualSummary.annualTarget/10_000).toString():'');}}>
                  <EditIcon sx={{fontSize:'0.9rem'}}/>
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
        <Grid container spacing={1.5}>
          {[
            {label:'決済済み実績',value:annualSummary.actual,sub:`${annualSummary.actualCount}件`,color:'#2e7d32'},
            {label:'売買契約済み（決済前）',value:annualSummary.contracted,sub:`${annualSummary.contractedCount}件・スプシ`,color:'#6a1b9a'},
            {label:'成約見込み（今期内）',value:annualSummary.forecast,sub:`${annualSummary.forecastCount}件・両手率${Math.round(BOTH_HAND_RATE*100)}%`,color:'#1565c0'},
            {label:'年度末着地予測',value:annualSummary.projected,sub:'実績＋契約済み＋見込み',color:'#00838f'},
          ].map(item=>(
            <Grid item xs={6} sm={3} key={item.label}>
              <Card elevation={1} sx={{border:'1px solid #e0e0e0'}}>
                <CardContent sx={{py:'8px !important',px:1.5}}>
                  <Typography variant="caption" color="text.secondary" sx={{display:'block',fontSize:'0.7rem'}}>{item.label}</Typography>
                  <Typography variant="h6" fontWeight="bold" sx={{color:item.color,lineHeight:1.3,whiteSpace:'nowrap'}}>
                    {formatPrice(item.value)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{fontSize:'0.65rem'}}>{item.sub}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        {annualSummary.annualTarget>0 && (
          <Box sx={{mt:1.5}}>
            <Box sx={{display:'flex',justifyContent:'space-between',mb:0.5}}>
              <Typography variant="caption" color="text.secondary">年度末予測達成率</Typography>
              <Typography variant="caption" fontWeight="bold"
                sx={{color:rateColor(annualSummary.projRate)}}>{annualSummary.projRate??0}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={Math.min(100,annualSummary.projRate??0)}
              sx={{height:10,borderRadius:5,bgcolor:'#e0e0e0',
                '& .MuiLinearProgress-bar':{bgcolor:rateColor(annualSummary.projRate),borderRadius:5}}}/>
          </Box>
        )}
        {contractedError && (
          <Typography variant="caption" color="error" sx={{display:'block',mt:1}}>⚠️ {contractedError}</Typography>
        )}
      </Paper>

      {/* ──────────────────────────────────────────── */}
      {/* ③ 月別集計テーブル                           */}
      {/* ──────────────────────────────────────────── */}
      <Accordion defaultExpanded elevation={1} sx={{mb:2,'&:before':{display:'none'}}}>
        <AccordionSummary expandIcon={<ExpandMoreIcon/>} sx={{bgcolor:'#f5f5f5',minHeight:44}}>
          <Box sx={{display:'flex',alignItems:'center',gap:1,flexWrap:'wrap'}}>
            <Typography variant="subtitle2" fontWeight="bold">月別売上集計</Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedStaff==='全員'?`${STORE_NAME}全体`:selectedStaff} — 月別目標は各行の✏️から設定
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{p:0}}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={TH}>月</TableCell>
                  <TableCell sx={TH}>月間目標</TableCell>
                  <TableCell sx={TH}>決済済み実績</TableCell>
                  <TableCell sx={TH}>月間達成率</TableCell>
                  <TableCell sx={TH}>累計目標</TableCell>
                  <TableCell sx={TH}>累計実績</TableCell>
                  <TableCell sx={TH}>累計達成率</TableCell>
                  <TableCell sx={TH}>前年同月</TableCell>
                  <TableCell sx={TH}>前年比</TableCell>
                  <TableCell sx={TH}>売買契約済み（決済前）</TableCell>
                  <TableCell sx={TH}>成約見込み</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthRows.map(m=>{
                  const rowBg=m.isCurrentMonth?'#fffde7':m.isFuture?'#fafafa':'inherit';
                  return (
                  <TableRow key={m.month} sx={{bgcolor:rowBg,'&:hover':{bgcolor:m.isFuture?'#f0f0f0':'#f9f9f9'}}}>
                    <TableCell sx={{...TC,fontWeight:m.isCurrentMonth?'bold':'normal',
                      borderLeft:m.month.startsWith('2027')?'3px solid #81c784':undefined,
                      color:m.isFuture?'text.secondary':'inherit'}}>
                      {formatMonth(m.month)}{m.isCurrentMonth&&<Chip label="今月" size="small"
                        sx={{ml:0.5,height:16,fontSize:'0.6rem',bgcolor:'#fff3e0',color:'#e65100'}}/>}
                    </TableCell>
                    <TableCell sx={TC}>
                      <EditableMonthCell month={m.month} sKey={staffKey} currentTarget={m.target}/>
                    </TableCell>
                    <TableCell sx={{...TC,color:m.actual>0?'#2e7d32':'text.disabled',
                      fontWeight:m.actual>0?600:'normal'}}>
                      {m.actual>0?formatPrice(m.actual):'-'}
                      {m.actualCount>0&&<Typography variant="caption" color="text.secondary"
                        sx={{display:'block',fontSize:'0.65rem'}}>{m.actualCount}件</Typography>}
                    </TableCell>
                    <TableCell sx={TC}>
                      {!m.isFuture&&m.monthRate!==null?(
                        <Chip label={`${m.monthRate}%`} size="small" sx={rateChipSx(m.monthRate)}/>
                      ):m.isFuture?<Typography variant="caption" color="text.disabled">予測対象外</Typography>
                        :<Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell sx={{...TC,color:m.cumTarget>0?'inherit':'text.disabled'}}>
                      {m.cumTarget>0?formatPrice(m.cumTarget):'-'}
                    </TableCell>
                    <TableCell sx={{...TC,color:m.cumActual>0?'#2e7d32':'text.disabled',fontWeight:m.cumActual>0?600:'normal'}}>
                      {m.cumActual>0?formatPrice(m.cumActual):'-'}
                    </TableCell>
                    <TableCell sx={TC}>
                      {!m.isFuture&&m.cumRate!==null?(
                        <Chip label={`${m.cumRate}%`} size="small" sx={rateChipSx(m.cumRate)}/>
                      ):<Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell sx={{...TC,color:'text.secondary'}}>
                      {m.prevActual>0?formatPrice(m.prevActual):'-'}
                    </TableCell>
                    <TableCell sx={TC}>
                      {m.yoy!=null?(
                        <Chip label={`${m.yoy}%`} size="small"
                          sx={{...rateChipSx(m.yoy),bgcolor:m.yoy>=100?'#e8f5e9':'#ffebee'}}/>
                      ):<Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell
                      sx={{...TC,color:m.contracted>0?'#6a1b9a':'text.disabled',
                        cursor:m.contracted>0?'pointer':'default',
                        textDecoration:m.contracted>0?'underline dotted':'none',
                        '&:hover':m.contracted>0?{opacity:0.75}:{}}}
                      onClick={()=>{
                        if(m.contracted>0){
                          const items=contracted.filter(c=>c.settlement_month===m.month);
                          openContractedModal(`${formatMonth(m.month)}の売買契約済み物件`,items);
                        }
                      }}>
                      {m.contracted>0?`${formatPrice(m.contracted)}`+
                        (m.contractedCount>0?` (${m.contractedCount}件 👆)`:''): '-'}
                    </TableCell>
                    <TableCell sx={{...TC,color:m.forecast>0?'#1565c0':'text.disabled'}}>
                      {m.forecast>0?`${formatPrice(m.forecast)}`+
                        (m.forecastCount>0?` (${m.forecastCount}件)`:''):'-'}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {/* 月別目標合計チェック */}
          {(()=>{
            const mSum=monthlyTargetSum(staffKey);
            const aTarget=annualSummary.annualTarget;
            const diff=mSum-aTarget;
            if (mSum===0) return null;
            return (
              <Box sx={{px:2,py:1,bgcolor:diff===0?'#e8f5e9':diff>0?'#fff3e0':'#fff3e0',
                borderTop:'1px solid #e0e0e0',display:'flex',gap:2,flexWrap:'wrap',alignItems:'center'}}>
                <Typography variant="caption">
                  📊 月別目標合計：<strong>{formatPrice(mSum)}</strong>
                  {aTarget>0&&<> / 年間目標：<strong>{formatPrice(aTarget)}</strong>
                    / 差額：<strong style={{color:diff===0?'#2e7d32':'#e65100'}}>
                      {diff===0?'一致':(diff>0?`+${formatPrice(diff)} 超過`:`${formatPrice(-diff)} 不足`)}
                    </strong></>}
                </Typography>
              </Box>
            );
          })()}
          <Box sx={{px:2,py:1,bgcolor:'#fafafa',borderTop:'1px solid #e0e0e0',display:'flex',gap:2,flexWrap:'wrap'}}>
            <Typography variant="caption" color="text.secondary">
              🟡 今月 ／ 未来月は予測対象外（決済済み実績なし） ／ 緑行＝次年度開始月
            </Typography>
            <Typography variant="caption" color="text.secondary">
              月別目標は各行の✏️から設定（万円単位）
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* ──────────────────────────────────────────── */}
      {/* ④ 担当者別集計（全員表示時のみ）             */}
      {/* ──────────────────────────────────────────── */}
      {selectedStaff==='全員' && (
      <Accordion defaultExpanded elevation={1} sx={{mb:2,'&:before':{display:'none'}}}>
        <AccordionSummary expandIcon={<ExpandMoreIcon/>} sx={{bgcolor:'#f5f5f5',minHeight:44}}>
          <Typography variant="subtitle2" fontWeight="bold">担当者別集計（担当者名クリックで月別詳細を展開）</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{p:0}}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['担当者','累計実績','累計目標','累計達成率','前年同期比',
                    '年間実績','年間目標（編集）','年度末予測','成約見込み（今期）👆','予測達成率'].map(h=>(
                    <TableCell key={h} sx={TH}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {staffSummaries.map(s=>(
                  <>
                  <TableRow key={s.name} sx={{'&:hover':{bgcolor:'#fafafa'},cursor:'pointer'}}
                    onClick={()=>setExpandedStaff(expandedStaff===s.name?null:s.name)}>
                    <TableCell sx={{...TC,fontWeight:'bold',color:PROPERTY_COLOR}}>
                      <Box sx={{display:'flex',alignItems:'center',gap:0.5}}>
                        {s.name}
                        <ExpandMoreIcon sx={{fontSize:'1rem',
                          transform:expandedStaff===s.name?'rotate(180deg)':'none',
                          transition:'0.2s',color:PROPERTY_COLOR}}/>
                      </Box>
                    </TableCell>
                    <TableCell sx={{...TC,color:s.ytdActual>0?'#2e7d32':'text.disabled',fontWeight:s.ytdActual>0?600:'normal'}}>
                      {s.ytdActual>0?formatPrice(s.ytdActual):'-'}
                    </TableCell>
                    <TableCell sx={TC}>
                      {s.ytdTarget>0?formatPrice(s.ytdTarget):<Typography variant="caption" color="text.disabled">目標未設定</Typography>}
                    </TableCell>
                    <TableCell sx={TC}>
                      {s.ytdRate!==null?(
                        <Chip label={`${s.ytdRate}%`} size="small" sx={rateChipSx(s.ytdRate)}/>
                      ):<Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell sx={TC}>
                      {s.yoy!=null?(
                        <Chip label={`前年比 ${s.yoy}%`} size="small"
                          sx={{bgcolor:s.yoy>=100?'#e8f5e9':'#ffebee',color:s.yoy>=100?'#2e7d32':'#c62828',fontWeight:'bold',fontSize:'0.7rem'}}/>
                      ):<Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell sx={{...TC,color:s.actual>0?'#2e7d32':'text.disabled',fontWeight:s.actual>0?600:'normal'}}>
                      {s.actual>0?formatPrice(s.actual):'-'}
                      {s.actualCount>0&&<Typography variant="caption" color="text.secondary"
                        sx={{display:'block',fontSize:'0.65rem'}}>{s.actualCount}件</Typography>}
                    </TableCell>
                    <TableCell sx={TC}>
                      {editingAnnual===s.name?(
                        <Box sx={{display:'flex',gap:0.5,alignItems:'center'}}>
                          <TextField size="small" value={editAnnualVal} onChange={e=>setEditAnnualVal(e.target.value)}
                            type="number" label="万円単位で入力" sx={{width:120}} inputProps={{min:0}} autoFocus
                            helperText="例: 2000"
                            onKeyDown={e=>e.stopPropagation()}/>
                          <IconButton size="small" color="primary" disabled={saving}
                            onClick={e=>{e.stopPropagation();handleSaveAnnualTarget(s.name,editAnnualVal);}}>
                            <SaveIcon sx={{fontSize:'1rem'}}/></IconButton>
                          <IconButton size="small" disabled={saving}
                            onClick={e=>{e.stopPropagation();setEditingAnnual(null);}}>
                            <CancelIcon sx={{fontSize:'1rem'}}/></IconButton>
                        </Box>
                      ):(
                        <Box sx={{display:'flex',alignItems:'center',gap:0.25}}>
                          <Typography variant="body2" sx={{fontSize:'0.8rem'}}>
                            {s.annualTarget>0?formatPrice(s.annualTarget):'未設定'}
                          </Typography>
                          <Tooltip title="年間目標を編集">
                            <IconButton size="small"
                              onClick={e=>{e.stopPropagation();setEditingAnnual(s.name);setEditAnnualVal(
                                s.annualTarget>0?(s.annualTarget/10_000).toString():'');}}>
                              <EditIcon sx={{fontSize:'0.8rem'}}/></IconButton></Tooltip>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell sx={{...TC,color:'#00838f',fontWeight:s.projected>0?600:'normal'}}>
                      {s.projected>0?formatPrice(s.projected):'-'}
                    </TableCell>
                    {/* 成約見込み（クリックでモーダル） */}
                    <TableCell sx={TC}>
                      <Typography
                        sx={{
                          fontSize:'15px',
                          color:s.forecast>0?'#1565c0':'text.disabled',
                          fontWeight:s.forecast>0?600:'normal',
                          cursor:s.forecast>0?'pointer':'default',
                          textDecoration:s.forecast>0?'underline dotted':'none',
                          whiteSpace:'nowrap',
                          '&:hover': s.forecast>0?{opacity:0.75}:{},
                        }}
                        onClick={()=>s.forecast>0&&openForecastModal(s.name,s.forecastItems)}
                      >
                        {s.forecast>0?formatPrice(s.forecast):'-'}
                      </Typography>
                      {s.forecastCount>0&&(
                        <Typography variant="caption" color="text.secondary"
                          sx={{display:'block',fontSize:'0.65rem',cursor:'pointer'}}
                          onClick={()=>s.forecast>0&&openForecastModal(s.name,s.forecastItems)}>
                          {s.forecastCount}件 👆
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={TC}>
                      {s.projRate!==null?(
                        <Chip label={`${s.projRate}%`} size="small" sx={rateChipSx(s.projRate)}/>
                      ):<Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                  </TableRow>

                  {/* 担当者月別詳細（展開時） */}
                  {expandedStaff===s.name && (
                  <TableRow key={`${s.name}-detail`}>
                    <TableCell colSpan={9} sx={{p:0,bgcolor:'#f8f4ff'}}>
                      <Box sx={{p:1.5}}>
                        <Typography variant="caption" fontWeight="bold" sx={{color:'#6a1b9a',display:'block',mb:1}}>
                          📅 {s.name}さんの月別詳細
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{bgcolor:'#ede7f6'}}>
                                {['月','個人月別目標','決済済み実績','月間達成率','累計目標','累計実績','累計達成率','前年同月'].map(h=>(
                                  <TableCell key={h} sx={{...TH,bgcolor:'#ede7f6',fontSize:'0.7rem'}}>{h}</TableCell>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {staffMonthRows.map(mr=>(
                                <TableRow key={mr.month}
                                  sx={{bgcolor:mr.month===CURRENT_MONTH?'#fffde7':mr.isFuture?'#fafafa':'inherit'}}>
                                  <TableCell sx={{...TC,color:mr.isFuture?'text.secondary':'inherit'}}>
                                    {formatMonth(mr.month)}
                                  </TableCell>
                                  <TableCell sx={TC}>
                                    <EditableMonthCell month={mr.month} sKey={s.name} currentTarget={mr.target}/>
                                  </TableCell>
                                  <TableCell sx={{...TC,color:mr.actual>0?'#2e7d32':'text.disabled',fontWeight:mr.actual>0?600:'normal'}}>
                                    {mr.actual>0?formatPrice(mr.actual):'-'}
                                  </TableCell>
                                  <TableCell sx={TC}>
                                    {!mr.isFuture&&mr.monthRate!==null?
                                      <Chip label={`${mr.monthRate}%`} size="small" sx={rateChipSx(mr.monthRate)}/>
                                      :<Typography variant="caption" color="text.disabled">-</Typography>}
                                  </TableCell>
                                  <TableCell sx={{...TC,color:'text.secondary'}}>
                                    {mr.cumTarget>0?formatPrice(mr.cumTarget):'-'}
                                  </TableCell>
                                  <TableCell sx={{...TC,color:mr.cumActual>0?'#2e7d32':'text.disabled',fontWeight:mr.cumActual>0?600:'normal'}}>
                                    {mr.cumActual>0?formatPrice(mr.cumActual):'-'}
                                  </TableCell>
                                  <TableCell sx={TC}>
                                    {!mr.isFuture&&mr.cumRate!==null?
                                      <Chip label={`${mr.cumRate}%`} size="small" sx={rateChipSx(mr.cumRate)}/>
                                      :<Typography variant="caption" color="text.disabled">-</Typography>}
                                  </TableCell>
                                  <TableCell sx={{...TC,color:'text.secondary'}}>
                                    {mr.prevActual>0?formatPrice(mr.prevActual):'-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        {/* 個人月別目標合計チェック */}
                        {(()=>{
                          const mSum=monthlyTargetSum(s.name);
                          const diff=mSum-s.annualTarget;
                          if (mSum===0) return null;
                          return (
                            <Box sx={{mt:1,p:1,bgcolor:diff===0?'#e8f5e9':'#fff3e0',borderRadius:1}}>
                              <Typography variant="caption">
                                月別個人目標合計：<strong>{formatPrice(mSum)}</strong>
                                {s.annualTarget>0&&<> / 年間個人目標：<strong>{formatPrice(s.annualTarget)}</strong>
                                  / <strong style={{color:diff===0?'#2e7d32':'#e65100'}}>
                                    {diff===0?'✅ 一致':`差額: ${diff>0?'+':''}${formatPrice(Math.abs(diff))}`}
                                  </strong></>}
                              </Typography>
                            </Box>
                          );
                        })()}
                      </Box>
                    </TableCell>
                  </TableRow>
                  )}
                  </>
                ))}
                {/* 大分店合計行 */}
                <TableRow sx={{bgcolor:'#e3f2fd'}}>
                  <TableCell sx={{...TC,fontWeight:'bold'}}>合計（{STORE_NAME}）</TableCell>
                  <TableCell sx={{...TC,fontWeight:'bold',color:'#2e7d32'}}>{formatPrice(ytdData.actual)}</TableCell>
                  <TableCell sx={{...TC,fontWeight:'bold'}}>{ytdData.target>0?formatPrice(ytdData.target):'未設定'}</TableCell>
                  <TableCell sx={TC}>
                    {ytdData.rate!==null?<Chip label={`${ytdData.rate}%`} size="small" sx={rateChipSx(ytdData.rate)}/>:'-'}
                  </TableCell>
                  <TableCell sx={TC}>
                    {ytdData.yoyRatio!==null?<Chip label={`前年比 ${ytdData.yoyRatio}%`} size="small"
                      sx={{bgcolor:ytdData.yoyRatio>=100?'#e8f5e9':'#ffebee',
                        color:ytdData.yoyRatio>=100?'#2e7d32':'#c62828',fontWeight:'bold',fontSize:'0.7rem'}}/>:'-'}
                  </TableCell>
                  <TableCell sx={{...TC,fontWeight:'bold',color:'#2e7d32'}}>{formatPrice(annualSummary.actual)}</TableCell>
                  <TableCell sx={{...TC,fontWeight:'bold'}}>{formatPrice(annualSummary.annualTarget||DEFAULT_STORE_TARGET)}</TableCell>
                  <TableCell sx={{...TC,fontWeight:'bold',color:'#00838f'}}>{formatPrice(annualSummary.projected)}</TableCell>
                  <TableCell sx={TC}>
                    {annualSummary.projRate!==null?<Chip label={`${annualSummary.projRate}%`} size="small" sx={rateChipSx(annualSummary.projRate)}/>:'-'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>
      )}

      {/* ──────────────────────────────────────────── */}
      {/* ⑤ 決済済み物件一覧                           */}
      {/* ──────────────────────────────────────────── */}
      {filteredSettled.length>0 && (
      <Accordion elevation={1} sx={{mb:2,'&:before':{display:'none'}}}>
        <AccordionSummary expandIcon={<ExpandMoreIcon/>} sx={{bgcolor:'#f5f5f5',minHeight:44}}>
          <Typography variant="subtitle2" fontWeight="bold">
            決済済み物件一覧（今期・{filteredSettled.length}件）
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{p:0}}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['物件番号','担当者','決済日','売上金額（税込）'].map(h=>(
                    <TableCell key={h} sx={TH}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSettled.map(p=>(
                  <TableRow key={p.property_number} sx={{'&:hover':{bgcolor:'#f5f5f5'}}}>
                    <TableCell sx={{...TC,fontWeight:500}}>{p.property_number}</TableCell>
                    <TableCell sx={TC}>{p.sales_assignee||'-'}</TableCell>
                    <TableCell sx={TC}>
                      {p.settlement_date?new Date(p.settlement_date).toLocaleDateString('ja-JP',{year:'numeric',month:'numeric',day:'numeric'}):'-'}
                    </TableCell>
                    <TableCell sx={{...TC,textAlign:'right',fontWeight:600,color:'#2e7d32'}}>
                      {formatPrice(getActualCommission(p))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>
      )}

      {/* 成約見込み物件一覧 */}
      {filteredForecast.length>0 && (
      <Accordion elevation={1} sx={{mb:2,'&:before':{display:'none'}}}>
        <AccordionSummary expandIcon={<ExpandMoreIcon/>} sx={{bgcolor:'#f5f5f5',minHeight:44}}>
          <Typography variant="subtitle2" fontWeight="bold">
            成約見込み物件（今期内・{filteredForecast.length}件）
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{p:0}}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['物件番号','担当者','ランク','決済見込み月','想定売上','確認状況'].map(h=>(
                    <TableCell key={h} sx={TH}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredForecast.sort((a,b)=>
                  (a.prospect?.settlement_expected_month??'').localeCompare(b.prospect?.settlement_expected_month??'')
                ).map(p=>{
                  const sc=calcSellerCommission(p.price,p.commission_from_seller);
                  const rev=calcExpectedRevenue(sc);
                  const rank=p.prospect?.prospect_rank;
                  const RANK_COLORS_MAP: Record<string,string>={A:'#1565c0',B:'#2e7d32',C:'#e65100',D:'#c62828'};
                  return (
                    <TableRow key={p.property_number} sx={{'&:hover':{bgcolor:'#fafafa'}}}>
                      <TableCell sx={{...TC,fontWeight:500}}>{p.property_number}</TableCell>
                      <TableCell sx={TC}>{p.sales_assignee||'-'}</TableCell>
                      <TableCell sx={TC}>
                        {rank?<Chip label={rank} size="small" sx={{bgcolor:RANK_COLORS_MAP[rank]??'#757575',color:'#fff',fontWeight:'bold',minWidth:24,height:20,fontSize:'0.75rem'}}/>:'-'}
                      </TableCell>
                      <TableCell sx={{...TC,fontWeight:500}}>
                        {p.prospect?.settlement_expected_month?formatMonth(p.prospect.settlement_expected_month):'-'}
                      </TableCell>
                      <TableCell sx={{...TC,textAlign:'right',fontWeight:600,color:'#1565c0'}}>
                        {formatPrice(rev)}
                      </TableCell>
                      <TableCell sx={TC}>
                        {p.prospect?.manager_check_status&&(
                          <Chip label={p.prospect.manager_check_status} size="small"
                            color={p.prospect.manager_check_status==='確認済み'?'success':p.prospect.manager_check_status==='要見直し'?'error':'default'}
                            sx={{fontSize:'0.7rem'}}/>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>
      )}
      </>)}

      {/* ── 売買契約済み詳細モーダル ── */}
      <Dialog open={contractedModal.open} onClose={()=>setContractedModal(m=>({...m,open:false}))} maxWidth="md" fullWidth>
        <DialogTitle sx={{fontWeight:'bold',color:'#6a1b9a',pb:1}}>
          🏠 {contractedModal.title}
        </DialogTitle>
        <DialogContent dividers sx={{p:0}}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{bgcolor:'#6a1b9a'}}>
                  {['物件番号','担当名','物件名','契約形態','決済見込み月','金額'].map(h=>(
                    <TableCell key={h} sx={{color:'#fff',fontWeight:'bold',fontSize:'14px',py:1.25,px:1.5}}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {contractedModal.items.length===0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{py:3,color:'#aaa'}}>
                    該当物件なし
                  </TableCell></TableRow>
                ) : contractedModal.items.map(c=>(
                  <TableRow key={`${c.property_number}-${c.settlement_month}`}
                    sx={{'&:hover':{bgcolor:'#f3e5f5'},cursor:'pointer'}}
                    onClick={()=>{navigate(`/property-listings/${c.property_number}`);setContractedModal(m=>({...m,open:false}));}}>
                    <TableCell sx={{fontWeight:600,fontSize:'15px',px:1.5,py:1.25}}>{c.property_number}</TableCell>
                    <TableCell sx={{fontSize:'14px',px:1.5,py:1.25}}>{c.staff||'-'}</TableCell>
                    <TableCell sx={{fontSize:'14px',px:1.5,py:1.25,maxWidth:200}}>
                      <Typography variant="body2" sx={{fontSize:'14px',wordBreak:'break-all'}}>
                        {c.property_name||'-'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{fontSize:'14px',px:1.5,py:1.25}}>
                      {c.contract_type?(
                        <Chip label={c.contract_type} size="small"
                          sx={{bgcolor:'#ede7f6',color:'#6a1b9a',fontWeight:'bold',fontSize:'13px'}}/>
                      ):'-'}
                    </TableCell>
                    <TableCell sx={{fontSize:'14px',px:1.5,py:1.25,whiteSpace:'nowrap',fontWeight:500}}>
                      {c.settlement_month?formatMonth(c.settlement_month):'-'}
                      {c.settlement_date&&<Typography variant="caption" color="text.secondary"
                        sx={{display:'block',fontSize:'12px'}}>({c.settlement_date}確定)</Typography>}
                    </TableCell>
                    <TableCell sx={{fontSize:'14px',px:1.5,py:1.25,textAlign:'right',fontWeight:'bold',color:'#6a1b9a',whiteSpace:'nowrap'}}>
                      {formatPrice(c.commission)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{px:2,py:1}}>
          <Typography variant="caption" color="text.secondary" sx={{flex:1}}>
            ※ 行クリックで物件詳細ページへ
          </Typography>
          <Button onClick={()=>setContractedModal(m=>({...m,open:false}))}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* ── 成約見込み詳細モーダル ── */}
      <Dialog open={forecastModal.open} onClose={()=>setForecastModal(m=>({...m,open:false}))} maxWidth="md" fullWidth>
        <DialogTitle sx={{fontWeight:'bold',color:'#1565c0',pb:1}}>
          📋 {forecastModal.staffName} — 成約見込み物件一覧（今期）
          <Typography variant="caption" color="text.secondary" sx={{display:'block',mt:0.25}}>
            今期（〜2027年9月）の成約見込み物件。クリックで物件詳細ページへ。
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{p:0}}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{bgcolor:'#1565c0'}}>
                  {['物件番号','物件住所','売主氏名','価格','ランク','決済見込み月','想定売上'].map(h=>(
                    <TableCell key={h} sx={{color:'#fff',fontWeight:'bold',fontSize:'14px',py:1.25,px:1.5}}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {forecastModal.items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{py:3,color:'#aaa'}}>
                    対象物件なし（今期の決済見込み月が未入力の可能性があります）
                  </TableCell></TableRow>
                ) : (
                  forecastModal.items
                    .sort((a,b)=>(a.prospect?.settlement_expected_month??'').localeCompare(b.prospect?.settlement_expected_month??''))
                    .map(p=>{
                      const sc=calcSellerCommission(p.price,p.commission_from_seller);
                      const rev=calcExpectedRevenue(sc);
                      const rank=p.prospect?.prospect_rank;
                      const RANK_COLORS_MAP: Record<string,string>={A:'#1565c0',B:'#2e7d32',C:'#e65100',D:'#c62828'};
                      return (
                        <TableRow key={p.property_number}
                          sx={{'&:hover':{bgcolor:'#e3f2fd'},cursor:'pointer'}}
                          onClick={()=>{navigate(`/property-listings/${p.property_number}`);setForecastModal(m=>({...m,open:false}));}}>
                          <TableCell sx={{fontWeight:600,fontSize:'15px',px:1.5,py:1.25}}>{p.property_number}</TableCell>
                          <TableCell sx={{fontSize:'14px',px:1.5,py:1.25,maxWidth:180}}>
                            <Typography variant="body2" sx={{wordBreak:'break-all',lineHeight:1.3,fontSize:'14px'}}>
                              {p.display_address||p.address||'-'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{fontSize:'14px',px:1.5,py:1.25}}>{(p as any).seller_name||'-'}</TableCell>
                          <TableCell sx={{fontSize:'14px',px:1.5,py:1.25,whiteSpace:'nowrap',textAlign:'right'}}>
                            {p.price?formatPrice(p.price):'-'}
                          </TableCell>
                          <TableCell sx={{px:1.5,py:1.25}}>
                            {rank?<Chip label={rank} size="small" sx={{bgcolor:RANK_COLORS_MAP[rank]??'#757575',color:'#fff',fontWeight:'bold',minWidth:28,fontSize:'13px'}}/>:'-'}
                          </TableCell>
                          <TableCell sx={{fontSize:'14px',px:1.5,py:1.25,whiteSpace:'nowrap',fontWeight:500}}>
                            {p.prospect?.settlement_expected_month?formatMonth(p.prospect.settlement_expected_month):'-'}
                          </TableCell>
                          <TableCell sx={{fontSize:'14px',px:1.5,py:1.25,textAlign:'right',fontWeight:'bold',color:'#1565c0',whiteSpace:'nowrap'}}>
                            {formatPrice(rev)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{px:2,py:1}}>
          <Typography variant="caption" color="text.secondary" sx={{flex:1}}>
            ⚠️ 2027年10月以降の決済見込み月・未入力の物件は今期集計に含まれません
          </Typography>
          <Button onClick={()=>setForecastModal(m=>({...m,open:false}))}>閉じる</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={()=>setSnackbar(s=>({...s,open:false}))}
        anchorOrigin={{vertical:'bottom',horizontal:'center'}}>
        <Alert severity={snackbar.severity} onClose={()=>setSnackbar(s=>({...s,open:false}))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
