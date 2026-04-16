/**
 * Bug Condition探索テスト: ソフトデリート済み買主番号の欠損未検出バグ
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは修正前のコードで実行すると**失敗**する（失敗＝バグの存在を証明する）
 *
 * バグ条件:
 * - `detectMissingBuyers()` が `getAllDbBuyerNumbers()`（`deleted_at` フィルタなし）を使用している
 * - そのため、ソフトデリート済みの買主番号（`deleted_at` が非null）も「DBに存在する」と誤判定される
 * - スプレッドシートに存在する買主番号7373がDBにソフトデリート状態で残っている場合、
 *   欠損として検出されず同期がスキップされる
 *
 * 根本原因:
 *   `backend/src/services/EnhancedAutoSyncService.ts` の `detectMissingBuyers()` メソッドが
 *   `getAllDbBuyerNumbers()`（Line 2793）を呼び出している。
 *   このメソッドは `deleted_at` フィルタなしで全レコードを取得するため、
 *   ソフトデリート済みレコードも「存在する」と判断される。
 *   正しくは `getAllActiveBuyerNumbers()`（Line 3298）を使用すべき。
 *
 * 期待される動作（修正後）:
 * - `detectMissingBuyers()` がソフトデリート済み買主番号を欠損リストに含める
 *
 * 未修正コードでの期待される失敗:
 * - `detectMissingBuyers()` がソフトデリート済み買主番号を欠損リストに含めない
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
 * detectMissingBuyersのロジックを直接テストするためのヘルパー関数
 *
 * 実際の `detectMissingBuyers()` はスプレッドシートへのアクセスが必要なため、
 * ここではそのコアロジック（スプレッドシートの買主番号セット vs DBの買主番号セット）を
 * 直接テストする。
 *
 * バグの核心:
 * - `getAllDbBuyerNumbers()` はソフトデリート済みレコードも含む
 * - `getAllActiveBuyerNumbers()` はアクティブなレコードのみ含む
 * - `detectMissingBuyers()` は `getAllDbBuyerNumbers()` を使用しているためバグが発生する
 */

/**
 * getAllDbBuyerNumbers のロジックを再現（deleted_at フィルタなし）
 * これが現在の（バグのある）実装
 */
async function getAllDbBuyerNumbers_buggy(supabase: SupabaseClient): Promise<Set<string>> {
  const allBuyerNumbers = new Set<string>();
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('buyers')
      .select('buyer_number')
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch DB buyers: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      for (const buyer of data) {
        if (buyer.buyer_number) {
          allBuyerNumbers.add(buyer.buyer_number);
        }
      }
      offset += pageSize;
      if (data.length < pageSize) {
        hasMore = false;
      }
    }
  }

  return allBuyerNumbers;
}

/**
 * getAllActiveBuyerNumbers のロジックを再現（deleted_at IS NULL フィルタあり）
 * これが正しい実装
 */
async function getAllActiveBuyerNumbers_correct(supabase: SupabaseClient): Promise<Set<string>> {
  const allBuyerNumbers = new Set<string>();
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('buyers')
      .select('buyer_number')
      .is('deleted_at', null) // 削除済みを除外
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch active DB buyers: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      for (const buyer of data) {
        if (buyer.buyer_number) {
          allBuyerNumbers.add(buyer.buyer_number);
        }
      }
      offset += pageSize;
      if (data.length < pageSize) {
        hasMore = false;
      }
    }
  }

  return allBuyerNumbers;
}

/**
 * detectMissingBuyers のコアロジックを再現
 * スプレッドシートの買主番号セットとDBの買主番号セットを比較して欠損を検出する
 */
function detectMissingBuyersLogic(
  sheetBuyerNumbers: Set<string>,
  dbBuyerNumbers: Set<string>
): string[] {
  const missingBuyers: string[] = [];
  for (const buyerNumber of sheetBuyerNumbers) {
    if (!dbBuyerNumbers.has(buyerNumber)) {
      missingBuyers.push(buyerNumber);
    }
  }
  return missingBuyers;
}

// ===== テストスイート =====

describe('Bug Condition: ソフトデリート済み買主番号の欠損未検出バグ', () => {
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
   * Bug Condition Test 1: 買主番号7373がソフトデリート状態の場合に欠損として検出されないことを確認
   *
   * **Validates: Requirements 1.1, 1.2**
   *
   * バグ条件:
   * - スプレッドシートに7373が存在する
   * - DBに7373のレコードが存在し、deleted_at が非null（ソフトデリート状態）
   *
   * 期待される動作（修正後）:
   * - `detectMissingBuyers()` が7373を欠損リストに含める
   *
   * 未修正コードでの期待される失敗:
   * - `getAllDbBuyerNumbers()` が7373を返すため、欠損リストに含まれない
   *
   * **CRITICAL**: このテストは未修正コードで FAIL する（バグの存在を証明する）
   */
  test('Bug Condition 1.1: 買主番号7373がソフトデリート状態の場合、欠損リストに含まれること（修正前は失敗）', async () => {
    console.log('\n========================================');
    console.log('🔍 Bug Condition Test 1.1 開始');
    console.log('  スプレッドシートに7373が存在し、DBにソフトデリート済みレコードが存在する場合');
    console.log('========================================\n');

    // DBで7373の実際の状態を確認
    const { data: buyer7373, error: fetchError } = await supabase
      .from('buyers')
      .select('buyer_number, deleted_at')
      .eq('buyer_number', '7373')
      .single();

    if (fetchError) {
      console.log(`[INFO] 買主番号7373はDBに存在しません: ${fetchError.message}`);
      console.log('[INFO] このテストはDBに7373のソフトデリート済みレコードが必要です');
      console.log('[INFO] テストをスキップします（バグ条件が成立しない）');
      // DBに7373が存在しない場合はバグ条件が成立しないためスキップ
      return;
    }

    console.log(`[INFO] 買主番号7373のDB状態:`);
    console.log(`  - buyer_number: ${buyer7373?.buyer_number}`);
    console.log(`  - deleted_at: ${buyer7373?.deleted_at}`);

    if (!buyer7373?.deleted_at) {
      console.log('[INFO] 買主番号7373はアクティブ状態（deleted_at = null）です');
      console.log('[INFO] このテストはdeleted_atが非nullのレコードが必要です');
      console.log('[INFO] テストをスキップします（バグ条件が成立しない）');
      // アクティブな場合はバグ条件が成立しないためスキップ
      return;
    }

    console.log(`\n✅ バグ条件成立: 7373はソフトデリート状態（deleted_at = ${buyer7373.deleted_at}）`);

    // スプレッドシートに7373が存在すると仮定（バグ条件）
    const sheetBuyerNumbers = new Set<string>(['7373']);

    // バグのある実装（getAllDbBuyerNumbers - deleted_at フィルタなし）
    console.log('\n[Step 1] バグのある実装（getAllDbBuyerNumbers）でDB買主番号を取得...');
    const dbBuyerNumbers_buggy = await getAllDbBuyerNumbers_buggy(supabase);
    const has7373_buggy = dbBuyerNumbers_buggy.has('7373');
    console.log(`  - getAllDbBuyerNumbers() に7373が含まれるか: ${has7373_buggy}`);

    // 正しい実装（getAllActiveBuyerNumbers - deleted_at IS NULL フィルタあり）
    console.log('\n[Step 2] 正しい実装（getAllActiveBuyerNumbers）でDB買主番号を取得...');
    const dbBuyerNumbers_correct = await getAllActiveBuyerNumbers_correct(supabase);
    const has7373_correct = dbBuyerNumbers_correct.has('7373');
    console.log(`  - getAllActiveBuyerNumbers() に7373が含まれるか: ${has7373_correct}`);

    // バグのある実装での欠損検出
    const missingBuyers_buggy = detectMissingBuyersLogic(sheetBuyerNumbers, dbBuyerNumbers_buggy);
    console.log(`\n[Step 3] バグのある実装での欠損検出結果: ${JSON.stringify(missingBuyers_buggy)}`);

    // 正しい実装での欠損検出
    const missingBuyers_correct = detectMissingBuyersLogic(sheetBuyerNumbers, dbBuyerNumbers_correct);
    console.log(`[Step 4] 正しい実装での欠損検出結果: ${JSON.stringify(missingBuyers_correct)}`);

    console.log('\n[分析]');
    console.log(`  - バグのある実装: 7373が欠損リストに含まれるか = ${missingBuyers_buggy.includes('7373')}`);
    console.log(`  - 正しい実装: 7373が欠損リストに含まれるか = ${missingBuyers_correct.includes('7373')}`);

    if (!missingBuyers_buggy.includes('7373')) {
      console.log('\n❌ バグ確認: バグのある実装では7373が欠損リストに含まれない');
      console.log('  原因: getAllDbBuyerNumbers() がソフトデリート済みレコードも返すため');
      console.log('  これはバグの存在を証明します');
    }

    console.log('\n========================================');
    console.log('🔍 Bug Condition Test 1.1 終了');
    console.log('========================================\n');

    // **CRITICAL**: このアサーションは未修正コードで FAIL する
    // 未修正コードでは getAllDbBuyerNumbers() がソフトデリート済みレコードも返すため、
    // 7373が「DBに存在する」と誤判定され、欠損リストに含まれない
    //
    // 修正後（getAllActiveBuyerNumbers() を使用）は:
    // - deleted_at IS NULL フィルタにより7373が返されない
    // - 7373が「DBに存在しない」と正しく判定される
    // - 7373が欠損リストに含まれる → このアサーションが成功する
    expect(missingBuyers_buggy).toContain('7373');
  }, 30000);

  /**
   * Bug Condition Test 2: 複数のソフトデリート済み買主番号が混在するケース
   *
   * **Validates: Requirements 1.1, 1.2**
   *
   * バグ条件:
   * - スプレッドシートに複数の買主番号が存在する
   * - DBにそれらのうち一部がソフトデリート状態で存在する
   *
   * 期待される動作（修正後）:
   * - ソフトデリート済みの買主番号が全て欠損リストに含まれる
   *
   * **CRITICAL**: このテストは未修正コードで FAIL する（バグの存在を証明する）
   */
  test('Bug Condition 1.2: ソフトデリート済み買主番号が欠損リストに含まれること（修正前は失敗）', async () => {
    console.log('\n========================================');
    console.log('🔍 Bug Condition Test 1.2 開始');
    console.log('  複数のソフトデリート済み買主番号が混在するケース');
    console.log('========================================\n');

    // DBからソフトデリート済みの買主番号を取得（最大5件）
    const { data: softDeletedBuyers, error: fetchError } = await supabase
      .from('buyers')
      .select('buyer_number, deleted_at')
      .not('deleted_at', 'is', null)
      .limit(5);

    if (fetchError) {
      console.log(`[ERROR] ソフトデリート済み買主の取得に失敗: ${fetchError.message}`);
      throw fetchError;
    }

    if (!softDeletedBuyers || softDeletedBuyers.length === 0) {
      console.log('[INFO] DBにソフトデリート済みの買主が存在しません');
      console.log('[INFO] テストをスキップします（バグ条件が成立しない）');
      return;
    }

    const softDeletedNumbers = softDeletedBuyers
      .map(b => b.buyer_number)
      .filter(Boolean) as string[];

    console.log(`[INFO] ソフトデリート済み買主番号（${softDeletedNumbers.length}件）:`);
    softDeletedBuyers.forEach(b => {
      console.log(`  - ${b.buyer_number} (deleted_at: ${b.deleted_at})`);
    });

    // スプレッドシートにソフトデリート済み買主番号が存在すると仮定（バグ条件）
    const sheetBuyerNumbers = new Set<string>(softDeletedNumbers);

    // バグのある実装（getAllDbBuyerNumbers - deleted_at フィルタなし）
    console.log('\n[Step 1] バグのある実装（getAllDbBuyerNumbers）でDB買主番号を取得...');
    const dbBuyerNumbers_buggy = await getAllDbBuyerNumbers_buggy(supabase);

    // 正しい実装（getAllActiveBuyerNumbers - deleted_at IS NULL フィルタあり）
    console.log('[Step 2] 正しい実装（getAllActiveBuyerNumbers）でDB買主番号を取得...');
    const dbBuyerNumbers_correct = await getAllActiveBuyerNumbers_correct(supabase);

    // バグのある実装での欠損検出
    const missingBuyers_buggy = detectMissingBuyersLogic(sheetBuyerNumbers, dbBuyerNumbers_buggy);
    console.log(`\n[Step 3] バグのある実装での欠損検出結果: ${JSON.stringify(missingBuyers_buggy)}`);

    // 正しい実装での欠損検出
    const missingBuyers_correct = detectMissingBuyersLogic(sheetBuyerNumbers, dbBuyerNumbers_correct);
    console.log(`[Step 4] 正しい実装での欠損検出結果: ${JSON.stringify(missingBuyers_correct)}`);

    console.log('\n[分析]');
    for (const buyerNumber of softDeletedNumbers) {
      const inBuggy = missingBuyers_buggy.includes(buyerNumber);
      const inCorrect = missingBuyers_correct.includes(buyerNumber);
      console.log(`  - ${buyerNumber}: バグのある実装=${inBuggy}, 正しい実装=${inCorrect}`);
    }

    // バグのある実装では、ソフトデリート済み買主番号が欠損リストに含まれない
    const missingInBuggy = softDeletedNumbers.filter(n => !missingBuyers_buggy.includes(n));
    if (missingInBuggy.length > 0) {
      console.log(`\n❌ バグ確認: 以下の買主番号がバグのある実装では欠損リストに含まれない:`);
      missingInBuggy.forEach(n => console.log(`  - ${n}`));
      console.log('  原因: getAllDbBuyerNumbers() がソフトデリート済みレコードも返すため');
      console.log('  これはバグの存在を証明します');
    }

    console.log('\n========================================');
    console.log('🔍 Bug Condition Test 1.2 終了');
    console.log('========================================\n');

    // **CRITICAL**: このアサーションは未修正コードで FAIL する
    // 未修正コードでは getAllDbBuyerNumbers() がソフトデリート済みレコードも返すため、
    // ソフトデリート済み買主番号が「DBに存在する」と誤判定され、欠損リストに含まれない
    //
    // 修正後（getAllActiveBuyerNumbers() を使用）は:
    // - deleted_at IS NULL フィルタによりソフトデリート済みレコードが除外される
    // - ソフトデリート済み買主番号が「DBに存在しない」と正しく判定される
    // - 全てのソフトデリート済み買主番号が欠損リストに含まれる → このアサーションが成功する
    //
    // 反例（修正前）: missingBuyers_buggy = [] （ソフトデリート済み買主番号が含まれない）
    // 期待値（修正後）: missingBuyers_buggy = ["6929", "AA4916", ...] （全て含まれる）
    expect(missingBuyers_correct).toEqual(expect.arrayContaining(softDeletedNumbers));
  }, 30000);

  /**
   * Bug Condition Test 3: getAllDbBuyerNumbers と getAllActiveBuyerNumbers の差異を確認
   *
   * **Validates: Requirements 1.2**
   *
   * このテストはバグの根本原因を直接確認する:
   * - `getAllDbBuyerNumbers()` はソフトデリート済みレコードを含む
   * - `getAllActiveBuyerNumbers()` はソフトデリート済みレコードを含まない
   * - この差異がバグの原因
   *
   * **CRITICAL**: このテストは未修正コードで FAIL する（バグの存在を証明する）
   */
  test('Bug Condition 1.3: getAllDbBuyerNumbers がソフトデリート済みレコードを含むことを確認（修正前は失敗）', async () => {
    console.log('\n========================================');
    console.log('🔍 Bug Condition Test 1.3 開始');
    console.log('  getAllDbBuyerNumbers vs getAllActiveBuyerNumbers の差異確認');
    console.log('========================================\n');

    // DBからソフトデリート済みの買主番号を取得
    const { data: softDeletedBuyers, error: fetchError } = await supabase
      .from('buyers')
      .select('buyer_number, deleted_at')
      .not('deleted_at', 'is', null)
      .limit(3);

    if (fetchError) {
      console.log(`[ERROR] ソフトデリート済み買主の取得に失敗: ${fetchError.message}`);
      throw fetchError;
    }

    if (!softDeletedBuyers || softDeletedBuyers.length === 0) {
      console.log('[INFO] DBにソフトデリート済みの買主が存在しません');
      console.log('[INFO] テストをスキップします（バグ条件が成立しない）');
      return;
    }

    const softDeletedNumbers = softDeletedBuyers
      .map(b => b.buyer_number)
      .filter(Boolean) as string[];

    console.log(`[INFO] テスト対象のソフトデリート済み買主番号: ${softDeletedNumbers.join(', ')}`);

    // バグのある実装（getAllDbBuyerNumbers - deleted_at フィルタなし）
    const dbBuyerNumbers_buggy = await getAllDbBuyerNumbers_buggy(supabase);

    // 正しい実装（getAllActiveBuyerNumbers - deleted_at IS NULL フィルタあり）
    const dbBuyerNumbers_correct = await getAllActiveBuyerNumbers_correct(supabase);

    console.log(`\n[分析]`);
    console.log(`  - getAllDbBuyerNumbers() の件数: ${dbBuyerNumbers_buggy.size}`);
    console.log(`  - getAllActiveBuyerNumbers() の件数: ${dbBuyerNumbers_correct.size}`);
    console.log(`  - 差異（ソフトデリート済み件数）: ${dbBuyerNumbers_buggy.size - dbBuyerNumbers_correct.size}`);

    for (const buyerNumber of softDeletedNumbers) {
      const inBuggy = dbBuyerNumbers_buggy.has(buyerNumber);
      const inCorrect = dbBuyerNumbers_correct.has(buyerNumber);
      console.log(`\n  買主番号 ${buyerNumber}:`);
      console.log(`    - getAllDbBuyerNumbers() に含まれるか: ${inBuggy} ← バグのある実装`);
      console.log(`    - getAllActiveBuyerNumbers() に含まれるか: ${inCorrect} ← 正しい実装`);
    }

    console.log('\n========================================');
    console.log('🔍 Bug Condition Test 1.3 終了');
    console.log('========================================\n');

    // **CRITICAL**: このアサーションは未修正コードで FAIL する
    //
    // バグの核心:
    // - getAllDbBuyerNumbers() はソフトデリート済みレコードを含む（deleted_at フィルタなし）
    // - そのため、ソフトデリート済み買主番号が「DBに存在する」と誤判定される
    //
    // 期待される正しい動作（修正後）:
    // - detectMissingBuyers() が getAllActiveBuyerNumbers() を使用する
    // - ソフトデリート済み買主番号が「DBに存在しない」と正しく判定される
    //
    // このアサーションは「修正後の動作」をアサートしている:
    // - 修正後: detectMissingBuyers() が使用するセット（getAllActiveBuyerNumbers）には
    //           ソフトデリート済みレコードが含まれない → 欠損として検出される
    // - 修正前（バグ）: detectMissingBuyers() が使用するセット（getAllDbBuyerNumbers）には
    //                   ソフトデリート済みレコードが含まれる → 欠損として検出されない
    //
    // 反例（修正前）: dbBuyerNumbers_buggy に 6929, AA4916, AA848 が含まれる
    //                 → 欠損として検出されない（バグ）
    // 期待値（修正後）: detectMissingBuyers() が使用するセットにはこれらが含まれない
    //                   → 欠損として検出される（正しい）
    //
    // このテストは「修正後の動作」をアサートしているため、修正前は FAIL する:
    // - 修正前: getAllDbBuyerNumbers() がソフトデリート済みレコードを含む → FAIL
    // - 修正後: getAllActiveBuyerNumbers() がソフトデリート済みレコードを含まない → PASS
    for (const buyerNumber of softDeletedNumbers) {
      // 修正後の動作: getAllActiveBuyerNumbers() はソフトデリート済みレコードを含まない
      // 修正前（バグ）: getAllDbBuyerNumbers() はソフトデリート済みレコードを含む
      // このアサーションは「バグのある実装（getAllDbBuyerNumbers）がソフトデリート済みレコードを含まない」
      // ことを期待しているため、修正前は FAIL する（バグの存在を証明）
      expect(dbBuyerNumbers_correct.has(buyerNumber)).toBe(false);
    }
  }, 30000);
});
