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
  /** 通話モードページかどうか */
  isCallMode?: boolean;
  /** 売主リスト（展開時に表示する売主データ） */
  sellers?: any[];
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
  if (isTodayCallWithInfo(seller)) return 'todayCallWithInfo';
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
    default:
      return sellers;
  }
};

/**
 * カテゴリの表示名を取得
 */
const getCategoryLabel = (category: StatusCategory): string => {
  switch (category) {
    case 'todayCall':
      return '①当日TEL分';
    case 'todayCallWithInfo':
      return '②当日TEL（内容）';
    case 'unvaluated':
      return '③未査定';
    case 'mailingPending':
      return '④査定（郵送）';
    case 'all':
      return 'All';
    default:
      return '';
  }
};

/**
 * カテゴリの色を取得
 */
const getCategoryColor = (category: StatusCategory): string => {
  switch (category) {
    case 'todayCall':
      return 'error.main';
    case 'todayCallWithInfo':
      return 'secondary.main';
    case 'unvaluated':
      return 'warning.main';
    case 'mailingPending':
      return 'info.main';
    default:
      return 'text.primary';
  }
};

export default function SellerStatusSidebar({
  currentSeller,
  categoryCounts,
  selectedCategory,
  onCategorySelect,
  isCallMode = false,
  sellers = [],
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
    const filteredSellers = filterSellersByCategory(validSellers, category);
    
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
            
            {filteredSellers.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  該当する売主がいません
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {filteredSellers.map((seller, index) => (
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
                    {index < filteredSellers.length - 1 && <Divider />}
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
      // APIから取得した全件カウントを優先して使用
      const assignedCount = categoryCounts?.visitAssignedCounts
        ? (categoryCounts.visitAssignedCounts[assignee] ?? 0)
        : validSellers.filter(s => isVisitAssignedTo(s, assignee)).length;

      const todayCallCount = categoryCounts?.todayCallAssignedCounts
        ? (categoryCounts.todayCallAssignedCounts[assignee] ?? 0)
        : validSellers.filter(s => isTodayCallAssignedTo(s, assignee)).length;

      // 担当者に該当する売主がいない場合は表示しない
      if (assignedCount === 0 && todayCallCount === 0) return null;

      return (
        <Box key={assignee}>
          {/* 担当（Y）メインカテゴリー */}
          {renderCategoryButton(
            `visitAssigned:${assignee}` as StatusCategory,
            `担当（${assignee}）`,
            '#ff5722'
          )}
          {/* 当日TEL(Y)サブカテゴリー（インデント付き） */}
          {todayCallCount > 0 && (
            <Box sx={{ pl: 2 }}>
              {renderCategoryButton(
                `todayCallAssigned:${assignee}` as StatusCategory,
                `当日TEL(${assignee})`,
                '#ff5722'
              )}
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
        }}
      >
        <span>All</span>
        {categoryCounts && (
          <Chip label={categoryCounts.all} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
        )}
      </Button>

      {/* 既存の固定カテゴリー */}
      {renderCategoryButton('visitDayBefore', '①訪問日前日', '#2e7d32')}
      {renderCategoryButton('todayCall', '③当日TEL分', '#d32f2f')}
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
          return renderCategoryButton('todayCallWithInfo', '②当日TEL（内容）', '#9c27b0');
        }

        // ラベルごとに個別ボタンを表示（件数はlabelCountMapから取得）
        return (
          <>
            {labels.map(label => {
              const count = labelCountMap[label] || 0;
              if (count === 0) return null;
              const isExpanded = expandedCategory === 'todayCallWithInfo';
              const active = isActive('todayCallWithInfo');
              return (
                <Button
                  key={label}
                  fullWidth
                  onClick={() => handleCategoryClick('todayCallWithInfo')}
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
                  <ExpandMore />
                </Button>
              );
            })}
          </>
        );
      })()}
      {renderCategoryButton('unvaluated', '③未査定', '#ed6c02')}
      {renderCategoryButton('mailingPending', '④査定（郵送）', '#0288d1')}
      {renderCategoryButton('todayCallNotStarted', '⑦当日TEL_未着手', '#ff9800')}
      {renderCategoryButton('pinrichEmpty', '⑧Pinrich空欄', '#795548')}

      {/* 担当者別カテゴリー（動的生成・区切り線付き） */}
      {/* assigneeInitialsが空でもsellersから動的取得するため常に表示 */}
      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'grey.200', bgcolor: '#fff8f5', borderRadius: 1, px: 0.5 }}>
        {renderAssigneeCategories()}
      </Box>
    </Box>
  );

  // 展開モード
  const renderExpandedCategory = () => {
    if (!expandedCategory) return null;
    
    const label = getCategoryLabel(expandedCategory);
    const color = getCategoryColor(expandedCategory);
    
    return (
      <Box>
        {renderCategoryButton(
          expandedCategory, 
          label, 
          color === 'error.main' ? '#d32f2f' :
          color === 'secondary.main' ? '#9c27b0' :
          color === 'warning.main' ? '#ed6c02' :
          color === 'info.main' ? '#0288d1' : '#000'
        )}
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
