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
  viewingDayBefore?: number;
  todayCall?: number;
  threeCallUnchecked?: number;  // ３回架電未カテゴリ（新規）
  assignedCounts?: Record<string, number>;
  todayCallAssignedCounts?: Record<string, number>;
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
    case 'viewingDayBefore':
      return '#d32f2f'; // 赤
    case 'todayCall':
      return '#555555'; // グレー
    case 'threeCallUnchecked':
      return '#d32f2f'; // 赤
    case 'todayCallAssigned':
      return '#ff5722'; // オレンジ
    default:
      if (category.startsWith('assigned:')) {
        return '#4caf50'; // 緑（担当）
      }
      if (category.startsWith('todayCallAssigned:')) {
        return '#ff5722'; // オレンジ（当日TEL担当）
      }
      return '#555555';
  }
}

// カテゴリの表示名を取得
function getCategoryLabel(category: string): string {
  switch (category) {
    case 'viewingDayBefore':
      return '②内覧日前日';
    case 'todayCall':
      return '⑯当日TEL';
    case 'threeCallUnchecked':
      return '３回架電未';
    case 'todayCallAssigned':
      return '当日TEL（担当）';
    default:
      if (category.startsWith('assigned:')) {
        return `担当(${category.replace('assigned:', '')})`;
      }
      if (category.startsWith('todayCallAssigned:')) {
        return `当日TEL(${category.replace('todayCallAssigned:', '')})`;
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
    console.log('[BuyerStatusSidebar] handleStatusClick called with status:', status);
    console.log('[BuyerStatusSidebar] selectedStatus before:', selectedStatus);
    // 常に選択状態を維持（選択解除しない）
    console.log('[BuyerStatusSidebar] Selecting status:', status);
    onStatusSelect(status);
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
  const categoryList: Array<{ key: string; label: string; count: number; color: string; isSubCategory?: boolean; parentKey?: string }> = [];

  // 固定カテゴリ
  const fixedCategories = [
    'viewingDayBefore',
    'todayCall',
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
  
  // ３回架電未カテゴリ（新規）- 独立したカテゴリ（サブカテゴリではない）
  const threeCallUncheckedCount = categoryCounts.threeCallUnchecked ?? 0;
  if (threeCallUncheckedCount > 0) {
    categoryList.push({
      key: 'threeCallUnchecked',
      label: '３回架電未',
      count: threeCallUncheckedCount,
      color: getCategoryColor('threeCallUnchecked'),
    });
  }

  // 担当者別カテゴリ（assignedCounts）- 親カテゴリ
  if (categoryCounts.assignedCounts) {
    Object.entries(categoryCounts.assignedCounts).forEach(([assignee, count]) => {
      if (count > 0 && normalStaffInitials.includes(assignee)) {
        const key = `assigned:${assignee}`;
        categoryList.push({
          key,
          label: getCategoryLabel(key),
          count,
          color: getCategoryColor(key),
        });
        
        // サブカテゴリ: 当日TEL(イニシャル)
        const todayCallCount = categoryCounts.todayCallAssignedCounts?.[assignee] ?? 0;
        if (todayCallCount > 0) {
          categoryList.push({
            key: `todayCallAssigned:${assignee}`,
            label: `当日TEL(${assignee})`,
            count: todayCallCount,
            color: getCategoryColor('todayCallAssigned'),
            isSubCategory: true,
            parentKey: key,
          });
        }
      }
    });
  }

  const renderCategoryItem = (category: { key: string; label: string; count: number; color: string; isSubCategory?: boolean; parentKey?: string }) => {
    const isIndented = category.isSubCategory === true;
    const isAssignedCategory = category.key.startsWith('assigned:') && !category.isSubCategory;
    const isTodayCallAssignedCategory = category.key.startsWith('todayCallAssigned:');
    
    return (
      <ListItemButton
        key={category.key}
        selected={selectedStatus === category.key}
        onClick={(e) => {
          e.stopPropagation(); // イベント伝播を停止
          handleStatusClick(category.key);
        }}
        sx={{
          py: 1,
          pl: isIndented ? 4 : 2,
          backgroundColor: (isAssignedCategory || isTodayCallAssignedCategory) ? '#e8f5e9' : 'transparent',
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
