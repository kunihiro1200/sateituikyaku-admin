import { useEffect, useState } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Badge,
  CircularProgress,
} from '@mui/material';
import api from '../services/api';

interface StatusCategory {
  status: string;
  count: number;
  color: string;
  priority: number;
}

interface Props {
  selectedStatus: string | null;
  onStatusSelect: (status: string | null) => void;
  totalCount: number;
}

export default function BuyerStatusSidebar({ selectedStatus, onStatusSelect, totalCount }: Props) {
  const [categories, setCategories] = useState<StatusCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/buyers/status-categories');
      setCategories(res.data || []);
    } catch (error) {
      console.error('Failed to fetch status categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const isSelected = (status: string | null) => {
    if (status === null) return selectedStatus === null;
    return selectedStatus === status;
  };

  return (
    <Box>
      <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
        <Typography variant="subtitle1" fontWeight="bold">ステータス</Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <List dense sx={{ maxHeight: 'calc(80vh - 120px)', overflow: 'auto' }}>
          {/* 全件 */}
          <ListItemButton
            selected={isSelected(null)}
            onClick={() => onStatusSelect(null)}
            sx={{ py: 0.5 }}
          >
            <ListItemText
              primary="全件"
              primaryTypographyProps={{ variant: 'body2', noWrap: true }}
              sx={{ flex: 1, minWidth: 0 }}
            />
            <Badge badgeContent={totalCount} color="primary" max={9999} sx={{ ml: 1 }} />
          </ListItemButton>

          {/* ステータス別 */}
          {categories.map((cat) => (
            <ListItemButton
              key={cat.status || '__empty__'}
              selected={isSelected(cat.status)}
              onClick={() => onStatusSelect(cat.status)}
              sx={{ py: 0.5 }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: cat.color,
                  flexShrink: 0,
                  mr: 1,
                }}
              />
              <ListItemText
                primary={cat.status || '（未分類）'}
                primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                sx={{ flex: 1, minWidth: 0 }}
              />
              <Badge badgeContent={cat.count} color="default" max={9999} sx={{ ml: 1 }} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
