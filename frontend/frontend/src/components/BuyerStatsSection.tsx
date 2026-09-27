import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

/**
 * 買主統計セクション（持家ヒアリング統計 / 買付統計 / 内覧統計）
 *
 * 買主リストのサイドバー（BuyerStatusSidebar）と、事務会議の買主統計ページ
 * （BuyerStatsPage）の両方で使う再利用コンポーネント。
 * データは /api/buyers/sidebar-counts のレスポンスに含まれる月別統計をそのまま渡す。
 */
export interface BuyerStatsData {
  // 持ち家ヒアリング統計（月別×担当別）
  homeHearingMonthlyStats?: Record<string, {
    initialResponseCounts: Record<string, number>;
    homeHearingCounts: Record<string, number>;
    homeHearingOwnedCounts: Record<string, number>;
    valuationRequiredCounts: Record<string, number>;
    homeHearingNotDone?: number;
    homeHearingNotNeeded?: number;
  }>;
  // 買付統計（内覧日月別×後続担当別）
  purchaseMonthlyStats?: Record<string, {
    ryoteCounts: Record<string, number>;
    katateCounts: Record<string, number>;
  }>;
  // 内覧統計（内覧日月別×後続担当別）
  viewingMonthlyStats?: Record<string, {
    total: number;
    assigneeCounts: Record<string, number>;
  }>;
}

export interface BuyerStatsSectionProps {
  categoryCounts: BuyerStatsData | null | undefined;
  normalStaffInitials?: string[];
}

export default function BuyerStatsSection({ categoryCounts, normalStaffInitials = [] }: BuyerStatsSectionProps) {
  if (!categoryCounts) return null;

  const monthlyStats = categoryCounts.homeHearingMonthlyStats || {};
  const sortedMonths = Object.keys(monthlyStats).sort().reverse(); // 新しい月が上
  const hasMonthlyStats = sortedMonths.length > 0;

  return (
    <>
      {/* 持家ヒアリング統計（親フォルダ） */}
      {hasMonthlyStats && (() => {
        const currentYear = new Date().getFullYear().toString();
        const currentYearMonths = sortedMonths.filter(m => m.startsWith(currentYear));
        const pastMonths = sortedMonths.filter(m => !m.startsWith(currentYear));
        // 過去年をグループ化
        const pastYears: Record<string, string[]> = {};
        pastMonths.forEach(m => {
          const year = m.substring(0, 4);
          if (!pastYears[year]) pastYears[year] = [];
          pastYears[year].push(m);
        });
        const pastYearKeys = Object.keys(pastYears).sort().reverse();

        const renderMonthAccordion = (month: string) => {
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
        };

        return (
          <Accordion disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderTop: '1px solid #ddd' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 36, backgroundColor: '#f5f5f5', '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Typography variant="caption" fontWeight="bold" sx={{ color: '#333' }}>
                持家ヒアリング統計（月別）
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
            {/* 今年の月（直接表示） */}
            {currentYearMonths.map(renderMonthAccordion)}
            {/* 過去年（年ごとにアコーディオンで折りたたみ） */}
            {pastYearKeys.map(year => (
              <Accordion key={year} disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderTop: '1px solid #ddd' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 36, backgroundColor: '#eeeeee', '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                  <Typography variant="caption" fontWeight="bold" sx={{ color: '#666' }}>{year}年</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  {pastYears[year].map(renderMonthAccordion)}
                </AccordionDetails>
              </Accordion>
            ))}
            </AccordionDetails>
          </Accordion>
        );
      })()}

      {/* 買付統計セクション（内覧日月別×後続担当別） */}
      {(() => {
        const purchaseStats = categoryCounts.purchaseMonthlyStats || {};
        const purchaseSortedMonths = Object.keys(purchaseStats).sort().reverse();
        if (purchaseSortedMonths.length === 0) return null;

        const currentYear = new Date().getFullYear().toString();
        const currentYearMonths = purchaseSortedMonths.filter(m => m.startsWith(currentYear));
        const pastMonths = purchaseSortedMonths.filter(m => !m.startsWith(currentYear));
        const pastYears: Record<string, string[]> = {};
        pastMonths.forEach(m => {
          const year = m.substring(0, 4);
          if (!pastYears[year]) pastYears[year] = [];
          pastYears[year].push(m);
        });
        const pastYearKeys = Object.keys(pastYears).sort().reverse();

        const renderPurchaseMonthAccordion = (month: string) => {
          const data = purchaseStats[month];
          const totalRyote = Object.values(data.ryoteCounts).reduce((s, v) => s + v, 0);
          const totalKatate = Object.values(data.katateCounts).reduce((s, v) => s + v, 0);
          const totalPurchase = totalRyote + totalKatate;
          if (totalPurchase === 0) return null;

          // 全担当を取得（両手と片手の担当を統合）
          const allAssignees = Array.from(new Set([
            ...Object.keys(data.ryoteCounts),
            ...Object.keys(data.katateCounts),
          ])).sort();

          return (
            <Accordion key={month} disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 32, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                <Typography variant="caption" fontWeight="bold">{month}（計{totalPurchase}）</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0.5, pt: 0 }}>
                {/* 買（両手） */}
                <Box sx={{ px: 1, py: 0.3, backgroundColor: '#e8f5e9', borderBottom: '1px solid #eee' }}>
                  <Typography variant="caption" fontWeight="bold" sx={{ color: '#2e7d32', fontSize: '0.65rem' }}>買（両手）</Typography>
                  {allAssignees.map(staff => {
                    const count = data.ryoteCounts[staff] ?? 0;
                    if (count === 0) return null;
                    return (
                      <Box key={staff} sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{staff}</Typography>
                        <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{count}</Typography>
                      </Box>
                    );
                  })}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5, borderTop: '1px solid #eee' }}>
                    <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>計</Typography>
                    <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{totalRyote}</Typography>
                  </Box>
                </Box>
                {/* 買（片手） */}
                <Box sx={{ px: 1, py: 0.3, backgroundColor: '#fff3e0' }}>
                  <Typography variant="caption" fontWeight="bold" sx={{ color: '#e65100', fontSize: '0.65rem' }}>買（片手）</Typography>
                  {allAssignees.map(staff => {
                    const count = data.katateCounts[staff] ?? 0;
                    if (count === 0) return null;
                    return (
                      <Box key={staff} sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{staff}</Typography>
                        <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{count}</Typography>
                      </Box>
                    );
                  })}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5, borderTop: '1px solid #eee' }}>
                    <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>計</Typography>
                    <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{totalKatate}</Typography>
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          );
        };

        return (
          <Accordion disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderTop: '1px solid #ddd' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 36, backgroundColor: '#f5f5f5', '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Typography variant="caption" fontWeight="bold" sx={{ color: '#333' }}>
                買付統計（内覧日月別×後続担当）
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
            {currentYearMonths.map(renderPurchaseMonthAccordion)}
            {pastYearKeys.map(year => (
              <Accordion key={year} disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderTop: '1px solid #ddd' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 36, backgroundColor: '#eeeeee', '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                  <Typography variant="caption" fontWeight="bold" sx={{ color: '#666' }}>{year}年</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  {pastYears[year].map(renderPurchaseMonthAccordion)}
                </AccordionDetails>
              </Accordion>
            ))}
            </AccordionDetails>
          </Accordion>
        );
      })()}

      {/* 内覧統計セクション（内覧日月別×後続担当別） */}
      {(() => {
        const viewingStats = categoryCounts.viewingMonthlyStats || {};
        const viewingSortedMonths = Object.keys(viewingStats).sort().reverse();
        if (viewingSortedMonths.length === 0) return null;

        const currentYear = new Date().getFullYear().toString();
        const currentYearMonths = viewingSortedMonths.filter(m => m.startsWith(currentYear));
        const pastMonths = viewingSortedMonths.filter(m => !m.startsWith(currentYear));
        const pastYears: Record<string, string[]> = {};
        pastMonths.forEach(m => {
          const year = m.substring(0, 4);
          if (!pastYears[year]) pastYears[year] = [];
          pastYears[year].push(m);
        });
        const pastYearKeys = Object.keys(pastYears).sort().reverse();

        const renderViewingMonthAccordion = (month: string) => {
          const data = viewingStats[month];
          if (!data || data.total === 0) return null;

          const assignees = Object.keys(data.assigneeCounts).sort();

          return (
            <Accordion key={month} disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 32, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                <Typography variant="caption" fontWeight="bold">{month}（計{data.total}）</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0.5, pt: 0 }}>
                <Box sx={{ px: 1, py: 0.3, backgroundColor: '#e3f2fd' }}>
                  <Typography variant="caption" fontWeight="bold" sx={{ color: '#1565c0', fontSize: '0.65rem' }}>後続担当別</Typography>
                  {assignees.map(staff => {
                    const count = data.assigneeCounts[staff] ?? 0;
                    if (count === 0) return null;
                    return (
                      <Box key={staff} sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{staff}</Typography>
                        <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{count}</Typography>
                      </Box>
                    );
                  })}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 0.5, borderTop: '1px solid #eee' }}>
                    <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>計</Typography>
                    <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{data.total}</Typography>
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          );
        };

        return (
          <Accordion disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderTop: '1px solid #ddd' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 36, backgroundColor: '#f5f5f5', '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Typography variant="caption" fontWeight="bold" sx={{ color: '#333' }}>
                内覧統計（内覧日月別×後続担当）
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
            {currentYearMonths.map(renderViewingMonthAccordion)}
            {pastYearKeys.map(year => (
              <Accordion key={year} disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderTop: '1px solid #ddd' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 36, backgroundColor: '#eeeeee', '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                  <Typography variant="caption" fontWeight="bold" sx={{ color: '#666' }}>{year}年</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  {pastYears[year].map(renderViewingMonthAccordion)}
                </AccordionDetails>
              </Accordion>
            ))}
            </AccordionDetails>
          </Accordion>
        );
      })()}
    </>
  );
}
