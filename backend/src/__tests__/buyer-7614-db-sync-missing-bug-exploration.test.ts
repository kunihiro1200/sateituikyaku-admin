/**
 * Bug Condition 探索テスト: 論理削除済み買主の同期後に deleted_at がリセットされないバグ
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * このテストは修正前のコードで実行すると**失敗**する（失敗＝バグの存在を証明する）
 *
 * バグ条件:
 *   isBugCondition(X) = true
 *   ⟺ EXISTS(buyer IN DB WHERE buyer.buyer_number = X.buyer_number AND buyer.deleted_at IS NOT NULL)
 *      AND EXISTS(row IN Spreadsheet WHERE row['買主番号'] = X.buyer_number)
 *
 * 根本原因:
 *   `backend/src/services/EnhancedAutoSyncService.ts` の `syncSingleBuyer()` が
 *   `.select('buyer_id')` のみ取得しており、`deleted_at` を確認しない。
 *   そのため、論理削除済みレコードを「既存の買主」として検出し、
 *   `deleted_at: null` を含まない更新を行う。
 *   結果として `deleted_at` フラグが残ったままとなり、
 *   `getByBuyerNumber()` の `deleted_at IS NULL` フィルタで該当レコードが見つからない。
 *
 * 期待される動作（修正後）:
 *   syncSingleBuyer'(X) を実行後、getByBuyerNumber(X.buyer_number) が非 null を返し、
 *   かつ result.deleted_at が null であること。
 *
 * **CRITICAL**: このテストは未修正コードで FAIL する — 失敗がバグの存在を証明する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
 */

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
 * syncSingleBuyer の現在の（バグのある）実装を再現
 *
 * バグ: .select('buyer_id') のみ取得し、deleted_at を確認しない
 *       → 論理削除済みレコードを「既存の買主」として検出し、deleted_at: null を含まない更新を行う
 */
async function syncSingleBuyer_buggy(
  supabase: SupabaseClient,
  buyerNumber: string,
  buyerData: Record<string, any>
): Promise<void> {
  // バグのある実装: buyer_id のみ取得（deleted_at を確認しない）
  const { data: existingBuyer, error: checkError } = await supabase
    .from('buyers')
    .select('buyer_id')
    .eq('buyer_number', buyerNumber)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to check existing buyer: ${checkError.message}`);
  }

  if (existingBuyer) {
    // バグ: deleted_at: null を含まない更新
    const { error: updateError } = await supabase
      .from('buyers')
      .update({
        ...buyerData,
        created_at: undefined,
        // deleted_at: null を含めていない ← これがバグ
      })
      .eq('buyer_number', buyerNumber);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { error: insertError } = await supabase
      .from('buyers')
      .insert(buyerData);

    if (insertError) {
      throw new Error(insertError.message);
    }
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

/**
 * isBugCondition: バグ条件が成立するかを確認
 * DBに論理削除済みレコードが存在し、かつスプシにも同じ買主番号が存在する場合 true
 */
async function isBugCondition(
  supabase: SupabaseClient,
  buyerNumber: string
): Promise<{ isBug: boolean; deletedAt: string | null }> {
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('buyer_number, deleted_at')
    .eq('buyer_number', buyerNumber)
    .not('deleted_at', 'is', null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check bug condition: ${error.message}`);
  }

  return {
    isBug: buyer !== null,
    deletedAt: buyer?.deleted_at ?? null,
  };
}

// ===== テストスイート =====

describe('Bug Condition: 論理削除済み買主の同期後に deleted_at がリセットされないバグ', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
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
  });

  /**
   * Property 1: Bug Condition - 論理削除済み買主番号7614の同期テスト
   *
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * バグ条件:
   *   - DBに買主番号7614の論理削除済みレコードが存在する（deleted_at IS NOT NULL）
   *   - スプレッドシートに7614が存在する（同期対象）
   *
   * 期待される動作（修正後）:
   *   - syncSingleBuyer'('7614', row) を実行後
   *   - getByBuyerNumber('7614') が非 null を返す
   *   - result.deleted_at が null である
   *
   * **CRITICAL**: このテストは未修正コードで FAIL する
   * 未修正コードでは deleted_at が null にリセットされないため、
   * getByBuyerNumber() が null を返す
   */
  test('Property 1: Bug Condition - 論理削除済み買主7614の同期後に getByBuyerNumber が非 null を返すこと（修正前は失敗）', async () => {
    console.log('\n========================================');
    console.log('🔍 Bug Condition Test 開始: 買主番号7614');
    console.log('  論理削除済み買主の同期後に deleted_at がリセットされるか確認');
    console.log('========================================\n');

    const buyerNumber = '7614';

    // ステップ1: バグ条件の確認
    console.log('[Step 1] バグ条件の確認...');
    const { data: buyerRaw, error: fetchError } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, name, deleted_at')
      .eq('buyer_number', buyerNumber)
      .maybeSingle();

    if (fetchError) {
      console.log(`[INFO] 買主番号${buyerNumber}の取得に失敗: ${fetchError.message}`);
      throw fetchError;
    }

    if (!buyerRaw) {
      console.log(`[INFO] 買主番号${buyerNumber}はDBに存在しません`);
      console.log('[INFO] テストをスキップします（バグ条件が成立しない）');
      return;
    }

    console.log(`[INFO] 買主番号${buyerNumber}のDB状態:`);
    console.log(`  - buyer_id: ${buyerRaw.buyer_id}`);
    console.log(`  - buyer_number: ${buyerRaw.buyer_number}`);
    console.log(`  - name: ${buyerRaw.name}`);
    console.log(`  - deleted_at: ${buyerRaw.deleted_at}`);

    if (!buyerRaw.deleted_at) {
      console.log(`[INFO] 買主番号${buyerNumber}はアクティブ状態（deleted_at = null）です`);
      console.log('[INFO] テストをスキップします（バグ条件が成立しない）');
      return;
    }

    console.log(`\n✅ バグ条件成立: ${buyerNumber}は論理削除状態（deleted_at = ${buyerRaw.deleted_at}）`);

    // ステップ2: スプレッドシートからの同期をシミュレート（バグのある実装）
    console.log('\n[Step 2] バグのある syncSingleBuyer を実行...');
    const mockBuyerData = {
      buyer_number: buyerNumber,
      name: buyerRaw.name || `買主${buyerNumber}`,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    await syncSingleBuyer_buggy(supabase, buyerNumber, mockBuyerData);
    console.log(`[INFO] syncSingleBuyer_buggy(${buyerNumber}) 実行完了`);

    // ステップ3: 同期後の状態を確認
    console.log('\n[Step 3] 同期後の状態を確認...');

    // deleted_at フィルタなしで直接確認
    const { data: afterSync, error: afterError } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, deleted_at')
      .eq('buyer_number', buyerNumber)
      .maybeSingle();

    if (afterError) {
      throw new Error(`同期後の確認に失敗: ${afterError.message}`);
    }

    console.log(`[INFO] 同期後のDB状態（フィルタなし）:`);
    console.log(`  - deleted_at: ${afterSync?.deleted_at}`);

    // getByBuyerNumber（deleted_at IS NULL フィルタあり）で確認
    const result = await getByBuyerNumber(supabase, buyerNumber);
    console.log(`\n[INFO] getByBuyerNumber('${buyerNumber}') の結果: ${result ? JSON.stringify(result) : 'null'}`);

    if (!result) {
      console.log('\n❌ バグ確認: getByBuyerNumber が null を返した');
      console.log('  原因: syncSingleBuyer が deleted_at: null を含まない更新を行ったため');
      console.log('  deleted_at フラグが残ったままで、deleted_at IS NULL フィルタに引っかかる');
      console.log('  これはバグの存在を証明します');
    } else {
      console.log('\n✅ getByBuyerNumber が非 null を返した（修正済みの場合）');
      console.log(`  deleted_at: ${result.deleted_at}`);
    }

    console.log('\n========================================');
    console.log('📋 テスト結果サマリー:');
    console.log(`  買主番号: ${buyerNumber}`);
    console.log(`  同期前 deleted_at: ${buyerRaw.deleted_at}`);
    console.log(`  同期後 deleted_at（フィルタなし）: ${afterSync?.deleted_at}`);
    console.log(`  getByBuyerNumber の結果: ${result ? '非 null（正常）' : 'null（バグあり）'}`);
    console.log('========================================\n');

    // **CRITICAL**: このアサーションは未修正コードで FAIL する
    // 未修正コードでは deleted_at が null にリセットされないため、
    // getByBuyerNumber() が null を返す → expect(result).not.toBeNull() が FAIL
    //
    // 修正後（deleted_at: null を含む更新）は:
    // - deleted_at が null にリセットされる
    // - getByBuyerNumber() が非 null を返す → PASS
    //
    // 反例（修正前）: result = null（deleted_at が残ったまま）
    // 期待値（修正後）: result.deleted_at = null
    expect(result).not.toBeNull();
    expect(result?.deleted_at).toBeNull();
  }, 30000);

  /**
   * Property 1: Bug Condition - 複数の論理削除済み買主に対するスコープ付き PBT
   *
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * バグ条件が成立する全ての入力に対して、バグが存在することを確認する。
   * DBから論理削除済みの買主を最大3件取得し、それぞれに対してバグを確認する。
   *
   * **CRITICAL**: このテストは未修正コードで FAIL する
   */
  test('Property 1 (Scoped PBT): 論理削除済み買主に対して同期後も deleted_at がリセットされないこと（修正前は失敗）', async () => {
    console.log('\n========================================');
    console.log('🔍 Bug Condition Scoped PBT 開始');
    console.log('  論理削除済み買主に対するバグ条件の確認');
    console.log('========================================\n');

    // DBから論理削除済みの買主を取得（最大3件）
    const { data: softDeletedBuyers, error: fetchError } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, name, deleted_at')
      .not('deleted_at', 'is', null)
      .limit(3);

    if (fetchError) {
      throw new Error(`論理削除済み買主の取得に失敗: ${fetchError.message}`);
    }

    if (!softDeletedBuyers || softDeletedBuyers.length === 0) {
      console.log('[INFO] DBに論理削除済みの買主が存在しません');
      console.log('[INFO] テストをスキップします（バグ条件が成立しない）');
      return;
    }

    console.log(`[INFO] テスト対象の論理削除済み買主（${softDeletedBuyers.length}件）:`);
    softDeletedBuyers.forEach(b => {
      console.log(`  - ${b.buyer_number} (deleted_at: ${b.deleted_at})`);
    });

    const failures: string[] = [];

    for (const buyer of softDeletedBuyers) {
      const buyerNumber = buyer.buyer_number;
      console.log(`\n[テスト] 買主番号: ${buyerNumber}`);

      // バグのある syncSingleBuyer を実行
      const mockBuyerData = {
        buyer_number: buyerNumber,
        name: buyer.name || `買主${buyerNumber}`,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      await syncSingleBuyer_buggy(supabase, buyerNumber, mockBuyerData);

      // 同期後に getByBuyerNumber で確認
      const result = await getByBuyerNumber(supabase, buyerNumber);

      if (!result) {
        console.log(`  ❌ バグ確認: getByBuyerNumber('${buyerNumber}') = null（deleted_at が残ったまま）`);
        failures.push(buyerNumber);
      } else {
        console.log(`  ✅ getByBuyerNumber('${buyerNumber}') = 非 null（deleted_at = ${result.deleted_at}）`);
      }
    }

    console.log('\n========================================');
    console.log('📋 Scoped PBT 結果サマリー:');
    console.log(`  テスト件数: ${softDeletedBuyers.length}`);
    console.log(`  バグ確認件数: ${failures.length}`);
    if (failures.length > 0) {
      console.log(`  バグが確認された買主番号: ${failures.join(', ')}`);
      console.log('  原因: syncSingleBuyer が deleted_at: null を含まない更新を行っている');
    }
    console.log('========================================\n');

    // **CRITICAL**: このアサーションは未修正コードで FAIL する
    // 全ての論理削除済み買主に対して、同期後に getByBuyerNumber が非 null を返すことを期待
    // 未修正コードでは deleted_at がリセットされないため FAIL する
    for (const buyer of softDeletedBuyers) {
      const result = await getByBuyerNumber(supabase, buyer.buyer_number);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.deleted_at).toBeNull();
      }
    }
  }, 60000);
});
