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

export default function BuyerStatusSidebar({
  selectedStatus,
  onStatusSelect,
  totalCount: totalCountProp,
  onBuyersLoaded,
}: BuyerStatusSidebarProps) {
  const [categories, setCategories] = useState<StatusCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalTotalCount, setInternalTotalCount] = useState(0);

  useEffect(() => {
    fetchStatusCategories();
  }, []);

  const fetchStatusCategories = async () => {
    try {
      setLoading(true);
      // 全買主データも一緒に取得してフロントでキャッシュ
      const res = await api.get('/api/buyers/status-categories-with-buyers');
      const { categories: data, buyers } = res.data as {
        categories: StatusCategory[];
        buyers: BuyerWithStatus[];
      };

      const total = data.reduce((sum, cat) => sum + cat.count, 0);
      setInternalTotalCount(total);

      const filteredCategories = data.filter(cat => cat.count > 0);
      setCategories(filteredCategories);

      // 全買主データを親に渡す
      if (onBuyersLoaded && buyers) {
        onBuyersLoaded(buyers);
      }
    } catch (error) {
      console.error('Failed to fetch status categories:', error);
    } finally {
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

        {/* ステータスカテゴリ */}
        {categories.map((category) => {
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
        })}
      </Box>
    </Box>
  );
}
