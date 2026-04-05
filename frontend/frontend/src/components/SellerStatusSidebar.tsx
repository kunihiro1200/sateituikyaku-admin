/**
 * SellerStatusSidebar - 売主ステータスサイドバーコンポーネント
 * 
 * 売主リストページと通話モードページで共通で使用するサイドバー
 * 現在の売主がどのステータスカテゴリに属するかをハイライト表示
 */

import { useState, useEffect } from 'react';
import { Paper, Typography, Box, Button, Chip, Collapse, IconButton, List, ListItem, Divider, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ExpandMore, ExpandLess, Edit, Email, Phone, Chat, LocationOn } from '@mui/icons-material';
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
  isVisitAssignedTo,
  isTodayCallAssignedTo,
  isTodayCallAssigned,
  isVisitDayBefore,
  isVisitScheduled,
  isVisitCompleted,
  isUnvisitedOtherDecision,
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
}

/**
 * 売主がどのステータスカテゴリに属するかを判定
 */
const getSellerCategory = (seller: Seller | any): StatusCategory | null => {
  if (!seller) return null;
  
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
  
  if (typeof category === 'string' && category.startsWith('visitAssigned:')) {
    const assignee = category.replace('visitAssigned:', '');
    return sellers.filter(s => isVisitAssignedTo(s, assignee));
  }
  if (typeof category === 'string' && category.startsWith('todayCallAssigned:')) {
    const assignee = category.replace('todayCallAssigned:', '');
    return sellers.filter(s => isTodayCallAssignedTo(s, assignee));
  }
  if (typeof category === 'string' && category.startsWith('todayCallWithInfo:')) {
    const targetLabel = category.replace('todayCallWithInfo:', '');
    return sellers.filter(s => isTodayCallWithInfo(s) && getTodayCallWithInfoLabel(s) === targetLabel);
  }

  switch (category) {
    case 'todayCall':
      return sellers.filter(isTodayCall);
    case 'todayCallWithInfo':
      return sellers.filter(isTodayCallWithInfo);
    case 'unvaluated':
      return sellers.filter(isUnvaluated);
    case 'mailingPending':
      return sellers.filter(isMailingPending);
    case 'todayCallNotStarted':
      return sellers.filter(isTodayCallNotStarted);
    case 'pinrichEmpty':
      return sellers.filter(isPinrichEmpty);
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
    case 'pinrichEmpty':
      return '⑧Pinrich空欄';
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
    case 'pinrichEmpty':
      return '#795548';
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
      return '#555555';
  }
};

export default function SellerStatusSidebar({
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
}: SellerStatusSidebarProps) {
  const navigate = useNavigate();
  
  const validSellers = Array.isArray(sellers) ? sellers : [];
  
  // 展開中のカテゴリ（nullの場合は全カテゴリ表示）
  const [expandedCategory, setExpandedCategory] = useState<StatusCategory | null>(null);
  
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
    navigate(`/sellers/${sellerId}/call`);
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
            <Box sx={{ pl: 2 }}>
              <Button
                fullWidth
                onClick={() => handleCategoryClick(subCategory)}
                sx={{
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                  py: 1,
                  px: 1.5,
                  color: isSubActive || isSubExpanded ? 'white' : subColor,
                  bgcolor: isSubActive || isSubExpanded ? subColor : '#e8f5e9',
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
        </Box>
      );
    });
  };

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

      {/* 既存の固定カテゴリー */}
      {renderCategoryButton('todayCallNotStarted', '当日TEL_未着手', '#ff9800')}
      {renderCategoryButton('unvaluated', '未査定', '#ed6c02')}
      {renderCategoryButton('todayCall', '当日TEL分', '#d32f2f')}
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

      {/* 担当者別カテゴリー（動的生成・区切り線なし） */}
      {/* assigneeInitialsが空でもsellersから動的取得するため常に表示 */}
      <Box sx={{ mt: 0.5 }}>
        {renderAssigneeCategories()}
      </Box>

      {/* その他のカテゴリー（区切り線付き） */}
      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'grey.200', bgcolor: '#f5f5f5', borderRadius: 1, px: 0.5 }}>
        {renderCategoryButton('visitDayBefore', '訪問日前日', '#2e7d32')}
        {renderCategoryButton('mailingPending', '査定（郵送）', '#0288d1')}
        {renderCategoryButton('pinrichEmpty', 'Pinrich空欄', '#795548')}
        {renderCategoryButton('exclusive', '専任', '#2e7d32')}
        {renderCategoryButton('general', '一般', '#1565c0')}
        {renderCategoryButton('visitOtherDecision', '訪問後他決', '#ff9800')}
        {renderCategoryButton('unvisitedOtherDecision', '未訪問他決', '#ff5722')}
      </Box>
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
