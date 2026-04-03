import { useState } from 'react';
import {
  Box,
  Typography,
  ListItemButton,
  ListItemText,
  Badge,
  CircularProgress,
} from '@mui/material';

interface CategoryCounts {
  all?: number;
  todayCall?: number;
  todayCallWithInfo?: number;
  todayCallAssigned?: number;
  visitDayBefore?: number;
  visitCompleted?: number;
  unvaluated?: number;
  mailingPending?: number;
  todayCallNotStarted?: number;
  pinrichEmpty?: number;
  exclusive?: number;
  general?: number;
  visitOtherDecision?: number;
  unvisitedOtherDecision?: number;
  visitAssignedCounts?: Record<string, number>;
  todayCallAssignedCounts?: Record<string, number>;
  todayCallWithInfoLabels?: string[];
  todayCallWithInfoLabelCounts?: Record<string, number>;
}

export interface BuyerWithStatus {
  buyer_number: string;
  name: string;
  phone_number: string;
  email: string;
  property_number: string;
  latest_status: string;
  initial_assignee: string;
  follow_up_assignee: string;
  inquiry_confidence: string;
  reception_date: string;
  next_call_date: string;
  calculated_status: string;
  status_priority: number;
  [key: string]: any;
}

interface BuyerStatusSidebarProps {
  selectedStatus: string | null;
  onStatusSelect: (status: string | null) => void;
  totalCount?: number;
  // 外から渡されるカウントデータ（BuyersPage が管理）
  categoryCounts?: CategoryCounts | null;
  normalStaffInitials?: string[];
  loading?: boolean;
}

// カテゴリの色を取得
function getCategoryColor(category: string): string {
  switch (category) {
    case 'visitDayBefore':
      return '#2e7d32';
    case 'visitCompleted':
      return '#1565c0';
    case 'todayCall':
      return '#d32f2f';
    case 'todayCallWithInfo':
      return '#9c27b0';
    case 'unvaluated':
      return '#ed6c02';
    case 'mailingPending':
      return '#0288d1';
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
      if (category.startsWith('visitAssigned:')) {
        return '#4caf50';
      }
      if (category.startsWith('todayCallAssigned:')) {
        return '#ff5722';
      }
      if (category.startsWith('todayCallWithInfo:')) {
        return '#9c27b0';
      }
      return '#555555';
  }
}

// カテゴリの表示名を取得
function getCategoryLabel(category: string): string {
  switch (category) {
    case 'visitDayBefore':
      return '①内覧日前日';
    case 'visitCompleted':
      return '②内覧済み';
    case 'todayCall':
      return '③当日TEL分';
    case 'todayCallWithInfo':
      return '④当日TEL（内容）';
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
      return '内覧後他決';
    case 'unvisitedOtherDecision':
      return '未内覧他決';
    default:
      if (category.startsWith('visitAssigned:')) {
        return `担当(${category.replace('visitAssigned:', '')})`;
      }
      if (category.startsWith('todayCallAssigned:')) {
        return `当日TEL(${category.replace('todayCallAssigned:', '')})`;
      }
      if (category.startsWith('todayCallWithInfo:')) {
        return category.replace('todayCallWithInfo:', '');
      }
      return category;
  }
}

export default function BuyerStatusSidebar({
  selectedStatus,
  onStatusSelect,
  totalCount = 0,
  categoryCounts = null,
  normalStaffInitials = [],
  loading = false,
}: BuyerStatusSidebarProps) {

  const handleStatusClick = (status: string) => {
    if (selectedStatus === status) {
      onStatusSelect(null);
    } else {
      onStatusSelect(status);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!categoryCounts) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">データを読み込み中...</Typography>
      </Box>
    );
  }

  // カテゴリリストを構築
  const categoryList: Array<{ key: string; label: string; count: number; color: string }> = [];

  // 固定カテゴリ
  const fixedCategories = [
    'visitDayBefore',
    'visitCompleted',
    'todayCall',
    'todayCallWithInfo',
    'unvaluated',
    'mailingPending',
    'todayCallNotStarted',
    'pinrichEmpty',
    'exclusive',
    'general',
    'visitOtherDecision',
    'unvisitedOtherDecision',
  ];

  fixedCategories.forEach(key => {
    const count = (categoryCounts as any)[key] ?? 0;
    if (count > 0) {
      categoryList.push({
        key,
        label: getCategoryLabel(key),
        count,
        color: getCategoryColor(key),
      });
    }
  });

  // 担当者別カテゴリ（visitAssignedCounts）
  if (categoryCounts.visitAssignedCounts) {
    Object.entries(categoryCounts.visitAssignedCounts).forEach(([assignee, count]) => {
      if (count > 0 && normalStaffInitials.includes(assignee)) {
        const key = `visitAssigned:${assignee}`;
        categoryList.push({
          key,
          label: getCategoryLabel(key),
          count,
          color: getCategoryColor(key),
        });
      }
    });
  }

  // 当日TEL担当者別カテゴリ（todayCallAssignedCounts）
  if (categoryCounts.todayCallAssignedCounts) {
    Object.entries(categoryCounts.todayCallAssignedCounts).forEach(([assignee, count]) => {
      if (count > 0 && normalStaffInitials.includes(assignee)) {
        const key = `todayCallAssigned:${assignee}`;
        categoryList.push({
          key,
          label: getCategoryLabel(key),
          count,
          color: getCategoryColor(key),
        });
      }
    });
  }

  // 当日TEL（内容）ラベル別カテゴリ
  if (categoryCounts.todayCallWithInfoLabelCounts) {
    Object.entries(categoryCounts.todayCallWithInfoLabelCounts).forEach(([label, count]) => {
      if (count > 0) {
        const key = `todayCallWithInfo:${label}`;
        categoryList.push({
          key,
          label: getCategoryLabel(key),
          count,
          color: getCategoryColor(key),
        });
      }
    });
  }

  const renderCategoryItem = (category: { key: string; label: string; count: number; color: string }) => {
    const isTodayCallSub = category.key.startsWith('todayCallAssigned:');
    const isVisitCompletedSub = category.key.startsWith('visitCompleted:');
    const isIndented = isTodayCallSub || isVisitCompletedSub;
    
    return (
      <ListItemButton
        key={category.key}
        selected={selectedStatus === category.key}
        onClick={() => handleStatusClick(category.key)}
        sx={{
          py: 1,
          pl: isIndented ? 4 : 2,
          '&.Mui-selected': {
            backgroundColor: `${category.color}15`,
          },
          '&:hover': {
            backgroundColor: `${category.color}10`,
          }
        }}
      >
        <ListItemText
          primary={isIndented ? `↳ ${category.label}` : category.label}
          primaryTypographyProps={{ variant: 'body2', color: isIndented ? 'text.secondary' : 'text.primary' }}
          sx={{ flex: 1, minWidth: 0, mr: 1 }}
        />
        <Badge
          badgeContent={category.count}
          sx={{
            ml: 1,
            '& .MuiBadge-badge': {
              backgroundColor: category.color,
              color: '#fff'
            }
          }}
          max={9999}
        />
      </ListItemButton>
    );
  };

  return (
    <Box>
      <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
        <Typography variant="subtitle1" fontWeight="bold">ステータス</Typography>
      </Box>

      <Box>
        {/* All カテゴリ */}
        <ListItemButton
          selected={!selectedStatus}
          onClick={() => onStatusSelect(null)}
          sx={{ py: 1 }}
        >
          <ListItemText
            primary="All"
            primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold' }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <Badge
            badgeContent={totalCount}
            color="success"
            max={9999}
            sx={{ ml: 1 }}
          />
        </ListItemButton>

        {/* カテゴリリスト */}
        {categoryList.map(renderCategoryItem)}
      </Box>
    </Box>
  );
}
