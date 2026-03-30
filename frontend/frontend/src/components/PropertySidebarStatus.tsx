import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Badge,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { SECTION_COLORS } from '../theme/sectionColors';
import { calculatePropertyStatus } from '../utils/propertyListingStatusUtils';

interface PropertyListing {
  id: string;
  property_number?: string;
  sidebar_status?: string;
  [key: string]: any;
}

interface PropertySidebarStatusProps {
  listings: PropertyListing[];
  selectedStatus: string | null;
  onStatusChange: (status: string | null) => void;
  pendingPriceReductionProperties?: Set<string>;
  onCompletePriceReduction?: (propertyNumber: string) => void;
}

// ステータスの優先順位（表示順）
const STATUS_PRIORITY: Record<string, number> = {
  '未完了': 0,
  '本日公開予定': 1,
  '要値下げ': 2,
  '値下げ未完了': 3,
  '未報告': 4,
  '一般媒介の掲載確認未': 5,
  'SUUMO URL　要登録': 6,
  'レインズ登録＋SUUMO登録': 7,
  '買付申込み（内覧なし）２': 8,
  '公開前情報': 9,
  '非公開（配信メールのみ）': 10,
  '非公開予定（確認後）': 11,
  // 優先度低グループ（末尾）
  '一般公開中物件': 20,
  'Y専任公開中': 21,
  '生・専任公開中': 22,
  '久・専任公開中': 23,
  'U専任公開中': 24,
  '林・専任公開中': 25,
  'K専任公開中': 26,
  'R専任公開中': 27,
  'I専任公開中': 28,
  '専任・公開中': 29,
};

// 赤字表示対象ステータス
const HIGH_PRIORITY_RED_STATUSES = new Set([
  '未完了',
  '本日公開予定',
  '要値下げ',
]);

// 「買付申し込み」より上の優先度高グループ（薄い背景色対象）
const HIGH_PRIORITY_BG_STATUSES = new Set([
  '未完了',
  '本日公開予定',
  '要値下げ',
  '値下げ未完了',
  '未報告',
  '一般媒介の掲載確認未',
  'SUUMO URL\u3000要登録',
  'レインズ登録＋SUUMO登録',
]);

// sales_assignee → 専任公開中ステータス名のマッピング
// sidebar_statusが古いデータ（'専任・公開中'）の場合にフロントで分解する
const ASSIGNEE_TO_SENIN_STATUS: Record<string, string> = {
  '山本': 'Y専任公開中',
  '生野': '生・専任公開中',
  '久': '久・専任公開中',
  '裏': 'U専任公開中',
  '林': '林・専任公開中',
  '国広': 'K専任公開中',
  '木村': 'R専任公開中',
  '角井': 'I専任公開中',
};


export default function PropertySidebarStatus({
  listings,
  selectedStatus,
  onStatusChange,
  pendingPriceReductionProperties,
  onCompletePriceReduction,
}: PropertySidebarStatusProps) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: listings.length };

    if (pendingPriceReductionProperties && pendingPriceReductionProperties.size > 0) {
      counts['値下げ未完了'] = pendingPriceReductionProperties.size;
    }

    listings.forEach(listing => {
      // calculatePropertyStatusで「要値下げ」を含む正確なステータスを計算
      const computed = calculatePropertyStatus(listing as any);
      if (computed.key === 'price_reduction_due') {
        counts['要値下げ'] = (counts['要値下げ'] || 0) + 1;
        return;
      }

      const status = listing.sidebar_status || '';
      if (status && status !== '値下げ未完了') {
        // 「専任・公開中」はsales_assigneeで担当者別に分解して表示
        if (status === '専任・公開中') {
          const assignee = listing.sales_assignee || '';
          const assigneeStatus = ASSIGNEE_TO_SENIN_STATUS[assignee] || '専任・公開中';
          counts[assigneeStatus] = (counts[assigneeStatus] || 0) + 1;
        } else {
          counts[status] = (counts[status] || 0) + 1;
        }
      }
    });

    return counts;
  }, [listings, pendingPriceReductionProperties]);

  // 一般媒介（atbb_status === '一般・公開中'）の未完了件数
  const generalMediationIncompleteCount = useMemo(() => {
    return listings.filter(l =>
      l.sidebar_status === '未完了' && l.atbb_status === '一般・公開中'
    ).length;
  }, [listings]);

  const pendingPriceReductionList = useMemo(() => {
    if (!pendingPriceReductionProperties) return [];
    return listings.filter(l =>
      l.property_number && pendingPriceReductionProperties.has(l.property_number)
    );
  }, [listings, pendingPriceReductionProperties]);

  const handleComplete = async (propertyNumber: string) => {
    if (!onCompletePriceReduction) return;
    setCompleting(propertyNumber);
    try {
      await onCompletePriceReduction(propertyNumber);
    } finally {
      setCompleting(null);
    }
  };

  const statusList = useMemo(() => {
    const list: Array<{ key: string; label: string; count: number; isHighPriorityBg?: boolean; isSeninBg?: boolean; isDivider?: boolean; isRed?: boolean; isBoldRed?: boolean }> = [
      { key: 'all', label: 'すべて', count: statusCounts.all }
    ];

    const sortedStatuses = Object.entries(statusCounts)
      .filter(([key]) => key !== 'all' && key !== '')
      .sort((a, b) => {
        const getPriority = (key: string) => {
          if (STATUS_PRIORITY[key] !== undefined) return STATUS_PRIORITY[key];
          // 「未報告 Y」「未報告 I」など担当者付きは「未報告」と同じ優先度
          if (key.startsWith('未報告')) return 4;
          return 999;
        };
        return getPriority(a[0]) - getPriority(b[0]);
      });

    sortedStatuses.forEach(([key, count]) => {
      // 「買付申し込み」(優先度8)より上のカテゴリーに薄い背景色
      // 専任公開中系（X専任公開中）にも薄い背景色
      const isSeninBg = key.endsWith('専任公開中') || key === '専任・公開中';
      const isHighBg = !isSeninBg && (HIGH_PRIORITY_BG_STATUSES.has(key) || key.startsWith('未報告'));
      // 一般媒介の未完了は太字赤字、それ以外の高優先度は赤字
      const isBoldRed = key === '未完了' && generalMediationIncompleteCount > 0;
      const isRed = HIGH_PRIORITY_RED_STATUSES.has(key);
      list.push({ key, label: key, count, isHighPriorityBg: isHighBg, isSeninBg, isRed, isBoldRed });
    });

    return list;
  }, [statusCounts, generalMediationIncompleteCount]);

  return (
    <>
      <Paper sx={{ width: 210, flexShrink: 0 }}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1rem' }}>
            カテゴリー
          </Typography>
        </Box>
        <List dense sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
          {statusList.map((item) => {
            if (item.isDivider) {
              return (
                <Box key="__divider__" sx={{ mx: 1, my: 0.5, borderTop: '2px solid #bbb' }}>
                  <Typography variant="caption" sx={{ px: 1, color: 'text.secondary', fontSize: '0.7rem' }}>
                    公開中物件（優先度低）
                  </Typography>
                </Box>
              );
            }
            return (
              <ListItemButton
                key={item.key}
                selected={selectedStatus === item.key || (!selectedStatus && item.key === 'all')}
                onClick={() => onStatusChange(item.key === 'all' ? null : item.key)}
                sx={{
                  py: 0.75,
                  ...(item.isHighPriorityBg && {
                    bgcolor: 'rgba(255, 243, 224, 0.8)',
                    '&:hover': { bgcolor: 'rgba(255, 224, 178, 0.8)' },
                    '&.Mui-selected': { bgcolor: 'rgba(255, 204, 128, 0.6)' },
                  }),
                  ...(item.isSeninBg && {
                    bgcolor: 'rgba(227, 242, 253, 0.8)',
                    '&:hover': { bgcolor: 'rgba(187, 222, 251, 0.8)' },
                    '&.Mui-selected': { bgcolor: 'rgba(144, 202, 249, 0.6)' },
                  }),
                }}
              >
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    variant: 'body2',
                    noWrap: true,
                    sx: item.isBoldRed
                      ? { color: 'error.main', fontWeight: 'bold' }
                      : item.isRed
                      ? { color: 'error.main' }
                      : undefined,
                  }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <Badge
                  badgeContent={item.count}
                  max={9999}
                  sx={{
                    ml: 1,
                    '& .MuiBadge-badge': {
                      backgroundColor: SECTION_COLORS.property.main,
                      color: SECTION_COLORS.property.contrastText,
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>

        {selectedStatus === '値下げ未完了' && pendingPriceReductionList.length > 0 && (
          <Box sx={{ p: 2, borderTop: '1px solid #eee' }}>
            <Button
              fullWidth
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              onClick={() => setShowCompleteDialog(true)}
            >
              完了ボタン
            </Button>
          </Box>
        )}
      </Paper>

      <Dialog
        open={showCompleteDialog}
        onClose={() => setShowCompleteDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>値下げ未完了の物件</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            以下の物件の値下げ通知が予約されています。完了ボタンを押すと、この一覧から削除されます。
          </Typography>
          <List>
            {pendingPriceReductionList.map((property) => (
              <Box
                key={property.property_number}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  mb: 1,
                  border: '1px solid #eee',
                  borderRadius: 1,
                }}
              >
                <Box>
                  <Typography variant="body1" fontWeight="bold">
                    {property.property_number}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {property.address || property.display_address || '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    担当: {property.sales_assignee || '-'}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={completing === property.property_number ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
                  disabled={completing === property.property_number}
                  onClick={() => handleComplete(property.property_number!)}
                >
                  完了
                </Button>
              </Box>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCompleteDialog(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
