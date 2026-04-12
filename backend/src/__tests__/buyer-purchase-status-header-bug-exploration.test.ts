/**
 * バグ条件探索テスト: 買付削除後のlatest_statusクリア漏れ
 *
 * Property 1: Bug Condition - 買付削除後のlatest_statusクリア漏れ
 *
 * 目的: 修正前のコードでバグを再現し、カウンターエグザンプルを記録する
 *
 * 期待される結果（修正前）: テストがFAILする（バグの存在を証明）
 * 期待される結果（修正後）: テストがPASSする（バグが修正されたことを確認）
 *
 * Validates: Requirements 1.1, 1.2
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 環境変数を読み込み
const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../.env.local'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * isBugCondition: バグ条件を判定する関数
 * - action == "delete_buyer"
 * - buyerLatestStatus に「買」が含まれる
 */
function isBugCondition(action: string, buyerLatestStatus: string): boolean {
  return action === 'delete_buyer' && buyerLatestStatus.includes('買');
}

// テスト用の一意な買主番号を生成（9000000台を使用して既存データと衝突しないようにする）
function generateTestBuyerNumber(): number {
  return 9000000 + Math.floor(Math.random() * 999999);
}

// テスト用の一意な buyer_id を生成
function generateTestBuyerId(): string {
  return `test-bug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('Bug Condition Exploration Tests - 買付削除後のlatest_statusクリア漏れ', () => {
  // テスト用の一時的な買主番号（クリーンアップ用）
  const testBuyerNumbers: number[] = [];
  let testPropertyNumber: string | null = null;

  beforeAll(async () => {
    // テスト用の物件番号を取得（実在する物件を使用）
    const { data: propertyData } = await supabase
      .from('property_listings')
      .select('property_number')
      .limit(1)
      .single();

    testPropertyNumber = propertyData?.property_number || 'TEST-PROP-001';
    console.log(`\n[Setup] テスト用物件番号: ${testPropertyNumber}`);
  });

  afterAll(async () => {
    // テスト後のクリーンアップ: テスト用買主を完全削除
    if (testBuyerNumbers.length > 0) {
      const { error } = await supabase
        .from('buyers')
        .delete()
        .in('buyer_number', testBuyerNumbers);
      if (error) {
        console.error('[Cleanup] テスト用買主の削除エラー:', error);
      } else {
        console.log(`[Cleanup] テスト用買主を削除: ${testBuyerNumbers.join(', ')}`);
      }
    }
  });

  /**
   * テスト1: BuyerService.softDelete後、DBのlatest_statusが空文字列になることを確認
   *
   * バグ条件: isBugCondition("delete_buyer", "買（専任　両手）") === true
   *
   * 修正前: このテストはFAILする（latest_statusが「買（専任　両手）」のまま残る）
   * 修正後: このテストはPASSする（latest_statusが空文字列になる）
   */
  test('Bug Condition 1.1: softDelete後、DBのlatest_statusが「買」を含まないこと（修正前はFAIL）', async () => {
    const latestStatus = '買（専任　両手）';
    const testBuyerNumber = generateTestBuyerNumber();
    const testBuyerId = generateTestBuyerId();
    testBuyerNumbers.push(testBuyerNumber);

    // バグ条件を確認
    expect(isBugCondition('delete_buyer', latestStatus)).toBe(true);
    console.log(`\n[Test 1.1] バグ条件確認: isBugCondition("delete_buyer", "${latestStatus}") = true`);

    // ステップ1: テスト用買主を作成（latest_statusに「買」を含む）
    // buyer_idを明示的に設定する
    console.log('\n[Step 1] テスト用買主を作成中...');
    const { error: createError } = await supabase
      .from('buyers')
      .insert({
        buyer_id: testBuyerId,
        buyer_number: testBuyerNumber,
        name: 'テスト買主（バグ探索用）',
        latest_status: latestStatus,
        property_number: testPropertyNumber,
        reception_date: new Date().toISOString().split('T')[0],
      });

    expect(createError).toBeNull();

    // 作成した買主を確認
    const { data: createdBuyer } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, latest_status, deleted_at')
      .eq('buyer_id', testBuyerId)
      .single();

    expect(createdBuyer).not.toBeNull();
    console.log(`[Step 1] 買主作成成功: buyer_id="${testBuyerId}", latest_status="${createdBuyer!.latest_status}"`);
    expect(createdBuyer!.latest_status).toBe(latestStatus);

    // ステップ2: BuyerService.softDelete() を呼び出す（修正後の実装）
    // buyer_idを渡す（getByIdがbuyer_idで検索するため）
    console.log('\n[Step 2] BuyerService.softDelete実行中...');
    const { BuyerService } = require('../services/BuyerService');
    const buyerServiceInstance = new BuyerService();
    await buyerServiceInstance.softDelete(testBuyerId);
    console.log('[Step 2] BuyerService.softDelete完了');

    // ステップ3: softDelete後のDBのlatest_statusを確認
    console.log('\n[Step 3] softDelete後のDBのlatest_statusを確認中...');
    const { data: afterDelete, error: fetchError } = await supabase
      .from('buyers')
      .select('buyer_id, latest_status, deleted_at')
      .eq('buyer_id', testBuyerId)
      .single();

    expect(fetchError).toBeNull();
    expect(afterDelete).not.toBeNull();

    console.log(`[Step 3] softDelete後のlatest_status: "${afterDelete!.latest_status}"`);
    console.log(`[Step 3] softDelete後のdeleted_at: "${afterDelete!.deleted_at}"`);

    // deleted_atが設定されていることを確認
    expect(afterDelete!.deleted_at).not.toBeNull();

    // 【バグ条件アサート】
    // 修正前: latest_statusが「買（専任　両手）」のまま残っている → このアサートがFAIL
    // 修正後: latest_statusが空文字列になる → このアサートがPASS
    //
    // カウンターエグザンプル（修正前）:
    //   afterDelete.latest_status = "買（専任　両手）"（「買」が残ったまま）
    //   期待値: ""（空文字列）
    console.log('\n[Counterexample]');
    console.log(`  Input: { action: "delete_buyer", buyerLatestStatus: "${latestStatus}" }`);
    console.log(`  Expected: latest_status = "" (空文字列)`);
    console.log(`  Actual:   latest_status = "${afterDelete!.latest_status}"`);
    console.log(`  Bug exists: ${afterDelete!.latest_status === latestStatus ? 'YES（バグあり）' : 'NO（修正済み）'}`);

    expect(afterDelete!.latest_status).toBe('');
  }, 30000);

  /**
   * テスト2: softDelete後、DBのlatest_statusに「買」が残ることを確認（別のステータス値）
   *
   * 修正前: このテストはFAILする（latest_statusが「買（一般　両手）」のまま残る）
   * 修正後: このテストはPASSする（latest_statusが空文字列になる）
   */
  test('Bug Condition 1.2: softDelete後、DBのlatest_statusが「買（一般　両手）」を含まないこと（修正前はFAIL）', async () => {
    const latestStatus = '買（一般　両手）';
    const testBuyerNumber = generateTestBuyerNumber();
    const testBuyerId = generateTestBuyerId();
    testBuyerNumbers.push(testBuyerNumber);

    // バグ条件を確認
    expect(isBugCondition('delete_buyer', latestStatus)).toBe(true);
    console.log(`\n[Test 1.2] バグ条件確認: isBugCondition("delete_buyer", "${latestStatus}") = true`);

    // ステップ1: テスト用買主を作成
    console.log('\n[Step 1] テスト用買主を作成中...');
    const { error: createError } = await supabase
      .from('buyers')
      .insert({
        buyer_id: testBuyerId,
        buyer_number: testBuyerNumber,
        name: 'テスト買主2（バグ探索用）',
        latest_status: latestStatus,
        property_number: testPropertyNumber,
        reception_date: new Date().toISOString().split('T')[0],
      });

    expect(createError).toBeNull();

    // 作成した買主を確認
    const { data: createdBuyer } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, latest_status, deleted_at')
      .eq('buyer_id', testBuyerId)
      .single();

    expect(createdBuyer).not.toBeNull();
    console.log(`[Step 1] 買主作成成功: buyer_id="${testBuyerId}", latest_status="${createdBuyer!.latest_status}"`);

    // ステップ2: softDelete前の状態を確認
    expect(createdBuyer!.latest_status).toBe(latestStatus);
    expect(createdBuyer!.deleted_at).toBeNull();
    console.log(`\n[Step 2] softDelete前のlatest_status: "${createdBuyer!.latest_status}"`);

    // ステップ3: BuyerService.softDelete() を呼び出す（修正後の実装）
    console.log('\n[Step 3] BuyerService.softDelete実行中...');
    const { BuyerService } = require('../services/BuyerService');
    const buyerServiceInstance2 = new BuyerService();
    await buyerServiceInstance2.softDelete(testBuyerId);
    console.log('[Step 3] BuyerService.softDelete完了');

    // ステップ4: softDelete後のDBのlatest_statusを直接確認
    console.log('\n[Step 4] softDelete後のDBのlatest_statusを直接確認中...');
    const { data: afterDelete } = await supabase
      .from('buyers')
      .select('buyer_id, latest_status, deleted_at')
      .eq('buyer_id', testBuyerId)
      .single();

    expect(afterDelete).not.toBeNull();
    console.log(`[Step 4] softDelete後のlatest_status: "${afterDelete!.latest_status}"`);
    console.log(`[Step 4] softDelete後のdeleted_at: "${afterDelete!.deleted_at}"`);

    // deleted_atが設定されていることを確認
    expect(afterDelete!.deleted_at).not.toBeNull();

    // 【バグ条件アサート】
    // 修正前: latest_statusが「買（一般　両手）」のまま残っている → このアサートがFAIL
    // 修正後: latest_statusが空文字列になる → このアサートがPASS
    //
    // カウンターエグザンプル（修正前）:
    //   afterDelete.latest_status = "買（一般　両手）"（「買」が残ったまま）
    //   期待値: ""（空文字列）
    const hasBuyerStatus = afterDelete!.latest_status?.includes('買') ?? false;
    console.log(`\n[Result] latest_statusに「買」が含まれているか: ${hasBuyerStatus}`);
    console.log(`[Result] 期待値: false（「買」が含まれていないこと）`);
    console.log('\n[Counterexample]');
    console.log(`  Input: { action: "delete_buyer", buyerLatestStatus: "${latestStatus}" }`);
    console.log(`  Expected: latest_status = "" (空文字列)`);
    console.log(`  Actual:   latest_status = "${afterDelete!.latest_status}"`);
    console.log(`  Bug exists: ${afterDelete!.latest_status === latestStatus ? 'YES（バグあり）' : 'NO（修正済み）'}`);

    expect(afterDelete!.latest_status).toBe('');
  }, 30000);

  /**
   * テスト3: BuyerService.softDeleteがlatest_statusをクリアすることを確認
   *
   * 修正前: このテストはFAILする（BuyerService.softDeleteがlatest_statusをクリアしない）
   * 修正後: このテストはPASSする（BuyerService.softDeleteがlatest_statusをクリアする）
   */
  test('Bug Condition 1.3: BuyerService.softDelete後、DBのlatest_statusが空文字列になること（修正前はFAIL）', async () => {
    const latestStatus = '買（専任　両手）';
    const testBuyerNumber = generateTestBuyerNumber();
    const testBuyerId = generateTestBuyerId();
    testBuyerNumbers.push(testBuyerNumber);

    console.log(`\n[Test 1.3] BuyerService.softDeleteを直接呼び出してバグを確認`);
    console.log(`[Test 1.3] バグ条件: latest_status="${latestStatus}"（「買」を含む）`);

    // ステップ1: テスト用買主を作成
    console.log('\n[Step 1] テスト用買主を作成中...');
    const { error: createError } = await supabase
      .from('buyers')
      .insert({
        buyer_id: testBuyerId,
        buyer_number: testBuyerNumber,
        name: 'テスト買主3（BuyerService直接テスト用）',
        latest_status: latestStatus,
        property_number: testPropertyNumber,
        reception_date: new Date().toISOString().split('T')[0],
      });

    expect(createError).toBeNull();

    // 作成した買主を確認
    const { data: createdBuyer } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, latest_status, deleted_at')
      .eq('buyer_id', testBuyerId)
      .single();

    expect(createdBuyer).not.toBeNull();
    console.log(`[Step 1] 買主作成成功: buyer_id="${testBuyerId}"`);

    // ステップ2: BuyerService.softDelete() を直接呼び出す（修正後の実装）
    console.log('\n[Step 2] BuyerService.softDelete（修正後の実装）を実行中...');
    const { BuyerService } = require('../services/BuyerService');
    const buyerServiceInstance3 = new BuyerService();
    await buyerServiceInstance3.softDelete(testBuyerId);
    console.log('[Step 2] BuyerService.softDelete完了（deleted_at + latest_status="" を設定）');

    // ステップ3: softDelete後のDBの状態を確認
    console.log('\n[Step 3] softDelete後のDBの状態を確認中...');
    const { data: afterSoftDelete } = await supabase
      .from('buyers')
      .select('buyer_id, latest_status, deleted_at')
      .eq('buyer_id', testBuyerId)
      .single();

    expect(afterSoftDelete).not.toBeNull();
    console.log(`[Step 3] softDelete後のlatest_status: "${afterSoftDelete!.latest_status}"`);
    console.log(`[Step 3] softDelete後のdeleted_at: "${afterSoftDelete!.deleted_at}"`);

    // deleted_atが設定されていることを確認
    expect(afterSoftDelete!.deleted_at).not.toBeNull();

    // 【バグ条件の核心アサート】
    // 修正前（現在）: latest_statusが「買（専任　両手）」のまま → FAIL
    // 修正後: latest_statusが空文字列 → PASS
    //
    // カウンターエグザンプル（修正前）:
    //   Input: { action: "delete_buyer", buyerLatestStatus: "買（専任　両手）" }
    //   Expected: afterSoftDelete.latest_status = ""
    //   Actual:   afterSoftDelete.latest_status = "買（専任　両手）"
    //
    // これがバグの存在を証明するカウンターエグザンプルである
    console.log('\n[Counterexample]');
    console.log(`  Input: { action: "delete_buyer", buyerLatestStatus: "${latestStatus}" }`);
    console.log(`  Expected: latest_status = "" (空文字列)`);
    console.log(`  Actual:   latest_status = "${afterSoftDelete!.latest_status}"`);
    console.log(`  Bug exists: ${afterSoftDelete!.latest_status === latestStatus ? 'YES（バグあり）' : 'NO（修正済み）'}`);

    expect(afterSoftDelete!.latest_status).toBe('');
  }, 30000);
});
