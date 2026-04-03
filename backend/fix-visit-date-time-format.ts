/**
 * 訪問日・訪問時間形式修正スクリプト
 * 
 * 既存の異常データを修正します：
 * 1. visit_dateにスペースが含まれる売主を検索し、最初の日付のみを抽出して更新
 * 2. visit_timeが日付形式（YYYY/MM/DD）の売主を検索し、nullに更新
 * 
 * 実行方法:
 * npx ts-node backend/fix-visit-date-time-format.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * visit_dateにスペースが含まれる売主を修正
 */
async function fixVisitDateWithSpace(): Promise<void> {
  console.log('\n🔍 Searching for sellers with malformed visit_date (contains space)...');
  
  // visit_dateにスペースが含まれる売主を検索
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('id, seller_number, visit_date')
    .like('visit_date', '% %');
  
  if (error) {
    console.error('❌ Failed to fetch sellers:', error.message);
    return;
  }
  
  if (!sellers || sellers.length === 0) {
    console.log('✅ No sellers with malformed visit_date found');
    return;
  }
  
  console.log(`📊 Found ${sellers.length} sellers with malformed visit_date`);
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const seller of sellers) {
    const originalVisitDate = seller.visit_date;
    
    // スペースで分割して最初の日付のみを抽出
    const parts = originalVisitDate.split(' ');
    const fixedVisitDate = parts[0];
    
    console.log(`🔧 Fixing ${seller.seller_number}: "${originalVisitDate}" → "${fixedVisitDate}"`);
    
    // データベースを更新
    const { error: updateError } = await supabase
      .from('sellers')
      .update({ visit_date: fixedVisitDate })
      .eq('id', seller.id);
    
    if (updateError) {
      console.error(`❌ Failed to update ${seller.seller_number}:`, updateError.message);
      errorCount++;
    } else {
      console.log(`✅ ${seller.seller_number}: Updated`);
      fixedCount++;
    }
  }
  
  console.log(`\n📊 visit_date fix summary:`);
  console.log(`   ✅ Fixed: ${fixedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

/**
 * visit_timeが日付形式（YYYY/MM/DD または YYYY-MM-DD）の売主を修正
 */
async function fixVisitTimeWithDateFormat(): Promise<void> {
  console.log('\n🔍 Searching for sellers with malformed visit_time (date format)...');
  
  // visit_timeが日付形式の売主を検索（YYYY/MM/DD または YYYY-MM-DD）
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('id, seller_number, visit_time')
    .not('visit_time', 'is', null)
    .or('visit_time.like.%/%/%,visit_time.like.%-%--%');
  
  if (error) {
    console.error('❌ Failed to fetch sellers:', error.message);
    return;
  }
  
  if (!sellers || sellers.length === 0) {
    console.log('✅ No sellers with malformed visit_time found');
    return;
  }
  
  // 日付形式のパターンでフィルタリング（クライアント側）
  const malformedSellers = sellers.filter(s => {
    if (!s.visit_time) return false;
    const visitTime = String(s.visit_time);
    // YYYY/MM/DD または YYYY-MM-DD 形式をチェック
    return /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(visitTime);
  });
  
  if (malformedSellers.length === 0) {
    console.log('✅ No sellers with malformed visit_time found');
    return;
  }
  
  console.log(`📊 Found ${malformedSellers.length} sellers with malformed visit_time`);
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const seller of malformedSellers) {
    const originalVisitTime = seller.visit_time;
    
    console.log(`🔧 Fixing ${seller.seller_number}: "${originalVisitTime}" → null (time information lost)`);
    
    // visit_timeをnullに更新（時刻情報が失われているため）
    const { error: updateError } = await supabase
      .from('sellers')
      .update({ visit_time: null })
      .eq('id', seller.id);
    
    if (updateError) {
      console.error(`❌ Failed to update ${seller.seller_number}:`, updateError.message);
      errorCount++;
    } else {
      console.log(`✅ ${seller.seller_number}: Updated`);
      fixedCount++;
    }
  }
  
  console.log(`\n📊 visit_time fix summary:`);
  console.log(`   ✅ Fixed: ${fixedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  console.log('🚀 Starting visit_date and visit_time format fix...');
  
  // visit_dateの修正
  await fixVisitDateWithSpace();
  
  // visit_timeの修正
  await fixVisitTimeWithDateFormat();
  
  console.log('\n🎉 Fix completed!');
}

// スクリプト実行
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
