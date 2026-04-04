/**
 * サイドバーカウントを確認し、AA13918が正しくカウントされているか確認
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

async function checkSidebarCounts() {
  console.log('🔍 サイドバーカウントを確認中...\n');

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. seller_sidebar_countsテーブルを確認
    const { data: counts, error: countsError } = await supabase
      .from('seller_sidebar_counts')
      .select('*')
      .in('category', ['unvaluated', 'todayCallNotStarted'])
      .order('category');

    if (countsError) {
      console.error('❌ サイドバーカウントの取得に失敗:', countsError.message);
      return;
    }

    console.log('📊 現在のサイドバーカウント:');
    for (const count of counts || []) {
      console.log(`   ${count.category}: ${count.count}件 (更新: ${count.updated_at})`);
    }
    console.log();

    // 2. 実際のデータベースで「未査定」条件を満たす売主を確認
    const today = new Date().toISOString().split('T')[0];
    const cutoffDate = '2025-12-08';

    const { data: unvaluatedSellers, error: unvaluatedError } = await supabase
      .from('sellers')
      .select('seller_number, valuation_method, status, inquiry_date, visit_assignee, valuation_amount_1, valuation_amount_2, valuation_amount_3, exclusion_date, unreachable_status, next_call_date')
      .ilike('status', '%追客中%')
      .is('visit_assignee', null)
      .gte('inquiry_date', cutoffDate)
      .or('valuation_amount_1.is.null,valuation_amount_2.is.null,valuation_amount_3.is.null');

    if (unvaluatedError) {
      console.error('❌ 未査定売主の取得に失敗:', unvaluatedError.message);
      return;
    }

    // 「査定方法=不要」を除外
    const filteredUnvaluated = (unvaluatedSellers || []).filter(s => {
      // 査定方法が「不要」の場合は除外
      if (s.valuation_method === '不要') return false;
      
      // 当日TEL_未着手の条件を満たす場合は除外
      const isTodayCallNotStarted = 
        s.status === '追客中' &&
        s.next_call_date && s.next_call_date <= today &&
        !s.phone_contact_person && !s.preferred_contact_time && !s.contact_method &&
        !s.unreachable_status &&
        !s.exclusion_date &&
        s.inquiry_date && s.inquiry_date >= '2026-01-01';
      
      if (isTodayCallNotStarted) return false;
      
      return true;
    });

    console.log('📊 実際の「未査定」売主:');
    console.log(`   合計: ${filteredUnvaluated.length}件`);
    if (filteredUnvaluated.length > 0) {
      console.log('   売主番号:');
      for (const seller of filteredUnvaluated.slice(0, 10)) {
        console.log(`     - ${seller.seller_number}`);
      }
      if (filteredUnvaluated.length > 10) {
        console.log(`     ... 他${filteredUnvaluated.length - 10}件`);
      }
    }
    console.log();

    // 3. AA13918が含まれているか確認
    const aa13918InUnvaluated = filteredUnvaluated.some(s => s.seller_number === 'AA13918');
    console.log(`🔍 AA13918が「未査定」に含まれているか: ${aa13918InUnvaluated ? 'はい ❌' : 'いいえ ✅'}\n`);

    // 4. 「当日TEL_未着手」条件を満たす売主を確認
    const { data: todayCallNotStartedSellers, error: todayCallError } = await supabase
      .from('sellers')
      .select('seller_number, status, next_call_date, unreachable_status, exclusion_date, inquiry_date')
      .eq('status', '追客中')
      .lte('next_call_date', today)
      .is('unreachable_status', null)
      .is('exclusion_date', null)
      .gte('inquiry_date', '2026-01-01');

    if (todayCallError) {
      console.error('❌ 当日TEL_未着手売主の取得に失敗:', todayCallError.message);
      return;
    }

    console.log('📊 実際の「当日TEL_未着手」売主:');
    console.log(`   合計: ${todayCallNotStartedSellers?.length || 0}件`);
    if (todayCallNotStartedSellers && todayCallNotStartedSellers.length > 0) {
      console.log('   売主番号:');
      for (const seller of todayCallNotStartedSellers.slice(0, 10)) {
        console.log(`     - ${seller.seller_number}`);
      }
      if (todayCallNotStartedSellers.length > 10) {
        console.log(`     ... 他${todayCallNotStartedSellers.length - 10}件`);
      }
    }
    console.log();

    // 5. AA13918が含まれているか確認
    const aa13918InTodayCall = todayCallNotStartedSellers?.some(s => s.seller_number === 'AA13918');
    console.log(`🔍 AA13918が「当日TEL_未着手」に含まれているか: ${aa13918InTodayCall ? 'はい ✅' : 'いいえ ❌'}\n`);

    // 6. 結論
    if (!aa13918InUnvaluated && aa13918InTodayCall) {
      console.log('✅ 正常: AA13918は「未査定」から除外され、「当日TEL_未着手」に含まれています');
      console.log('⚠️  サイドバーカウントが古い可能性があります。GASの定期同期を待つか、手動で更新してください。');
    } else if (aa13918InUnvaluated) {
      console.log('❌ 問題: AA13918が「未査定」に含まれています');
      console.log('   原因を調査する必要があります。');
    } else {
      console.log('⚠️  AA13918がどちらのカテゴリにも含まれていません');
    }

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
  }
}

checkSidebarCounts().catch(console.error);
