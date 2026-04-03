/**
 * Preservation Property Tests
 * 
 * このテストは未修正コードで正常な形式のデータが正しく処理されることを確認します。
 * 
 * 期待される結果: テストが成功する（正常なデータは正しく処理される）
 * 
 * Preservation Requirements:
 * - 正常な形式の訪問日（YYYY/MM/DD）は正しく保存される
 * - 正常な形式の訪問時間（HH:MM）は正しく保存される
 * - 他のフィールド（name, phone_number, valuation_amount等）は正しく保存される
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testPreservation() {
  console.log('🔍 Preservation Property Tests');
  console.log('=====================================\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const syncService = new EnhancedAutoSyncService(SUPABASE_URL, SUPABASE_KEY);

  // テストデータ: 正常な形式の訪問日・訪問時間
  const testRow = {
    '売主番号': 'AA99998', // テスト用売主番号
    '名前(漢字のみ）': 'テスト売主2',
    '訪問日 Y/M/D': '2026/04/04', // 正常な形式（正しいカラム名）
    '訪問時間': '10:00', // 正常な形式
    '営担': 'Y',
    '状況（当社）': '追客中',
    '査定額1（自動計算）v': '1200',
    '査定額2（自動計算）v': '1300',
    '査定額3（自動計算）v': '1500',
  };

  try {
    console.log('📝 Test Case 1: 正常な訪問日の保存');
    console.log('Input: 訪問日 =', testRow['訪問日 Y/M/D']);
    
    // syncSingleSeller を呼び出して、データベースに保存
    await syncService.syncSingleSeller(testRow['売主番号'], testRow);
    
    // データベースから取得
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('visit_date, visit_time, valuation_amount_1, valuation_amount_2, valuation_amount_3')
      .eq('seller_number', 'AA99998')
      .single();

    if (error) {
      console.error('❌ Error fetching seller:', error.message);
      return;
    }

    console.log('Database visit_date:', seller?.visit_date);
    
    // Preservation: 正常な形式の訪問日は `2026-04-04` として保存される
    if (seller?.visit_date === '2026-04-04') {
      console.log('✅ PASS: visit_date is correctly saved as 2026-04-04');
    } else {
      console.log('❌ FAIL: visit_date is not correctly saved');
      console.log('   Expected: 2026-04-04');
      console.log('   Actual:', seller?.visit_date);
    }

    console.log('\n📝 Test Case 2: 正常な訪問時間の保存');
    console.log('Input: 訪問時間 =', testRow['訪問時間']);
    console.log('Database visit_time:', seller?.visit_time);

    // Preservation: 正常な形式の訪問時間は `10:00` として保存される
    if (seller?.visit_time === '10:00') {
      console.log('✅ PASS: visit_time is correctly saved as 10:00');
    } else {
      console.log('❌ FAIL: visit_time is not correctly saved');
      console.log('   Expected: 10:00');
      console.log('   Actual:', seller?.visit_time);
    }

    console.log('\n📝 Test Case 3: 他のフィールドの保存');
    console.log('Database valuation_amount_1:', seller?.valuation_amount_1);
    console.log('Database valuation_amount_2:', seller?.valuation_amount_2);
    console.log('Database valuation_amount_3:', seller?.valuation_amount_3);

    // Preservation: 査定額は正しく保存される（万円→円に変換）
    const expectedVal1 = 1200 * 10000; // 12,000,000円
    const expectedVal2 = 1300 * 10000; // 13,000,000円
    const expectedVal3 = 1500 * 10000; // 15,000,000円

    let allFieldsCorrect = true;

    if (seller?.valuation_amount_1 === expectedVal1) {
      console.log('✅ PASS: valuation_amount_1 is correctly saved');
    } else {
      console.log('❌ FAIL: valuation_amount_1 is not correctly saved');
      console.log('   Expected:', expectedVal1);
      console.log('   Actual:', seller?.valuation_amount_1);
      allFieldsCorrect = false;
    }

    if (seller?.valuation_amount_2 === expectedVal2) {
      console.log('✅ PASS: valuation_amount_2 is correctly saved');
    } else {
      console.log('❌ FAIL: valuation_amount_2 is not correctly saved');
      console.log('   Expected:', expectedVal2);
      console.log('   Actual:', seller?.valuation_amount_2);
      allFieldsCorrect = false;
    }

    if (seller?.valuation_amount_3 === expectedVal3) {
      console.log('✅ PASS: valuation_amount_3 is correctly saved');
    } else {
      console.log('❌ FAIL: valuation_amount_3 is not correctly saved');
      console.log('   Expected:', expectedVal3);
      console.log('   Actual:', seller?.valuation_amount_3);
      allFieldsCorrect = false;
    }

    // クリーンアップ
    await supabase
      .from('sellers')
      .delete()
      .eq('seller_number', 'AA99998');

    console.log('\n🎯 Test Summary:');
    console.log('=====================================');
    if (seller?.visit_date === '2026-04-04' && seller?.visit_time === '10:00' && allFieldsCorrect) {
      console.log('✅ ALL TESTS PASSED: Preservation requirements are satisfied');
      console.log('   Normal format data is correctly processed');
    } else {
      console.log('❌ SOME TESTS FAILED: Preservation requirements are not satisfied');
    }

  } catch (error: any) {
    console.error('❌ Test failed with error:', error.message);
  }
}

testPreservation();
