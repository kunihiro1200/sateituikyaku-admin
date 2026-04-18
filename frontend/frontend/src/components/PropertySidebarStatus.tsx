import { useMemo, useState, useEffect } from 'react';
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
  workTaskMap?: Map<string, Date | null>;
}

// ステータスの優先順位（表示順）
const STATUS_PRIORITY: Record<string, number> = {
  '未完了': 0,
  '本日公開予定': 1,
  '要値下げ': 2,
  '値下げ未完了': 3,
  'SUUMO URL　要登録': 4,
  'レインズ登録＋SUUMO URL 要登録': 5,
  '未報告': 6,
  '一般媒介の掲載確認未': 7,
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
  'SUUMO URL\u3000要登録',
  'レインズ登録＋SUUMO URL 要登録',
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
  'レインズ登録＋SUUMO URL 要登録',
]);

// sales_assignee → 専任公開中ステータス名のマッピング
// sidebar_statusが古いデータ（'専任・公開中'）の場合にフロントで分解する
const ASSIGNEE_TO_SENIN_STATUS: Record<string, string> = {
  '山本': 'Y専任公開中',
  '生野': '生・専任公開中',
  '久': '久・専任公開中',
  '裏': 'U専任公開中',
  '林': '林・専任公開中',
  '林田': '林専任公開中',
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
  workTaskMap,
}: PropertySidebarStatusProps) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  // マウント/アンマウントログ
  useEffect(() => {
    console.log('[PropertySidebarStatus] マウント:', {
      listingsの件数: listings.length,
      未完了: listings.filter(l => l.confirmation === '未').length
    });
    return () => {
      console.log('[PropertySidebarStatus] アンマウント');
    };
  }, []);

  const statusCounts = useMemo(() => {
    console.log('[PropertySidebarStatus] statusCounts再計算:', {
      listingsの型: Array.isArray(listings) ? 'array' : typeof listings,
      件数: Array.isArray(listings) ? listings.length : 0,
      listings参照: listings
    });
    
    // listingsが配列でない場合のガード
    if (!Array.isArray(listings)) {
      console.error('[PropertySidebarStatus] listingsが配列ではありません:', listings);
      return { all: 0 };
    }

    const counts: Record<string, number> = { all: listings.length };

    // 「未完了」カテゴリ: confirmation === '未' の物件をカウント
    const incompleteListings = listings.filter(l => l.confirmation === '未');
    counts['未完了'] = incompleteListings.length;
    
    // デバッグログ
    console.log('[PropertySidebarStatus] 未完了カウント:', {
      未完了件数: incompleteListings.length,
      全物件数: listings.length,
      物件: incompleteListings.map(l => ({
        property_number: l.property_number,
        confirmation: l.confirmation
      }))
    });

    if (pendingPriceReductionProperties && pendingPriceReductionProperties.size > 0) {
      counts['値下げ未完了'] = pendingPriceReductionProperties.size;
    }

    listings.forEach(listing => {
      // sidebar_statusを基本として使用（DBに保存されている値）
      const status = listing.sidebar_status || '';
      const normalizedStatus = status.replace(/\s+/g, '');

      // 動的に判定が必要なステータスを最優先でcalculatePropertyStatusで判定
      // 「要値下げ」「未報告」「本日公開予定」はDBに保存されないか、report_dateから動的に変わるため
      // sidebar_status（'専任・公開中'など）より先にチェックする
      const computed = calculatePropertyStatus(listing as any, workTaskMap);

      // 「要値下げ」は常にcalculatePropertyStatusで判定（DBに保存されないため）
      if (computed.key === 'price_reduction_due') {
        counts['要値下げ'] = (counts['要値下げ'] || 0) + 1;
        return;
      }

      // 「未報告」も常にcalculatePropertyStatusで判定（report_dateが今日以前なら未報告）
      // sidebar_statusが'専任・公開中'でもreport_dateが今日以前なら未報告として扱う
      if (computed.key === 'unreported') {
        // スペースを除去して統一（「未報告 林」→「未報告林」）
        const label = computed.label.replace(/\s+/g, '');
        counts[label] = (counts[label] || 0) + 1;
        return;
      }

      // 「本日公開予定」も常にcalculatePropertyStatusで判定（公開予定日が動的に変わるため）
      if (workTaskMap && computed.key === 'today_publish') {
        counts['本日公開予定'] = (counts['本日公開予定'] || 0) + 1;
        return;
      }

      // 「SUUMO URL 要登録」「レインズ登録＋SUUMO URL 要登録」も動的判定
      // DBのsidebar_statusに依存せず、atbb_status/suumo_url/suumo_registered/公開予定日から計算
      if (computed.key === 'suumo_required') {
        counts['SUUMO URL\u3000要登録'] = (counts['SUUMO URL\u3000要登録'] || 0) + 1;
        return;
      }
      if (computed.key === 'reins_suumo_required') {
        counts['レインズ登録＋SUUMO URL 要登録'] = (counts['レインズ登録＋SUUMO URL 要登録'] || 0) + 1;
        return;
      }

      // sidebar_status === '専任・公開中' の分解処理
      // （未報告・要値下げ・本日公開予定でない場合のみここに到達）
      if (status === '専任・公開中') {
        const assignee = listing.sales_assignee || '';
        const assigneeStatus = ASSIGNEE_TO_SENIN_STATUS[assignee] || '専任・公開中';
        counts[assigneeStatus] = (counts[assigneeStatus] || 0) + 1;
        return;
      }

      // sidebar_statusが存在する場合はそれを使用
      // ただし「未報告」系・SUUMO系は除外（動的判定済み）
      // スペースを除去してから判定（「未報告 林」も「未報告林」も除外）
      if (status && status !== '値下げ未完了' && !normalizedStatus.startsWith('未報告')
          && status !== 'SUUMO URL\u3000要登録' && status !== 'レインズ登録＋SUUMO URL 要登録') {
        counts[status] = (counts[status] || 0) + 1;
      }
    });

    return counts;
  }, [listings, pendingPriceReductionProperties, workTaskMap]);

  // 一般媒介（atbb_status === '一般・公開中'）の未完了件数
  const generalMediationIncompleteCount = useMemo(() => {
    if (!Array.isArray(listings)) return 0;
    return listings.filter(l =>
      l.sidebar_status === '未完了' && l.atbb_status === '一般・公開中'
    ).length;
  }, [listings]);

  const pendingPriceReductionList = useMemo(() => {
    if (!pendingPriceReductionProperties || !Array.isArray(listings)) return [];
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
    console.log('[PropertySidebarStatus] statusList再計算開始:', {
      statusCounts,
      未完了カウント: statusCounts['未完了'],
      statusCountsの参照: Object.keys(statusCounts).length
    });
    
    const list: Array<{ key: string; label: string; count: number; isHighPriorityBg?: boolean; isSeninBg?: boolean; isDivider?: boolean; isRed?: boolean; isBoldRed?: boolean }> = [
      { key: 'all', label: 'すべて', count: statusCounts.all }
    ];

    const sortedStatuses = Object.entries(statusCounts)
      .filter(([key]) => key !== 'all' && key !== '')
      .filter(([key, count]) => {
        console.log(`[PropertySidebarStatus] フィルタリング: ${key} = ${count}`);
        return count > 0;
      })
      .sort((a, b) => {
        const getPriority = (key: string) => {
          if (STATUS_PRIORITY[key] !== undefined) return STATUS_PRIORITY[key];
          // 「未報告 Y」「未報告 I」など担当者付きは「未報告」と同じ優先度
          if (key.startsWith('未報告')) return 4;
          return 999;
        };
        return getPriority(a[0]) - getPriority(b[0]);
      });

    console.log('[PropertySidebarStatus] フィルタリング後のステータス:', sortedStatuses);

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

    console.log('[PropertySidebarStatus] statusList生成完了:', {
      リスト件数: list.length,
      未完了アイテム: list.find(item => item.key === '未完了'),
      全アイテム: list.map(item => ({ key: item.key, count: item.count }))
    });

    return list;
  }, [statusCounts, generalMediationIncompleteCount, listings]);

  return (
    <>
      <Paper elevation={0} sx={{ width: 210, flexShrink: 0, border: 'none', borderBottom: 'none', outline: 'none' }}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1rem' }}>
            カテゴリー
          </Typography>
        </Box>
        <List dense sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto', border: 'none', pb: 0 }}>
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
