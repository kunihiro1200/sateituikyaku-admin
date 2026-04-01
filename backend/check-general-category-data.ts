/**
 * 一般カテゴリのデータを確認するスクリプト
 */

// 環境変数を最初に読み込む
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 今日の日付（JST）を取得
function getTodayJST(): string {
  const now = new Date();
  const jstOffset = 9 * 60;
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  return jstTime.toISOString().split('T')[0];
}

async function checkGeneralCategoryData() {
  console.log('🔍 一般カテゴリのデータを確認...\n');

  const todayJST = getTodayJST();
  console.log(`📅 今日: ${todayJST}\n`);

  // まず一般媒介の売主が存在するか確認
  const { data: allGeneralSellers, error: error1 } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month')
    .eq('status', '一般媒介')
    .limit(10);

  if (error1) {
    console.error('❌ エラー:', error1);
    return;
  }

  console.log(`📊 一般媒介の売主（全体）: ${allGeneralSellers?.length || 0}件\n`);

  if (allGeneralSellers && allGeneralSellers.length > 0) {
    console.log(`📋 一般媒介の売主（最初の10件）:`);
    allGeneralSellers.forEach(s => {
      console.log(`   - ${s.seller_number}: 次電日=${s.next_call_date}, 専任他決打合せ=${s.exclusive_other_decision_meeting}, 契約年月=${s.contract_year_month}`);
    });
    console.log();
  }

  // 一般媒介の売主を取得（条件付き）
  const { data: generalSellers, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month')
    .eq('status', '一般媒介')
    .neq('exclusive_other_decision_meeting', '完了')
    .gte('contract_year_month', '2025-06-23')
    .not('next_call_date', 'is', null)
    .order('next_call_date', { ascending: true })
    .limit(50);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!generalSellers || generalSellers.length === 0) {
    console.log('⚠️  条件に一致する一般媒介の売主が存在しません');
    console.log('   条件: 専任他決打合せ <> "完了" AND 契約年月 >= 2025-06-23 AND 次電日 IS NOT NULL\n');
    return;
  }

  console.log(`✅ 条件に一致する一般媒介の売主: ${generalSellers.length}件\n`);

  // 次電日で分類
  const beforeToday = generalSellers.filter(s => s.next_call_date < todayJST);
  const today = generalSellers.filter(s => s.next_call_date === todayJST);
  const afterToday = generalSellers.filter(s => s.next_call_date > todayJST);

  console.log(`📊 次電日の分布:`);
  console.log(`   - 今日より前: ${beforeToday.length}件`);
  console.log(`   - 今日: ${today.length}件`);
  console.log(`   - 今日より後: ${afterToday.length}件\n`);

  if (beforeToday.length > 0) {
    console.log(`📋 今日より前の次電日（最初の5件）:`);
    beforeToday.slice(0, 5).forEach(s => {
      console.log(`   - ${s.seller_number}: 次電日=${s.next_call_date}`);
    });
    console.log();
  }

  if (today.length > 0) {
    console.log(`📋 今日の次電日（最初の5件）:`);
    today.slice(0, 5).forEach(s => {
      console.log(`   - ${s.seller_number}: 次電日=${s.next_call_date}`);
    });
    console.log();
  }

  if (afterToday.length > 0) {
    console.log(`📋 今日より後の次電日（最初の5件）:`);
    afterToday.slice(0, 5).forEach(s => {
      console.log(`   - ${s.seller_number}: 次電日=${s.next_call_date}`);
    });
    console.log();
  }

  // GASのカウント計算ロジックをシミュレート
  const gasCount = generalSellers.filter(s => s.next_call_date !== todayJST).length;
  console.log(`📊 GASのカウント計算（次電日 ≠ 今日）: ${gasCount}件`);
  console.log(`   = 今日より前（${beforeToday.length}件）+ 今日より後（${afterToday.length}件）\n`);

  // バックエンドの.gt条件をシミュレート
  const backendCount = generalSellers.filter(s => s.next_call_date > todayJST).length;
  console.log(`📊 バックエンドの.gt条件（次電日 > 今日）: ${backendCount}件`);
  console.log(`   = 今日より後（${afterToday.length}件）のみ\n`);

  // 不一致を確認
  const mismatch = gasCount - backendCount;
  if (mismatch > 0) {
    console.log(`❌ 不一致: ${mismatch}件の差異`);
    console.log(`   原因: 今日より前の${beforeToday.length}件がバックエンドのフィルタリングから除外されている\n`);
  } else {
    console.log(`✅ 一致: GASカウントとバックエンドフィルタリングが一致\n`);
  }
}

checkGeneralCategoryData().catch(console.error);
