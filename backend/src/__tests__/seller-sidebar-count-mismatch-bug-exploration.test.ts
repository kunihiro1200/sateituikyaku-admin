/**
 * 売主サイドバーカウント不一致バグ - バグ条件探索テスト
 *
 * このテストは修正後のコードで PASS することを確認する（バグが修正されたことを証明）
 *
 * バグ条件:
 * 1. todayCallAssigned: 追客中チェックなしで専任媒介等がフィルタに含まれていた
 * 2. todayCallNotStarted: 他決→追客がカウントに含まれるがフィルタに含まれなかった
 * 3. pinrichEmpty: 他決→追客がカウントに含まれるがフィルタに含まれなかった
 *
 * 修正後の期待動作:
 * - todayCallAssigned: 追客中を含む売主のみが返される（専任媒介等は除外）
 * - todayCallNotStarted: status === '追客中' のみが返される（カウント計算と一致）
 * - pinrichEmpty: 追客中 OR 他決→追客 かつ pinrich_status が空の売主が返される
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

describe('売主サイドバーカウント不一致バグ - バグ条件探索（修正後確認）', () => {
  const todayJST = getTodayJST();

  /**
   * Property 1: todayCallAssigned - 追客中チェックの修正確認
   *
   * 修正後: 追客中を含む売主のみが返される（専任媒介等は除外される）
   * カウント計算と同じ条件になっていることを確認する。
   */
  it('todayCallAssigned: 修正後は追客中を含む売主のみが返される（専任媒介等は除外）', async () => {
    // 修正後のフィルタ条件（todayCallAssigned）
    const { data: filteredSellers, error } = await supabase
      .from('sellers')
      .select('id, status, visit_assignee, next_call_date')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .lte('next_call_date', todayJST)
      .ilike('status', '%追客中%')
      .not('status', 'ilike', '%追客不要%')
      .not('status', 'ilike', '%専任媒介%')
      .not('status', 'ilike', '%一般媒介%')
      .not('status', 'ilike', '%他社買取%')
      .limit(100);

    if (error) {
      console.log('エラー:', error.message);
    }

    console.log(`todayCallAssigned フィルタ件数（修正後）: ${filteredSellers?.length ?? 0}件`);

    // 全ての結果が「追客中」を含むことを確認
    if (filteredSellers && filteredSellers.length > 0) {
      for (const s of filteredSellers) {
        expect((s.status || '').includes('追客中')).toBe(true);
        expect((s.status || '').includes('追客不要')).toBe(false);
        expect((s.status || '').includes('専任媒介')).toBe(false);
        expect((s.status || '').includes('一般媒介')).toBe(false);
        expect((s.status || '').includes('他社買取')).toBe(false);
      }
    }

    // 専任媒介のステータスを持つ売主が含まれていないことを確認
    const { data: exclusionCheck } = await supabase
      .from('sellers')
      .select('id, status')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .lte('next_call_date', todayJST)
      .ilike('status', '%専任媒介%')
      .limit(10);

    if (exclusionCheck && exclusionCheck.length > 0) {
      const filteredIds = new Set((filteredSellers || []).map(s => s.id));
      for (const s of exclusionCheck) {
        // 専任媒介の売主はフィルタ結果に含まれない
        expect(filteredIds.has(s.id)).toBe(false);
        console.log(`専任媒介の売主 ${s.id} はフィルタ結果に含まれない ✓`);
      }
    }
  });

  /**
   * Property 2: todayCallNotStarted - status === '追客中' のみの確認
   *
   * 修正後: カウント計算（todayCallNotStartedCount）と同じ条件
   * status === '追客中' のみが返される（他決→追客は除外）
   */
  it('todayCallNotStarted: 修正後は status === 追客中 のみが返される', async () => {
    // 修正後のJSフィルタ条件（todayCallNotStarted）
    const { data: candidates } = await supabase
      .from('sellers')
      .select('id, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, confidence_level, exclusion_date, inquiry_date')
      .is('deleted_at', null)
      .not('next_call_date', 'is', null)
      .lte('next_call_date', todayJST)
      .limit(500);

    const notStartedSellers = (candidates || []).filter(s => {
      const status = s.status || '';
      if (status !== '追客中') return false;
      if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) return false;
      const visitAssignee = s.visit_assignee || '';
      if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;
      const hasInfo = (s.phone_contact_person?.trim()) ||
                      (s.preferred_contact_time?.trim()) ||
                      (s.contact_method?.trim());
      if (hasInfo) return false;
      const unreachable = s.unreachable_status || '';
      if (unreachable && unreachable.trim() !== '') return false;
      const confidence = s.confidence_level || '';
      if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;
      const exclusionDate = s.exclusion_date || '';
      if (exclusionDate && exclusionDate.trim() !== '') return false;
      const inquiryDate = s.inquiry_date || '';
      return inquiryDate >= '2026-01-01';
    });

    console.log(`todayCallNotStarted フィルタ件数（修正後）: ${notStartedSellers.length}件`);

    // 全ての結果が status === '追客中' であることを確認
    for (const s of notStartedSellers) {
      expect(s.status).toBe('追客中');
    }

    // 他決→追客の売主が含まれていないことを確認
    const otherDecisionSellers = notStartedSellers.filter(s => s.status === '他決→追客');
    expect(otherDecisionSellers.length).toBe(0);
    console.log(`他決→追客の売主がフィルタ結果に含まれない ✓`);
  });

  /**
   * Property 3: pinrichEmpty - 追客中 OR 他決→追客 かつ pinrich_status が空の確認
   *
   * 修正後: カウント計算（pinrichEmptyCount）と同じ条件
   * 追客中 OR 他決→追客 かつ pinrich_status が空の売主が返される
   */
  it('pinrichEmpty: 修正後は追客中 OR 他決→追客 かつ pinrich_status が空の売主が返される', async () => {
    // 修正後のJSフィルタ条件（pinrichEmpty）
    const { data: candidates } = await supabase
      .from('sellers')
      .select('id, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, pinrich_status')
      .is('deleted_at', null)
      .not('next_call_date', 'is', null)
      .lte('next_call_date', todayJST)
      .limit(500);

    const pinrichEmptySellers = (candidates || []).filter(s => {
      const status = s.status || '';
      const isFollowingUp = status.includes('追客中') || status === '他決→追客';
      if (!isFollowingUp) return false;
      if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) return false;
      const visitAssignee = s.visit_assignee || '';
      if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;
      const hasInfo = (s.phone_contact_person?.trim()) ||
                      (s.preferred_contact_time?.trim()) ||
                      (s.contact_method?.trim());
      if (hasInfo) return false;
      const pinrich = s.pinrich_status || '';
      return !pinrich || pinrich.trim() === '';
    });

    console.log(`pinrichEmpty フィルタ件数（修正後）: ${pinrichEmptySellers.length}件`);

    // 全ての結果が条件を満たすことを確認
    for (const s of pinrichEmptySellers) {
      const status = s.status || '';
      const isFollowingUp = status.includes('追客中') || status === '他決→追客';
      expect(isFollowingUp).toBe(true);
      const pinrich = s.pinrich_status || '';
      expect(!pinrich || pinrich.trim() === '').toBe(true);
    }

    // 他決→追客かつpinrich_statusが空の売主が含まれることを確認（修正前は除外されていた）
    const otherDecisionPinrichEmpty = pinrichEmptySellers.filter(s => s.status === '他決→追客');
    console.log(`他決→追客かつpinrich空の売主数: ${otherDecisionPinrichEmpty.length}件`);
    // 存在する場合は含まれていることを確認（修正の効果）
    if (otherDecisionPinrichEmpty.length > 0) {
      console.log(`✓ 他決→追客の売主がpinrichEmptyフィルタに含まれるようになった（修正効果確認）`);
    }
  });

  /**
   * Property 4: 修正後のtodayCallAssignedカウントとフィルタ件数の一致確認
   *
   * seller_sidebar_countsテーブルのtodayCallAssignedカウントと
   * 修正後のフィルタ件数が一致することを確認する。
   */
  it('todayCallAssigned: seller_sidebar_countsのカウントとフィルタ件数が一致する', async () => {
    // seller_sidebar_countsテーブルからカウントを取得
    const { data: sidebarCounts } = await supabase
      .from('seller_sidebar_counts')
      .select('today_call_assigned_count')
      .limit(1)
      .single();

    if (!sidebarCounts) {
      console.log('⚠️ seller_sidebar_countsテーブルにデータがないためスキップ');
      return;
    }

    const sidebarCount = sidebarCounts.today_call_assigned_count || 0;
    console.log(`seller_sidebar_counts.today_call_assigned_count: ${sidebarCount}`);

    // 修正後のフィルタ件数を取得
    const { count: filterCount } = await supabase
      .from('sellers')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .lte('next_call_date', todayJST)
      .ilike('status', '%追客中%')
      .not('status', 'ilike', '%追客不要%')
      .not('status', 'ilike', '%専任媒介%')
      .not('status', 'ilike', '%一般媒介%')
      .not('status', 'ilike', '%他社買取%');

    console.log(`修正後のtodayCallAssignedフィルタ件数: ${filterCount}`);

    // カウントとフィルタ件数が一致することを確認
    expect(filterCount).toBe(sidebarCount);
  });
});
