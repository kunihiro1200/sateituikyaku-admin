/**
 * 担当者別実績ページ
 * - 月別実績 vs 目標 vs 前期実績 棒グラフ
 * - 累計推移ラインチャート
 * - 全員ビューでは担当者比較棒グラフ
 * - 詳細テーブル付き
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Box, Typography, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, IconButton, Chip, Card, CardContent,
  Grid, LinearProgress, CircularProgress,
  Snackbar, Alert, Tooltip, Accordion, AccordionSummary, AccordionDetails,
  TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip as ChartTooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { supabase } from '../config/supabase';
import PageNavigation from '../components/PageNavigation';
import { useAuthStore } from '../store/authStore';
import { SECTION_COLORS } from '../theme/sectionColors';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, ChartTooltip, Legend, Filler
);

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
const PREV_FY_END_DATE = '2026-09-30';
const BOTH_HAND_RATE = 0.65;
const PROPERTY_COLOR = SECTION_COLORS.property.main;

const _now = new Date();
const CURRENT_MONTH = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}`;
const YTD_MONTHS = FY_MONTHS.filter(m => m <= CURRENT_MONTH);
const PREV_YTD_MONTHS = YTD_MONTHS.map(m => { const [y,mo]=m.split('-'); return `${+y-1}-${mo}`; });

const STAFF_BUTTONS = ['全員','山本','角井','林田','麻生','裏','国広'] as const;
const STAFF_LIST = ['山本','角井','林田','麻生','裏','国広'];
const STAFF_PATTERNS: Record<string,string[]> = {
  山本:['山本','山','Y'], 角井:['角井','I'], 林田:['林','林田'],
  麻生:['麻生','麻'], 裏:['裏','U'], 国広:['K','国広'],
};

// 担当者ごとのグラフカラー
const STAFF_COLORS: Record<string,string> = {
  山本:'#e53935', 角井:'#1e88e5', 林田:'#43a047',
  麻生:'#fb8c00', 裏:'#8e24aa', 国広:'#00acc1',
};

// ============================================================
// 型定義
// ============================================================
interface SettledItem {
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
}
interface ProspectRecord {
  property_number: string;
  prospect_rank?: string|null;
  settlement_expected_month?: string|null;
}
interface ActiveListingWithProspect extends ActiveListing { prospect?: ProspectRecord; }
interface AnnualTarget { fiscal_year:string; store_name:string; staff_name:string; target_amount:number; }
interface MonthlyTarget { fiscal_year:string; month:string; store_name:string; staff_name:string; target_amount:number; }

// ============================================================
// ユーティリティ
// ============================================================
function shiftMonthByYear(m: string, y: number) { const [yr,mo]=m.split('-'); return `${+yr+y}-${mo}`; }
function matchesStaff(a: string|null|undefined, s: string) {
  if (s==='全員') return true;
  if (!a) return false;
  return (STAFF_PATTERNS[s]??[]).some(p=>a.includes(p));
}
function calcSellerCommission(p?: number|null, c?: number|null) {
  if (c&&c>0) return c;
  if (!p||p<=0) return 0;
  if (p>=8_000_000) return Math.round((p*0.03+60_000)*1.1);
  return 330_000;
}
function calcExpectedRevenue(sc: number) { return Math.round(sc*(BOTH_HAND_RATE*2+(1-BOTH_HAND_RATE))); }
function getActualCommission(p: SettledItem) {
  if (p.total_commission&&p.total_commission>0) return p.total_commission;
  const s=p.commission_from_seller??0, b=p.commission_from_buyer??0;
  if (s+b>0) return s+b;
  return calcExpectedRevenue(calcSellerCommission(p.price));
}
function getSettlementMonth(d: string) { return d.substring(0,7); }
function toMan(yen: number) { return yen/10_000; }
function formatPrice(yen: number) {
  if (yen<=0) return '-';
  const m=yen/10_000;
  return `${m%1===0?m.toFixed(0):m.toFixed(1)}万円`;
}
function formatMonth(yyyymm: string) { const [y,m]=yyyymm.split('-'); return `${y}年${parseInt(m)}月`; }
function rateColor(r: number|null) {
  if (r===null) return '#9e9e9e';
  if (r>=100) return '#2e7d32';
  if (r>=80) return '#fb8c00';
  return '#c62828';
}
function rateChipSx(r: number|null) {
  const c=rateColor(r);
  const bg=r===null?'#f5f5f5':r>=100?'#e8f5e9':r>=80?'#fff3e0':'#ffebee';
  return {bgcolor:bg,color:c,fontWeight:'bold',fontSize:'0.85rem'};
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function StaffPerformancePage() {
  const navigate = useNavigate();
  const { employee } = useAuthStore();

  const [settled, setSettled] = useState<SettledItem[]>([]);
  const [prevYearSettled, setPrevYearSettled] = useState<SettledItem[]>([]);
  const [listings, setListings] = useState<ActiveListing[]>([]);
  const [prospects, setProspects] = useState<ProspectRecord[]>([]);
  const [annualTargets, setAnnualTargets] = useState<AnnualTarget[]>([]);
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedStaff, setSelectedStaff] = useState<string>('全員');
  const [editingMonth, setEditingMonth] = useState<{month:string;staffName:string}|null>(null);
  const [editMonthVal, setEditMonthVal] = useState('');
  const [editingAnnual, setEditingAnnual] = useState<string|null>(null);
  const [editAnnualVal, setEditAnnualVal] = useState('');
  const [saving, setSaving] = useState(false);

  const [snackbar, setSnackbar] = useState<{open:boolean;message:string;severity:'success'|'error'}>
    ({open:false,message:'',severity:'success'});

  // ── データ取得 ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sR,pR,lR,prR,atR,mtR] = await Promise.all([
        supabase.from('property_listings')
          .select('property_number,sales_assignee,settlement_date,total_commission,commission_from_seller,commission_from_buyer,price')
          .not('property_number','ilike','%FI%').not('settlement_date','is',null)
          .gte('settlement_date',FY_START_DATE).lte('settlement_date',FY_END_DATE),
        supabase.from('property_listings')
          .select('property_number,sales_assignee,settlement_date,total_commission,commission_from_seller,commission_from_buyer,price')
          .not('property_number','ilike','%FI%').not('settlement_date','is',null)
          .gte('settlement_date',PREV_FY_START_DATE).lte('settlement_date',PREV_FY_END_DATE),
        supabase.from('property_listings')
          .select('property_number,sales_assignee,price,commission_from_seller')
          .eq('atbb_status','専任・公開中').not('property_number','ilike','%FI%'),
        supabase.from('property_contract_prospects')
          .select('property_number,prospect_rank,settlement_expected_month')
          .not('settlement_expected_month','is',null)
          .gte('settlement_expected_month',FY_START_MONTH).lte('settlement_expected_month',FY_END_MONTH),
        supabase.from('sales_targets').select('*').eq('fiscal_year',FISCAL_YEAR).eq('store_name','大分店'),
        supabase.from('monthly_sales_targets').select('*').eq('fiscal_year',FISCAL_YEAR).eq('store_name','大分店'),
      ]);
      setSettled(sR.data??[]);
      setPrevYearSettled(pR.data??[]);
      setListings(lR.data??[]);
      setProspects(prR.data??[]);
      setAnnualTargets(atR.data??[]);
      setMonthlyTargets(mtR.data??[]);
    } catch(err) {
      setSnackbar({open:true,message:'データ取得失敗',severity:'error'});
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{fetchData();},[fetchData]);

  // ── ヘルパー ──
  const getAnnualTarget = useCallback((s:string)=>
    annualTargets.find(t=>t.staff_name===s)?.target_amount??0,[annualTargets]);
  const getMonthTarget = useCallback((m:string,s:string)=>
    monthlyTargets.find(t=>t.month===m&&t.staff_name===s)?.target_amount??0,[monthlyTargets]);
  const monthlyTargetSum = useCallback((s:string)=>
    FY_MONTHS.reduce((a,m)=>a+getMonthTarget(m,s),0),[getMonthTarget]);

  // ── フィルタ済みデータ ──
  const staffKey = selectedStaff==='全員'?'':selectedStaff;
  const filteredSettled = useMemo(()=>
    selectedStaff==='全員'?settled:settled.filter(p=>matchesStaff(p.sales_assignee,selectedStaff)),[settled,selectedStaff]);
  const filteredPrev = useMemo(()=>
    selectedStaff==='全員'?prevYearSettled:prevYearSettled.filter(p=>matchesStaff(p.sales_assignee,selectedStaff)),[prevYearSettled,selectedStaff]);
  const forecastItems = useMemo(():ActiveListingWithProspect[]=>{
    const pm=new Map(prospects.map(p=>[p.property_number,p]));
    return listings.map(l=>({...l,prospect:pm.get(l.property_number)})).filter(l=>l.prospect?.settlement_expected_month);
  },[listings,prospects]);
  const filteredForecast = useMemo(()=>
    selectedStaff==='全員'?forecastItems:forecastItems.filter(p=>matchesStaff(p.sales_assignee,selectedStaff)),[forecastItems,selectedStaff]);

  // ── 月別データ（12ヶ月） ──
  const monthRows = useMemo(()=>{
    let cumT=0,cumA=0,prevCumA=0;
    return FY_MONTHS.map(month=>{
      const isFuture=month>CURRENT_MONTH;
      const prevM=shiftMonthByYear(month,-1);
      const actual=filteredSettled.filter(p=>p.settlement_date&&getSettlementMonth(p.settlement_date)===month)
        .reduce((s,p)=>s+getActualCommission(p),0);
      const prevActual=filteredPrev.filter(p=>p.settlement_date&&getSettlementMonth(p.settlement_date)===prevM)
        .reduce((s,p)=>s+getActualCommission(p),0);
      const forecast=filteredForecast.filter(p=>p.prospect?.settlement_expected_month===month)
        .reduce((s,p)=>{ const sc=calcSellerCommission(p.price,p.commission_from_seller); return s+calcExpectedRevenue(sc); },0);
      const target=getMonthTarget(month,staffKey);
      if (!isFuture){cumT+=target;cumA+=actual;}
      prevCumA+=prevActual;
      return {month,target,actual,prevActual,forecast,isFuture,isCurrentMonth:month===CURRENT_MONTH,
        cumTarget:cumT,cumActual:cumA,prevCumActual:prevCumA,
        monthRate:target>0&&!isFuture?Math.round(actual/target*100):null,
        cumRate:cumT>0?Math.round(cumA/cumT*100):null};
    });
  },[filteredSettled,filteredPrev,filteredForecast,monthlyTargets,staffKey]);

  // ── YTD集計 ──
  const ytdData = useMemo(()=>{
    const rows=monthRows.filter(m=>YTD_MONTHS.includes(m.month));
    const actual=rows.reduce((s,m)=>s+m.actual,0);
    const target=rows.reduce((s,m)=>s+m.target,0);
    const rate=target>0?Math.round(actual/target*100):null;
    const prevActual=PREV_YTD_MONTHS.reduce((s,pm)=>
      s+filteredPrev.filter(p=>p.settlement_date&&getSettlementMonth(p.settlement_date)===pm)
        .reduce((ss,p)=>ss+getActualCommission(p),0),0);
    const yoy=prevActual>0?Math.round(actual/prevActual*100):null;
    const annualT=getAnnualTarget(staffKey);
    const label=YTD_MONTHS.length===1?formatMonth(YTD_MONTHS[0])
      :`${formatMonth(YTD_MONTHS[0])}〜${formatMonth(YTD_MONTHS[YTD_MONTHS.length-1])}`;
    const prevLabel=PREV_YTD_MONTHS.length===1?formatMonth(PREV_YTD_MONTHS[0])
      :`${formatMonth(PREV_YTD_MONTHS[0])}〜${formatMonth(PREV_YTD_MONTHS[PREV_YTD_MONTHS.length-1])}`;
    return {label,prevLabel,actual,target,rate,gap:actual-target,prevActual,yoy,annualTarget:annualT};
  },[monthRows,filteredPrev,annualTargets,staffKey]);

  // ── 担当者比較データ（全員モード用） ──
  const staffCompareData = useMemo(()=>{
    return STAFF_LIST.map(name=>{
      const pats=STAFF_PATTERNS[name]??[];
      const monthData=FY_MONTHS.map(month=>{
        const isFuture=month>CURRENT_MONTH;
        const actual=settled.filter(p=>pats.some(pat=>(p.sales_assignee??'').includes(pat))&&
          p.settlement_date&&getSettlementMonth(p.settlement_date)===month)
          .reduce((s,p)=>s+getActualCommission(p),0);
        const prevM=shiftMonthByYear(month,-1);
        const prev=prevYearSettled.filter(p=>pats.some(pat=>(p.sales_assignee??'').includes(pat))&&
          p.settlement_date&&getSettlementMonth(p.settlement_date)===prevM)
          .reduce((s,p)=>s+getActualCommission(p),0);
        const target=getMonthTarget(month,name);
        return {month,actual,prev,target,isFuture};
      });
      const ytdActual=monthData.filter(m=>YTD_MONTHS.includes(m.month)).reduce((s,m)=>s+m.actual,0);
      const ytdTarget=monthData.filter(m=>YTD_MONTHS.includes(m.month)).reduce((s,m)=>s+m.target,0);
      const annualTarget=getAnnualTarget(name);
      const ytdRate=ytdTarget>0?Math.round(ytdActual/ytdTarget*100):null;
      const prevYtd=PREV_YTD_MONTHS.reduce((s,pm)=>
        s+prevYearSettled.filter(p=>pats.some(pat=>(p.sales_assignee??'').includes(pat))&&
          p.settlement_date&&getSettlementMonth(p.settlement_date)===pm)
          .reduce((ss,p)=>ss+getActualCommission(p),0),0);
      const yoy=prevYtd>0?Math.round(ytdActual/prevYtd*100):null;
      return {name,monthData,ytdActual,ytdTarget,ytdRate,annualTarget,prevYtd,yoy};
    });
  },[settled,prevYearSettled,monthlyTargets,annualTargets]);

  // ── グラフデータ（個人モード） ──
  const monthLabels = FY_MONTHS.map(m=>{const [,mo]=m.split('-');return `${parseInt(mo)}月`;});

  const barChartData = useMemo(()=>({
    labels: monthLabels,
    datasets:[
      {
        label:'今期実績（決済済み）',
        data:monthRows.map(m=>parseFloat(toMan(m.actual).toFixed(1))),
        backgroundColor:monthRows.map(m=>m.isCurrentMonth?'#1b5e20':m.isFuture?'#e0e0e0':'#43a047'),
        borderColor:'#2e7d32', borderWidth:1, borderRadius:4,
      },
      {
        label:'今期目標',
        data:monthRows.map(m=>parseFloat(toMan(m.target).toFixed(1))),
        type:'line' as const,
        borderColor:'#1565c0', backgroundColor:'transparent',
        borderWidth:2, borderDash:[6,3], pointRadius:5, pointBackgroundColor:'#1565c0',
        tension:0.2,
      },
      {
        label:'前期実績',
        data:monthRows.map(m=>parseFloat(toMan(m.prevActual).toFixed(1))),
        backgroundColor:'rgba(158,158,158,0.6)',
        borderColor:'#757575', borderWidth:1, borderRadius:4,
      },
    ],
  }),[monthRows]);

  const barChartOptions = useMemo(()=>({
    responsive:true,
    plugins:{
      legend:{position:'top' as const,labels:{font:{size:14},padding:16}},
      title:{display:false},
      tooltip:{callbacks:{label:(ctx:any)=>`${ctx.dataset.label}: ${ctx.parsed.y}万円`}},
    },
    scales:{
      x:{ticks:{font:{size:13}},grid:{display:false}},
      y:{beginAtZero:true,ticks:{callback:(v:any)=>`${v}万`,font:{size:13}},
        title:{display:true,text:'万円',font:{size:13}}},
    },
  }),[]);

  const lineChartData = useMemo(()=>({
    labels: monthLabels,
    datasets:[
      {
        label:'今期 累計実績',
        data:monthRows.map(m=>parseFloat(toMan(m.cumActual).toFixed(1))),
        borderColor:'#2e7d32', backgroundColor:'rgba(46,125,50,0.1)',
        fill:true, tension:0.3, pointRadius:5, borderWidth:2.5,
      },
      {
        label:'今期 累計目標',
        data:monthRows.map(m=>parseFloat(toMan(m.cumTarget).toFixed(1))),
        borderColor:'#1565c0', backgroundColor:'transparent',
        borderDash:[6,3], tension:0.2, pointRadius:5, borderWidth:2,
      },
      {
        label:'前期 累計実績',
        data:monthRows.map(m=>parseFloat(toMan(m.prevCumActual).toFixed(1))),
        borderColor:'#9e9e9e', backgroundColor:'transparent',
        tension:0.3, pointRadius:4, borderWidth:1.5,
      },
    ],
  }),[monthRows]);

  const lineChartOptions = useMemo(()=>({
    responsive:true,
    plugins:{
      legend:{position:'top' as const,labels:{font:{size:14},padding:16}},
      tooltip:{callbacks:{label:(ctx:any)=>`${ctx.dataset.label}: ${ctx.parsed.y}万円`}},
    },
    scales:{
      x:{ticks:{font:{size:13}},grid:{color:'rgba(0,0,0,0.05)'}},
      y:{beginAtZero:true,ticks:{callback:(v:any)=>`${v}万`,font:{size:13}},
        title:{display:true,text:'万円（累計）',font:{size:13}}},
    },
  }),[]);

  // ── 担当者比較グラフ（全員モード） ──
  const allStaffBarData = useMemo(()=>({
    labels: monthLabels,
    datasets: STAFF_LIST.map(name=>({
      label: name,
      data: staffCompareData.find(s=>s.name===name)?.monthData
        .map(m=>parseFloat(toMan(m.actual).toFixed(1)))??[],
      backgroundColor: STAFF_COLORS[name]+'cc',
      borderColor: STAFF_COLORS[name],
      borderWidth:1, borderRadius:3,
    })),
  }),[staffCompareData]);

  const allStaffBarOptions = useMemo(()=>({
    responsive:true,
    plugins:{
      legend:{position:'top' as const,labels:{font:{size:14},padding:12}},
      title:{display:true,text:'担当者別 月別実績（今期）',font:{size:15}},
      tooltip:{callbacks:{label:(ctx:any)=>`${ctx.dataset.label}: ${ctx.parsed.y}万円`}},
    },
    scales:{
      x:{ticks:{font:{size:13}},stacked:false},
      y:{beginAtZero:true,ticks:{callback:(v:any)=>`${v}万`,font:{size:13}}},
    },
  }),[]);

  // ── 目標保存 ──
  const handleSaveMonthTarget = async (month:string,sKey:string,val:string)=>{
    if (!employee) return;
    setSaving(true);
    try {
      const man=parseFloat(val);
      if (isNaN(man)||man<0) throw new Error('正の数値を入力してください');
      const amount=Math.round(man*10_000);
      const row={fiscal_year:FISCAL_YEAR,month,store_name:'大分店',staff_name:sKey,target_amount:amount};
      const {error}=await supabase.from('monthly_sales_targets')
        .upsert(row,{onConflict:'fiscal_year,month,store_name,staff_name'});
      if (error) throw error;
      setMonthlyTargets(prev=>[...prev.filter(t=>!(t.month===month&&t.staff_name===sKey)),row]);
      setEditingMonth(null);
      setSnackbar({open:true,message:'月別目標を保存しました',severity:'success'});
    } catch(err:any){setSnackbar({open:true,message:err.message??'保存失敗',severity:'error'});}
    finally{setSaving(false);}
  };

  const handleSaveAnnualTarget = async (sKey:string,val:string)=>{
    if (!employee) return;
    setSaving(true);
    try {
      const man=parseFloat(val);
      if (isNaN(man)||man<0) throw new Error('正の数値を入力してください');
      const amount=Math.round(man*10_000);
      const row={fiscal_year:FISCAL_YEAR,store_name:'大分店',staff_name:sKey,target_amount:amount};
      const {error}=await supabase.from('sales_targets')
        .upsert(row,{onConflict:'fiscal_year,store_name,staff_name'});
      if (error) throw error;
      setAnnualTargets(prev=>[...prev.filter(t=>t.staff_name!==sKey),row]);

      // ── 月別目標が未設定の場合は年間目標を12ヶ月に均等自動配分 ──
      const existing = monthlyTargets.filter(t=>t.staff_name===sKey&&t.fiscal_year===FISCAL_YEAR);
      if (existing.length===0 && sKey!=='') {
        // 12で割り切れない端数は最終月（9月）に加算
        const base = Math.floor(amount/12);
        const remainder = amount - base*12;
        const monthlyRows = FY_MONTHS.map((month,i)=>({
          fiscal_year:FISCAL_YEAR, month, store_name:'大分店', staff_name:sKey,
          target_amount: i===11 ? base+remainder : base,
        }));
        const {error:me}=await supabase.from('monthly_sales_targets')
          .upsert(monthlyRows,{onConflict:'fiscal_year,month,store_name,staff_name'});
        if (!me) {
          setMonthlyTargets(prev=>[...prev.filter(t=>t.staff_name!==sKey),...monthlyRows]);
        }
        setSnackbar({open:true,message:`年間目標を保存し、月別目標を12ヶ月に自動配分しました（${Math.floor(man/12).toFixed(1)}万円/月）`,severity:'success'});
      } else {
        setSnackbar({open:true,message:'年間目標を保存しました（月別目標は既存の設定を維持）',severity:'success'});
      }

      setEditingAnnual(null);
    } catch(err:any){setSnackbar({open:true,message:err.message??'保存失敗',severity:'error'});}
    finally{setSaving(false);}
  };

  const isAchieved = ytdData.rate!==null&&ytdData.rate>=100;
  const borderColor = ytdData.rate===null?'#1565c0':isAchieved?'#2e7d32':'#c62828';

  const TH = {fontWeight:'bold',fontSize:'15px',bgcolor:'#1565c0',color:'#fff',py:1.25,px:1.5,whiteSpace:'nowrap' as const};
  const TD = {fontSize:'15px',py:1.25,px:1.5};

  return (
    <Container maxWidth="xl" sx={{py:3}}>
      {/* ヘッダー */}
      <Box sx={{display:'flex',alignItems:'center',mb:2,gap:1,flexWrap:'wrap'}}>
        <IconButton onClick={()=>navigate('/property-listings/sales-dashboard')} size="small">
          <ArrowBackIcon/>
        </IconButton>
        <AssessmentIcon sx={{color:PROPERTY_COLOR,fontSize:'1.6rem'}}/>
        <Typography variant="h5" fontWeight="bold" sx={{color:PROPERTY_COLOR,fontSize:'22px'}}>
          担当者別 売上実績・グラフ
        </Typography>
        <Chip label={`大分店 ${FISCAL_YEAR.replace('-','〜')}年度`} size="small"
          sx={{bgcolor:'#e3f2fd',color:'#1565c0',fontSize:'13px'}}/>
        <Box sx={{ml:'auto',display:'flex',gap:1}}>
          <Button variant="outlined" size="small" onClick={()=>navigate('/property-listings/sales-dashboard')}
            sx={{fontSize:'13px',borderColor:PROPERTY_COLOR,color:PROPERTY_COLOR}}>
            ← 売上目標管理
          </Button>
          <Tooltip title="再読み込み">
            <IconButton size="small" onClick={fetchData} disabled={loading}><RefreshIcon/></IconButton>
          </Tooltip>
        </Box>
      </Box>

      <PageNavigation/>

      {/* 担当者切替 */}
      <Box sx={{display:'flex',gap:1,flexWrap:'wrap',mt:2,mb:2.5}}>
        {STAFF_BUTTONS.map(s=>{
          const isSelected = selectedStaff===s;
          const selectedSx = {bgcolor:PROPERTY_COLOR,'&:hover':{bgcolor:SECTION_COLORS.property.dark}};
          const unselectedSx = {borderColor:PROPERTY_COLOR,color:PROPERTY_COLOR,'&:hover':{bgcolor:'#e3f2fd'}};
          return (
            <Button key={s} variant={isSelected?'contained':'outlined'} size="medium"
              onClick={()=>setSelectedStaff(s)}
              sx={{fontSize:'15px',fontWeight:'bold',minWidth:72,...(isSelected?selectedSx:unselectedSx)}}>
              {s}
            </Button>
          );
        })}
      </Box>

      {loading ? (
        <Box sx={{display:'flex',justifyContent:'center',py:10}}><CircularProgress/></Box>
      ) : (<>

      {/* ① YTD 達成率カード */}
      <Paper sx={{p:3,mb:3,border:`3px solid ${borderColor}`,borderRadius:2}} elevation={3}>
        <Box sx={{display:'grid',gridTemplateColumns:'auto 1fr',gap:3,alignItems:'start',flexWrap:'wrap'}}>
          {/* 達成率大きく */}
          <Box sx={{textAlign:'center',p:3,bgcolor:isAchieved?'#e8f5e9':'#ffebee',
            borderRadius:2,border:`2px solid ${borderColor}`,minWidth:180}}>
            <Typography sx={{fontSize:'13px',color:'#666',mb:0.5}}>
              {selectedStaff==='全員'?'大分店全体 ':selectedStaff}累計達成率
            </Typography>
            <Typography sx={{fontSize:ytdData.rate!==null?'56px':'28px',
              fontWeight:900,color:borderColor,lineHeight:1}}>
              {ytdData.rate!==null?`${ytdData.rate}%`:'未設定'}
            </Typography>
            <Box sx={{display:'flex',alignItems:'center',justifyContent:'center',gap:0.5,mt:0.75}}>
              {ytdData.rate!==null&&(isAchieved
                ?<CheckCircleIcon sx={{color:'#2e7d32',fontSize:'1.1rem'}}/>
                :<WarningAmberIcon sx={{color:'#c62828',fontSize:'1.1rem'}}/>)}
              <Typography sx={{fontSize:'14px',color:borderColor,fontWeight:'bold'}}>
                {ytdData.label}
              </Typography>
            </Box>
          </Box>

          {/* 数値詳細 */}
          <Box>
            {ytdData.rate!==null&&(
              <Box sx={{mb:2}}>
                <LinearProgress variant="determinate" value={Math.min(100,ytdData.rate)}
                  sx={{height:22,borderRadius:11,bgcolor:'#e0e0e0',
                    '& .MuiLinearProgress-bar':{bgcolor:rateColor(ytdData.rate),borderRadius:11}}}/>
                <Box sx={{display:'flex',justifyContent:'space-between',mt:0.5}}>
                  <Typography sx={{fontSize:'13px',color:'#888'}}>0</Typography>
                  <Typography sx={{fontSize:'13px',color:'#888'}}>
                    累計目標 {formatPrice(ytdData.target)}
                  </Typography>
                </Box>
              </Box>
            )}
            <Grid container spacing={1.5}>
              {[
                {label:'累計目標',value:ytdData.target>0?formatPrice(ytdData.target):'未設定',color:'#37474f'},
                {label:'累計実績（決済済み）',value:formatPrice(ytdData.actual),color:'#2e7d32'},
                {label:'差額',value:ytdData.target>0?(ytdData.gap>=0?`▲${formatPrice(ytdData.gap)}`:`▼${formatPrice(-ytdData.gap)}`):'—',
                  color:ytdData.gap>=0?'#2e7d32':'#c62828'},
                {label:`前年同期（${ytdData.prevLabel}）`,
                  value:ytdData.prevActual>0?formatPrice(ytdData.prevActual):'実績なし',
                  color:'#546e7a',note:ytdData.yoy!=null
                    ?`前年比 ${ytdData.yoy}%（${ytdData.yoy>=100?`▲${formatPrice(ytdData.actual-ytdData.prevActual)}`:`▼${formatPrice(ytdData.prevActual-ytdData.actual)}`}）`
                    :undefined},
              ].map(item=>(
                <Grid item xs={6} sm={3} key={item.label}>
                  <Box sx={{p:1.5,bgcolor:'#f8f9fa',borderRadius:1.5,height:'100%'}}>
                    <Typography sx={{fontSize:'13px',color:'#666',mb:0.25}}>{item.label}</Typography>
                    <Typography sx={{fontSize:'22px',fontWeight:'bold',color:item.color,lineHeight:1.2}}>
                      {item.value}
                    </Typography>
                    {item.note&&<Typography sx={{fontSize:'13px',color:ytdData.yoy&&ytdData.yoy>=100?'#2e7d32':'#e65100',mt:0.5}}>
                      {item.note}
                    </Typography>}
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Box>
      </Paper>

      {selectedStaff==='全員' ? (<>
        {/* 全員：大分店全体 月別実績 vs 目標 vs 前期 */}
        <Paper sx={{p:2.5,mb:3}} elevation={1}>
          <Typography sx={{fontSize:'18px',fontWeight:'bold',color:PROPERTY_COLOR,mb:2}}>
            📊 大分店全体 — 月別実績 vs 目標 vs 前期
          </Typography>
          <Box sx={{height:320}}>
            <Bar data={barChartData} options={{...barChartOptions,maintainAspectRatio:false} as any}/>
          </Box>
        </Paper>

        {/* 全員：大分店全体 累計推移 */}
        <Paper sx={{p:2.5,mb:3}} elevation={1}>
          <Typography sx={{fontSize:'18px',fontWeight:'bold',color:PROPERTY_COLOR,mb:2}}>
            📈 大分店全体 — 累計推移（今期 vs 前期 vs 目標）
          </Typography>
          <Box sx={{height:300}}>
            <Line data={lineChartData} options={{...lineChartOptions,maintainAspectRatio:false} as any}/>
          </Box>
        </Paper>

        {/* 全員：担当者比較棒グラフ */}
        <Paper sx={{p:2.5,mb:3}} elevation={1}>
          <Typography sx={{fontSize:'18px',fontWeight:'bold',color:'#1565c0',mb:2}}>
            📊 担当者別 月別実績比較（今期）
          </Typography>
          <Box sx={{height:320}}>
            <Bar data={allStaffBarData} options={{...allStaffBarOptions,maintainAspectRatio:false} as any}/>
          </Box>
        </Paper>

        {/* 全員：担当者別 YTD サマリーテーブル */}
        <Paper sx={{p:2.5,mb:3}} elevation={1}>
          <Typography sx={{fontSize:'18px',fontWeight:'bold',color:'#1565c0',mb:2}}>
            👥 担当者別 累計達成状況
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {['担当者','年間目標（万円単位で編集）','累計目標','累計実績','累計達成率 + 進捗','前年同期比','差額'].map(h=>(
                    <TableCell key={h} sx={{...TH,whiteSpace:'pre-line'}}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {staffCompareData.map(s=>(
                  <TableRow key={s.name} sx={{'&:hover':{bgcolor:'#f5f5f5'}}}>
                    <TableCell sx={{...TD,fontWeight:'bold',color:STAFF_COLORS[s.name]||PROPERTY_COLOR,fontSize:'16px'}}>
                      {s.name}
                    </TableCell>
                    <TableCell sx={TD}>
                      {editingAnnual===s.name?(
                        <Box sx={{display:'flex',gap:0.5,alignItems:'center'}}>
                          <TextField size="small" value={editAnnualVal} onChange={e=>setEditAnnualVal(e.target.value)}
                            type="number" label="万円単位で入力" sx={{width:130}} autoFocus
                            helperText="例: 2000 → 2000万円"
                            onKeyDown={e=>{if(e.key==='Enter')handleSaveAnnualTarget(s.name,editAnnualVal);}}/>
                          <IconButton size="small" color="primary" disabled={saving}
                            onClick={()=>handleSaveAnnualTarget(s.name,editAnnualVal)}><SaveIcon fontSize="small"/></IconButton>
                          <IconButton size="small" disabled={saving}
                            onClick={()=>setEditingAnnual(null)}><CancelIcon fontSize="small"/></IconButton>
                        </Box>
                      ):(
                        <Box sx={{display:'flex',alignItems:'center',gap:0.5}}>
                          <Typography sx={{fontSize:'15px'}}>
                            {s.annualTarget>0?formatPrice(s.annualTarget):'未設定'}
                          </Typography>
                          <Tooltip title="年間目標を編集">
                            <IconButton size="small"
                              onClick={()=>{setEditingAnnual(s.name);setEditAnnualVal(s.annualTarget>0?(s.annualTarget/10_000).toString():'');}}>
                              <EditIcon sx={{fontSize:'0.9rem',color:PROPERTY_COLOR}}/>
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell sx={{...TD,color:'#546e7a'}}>{s.ytdTarget>0?formatPrice(s.ytdTarget):'未設定'}</TableCell>
                    <TableCell sx={{...TD,fontWeight:s.ytdActual>0?'bold':'normal',color:s.ytdActual>0?'#2e7d32':'text.secondary'}}>
                      {formatPrice(s.ytdActual)}
                    </TableCell>
                    <TableCell sx={{...TD,minWidth:200}}>
                      {s.ytdRate!==null?(
                        <Box>
                          <Box sx={{display:'flex',alignItems:'center',gap:1,mb:0.5}}>
                            <Chip label={`${s.ytdRate}%`} size="small" sx={rateChipSx(s.ytdRate)}/>
                            <Typography sx={{fontSize:'13px',color:'#666'}}>
                              {s.ytdRate>=100?'✅ 達成中':s.ytdRate>=80?'⚠️ 要注意':'❌ 未達'}
                            </Typography>
                          </Box>
                          <Box sx={{bgcolor:'#e0e0e0',borderRadius:4,height:10,overflow:'hidden'}}>
                            <Box sx={{height:'100%',bgcolor:rateColor(s.ytdRate),width:`${Math.min(100,s.ytdRate)}%`,
                              borderRadius:4,transition:'width 0.3s'}}/>
                          </Box>
                        </Box>
                      ):<Chip label="未設定" size="small" sx={rateChipSx(null)}/>}
                    </TableCell>
                    <TableCell sx={TD}>
                      {s.yoy!==null?(
                        <Box>
                          <Chip label={`前年比 ${s.yoy}%`} size="small"
                            sx={{bgcolor:s.yoy>=100?'#e8f5e9':'#ffebee',color:s.yoy>=100?'#2e7d32':'#c62828',fontWeight:'bold',fontSize:'13px',mb:0.5}}/>
                          <Typography sx={{fontSize:'14px',color:'#546e7a'}}>
                            前年同期: {formatPrice(s.prevYtd)}
                          </Typography>
                          <Typography sx={{fontSize:'13px',color:s.yoy>=100?'#2e7d32':'#c62828'}}>
                            {s.ytdActual>=s.prevYtd
                              ?`▲ ${formatPrice(s.ytdActual-s.prevYtd)}`
                              :`▼ ${formatPrice(s.prevYtd-s.ytdActual)}`}
                          </Typography>
                        </Box>
                      ):(
                        <Typography sx={{fontSize:'13px',color:'#bbb'}}>前年実績なし</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{...TD,fontWeight:s.ytdTarget>0?'bold':'normal',
                      color:s.ytdTarget>0?(s.ytdActual>=s.ytdTarget?'#2e7d32':'#c62828'):'text.secondary'}}>
                      {s.ytdTarget>0
                        ?(s.ytdActual>=s.ytdTarget?`▲${formatPrice(s.ytdActual-s.ytdTarget)}`:`▼${formatPrice(s.ytdTarget-s.ytdActual)}`)
                        :'—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </>) : (<>
        {/* 個人：月別棒グラフ */}
        <Paper sx={{p:2.5,mb:3}} elevation={1}>
          <Typography sx={{fontSize:'18px',fontWeight:'bold',color:STAFF_COLORS[selectedStaff]||PROPERTY_COLOR,mb:2}}>
            📊 {selectedStaff} — 月別実績 vs 目標 vs 前期
          </Typography>
          <Box sx={{height:320}}>
            <Bar data={barChartData} options={{...barChartOptions,maintainAspectRatio:false} as any}/>
          </Box>
        </Paper>

        {/* 個人：累計ラインチャート */}
        <Paper sx={{p:2.5,mb:3}} elevation={1}>
          <Typography sx={{fontSize:'18px',fontWeight:'bold',color:PROPERTY_COLOR,mb:2}}>
            📈 {selectedStaff} — 累計推移（今期 vs 前期 vs 目標）
          </Typography>
          <Box sx={{height:300}}>
            <Line data={lineChartData} options={{...lineChartOptions,maintainAspectRatio:false} as any}/>
          </Box>
        </Paper>

        {/* 個人：月別詳細テーブル */}
        <Paper sx={{p:2.5,mb:3}} elevation={1}>
          <Typography sx={{fontSize:'18px',fontWeight:'bold',color:PROPERTY_COLOR,mb:2}}>
            📋 {selectedStaff} — 月別詳細
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {['月','個人月別目標（✏️編集）','前期同月','今期実績','月間達成率','差額','累計目標','累計実績','累計達成率'].map(h=>(
                    <TableCell key={h} sx={TH}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {monthRows.map(m=>{
                  const isEdit=editingMonth?.month===m.month&&editingMonth?.staffName===selectedStaff;
                  const rowBg=m.isCurrentMonth?'#fffde7':m.isFuture?'#fafafa':'inherit';
                  return (
                  <TableRow key={m.month} sx={{bgcolor:rowBg,'&:hover':{bgcolor:m.isFuture?'#f0f0f0':'#f9f9f9'}}}>
                    <TableCell sx={{...TD,fontWeight:m.isCurrentMonth?'bold':'normal'}}>
                      {formatMonth(m.month)}
                      {m.isCurrentMonth&&<Chip label="今月" size="small"
                        sx={{ml:0.5,height:18,fontSize:'11px',bgcolor:'#fff3e0',color:'#e65100'}}/>}
                    </TableCell>
                    <TableCell sx={TD}>
                      {isEdit?(
                        <Box sx={{display:'flex',gap:0.5,alignItems:'center',minWidth:150}}>
                          <TextField size="small" value={editMonthVal} onChange={e=>setEditMonthVal(e.target.value)}
                            type="number" label="万円単位で入力" sx={{width:130}} autoFocus
                            helperText="例: 500 → 500万円"
                            onKeyDown={e=>{if(e.key==='Enter')handleSaveMonthTarget(m.month,selectedStaff,editMonthVal);}}/>
                          <IconButton size="small" color="primary" disabled={saving}
                            onClick={()=>handleSaveMonthTarget(m.month,selectedStaff,editMonthVal)}><SaveIcon fontSize="small"/></IconButton>
                          <IconButton size="small" disabled={saving}
                            onClick={()=>setEditingMonth(null)}><CancelIcon fontSize="small"/></IconButton>
                        </Box>
                      ):(
                        <Box sx={{display:'flex',alignItems:'center',gap:0.5}}>
                          <Typography sx={{fontSize:'15px',minWidth:60}}>
                            {m.target>0?formatPrice(m.target):<span style={{color:'#bbb'}}>未設定</span>}
                          </Typography>
                          <Tooltip title="目標を設定（万円）">
                            <IconButton size="small"
                              onClick={()=>{setEditingMonth({month:m.month,staffName:selectedStaff});
                                setEditMonthVal(m.target>0?(m.target/10_000).toString():'');}}>
                              <EditIcon sx={{fontSize:'0.9rem',color:PROPERTY_COLOR}}/>
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell sx={{...TD,color:'#546e7a'}}>{m.prevActual>0?formatPrice(m.prevActual):'-'}</TableCell>
                    <TableCell sx={{...TD,fontWeight:m.actual>0?'bold':'normal',color:m.actual>0?'#2e7d32':'text.secondary'}}>
                      {m.isFuture?<Typography sx={{fontSize:'14px',color:'#bbb'}}>未到来</Typography>:formatPrice(m.actual)}
                    </TableCell>
                    <TableCell sx={TD}>
                      {!m.isFuture&&m.monthRate!==null
                        ?<Chip label={`${m.monthRate}%`} size="small" sx={rateChipSx(m.monthRate)}/>
                        :<Typography sx={{fontSize:'13px',color:'#bbb'}}>—</Typography>}
                    </TableCell>
                    <TableCell sx={{...TD,color:m.target>0?(m.actual>=m.target?'#2e7d32':'#c62828'):'text.secondary',fontWeight:m.target>0?'bold':'normal'}}>
                      {m.target>0&&!m.isFuture?(m.actual>=m.target?`▲${formatPrice(m.actual-m.target)}`:`▼${formatPrice(m.target-m.actual)}`):'—'}
                    </TableCell>
                    <TableCell sx={{...TD,color:'#546e7a'}}>{m.cumTarget>0?formatPrice(m.cumTarget):'-'}</TableCell>
                    <TableCell sx={{...TD,fontWeight:m.cumActual>0?'bold':'normal',color:m.cumActual>0?'#2e7d32':'text.secondary'}}>
                      {formatPrice(m.cumActual)}
                    </TableCell>
                    <TableCell sx={TD}>
                      {m.cumRate!==null
                        ?<Box>
                          <Chip label={`${m.cumRate}%`} size="small" sx={rateChipSx(m.cumRate)}/>
                          <Box sx={{bgcolor:'#e0e0e0',borderRadius:4,height:6,mt:0.5,overflow:'hidden'}}>
                            <Box sx={{height:'100%',bgcolor:rateColor(m.cumRate),width:`${Math.min(100,m.cumRate)}%`,borderRadius:4}}/>
                          </Box>
                        </Box>
                        :<Typography sx={{fontSize:'13px',color:'#bbb'}}>—</Typography>}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {/* 月別目標合計チェック */}
          {(()=>{
            const mSum=monthlyTargetSum(selectedStaff);
            const aT=getAnnualTarget(selectedStaff);
            if (mSum===0) return null;
            const diff=mSum-aT;
            return (
              <Box sx={{p:1.5,mt:1,bgcolor:diff===0?'#e8f5e9':'#fff3e0',borderRadius:1}}>
                <Typography sx={{fontSize:'14px'}}>
                  月別目標合計：<strong>{formatPrice(mSum)}</strong>
                  {aT>0&&<> ／ 年間個人目標：<strong>{formatPrice(aT)}</strong>
                    ／ <strong style={{color:diff===0?'#2e7d32':'#e65100'}}>
                      {diff===0?'✅ 一致':`差額 ${diff>0?'+':''}${formatPrice(Math.abs(diff))}`}
                    </strong></>}
                </Typography>
              </Box>
            );
          })()}
        </Paper>
      </>)}
      </>)}

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
