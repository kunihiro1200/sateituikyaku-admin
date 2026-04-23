import { SupabaseClient } from '@supabase/supabase-js';

// 更新フィールド → 影響カテゴリのマッピング
const FIELD_TO_CATEGORIES: Record<string, string[]> = {
  next_call_date: [
    'todayCall', 'todayCallWithInfo', 'todayCallAssigned',
    'todayCallNotStarted', 'unvaluated',
    'exclusive', 'general', 'visitOtherDecision', 'unvisitedOtherDecision',
  ],
  visit_assignee: [
    'visitDayBefore', 'visitCompleted', 'visitAssigned',
    'todayCallAssigned', 'todayCall', 'todayCallWithInfo', 'todayCallNotStarted',
    'unvaluated', 'pinrichEmpty', 'pinrichChangeRequired',
    'visitOtherDecision', 'unvisitedOtherDecision',
  ],
  visit_date: [
    'visitDayBefore', 'visitCompleted', 'visitAssigned',
    'pinrichChangeRequired',
  ],
  status: [
    'todayCall', 'todayCallWithInfo', 'todayCallAssigned',
    'todayCallNotStarted', 'unvaluated', 'mailingPending',
    'exclusive', 'general', 'visitOtherDecision', 'unvisitedOtherDecision',
    'pinrichEmpty', 'pinrichChangeRequired', 'visitAssigned',
  ],
  phone_contact_person: ['todayCall', 'todayCallWithInfo', 'todayCallNotStarted', 'unvaluated'],
  preferred_contact_time: ['todayCall', 'todayCallWithInfo', 'todayCallNotStarted', 'unvaluated'],
  contact_method: ['todayCall', 'todayCallWithInfo', 'todayCallNotStarted', 'unvaluated'],
  unreachable_status: ['todayCallNotStarted', 'unvaluated'],
  confidence_level: ['todayCallNotStarted', 'unvaluated', 'pinrichChangeRequired'],
  inquiry_date: ['todayCallNotStarted', 'unvaluated', 'pinrichEmpty'],
  valuation_amount_1: ['unvaluated'],
  valuation_amount_2: ['unvaluated'],
  valuation_amount_3: ['unvaluated'],
  valuation_method: ['unvaluated', 'mailingPending'],
  mailing_status: ['mailingPending'],
  pinrich_status: ['pinrichEmpty', 'pinrichChangeRequired'],
  contract_year_month: ['general', 'pinrichChangeRequired'],
  exclusive_other_decision_meeting: ['exclusive', 'general', 'visitOtherDecision', 'unvisitedOtherDecision'],
  visit_reminder_assignee: ['visitDayBefore'],
};

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
      // 🔧 訪問日前日用データはページネーション対応（1000件超の場合に対応）
      let visitAssigneeAllSellers: any[] = [];
      {
        let vdbPage = 0;
        const vdbPageSize = 1000;
        while (true) {
          const { data, error } = await this.supabase
            .from('sellers')
            .select('visit_date, visit_assignee, visit_reminder_assignee')
            .is('deleted_at', null)
            .not('visit_assignee', 'is', null)
            .neq('visit_assignee', '')
            .not('visit_date', 'is', null)
            .range(vdbPage * vdbPageSize, (vdbPage + 1) * vdbPageSize - 1);
          if (error || !data || data.length === 0) break;
          visitAssigneeAllSellers = visitAssigneeAllSellers.concat(data);
          if (data.length < vdbPageSize) break;
          vdbPage++;
        }
      }

      const [
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
        unvisitedOtherDecisionSellersResult,
      ] = await Promise.all([
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
          .in('status', ['他決→追客', '他決→追客不要', '一般→他決']),
      ]);

      // 12. Pinrich要変更カテゴリー用データ（ページネーション対応）
      let pinrichCandidatesAll: any[] = [];
      {
        let pcPage = 0;
        const pcPageSize = 1000;
        while (true) {
          const { data: pcData, error: pcError } = await this.supabase
            .from('sellers')
            .select('id, visit_assignee, pinrich_status, status, confidence_level, visit_date, contract_year_month')
            .is('deleted_at', null)
            .or('pinrich_status.eq.配信中,pinrich_status.eq.クローズ,confidence_level.eq.D')
            .range(pcPage * pcPageSize, (pcPage + 1) * pcPageSize - 1);
          if (pcError || !pcData || pcData.length === 0) break;
          pinrichCandidatesAll = pinrichCandidatesAll.concat(pcData);
          if (pcData.length < pcPageSize) break;
          pcPage++;
        }
      }

      console.log(`⏱️ [SellerSidebarCountsUpdate] Data fetched in ${Date.now() - startTime}ms`);

      // カウント計算（getSidebarCountsFallback()と同じロジック）
      const visitAssigneeSellers = visitAssigneeAllSellers;
      const visitDayBeforeCount = visitAssigneeSellers.filter(s => {
        // 🚨 3.1.2: 訪問日が空欄の売主を明示的に除外
        const visitDateStr = s.visit_date;
        if (!visitDateStr || visitDateStr.trim() === '') return false;
        
        // 🚨 3.1.3: visit_reminder_assigneeが空であることを確認
        const reminderAssignee = (s as any).visit_reminder_assignee || '';
        if (reminderAssignee.trim() !== '') return false;
        
        // 🚨 3.1.1: isVisitDayBefore()関数と一致するロジック
        // TIMESTAMP型対応: visit_dateから日付部分のみを抽出
        let visitDateOnly = visitDateStr;
        if (typeof visitDateStr === 'string') {
          if (visitDateStr.includes(' ')) {
            visitDateOnly = visitDateStr.split(' ')[0]; // "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DD"
          } else if (visitDateStr.includes('T')) {
            visitDateOnly = visitDateStr.split('T')[0]; // "YYYY-MM-DDTHH:MM:SS.000Z" → "YYYY-MM-DD"
          }
        }
        
        const parts = visitDateOnly.split('-');
        if (parts.length !== 3) return false;
        
        // 🔧 タイムゾーン安全な日付計算（Vercel UTC環境対応）
        // new Date(year, month, day) はローカルタイム依存のため使用しない
        // 代わりに YYYY-MM-DD 文字列から曜日を計算する
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // 0-indexed
        const day = parseInt(parts[2]);
        // UTC基準で日付を作成（タイムゾーン非依存）
        const visitDateUTC = new Date(Date.UTC(year, month, day));
        
        // 水曜定休・木曜2日前ロジック（isVisitDayBeforeUtilと同じ）
        const visitDayOfWeek = visitDateUTC.getUTCDay();
        const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
        const expectedNotifyUTC = new Date(visitDateUTC);
        expectedNotifyUTC.setUTCDate(visitDateUTC.getUTCDate() - daysBeforeVisit);
        const expectedNotifyStr = `${expectedNotifyUTC.getUTCFullYear()}-${String(expectedNotifyUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(expectedNotifyUTC.getUTCDate()).padStart(2, '0')}`;
        
        const match = expectedNotifyStr === todayJST;
        return match;
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
        // 追客不要を含むステータスを除外（架電対象外）
        const status = s.status || '';
        if (status.includes('追客不要')) return false;
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

      // 「未着手（todayCallNotStarted）」条件を満たす売主を todayCall から除外する
      // 理由: 「未着手」は全カテゴリーの中で最高優先順位を持ち、
      //       1人の売主は必ず1つのカテゴリーにのみカウントされなければならない
      const todayCallNoInfoCount = filteredTodayCallSellers.filter(s => {
        const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                        (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                        (s.contact_method && s.contact_method.trim() !== '');
        // 連絡先情報がある場合は todayCallWithInfo に分類されるため除外
        if (hasInfo) return false;
        // 未着手条件を満たす売主は todayCallNotStarted に分類されるため除外
        // （未着手は全カテゴリーの中で最高優先順位）
        const status = (s as any).status || '';
        const unreachable = (s as any).unreachable_status || '';
        const confidence = (s as any).confidence_level || '';
        const inquiryDate = (s as any).inquiry_date || '';
        const isNotStarted = status === '追客中' &&
          !unreachable &&
          confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
          inquiryDate >= '2026-01-01';
        // 未着手条件を満たす場合は todayCall から除外（todayCallNotStarted にのみカウント）
        return !isNotStarted;
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
        const inquiryDate = (s as any).inquiry_date || '';
        return inquiryDate >= '2026-01-01';
      }).length;

      // Pinrich空欄カウント: 次電日に関係なく「追客中 + Pinrich空欄 + 反響日2026/1/1以降 + 営担なし」
      // ※ filteredTodayCallSellers（次電日が今日以前）には依存しない
      let pinrichEmptyAllSellers: any[] = [];
      {
        let pePage = 0;
        const pePageSize = 1000;
        while (true) {
          const { data: peData, error: peError } = await this.supabase
            .from('sellers')
            .select('id, visit_assignee, pinrich_status, inquiry_date, status')
            .is('deleted_at', null)
            .ilike('status', '%追客%')
            .not('status', 'ilike', '%追客不要%')
            .not('status', 'ilike', '%専任媒介%')
            .not('status', 'ilike', '%一般媒介%')
            .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
            .or('pinrich_status.is.null,pinrich_status.eq.')
            .gte('inquiry_date', '2026-01-01')
            .range(pePage * pePageSize, (pePage + 1) * pePageSize - 1);
          if (peError || !peData || peData.length === 0) break;
          pinrichEmptyAllSellers = pinrichEmptyAllSellers.concat(peData);
          if (peData.length < pePageSize) break;
          pePage++;
        }
      }
      const pinrichEmptyCount = pinrichEmptyAllSellers.length;

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

      // Pinrich要変更カウント計算（条件A〜DのいずれかにマッチするものをJSでフィルタリング）
      const excludedPinrichB = new Set(['クローズ', '登録不要', 'アドレスエラー', '配信不要（他決後、訪問後、担当付）', '△配信停止']);
      const validStatusC = new Set(['専任媒介', '追客中', '除外後追客中']);
      const validStatusD = new Set(['他決→追客', '他決→追客不要', '一般媒介']);
      const pinrichChangeRequiredCount = (pinrichCandidatesAll).filter(s => {
        const pinrich = s.pinrich_status || '';
        const status = s.status || '';
        const assignee = s.visit_assignee || '';
        const confidence = s.confidence_level || '';
        const visitDate = s.visit_date || '';
        const contractYM = s.contract_year_month ? String(s.contract_year_month).substring(0, 10) : '';

        const condA = assignee === '外す' && pinrich === 'クローズ' && status === '追客中';
        const condB = confidence === 'D' && !excludedPinrichB.has(pinrich);
        const condC = !!visitDate && pinrich === '配信中' && !!assignee && assignee.trim() !== '' && validStatusC.has(status);
        const condD = validStatusD.has(status) && pinrich === 'クローズ' && contractYM >= '2025-05-01';

        return condA || condB || condC || condD;
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
        { category: 'pinrichChangeRequired', count: pinrichChangeRequiredCount, label: null, assignee: null },
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

  /**
   * 更新されたフィールドから影響するカテゴリだけを再計算してupsertする（軽量版）
   * 保存時に呼び出す。全件再計算より大幅に高速。
   */
  async updateAffectedCategories(updatedFields: string[]): Promise<void> {
    const startTime = Date.now();

    // 影響カテゴリを収集（重複排除）
    const affected = new Set<string>();
    for (const field of updatedFields) {
      const cats = FIELD_TO_CATEGORIES[field] || [];
      cats.forEach(c => affected.add(c));
    }

    if (affected.size === 0) {
      console.log('ℹ️ [SidebarCounts] No affected categories, skipping update');
      return;
    }

    console.log(`🚀 [SidebarCounts] Updating affected categories: ${[...affected].join(', ')}`);

    // JST今日
    const now = new Date();
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
    const cutoffDate = '2025-12-08';

    const hasValidVisitAssignee = (v: string | null | undefined) =>
      !!(v && v.trim() !== '' && v.trim() !== '外す');

    // 影響カテゴリに必要なクエリだけ並列実行
    const queries: Record<string, any> = {};

    const needsTodayCallBase = affected.has('todayCall') || affected.has('todayCallWithInfo') || affected.has('todayCallNotStarted');
    const needsVisitDayBefore = affected.has('visitDayBefore');
    const needsVisitCompleted = affected.has('visitCompleted');
    const needsTodayCallAssigned = affected.has('todayCallAssigned');
    const needsVisitAssigned = affected.has('visitAssigned');
    const needsUnvaluated = affected.has('unvaluated');
    const needsMailingPending = affected.has('mailingPending');
    const needsExclusive = affected.has('exclusive');
    const needsGeneral = affected.has('general');
    const needsVisitOtherDecision = affected.has('visitOtherDecision');
    const needsUnvisitedOtherDecision = affected.has('unvisitedOtherDecision');
    const needsPinrichEmpty = affected.has('pinrichEmpty');
    const needsPinrichChange = affected.has('pinrichChangeRequired');

    if (needsTodayCallBase) {
      queries.todayCallBase1 = this.supabase
        .from('sellers')
        .select('id, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, inquiry_date, status')
        .is('deleted_at', null)
        .ilike('status', '%追客中%')
        .not('next_call_date', 'is', null)
        .lte('next_call_date', todayJST);
      queries.todayCallBase2 = this.supabase
        .from('sellers')
        .select('id, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, inquiry_date, status')
        .is('deleted_at', null)
        .eq('status', '他決→追客')
        .not('next_call_date', 'is', null)
        .lte('next_call_date', todayJST);
    }
    if (needsVisitDayBefore) {
      queries.visitDayBefore = this.supabase
        .from('sellers')
        .select('visit_date, visit_assignee, visit_reminder_assignee')
        .is('deleted_at', null)
        .not('visit_assignee', 'is', null)
        .neq('visit_assignee', '')
        .not('visit_date', 'is', null);
    }
    if (needsVisitCompleted) {
      queries.visitCompleted = this.supabase
        .from('sellers')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .not('visit_assignee', 'is', null)
        .neq('visit_assignee', '')
        .lt('visit_date', todayJST);
    }
    if (needsTodayCallAssigned) {
      queries.todayCallAssigned = this.supabase
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
        .not('status', 'ilike', '%他社買取%');
    }
    if (needsVisitAssigned) {
      queries.visitAssigned = this.supabase
        .from('sellers')
        .select('visit_assignee')
        .is('deleted_at', null)
        .not('visit_assignee', 'is', null)
        .neq('visit_assignee', '')
        .not('status', 'ilike', '%一般媒介%')
        .not('status', 'ilike', '%専任媒介%')
        .not('status', 'ilike', '%追客不要%')
        .not('status', 'ilike', '%他社買取%');
    }
    if (needsUnvaluated) {
      queries.unvaluated = this.supabase
        .from('sellers')
        .select('id, status, valuation_amount_1, valuation_amount_2, valuation_amount_3, visit_assignee, valuation_method, inquiry_date, unreachable_status, confidence_level, next_call_date, phone_contact_person, preferred_contact_time, contact_method')
        .is('deleted_at', null)
        .ilike('status', '%追客中%')
        .gte('inquiry_date', cutoffDate)
        .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す');
    }
    if (needsMailingPending) {
      queries.mailingPending = this.supabase
        .from('sellers')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .in('status', ['追客中', '除外後追客中', '他決→追客'])
        .eq('valuation_method', '机上査定（郵送）')
        .eq('mailing_status', '未');
    }
    if (needsExclusive) {
      queries.exclusive = this.supabase
        .from('sellers')
        .select('exclusive_other_decision_meeting, next_call_date')
        .is('deleted_at', null)
        .in('status', ['専任媒介', '他決→専任', 'リースバック（専任）']);
    }
    if (needsGeneral) {
      queries.general = this.supabase
        .from('sellers')
        .select('exclusive_other_decision_meeting, next_call_date, contract_year_month')
        .is('deleted_at', null)
        .eq('status', '一般媒介')
        .gte('contract_year_month', '2025-06-23');
    }
    if (needsVisitOtherDecision) {
      queries.visitOtherDecision = this.supabase
        .from('sellers')
        .select('exclusive_other_decision_meeting, next_call_date, visit_assignee')
        .is('deleted_at', null)
        .in('status', ['他決→追客', '他決→追客不要', '一般→他決', '他社買取'])
        .not('visit_assignee', 'is', null)
        .neq('visit_assignee', '');
    }
    if (needsUnvisitedOtherDecision) {
      queries.unvisitedOtherDecision = this.supabase
        .from('sellers')
        .select('exclusive_other_decision_meeting, next_call_date, visit_assignee')
        .is('deleted_at', null)
        .in('status', ['他決→追客', '他決→追客不要', '一般→他決']);
    }
    if (needsPinrichEmpty) {
      queries.pinrichEmpty = this.supabase
        .from('sellers')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .ilike('status', '%追客%')
        .not('status', 'ilike', '%追客不要%')
        .not('status', 'ilike', '%専任媒介%')
        .not('status', 'ilike', '%一般媒介%')
        .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
        .or('pinrich_status.is.null,pinrich_status.eq.')
        .gte('inquiry_date', '2026-01-01');
    }
    if (needsPinrichChange) {
      queries.pinrichChange = this.supabase
        .from('sellers')
        .select('visit_assignee, pinrich_status, status, confidence_level, visit_date, contract_year_month')
        .is('deleted_at', null)
        .or('pinrich_status.eq.配信中,pinrich_status.eq.クローズ,confidence_level.eq.D');
    }

    // 全クエリを並列実行
    const keys = Object.keys(queries);
    const results = await Promise.all(keys.map(k => queries[k]));
    const resultMap: Record<string, any> = {};
    keys.forEach((k, i) => { resultMap[k] = results[i]; });

    console.log(`⏱️ [SidebarCounts] Queries done in ${Date.now() - startTime}ms`);

    // カウント計算
    const upsertRows: any[] = [];

    // todayCall / todayCallWithInfo / todayCallNotStarted
    if (needsTodayCallBase) {
      const base1 = resultMap.todayCallBase1?.data || [];
      const base2 = resultMap.todayCallBase2?.data || [];
      const seenIds = new Set<string>();
      const merged = [...base1, ...base2].filter(s => {
        if (seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
      });
      const filtered = merged.filter(s => {
        if ((s.status || '').includes('追客不要')) return false;
        return !hasValidVisitAssignee(s.visit_assignee);
      });

      const withInfo = filtered.filter(s =>
        (s.phone_contact_person?.trim()) || (s.preferred_contact_time?.trim()) || (s.contact_method?.trim())
      );
      const notStarted = filtered.filter(s => {
        if ((s.phone_contact_person?.trim()) || (s.preferred_contact_time?.trim()) || (s.contact_method?.trim())) return false;
        if (s.status !== '追客中') return false;
        if (s.unreachable_status?.trim()) return false;
        const c = s.confidence_level || '';
        if (c === 'ダブり' || c === 'D' || c === 'AI査定') return false;
        return (s.inquiry_date || '') >= '2026-01-01';
      });
      const noInfo = filtered.filter(s => {
        if ((s.phone_contact_person?.trim()) || (s.preferred_contact_time?.trim()) || (s.contact_method?.trim())) return false;
        const isNotStarted = s.status === '追客中' && !s.unreachable_status?.trim() &&
          !['ダブり', 'D', 'AI査定'].includes(s.confidence_level || '') &&
          (s.inquiry_date || '') >= '2026-01-01';
        return !isNotStarted;
      });

      // todayCallWithInfo ラベル別
      const isValidValue = (v: string | null | undefined) => !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');
      const labelCountMap: Record<string, number> = {};
      withInfo.forEach(s => {
        const parts: string[] = [];
        if (isValidValue(s.phone_contact_person)) parts.push(s.phone_contact_person.trim());
        if (isValidValue(s.preferred_contact_time)) parts.push(s.preferred_contact_time.trim());
        if (isValidValue(s.contact_method)) parts.push(s.contact_method.trim());
        const label = parts.length > 0 ? `当日TEL(${parts.join('・')})` : '当日TEL（内容）';
        labelCountMap[label] = (labelCountMap[label] || 0) + 1;
      });

      if (affected.has('todayCall')) {
        upsertRows.push({ category: 'todayCall', count: noInfo.length, label: null, assignee: null });
      }
      if (affected.has('todayCallWithInfo')) {
        upsertRows.push({ category: 'todayCallWithInfo', count: withInfo.length, label: null, assignee: null });
        // ラベル別行は一旦削除してから再挿入するため、ここでは集める
        Object.entries(labelCountMap).forEach(([label, count]) => {
          upsertRows.push({ category: 'todayCallWithInfo', count, label, assignee: null });
        });
      }
      if (affected.has('todayCallNotStarted')) {
        upsertRows.push({ category: 'todayCallNotStarted', count: notStarted.length, label: null, assignee: null });
      }
    }

    // visitDayBefore
    if (needsVisitDayBefore) {
      const sellers = resultMap.visitDayBefore?.data || [];
      const count = sellers.filter((s: any) => {
        const visitDateStr = s.visit_date;
        if (!visitDateStr) return false;
        if ((s.visit_reminder_assignee || '').trim() !== '') return false;
        let visitDateOnly = visitDateStr;
        if (visitDateStr.includes(' ')) visitDateOnly = visitDateStr.split(' ')[0];
        else if (visitDateStr.includes('T')) visitDateOnly = visitDateStr.split('T')[0];
        const parts = visitDateOnly.split('-');
        if (parts.length !== 3) return false;
        const visitDateUTC = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
        const dow = visitDateUTC.getUTCDay();
        const daysBefore = dow === 4 ? 2 : 1;
        const notifyUTC = new Date(visitDateUTC);
        notifyUTC.setUTCDate(visitDateUTC.getUTCDate() - daysBefore);
        const notifyStr = `${notifyUTC.getUTCFullYear()}-${String(notifyUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(notifyUTC.getUTCDate()).padStart(2, '0')}`;
        return notifyStr === todayJST;
      }).length;
      upsertRows.push({ category: 'visitDayBefore', count, label: null, assignee: null });
    }

    // visitCompleted
    if (needsVisitCompleted) {
      upsertRows.push({ category: 'visitCompleted', count: resultMap.visitCompleted?.count || 0, label: null, assignee: null });
    }

    // todayCallAssigned（合計 + イニシャル別）
    if (needsTodayCallAssigned) {
      const sellers = resultMap.todayCallAssigned?.data || [];
      const counts: Record<string, number> = {};
      sellers.forEach((s: any) => { if (s.visit_assignee) counts[s.visit_assignee] = (counts[s.visit_assignee] || 0) + 1; });
      upsertRows.push({ category: 'todayCallAssigned', count: sellers.length, label: null, assignee: null });
      Object.entries(counts).forEach(([assignee, count]) => {
        upsertRows.push({ category: 'todayCallAssigned', count, label: null, assignee });
      });
    }

    // visitAssigned（イニシャル別）
    if (needsVisitAssigned) {
      const sellers = resultMap.visitAssigned?.data || [];
      const counts: Record<string, number> = {};
      sellers.forEach((s: any) => { if (s.visit_assignee) counts[s.visit_assignee] = (counts[s.visit_assignee] || 0) + 1; });
      Object.entries(counts).forEach(([assignee, count]) => {
        upsertRows.push({ category: 'visitAssigned', count, label: null, assignee });
      });
    }

    // unvaluated
    if (needsUnvaluated) {
      const sellers = resultMap.unvaluated?.data || [];
      const count = sellers.filter((s: any) => {
        if (s.valuation_amount_1 || s.valuation_amount_2 || s.valuation_amount_3) return false;
        if (s.valuation_method === '不要') return false;
        const hasInfo = s.phone_contact_person?.trim() || s.preferred_contact_time?.trim() || s.contact_method?.trim();
        const isNotStarted = s.status === '追客中' && s.next_call_date && s.next_call_date <= todayJST &&
          !hasInfo && !s.unreachable_status?.trim() &&
          !['ダブり', 'D', 'AI査定'].includes(s.confidence_level || '') &&
          (s.inquiry_date || '') >= '2026-01-01';
        return !isNotStarted;
      }).length;
      upsertRows.push({ category: 'unvaluated', count, label: null, assignee: null });
    }

    // mailingPending
    if (needsMailingPending) {
      upsertRows.push({ category: 'mailingPending', count: resultMap.mailingPending?.count || 0, label: null, assignee: null });
    }

    // exclusive
    if (needsExclusive) {
      const count = (resultMap.exclusive?.data || []).filter((s: any) => {
        if (s.exclusive_other_decision_meeting === '完了') return false;
        return !s.next_call_date || s.next_call_date !== todayJST;
      }).length;
      upsertRows.push({ category: 'exclusive', count, label: null, assignee: null });
    }

    // general
    if (needsGeneral) {
      const count = (resultMap.general?.data || []).filter((s: any) => {
        if (s.exclusive_other_decision_meeting === '完了') return false;
        return !s.next_call_date || s.next_call_date !== todayJST;
      }).length;
      upsertRows.push({ category: 'general', count, label: null, assignee: null });
    }

    // visitOtherDecision
    if (needsVisitOtherDecision) {
      const count = (resultMap.visitOtherDecision?.data || []).filter((s: any) => {
        if (s.exclusive_other_decision_meeting === '完了') return false;
        return !s.next_call_date || s.next_call_date !== todayJST;
      }).length;
      upsertRows.push({ category: 'visitOtherDecision', count, label: null, assignee: null });
    }

    // unvisitedOtherDecision
    if (needsUnvisitedOtherDecision) {
      const count = (resultMap.unvisitedOtherDecision?.data || []).filter((s: any) => {
        if (s.exclusive_other_decision_meeting === '完了') return false;
        if (!s.next_call_date || s.next_call_date !== todayJST) {
          return !s.visit_assignee || s.visit_assignee === '' || s.visit_assignee === '外す';
        }
        return false;
      }).length;
      upsertRows.push({ category: 'unvisitedOtherDecision', count, label: null, assignee: null });
    }

    // pinrichEmpty
    if (needsPinrichEmpty) {
      upsertRows.push({ category: 'pinrichEmpty', count: resultMap.pinrichEmpty?.count || 0, label: null, assignee: null });
    }

    // pinrichChangeRequired
    if (needsPinrichChange) {
      const excludedB = new Set(['クローズ', '登録不要', 'アドレスエラー', '配信不要（他決後、訪問後、担当付）', '△配信停止']);
      const validC = new Set(['専任媒介', '追客中', '除外後追客中']);
      const validD = new Set(['他決→追客', '他決→追客不要', '一般媒介']);
      const count = (resultMap.pinrichChange?.data || []).filter((s: any) => {
        const pinrich = s.pinrich_status || '';
        const status = s.status || '';
        const assignee = s.visit_assignee || '';
        const confidence = s.confidence_level || '';
        const visitDate = s.visit_date || '';
        const contractYM = s.contract_year_month ? String(s.contract_year_month).substring(0, 10) : '';
        return (assignee === '外す' && pinrich === 'クローズ' && status === '追客中') ||
               (confidence === 'D' && !excludedB.has(pinrich)) ||
               (!!visitDate && pinrich === '配信中' && !!assignee && assignee.trim() !== '' && validC.has(status)) ||
               (validD.has(status) && pinrich === 'クローズ' && contractYM >= '2025-05-01');
      }).length;
      upsertRows.push({ category: 'pinrichChangeRequired', count, label: null, assignee: null });
    }

    if (upsertRows.length === 0) return;

    // 影響カテゴリの既存行を削除してから挿入（upsertはlabel/assigneeがnullの場合に競合するため）
    const categoriesToDelete = [...new Set(upsertRows.map(r => r.category))];

    // todayCallWithInfo のラベル行も削除対象に含める
    if (affected.has('todayCallWithInfo')) {
      // label付き行も削除するため category = 'todayCallWithInfo' で全削除
    }
    // todayCallAssigned のassignee行も削除対象
    // visitAssigned のassignee行も削除対象

    await this.supabase
      .from('seller_sidebar_counts')
      .delete()
      .in('category', categoriesToDelete);

    const { error } = await this.supabase
      .from('seller_sidebar_counts')
      .insert(upsertRows);

    if (error) {
      console.error('❌ [SidebarCounts] Upsert error:', error);
      throw error;
    }

    console.log(`✅ [SidebarCounts] Affected categories updated in ${Date.now() - startTime}ms (${upsertRows.length} rows)`);
  }
}
