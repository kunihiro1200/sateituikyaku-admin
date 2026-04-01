/**
 * バグ条件探索テスト - 一般カテゴリのフィルタリング条件
 * 
 * このテストは修正前のコードで実行され、失敗することが期待されます。
 * 失敗はバグの存在を証明します。
 * 
 * バグ条件: 次電日が今日ではない（今日より前または今日より後）一般媒介売主が
 * フィルタリング結果に含まれない
 */

// 環境変数を最初に読み込む
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

// 環境変数を読み込んだ後にインポート
import { SellerService } from './src/services/SellerService.supabase';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 今日の日付（JST）を取得
function getTodayJST(): string {
  const now = new Date();
  const jstOffset = 9 * 60; // JST is UTC+9
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  return jstTime.toISOString().split('T')[0];
}

// 昨日の日付（JST）を取得
function getYesterdayJST(): string {
  const now = new Date();
  const jstOffset = 9 * 60;
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  jstTime.setDate(jstTime.getDate() - 1);
  return jstTime.toISOString().split('T')[0];
}

// 明日の日付（JST）を取得
function getTomorrowJST(): string {
  const now = new Date();
  const jstOffset = 9 * 60;
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  jstTime.setDate(jstTime.getDate() + 1);
  return jstTime.toISOString().split('T')[0];
}

async function runBugConditionTest() {
  console.log('🔍 バグ条件探索テスト開始...\n');

  const todayJST = getTodayJST();
  const yesterdayJST = getYesterdayJST();
  const tomorrowJST = getTomorrowJST();

  console.log(`📅 今日: ${todayJST}`);
  console.log(`📅 昨日: ${yesterdayJST}`);
  console.log(`📅 明日: ${tomorrowJST}\n`);

  const sellerService = new SellerService();

  // テストケース1: 次電日が昨日（今日より前）の一般媒介売主
  console.log('📋 テストケース1: 次電日が昨日（今日より前）の一般媒介売主');
  console.log('期待: フィルタリング結果に含まれる（GASカウントに含まれるため）');
  console.log('実際: 修正前のコードでは含まれない（.gt条件のため）\n');

  const { data: yesterdaySellers, error: error1 } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month')
    .eq('status', '一般媒介')
    .eq('next_call_date', yesterdayJST)
    .neq('exclusive_other_decision_meeting', '完了')
    .gte('contract_year_month', '2025-06-23')
    .limit(5);

  if (error1) {
    console.error('❌ エラー:', error1);
  } else if (yesterdaySellers && yesterdaySellers.length > 0) {
    console.log(`✅ テストデータ: ${yesterdaySellers.length}件の一般媒介売主（次電日=昨日）を発見`);
    yesterdaySellers.forEach(s => {
      console.log(`   - ${s.seller_number}: 次電日=${s.next_call_date}`);
    });

    // 一般カテゴリでフィルタリング
    const result = await sellerService.listSellers({
      statusCategory: 'general',
      page: 1,
      limit: 1000,
    });

    const foundInResult = yesterdaySellers.filter(s =>
      result.sellers.some(r => r.sellerNumber === s.seller_number)
    );

    console.log(`\n🔍 フィルタリング結果: ${result.sellers.length}件`);
    console.log(`🔍 昨日の次電日の売主がフィルタリング結果に含まれているか: ${foundInResult.length}/${yesterdaySellers.length}件`);

    if (foundInResult.length === 0) {
      console.log('❌ バグ確認: 昨日の次電日の売主がフィルタリング結果に含まれていない');
      console.log('   原因: .gt("next_call_date", todayJST) は昨日を除外する\n');
    } else {
      console.log('✅ 修正済み: 昨日の次電日の売主がフィルタリング結果に含まれている\n');
    }
  } else {
    console.log('⚠️  テストデータなし: 次電日が昨日の一般媒介売主が存在しない\n');
  }

  // テストケース2: 次電日が明日（今日より後）の一般媒介売主
  console.log('📋 テストケース2: 次電日が明日（今日より後）の一般媒介売主');
  console.log('期待: フィルタリング結果に含まれる（GASカウントに含まれるため）');
  console.log('実際: 修正前のコードでも含まれる（.gt条件で正しく動作）\n');

  const { data: tomorrowSellers, error: error2 } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month')
    .eq('status', '一般媒介')
    .eq('next_call_date', tomorrowJST)
    .neq('exclusive_other_decision_meeting', '完了')
    .gte('contract_year_month', '2025-06-23')
    .limit(5);

  if (error2) {
    console.error('❌ エラー:', error2);
  } else if (tomorrowSellers && tomorrowSellers.length > 0) {
    console.log(`✅ テストデータ: ${tomorrowSellers.length}件の一般媒介売主（次電日=明日）を発見`);
    tomorrowSellers.forEach(s => {
      console.log(`   - ${s.seller_number}: 次電日=${s.next_call_date}`);
    });

    const result = await sellerService.listSellers({
      statusCategory: 'general',
      page: 1,
      limit: 1000,
    });

    const foundInResult = tomorrowSellers.filter(s =>
      result.sellers.some(r => r.sellerNumber === s.seller_number)
    );

    console.log(`\n🔍 フィルタリング結果: ${result.sellers.length}件`);
    console.log(`🔍 明日の次電日の売主がフィルタリング結果に含まれているか: ${foundInResult.length}/${tomorrowSellers.length}件`);

    if (foundInResult.length === tomorrowSellers.length) {
      console.log('✅ 正常: 明日の次電日の売主がフィルタリング結果に含まれている\n');
    } else {
      console.log('❌ 異常: 明日の次電日の売主がフィルタリング結果に含まれていない\n');
    }
  } else {
    console.log('⚠️  テストデータなし: 次電日が明日の一般媒介売主が存在しない\n');
  }

  // テストケース3: 次電日が今日の一般媒介売主
  console.log('📋 テストケース3: 次電日が今日の一般媒介売主');
  console.log('期待: フィルタリング結果に含まれない（GASカウントに含まれないため）');
  console.log('実際: 修正前のコードでも含まれない（.gt条件で正しく動作）\n');

  const { data: todaySellers, error: error3 } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month')
    .eq('status', '一般媒介')
    .eq('next_call_date', todayJST)
    .neq('exclusive_other_decision_meeting', '完了')
    .gte('contract_year_month', '2025-06-23')
    .limit(5);

  if (error3) {
    console.error('❌ エラー:', error3);
  } else if (todaySellers && todaySellers.length > 0) {
    console.log(`✅ テストデータ: ${todaySellers.length}件の一般媒介売主（次電日=今日）を発見`);
    todaySellers.forEach(s => {
      console.log(`   - ${s.seller_number}: 次電日=${s.next_call_date}`);
    });

    const result = await sellerService.listSellers({
      statusCategory: 'general',
      page: 1,
      limit: 1000,
    });

    const foundInResult = todaySellers.filter(s =>
      result.sellers.some(r => r.sellerNumber === s.seller_number)
    );

    console.log(`\n🔍 フィルタリング結果: ${result.sellers.length}件`);
    console.log(`🔍 今日の次電日の売主がフィルタリング結果に含まれているか: ${foundInResult.length}/${todaySellers.length}件`);

    if (foundInResult.length === 0) {
      console.log('✅ 正常: 今日の次電日の売主がフィルタリング結果に含まれていない（除外されるべき）\n');
    } else {
      console.log('❌ 異常: 今日の次電日の売主がフィルタリング結果に含まれている\n');
    }
  } else {
    console.log('⚠️  テストデータなし: 次電日が今日の一般媒介売主が存在しない\n');
  }

  console.log('🎯 バグ条件探索テスト完了\n');
  console.log('📊 結論:');
  console.log('   - 次電日が昨日（今日より前）の売主がフィルタリング結果に含まれない場合、バグが存在する');
  console.log('   - 原因: .gt("next_call_date", todayJST) は「次電日 > 今日」を意味し、昨日を除外する');
  console.log('   - 修正: .neq("next_call_date", todayJST) に変更して「次電日 ≠ 今日」にする必要がある');
}

runBugConditionTest().catch(console.error);
