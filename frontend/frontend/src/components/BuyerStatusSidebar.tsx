import {
  Box,
  Typography,
  ListItemButton,
  ListItemText,
  Badge,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface CategoryCounts {
  all?: number;
  viewingDayBefore?: number;
  todayCall?: number;
  todayCallWithInfo?: number;  // 🆕 当日TEL（内容）- コミュニケーション情報あり
  todayCallWithInfoLabels?: Record<string, number>;  // 🆕 ラベル別カウント
  threeCallUnchecked?: number;  // ３回架電未カテゴリ（新規）
  assignedCounts?: Record<string, number>;
  todayCallAssignedCounts?: Record<string, number>;
  projectAssigneeOnlyTodayCallCounts?: Record<string, number>;  // 🆕 案件担当のみの当日TEL（当日TEL直下に表示）
  
  // 新規追加（2026年4月）
  inquiryEmailUnanswered?: number;  // 問合メール未対応
  brokerInquiry?: number;  // 業者問合せあり
  generalViewingSellerContactPending?: number;  // 一般媒介_内覧後売主連絡未
  viewingPromotionRequired?: number;  // 要内覧促進客
  pinrichUnregistered?: number;  // ピンリッチ未登録
  pinrich500manUnregistered?: number;  // Pinrich500万以上登録未
  nextCallDateBlankCounts?: Record<string, number>;  // 次電日空欄（担当別）
  viewingSurveyUnchecked?: number;  // 内覧アンケート未確認
  viewingUnconfirmed?: number;  // 内覧未確定
  sellerViewingContactPending?: number;  // 売主内覧連絡未
  viewingPostInputCounts?: Record<string, number>;  // 内覧後未入力（担当者別）
  // 🆕 持ち家ヒアリング統計（月別×担当別）
  homeHearingMonthlyStats?: Record<string, {
    initialResponseCounts: Record<string, number>;
    homeHearingCounts: Record<string, number>;
    homeHearingOwnedCounts: Record<string, number>;
    valuationRequiredCounts: Record<string, number>;
    homeHearingNotDone?: number;
    homeHearingNotNeeded?: number;
  }>;
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
  viewing_date: string;
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
    // 新規追加（2026年4月）- 全て赤字
    case 'inquiryEmailUnanswered':
      return '#d32f2f'; // 赤
    case 'brokerInquiry':
      return '#d32f2f'; // 赤
    case 'generalViewingSellerContactPending':
      return '#d32f2f'; // 赤
    case 'viewingPromotionRequired':
      return '#d32f2f'; // 赤
    case 'pinrichUnregistered':
      return '#d32f2f'; // 赤
    case 'pinrich500manUnregistered':
      return '#d32f2f'; // 赤
    case 'nextCallDateBlank':
      return '#d32f2f'; // 赤
    case 'viewingSurveyUnchecked':
      return '#d32f2f'; // 赤
    case 'viewingUnconfirmed':
      return '#d32f2f'; // 赤
    case 'sellerViewingContactPending':
      return '#d32f2f'; // 赤
    default:
      if (category.startsWith('nextCallDateBlank:')) {
        return '#d32f2f'; // 赤
      }
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
    // 新規追加（2026年4月）
    case 'inquiryEmailUnanswered':
      return '問合メール未対応';
    case 'brokerInquiry':
      return '業者問合せあり';
    case 'generalViewingSellerContactPending':
      return '一般媒介_内覧後売主連絡未';
    case 'viewingPromotionRequired':
      return '要内覧促進客';
    case 'pinrichUnregistered':
      return 'ピンリッチ未登録';
    case 'pinrich500manUnregistered':
      return 'Pinrich500万以上登録未';
    case 'nextCallDateBlank':
      return '次電日空欄';
    case 'viewingSurveyUnchecked':
      return '内覧アンケート未';
    case 'viewingUnconfirmed':
      return '内覧未確定';
    case 'sellerViewingContactPending':
      return '売主内覧連絡未';
    default:
      if (category.startsWith('nextCallDateBlank:')) {
        return `次電日空欄(${category.replace('nextCallDateBlank:', '')})`;
      }
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

    // 「当日TEL」の直後に案件担当のみの当日TEL(K)を表示
    if (key === 'todayCall' && categoryCounts.projectAssigneeOnlyTodayCallCounts) {
      Object.entries(categoryCounts.projectAssigneeOnlyTodayCallCounts).forEach(([assignee, cnt]) => {
        if (cnt > 0) {
          categoryList.push({
            key: `todayCallAssigned:${assignee}`,
            label: `当日TEL(${assignee})`,
            count: cnt,
            color: getCategoryColor('todayCallAssigned'),
            isSubCategory: true,
            parentKey: 'todayCall',
          });
        }
      });
    }

    // 「当日TEL」の直後にコミュニケーション情報ありの当日TEL（内容）を表示
    if (key === 'todayCall' && categoryCounts.todayCallWithInfoLabels) {
      Object.entries(categoryCounts.todayCallWithInfoLabels).forEach(([label, cnt]) => {
        if (cnt > 0) {
          categoryList.push({
            key: `todayCallWithInfo:${label}`,
            label: label,
            count: cnt,
            color: '#9c27b0', // 紫（売主リストと同じ）
            isSubCategory: true,
            parentKey: 'todayCall',
          });
        }
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
  
  // 新規追加カテゴリ（2026年4月）- 全て赤字で表示
  const newCategories = [
    'inquiryEmailUnanswered',
    'brokerInquiry',
    'generalViewingSellerContactPending',
    'viewingPromotionRequired',
    'pinrichUnregistered',
    'pinrich500manUnregistered',
    'viewingSurveyUnchecked',
    'viewingUnconfirmed',
    'sellerViewingContactPending',
  ];
  
  newCategories.forEach(key => {
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

  // 内覧後未入力（担当者別）- カウントがある担当のみ表示
  if (categoryCounts.viewingPostInputCounts) {
    Object.entries(categoryCounts.viewingPostInputCounts).forEach(([assignee, count]) => {
      if (count > 0) {
        categoryList.push({
          key: `viewingPostInput:${assignee}`,
          label: `内覧後未入力(${assignee})`,
          count,
          color: '#66bb6a', // 緑
        });
      }
    });
  }

  // 担当者別カテゴリ（assignedCounts）- 親カテゴリ
  // 「業者」は担当カテゴリーから除外する
  const EXCLUDED_ASSIGNEES = ['業者'];

  if (categoryCounts.assignedCounts) {
    Object.entries(categoryCounts.assignedCounts).forEach(([assignee, count]) => {
      if (count > 0 && normalStaffInitials.includes(assignee) && !EXCLUDED_ASSIGNEES.includes(assignee)) {
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
        // サブカテゴリ: 次電日空欄(イニシャル)
        const nextCallDateBlankCount = categoryCounts.nextCallDateBlankCounts?.[assignee] ?? 0;
        if (nextCallDateBlankCount > 0) {
          categoryList.push({
            key: `nextCallDateBlank:${assignee}`,
            label: `次電日空欄(${assignee})`,
            count: nextCallDateBlankCount,
            color: '#d32f2f',
            isSubCategory: true,
            parentKey: key,
          });
        }
      }
    });
  }

  // 🆕 持ち家ヒアリング統計（月別）
  const monthlyStats = categoryCounts.homeHearingMonthlyStats || {};
  const sortedMonths = Object.keys(monthlyStats).sort().reverse(); // 新しい月が上
  const hasMonthlyStats = sortedMonths.length > 0;

  const renderCategoryItem = (category: { key: string; label: string; count: number; color: string; isSubCategory?: boolean; parentKey?: string }) => {
    const isIndented = category.isSubCategory === true;
    const isAssignedCategory = category.key.startsWith('assigned:') && !category.isSubCategory;
    const isTodayCallAssignedCategory = category.key.startsWith('todayCallAssigned:');
    const isNextCallDateBlankCategory = category.key.startsWith('nextCallDateBlank:');
    
    return (
      <ListItemButton
        key={category.key}
        selected={selectedStatus === category.key}
        onClick={(e) => {
          e.stopPropagation();
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
          primaryTypographyProps={{ 
            variant: 'body2', 
            color: (isTodayCallAssignedCategory || isNextCallDateBlankCategory) ? '#d32f2f' : (isIndented ? 'text.secondary' : 'text.primary'),
            fontWeight: (isTodayCallAssignedCategory || isNextCallDateBlankCategory) ? 'bold' : 'normal'
          }}
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

      {/* 🆕 持ち家ヒアリング統計セクション（月別アコーディオン） */}
      {hasMonthlyStats && (
        <Box sx={{ borderTop: '2px solid #ccc' }}>
          <Box sx={{ p: 1, backgroundColor: '#f5f5f5' }}>
            <Typography variant="caption" fontWeight="bold" sx={{ color: '#333' }}>
              持家ヒアリング統計（月別）
            </Typography>
          </Box>
          {sortedMonths.map(month => {
            const data = monthlyStats[month];
            const monthInitial = Object.values(data.initialResponseCounts).reduce((s, v) => s + v, 0);
            const monthHearing = Object.values(data.homeHearingCounts).reduce((s, v) => s + v, 0);
            const monthOwned = Object.values(data.homeHearingOwnedCounts).reduce((s, v) => s + v, 0);
            const monthValuation = Object.values(data.valuationRequiredCounts).reduce((s, v) => s + v, 0);
            const monthNotDone = data.homeHearingNotDone ?? 0;
            const monthNotNeeded = data.homeHearingNotNeeded ?? 0;
            if (monthInitial === 0) return null;
            const hearingPct = monthInitial > 0 ? Math.round((monthHearing / monthInitial) * 100) : 0;
            const ownedPct = monthHearing > 0 ? Math.round((monthOwned / monthHearing) * 100) : 0;
            const valPct = monthOwned > 0 ? Math.round((monthValuation / monthOwned) * 100) : 0;
            
            return (
              <Accordion key={month} disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 32, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                  <Typography variant="caption" fontWeight="bold">{month}（初動{monthInitial}）</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0.5, pt: 0 }}>
                  {/* 初動対応数 */}
                  <Box sx={{ px: 1, py: 0.3, backgroundColor: '#fff8e1', borderBottom: '1px solid #eee' }}>
                    <Typography variant="caption" fontWeight="bold" sx={{ color: '#e65100', fontSize: '0.65rem' }}>初動対応数</Typography>
                    {Object.entries(data.initialResponseCounts).map(([staff, count]) => (
                      <Box key={staff} sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{staff}</Typography>
                        <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{count}</Typography>
                      </Box>
                    ))}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5, borderTop: '1px solid #eee' }}>
                      <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>計</Typography>
                      <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{monthInitial}</Typography>
                    </Box>
                  </Box>
                  {/* ヒアリング済 */}
                  <Box sx={{ px: 1, py: 0.3, backgroundColor: '#e8f5e9', borderBottom: '1px solid #eee' }}>
                    <Typography variant="caption" fontWeight="bold" sx={{ color: '#2e7d32', fontSize: '0.65rem' }}>ヒアリング済 ({hearingPct}%)</Typography>
                    {normalStaffInitials.filter(s => !['業者'].includes(s)).map(staff => {
                      const count = data.homeHearingCounts[staff] ?? 0;
                      const initCount = data.initialResponseCounts[staff] ?? 0;
                      if (count === 0 && initCount === 0) return null;
                      const pct = initCount > 0 ? Math.round((count / initCount) * 100) : 0;
                      return (
                        <Box key={staff} sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{staff}</Typography>
                          <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{count} ({pct}%)</Typography>
                        </Box>
                      );
                    })}
                    {monthNotDone > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#d32f2f' }}>未</Typography>
                        <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem', color: '#d32f2f' }}>{monthNotDone}</Typography>
                      </Box>
                    )}
                    {monthNotNeeded > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#888' }}>不要</Typography>
                        <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem', color: '#888' }}>{monthNotNeeded}</Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5, borderTop: '1px solid #eee' }}>
                      <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>計</Typography>
                      <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{monthHearing} ({hearingPct}%)</Typography>
                    </Box>
                  </Box>
                  {/* 持家 */}
                  <Box sx={{ px: 1, py: 0.3, backgroundColor: '#e3f2fd', borderBottom: '1px solid #eee' }}>
                    <Typography variant="caption" fontWeight="bold" sx={{ color: '#1565c0', fontSize: '0.65rem' }}>持家（物件）({ownedPct}%)</Typography>
                    {normalStaffInitials.filter(s => !['業者'].includes(s)).map(staff => {
                      const count = data.homeHearingOwnedCounts[staff] ?? 0;
                      const hearingCount = data.homeHearingCounts[staff] ?? 0;
                      if (count === 0 && hearingCount === 0) return null;
                      const pct = hearingCount > 0 ? Math.round((count / hearingCount) * 100) : 0;
                      return (
                        <Box key={staff} sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{staff}</Typography>
                          <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{count} ({pct}%)</Typography>
                        </Box>
                      );
                    })}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5, borderTop: '1px solid #eee' }}>
                      <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>計</Typography>
                      <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{monthOwned} ({ownedPct}%)</Typography>
                    </Box>
                  </Box>
                  {/* 要査定 */}
                  <Box sx={{ px: 1, py: 0.3, backgroundColor: '#fce4ec' }}>
                    <Typography variant="caption" fontWeight="bold" sx={{ color: '#c62828', fontSize: '0.65rem' }}>要査定 ({valPct}%)</Typography>
                    {normalStaffInitials.filter(s => !['業者'].includes(s)).map(staff => {
                      const count = data.valuationRequiredCounts[staff] ?? 0;
                      const ownedCount = data.homeHearingOwnedCounts[staff] ?? 0;
                      if (count === 0 && ownedCount === 0) return null;
                      const pct = ownedCount > 0 ? Math.round((count / ownedCount) * 100) : 0;
                      return (
                        <Box key={staff} sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{staff}</Typography>
                          <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{count} ({pct}%)</Typography>
                        </Box>
                      );
                    })}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5, borderTop: '1px solid #eee' }}>
                      <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>計</Typography>
                      <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{monthValuation} ({valPct}%)</Typography>
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
