import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  ListItemButton,
  ListItemText,
  Badge,
  CircularProgress,
} from '@mui/material';
import api from '../services/api';

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
  onBuyersLoaded?: (buyers: BuyerWithStatus[]) => void;
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
  totalCount: totalCountProp,
  onBuyersLoaded,
}: BuyerStatusSidebarProps) {
  const [categories, setCategories] = useState<StatusCategory[]>([]);
  const [normalStaffInitials, setNormalStaffInitials] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalTotalCount, setInternalTotalCount] = useState(0);

  useEffect(() => {
    fetchStatusCategoriesTwoPhase();
  }, []);

  // 2段階ロード：まずカウントのみ表示し、バックグラウンドで買主データを取得
  const fetchStatusCategoriesTwoPhase = async () => {
    try {
      setLoading(true);

      // Phase 1: カウントのみ先に取得してサイドバーを即座に表示
      const phase1Res = await api.get('/api/buyers/status-categories-only');
      const { categories: phase1Data, normalStaffInitials: initials } = phase1Res.data as {
        categories: StatusCategory[];
        normalStaffInitials: string[];
        fromCache: boolean;
      };

      const total = phase1Data.reduce((sum: number, cat: StatusCategory) => sum + cat.count, 0);
      setInternalTotalCount(total);
      setCategories(phase1Data.filter((cat: StatusCategory) => cat.count > 0));
      setNormalStaffInitials(initials || []);
      setLoading(false); // サイドバーをすぐに表示

      // Phase 2: バックグラウンドで買主データを取得（テーブル表示用）
      if (onBuyersLoaded) {
        try {
          const phase2Res = await api.get('/api/buyers/status-categories-with-buyers');
          const { buyers, categories: updatedCategories, normalStaffInitials: updatedInitials } = phase2Res.data as {
            categories: StatusCategory[];
            buyers: BuyerWithStatus[];
            normalStaffInitials: string[];
          };

          // カテゴリも最新データで更新
          const updatedTotal = updatedCategories.reduce((sum: number, cat: StatusCategory) => sum + cat.count, 0);
          setInternalTotalCount(updatedTotal);
          setCategories(updatedCategories.filter((cat: StatusCategory) => cat.count > 0));
          setNormalStaffInitials(updatedInitials || []);

          onBuyersLoaded(buyers);
        } catch (phase2Error) {
          console.error('Failed to fetch buyers data (phase 2):', phase2Error);
        }
      }
    } catch (error) {
      console.error('Failed to fetch status categories:', error);
      setLoading(false);
    }
  };

  const handleStatusClick = (status: string) => {
    if (selectedStatus === status) {
      onStatusSelect(null);
    } else {
      onStatusSelect(status);
    }
  };

  const displayTotalCount = totalCountProp ?? internalTotalCount;

  if (loading) {
    return (
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // 担当カテゴリと通常カテゴリを分離
  // 担当カテゴリは通常スタッフ（is_normal=true）のみ表示
  const normalCategories = categories.filter(cat => !isAssigneeCategory(cat.status));
  const assigneeCategories = categories.filter(cat => {
    if (!isAssigneeCategory(cat.status)) return false;
    // normalStaffInitialsが空の場合は全担当カテゴリを表示（フォールバック）
    if (normalStaffInitials.length === 0) return true;
    const initial = extractInitial(cat.status);
    // 当日TEL(X) は担当(X) と同じイニシャルなので同じフィルタを適用
    return normalStaffInitials.includes(initial);
  });

  const renderCategoryItem = (category: StatusCategory) => {
    const isTodayCallSub = /^当日TEL\((.+)\)$/.test(category.status);
    return (
      <ListItemButton
        key={category.status}
        selected={selectedStatus === category.status}
        onClick={() => handleStatusClick(category.status)}
        sx={{
          py: 1,
          pl: isTodayCallSub ? 4 : 2,
          borderLeft: `4px solid ${category.color}`,
          '&.Mui-selected': {
            backgroundColor: `${category.color}15`,
            borderLeft: `4px solid ${category.color}`,
          },
          '&:hover': {
            backgroundColor: `${category.color}10`,
          }
        }}
      >
        <ListItemText
          primary={isTodayCallSub ? `↳ ${category.status}` : (category.status || '（未分類）')}
          primaryTypographyProps={{ variant: 'body2', color: isTodayCallSub ? 'text.secondary' : 'text.primary' }}
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
            badgeContent={displayTotalCount}
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
