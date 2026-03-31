/**
 * 当日TEL(I)カテゴリの「他社買取」除外確認スクリプト
 * 
 * 目的: 「当日TEL(I)」カテゴリに「他社買取」の売主が含まれていないことを確認
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkTodayCallAssignedI() {
  console.log('🔍 当日TEL(I)カテゴリの「他社買取」除外確認\n');

  // 今日の日付（JST）
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
  console.log(`📅 今日の日付（JST）: ${todayJST}\n`);

  // 1. 当日TEL(I)の全売主を取得（「他社買取」除外なし）
  const { data: allTodayCallI, error: error1 } = await supabase
    .from('sellers')
    .select('seller_number, name, status, visit_assignee, next_call_date')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .eq('visit_assignee', 'I')
    .lte('next_call_date', todayJST)
    .not('status', 'ilike', '%追客不要%')
    .not('status', 'ilike', '%専任媒介%')
    .not('status', 'ilike', '%一般媒介%');

  if (error1) {
    console.error('❌ エラー:', error1);
    return;
  }

  console.log(`📊 当日TEL(I)の全売主（「他社買取」除外なし）: ${allTodayCallI?.length || 0}件\n`);

  // 2. 当日TEL(I)の全売主を取得（「他社買取」除外あり）
  const { data: todayCallIExcluded, error: error2 } = await supabase
    .from('sellers')
    .select('seller_number, name, status, visit_assignee, next_call_date')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .eq('visit_assignee', 'I')
    .lte('next_call_date', todayJST)
    .not('status', 'ilike', '%追客不要%')
    .not('status', 'ilike', '%専任媒介%')
    .not('status', 'ilike', '%一般媒介%')
    .not('status', 'ilike', '%他社買取%');

  if (error2) {
    console.error('❌ エラー:', error2);
    return;
  }

  console.log(`📊 当日TEL(I)の全売主（「他社買取」除外あり）: ${todayCallIExcluded?.length || 0}件\n`);

  // 3. 差分を計算（「他社買取」の売主）
  const otherCompanyPurchaseSellers = (allTodayCallI || []).filter(seller => {
    const status = seller.status || '';
    return status.includes('他社買取');
  });

  console.log(`🚫 「他社買取」の売主: ${otherCompanyPurchaseSellers.length}件\n`);

  if (otherCompanyPurchaseSellers.length > 0) {
    console.log('📋 「他社買取」の売主一覧:');
    otherCompanyPurchaseSellers.forEach(seller => {
      console.log(`  - ${seller.seller_number}: ${seller.name} (状況: ${seller.status})`);
    });
    console.log('');
  }

  // 4. 結果の検証
  const expectedCount = (allTodayCallI?.length || 0) - otherCompanyPurchaseSellers.length;
  const actualCount = todayCallIExcluded?.length || 0;

  console.log('📊 結果の検証:');
  console.log(`  期待値: ${expectedCount}件`);
  console.log(`  実際の値: ${actualCount}件`);

  if (expectedCount === actualCount) {
    console.log('  ✅ 正しく除外されています！');
  } else {
    console.log('  ❌ 除外が正しく動作していません');
  }
}

checkTodayCallAssignedI().catch(console.error);
