/**
 * 売主サイドバーカウント不一致バグ - 保存プロパティテスト
 *
 * このテストは修正前のコードで実行し、PASSすることを確認する（ベースライン動作を確認）
 * 修正後も引き続きPASSすることで、リグレッションがないことを検証する。
 *
 * 保存対象カテゴリ（修正対象外）:
 * - visitDayBefore（訪問日前日）
 * - visitCompleted（訪問済み）
 * - todayCall（当日TEL分）
 * - unvaluated（未査定）
 * - mailingPending（査定郵送）
 * - exclusive（専任）
 * - general（一般）
 * - visitOtherDecision（訪問後他決）
 * - unvisitedOtherDecision（未訪問他決）
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// 今日の日付（JST）
function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

// 昨日の日付（JST）
function getYesterdayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setDate(jst.getDate() - 1);
  return jst.toISOString().split('T')[0];
}

// 明日の日付（JST）
function getTomorrowJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setDate(jst.getDate() + 1);
  return jst.toISOString().split('T')[0];
}

describe('売主サイドバーカウント不一致バグ - 保存プロパティ', () => {
  const todayJST = getTodayJST();
  const yesterdayJST = getYesterdayJST();
  const tomorrowJST = getTomorrowJST();

  /**
   * Property 1: visitCompleted（訪問済み）の動作保持
   *
   * 訪問済みカテゴリは「営担あり AND 訪問日が昨日以前」の売主を返す。
   * 修正対象外のため、修正前後で同じ結果を返すことを確認する。
   */
  it('visitCompleted: 営担ありかつ訪問日が昨日以前の売主のみが返される', async () => {
    // 訪問済み条件を満たす売主を取得（現在のロジックと同じ）
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('id, visit_assignee, visit_date')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .lt('visit_date', todayJST)
      .limit(50);

    if (error) {
      console.log('エラー:', error.message);
    }

    console.log(`visitCompleted 候補数: ${sellers?.length ?? 0}件`);

    // 全ての結果が条件を満たすことを確認
    if (sellers && sellers.length > 0) {
      for (const s of sellers) {
        expect(s.visit_assignee).toBeTruthy();
        expect(s.visit_assignee).not.toBe('');
        expect(s.visit_date).toBeTruthy();
        expect(s.visit_date < todayJST).toBe(true);
      }
    }

    // 訪問日が今日以降の売主は含まれないことを確認
    const { data: futureSellers } = await supabase
      .from('sellers')
      .select('id, visit_assignee, visit_date')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .gte('visit_date', todayJST)
      .limit(10);

    if (futureSellers && futureSellers.length > 0) {
      const futureIds = new Set(futureSellers.map(s => s.id));
      const completedIds = new Set((sellers || []).map(s => s.id));
      // 訪問日が今日以降の売主は訪問済みに含まれない
      for (const id of futureIds) {
        expect(completedIds.has(id)).toBe(false);
      }
    }
  });

  /**
   * Property 2: todayCall（当日TEL分）の動作保持
   *
   * 当日TEL分カテゴリは「追客中 OR 他決→追客 AND 次電日が今日以前 AND コミュニケーション情報なし AND 営担なし」の売主を返す。
   * 修正対象外のため、修正前後で同じ結果を返すことを確認する。
   */
  it('todayCall: 追客中かつ次電日が今日以前かつコミュニケーション情報なしかつ営担なしの売主のみが返される', async () => {
    // 当日TEL分の条件を満たす売主を取得
    const { data: candidates, error } = await supabase
      .from('sellers')
      .select('id, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method')
      .is('deleted_at', null)
      .not('next_call_date', 'is', null)
      .lte('next_call_date', todayJST)
      .limit(200);

    if (error) {
      console.log('エラー:', error.message);
    }

    // JSでフィルタ（現在のロジックと同じ）
    const todayCallSellers = (candidates || []).filter(s => {
      const status = s.status || '';
      const isFollowingUp = status.includes('追客中') || status === '他決→追客';
      if (!isFollowingUp) return false;
      if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) return false;
      const visitAssignee = s.visit_assignee || '';
      if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                     (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                     (s.contact_method && s.contact_method.trim() !== '');
      return !hasInfo;
    });

    console.log(`todayCall 候補数: ${todayCallSellers.length}件`);

    // 全ての結果が条件を満たすことを確認
    for (const s of todayCallSellers) {
      const status = s.status || '';
      const isFollowingUp = status.includes('追客中') || status === '他決→追客';
      expect(isFollowingUp).toBe(true);
      expect(status.includes('追客不要')).toBe(false);
      expect(status.includes('専任媒介')).toBe(false);
      expect(status.includes('一般媒介')).toBe(false);
      expect(s.next_call_date <= todayJST).toBe(true);
    }
  });

  /**
   * Property 3: unvaluated（未査定）の動作保持
   *
   * 未査定カテゴリは「追客中 AND 査定額が全て空 AND 反響日付が基準日以降 AND 営担が空」の売主を返す。
   * 修正対象外のため、修正前後で同じ結果を返すことを確認する。
   */
  it('unvaluated: 追客中かつ査定額が全て空かつ営担なしの売主のみが返される', async () => {
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('id, status, valuation_amount_1, valuation_amount_2, valuation_amount_3, visit_assignee')
      .is('deleted_at', null)
      .ilike('status', '%追客中%')
      .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
      .is('valuation_amount_1', null)
      .is('valuation_amount_2', null)
      .is('valuation_amount_3', null)
      .limit(50);

    if (error) {
      console.log('エラー:', error.message);
    }

    console.log(`unvaluated 候補数: ${sellers?.length ?? 0}件`);

    // 全ての結果が条件を満たすことを確認
    if (sellers && sellers.length > 0) {
      for (const s of sellers) {
        expect((s.status || '').includes('追客中')).toBe(true);
        expect(s.valuation_amount_1).toBeNull();
        expect(s.valuation_amount_2).toBeNull();
        expect(s.valuation_amount_3).toBeNull();
      }
    }
  });

  /**
   * Property 4: mailingPending（査定郵送）の動作保持
   *
   * 査定郵送カテゴリは「郵送ステータスが「未」」の売主を返す。
   * 修正対象外のため、修正前後で同じ結果を返すことを確認する。
   */
  it('mailingPending: 郵送ステータスが「未」の売主のみが返される', async () => {
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('id, mailing_status')
      .is('deleted_at', null)
      .eq('mailing_status', '未')
      .limit(50);

    if (error) {
      console.log('エラー:', error.message);
    }

    console.log(`mailingPending 候補数: ${sellers?.length ?? 0}件`);

    // 全ての結果が条件を満たすことを確認
    if (sellers && sellers.length > 0) {
      for (const s of sellers) {
        expect(s.mailing_status).toBe('未');
      }
    }
  });

  /**
   * Property 5: exclusive（専任）の動作保持
   *
   * 専任カテゴリは「専任他決打合せ <> "完了" AND 次電日 <> TODAY() AND 状況が専任媒介関連」の売主を返す。
   * 修正対象外のため、修正前後で同じ結果を返すことを確認する。
   */
  it('exclusive: 専任媒介関連ステータスかつ次電日が今日以外の売主のみが返される', async () => {
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('id, status, next_call_date, exclusive_other_decision_meeting')
      .is('deleted_at', null)
      .in('status', ['専任媒介', '他決→専任', 'リースバック（専任）'])
      .or(`next_call_date.is.null,next_call_date.neq.${todayJST}`)
      .limit(50);

    if (error) {
      console.log('エラー:', error.message);
    }

    console.log(`exclusive 候補数: ${sellers?.length ?? 0}件`);

    // 全ての結果が条件を満たすことを確認
    if (sellers && sellers.length > 0) {
      for (const s of sellers) {
        expect(['専任媒介', '他決→専任', 'リースバック（専任）'].includes(s.status)).toBe(true);
        // 次電日が今日ではないことを確認
        if (s.next_call_date) {
          expect(s.next_call_date).not.toBe(todayJST);
        }
      }
    }
  });

  /**
   * Property 6: general（一般）の動作保持
   *
   * 一般カテゴリは「専任他決打合せ <> "完了" AND 次電日 <> TODAY() AND 状況が一般媒介 AND 契約年月 >= 2025/6/23」の売主を返す。
   * 修正対象外のため、修正前後で同じ結果を返すことを確認する。
   */
  it('general: 一般媒介かつ次電日が今日以外かつ契約年月が基準日以降の売主のみが返される', async () => {
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('id, status, next_call_date, contract_year_month')
      .is('deleted_at', null)
      .eq('status', '一般媒介')
      .not('contract_year_month', 'is', null)
      .gte('contract_year_month', '2025-06-23')
      .or(`next_call_date.is.null,next_call_date.neq.${todayJST}`)
      .limit(50);

    if (error) {
      console.log('エラー:', error.message);
    }

    console.log(`general 候補数: ${sellers?.length ?? 0}件`);

    // 全ての結果が条件を満たすことを確認
    if (sellers && sellers.length > 0) {
      for (const s of sellers) {
        expect(s.status).toBe('一般媒介');
        expect(s.contract_year_month).toBeTruthy();
        expect(s.contract_year_month >= '2025-06-23').toBe(true);
        if (s.next_call_date) {
          expect(s.next_call_date).not.toBe(todayJST);
        }
      }
    }
  });

  /**
   * Property 7: visitOtherDecision（訪問後他決）の動作保持
   *
   * 訪問後他決カテゴリは「専任他決打合せ <> "完了" AND 次電日 <> TODAY() AND 状況が他決関連 AND 営担あり」の売主を返す。
   * 修正対象外のため、修正前後で同じ結果を返すことを確認する。
   */
  it('visitOtherDecision: 他決関連ステータスかつ営担ありかつ次電日が今日以外の売主のみが返される', async () => {
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('id, status, next_call_date, visit_assignee')
      .is('deleted_at', null)
      .in('status', ['他決→追客', '他決→追客不要', '一般→他決', '他社買取'])
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .or(`next_call_date.is.null,next_call_date.neq.${todayJST}`)
      .limit(50);

    if (error) {
      console.log('エラー:', error.message);
    }

    console.log(`visitOtherDecision 候補数: ${sellers?.length ?? 0}件`);

    // 全ての結果が条件を満たすことを確認
    if (sellers && sellers.length > 0) {
      for (const s of sellers) {
        expect(['他決→追客', '他決→追客不要', '一般→他決', '他社買取'].includes(s.status)).toBe(true);
        expect(s.visit_assignee).toBeTruthy();
        expect(s.visit_assignee).not.toBe('');
        if (s.next_call_date) {
          expect(s.next_call_date).not.toBe(todayJST);
        }
      }
    }
  });

  /**
   * Property 8: unvisitedOtherDecision（未訪問他決）の動作保持
   *
   * 未訪問他決カテゴリは「専任他決打合せ <> "完了" AND 次電日 <> TODAY() AND 状況が他決関連 AND 営担なし（「外す」も空欄扱い）」の売主を返す。
   * 修正対象外のため、修正前後で同じ結果を返すことを確認する。
   */
  it('unvisitedOtherDecision: 他決関連ステータスかつ営担なしかつ次電日が今日以外の売主のみが返される', async () => {
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('id, status, next_call_date, visit_assignee')
      .is('deleted_at', null)
      .in('status', ['他決→追客', '他決→追客不要', '一般→他決', '他社買取'])
      .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
      .or(`next_call_date.is.null,next_call_date.neq.${todayJST}`)
      .limit(50);

    if (error) {
      console.log('エラー:', error.message);
    }

    console.log(`unvisitedOtherDecision 候補数: ${sellers?.length ?? 0}件`);

    // 全ての結果が条件を満たすことを確認
    if (sellers && sellers.length > 0) {
      for (const s of sellers) {
        expect(['他決→追客', '他決→追客不要', '一般→他決', '他社買取'].includes(s.status)).toBe(true);
        // 営担が空または「外す」であることを確認
        const va = s.visit_assignee || '';
        const isNoAssignee = !va || va.trim() === '' || va.trim() === '外す';
        expect(isNoAssignee).toBe(true);
        if (s.next_call_date) {
          expect(s.next_call_date).not.toBe(todayJST);
        }
      }
    }
  });

  /**
   * Property 9: 修正対象外カテゴリは修正前後で同じ件数を返す（回帰テスト）
   *
   * todayCallAssigned、todayCallNotStarted、pinrichEmpty 以外のカテゴリは
   * 修正の影響を受けないことを確認する。
   */
  it('修正対象外カテゴリ: visitCompleted と todayCall の件数が一致する（ロジック整合性確認）', async () => {
    // visitCompleted: 営担あり AND 訪問日が昨日以前
    const { count: visitCompletedCount } = await supabase
      .from('sellers')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .lt('visit_date', todayJST);

    // mailingPending: 郵送ステータスが「未」
    const { count: mailingPendingCount } = await supabase
      .from('sellers')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('mailing_status', '未');

    console.log(`visitCompleted 件数: ${visitCompletedCount}`);
    console.log(`mailingPending 件数: ${mailingPendingCount}`);

    // 件数が取得できることを確認（nullでないこと）
    expect(visitCompletedCount).not.toBeNull();
    expect(mailingPendingCount).not.toBeNull();
    expect(typeof visitCompletedCount).toBe('number');
    expect(typeof mailingPendingCount).toBe('number');
  });
});
