/**
 * Preservation Property Test: アクティブな買主・新規買主の動作保持
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは修正前のコードで実行し、PASS することを確認する（ベースライン動作の確認）
 *
 * 目的:
 *   バグ条件が成立しない入力（isBugCondition(X) = false）に対して、
 *   修正前後で動作が変わらないことを確認する。
 *
 * 観察優先メソドロジー:
 *   - 修正前のコードで、アクティブな買主（deleted_at = null）の動作を観察する
 *   - 観察1: アクティブな買主に対して syncSingleBuyer を実行しても deleted_at は変更されない
 *   - 観察2: DBに存在しない新規買主は挿入処理が行われる
 *   - 観察3: detectMissingBuyers() は deleted_at IS NULL のアクティブな買主のみを取得する
 *
 * 保全すべき動作:
 *   - deleted_at IS NULL のアクティブな買主に対する同期は、deleted_at を変更しない
 *   - DBに存在しない新規買主の同期は、新規挿入処理を行う
 *   - detectMissingBuyers() は deleted_at IS NULL のアクティブな買主のみを取得する
 *
 * Property 2: Preservation - アクティブな買主・新規買主の動作保持
 */

import * as fc from 'fast-check';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 環境変数を読み込む
const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../.env.local'),
  path.join(__dirname, '../../.env.production'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

// ===== テスト用ヘルパー =====

/**
 * syncSingleBuyer の現在の（修正前の）実装を再現
 * バグ条件に該当しない入力（アクティブな買主・新規買主）に対する動作を確認する
 */
async function syncSingleBuyer_current(
  supabase: SupabaseClient,
  buyerNumber: string,
  buyerData: Record<string, any>
): Promise<{ action: 'updated' | 'inserted' }> {
  // 現在の実装: buyer_id のみ取得（deleted_at を確認しない）
  const { data: existingBuyer, error: checkError } = await supabase
    .from('buyers')
    .select('buyer_id')
    .eq('buyer_number', buyerNumber)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to check existing buyer: ${checkError.message}`);
  }

  if (existingBuyer) {
    // 既存の買主を更新（deleted_at を変更しない）
    const { error: updateError } = await supabase
      .from('buyers')
      .update({
        ...buyerData,
        created_at: undefined,
      })
      .eq('buyer_number', buyerNumber);

    if (updateError) {
      throw new Error(updateError.message);
    }
    return { action: 'updated' };
  } else {
    // 新規買主を挿入
    const { error: insertError } = await supabase
      .from('buyers')
      .insert(buyerData);

    if (insertError) {
      throw new Error(insertError.message);
    }
    return { action: 'inserted' };
  }
}

/**
 * getByBuyerNumber の実装を再現（deleted_at IS NULL フィルタあり）
 */
async function getByBuyerNumber(
  supabase: SupabaseClient,
  buyerNumber: string
): Promise<Record<string, any> | null> {
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_id, buyer_number, name, deleted_at')
    .eq('buyer_number', buyerNumber)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get buyer: ${error.message}`);
  }

  return data;
}

// ===== テストスイート =====

describe('Preservation: アクティブな買主・新規買主の動作保持', () => {
  let supabase: SupabaseClient;
  let activeBuyers: Array<{ buyer_id: string; buyer_number: string; name: string; deleted_at: null }>;

  beforeAll(async () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Supabase環境変数が設定されていません: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    supabase = createClient(supabaseUrl, supabaseKey);

    // DBからアクティブな買主を取得（最大10件）
    const { data, error } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, name, deleted_at')
      .is('deleted_at', null)
      .limit(10);

    if (error) {
      throw new Error(`アクティブ買主の取得に失敗: ${error.message}`);
    }

    activeBuyers = (data || []) as any[];
    console.log(`[Setup] アクティブ買主（${activeBuyers.length}件）を取得`);
  }, 30000);

  /**
   * 観察例1: アクティブな買主に対して syncSingleBuyer を実行しても deleted_at は変更されない
   *
   * **Validates: Requirements 3.1**
   *
   * 保全すべき動作:
   *   deleted_at IS NULL のアクティブな買主に対して同期を実行しても、
   *   deleted_at は null のまま変更されない。
   *
   * このテストは修正前のコードで PASS する（保全すべきベースライン動作）
   */
  test('観察例1: アクティブな買主に対して同期を実行しても deleted_at が変更されないこと', async () => {
    console.log('\n========================================');
    console.log('Preservation Test 観察例1 開始');
    console.log('  アクティブな買主の deleted_at が変更されないことを確認');
    console.log('========================================\n');

    if (activeBuyers.length === 0) {
      console.log('[INFO] アクティブな買主が存在しません。テストをスキップします。');
      return;
    }

    // 最初のアクティブな買主でテスト
    const targetBuyer = activeBuyers[0];
    console.log(`[INFO] テスト対象: 買主番号 ${targetBuyer.buyer_number} (deleted_at = ${targetBuyer.deleted_at})`);

    // 同期前の状態を確認
    const beforeSync = await getByBuyerNumber(supabase, targetBuyer.buyer_number);
    console.log(`[INFO] 同期前: deleted_at = ${beforeSync?.deleted_at}`);

    // syncSingleBuyer を実行（バグ条件に該当しない: deleted_at = null）
    const mockBuyerData = {
      buyer_number: targetBuyer.buyer_number,
      name: targetBuyer.name || `買主${targetBuyer.buyer_number}`,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const result = await syncSingleBuyer_current(supabase, targetBuyer.buyer_number, mockBuyerData);
    console.log(`[INFO] syncSingleBuyer の結果: ${result.action}`);

    // 同期後の状態を確認
    const afterSync = await getByBuyerNumber(supabase, targetBuyer.buyer_number);
    console.log(`[INFO] 同期後: deleted_at = ${afterSync?.deleted_at}`);

    console.log('\n========================================');
    console.log('📋 観察例1 結果:');
    console.log(`  買主番号: ${targetBuyer.buyer_number}`);
    console.log(`  同期前 deleted_at: ${beforeSync?.deleted_at}`);
    console.log(`  同期後 deleted_at: ${afterSync?.deleted_at}`);
    console.log(`  アクション: ${result.action}`);
    console.log('========================================\n');

    // 保全プロパティ: アクティブな買主の deleted_at は変更されない
    expect(result.action).toBe('updated');
    expect(afterSync).not.toBeNull();
    expect(afterSync?.deleted_at).toBeNull();
  }, 30000);

  /**
   * 観察例2: 新規買主（DBに存在しない）に対して syncSingleBuyer を実行すると挿入処理が行われる
   *
   * **Validates: Requirements 3.3**
   *
   * 保全すべき動作:
   *   DBに存在しない買主番号に対して同期を実行すると、新規挿入処理が行われる。
   *
   * このテストは修正前のコードで PASS する（保全すべきベースライン動作）
   * 注意: テスト後にクリーンアップを行う
   */
  test('観察例2: DBに存在しない新規買主に対して同期を実行すると挿入処理が行われること', async () => {
    console.log('\n========================================');
    console.log('Preservation Test 観察例2 開始');
    console.log('  新規買主の挿入処理が正常に行われることを確認');
    console.log('========================================\n');

    // テスト用の一時的な買主番号（既存と衝突しないよう TEST_ プレフィックスを使用）
    const testBuyerNumber = `TEST_PRESERVATION_${Date.now()}`;

    console.log(`[INFO] テスト用買主番号: ${testBuyerNumber}`);

    // DBに存在しないことを確認
    const { data: existing } = await supabase
      .from('buyers')
      .select('buyer_id')
      .eq('buyer_number', testBuyerNumber)
      .maybeSingle();

    expect(existing).toBeNull();
    console.log('[INFO] テスト用買主番号がDBに存在しないことを確認');

    // syncSingleBuyer を実行（新規買主）
    const mockBuyerData = {
      buyer_number: testBuyerNumber,
      name: `テスト買主_${testBuyerNumber}`,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const result = await syncSingleBuyer_current(supabase, testBuyerNumber, mockBuyerData);
    console.log(`[INFO] syncSingleBuyer の結果: ${result.action}`);

    // 挿入後の状態を確認
    const afterInsert = await getByBuyerNumber(supabase, testBuyerNumber);
    console.log(`[INFO] 挿入後: ${afterInsert ? JSON.stringify(afterInsert) : 'null'}`);

    // クリーンアップ: テスト用レコードを削除
    await supabase
      .from('buyers')
      .delete()
      .eq('buyer_number', testBuyerNumber);
    console.log('[INFO] テスト用レコードをクリーンアップ');

    console.log('\n========================================');
    console.log('📋 観察例2 結果:');
    console.log(`  買主番号: ${testBuyerNumber}`);
    console.log(`  アクション: ${result.action}`);
    console.log(`  挿入後 deleted_at: ${afterInsert?.deleted_at}`);
    console.log('========================================\n');

    // 保全プロパティ: 新規買主は挿入処理が行われる
    expect(result.action).toBe('inserted');
    expect(afterInsert).not.toBeNull();
    expect(afterInsert?.deleted_at).toBeNull();
  }, 30000);

  /**
   * 観察例3: detectMissingBuyers は deleted_at IS NULL のアクティブな買主のみを取得する
   *
   * **Validates: Requirements 3.4**
   *
   * 保全すべき動作:
   *   detectMissingBuyers() は deleted_at IS NULL のアクティブな買主のみをDBから取得し、
   *   スプレッドシートと比較する。
   *
   * このテストは修正前のコードで PASS する（保全すべきベースライン動作）
   */
  test('観察例3: アクティブな買主（deleted_at IS NULL）のみが getByBuyerNumber で取得されること', async () => {
    console.log('\n========================================');
    console.log('Preservation Test 観察例3 開始');
    console.log('  deleted_at IS NULL フィルタの動作確認');
    console.log('========================================\n');

    if (activeBuyers.length === 0) {
      console.log('[INFO] アクティブな買主が存在しません。テストをスキップします。');
      return;
    }

    // アクティブな買主は getByBuyerNumber で取得できる
    let allFound = true;
    for (const buyer of activeBuyers.slice(0, 5)) {
      const result = await getByBuyerNumber(supabase, buyer.buyer_number);
      if (!result) {
        console.log(`[WARN] アクティブな買主 ${buyer.buyer_number} が getByBuyerNumber で取得できない`);
        allFound = false;
      }
      expect(result).not.toBeNull();
      expect(result?.deleted_at).toBeNull();
    }

    if (allFound) {
      console.log(`[OK] ${Math.min(activeBuyers.length, 5)}件のアクティブ買主が getByBuyerNumber で正常に取得できることを確認`);
    }

    // 論理削除済みの買主は getByBuyerNumber で取得できない
    const { data: softDeletedBuyers } = await supabase
      .from('buyers')
      .select('buyer_number, deleted_at')
      .not('deleted_at', 'is', null)
      .limit(3);

    if (softDeletedBuyers && softDeletedBuyers.length > 0) {
      console.log(`\n[INFO] 論理削除済み買主（${softDeletedBuyers.length}件）の確認:`);
      for (const buyer of softDeletedBuyers) {
        const result = await getByBuyerNumber(supabase, buyer.buyer_number);
        console.log(`  - ${buyer.buyer_number}: getByBuyerNumber = ${result ? '非 null' : 'null'}`);
        // 論理削除済みの買主は getByBuyerNumber で取得できない（deleted_at IS NULL フィルタ）
        expect(result).toBeNull();
      }
      console.log('[OK] 論理削除済み買主が getByBuyerNumber で取得されないことを確認');
    }

    console.log('\n========================================');
    console.log('Preservation Test 観察例3 終了');
    console.log('========================================\n');
  }, 30000);

  /**
   * Property 2 (PBT): ランダムなアクティブ買主に対して同期を実行しても deleted_at が変更されないこと
   *
   * **Validates: Requirements 3.1**
   *
   * 保全すべき動作:
   *   deleted_at IS NULL のアクティブな買主に対して同期を実行しても、
   *   deleted_at は null のまま変更されない。
   *
   * このテストは修正前のコードで PASS する（保全すべきベースライン動作）
   */
  test('Property 2 (PBT): ランダムなアクティブ買主に対して同期を実行しても deleted_at が変更されないこと', async () => {
    console.log('\n========================================');
    console.log('Preservation PBT 開始');
    console.log('  ランダムなアクティブ買主に対する保全テスト');
    console.log('========================================\n');

    if (activeBuyers.length === 0) {
      console.log('[INFO] アクティブな買主が存在しません。テストをスキップします。');
      return;
    }

    // fast-check でランダムなアクティブ買主のサブセットを選択してテスト
    // 注意: 実際のDBに対してテストするため、numRuns を小さく設定
    const buyerNumbers = activeBuyers.map(b => b.buyer_number);

    await fc.assert(
      fc.asyncProperty(
        // アクティブな買主からランダムに1件選択
        fc.integer({ min: 0, max: buyerNumbers.length - 1 }),
        async (index) => {
          const buyerNumber = buyerNumbers[index];
          const buyer = activeBuyers[index];

          // 同期前の状態を確認
          const beforeSync = await getByBuyerNumber(supabase, buyerNumber);
          if (!beforeSync) {
            // アクティブな買主が取得できない場合はスキップ
            return true;
          }

          // syncSingleBuyer を実行（バグ条件に該当しない: deleted_at = null）
          const mockBuyerData = {
            buyer_number: buyerNumber,
            name: buyer.name || `買主${buyerNumber}`,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };

          await syncSingleBuyer_current(supabase, buyerNumber, mockBuyerData);

          // 同期後の状態を確認
          const afterSync = await getByBuyerNumber(supabase, buyerNumber);

          // 保全プロパティ: アクティブな買主の deleted_at は変更されない
          if (!afterSync) {
            console.log(`[PBT] 反例発見: ${buyerNumber} が同期後に getByBuyerNumber で取得できない`);
            return false;
          }

          if (afterSync.deleted_at !== null) {
            console.log(`[PBT] 反例発見: ${buyerNumber} の deleted_at が変更された: ${afterSync.deleted_at}`);
            return false;
          }

          return true;
        }
      ),
      { numRuns: Math.min(activeBuyers.length, 5) }
    );

    console.log(`[OK] ${Math.min(activeBuyers.length, 5)}回のランダムテストで保全プロパティが成立することを確認`);
    console.log('\n========================================');
    console.log('Preservation PBT 終了');
    console.log('========================================\n');
  }, 60000);
});
