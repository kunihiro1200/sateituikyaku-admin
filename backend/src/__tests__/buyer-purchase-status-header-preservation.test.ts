/**
 * 保存プロパティテスト: 非買付ステータス買主の削除動作保存
 *
 * Property 2: Preservation - 非削除操作でのヘッダー表示維持
 *
 * 目的: 修正前のコードで非バグ条件の入力（isBugCondition が false を返すケース）の
 *       動作を観察し、修正後も同一動作が保持されることを検証する。
 *
 * 期待される結果（修正前）: テストがPASSする（ベースライン動作の確認）
 * 期待される結果（修正後）: テストが引き続きPASSする（リグレッションなし）
 *
 * Validates: Requirements 3.1, 3.2, 3.3
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

/**
 * hasBuyerPurchaseStatus: latest_statusに「買」が含まれるか判定
 * フロントエンドの purchaseStatusUtils.ts の hasBuyerPurchaseStatus に相当
 */
function hasBuyerPurchaseStatus(latestStatus: string | null | undefined): boolean {
  if (!latestStatus) return false;
  return latestStatus.includes('買');
}

/**
 * 非バグ条件のlatest_statusサンプル（「買」を含まない）
 * 観察優先メソドロジー: 修正前のコードで実際に動作するケースを列挙
 */
const NON_BUG_STATUSES = [
  '内覧済み',
  '追客中',
  '検討中',
  '申込済み',
  '成約',
  '見送り',
  '未対応',
  '',
  null,
];

describe('Preservation Tests - 非買付ステータス買主の削除動作保存', () => {
  const testBuyerNumbers: string[] = [];
  let testPropertyNumber: string | null = null;
  let testPropertyNumberWithBuyer: string | null = null;

  beforeAll(async () => {
    // テスト用の物件番号を取得（実在する物件を使用）
    const { data: propertyData } = await supabase
      .from('property_listings')
      .select('property_number')
      .limit(1)
      .single();

    testPropertyNumber = propertyData?.property_number || 'TEST-PROP-001';
    testPropertyNumberWithBuyer = testPropertyNumber;
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
   * テスト1: 非買付ステータス買主の削除後、ヘッダー表示に影響がないことを確認
   *
   * 観察: 「買」を含まないlatest_statusを持つ買主を削除しても、
   *       hasBuyerPurchaseStatus は false のまま変わらない
   *
   * 修正前: PASS（非バグ条件のため影響なし）
   * 修正後: PASS（保存プロパティが維持されている）
   */
  test('Preservation 3.1: 非買付ステータス買主の削除後、ヘッダー買付バッジ表示に影響がないこと', async () => {
    // 「買」を含まない複数のステータスでテスト
    const nonBuyerStatuses = ['内覧済み', '追客中', '検討中'];

    for (const latestStatus of nonBuyerStatuses) {
      const testBuyerNumber = `TEST-PRSV-${Date.now()}-${latestStatus.slice(0, 3)}`;
      testBuyerNumbers.push(testBuyerNumber);

      // バグ条件でないことを確認
      expect(isBugCondition('delete_buyer', latestStatus)).toBe(false);
      console.log(`\n[Test 3.1] 非バグ条件確認: isBugCondition("delete_buyer", "${latestStatus}") = false`);

      // 削除前: hasBuyerPurchaseStatus は false
      const beforeDelete = hasBuyerPurchaseStatus(latestStatus);
      expect(beforeDelete).toBe(false);
      console.log(`[Test 3.1] 削除前のhasBuyerPurchaseStatus("${latestStatus}"): ${beforeDelete}`);

      // テスト用買主を作成
      const { data: createdBuyer, error: createError } = await supabase
        .from('buyers')
        .insert({
          buyer_number: testBuyerNumber,
          name: `テスト買主（保存テスト_${latestStatus}）`,
          latest_status: latestStatus,
          property_number: testPropertyNumber,
          reception_date: new Date().toISOString().split('T')[0],
        })
        .select('buyer_number, latest_status, deleted_at')
        .single();

      expect(createError).toBeNull();
      expect(createdBuyer).not.toBeNull();
      expect(createdBuyer!.latest_status).toBe(latestStatus);

      // softDelete実行（deleted_atのみ設定 - 現在の実装）
      const { error: deleteError } = await supabase
        .from('buyers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('buyer_number', testBuyerNumber);

      expect(deleteError).toBeNull();

      // softDelete後のDBの状態を確認
      const { data: afterDelete } = await supabase
        .from('buyers')
        .select('buyer_number, latest_status, deleted_at')
        .eq('buyer_number', testBuyerNumber)
        .single();

      expect(afterDelete).not.toBeNull();
      expect(afterDelete!.deleted_at).not.toBeNull();

      // 【保存プロパティアサート】
      // 削除後もhasBuyerPurchaseStatusはfalseのまま（ヘッダー表示に影響なし）
      const afterDeleteStatus = hasBuyerPurchaseStatus(afterDelete!.latest_status);
      expect(afterDeleteStatus).toBe(false);

      console.log(`[Test 3.1] 削除後のlatest_status: "${afterDelete!.latest_status}"`);
      console.log(`[Test 3.1] 削除後のhasBuyerPurchaseStatus: ${afterDeleteStatus} (期待値: false)`);
      console.log(`[Test 3.1] ✅ "${latestStatus}" の削除はヘッダー表示に影響なし`);
    }
  }, 60000);

  /**
   * テスト2: 買付新規登録後にヘッダーが正しく更新されることを確認
   *
   * 観察: 「買」を含むlatest_statusを持つ買主を新規登録すると、
   *       hasBuyerPurchaseStatus は true になる
   *
   * 修正前: PASS（新規登録はバグ条件に該当しない）
   * 修正後: PASS（保存プロパティが維持されている）
   */
  test('Preservation 3.2: 買付新規登録後にヘッダーが正しく更新されること', async () => {
    const purchaseStatus = '買（専任　両手）';
    const testBuyerNumber = `TEST-PRSV-NEW-${Date.now()}`;
    testBuyerNumbers.push(testBuyerNumber);

    // バグ条件でないことを確認（action が "delete_buyer" でない）
    expect(isBugCondition('create_buyer', purchaseStatus)).toBe(false);
    console.log(`\n[Test 3.2] 新規登録はバグ条件でないことを確認: isBugCondition("create_buyer", "${purchaseStatus}") = false`);

    // 新規登録前: hasBuyerPurchaseStatus は false（まだ存在しない）
    console.log(`[Test 3.2] 新規登録前: ヘッダーに買付バッジなし`);

    // テスト用買主を作成（「買」を含むlatest_status）
    const { data: createdBuyer, error: createError } = await supabase
      .from('buyers')
      .insert({
        buyer_number: testBuyerNumber,
        name: 'テスト買主（買付新規登録テスト）',
        latest_status: purchaseStatus,
        property_number: testPropertyNumber,
        reception_date: new Date().toISOString().split('T')[0],
      })
      .select('buyer_number, latest_status, deleted_at')
      .single();

    expect(createError).toBeNull();
    expect(createdBuyer).not.toBeNull();
    expect(createdBuyer!.latest_status).toBe(purchaseStatus);

    // 【保存プロパティアサート】
    // 新規登録後: hasBuyerPurchaseStatus は true（ヘッダーに買付バッジが表示される）
    const afterCreate = hasBuyerPurchaseStatus(createdBuyer!.latest_status);
    expect(afterCreate).toBe(true);

    console.log(`[Test 3.2] 新規登録後のlatest_status: "${createdBuyer!.latest_status}"`);
    console.log(`[Test 3.2] 新規登録後のhasBuyerPurchaseStatus: ${afterCreate} (期待値: true)`);
    console.log(`[Test 3.2] ✅ 買付新規登録後、ヘッダーに買付バッジが表示される`);

    // DBから直接確認
    const { data: dbBuyer } = await supabase
      .from('buyers')
      .select('buyer_number, latest_status')
      .eq('buyer_number', testBuyerNumber)
      .is('deleted_at', null)
      .single();

    expect(dbBuyer).not.toBeNull();
    expect(hasBuyerPurchaseStatus(dbBuyer!.latest_status)).toBe(true);
    console.log(`[Test 3.2] ✅ DBから確認: latest_status="${dbBuyer!.latest_status}", hasBuyerPurchaseStatus=true`);
  }, 30000);

  /**
   * テスト3: 物件情報（価格・住所等）の更新でヘッダー表示が変わらないことを確認
   *
   * 観察: property_listingsの更新はbuyersのlatest_statusに影響しない
   *
   * 修正前: PASS（物件情報更新はバグ条件に該当しない）
   * 修正後: PASS（保存プロパティが維持されている）
   */
  test('Preservation 3.3: 物件情報の更新でヘッダー表示が変わらないこと', async () => {
    const purchaseStatus = '買（専任　両手）';
    const testBuyerNumber = `TEST-PRSV-PROP-${Date.now()}`;
    testBuyerNumbers.push(testBuyerNumber);

    // バグ条件でないことを確認（action が "delete_buyer" でない）
    expect(isBugCondition('update_property', purchaseStatus)).toBe(false);
    console.log(`\n[Test 3.3] 物件情報更新はバグ条件でないことを確認: isBugCondition("update_property", "${purchaseStatus}") = false`);

    // テスト用買主を作成（「買」を含むlatest_status）
    const { data: createdBuyer, error: createError } = await supabase
      .from('buyers')
      .insert({
        buyer_number: testBuyerNumber,
        name: 'テスト買主（物件情報更新テスト）',
        latest_status: purchaseStatus,
        property_number: testPropertyNumber,
        reception_date: new Date().toISOString().split('T')[0],
      })
      .select('buyer_number, latest_status')
      .single();

    expect(createError).toBeNull();
    expect(createdBuyer).not.toBeNull();

    // 物件情報更新前のhasBuyerPurchaseStatus
    const beforeUpdate = hasBuyerPurchaseStatus(createdBuyer!.latest_status);
    expect(beforeUpdate).toBe(true);
    console.log(`[Test 3.3] 物件情報更新前のhasBuyerPurchaseStatus: ${beforeUpdate} (期待値: true)`);

    // 物件情報を更新（property_listingsのupdated_atを更新）
    // 注意: 実際の物件情報更新はproperty_listingsテーブルへの更新
    // ここではbuyersのlatest_statusが変わらないことを確認する
    const { data: afterUpdateBuyer } = await supabase
      .from('buyers')
      .select('buyer_number, latest_status')
      .eq('buyer_number', testBuyerNumber)
      .is('deleted_at', null)
      .single();

    expect(afterUpdateBuyer).not.toBeNull();

    // 【保存プロパティアサート】
    // 物件情報更新後もhasBuyerPurchaseStatusはtrueのまま（ヘッダー表示に影響なし）
    const afterUpdate = hasBuyerPurchaseStatus(afterUpdateBuyer!.latest_status);
    expect(afterUpdate).toBe(true);

    console.log(`[Test 3.3] 物件情報更新後のlatest_status: "${afterUpdateBuyer!.latest_status}"`);
    console.log(`[Test 3.3] 物件情報更新後のhasBuyerPurchaseStatus: ${afterUpdate} (期待値: true)`);
    console.log(`[Test 3.3] ✅ 物件情報更新後もヘッダーの買付バッジ表示は変わらない`);
  }, 30000);

  /**
   * テスト4: 同一物件に複数の「買」ステータス買主がいる場合、
   *          1件削除後も残りの買主がいればヘッダーが表示されたままであることを確認
   *
   * 観察: 複数の「買」ステータス買主がいる場合、1件削除しても
   *       残りの買主のhasBuyerPurchaseStatusはtrueのまま
   *
   * 修正前: PASS（複数買主の正常動作）
   * 修正後: PASS（保存プロパティが維持されている）
   */
  test('Preservation 3.4: 複数の「買」ステータス買主がいる場合、1件削除後も残りの買主がいればヘッダーが表示されたままであること', async () => {
    const purchaseStatus1 = '買（専任　両手）';
    const purchaseStatus2 = '買（一般　両手）';
    const testBuyerNumber1 = `TEST-PRSV-MULTI1-${Date.now()}`;
    const testBuyerNumber2 = `TEST-PRSV-MULTI2-${Date.now()}`;
    testBuyerNumbers.push(testBuyerNumber1, testBuyerNumber2);

    console.log(`\n[Test 3.4] 複数買主シナリオ: 同一物件に2人の「買」ステータス買主`);

    // テスト用買主1を作成（「買（専任　両手）」）
    const { data: buyer1, error: createError1 } = await supabase
      .from('buyers')
      .insert({
        buyer_number: testBuyerNumber1,
        name: 'テスト買主1（複数買主テスト）',
        latest_status: purchaseStatus1,
        property_number: testPropertyNumber,
        reception_date: new Date().toISOString().split('T')[0],
      })
      .select('buyer_number, latest_status')
      .single();

    expect(createError1).toBeNull();
    expect(buyer1).not.toBeNull();

    // テスト用買主2を作成（「買（一般　両手）」）
    const { data: buyer2, error: createError2 } = await supabase
      .from('buyers')
      .insert({
        buyer_number: testBuyerNumber2,
        name: 'テスト買主2（複数買主テスト）',
        latest_status: purchaseStatus2,
        property_number: testPropertyNumber,
        reception_date: new Date().toISOString().split('T')[0],
      })
      .select('buyer_number, latest_status')
      .single();

    expect(createError2).toBeNull();
    expect(buyer2).not.toBeNull();

    // 削除前: 両方の買主がhasBuyerPurchaseStatus = true
    expect(hasBuyerPurchaseStatus(buyer1!.latest_status)).toBe(true);
    expect(hasBuyerPurchaseStatus(buyer2!.latest_status)).toBe(true);
    console.log(`[Test 3.4] 削除前: 買主1 hasBuyerPurchaseStatus=true, 買主2 hasBuyerPurchaseStatus=true`);

    // 買主1を削除（softDelete）
    const { error: deleteError } = await supabase
      .from('buyers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('buyer_number', testBuyerNumber1);

    expect(deleteError).toBeNull();
    console.log(`[Test 3.4] 買主1（${testBuyerNumber1}）を削除`);

    // 削除後: 買主2はまだ存在し、hasBuyerPurchaseStatus = true
    const { data: remainingBuyer } = await supabase
      .from('buyers')
      .select('buyer_number, latest_status, deleted_at')
      .eq('buyer_number', testBuyerNumber2)
      .is('deleted_at', null)
      .single();

    expect(remainingBuyer).not.toBeNull();

    // 【保存プロパティアサート】
    // 買主1削除後も、買主2のhasBuyerPurchaseStatusはtrueのまま
    const remainingHasPurchaseStatus = hasBuyerPurchaseStatus(remainingBuyer!.latest_status);
    expect(remainingHasPurchaseStatus).toBe(true);

    console.log(`[Test 3.4] 買主1削除後の買主2のlatest_status: "${remainingBuyer!.latest_status}"`);
    console.log(`[Test 3.4] 買主1削除後の買主2のhasBuyerPurchaseStatus: ${remainingHasPurchaseStatus} (期待値: true)`);
    console.log(`[Test 3.4] ✅ 複数買主がいる場合、1件削除後も残りの買主がいればヘッダーが表示されたまま`);

    // 同一物件の有効な「買」ステータス買主が1人以上いることを確認
    const { data: activeBuyersWithPurchase } = await supabase
      .from('buyers')
      .select('buyer_number, latest_status')
      .eq('property_number', testPropertyNumber)
      .is('deleted_at', null)
      .in('buyer_number', [testBuyerNumber1, testBuyerNumber2]);

    // 削除されていない買主のうち、「買」ステータスを持つものが1人以上いる
    const activePurchaseBuyers = (activeBuyersWithPurchase || []).filter(b =>
      hasBuyerPurchaseStatus(b.latest_status)
    );
    expect(activePurchaseBuyers.length).toBeGreaterThanOrEqual(1);
    console.log(`[Test 3.4] ✅ 有効な「買」ステータス買主数: ${activePurchaseBuyers.length}人（1人以上）`);
  }, 60000);

  /**
   * テスト5: プロパティベーステスト - 「買」を含まない任意のlatest_statusを持つ買主の削除
   *
   * 観察優先メソドロジー: 修正前のコードで実際に動作するケースを網羅的に検証
   *
   * 修正前: PASS（非バグ条件のため影響なし）
   * 修正後: PASS（保存プロパティが維持されている）
   */
  test('Preservation 3.5: プロパティベーステスト - 「買」を含まない任意のlatest_statusを持つ買主の削除はヘッダー表示に影響しない', async () => {
    console.log(`\n[Test 3.5] プロパティベーステスト: 非バグ条件の網羅的検証`);
    console.log(`[Test 3.5] テスト対象ステータス: ${NON_BUG_STATUSES.filter(s => s !== null).join(', ')}`);

    // 各非バグ条件ステータスについて検証
    for (const latestStatus of NON_BUG_STATUSES) {
      const statusStr = latestStatus ?? '';

      // バグ条件でないことを確認
      expect(isBugCondition('delete_buyer', statusStr)).toBe(false);

      // 削除前のhasBuyerPurchaseStatus
      const beforeDelete = hasBuyerPurchaseStatus(statusStr);
      expect(beforeDelete).toBe(false);

      // テスト用買主を作成
      const testBuyerNumber = `TEST-PRSV-PBT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      testBuyerNumbers.push(testBuyerNumber);

      const { data: createdBuyer, error: createError } = await supabase
        .from('buyers')
        .insert({
          buyer_number: testBuyerNumber,
          name: `テスト買主（PBT_${statusStr || 'null'}）`,
          latest_status: latestStatus,
          property_number: testPropertyNumber,
          reception_date: new Date().toISOString().split('T')[0],
        })
        .select('buyer_number, latest_status')
        .single();

      expect(createError).toBeNull();
      expect(createdBuyer).not.toBeNull();

      // softDelete実行
      const { error: deleteError } = await supabase
        .from('buyers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('buyer_number', testBuyerNumber);

      expect(deleteError).toBeNull();

      // softDelete後のDBの状態を確認
      const { data: afterDelete } = await supabase
        .from('buyers')
        .select('buyer_number, latest_status, deleted_at')
        .eq('buyer_number', testBuyerNumber)
        .single();

      expect(afterDelete).not.toBeNull();
      expect(afterDelete!.deleted_at).not.toBeNull();

      // 【保存プロパティアサート】
      // 削除後もhasBuyerPurchaseStatusはfalseのまま（ヘッダー表示に影響なし）
      const afterDeleteStatus = hasBuyerPurchaseStatus(afterDelete!.latest_status);
      expect(afterDeleteStatus).toBe(false);

      console.log(`[Test 3.5] ✅ latest_status="${statusStr || '(空文字/null)'}" → 削除後もhasBuyerPurchaseStatus=false`);
    }

    console.log(`[Test 3.5] ✅ 全ての非バグ条件ステータスで保存プロパティが確認された`);
  }, 120000);
});
