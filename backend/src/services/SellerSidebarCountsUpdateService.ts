import { SupabaseClient } from '@supabase/supabase-js';

/**
 * seller_sidebar_countsテーブルを更新するサービス
 * getSidebarCountsFallback()のロジックを使用してカウントを計算し、テーブルに保存
 */
export class SellerSidebarCountsUpdateService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * seller_sidebar_countsテーブルを更新
   * 
   * このメソッドは以下のタイミングで呼び出される：
   * 1. 売主データが変更されたとき（トリガー経由）
   * 2. 定期的なcronジョブ（10分ごと）
   * 3. 手動実行（デバッグ用）
   */
  async updateSellerSidebarCounts(): Promise<void> {
    const startTime = Date.now();
    console.log('🚀 [SellerSidebarCountsUpdate] Starting update...');

    try {
      // 今日の日付（JST）
      const now = new Date();
      const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
      const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;

      // 未査定の基準日
      const cutoffDate = '2025-12-08';

      // ヘルパー関数: 営担が有効かどうかを判定
      const hasValidVisitAssignee = (visitAssignee: string | null | undefined): boolean => {
        if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') {
          return false;
        }
        return true;
      };

      // 全データを並列取得
      const [
        visitAssigneeForDayBeforeResult,
        visitCompletedCountResult,
        todayCallAssignedResult,
        allAssignedResult,
        todayCallBaseResult1,
        todayCallBaseResult2,
        unvaluatedSellersResult,
        mailingPendingCountResult,
        exclusiveSellersResult,
        generalSellersResult,
        visitOtherDecisionSellersResult,
        unvisitedOtherDecisionSellersResult
      ] = await Promise.all([
        // 1. 訪問日前日用データ
        this.supabase
          .from('sellers')
          .select('visit_date, visit_assignee, visit_reminder_assignee')
          .is('deleted_at', null)
          .not('visit_assignee', 'is', null)
          .neq('visit_assignee', '')
          .not('visit_date', 'is', null),
        // 2. 訪問済みカウント
        this.supabase
          .from('sellers')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null)
          .not('visit_assignee', 'is', null)
          .neq('visit_assignee', '')
          .lt('visit_date', todayJST),
        // 3. 当日TEL（担当）用データ
        this.supabase
          .from('sellers')
          .select('visit_assignee')
          .is('deleted_at', null)
          .not('visit_assignee', 'is', null)
          .neq('visit_assignee', '')
          .lte('next_call_date', todayJST)
          .ilike('status', '%追客中%')
          .not('status', 'ilike', '%追客不要%')
          .not('status', 'ilike', '%専任媒介%')
          .not('status', 'ilike', '%一般媒介%')
          .not('status', 'ilike', '%他社買取%'),
        // 4. 担当(イニシャル)親カテゴリ用データ
        this.supabase
          .from('sellers')
          .select('visit_assignee')
          .is('deleted_at', null)
          .not('visit_assignee', 'is', null)
          .neq('visit_assignee', '')
          .not('status', 'ilike', '%一般媒介%')
          .not('status', 'ilike', '%専任媒介%')
          .not('status', 'ilike', '%追客不要%')
          .not('status', 'ilike', '%他社買取%'),
        // 5. 当日TEL分/当日TEL（内容）用データ
        this.supabase
          .from('sellers')
          .select('id, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, inquiry_date, pinrich_status, confidence_level, exclusion_date, status')
          .is('deleted_at', null)
          .ilike('status', '%追客中%')
          .not('next_call_date', 'is', null)
          .lte('next_call_date', todayJST),
        this.supabase
          .from('sellers')
          .select('id, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, inquiry_date, pinrich_status, confidence_level, exclusion_date, status')
          .is('deleted_at', null)
          .eq('status', '他決→追客')
          .not('next_call_date', 'is', null)
          .lte('next_call_date', todayJST),
        // 6. 未査定用データ
        this.supabase
          .from('sellers')
          .select('id, status, valuation_amount_1, valuation_amount_2, valuation_amount_3, visit_assignee, valuation_method, inquiry_date, unreachable_status, confidence_level, exclusion_date, next_call_date, phone_contact_person, preferred_contact_time, contact_method')
          .is('deleted_at', null)
          .ilike('status', '%追客中%')
          .gte('inquiry_date', cutoffDate)
          .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す'),
        // 7. 査定（郵送）カウント
        this.supabase
          .from('sellers')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null)
          .in('status', ['追客中', '除外後追客中', '他決→追客'])
          .eq('valuation_method', '机上査定（郵送）')
          .eq('mailing_status', '未'),
        // 8. 専任カテゴリー用データ
        this.supabase
          .from('sellers')
          .select('exclusive_other_decision_meeting, next_call_date')
          .is('deleted_at', null)
          .in('status', ['専任媒介', '他決→専任', 'リースバック（専任）']),
        // 9. 一般カテゴリー用データ
        this.supabase
          .from('sellers')
          .select('exclusive_other_decision_meeting, next_call_date, contract_year_month')
          .is('deleted_at', null)
          .eq('status', '一般媒介')
          .gte('contract_year_month', '2025-06-23'),
        // 10. 訪問後他決カテゴリー用データ
        this.supabase
          .from('sellers')
          .select('exclusive_other_decision_meeting, next_call_date, visit_assignee')
          .is('deleted_at', null)
          .in('status', ['他決→追客', '他決→追客不要', '一般→他決', '他社買取'])
          .not('visit_assignee', 'is', null)
          .neq('visit_assignee', ''),
        // 11. 未訪問他決カテゴリー用データ
        this.supabase
          .from('sellers')
          .select('exclusive_other_decision_meeting, next_call_date, visit_assignee')
          .is('deleted_at', null)
          .in('status', ['他決→追客', '他決→追客不要', '一般→他決'])
      ]);

      console.log(`⏱️ [SellerSidebarCountsUpdate] Data fetched in ${Date.now() - startTime}ms`);

      // カウント計算（getSidebarCountsFallback()と同じロジック）
      const visitAssigneeSellers = visitAssigneeForDayBeforeResult.data || [];
      const visitDayBeforeCount = visitAssigneeSellers.filter(s => {
        const visitDateStr = s.visit_date;
        if (!visitDateStr) return false;
        const reminderAssignee = (s as any).visit_reminder_assignee || '';
        if (reminderAssignee.trim() !== '') return false;
        
        const visitDateOnly = visitDateStr.split('T')[0].split(' ')[0];
        const parts = visitDateOnly.split('-');
        if (parts.length !== 3) return false;
        const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const visitDayOfWeek = visitDate.getDay();
        const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
        const expectedNotifyDate = new Date(visitDate);
        expectedNotifyDate.setDate(visitDate.getDate() - daysBeforeVisit);
        const expectedNotifyStr = `${expectedNotifyDate.getFullYear()}-${String(expectedNotifyDate.getMonth() + 1).padStart(2, '0')}-${String(expectedNotifyDate.getDate()).padStart(2, '0')}`;
        return expectedNotifyStr === todayJST;
      }).length;

      const visitCompletedCount = visitCompletedCountResult.count || 0;

      const todayCallAssignedSellers = todayCallAssignedResult.data || [];
      const todayCallAssignedCount = todayCallAssignedSellers.length;
      const todayCallAssignedCounts: Record<string, number> = {};
      todayCallAssignedSellers.forEach((s: any) => {
        const a = s.visit_assignee;
        if (a) todayCallAssignedCounts[a] = (todayCallAssignedCounts[a] || 0) + 1;
      });

      const allAssignedSellers = allAssignedResult.data || [];
      const visitAssignedCounts: Record<string, number> = {};
      allAssignedSellers.forEach((s: any) => {
        const a = s.visit_assignee;
        if (a) visitAssignedCounts[a] = (visitAssignedCounts[a] || 0) + 1;
      });

      const allTodayCallBase = [...(todayCallBaseResult1.data || []), ...(todayCallBaseResult2.data || [])];
      const seenIds = new Set<string>();
      const todayCallBaseSellers = allTodayCallBase.filter(s => {
        if (seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
      });

      const filteredTodayCallSellers = todayCallBaseSellers.filter(s => {
        return !hasValidVisitAssignee(s.visit_assignee);
      });

      const todayCallWithInfoSellers = filteredTodayCallSellers.filter(s => {
        const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                        (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                        (s.contact_method && s.contact_method.trim() !== '');
        return hasInfo;
      });
      const todayCallWithInfoCount = todayCallWithInfoSellers.length;

      const labelCountMap: Record<string, number> = {};
      const isValidValue = (v: string | null | undefined): boolean =>
        !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');
      todayCallWithInfoSellers.forEach(s => {
        const parts: string[] = [];
        if (isValidValue(s.phone_contact_person)) parts.push(s.phone_contact_person!.trim());
        if (isValidValue(s.preferred_contact_time)) parts.push(s.preferred_contact_time!.trim());
        if (isValidValue(s.contact_method)) parts.push(s.contact_method!.trim());
        const label = parts.length > 0 ? `当日TEL(${parts.join('・')})` : '当日TEL（内容）';
        labelCountMap[label] = (labelCountMap[label] || 0) + 1;
      });

      const todayCallNoInfoCount = filteredTodayCallSellers.filter(s => {
        const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                        (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                        (s.contact_method && s.contact_method.trim() !== '');
        return !hasInfo;
      }).length;

      const unvaluatedSellers = unvaluatedSellersResult.data || [];
      const unvaluatedCount = unvaluatedSellers.filter(s => {
        const hasNoValuation = !s.valuation_amount_1 && !s.valuation_amount_2 && !s.valuation_amount_3;
        const valuationMethod = (s as any).valuation_method || '';
        const isNotRequired = valuationMethod === '不要';
        if (!hasNoValuation || isNotRequired) return false;
        const status = (s as any).status || '';
        const nextCallDate = (s as any).next_call_date || '';
        const hasInfo = ((s as any).phone_contact_person?.trim()) ||
                        ((s as any).preferred_contact_time?.trim()) ||
                        ((s as any).contact_method?.trim());
        const unreachable = (s as any).unreachable_status || '';
        const confidence = (s as any).confidence_level || '';
        const exclusionDate = (s as any).exclusion_date || '';
        const inquiryDate = (s as any).inquiry_date || '';
        const isTodayCallNotStarted = (
          status === '追客中' &&
          nextCallDate && nextCallDate <= todayJST &&
          !hasInfo &&
          !unreachable &&
          confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
          !exclusionDate &&
          inquiryDate >= '2026-01-01'
        );
        return !isTodayCallNotStarted;
      }).length;

      const mailingPendingCount = mailingPendingCountResult.count || 0;

      const todayCallNotStartedCount = filteredTodayCallSellers.filter(s => {
        const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                        (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                        (s.contact_method && s.contact_method.trim() !== '');
        if (hasInfo) return false;
        const status = (s as any).status || '';
        if (status !== '追客中') return false;
        const unreachable = (s as any).unreachable_status || '';
        if (unreachable && unreachable.trim() !== '') return false;
        const confidence = (s as any).confidence_level || '';
        if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;
        const exclusionDate = (s as any).exclusion_date || '';
        if (exclusionDate && exclusionDate.trim() !== '') return false;
        const inquiryDate = (s as any).inquiry_date || '';
        return inquiryDate >= '2026-01-01';
      }).length;

      const pinrichEmptyCount = filteredTodayCallSellers.filter(s => {
        const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                        (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                        (s.contact_method && s.contact_method.trim() !== '');
        if (hasInfo) return false;
        const pinrich = (s as any).pinrich_status || '';
        return !pinrich || pinrich.trim() === '';
      }).length;

      const exclusiveSellers = exclusiveSellersResult.data || [];
      const exclusiveCount = exclusiveSellers.filter(s => {
        const meeting = s.exclusive_other_decision_meeting;
        if (meeting === '完了') return false;
        const nextCallDate = s.next_call_date;
        if (!nextCallDate) return true;
        return nextCallDate !== todayJST;
      }).length;

      const generalSellers = generalSellersResult.data || [];
      const generalCount = generalSellers.filter(s => {
        const meeting = s.exclusive_other_decision_meeting;
        if (meeting === '完了') return false;
        const nextCallDate = s.next_call_date;
        if (!nextCallDate) return true;
        return nextCallDate !== todayJST;
      }).length;

      const visitOtherDecisionSellers = visitOtherDecisionSellersResult.data || [];
      const visitOtherDecisionCount = visitOtherDecisionSellers.filter(s => {
        const meeting = s.exclusive_other_decision_meeting;
        if (meeting === '完了') return false;
        const nextCallDate = s.next_call_date;
        if (!nextCallDate) return true;
        return nextCallDate !== todayJST;
      }).length;

      const unvisitedOtherDecisionSellers = unvisitedOtherDecisionSellersResult.data || [];
      const unvisitedOtherDecisionCount = unvisitedOtherDecisionSellers.filter(s => {
        const meeting = s.exclusive_other_decision_meeting;
        if (meeting === '完了') return false;
        const nextCallDate = s.next_call_date;
        if (!nextCallDate || nextCallDate !== todayJST) {
          const visitAssignee = s.visit_assignee;
          return !visitAssignee || visitAssignee === '' || visitAssignee === '外す';
        }
        return false;
      }).length;

      console.log(`⏱️ [SellerSidebarCountsUpdate] Counts calculated in ${Date.now() - startTime}ms`);

      // seller_sidebar_countsテーブルを更新
      // 1. 既存データを削除
      await this.supabase.from('seller_sidebar_counts').delete().neq('id', 0);

      // 2. 新しいデータを挿入
      const rows: any[] = [
        { category: 'todayCall', count: todayCallNoInfoCount, label: null, assignee: null },
        { category: 'todayCallWithInfo', count: todayCallWithInfoCount, label: null, assignee: null },
        { category: 'todayCallAssigned', count: todayCallAssignedCount, label: null, assignee: null },
        { category: 'visitDayBefore', count: visitDayBeforeCount, label: null, assignee: null },
        { category: 'visitCompleted', count: visitCompletedCount, label: null, assignee: null },
        { category: 'unvaluated', count: unvaluatedCount, label: null, assignee: null },
        { category: 'mailingPending', count: mailingPendingCount, label: null, assignee: null },
        { category: 'todayCallNotStarted', count: todayCallNotStartedCount, label: null, assignee: null },
        { category: 'pinrichEmpty', count: pinrichEmptyCount, label: null, assignee: null },
        { category: 'exclusive', count: exclusiveCount, label: null, assignee: null },
        { category: 'general', count: generalCount, label: null, assignee: null },
        { category: 'visitOtherDecision', count: visitOtherDecisionCount, label: null, assignee: null },
        { category: 'unvisitedOtherDecision', count: unvisitedOtherDecisionCount, label: null, assignee: null },
      ];

      // todayCallWithInfoLabels
      Object.entries(labelCountMap).forEach(([label, count]) => {
        rows.push({ category: 'todayCallWithInfo', count, label, assignee: null });
      });

      // todayCallAssignedCounts
      Object.entries(todayCallAssignedCounts).forEach(([assignee, count]) => {
        rows.push({ category: 'todayCallAssigned', count, label: null, assignee });
      });

      // visitAssignedCounts
      Object.entries(visitAssignedCounts).forEach(([assignee, count]) => {
        rows.push({ category: 'visitAssigned', count, label: null, assignee });
      });

      const { error: insertError } = await this.supabase
        .from('seller_sidebar_counts')
        .insert(rows);

      if (insertError) {
        console.error('❌ [SellerSidebarCountsUpdate] Insert error:', insertError);
        throw insertError;
      }

      console.log(`✅ [SellerSidebarCountsUpdate] Update completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error('❌ [SellerSidebarCountsUpdate] Update failed:', error);
      throw error;
    }
  }
}
