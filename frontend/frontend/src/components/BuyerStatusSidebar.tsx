import { useState } from 'react';
import {
  Box,
  Typography,
  ListItemButton,
  ListItemText,
  Badge,
  CircularProgress,
} from '@mui/material';

interface StatusCategory {
  status: string;
  count: number;
  priority: number;
  color: string;
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
  // 外から渡されるカテゴリデータ（BuyersPage が管理）
  categories?: StatusCategory[];
  normalStaffInitials?: string[];
  loading?: boolean;
}

// 担当カテゴリかどうか判定（「担当(X)」「当日TEL(X)」形式）
function isAssigneeCategory(status: string): boolean {
  return /^担当\((.+)\)$/.test(status) || /^当日TEL\((.+)\)$/.test(status);
}

// 担当カテゴリからイニシャルを抽出
function extractInitial(status: string): string {
  const m = status.match(/^(?:担当|当日TEL)\((.+)\)$/);
  return m ? m[1] : '';
}

export default function BuyerStatusSidebar({
  selectedStatus,
  onStatusSelect,
  totalCount = 0,
  categories = [],
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

  // 担当カテゴリと通常カテゴリを分離
  const filteredCategories = categories.filter((cat: StatusCategory) => cat.count > 0);
  const normalCategories = filteredCategories.filter(cat => !isAssigneeCategory(cat.status) && cat.status !== '');
  const assigneeCategories = filteredCategories.filter(cat => {
    if (!isAssigneeCategory(cat.status)) return false;
    if (normalStaffInitials.length === 0) return true;
    const initial = extractInitial(cat.status);
    return normalStaffInitials.includes(initial);
  });

  const renderCategoryItem = (category: StatusCategory) => {
    const isTodayCallSub = /^当日TEL\((.+)\)$/.test(category.status);
    const isVisitCompletedSub = /^訪問済み\((.+)\)$/.test(category.status);
    const isIndented = isTodayCallSub || isVisitCompletedSub;
    
    return (
      <ListItemButton
        key={category.status}
        selected={selectedStatus === category.status}
        onClick={() => handleStatusClick(category.status)}
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
          primary={isIndented ? `↳ ${category.status}` : (category.status || '（未分類）')}
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

        {/* 通常ステータスカテゴリ */}
        {normalCategories.map(renderCategoryItem)}

        {/* 担当カテゴリ（後尾・薄いグレー背景） */}
        {assigneeCategories.length > 0 && (
          <Box sx={{ backgroundColor: '#f5f5f5', mt: 1, borderTop: '1px solid #e0e0e0' }}>
            <Typography
              variant="caption"
              sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 'bold' }}
            >
              担当別
            </Typography>
            {assigneeCategories.map(renderCategoryItem)}
          </Box>
        )}
      </Box>
    </Box>
  );
}
