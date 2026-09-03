/**
 * SellerStatusSidebar - 売主ステータスサイドバーコンポーネント
 * 
 * 売主リストページと通話モードページで共通で使用するサイドバー
 * 現在の売主がどのステータスカテゴリに属するかをハイライト表示
 */

import { useState, useEffect, memo } from 'react';
import { Paper, Typography, Box, Button, Chip, Collapse, IconButton, List, ListItem, Divider, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ExpandMore, ExpandLess, Edit, Email, Phone, Chat, LocationOn, OpenInNew as OpenInNewIcon, PushPin as PushPinIcon, Close as CloseIcon } from '@mui/icons-material';
import api from '../services/api';
import SellerMatchingSidebarSection from './SellerMatchingSidebarSection';
import {
  StatusCategory,
  CategoryCounts,
  isTodayCall,
  isTodayCallWithInfo,
  getTodayCallWithInfoLabel,
  isUnvaluated,
  isMailingPending,
  isTodayCallNotStarted,
  isPinrichEmpty,
  isPinrichChangeRequired,
  isPinrichNeedsChange,
  isVisitAssignedTo,
  isTodayCallAssignedTo,
  isTodayCallAssigned,
  isVisitDayBefore,
  isVisitScheduled,
  isVisitCompleted,
  isVisitThankYouPending,
  isUnvisitedOtherDecision,
  isVisitPreparationPending,
} from '../utils/sellerStatusFilters';
import { Seller } from '../types';

interface SellerStatusSidebarProps {
  /** 現在表示中の売主（通話モードページで使用） */
  currentSeller?: Seller | any;
  /** カテゴリ別の件数（売主リストページで使用） */
  categoryCounts?: CategoryCounts;
  /** 選択中のカテゴリ（売主リストページで使用） */
  selectedCategory?: StatusCategory;
  /** カテゴリ選択時のコールバック（売主リストページで使用） */
  onCategorySelect?: (category: StatusCategory) => void;
  /** カテゴリ展開時のコールバック（全件データ取得のトリガー） */
  onCategoryExpand?: (category: string) => void;
  /** 通話モードページかどうか */
  isCallMode?: boolean;
  /** 売主リスト（展開時に表示する売主データ） */
  sellers?: any[];
  /** カテゴリ別の全件売主データ（展開リスト用） */
  expandedCategorySellers?: Record<string, any[]>;
  /** カテゴリ別のローディング状態 */
  expandedCategoryLoading?: Record<string, boolean>;
  /** ローディング中かどうか */
  loading?: boolean;
  /** スタッフイニシャル一覧（担当者別カテゴリー表示用） */
  assigneeInitials?: string[];
  /** 担当者別の訪問後御礼メール未送信カウント */
  visitThankYouPendingCounts?: Record<string, number>;
  /** 売主クリック時のナビゲーションハンドラー（遷移ブロック対応用） */
  onSellerNavigate?: (sellerId: string) => void;
  /** サイドバーに一時追加されたフィルター一覧（フィルタパネルから作成） */
  tempFilters?: Array<{ id: string; label: string; createdBy: string; filters: Record<string, any> }>;
  /** 選択中の一時追加フィルターID */
  selectedTempFilterId?: string | null;
  /** 一時追加フィルター選択時のコールバック */
  onTempFilterSelect?: (tempFilter: { id: string; filters: Record<string, any> }) => void;
  /** 一時追加フィルター削除時のコールバック */
  onTempFilterDelete?: (id: string) => void;
}

/**
 * 売主がどのステータスカテゴリに属するかを判定
 */
const getSellerCategory = (seller: Seller | any): StatusCategory | null => {
  if (!seller) return null;
  
  if (isVisitPreparationPending(seller)) return 'visitPreparationPending';
  if (isTodayCall(seller)) return 'todayCall';
  if (isTodayCallWithInfo(seller)) {
    // ラベル別カテゴリキーを返す（例: todayCallWithInfo:当日TEL(U)）
    const label = getTodayCallWithInfoLabel(seller);
    return `todayCallWithInfo:${label}` as StatusCategory;
  }
  if (isUnvaluated(seller)) return 'unvaluated';
  if (isMailingPending(seller)) return 'mailingPending';
  
  return null;
};

/**
 * カテゴリに該当する売主をフィルタリング
 */
const filterSellersByCategory = (sellers: any[], category: StatusCategory): any[] => {
  if (!sellers) return [];

  // FI（福岡）売主かどうかを判定するヘルパー
  const isFiSeller = (s: any): boolean =>
    ((s.sellerNumber || s.seller_number || '') as string).toUpperCase().startsWith('FI');

  // FI（福岡）カテゴリの処理
  if (typeof category === 'string' && category.startsWith('fi:')) {
    const isFi = (s: any) => ((s.sellerNumber || s.seller_number || '') as string).startsWith('FI');
    const subCat = category.replace('fi:', '') as StatusCategory;
    const fiSellers = sellers.filter(isFi);
    if (subCat === 'todayCall') return fiSellers.filter(isTodayCall);
    if (subCat === 'todayCallNotStarted') return fiSellers.filter(isTodayCallNotStarted);
    if (subCat === 'unvaluated') return fiSellers.filter(isUnvaluated);
    if (subCat === 'mailingPending') return fiSellers.filter(isMailingPending);
    if (subCat === 'todayCallWithInfo') return fiSellers.filter(isTodayCallWithInfo);
    if (typeof subCat === 'string' && subCat.startsWith('todayCallWithInfo:')) {
      const targetLabel = subCat.replace('todayCallWithInfo:', '');
      return fiSellers.filter(s => isTodayCallWithInfo(s) && getTodayCallWithInfoLabel(s) === targetLabel);
    }
    return fiSellers;
  }

  if (typeof category === 'string' && category.startsWith('visitAssigned:')) {
    const assignee = category.replace('visitAssigned:', '');
    return sellers.filter(s => isVisitAssignedTo(s, assignee));
  }
  if (typeof category === 'string' && category.startsWith('todayCallAssigned:')) {
    const assignee = category.replace('todayCallAssigned:', '');
    return sellers.filter(s => isTodayCallAssignedTo(s, assignee));
  }
  if (typeof category === 'string' && category.startsWith('visitThankYouPending:')) {
    const assignee = category.replace('visitThankYouPending:', '');
    return sellers.filter(s => isVisitThankYouPending(s) && (s.visitAssigneeInitials || s.visit_assignee || s.visitAssignee) === assignee);
  }
  if (typeof category === 'string' && category.startsWith('todayCallWithInfo:')) {
    const targetLabel = category.replace('todayCallWithInfo:', '');
    // FI売主は福岡専用カテゴリーに表示するため除外
    return sellers.filter(s => !isFiSeller(s) && isTodayCallWithInfo(s) && getTodayCallWithInfoLabel(s) === targetLabel);
  }

  switch (category) {
    case 'todayCall':
      // FI売主は福岡専用カテゴリー（fi:todayCall）に表示するため除外
      return sellers.filter(s => !isFiSeller(s) && isTodayCall(s));
    case 'todayCallWithInfo':
      // FI売主は福岡専用カテゴリー（fi:todayCallWithInfo）に表示するため除外
      return sellers.filter(s => !isFiSeller(s) && isTodayCallWithInfo(s));
    case 'unvaluated':
      // FI売主は福岡専用カテゴリー（fi:unvaluated）に表示するため除外
      return sellers.filter(s => !isFiSeller(s) && isUnvaluated(s));
    case 'mailingPending':
      return sellers.filter(isMailingPending);
    case 'todayCallNotStarted':
      // FI売主は福岡専用カテゴリー（fi:todayCallNotStarted）に表示するため除外
      return sellers.filter(s => !isFiSeller(s) && isTodayCallNotStarted(s));
    case 'pinrichEmpty':
      return sellers.filter(isPinrichEmpty);
    case 'matching':
      return sellers.filter(s => 
        (s.matchUpdatedAt !== null && s.matchUpdatedAt !== undefined) || 
        (s.buyMatchUpdatedAt !== null && s.buyMatchUpdatedAt !== undefined) ||
        (s.buy_match_updated_at !== null && s.buy_match_updated_at !== undefined)
      );
    case 'todayCallAssigned':
      return sellers.filter(isTodayCallAssigned);
    case 'visitDayBefore':
      return sellers.filter(isVisitDayBefore);
    case 'visitScheduled': // 後方互換性
      return sellers.filter(isVisitDayBefore);
    case 'visitCompleted':
      return sellers.filter(isVisitCompleted);
    case 'unvisitedOtherDecision':
      return sellers.filter(isUnvisitedOtherDecision);
    case 'pinrichChangeRequired':
      return sellers.filter(isPinrichNeedsChange);
    case 'visitPreparationPending':
      return sellers.filter(isVisitPreparationPending);
    case 'sellerPortalAttention':
      // sellers単体では判定できない（seller_portal_*の別テーブルとのJOINが必要なため）。
      // 展開リストは対象外とし、件数のみ表示する。誤って全件を返さないよう空配列にする。
      return [];
    default:
      return sellers;
  }
};

/**
 * カテゴリの表示名を取得
 */
const getCategoryLabel = (category: StatusCategory): string => {
  switch (category) {
    case 'visitDayBefore':
      return '①訪問日前日';
    case 'visitCompleted':
      return '②訪問済み';
    case 'todayCall':
      return '③当日TEL分';
    case 'todayCallWithInfo':
      return '②当日TEL（内容）';
    case 'unvaluated':
      return '⑤未査定';
    case 'mailingPending':
      return '⑥査定（郵送）';
    case 'todayCallNotStarted':
      return '⑦当日TEL_未着手';
    case 'pinrichChangeRequired':
      return 'Pinrich要変更';
    case 'pinrichEmpty':
      return '⑧Pinrich空欄';
    case 'matching':
      return 'マッチング';
    case 'todayCallAssigned':
      return '当日TEL（担当）';
    case 'exclusive':
      return '専任';
    case 'general':
      return '一般';
    case 'visitOtherDecision':
      return '訪問後他決';
    case 'unvisitedOtherDecision':
      return '未訪問他決';
    case 'visitPreparationPending':
      return '訪問準備未';
    case 'sellerPortalAttention':
      return '売却サポート：対応要';
    case 'fi':
      return 'FI売主';
    case 'all':
      return 'All';
    default:
      if (typeof category === 'string' && category.startsWith('visitAssigned:')) {
        return `担当(${category.replace('visitAssigned:', '')})`;
      }
      if (typeof category === 'string' && category.startsWith('todayCallAssigned:')) {
        return `当日TEL(${category.replace('todayCallAssigned:', '')})`;
      }
      if (typeof category === 'string' && category.startsWith('todayCallWithInfo:')) {
        return category.replace('todayCallWithInfo:', '');
      }
      if (typeof category === 'string' && category.startsWith('visitThankYouPending:')) {
        return `訪問後御礼(${category.replace('visitThankYouPending:', '')})`;
      }
      // FI（福岡）カテゴリ
      if (typeof category === 'string' && category.startsWith('fi:')) {
        const sub = category.replace('fi:', '');
        if (sub === 'todayCall') return '当日TEL分';
        if (sub === 'todayCallNotStarted') return '当日TEL_未着手';
        if (sub === 'todayCallWithInfo') return '当日TEL（内容）';
        if (sub.startsWith('todayCallWithInfo:')) return sub.replace('todayCallWithInfo:', '');
        if (sub === 'unvaluated') return '未査定';
        if (sub === 'mailingPending') return '査定（郵送）';
      }
      return category as string;
  }
};

/**
 * カテゴリの色を取得
 */
const getCategoryColor = (category: StatusCategory): string => {
  switch (category) {
    case 'visitDayBefore':
      return '#2e7d32';
    case 'visitCompleted':
      return '#1565c0';
    case 'todayCall':
      return 'error.main';
    case 'todayCallWithInfo':
      return 'secondary.main';
    case 'unvaluated':
      return 'warning.main';
    case 'mailingPending':
      return 'info.main';
    case 'todayCallNotStarted':
      return '#ff9800';
    case 'pinrichChangeRequired':
      return '#e91e63';
    case 'pinrichEmpty':
      return '#795548';
    case 'matching':
      return '#9c27b0';
    case 'todayCallAssigned':
      return '#ff5722';
    case 'exclusive':
      return '#2e7d32';
    case 'general':
      return '#1565c0';
    case 'visitOtherDecision':
      return '#ff9800';
    case 'unvisitedOtherDecision':
      return '#ff5722';
    case 'visitPreparationPending':
      return '#c62828';
    case 'sellerPortalAttention':
      return '#00897b';
    case 'fi':
      return '#1a237e';
    default:
      if (typeof category === 'string' && category.startsWith('visitAssigned:')) {
        return '#4caf50';
      }
      if (typeof category === 'string' && category.startsWith('todayCallAssigned:')) {
        return '#ff5722';
      }
      if (typeof category === 'string' && category.startsWith('todayCallWithInfo:')) {
        return '#9c27b0';
      }
      if (typeof category === 'string' && category.startsWith('visitThankYouPending:')) {
        return '#e65100';
      }
      // FI（福岡）カテゴリ
      if (typeof category === 'string' && category.startsWith('fi:')) {
        const sub = category.replace('fi:', '');
        if (sub === 'todayCall' || sub.startsWith('todayCall')) return '#d32f2f';
        if (sub === 'todayCallNotStarted') return '#ff9800';
        if (sub === 'unvaluated') return '#ed6c02';
        if (sub === 'mailingPending') return '#0288d1';
        if (sub.startsWith('todayCallWithInfo')) return '#9c27b0';
      }
      return '#555555';
  }
};

function SellerStatusSidebarComponent({
  currentSeller,
  categoryCounts,
  selectedCategory,
  onCategorySelect,
  onCategoryExpand,
  isCallMode = false,
  sellers = [],
  expandedCategorySellers = {},
  expandedCategoryLoading = {},
  loading = false,
  assigneeInitials = [],
  visitThankYouPendingCounts = {},
  onSellerNavigate,
  tempFilters = [],
  selectedTempFilterId = null,
  onTempFilterSelect,
  onTempFilterDelete,
}: SellerStatusSidebarProps) {
  const navigate = useNavigate();
  
  const validSellers = Array.isArray(sellers) ? sellers : [];
  
  // 展開中のカテゴリ（nullの場合は全カテゴリ表示）
  const [expandedCategory, setExpandedCategory] = useState<StatusCategory | null>(null);

  // 専任媒介・月別サマリー（担当者別）
  const [exclusiveMonthlySummary, setExclusiveMonthlySummary] = useState<
    Record<string, { yearMonth: string; label: string; count: number; sellerIds: string[] }[]>
  >({});

  // 他決・月別サマリー（担当者別）
  const [otherDecisionMonthlySummary, setOtherDecisionMonthlySummary] = useState<
    Record<string, { yearMonth: string; label: string; count: number; sellerIds: string[] }[]>
  >({});

  // 未訪問他決・月別サマリー
  const [unvisitedOtherDecisionMonthlySummary, setUnvisitedOtherDecisionMonthlySummary] = useState<
    {
      yearMonth: string;
      label: string;
      count: number;
      sellers?: {
        id: string;
        sellerNumber: string;
        propertyAddress: string;
        name: string;
        comments: string;
        status: string;
        competitorNameAndReason: string;
        nextCallDate: string | null;
        contractYearMonth: string | null;
        inquiryDate: string | null;
        valuationAmount1: number | null;
        valuationAmount2: number | null;
        valuationAmount3: number | null;
        valuationAssignee: string;
      }[];
    }[]
  >([]);

  // 未訪問他決モーダル（削除済み - navigate遷移に変更）

  // 専任月別セクション専用の展開state（売主リストのexpandedCategoryと完全に分離）
  const [exclusiveExpandedMonth, setExclusiveExpandedMonth] = useState<string | null>(null);
  // 他決月別セクション専用の展開state
  const [otherDecisionExpandedMonth, setOtherDecisionExpandedMonth] = useState<string | null>(null);

  // 未訪問他決月別セクション専用の展開state
  const [unvisitedOtherDecisionExpandedMonth, setUnvisitedOtherDecisionExpandedMonth] = useState<string | null>(null);

  // すまいステップ月別サマリー
  const [sumaiStepMonthlySummary, setSumaiStepMonthlySummary] = useState<
    { yearMonth: string; label: string; total: number; exclusive: number; general: number }[]
  >([]);
  // すまいステップセクション専用の展開state
  const [sumaiStepExpandedMonth, setSumaiStepExpandedMonth] = useState<string | null>(null);

  // イエウール月別サマリー
  const [ieulMonthlySummary, setIeulMonthlySummary] = useState<
    { yearMonth: string; label: string; total: number; exclusive: number; general: number }[]
  >([]);
  const [ieulExpandedMonth, setIeulExpandedMonth] = useState<string | null>(null);

  // LIFULL月別サマリー
  const [lifullMonthlySummary, setLifullMonthlySummary] = useState<
    { yearMonth: string; label: string; total: number; exclusive: number; general: number }[]
  >([]);
  const [lifullExpandedMonth, setLifullExpandedMonth] = useState<string | null>(null);

  // HOME4U月別サマリー
  const [home4uMonthlySummary, setHome4uMonthlySummary] = useState<
    { yearMonth: string; label: string; total: number; exclusive: number; general: number }[]
  >([]);
  const [home4uExpandedMonth, setHome4uExpandedMonth] = useState<string | null>(null);

  // 査定サイト統計（親アコーディオン）の展開state
  const [siteStatsExpanded, setSiteStatsExpanded] = useState<boolean>(false);

  // 専任月別サマリーを取得（初回のみ）
  useEffect(() => {
    let cancelled = false;
    const fetchSummary = async () => {
      try {
        const res = await api.get('/api/sellers/exclusive-monthly-summary');
        if (!cancelled) setExclusiveMonthlySummary(res.data?.summary || {});
      } catch (e) {
        // サイドバーのオプション機能なのでエラーは無視
      }
    };
    fetchSummary();
    return () => { cancelled = true; };
  }, []);

  // 他決月別サマリーを取得（初回のみ）
  useEffect(() => {
    let cancelled = false;
    const fetchOtherDecisionSummary = async () => {
      try {
        const res = await api.get('/api/sellers/other-decision-monthly-summary');
        if (!cancelled) setOtherDecisionMonthlySummary(res.data?.summary || {});
      } catch (e) {
        // エラーは無視
      }
    };
    fetchOtherDecisionSummary();
    return () => { cancelled = true; };
  }, []);

  // 未訪問他決月別サマリーを取得（初回のみ）
  useEffect(() => {
    let cancelled = false;
    const fetchUnvisitedOtherDecisionSummary = async () => {
      try {
        const res = await api.get('/api/sellers/unvisited-other-decision-monthly-summary');
        if (!cancelled) setUnvisitedOtherDecisionMonthlySummary(res.data?.summary || []);
      } catch (e) {
        // エラーは無視
      }
    };
    fetchUnvisitedOtherDecisionSummary();
    return () => { cancelled = true; };
  }, []);

  // すまいステップ月別サマリーを取得（初回のみ）
  useEffect(() => {
    let cancelled = false;
    const fetchSumaiStepSummary = async () => {
      try {
        const res = await api.get('/api/sellers/sumai-step-monthly-summary');
        if (!cancelled) setSumaiStepMonthlySummary(res.data?.summary || []);
      } catch (e) {
        // エラーは無視
      }
    };
    fetchSumaiStepSummary();
    return () => { cancelled = true; };
  }, []);

  // イエウール月別サマリーを取得（初回のみ）
  useEffect(() => {
    let cancelled = false;
    const fetchIeulSummary = async () => {
      try {
        const res = await api.get('/api/sellers/site-monthly-summary/%E3%82%A6');
        if (!cancelled) setIeulMonthlySummary(res.data?.summary || []);
      } catch (e) {
        // エラーは無視
      }
    };
    fetchIeulSummary();
    return () => { cancelled = true; };
  }, []);

  // LIFULL月別サマリーを取得（初回のみ）
  useEffect(() => {
    let cancelled = false;
    const fetchLifullSummary = async () => {
      try {
        const res = await api.get('/api/sellers/site-monthly-summary/L');
        if (!cancelled) setLifullMonthlySummary(res.data?.summary || []);
      } catch (e) {
        // エラーは無視
      }
    };
    fetchLifullSummary();
    return () => { cancelled = true; };
  }, []);

  // HOME4U月別サマリーを取得（初回のみ）
  useEffect(() => {
    let cancelled = false;
    const fetchHome4uSummary = async () => {
      try {
        const res = await api.get('/api/sellers/site-monthly-summary/H');
        if (!cancelled) setHome4uMonthlySummary(res.data?.summary || []);
      } catch (e) {
        // エラーは無視
      }
    };
    fetchHome4uSummary();
    return () => { cancelled = true; };
  }, []);
  
  // 通話モードページの場合、現在の売主のカテゴリを判定
  const currentSellerCategory = isCallMode ? getSellerCategory(currentSeller) : null;
  
  // 通話モードページの場合、現在の売主のカテゴリを自動展開
  useEffect(() => {
    if (isCallMode && currentSellerCategory) {
      setExpandedCategory(currentSellerCategory);
    }
  }, [isCallMode, currentSellerCategory]);
  
  // ボタンがアクティブかどうかを判定
  const isActive = (category: StatusCategory): boolean => {
    if (isCallMode) {
      return currentSellerCategory === category;
    } else {
      return selectedCategory === category;
    }
  };
  
  // カテゴリヘッダークリック時の処理
  const handleCategoryClick = (category: StatusCategory) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
      // 全件データ取得をトリガー（カウントと展開リストのずれを解消）
      onCategoryExpand?.(category as string);
    }
    
    if (!isCallMode) {
      onCategorySelect?.(category);
    }
  };
  
  // 「売主リスト」タイトルクリック時の処理
  const handleTitleClick = () => {
    setExpandedCategory(null);
    if (!isCallMode) {
      onCategorySelect?.('all');
    }
  };
  
  // 売主クリック時の処理
  const handleSellerClick = (sellerId: string) => {
    if (onSellerNavigate) {
      onSellerNavigate(sellerId);
    } else {
      navigate(`/sellers/${sellerId}/call`);
    }
  };
  
  // 件数を取得
  const getCount = (category: StatusCategory): number => {
    if (typeof category === 'string' && category.startsWith('visitAssigned:')) {
      const assignee = category.replace('visitAssigned:', '');
      // APIから取得した担当者別カウントがあればそれを使用（全件対象）
      if (categoryCounts?.visitAssignedCounts) {
        return categoryCounts.visitAssignedCounts[assignee] ?? 0;
      }
      return filterSellersByCategory(validSellers, category).length;
    }
    if (typeof category === 'string' && category.startsWith('todayCallAssigned:')) {
      const assignee = category.replace('todayCallAssigned:', '');
      // APIから取得した担当者別当日TELカウントがあればそれを使用（全件対象）
      if (categoryCounts?.todayCallAssignedCounts) {
        return categoryCounts.todayCallAssignedCounts[assignee] ?? 0;
      }
      return filterSellersByCategory(validSellers, category).length;
    }
    if (typeof category === 'string' && category.startsWith('visitThankYouPending:')) {
      const assignee = category.replace('visitThankYouPending:', '');
      // APIから取得した担当者別訪問後御礼未送信カウントがあればそれを使用
      if (visitThankYouPendingCounts) {
        return visitThankYouPendingCounts[assignee] ?? 0;
      }
      return validSellers.filter(s => isVisitThankYouPending(s) && (s.visitAssigneeInitials || s.visit_assignee || s.visitAssignee) === assignee).length;
    }
    if (categoryCounts) {
      return (categoryCounts as unknown as Record<string, number>)[category] ?? 0;
    }
    return filterSellersByCategory(validSellers, category).length;
  };

  // カテゴリボタンをレンダリング
  const renderCategoryButton = (category: StatusCategory, label: string, color: string) => {
    const count = getCount(category);
    const isExpanded = expandedCategory === category;
    
    // 展開時は全件データを優先使用（カウントと展開リストのずれを解消）
    const categoryKey = category as string;
    const isLoadingExpanded = expandedCategoryLoading[categoryKey] ?? false;
    const fullSellers = expandedCategorySellers[categoryKey];
    // ローディング中 or まだAPIデータ未取得（undefined）の場合は空配列にして「読み込み中...」を表示
    const filteredSellers = isExpanded
      ? (isLoadingExpanded || fullSellers === undefined ? [] : fullSellers)
      : filterSellersByCategory(validSellers, category);
    // todayCallWithInfo: プレフィックスのカテゴリはラベルでフィルタリング（展開時も適用）
    const displaySellers = (isExpanded && typeof category === 'string' && category.startsWith('todayCallWithInfo:'))
      ? filteredSellers.filter((s: any) => getTodayCallWithInfoLabel(s) === category.replace('todayCallWithInfo:', ''))
      : filteredSellers;
    
    if (count === 0 && !isExpanded) return null;
    
    return (
      <Box key={category}>
        <Button
          fullWidth
          onClick={() => handleCategoryClick(category)}
          sx={{ 
            justifyContent: 'space-between', 
            textAlign: 'left',
            fontSize: '0.85rem',
            py: 1,
            px: 1.5,
            color: isActive(category) || isExpanded ? 'white' : color,
            bgcolor: isActive(category) || isExpanded ? color : 'transparent',
            borderRadius: isExpanded ? '4px 4px 0 0' : 1,
            '&:hover': {
              bgcolor: isActive(category) || isExpanded ? color : `${color}15`,
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>{label}</span>
            {count > 0 && (
              <Chip 
                label={count} 
                size="small"
                sx={{ 
                  height: 20, 
                  fontSize: '0.7rem',
                  bgcolor: isActive(category) || isExpanded ? 'rgba(255,255,255,0.3)' : undefined,
                  color: isActive(category) || isExpanded ? 'white' : undefined,
                }}
              />
            )}
          </Box>
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </Button>
        
        {/* 展開時の売主リスト */}
        <Collapse in={isExpanded}>
          <Box sx={{ 
            bgcolor: 'grey.50', 
            borderRadius: '0 0 4px 4px',
            border: 1,
            borderColor: 'grey.300',
            borderTop: 0,
            maxHeight: 400,
            overflow: 'auto',
          }}>
            <Box sx={{ 
              p: 1.5, 
              borderBottom: 1, 
              borderColor: 'grey.200',
              bgcolor: 'grey.100',
            }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color }}>
                {label} <Chip label={count} size="small" sx={{ height: 18, fontSize: '0.7rem', ml: 1 }} />
              </Typography>
            </Box>
            
            {displaySellers.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                {isLoadingExpanded ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">読み込み中...</Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    該当する売主がいません
                  </Typography>
                )}
              </Box>
            ) : (
              <List dense disablePadding>
                {displaySellers.map((seller, index) => (
                  <Box key={seller.id}>
                    <ListItem
                      sx={{ 
                        py: 1.5, 
                        px: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'grey.100' },
                        bgcolor: currentSeller?.id === seller.id ? 'primary.light' : 'transparent',
                      }}
                      onClick={() => handleSellerClick(seller.id)}
                    >
                      <Box sx={{ width: '100%' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {seller.sellerNumber}（{seller.name}）
                          {category === 'todayCallWithInfo' && (
                            <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'secondary.main', fontWeight: 'bold' }}>
                              [{getTodayCallWithInfoLabel(seller)}]
                            </Typography>
                          )}
                          {seller.status && (
                            <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                              ({seller.status})
                            </Typography>
                          )}
                        </Typography>
                        
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {seller.propertyAddress || seller.address || '-'}
                          {seller.nextCallDate && (
                            <span> ({new Date(seller.nextCallDate).toLocaleDateString('ja-JP')})</span>
                          )}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
                          <IconButton size="small" sx={{ p: 0.5 }}>
                            <Edit fontSize="small" />
                          </IconButton>
                          {seller.email && (
                            <IconButton size="small" sx={{ p: 0.5 }}>
                              <Email fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton size="small" sx={{ p: 0.5 }}>
                            <Phone fontSize="small" />
                          </IconButton>
                          <IconButton size="small" sx={{ p: 0.5 }}>
                            <Chat fontSize="small" />
                          </IconButton>
                          <IconButton size="small" sx={{ p: 0.5 }}>
                            <LocationOn fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </ListItem>
                    {index < displaySellers.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )}
          </Box>
        </Collapse>
      </Box>
    );
  };

  // 福岡（FI）セクションをレンダリング
  const renderFukuokaSection = () => {
    const fiTodayCall = categoryCounts?.fi_todayCall ?? 0;
    const fiTodayCallNotStarted = categoryCounts?.fi_todayCallNotStarted ?? 0;
    const fiTodayCallWithInfo = categoryCounts?.fi_todayCallWithInfo ?? 0;
    const fiUnvaluated = categoryCounts?.fi_unvaluated ?? 0;
    const fiMailingPending = categoryCounts?.fi_mailingPending ?? 0;
    const fiLabelCounts = categoryCounts?.fi_todayCallWithInfoLabelCounts ?? {};
    const fiTotal = fiTodayCall + fiTodayCallNotStarted + fiTodayCallWithInfo + fiUnvaluated + fiMailingPending;

    // FI売主が1件もない場合は表示しない
    if (fiTotal === 0 && Object.keys(fiLabelCounts).length === 0) return null;

    // FI専用カテゴリキーのプレフィックス
    const FI_PREFIX = 'fi:';

    const renderFiButton = (
      categoryKey: StatusCategory,
      label: string,
      count: number,
      color: string,
      indent = false,
    ) => {
      if (count === 0) return null;
      const isExpanded = expandedCategory === categoryKey;
      const active = isActive(categoryKey);
      return (
        <Button
          key={categoryKey}
          fullWidth
          onClick={() => handleCategoryClick(categoryKey)}
          sx={{
            justifyContent: 'space-between',
            textAlign: 'left',
            fontSize: '0.85rem',
            py: 1,
            pl: indent ? 3.5 : 1.5,
            pr: 1.5,
            color: active || isExpanded ? 'white' : color,
            bgcolor: active || isExpanded ? color : 'transparent',
            borderRadius: 1,
            '&:hover': {
              bgcolor: active || isExpanded ? color : `${color}22`,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>{label}</span>
            <Chip
              label={count}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                bgcolor: active || isExpanded ? 'rgba(255,255,255,0.3)' : undefined,
                color: active || isExpanded ? 'white' : undefined,
              }}
            />
          </Box>
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </Button>
      );
    };

    return (
      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'indigo.200', bgcolor: '#e8eaf6', borderRadius: 1, px: 0.5 }}>
        {/* セクションヘッダー */}
        <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', color: '#1a237e', fontWeight: 'bold', fontSize: '0.75rem' }}>
          ── 福岡 ──
        </Typography>

        {/* 当日TEL_未着手（FI） */}
        {renderFiButton(`${FI_PREFIX}todayCallNotStarted` as StatusCategory, '当日TEL_未着手', fiTodayCallNotStarted, '#ff9800')}

        {/* 当日TEL分（FI） */}
        {renderFiButton(`${FI_PREFIX}todayCall` as StatusCategory, '当日TEL分', fiTodayCall, '#d32f2f')}

        {/* 未査定（FI） */}
        {renderFiButton(`${FI_PREFIX}unvaluated` as StatusCategory, '未査定', fiUnvaluated, '#ed6c02')}

        {/* 査定（郵送）（FI） */}
        {renderFiButton(`${FI_PREFIX}mailingPending` as StatusCategory, '査定（郵送）', fiMailingPending, '#0288d1')}

        {/* 当日TEL（内容）ラベル別（FI） */}
        {Object.keys(fiLabelCounts).length > 0
          ? Object.entries(fiLabelCounts).map(([label, count]) => {
              if (!count) return null;
              const catKey = `${FI_PREFIX}todayCallWithInfo:${label}` as StatusCategory;
              return renderFiButton(catKey, label, count, '#9c27b0');
            })
          : fiTodayCallWithInfo > 0
            ? renderFiButton(`${FI_PREFIX}todayCallWithInfo` as StatusCategory, '当日TEL（内容）', fiTodayCallWithInfo, '#9c27b0')
            : null
        }
      </Box>
    );
  };

  // 担当者別カテゴリーをレンダリング
  // assigneeInitials prop（スタッフスプレッドシートから取得）を使用
  const renderAssigneeCategories = () => {
    // assigneeInitialsが空の場合はsellersから動的に取得（フォールバック）
    const initials = assigneeInitials.length > 0
      ? assigneeInitials
      : [...new Set(
          validSellers
            .map((s: any) => s.visitAssigneeInitials || s.visit_assignee || s.visitAssignee || '')
            .filter((a: string) => a && a.trim() !== '' && a.trim() !== '外す')
        )].sort() as string[];

    return initials.map(assignee => {
      // APIから取得した全件カウントを優先して使用（undefinedの場合はvalidSellersからフォールバック）
      const apiAssignedCount = categoryCounts?.visitAssignedCounts?.[assignee];
      const assignedCount = apiAssignedCount !== undefined
        ? apiAssignedCount
        : validSellers.filter(s => isVisitAssignedTo(s, assignee)).length;

      const apiTodayCallCount = categoryCounts?.todayCallAssignedCounts?.[assignee];
      const todayCallCount = apiTodayCallCount !== undefined
        ? apiTodayCallCount
        : validSellers.filter(s => isTodayCallAssignedTo(s, assignee)).length;

      // 担当者に該当する売主がいない場合は表示しない
      if (assignedCount === 0 && todayCallCount === 0) return null;

      const parentCategory = `visitAssigned:${assignee}` as StatusCategory;
      const subCategory = `todayCallAssigned:${assignee}` as StatusCategory;
      const parentColor = '#4caf50';
      const subColor = '#ff5722';
      const isParentActive = isActive(parentCategory);
      const isParentExpanded = expandedCategory === parentCategory;
      const isSubActive = isActive(subCategory);
      const isSubExpanded = expandedCategory === subCategory;

      return (
        <Box key={assignee}>
          {/* 担当(Y)メインカテゴリー - assignedCountを直接使用してrenderCategoryButtonのcount===0チェックを回避 */}
          <Button
            fullWidth
            onClick={() => handleCategoryClick(parentCategory)}
            sx={{
              justifyContent: 'space-between',
              textAlign: 'left',
              fontSize: '0.85rem',
              py: 1,
              px: 1.5,
              color: isParentActive || isParentExpanded ? 'white' : parentColor,
              bgcolor: isParentActive || isParentExpanded ? parentColor : '#e8f5e9',
              borderRadius: 1,
              '&:hover': {
                bgcolor: isParentActive || isParentExpanded ? parentColor : `${parentColor}15`,
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>担当({assignee})</span>
              {assignedCount > 0 && (
                <Chip
                  label={assignedCount}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    bgcolor: isParentActive || isParentExpanded ? 'rgba(255,255,255,0.3)' : undefined,
                    color: isParentActive || isParentExpanded ? 'white' : undefined,
                  }}
                />
              )}
            </Box>
            {isParentExpanded ? <ExpandLess /> : <ExpandMore />}
          </Button>
          {/* ↳ 当日TEL(Y)サブカテゴリー（インデント付き） */}
          {todayCallCount > 0 && (
            <Box sx={{ bgcolor: '#e8f5e9', borderRadius: 1 }}>
              <Button
                fullWidth
                onClick={() => handleCategoryClick(subCategory)}
                sx={{
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                  py: 1,
                  pl: 4,
                  pr: 1.5,
                  color: isSubActive || isSubExpanded ? 'white' : subColor,
                  bgcolor: isSubActive || isSubExpanded ? subColor : 'transparent',
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: isSubActive || isSubExpanded ? subColor : `${subColor}15`,
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>↳ 当日TEL({assignee})</span>
                  <Chip
                    label={todayCallCount}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      bgcolor: isSubActive || isSubExpanded ? 'rgba(255,255,255,0.3)' : undefined,
                      color: isSubActive || isSubExpanded ? 'white' : undefined,
                    }}
                  />
                </Box>
                {isSubExpanded ? <ExpandLess /> : <ExpandMore />}
              </Button>
            </Box>
          )}
          {/* ↳ 訪問後御礼(Y)サブカテゴリー（インデント付き） */}
          {(() => {
            const thankYouCategory = `visitThankYouPending:${assignee}` as StatusCategory;
            const thankYouCount = visitThankYouPendingCounts?.[assignee] ?? 0;
            const isThankYouActive = isActive(thankYouCategory);
            const isThankYouExpanded = expandedCategory === thankYouCategory;
            const thankYouColor = '#e65100'; // 深いオレンジ
            if (thankYouCount === 0) return null;
            return (
              <Box sx={{ bgcolor: '#e8f5e9', borderRadius: 1 }}>
                <Button
                  fullWidth
                  onClick={() => handleCategoryClick(thankYouCategory)}
                  sx={{
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    py: 1,
                    pl: 4,
                    pr: 1.5,
                    color: isThankYouActive || isThankYouExpanded ? 'white' : thankYouColor,
                    bgcolor: isThankYouActive || isThankYouExpanded ? thankYouColor : 'transparent',
                    borderRadius: 1,
                    '&:hover': {
                      bgcolor: isThankYouActive || isThankYouExpanded ? thankYouColor : `${thankYouColor}15`,
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>↳ 訪問後御礼({assignee})</span>
                    <Chip
                      label={thankYouCount}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        bgcolor: isThankYouActive || isThankYouExpanded ? 'rgba(255,255,255,0.3)' : undefined,
                        color: isThankYouActive || isThankYouExpanded ? 'white' : undefined,
                      }}
                    />
                  </Box>
                  {isThankYouExpanded ? <ExpandLess /> : <ExpandMore />}
                </Button>
              </Box>
            );
          })()}

          {/* ↳ 【専任】月別サブカテゴリーは下部の「専任媒介 取得分析」セクションに統合済み */}
        </Box>
      );
    });
  };

  // サイドバー一時追加フィルターセクションをレンダリング
  // フィルタパネルから「サイドバーに一時追加」で作成されたカスタムカテゴリー。
  // 誰が追加したか分かるようラベルに作成者名を含めることを推奨（例:「福岡・空家K」）。
  const renderTempFiltersSection = () => {
    if (!tempFilters || tempFilters.length === 0) return null;
    return (
      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: '#ce93d8', bgcolor: '#faf3fb', borderRadius: 1, px: 0.5 }}>
        <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', color: '#6a1b9a', fontWeight: 'bold', fontSize: '0.75rem' }}>
          ── 一時追加 ──
        </Typography>
        {tempFilters.map((tf) => {
          const active = selectedTempFilterId === tf.id;
          return (
            <Box key={tf.id} sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                fullWidth
                onClick={() => onTempFilterSelect?.(tf)}
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                  py: 1,
                  px: 1.5,
                  color: active ? 'white' : '#6a1b9a',
                  bgcolor: active ? '#8e24aa' : 'transparent',
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: active ? '#8e24aa' : '#6a1b9a15',
                  },
                }}
              >
                <PushPinIcon fontSize="small" sx={{ mr: 1 }} />
                <span>{tf.label}</span>
              </Button>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`「${tf.label}」を削除しますか？`)) {
                    onTempFilterDelete?.(tf.id);
                  }
                }}
                sx={{ ml: -4, color: active ? 'white' : '#6a1b9a' }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          );
        })}
      </Box>
    );
  };

  // 大分セクション見出しをレンダリング
  // 既存のトップレベルカテゴリ（実質的に大分／AA売主の件数）をグルーピングするための見出しラベル。
  // 表示のみの変更であり、件数計算・フィルタリングロジックには影響しない。
  const renderOitaSectionHeader = () => (
    <Typography
      variant="caption"
      sx={{ px: 1.5, py: 0.5, display: 'block', color: '#2e7d32', fontWeight: 'bold', fontSize: '0.75rem' }}
    >
      ── 大分 ──
    </Typography>
  );

  // 全カテゴリ表示モード
  const renderAllCategories = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {/* All */}
      <Button
        fullWidth
        variant={isActive('all') ? 'contained' : 'text'}
        onClick={() => {
          setExpandedCategory(null);
          if (!isCallMode) {
            onCategorySelect?.('all');
          } else {
            sessionStorage.setItem('selectedStatusCategory', 'all');
            navigate('/');
          }
        }}
        sx={{ 
          justifyContent: 'space-between', 
          textAlign: 'left',
          fontSize: '0.85rem',
          py: 1,
          px: 1.5,
          ...(isActive('all') && {
            bgcolor: '#d32f2f',
            '&:hover': { bgcolor: '#c62828' },
          }),
        }}
      >
        <span>All</span>
        {categoryCounts && (
          <Chip label={categoryCounts.all} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
        )}
      </Button>

      {/* 大分セクション見出し（表示グルーピングのみ、データ構造は変更しない） */}
      {renderOitaSectionHeader()}

      {/* 既存の固定カテゴリー（実質的に大分＝AA売主の件数） */}
      {renderCategoryButton('visitPreparationPending', '訪問準備未', '#c62828')}
      {renderCategoryButton('visitDayBefore', '①訪問日前日', '#2e7d32')}
      {renderCategoryButton('todayCallNotStarted', '当日TEL_未着手', '#ff9800')}
      {renderCategoryButton('todayCall', '当日TEL分', '#d32f2f')}
      {renderCategoryButton('unvaluated', '未査定', '#ed6c02')}
      {(() => {
        // todayCallWithInfo のラベルはAPIから取得した全件対象のラベル一覧を優先使用
        // フォールバック: validSellers（表示中の売主のみ）から生成
        let labelCountMap: Record<string, number>;
        if (categoryCounts?.todayCallWithInfoLabelCounts && Object.keys(categoryCounts.todayCallWithInfoLabelCounts).length > 0) {
          labelCountMap = categoryCounts.todayCallWithInfoLabelCounts;
        } else {
          // フォールバック: validSellersから生成
          labelCountMap = {};
          validSellers.filter(isTodayCallWithInfo).forEach(s => {
            const label = getTodayCallWithInfoLabel(s);
            labelCountMap[label] = (labelCountMap[label] || 0) + 1;
          });
        }

        const labels = Object.keys(labelCountMap);
        if (labels.length === 0) {
          return renderCategoryButton('todayCallWithInfo', '当日TEL（内容）', '#9c27b0');
        }

        // ラベルごとに個別ボタンを表示（件数はlabelCountMapから取得）
        // 各ラベルを独立したカテゴリキー todayCallWithInfo:${label} として扱う
        return (
          <>
            {labels.map(label => {
              const count = labelCountMap[label] || 0;
              if (count === 0) return null;
              const categoryKey = `todayCallWithInfo:${label}` as StatusCategory;
              const isExpanded = expandedCategory === categoryKey;
              const active = isActive(categoryKey);
              return (
                <Button
                  key={label}
                  fullWidth
                  onClick={() => handleCategoryClick(categoryKey)}
                  sx={{
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    py: 1,
                    px: 1.5,
                    color: active || isExpanded ? 'white' : '#9c27b0',
                    bgcolor: active || isExpanded ? '#9c27b0' : 'transparent',
                    borderRadius: 1,
                    '&:hover': {
                      bgcolor: active || isExpanded ? '#9c27b0' : '#9c27b015',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{label}</span>
                    <Chip
                      label={count}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        bgcolor: active || isExpanded ? 'rgba(255,255,255,0.3)' : undefined,
                        color: active || isExpanded ? 'white' : undefined,
                      }}
                    />
                  </Box>
                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                </Button>
              );
            })}
          </>
        );
      })()}

      {renderCategoryButton('mailingPending', '⑥査定（郵送）', '#0288d1')}
      {renderCategoryButton('pinrichChangeRequired', 'Pinrich要変更', '#e91e63')}
      {renderCategoryButton('pinrichEmpty', '⑧Pinrich空欄', '#795548')}
      {renderCategoryButton('matching', 'マッチング', '#9c27b0')}
      {renderCategoryButton('sellerPortalAttention', '売却サポート：対応要', '#00897b')}

      {/* マッチング通知（追客中の売主 × 買主の希望条件）：福岡セクションの直前 */}
      <SellerMatchingSidebarSection />

      {/* 担当者別カテゴリー（動的生成・区切り線なし） */}
      {/* assigneeInitialsが空でもsellersから動的取得するため常に表示 */}
      {/* 福岡（FI）セクション：担当（）より上に表示 */}
      {renderFukuokaSection()}

      {/* サイドバー一時追加フィルター（フィルタパネルから追加されたカスタムカテゴリー）：福岡の下・担当の上 */}
      {renderTempFiltersSection()}

      <Box sx={{ mt: 0.5 }}>
        {renderAssigneeCategories()}
      </Box>

      {/* その他のカテゴリー（区切り線付き） */}
      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'grey.200', bgcolor: '#f5f5f5', borderRadius: 1, px: 0.5 }}>
        {renderCategoryButton('exclusive', '専任', '#2e7d32')}
        {renderCategoryButton('general', '一般', '#1565c0')}
        {renderCategoryButton('visitOtherDecision', '訪問後他決', '#ff9800')}
        {renderCategoryButton('unvisitedOtherDecision', '未訪問他決', '#ff5722')}
      </Box>

      {/* 【専任媒介】月別分析セクション（2026年5月以降） */}
      {(() => {
        // 全担当者の月をフラットにまとめてユニーク月リストを作成
        const allMonths = new Map<string, { label: string; yearMonth: string; entries: { assignee: string; count: number; sellerIds: string[] }[] }>();
        Object.entries(exclusiveMonthlySummary).forEach(([assignee, months]) => {
          months.forEach(({ yearMonth, label, count, sellerIds }) => {
            if (!allMonths.has(yearMonth)) {
              allMonths.set(yearMonth, { label, yearMonth, entries: [] });
            }
            allMonths.get(yearMonth)!.entries.push({ assignee, count, sellerIds });
          });
        });

        if (allMonths.size === 0) return null;

        // 月を新しい順にソート
        const sortedMonths = Array.from(allMonths.values()).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));

        return (
          <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'orange', bgcolor: '#fff8f0', borderRadius: 1, px: 0.5 }}>
            <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', color: '#e65100', fontWeight: 'bold', fontSize: '0.75rem' }}>
              ── 専任媒介 取得分析 ──
            </Typography>
            {sortedMonths.map(({ yearMonth, label, entries }) => {
              const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
              // 専用stateを使う（売主リストのexpandedCategoryには影響しない）
              const isExpanded = exclusiveExpandedMonth === yearMonth;
              return (
                <Box key={yearMonth}>
                  {/* 月ヘッダーボタン */}
                  <Button
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation(); // 上位のクリックイベントを止める
                      setExclusiveExpandedMonth(isExpanded ? null : yearMonth);
                    }}
                    sx={{
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                      py: 1,
                      px: 1.5,
                      color: isExpanded ? 'white' : '#e65100',
                      bgcolor: isExpanded ? '#ff6d00' : 'transparent',
                      borderRadius: isExpanded ? '4px 4px 0 0' : 1,
                      '&:hover': { bgcolor: isExpanded ? '#ff6d00' : '#fff3e0' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>【専任媒介】{label}</span>
                      <Chip
                        label={totalCount}
                        size="small"
                        sx={{
                          height: 20, fontSize: '0.7rem',
                          bgcolor: isExpanded ? 'rgba(255,255,255,0.3)' : '#fff3e0',
                          color: isExpanded ? 'white' : '#e65100',
                          fontWeight: 'bold',
                        }}
                      />
                    </Box>
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </Button>

                  {/* 展開：担当者リスト */}
                  <Collapse in={isExpanded}>
                    <Box sx={{ bgcolor: '#fff8f0', border: 1, borderColor: '#ffb74d', borderTop: 0, borderRadius: '0 0 4px 4px' }}>
                      {(() => {
                        // 「次へ」ナビゲーション用：この月の担当者を上から順番につないだキュー
                        const queueStr = entries.map(e => `${e.sellerIds[0]}:${e.assignee}`).join('|');
                        return entries.map(({ assignee, count, sellerIds }, idx) => (
                        <Button
                          key={assignee}
                          fullWidth
                          onClick={() => {
                            if (sellerIds.length > 0) {
                              window.open(`/sellers/${sellerIds[0]}/exclusive-analysis?queue=${encodeURIComponent(queueStr)}&qi=${idx}`, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          sx={{
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            fontSize: '0.82rem',
                            py: 0.75,
                            pl: 3,
                            pr: 1.5,
                            color: '#bf360c',
                            '&:hover': { bgcolor: '#ffe0b2' },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>📊 {assignee}（{count}件）</span>
                          </Box>
                          <Chip
                            label="分析"
                            size="small"
                            sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#ff6d00', color: 'white' }}
                          />
                        </Button>
                        ));
                      })()}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        );
      })()}

      {/* 【他決】月別分析セクション（2026年5月以降） */}
      {(() => {
        const allMonths = new Map<string, { label: string; yearMonth: string; entries: { assignee: string; count: number; sellerIds: string[] }[] }>();
        Object.entries(otherDecisionMonthlySummary).forEach(([assignee, months]) => {
          months.forEach(({ yearMonth, label, count, sellerIds }) => {
            if (!allMonths.has(yearMonth)) {
              allMonths.set(yearMonth, { label, yearMonth, entries: [] });
            }
            allMonths.get(yearMonth)!.entries.push({ assignee, count, sellerIds });
          });
        });

        if (allMonths.size === 0) return null;

        const sortedMonths = Array.from(allMonths.values()).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));

        return (
          <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: '#ef9a9a', bgcolor: '#fff5f5', borderRadius: 1, px: 0.5 }}>
            <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', color: '#c62828', fontWeight: 'bold', fontSize: '0.75rem' }}>
              ── 他決 分析 ──
            </Typography>
            {sortedMonths.map(({ yearMonth, label, entries }) => {
              const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
              const isExpanded = otherDecisionExpandedMonth === yearMonth;
              return (
                <Box key={yearMonth}>
                  <Button
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      setOtherDecisionExpandedMonth(isExpanded ? null : yearMonth);
                    }}
                    sx={{
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                      py: 1,
                      px: 1.5,
                      color: isExpanded ? 'white' : '#c62828',
                      bgcolor: isExpanded ? '#e53935' : 'transparent',
                      borderRadius: isExpanded ? '4px 4px 0 0' : 1,
                      '&:hover': { bgcolor: isExpanded ? '#e53935' : '#ffebee' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>【他決】{label}</span>
                      <Chip
                        label={totalCount}
                        size="small"
                        sx={{
                          height: 20, fontSize: '0.7rem',
                          bgcolor: isExpanded ? 'rgba(255,255,255,0.3)' : '#ffebee',
                          color: isExpanded ? 'white' : '#c62828',
                          fontWeight: 'bold',
                        }}
                      />
                    </Box>
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </Button>
                  <Collapse in={isExpanded}>
                    <Box sx={{ bgcolor: '#fff5f5', border: 1, borderColor: '#ef9a9a', borderTop: 0, borderRadius: '0 0 4px 4px' }}>
                      {(() => {
                        // 「次へ」ナビゲーション用：この月の担当者を上から順番につないだキュー
                        const queueStr = entries.map(e => `${e.sellerIds[0]}:${e.assignee}`).join('|');
                        return entries.map(({ assignee, count, sellerIds }, idx) => (
                        <Button
                          key={assignee}
                          fullWidth
                          onClick={() => {
                            if (sellerIds.length > 0) {
                              window.open(`/sellers/${sellerIds[0]}/other-decision-analysis?queue=${encodeURIComponent(queueStr)}&qi=${idx}`, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          sx={{
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            fontSize: '0.82rem',
                            py: 0.75,
                            pl: 3,
                            pr: 1.5,
                            color: '#b71c1c',
                            '&:hover': { bgcolor: '#ffcdd2' },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>📉 {assignee}（{count}件）</span>
                          </Box>
                          <Chip
                            label="分析"
                            size="small"
                            sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#e53935', color: 'white' }}
                          />
                        </Button>
                        ));
                      })()}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        );
      })()}

      {/* 【未訪問他決】月別セクション（2026年5月以降） */}
      {unvisitedOtherDecisionMonthlySummary.length > 0 && (
        <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: '#ff8a65', bgcolor: '#fff3e0', borderRadius: 1, px: 0.5 }}>
          <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', color: '#bf360c', fontWeight: 'bold', fontSize: '0.75rem' }}>
            ── 未訪問他決 ──
          </Typography>
          {unvisitedOtherDecisionMonthlySummary.map(({ yearMonth, label, count }) => {
            const monthCategory = `unvisitedOtherDecision:${yearMonth}` as StatusCategory;
            const isMonthActive = isActive(monthCategory);
            return (
              <Box key={yearMonth}>
                <Button
                  fullWidth
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCategoryClick(monthCategory);
                  }}
                  sx={{
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    py: 1,
                    px: 1.5,
                    color: isMonthActive ? 'white' : '#bf360c',
                    bgcolor: isMonthActive ? '#ff5722' : 'transparent',
                    borderRadius: 1,
                    '&:hover': { bgcolor: isMonthActive ? '#ff5722' : '#ffe0b2' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>【未訪問他決】{label}</span>
                    <Chip
                      label={count}
                      size="small"
                      sx={{
                        height: 20, fontSize: '0.7rem',
                        bgcolor: isMonthActive ? 'rgba(255,255,255,0.3)' : '#fff3e0',
                        color: isMonthActive ? 'white' : '#bf360c',
                        fontWeight: 'bold',
                      }}
                    />
                  </Box>
                </Button>
              </Box>
            );
          })}
        </Box>
      )}

      {/* 📚 学習ライブラリボタン */}
      <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: '#ce93d8' }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => window.open('/sales-learning-library', '_blank', 'noopener,noreferrer')}
          sx={{
            bgcolor: '#9c27b0',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            py: 1,
            '&:hover': { bgcolor: '#6a1b9a' },
          }}
        >
          📚 営業学習ライブラリ
        </Button>
      </Box>

      {/* 📊 査定サイト統計（統合アコーディオン） */}
      {(sumaiStepMonthlySummary.length > 0 || ieulMonthlySummary.length > 0 || lifullMonthlySummary.length > 0 || home4uMonthlySummary.length > 0) && (
        <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: '#78909c', bgcolor: '#eceff1', borderRadius: 1, px: 0.5 }}>
          {/* 親アコーディオン：査定サイト統計 */}
          <Button
            fullWidth
            onClick={(e) => {
              e.stopPropagation();
              setSiteStatsExpanded(!siteStatsExpanded);
            }}
            sx={{
              justifyContent: 'space-between',
              textAlign: 'left',
              fontSize: '0.85rem',
              py: 1,
              px: 1.5,
              color: siteStatsExpanded ? 'white' : '#37474f',
              bgcolor: siteStatsExpanded ? '#546e7a' : 'transparent',
              borderRadius: siteStatsExpanded ? '4px 4px 0 0' : 1,
              '&:hover': { bgcolor: siteStatsExpanded ? '#546e7a' : '#cfd8dc' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>📊 査定サイト統計</span>
              <Chip
                label={`${[sumaiStepMonthlySummary, ieulMonthlySummary, lifullMonthlySummary, home4uMonthlySummary].filter(s => s.length > 0).length}サイト`}
                size="small"
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#78909c', color: 'white', fontWeight: 'bold' }}
              />
            </Box>
            {siteStatsExpanded ? <ExpandLess /> : <ExpandMore />}
          </Button>
          <Collapse in={siteStatsExpanded}>
            <Box sx={{ bgcolor: '#eceff1', border: 1, borderColor: '#78909c', borderTop: 0, borderRadius: '0 0 4px 4px', p: 0.5 }}>

              {/* すまいステップ集計 */}
              {sumaiStepMonthlySummary.length > 0 && (
                <Box sx={{ mt: 0.5, borderTop: '1px solid', borderColor: '#4db6ac', bgcolor: '#e0f2f1', borderRadius: 1, px: 0.5 }}>
                  <Button
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      setSumaiStepExpandedMonth(sumaiStepExpandedMonth === '__open__' || sumaiStepExpandedMonth ? null : '__open__');
                    }}
                    sx={{
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      fontSize: '0.82rem',
                      py: 0.75,
                      px: 1.5,
                      color: sumaiStepExpandedMonth ? 'white' : '#00695c',
                      bgcolor: sumaiStepExpandedMonth ? '#00897b' : 'transparent',
                      borderRadius: sumaiStepExpandedMonth ? '4px 4px 0 0' : 1,
                      '&:hover': { bgcolor: sumaiStepExpandedMonth ? '#00897b' : '#b2dfdb' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>すまいステップ</span>
                      <Chip
                        label={`取得${sumaiStepMonthlySummary.reduce((sum, m) => sum + m.exclusive + m.general, 0)}件`}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#4db6ac', color: 'white', fontWeight: 'bold' }}
                      />
                    </Box>
                    {sumaiStepExpandedMonth ? <ExpandLess /> : <ExpandMore />}
                  </Button>
                  <Collapse in={!!sumaiStepExpandedMonth}>
                    <Box sx={{ bgcolor: '#e0f2f1', border: 1, borderColor: '#4db6ac', borderTop: 0, borderRadius: '0 0 4px 4px' }}>
                      {sumaiStepMonthlySummary.map(({ yearMonth, label, total, exclusive, general }) => {
                        const isMonthExpanded = sumaiStepExpandedMonth === yearMonth;
                        return (
                          <Box key={yearMonth}>
                            <Button
                              fullWidth
                              onClick={(e) => {
                                e.stopPropagation();
                                setSumaiStepExpandedMonth(isMonthExpanded ? '__open__' : yearMonth);
                              }}
                              sx={{
                                justifyContent: 'space-between',
                                textAlign: 'left',
                                fontSize: '0.78rem',
                                py: 0.5,
                                pl: 3,
                                pr: 1.5,
                                color: isMonthExpanded ? '#004d40' : '#00695c',
                                bgcolor: isMonthExpanded ? '#b2dfdb' : 'transparent',
                                '&:hover': { bgcolor: '#b2dfdb' },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>{label}</span>
                                <Chip
                                  label={`${total}件`}
                                  size="small"
                                  sx={{
                                    height: 18, fontSize: '0.65rem',
                                    bgcolor: isMonthExpanded ? '#4db6ac' : '#b2dfdb',
                                    color: isMonthExpanded ? 'white' : '#00695c',
                                    fontWeight: 'bold',
                                  }}
                                />
                              </Box>
                              {isMonthExpanded ? <ExpandLess /> : <ExpandMore />}
                            </Button>
                            <Collapse in={isMonthExpanded}>
                              <Box sx={{ px: 3, py: 1, bgcolor: '#f1f8f6' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#004d40' }}>依頼数（総数）</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#004d40' }}>{total}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px dashed #4db6ac' }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#00897b', fontWeight: 'bold' }}>→ 媒介取得</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#00897b' }}>{exclusive + general}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#e65100' }}>→ 専任媒介</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#e65100' }}>{exclusive}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#1565c0' }}>→ 一般媒介</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1565c0' }}>{general}件</Typography>
                                </Box>
                              </Box>
                            </Collapse>
                          </Box>
                        );
                      })}
                    </Box>
                  </Collapse>
                </Box>
              )}

              {/* イエウール集計 */}
              {ieulMonthlySummary.length > 0 && (
                <Box sx={{ mt: 0.5, borderTop: '1px solid', borderColor: '#ff8a65', bgcolor: '#fff3e0', borderRadius: 1, px: 0.5 }}>
                  <Button
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      setIeulExpandedMonth(ieulExpandedMonth === '__open__' || ieulExpandedMonth ? null : '__open__');
                    }}
                    sx={{
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      fontSize: '0.82rem',
                      py: 0.75,
                      px: 1.5,
                      color: ieulExpandedMonth ? 'white' : '#e65100',
                      bgcolor: ieulExpandedMonth ? '#f4511e' : 'transparent',
                      borderRadius: ieulExpandedMonth ? '4px 4px 0 0' : 1,
                      '&:hover': { bgcolor: ieulExpandedMonth ? '#f4511e' : '#ffccbc' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>イエウール</span>
                      <Chip
                        label={`取得${ieulMonthlySummary.reduce((sum, m) => sum + m.exclusive + m.general, 0)}件`}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#ff8a65', color: 'white', fontWeight: 'bold' }}
                      />
                    </Box>
                    {ieulExpandedMonth ? <ExpandLess /> : <ExpandMore />}
                  </Button>
                  <Collapse in={!!ieulExpandedMonth}>
                    <Box sx={{ bgcolor: '#fff3e0', border: 1, borderColor: '#ff8a65', borderTop: 0, borderRadius: '0 0 4px 4px' }}>
                      {ieulMonthlySummary.map(({ yearMonth, label, total, exclusive, general }) => {
                        const isMonthExpanded = ieulExpandedMonth === yearMonth;
                        return (
                          <Box key={yearMonth}>
                            <Button
                              fullWidth
                              onClick={(e) => {
                                e.stopPropagation();
                                setIeulExpandedMonth(isMonthExpanded ? '__open__' : yearMonth);
                              }}
                              sx={{
                                justifyContent: 'space-between',
                                textAlign: 'left',
                                fontSize: '0.78rem',
                                py: 0.5,
                                pl: 3,
                                pr: 1.5,
                                color: isMonthExpanded ? '#bf360c' : '#e65100',
                                bgcolor: isMonthExpanded ? '#ffccbc' : 'transparent',
                                '&:hover': { bgcolor: '#ffccbc' },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>{label}</span>
                                <Chip
                                  label={`${total}件`}
                                  size="small"
                                  sx={{
                                    height: 18, fontSize: '0.65rem',
                                    bgcolor: isMonthExpanded ? '#ff8a65' : '#ffccbc',
                                    color: isMonthExpanded ? 'white' : '#e65100',
                                    fontWeight: 'bold',
                                  }}
                                />
                              </Box>
                              {isMonthExpanded ? <ExpandLess /> : <ExpandMore />}
                            </Button>
                            <Collapse in={isMonthExpanded}>
                              <Box sx={{ px: 3, py: 1, bgcolor: '#fbe9e7' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#bf360c' }}>依頼数（総数）</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#bf360c' }}>{total}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px dashed #ff8a65' }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#f4511e', fontWeight: 'bold' }}>→ 媒介取得</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#f4511e' }}>{exclusive + general}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#e65100' }}>→ 専任媒介</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#e65100' }}>{exclusive}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#1565c0' }}>→ 一般媒介</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1565c0' }}>{general}件</Typography>
                                </Box>
                              </Box>
                            </Collapse>
                          </Box>
                        );
                      })}
                    </Box>
                  </Collapse>
                </Box>
              )}

              {/* LIFULL集計 */}
              {lifullMonthlySummary.length > 0 && (
                <Box sx={{ mt: 0.5, borderTop: '1px solid', borderColor: '#90caf9', bgcolor: '#e3f2fd', borderRadius: 1, px: 0.5 }}>
                  <Button
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      setLifullExpandedMonth(lifullExpandedMonth === '__open__' || lifullExpandedMonth ? null : '__open__');
                    }}
                    sx={{
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      fontSize: '0.82rem',
                      py: 0.75,
                      px: 1.5,
                      color: lifullExpandedMonth ? 'white' : '#1565c0',
                      bgcolor: lifullExpandedMonth ? '#1976d2' : 'transparent',
                      borderRadius: lifullExpandedMonth ? '4px 4px 0 0' : 1,
                      '&:hover': { bgcolor: lifullExpandedMonth ? '#1976d2' : '#bbdefb' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>LIFULL</span>
                      <Chip
                        label={`取得${lifullMonthlySummary.reduce((sum, m) => sum + m.exclusive + m.general, 0)}件`}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#90caf9', color: 'white', fontWeight: 'bold' }}
                      />
                    </Box>
                    {lifullExpandedMonth ? <ExpandLess /> : <ExpandMore />}
                  </Button>
                  <Collapse in={!!lifullExpandedMonth}>
                    <Box sx={{ bgcolor: '#e3f2fd', border: 1, borderColor: '#90caf9', borderTop: 0, borderRadius: '0 0 4px 4px' }}>
                      {lifullMonthlySummary.map(({ yearMonth, label, total, exclusive, general }) => {
                        const isMonthExpanded = lifullExpandedMonth === yearMonth;
                        return (
                          <Box key={yearMonth}>
                            <Button
                              fullWidth
                              onClick={(e) => {
                                e.stopPropagation();
                                setLifullExpandedMonth(isMonthExpanded ? '__open__' : yearMonth);
                              }}
                              sx={{
                                justifyContent: 'space-between',
                                textAlign: 'left',
                                fontSize: '0.78rem',
                                py: 0.5,
                                pl: 3,
                                pr: 1.5,
                                color: isMonthExpanded ? '#0d47a1' : '#1565c0',
                                bgcolor: isMonthExpanded ? '#bbdefb' : 'transparent',
                                '&:hover': { bgcolor: '#bbdefb' },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>{label}</span>
                                <Chip
                                  label={`${total}件`}
                                  size="small"
                                  sx={{
                                    height: 18, fontSize: '0.65rem',
                                    bgcolor: isMonthExpanded ? '#90caf9' : '#bbdefb',
                                    color: isMonthExpanded ? 'white' : '#1565c0',
                                    fontWeight: 'bold',
                                  }}
                                />
                              </Box>
                              {isMonthExpanded ? <ExpandLess /> : <ExpandMore />}
                            </Button>
                            <Collapse in={isMonthExpanded}>
                              <Box sx={{ px: 3, py: 1, bgcolor: '#e8f4fd' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#0d47a1' }}>依頼数（総数）</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0d47a1' }}>{total}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px dashed #90caf9' }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#1976d2', fontWeight: 'bold' }}>→ 媒介取得</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1976d2' }}>{exclusive + general}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#e65100' }}>→ 専任媒介</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#e65100' }}>{exclusive}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#1565c0' }}>→ 一般媒介</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1565c0' }}>{general}件</Typography>
                                </Box>
                              </Box>
                            </Collapse>
                          </Box>
                        );
                      })}
                    </Box>
                  </Collapse>
                </Box>
              )}

              {/* HOME4U集計 */}
              {home4uMonthlySummary.length > 0 && (
                <Box sx={{ mt: 0.5, borderTop: '1px solid', borderColor: '#ce93d8', bgcolor: '#f3e5f5', borderRadius: 1, px: 0.5 }}>
                  <Button
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      setHome4uExpandedMonth(home4uExpandedMonth === '__open__' || home4uExpandedMonth ? null : '__open__');
                    }}
                    sx={{
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      fontSize: '0.82rem',
                      py: 0.75,
                      px: 1.5,
                      color: home4uExpandedMonth ? 'white' : '#6a1b9a',
                      bgcolor: home4uExpandedMonth ? '#8e24aa' : 'transparent',
                      borderRadius: home4uExpandedMonth ? '4px 4px 0 0' : 1,
                      '&:hover': { bgcolor: home4uExpandedMonth ? '#8e24aa' : '#e1bee7' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>HOME4U</span>
                      <Chip
                        label={`取得${home4uMonthlySummary.reduce((sum, m) => sum + m.exclusive + m.general, 0)}件`}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#ce93d8', color: 'white', fontWeight: 'bold' }}
                      />
                    </Box>
                    {home4uExpandedMonth ? <ExpandLess /> : <ExpandMore />}
                  </Button>
                  <Collapse in={!!home4uExpandedMonth}>
                    <Box sx={{ bgcolor: '#f3e5f5', border: 1, borderColor: '#ce93d8', borderTop: 0, borderRadius: '0 0 4px 4px' }}>
                      {home4uMonthlySummary.map(({ yearMonth, label, total, exclusive, general }) => {
                        const isMonthExpanded = home4uExpandedMonth === yearMonth;
                        return (
                          <Box key={yearMonth}>
                            <Button
                              fullWidth
                              onClick={(e) => {
                                e.stopPropagation();
                                setHome4uExpandedMonth(isMonthExpanded ? '__open__' : yearMonth);
                              }}
                              sx={{
                                justifyContent: 'space-between',
                                textAlign: 'left',
                                fontSize: '0.78rem',
                                py: 0.5,
                                pl: 3,
                                pr: 1.5,
                                color: isMonthExpanded ? '#4a148c' : '#6a1b9a',
                                bgcolor: isMonthExpanded ? '#e1bee7' : 'transparent',
                                '&:hover': { bgcolor: '#e1bee7' },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>{label}</span>
                                <Chip
                                  label={`${total}件`}
                                  size="small"
                                  sx={{
                                    height: 18, fontSize: '0.65rem',
                                    bgcolor: isMonthExpanded ? '#ce93d8' : '#e1bee7',
                                    color: isMonthExpanded ? 'white' : '#6a1b9a',
                                    fontWeight: 'bold',
                                  }}
                                />
                              </Box>
                              {isMonthExpanded ? <ExpandLess /> : <ExpandMore />}
                            </Button>
                            <Collapse in={isMonthExpanded}>
                              <Box sx={{ px: 3, py: 1, bgcolor: '#fce4ec' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#4a148c' }}>依頼数（総数）</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#4a148c' }}>{total}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px dashed #ce93d8' }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#8e24aa', fontWeight: 'bold' }}>→ 媒介取得</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#8e24aa' }}>{exclusive + general}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#e65100' }}>→ 専任媒介</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#e65100' }}>{exclusive}件</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#1565c0' }}>→ 一般媒介</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1565c0' }}>{general}件</Typography>
                                </Box>
                              </Box>
                            </Collapse>
                          </Box>
                        );
                      })}
                    </Box>
                  </Collapse>
                </Box>
              )}

            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );

  // 展開モード
  const renderExpandedCategory = () => {
    if (!expandedCategory) return null;
    
    const label = getCategoryLabel(expandedCategory);
    const color = getCategoryColor(expandedCategory);
    // MUI文字列をHEXに変換（後方互換性）
    const hexColor = color === 'error.main' ? '#d32f2f' :
      color === 'secondary.main' ? '#9c27b0' :
      color === 'warning.main' ? '#ed6c02' :
      color === 'info.main' ? '#0288d1' : color;
    
    return (
      <Box>
        {renderCategoryButton(expandedCategory, label, hexColor)}
      </Box>
    );
  };

  return (
    <Paper sx={{ width: 280, flexShrink: 0, p: 2 }}>
      {/* タイトル（クリックで全カテゴリ表示に戻る） */}
      <Button
        fullWidth
        onClick={handleTitleClick}
        sx={{ 
          justifyContent: 'space-between',
          textAlign: 'left',
          mb: 1,
          py: 1,
          px: 1,
          bgcolor: expandedCategory ? 'grey.100' : 'transparent',
          '&:hover': { bgcolor: 'grey.200' },
        }}
      >
        <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 'bold' }}>
          売主リスト
        </Typography>
        {expandedCategory && <ExpandMore />}
      </Button>
      
      {/* ローディング中の表示 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
          <CircularProgress size={24} />
          <Typography variant="body2" sx={{ ml: 1 }}>読み込み中...</Typography>
        </Box>
      ) : (
        expandedCategory ? renderExpandedCategory() : renderAllCategories()
      )}
    </Paper>
  );
}

// React.memoで最適化（propsが変更されない限り再レンダリングしない）
export default memo(SellerStatusSidebarComponent);
