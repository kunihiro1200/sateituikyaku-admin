/**
 * Bug Condition Exploration Test
 * 
 * このテストは未修正コードでバグを再現し、根本原因を確認します。
 * 
 * 期待される結果: テストが失敗する（バグが存在することを証明）
 * 
 * Bug Condition:
 * - 訪問日が `2026/04/04 1899/12/30` という異常な形式でデータベースに保存される
 * - 訪問時間が `1899/12/30` という日付形式でデータベースに保存される
 * - isVisitDayBefore() が異常な形式の訪問日を正しく判定できない
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testBugCondition() {
  console.log('🔍 Bug Condition Exploration Test');
  console.log('=====================================\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const syncService = new EnhancedAutoSyncService(SUPABASE_URL, SUPABASE_KEY);

  // テストデータ: 異常な形式の訪問日・訪問時間
  const testRow = {
    '売主番号': 'AA99999', // テスト用売主番号
    '名前(漢字のみ）': 'テスト売主',
    '訪問日 Y/M/D': '2026/04/04 1899/12/30', // 異常な形式（スペース区切りの2つの日付）
    '訪問時間': '1899/12/30', // 異常な形式（日付形式）
    '営担': 'Y',
    '状況（当社）': '追客中',
  };

  try {
    console.log('📝 Test Case 1: 訪問日スペース区切りテスト');
    console.log('Input: 訪問日 =', testRow['訪問日 Y/M/D']);
    
    // syncSingleSeller を呼び出して、データベースに保存
    await syncService.syncSingleSeller(testRow['売主番号'], testRow);
    
    // データベースから取得
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('visit_date, visit_time')
      .eq('seller_number', 'AA99999')
      .single();

    if (error) {
      console.error('❌ Error fetching seller:', error.message);
      return;
    }

    console.log('Database visit_date:', seller?.visit_date);
    console.log('Database visit_time:', seller?.visit_time);

    // Bug Condition: 訪問日が `2026-04-04 1899-12-30` として保存される（未修正コード）
    // Expected Behavior: 訪問日が `2026-04-04` として保存される（修正後）
    if (seller?.visit_date === '2026-04-04 1899-12-30') {
      console.log('✅ Bug Condition CONFIRMED: visit_date contains space-separated dates');
      console.log('   Expected: 2026-04-04');
      console.log('   Actual: 2026-04-04 1899-12-30');
    } else if (seller?.visit_date === '2026-04-04') {
      console.log('❌ Bug Condition NOT FOUND: visit_date is already correct');
      console.log('   This means the bug has been fixed or does not exist');
    } else {
      console.log('⚠️  Unexpected visit_date format:', seller?.visit_date);
    }

    console.log('\n📝 Test Case 2: 訪問時間日付形式テスト');
    console.log('Input: 訪問時間 =', testRow['訪問時間']);

    // Bug Condition: 訪問時間が `1899-12-30` または `1899/12/30` として保存される（未修正コード）
    // Expected Behavior: 訪問時間が `null` として保存される（修正後、時刻情報が失われているため）
    const visitTimeStr = seller?.visit_time ? String(seller.visit_time) : null;
    const isDateFormat = visitTimeStr && (visitTimeStr.match(/\d{4}-\d{2}-\d{2}/) || visitTimeStr.match(/\d{4}\/\d{2}\/\d{2}/));
    
    if (isDateFormat) {
      console.log('✅ Bug Condition CONFIRMED: visit_time is stored as date format');
      console.log('   Expected: null (or HH:MM format)');
      console.log('   Actual:', visitTimeStr);
    } else if (seller?.visit_time === null) {
      console.log('❌ Bug Condition NOT FOUND: visit_time is already null');
      console.log('   This means the bug has been fixed or does not exist');
    } else {
      console.log('⚠️  Unexpected visit_time format:', seller?.visit_time);
    }

    // クリーンアップ
    await supabase
      .from('sellers')
      .delete()
      .eq('seller_number', 'AA99999');

    console.log('\n🎯 Test Summary:');
    console.log('=====================================');
    console.log('If both bug conditions are CONFIRMED, the bug exists in the unfixed code.');
    console.log('If both bug conditions are NOT FOUND, the bug has been fixed.');
    console.log('This test should FAIL on unfixed code (bug exists).');
    console.log('This test should PASS on fixed code (bug is fixed).');

  } catch (error: any) {
    console.error('❌ Test failed with error:', error.message);
  }
}

testBugCondition();
