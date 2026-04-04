/**
 * AA13918の除外日をクリアするスクリプト
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

async function clearAA13918ExclusionDate() {
  console.log('🔄 AA13918の除外日をクリア中...\n');

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. 現在のデータを確認
    const { data: before, error: beforeError } = await supabase
      .from('sellers')
      .select('seller_number, exclusion_date, valuation_method, status, inquiry_date, visit_assignee')
      .eq('seller_number', 'AA13918')
      .single();

    if (beforeError) {
      console.error('❌ AA13918の取得に失敗:', beforeError.message);
      return;
    }

    console.log('📊 修正前のデータ:');
    console.log(`   売主番号: ${before.seller_number}`);
    console.log(`   除外日: ${before.exclusion_date || '(空)'}`);
    console.log(`   査定方法: ${before.valuation_method || '(空)'}`);
    console.log(`   状況（当社）: ${before.status || '(空)'}`);
    console.log(`   反響日付: ${before.inquiry_date || '(空)'}`);
    console.log(`   営担: ${before.visit_assignee || '(空)'}\n`);

    // 2. 除外日をクリア
    const { error: updateError } = await supabase
      .from('sellers')
      .update({ exclusion_date: null })
      .eq('seller_number', 'AA13918');

    if (updateError) {
      console.error('❌ 除外日のクリアに失敗:', updateError.message);
      return;
    }

    console.log('✅ 除外日をクリアしました\n');

    // 3. 修正後のデータを確認
    const { data: after, error: afterError } = await supabase
      .from('sellers')
      .select('seller_number, exclusion_date, valuation_method, status, inquiry_date, visit_assignee')
      .eq('seller_number', 'AA13918')
      .single();

    if (afterError) {
      console.error('❌ 修正後のデータ取得に失敗:', afterError.message);
      return;
    }

    console.log('📊 修正後のデータ:');
    console.log(`   売主番号: ${after.seller_number}`);
    console.log(`   除外日: ${after.exclusion_date || '(空)'}`);
    console.log(`   査定方法: ${after.valuation_method || '(空)'}`);
    console.log(`   状況（当社）: ${after.status || '(空)'}`);
    console.log(`   反響日付: ${after.inquiry_date || '(空)'}`);
    console.log(`   営担: ${after.visit_assignee || '(空)'}\n`);

    console.log('🎉 完了！AA13918は「当日TEL_未着手」カテゴリに該当するようになり、「未査定」から除外されます。');

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
  }
}

clearAA13918ExclusionDate().catch(console.error);
