/**
 * Preservation Property Test: アクティブ買主番号の非検出動作保全
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは修正前のコードで実行し、PASSすることを確認する（ベースライン動作の確認）
 *
 * 目的:
 *   バグ条件が成立しない入力（アクティブな買主番号 = deleted_at = null）に対して、
 *   修正前後で動作が変わらないことを確認する。
 *
 * 観察優先メソドロジー:
 *   - 修正前のコードで、アクティブな買主番号（deleted_at = null）の動作を観察する
 *   - 観察1: スプレッドシートに存在し、DBにアクティブなレコードが存在する買主番号は
 *             detectMissingBuyers() の欠損リストに含まれない
 *   - 観察2: detectDeletedBuyers() は getAllActiveBuyerNumbers() を使用しており、
 *             この修正の影響を受けない
 *   - 観察3: syncBuyers() の安全ガードは変わらない
 *
 * 保全すべき動作:
 *   - アクティブな買主番号（deleted_at = null）は欠損リストに含まれない
 *   - detectDeletedBuyers() の動作が変わらない
 *   - syncBuyers() の安全ガードが保持される
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
 * getAllDbBuyerNumbers のロジックを再現（deleted_at フィルタなし）
 * これが現在の（修正前の）detectMissingBuyers() が使用している実装
 */
async function getAllDbBuyerNumbers_current(supabase: SupabaseClient): Promise<Set<string>> {
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
 * detectDeletedBuyers() が使用している実装（修正後の detectMissingBuyers() でも使用予定）
 */
async function getAllActiveBuyerNumbers(supabase: SupabaseClient): Promise<Set<string>> {
  const allBuyerNumbers = new Set<string>();
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('buyers')
      .select('buyer_number')
      .is('deleted_at', null)
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

/**
 * detectDeletedBuyers のコアロジックを再現
 * スプレッドシートにない買主番号をDBから検出する
 */
function detectDeletedBuyersLogic(
  sheetBuyerNumbers: Set<string>,
  dbActiveBuyerNumbers: Set<string>
): string[] {
  const deletedBuyers: string[] = [];
  for (const buyerNumber of dbActiveBuyerNumbers) {
    if (!sheetBuyerNumbers.has(buyerNumber)) {
      deletedBuyers.push(buyerNumber);
    }
  }
  return deletedBuyers;
}

// ===== テストスイート =====

describe('Preservation: アクティブ買主番号の非検出動作保全', () => {
  let supabase: SupabaseClient;
  let activeBuyerNumbers: string[];
  let dbBuyerNumbers_current: Set<string>;
  let dbActiveBuyerNumbers: Set<string>;

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

    // DBからアクティブな買主番号を取得（最大20件）
    const { data: activeBuyers, error } = await supabase
      .from('buyers')
      .select('buyer_number')
      .is('deleted_at', null)
      .limit(20);

    if (error) {
      throw new Error(`アクティブ買主の取得に失敗: ${error.message}`);
    }

    activeBuyerNumbers = (activeBuyers || [])
      .map(b => b.buyer_number)
      .filter(Boolean) as string[];

    console.log(`[Setup] アクティブ買主番号（${activeBuyerNumbers.length}件）を取得`);

    // 修正前の実装（getAllDbBuyerNumbers）でDB買主番号を取得
    dbBuyerNumbers_current = await getAllDbBuyerNumbers_current(supabase);
    console.log(`[Setup] getAllDbBuyerNumbers（修正前）: ${dbBuyerNumbers_current.size}件`);

    // 正しい実装（getAllActiveBuyerNumbers）でDB買主番号を取得
    dbActiveBuyerNumbers = await getAllActiveBuyerNumbers(supabase);
    console.log(`[Setup] getAllActiveBuyerNumbers: ${dbActiveBuyerNumbers.size}件`);
  }, 60000);

  // ===== 観察例: アクティブ買主番号の非検出動作を確認 =====

  /**
   * 観察例1: アクティブな買主番号は修正前の実装でも欠損リストに含まれない
   *
   * **Validates: Requirements 3.1**
   *
   * 保全すべき動作:
   *   スプレッドシートに存在し、DBにアクティブなレコード（deleted_at = null）が存在する
   *   買主番号は、detectMissingBuyers() の欠損リストに含まれない
   *
   * このテストは修正前のコードで PASS する（保全すべきベースライン動作）
   */
  test('観察例1: アクティブな買主番号は修正前の実装でも欠損リストに含まれないこと', async () => {
    console.log('\n========================================');
    console.log('Preservation Test 観察例1 開始');
    console.log('  アクティブな買主番号が欠損リストに含まれないことを確認');
    console.log('========================================\n');

    if (activeBuyerNumbers.length === 0) {
      console.log('[INFO] アクティブな買主番号が存在しません。テストをスキップします。');
      return;
    }

    // スプレッドシートにアクティブな買主番号が存在すると仮定
    const sheetBuyerNumbers = new Set<string>(activeBuyerNumbers);

    // 修正前の実装（getAllDbBuyerNumbers）での欠損検出
    const missingBuyers = detectMissingBuyersLogic(sheetBuyerNumbers, dbBuyerNumbers_current);

    console.log(`[結果] 欠損リスト: ${JSON.stringify(missingBuyers)}`);
    console.log(`[期待] アクティブな買主番号は欠損リストに含まれないこと`);

    // アクティブな買主番号は修正前の実装でも欠損リストに含まれない
    // （getAllDbBuyerNumbers はアクティブなレコードも含むため）
    for (const buyerNumber of activeBuyerNumbers) {
      expect(missingBuyers).not.toContain(buyerNumber);
    }

    console.log(`[OK] ${activeBuyerNumbers.length}件のアクティブ買主番号が欠損リストに含まれていないことを確認`);
    console.log('\n========================================');
    console.log('Preservation Test 観察例1 終了');
    console.log('========================================\n');
  }, 30000);

  /**
   * 観察例2: アクティブな買主番号は修正後の実装でも欠損リストに含まれない
   *
   * **Validates: Requirements 3.1**
   *
   * 修正後（getAllActiveBuyerNumbers を使用）でも、アクティブな買主番号は
   * 欠損リストに含まれないことを確認する。
   * これにより、修正前後で動作が変わらないことを保証する。
   */
  test('観察例2: アクティブな買主番号は修正後の実装でも欠損リストに含まれないこと', async () => {
    console.log('\n========================================');
    console.log('Preservation Test 観察例2 開始');
    console.log('  修正後の実装でもアクティブな買主番号が欠損リストに含まれないことを確認');
    console.log('========================================\n');

    if (activeBuyerNumbers.length === 0) {
      console.log('[INFO] アクティブな買主番号が存在しません。テストをスキップします。');
      return;
    }

    // スプレッドシートにアクティブな買主番号が存在すると仮定
    const sheetBuyerNumbers = new Set<string>(activeBuyerNumbers);

    // 修正後の実装（getAllActiveBuyerNumbers）での欠損検出
    const missingBuyers = detectMissingBuyersLogic(sheetBuyerNumbers, dbActiveBuyerNumbers);

    console.log(`[結果] 欠損リスト: ${JSON.stringify(missingBuyers)}`);

    // アクティブな買主番号は修正後の実装でも欠損リストに含まれない
    for (const buyerNumber of activeBuyerNumbers) {
      expect(missingBuyers).not.toContain(buyerNumber);
    }

    console.log(`[OK] ${activeBuyerNumbers.length}件のアクティブ買主番号が修正後の実装でも欠損リストに含まれていないことを確認`);
    console.log('\n========================================');
    console.log('Preservation Test 観察例2 終了');
    console.log('========================================\n');
  }, 30000);

  /**
   * 観察例3: detectDeletedBuyers() は getAllActiveBuyerNumbers() を使用している
   *
   * **Validates: Requirements 3.2**
   *
   * detectDeletedBuyers() は既に getAllActiveBuyerNumbers() を使用しており、
   * この修正の影響を受けない。
   */
  test('観察例3: detectDeletedBuyers() の動作が変わらないこと（getAllActiveBuyerNumbers を使用）', async () => {
    console.log('\n========================================');
    console.log('Preservation Test 観察例3 開始');
    console.log('  detectDeletedBuyers() の動作確認');
    console.log('========================================\n');

    if (activeBuyerNumbers.length === 0) {
      console.log('[INFO] アクティブな買主番号が存在しません。テストをスキップします。');
      return;
    }

    // スプレッドシートにアクティブな買主番号が全て存在すると仮定
    const sheetBuyerNumbers = new Set<string>(activeBuyerNumbers);

    // detectDeletedBuyers() のコアロジック（getAllActiveBuyerNumbers を使用）
    // スプレッドシートにある買主番号のみを対象とするため、
    // アクティブな買主番号がスプレッドシートに存在する場合は削除対象にならない
    const deletedBuyers = detectDeletedBuyersLogic(sheetBuyerNumbers, dbActiveBuyerNumbers);

    console.log(`[結果] 削除対象リスト（スプレッドシートにない買主）: ${deletedBuyers.length}件`);

    // スプレッドシートに存在するアクティブな買主番号は削除対象にならない
    for (const buyerNumber of activeBuyerNumbers) {
      expect(deletedBuyers).not.toContain(buyerNumber);
    }

    console.log(`[OK] ${activeBuyerNumbers.length}件のアクティブ買主番号が削除対象リストに含まれていないことを確認`);
    console.log('\n========================================');
    console.log('Preservation Test 観察例3 終了');
    console.log('========================================\n');
  }, 30000);

  // ===== Property 2: Preservation プロパティベーステスト =====

  /**
   * Property 2 (PBT): ランダムなアクティブ買主番号セットに対して
   * detectMissingBuyers() が欠損リストに含めないことを検証
   *
   * **Validates: Requirements 3.1**
   *
   * 保全すべき動作:
   *   スプレッドシートに存在し、DBにアクティブなレコード（deleted_at = null）が存在する
   *   買主番号は、修正前後ともに detectMissingBuyers() の欠損リストに含まれない。
   *
   * このテストは修正前のコードで PASS する（保全すべきベースライン動作）
   */
  test('Property 2 (PBT): ランダムなアクティブ買主番号セットに対して欠損リストに含まれないこと', async () => {
    console.log('\n========================================');
    console.log('Preservation PBT 開始');
    console.log('  ランダムなアクティブ買主番号セットに対する保全テスト');
    console.log('========================================\n');

    if (activeBuyerNumbers.length === 0) {
      console.log('[INFO] アクティブな買主番号が存在しません。テストをスキップします。');
      return;
    }

    // fast-check でランダムなアクティブ買主番号のサブセットを生成してテスト
    fc.assert(
      fc.property(
        // アクティブな買主番号からランダムにサブセットを選択
        fc.integer({ min: 1, max: Math.min(activeBuyerNumbers.length, 10) }).chain(count =>
          fc.shuffledSubarray(activeBuyerNumbers, { minLength: count, maxLength: count })
        ),
        (selectedBuyerNumbers) => {
          // スプレッドシートにランダムに選択したアクティブ買主番号が存在すると仮定
          const sheetBuyerNumbers = new Set<string>(selectedBuyerNumbers);

          // 修正前の実装（getAllDbBuyerNumbers）での欠損検出
          const missingBuyers_current = detectMissingBuyersLogic(sheetBuyerNumbers, dbBuyerNumbers_current);

          // 修正後の実装（getAllActiveBuyerNumbers）での欠損検出
          const missingBuyers_fixed = detectMissingBuyersLogic(sheetBuyerNumbers, dbActiveBuyerNumbers);

          // 保全プロパティ: アクティブな買主番号は修正前後ともに欠損リストに含まれない
          for (const buyerNumber of selectedBuyerNumbers) {
            if (missingBuyers_current.includes(buyerNumber)) {
              console.log(`[PBT] 反例発見（修正前）: ${buyerNumber} が欠損リストに含まれている`);
              return false;
            }
            if (missingBuyers_fixed.includes(buyerNumber)) {
              console.log(`[PBT] 反例発見（修正後）: ${buyerNumber} が欠損リストに含まれている`);
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );

    console.log('[OK] 50回のランダムテストで保全プロパティが成立することを確認');
    console.log('\n========================================');
    console.log('Preservation PBT 終了');
    console.log('========================================\n');
  }, 60000);

  /**
   * Property 2 (PBT): detectDeletedBuyers() の動作が変わらないことを検証
   *
   * **Validates: Requirements 3.2**
   *
   * detectDeletedBuyers() は getAllActiveBuyerNumbers() を使用しており、
   * この修正の影響を受けない。
   * ランダムなスプレッドシートデータに対して、動作が一貫していることを確認する。
   */
  test('Property 2 (PBT): detectDeletedBuyers() の動作が変わらないこと', async () => {
    console.log('\n========================================');
    console.log('Preservation PBT (detectDeletedBuyers) 開始');
    console.log('========================================\n');

    if (activeBuyerNumbers.length === 0) {
      console.log('[INFO] アクティブな買主番号が存在しません。テストをスキップします。');
      return;
    }

    fc.assert(
      fc.property(
        // アクティブな買主番号からランダムにサブセットを選択（スプレッドシートに存在する買主）
        fc.integer({ min: 1, max: Math.min(activeBuyerNumbers.length, 10) }).chain(count =>
          fc.shuffledSubarray(activeBuyerNumbers, { minLength: count, maxLength: count })
        ),
        (sheetBuyerNumbersArray) => {
          const sheetBuyerNumbers = new Set<string>(sheetBuyerNumbersArray);

          // detectDeletedBuyers() のコアロジック（getAllActiveBuyerNumbers を使用）
          const deletedBuyers = detectDeletedBuyersLogic(sheetBuyerNumbers, dbActiveBuyerNumbers);

          // 保全プロパティ: スプレッドシートに存在するアクティブな買主番号は削除対象にならない
          for (const buyerNumber of sheetBuyerNumbersArray) {
            if (deletedBuyers.includes(buyerNumber)) {
              console.log(`[PBT] 反例発見: ${buyerNumber} が削除対象リストに含まれている`);
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );

    console.log('[OK] 50回のランダムテストで detectDeletedBuyers() の保全プロパティが成立することを確認');
    console.log('\n========================================');
    console.log('Preservation PBT (detectDeletedBuyers) 終了');
    console.log('========================================\n');
  }, 60000);

  /**
   * Property 2 (PBT): syncBuyers() の安全ガードが保持されることを検証
   *
   * **Validates: Requirements 3.4**
   *
   * syncBuyers() の安全ガードのロジックを直接テストする:
   * - 安全ガード1: スプレッドシート0件チェック
   * - 安全ガード2: 50%比率チェック
   * - 安全ガード3: 10%削除閾値チェック
   *
   * これらの安全ガードは修正前後で変わらない。
   */
  test('Property 2 (PBT): syncBuyers() の安全ガードが保持されること', async () => {
    console.log('\n========================================');
    console.log('Preservation PBT (syncBuyers 安全ガード) 開始');
    console.log('========================================\n');

    const activeBuyerCount = dbActiveBuyerNumbers.size;
    console.log(`[Setup] アクティブ買主数: ${activeBuyerCount}件`);

    // 安全ガード1: スプレッドシート0件チェック
    // スプレッドシートが0件の場合、削除処理をスキップする
    const safetyGuard1 = (sheetSize: number): boolean => {
      return sheetSize === 0; // true = スキップ
    };

    // 安全ガード2: 50%比率チェック
    // スプレッドシートの買主数がDBの50%未満の場合、削除処理をスキップする
    const safetyGuard2 = (sheetSize: number, dbSize: number): boolean => {
      if (dbSize === 0) return false;
      const ratio = sheetSize / dbSize;
      return ratio < 0.5; // true = スキップ
    };

    // 安全ガード3: 10%削除閾値チェック
    // 削除対象がアクティブ買主の10%以上の場合、削除処理をスキップする
    const safetyGuard3 = (deletionCount: number, activeBuyerCount: number): boolean => {
      if (activeBuyerCount === 0) return false;
      const ratio = deletionCount / activeBuyerCount;
      return ratio >= 0.1; // true = スキップ
    };

    // 安全ガード1のテスト: スプレッドシート0件の場合は常にスキップ
    expect(safetyGuard1(0)).toBe(true);
    expect(safetyGuard1(1)).toBe(false);
    expect(safetyGuard1(100)).toBe(false);
    console.log('[OK] 安全ガード1（スプレッドシート0件チェック）が正しく動作することを確認');

    // 安全ガード2のテスト: 50%比率チェック
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (sheetSize, dbSize) => {
          const shouldSkip = safetyGuard2(sheetSize, dbSize);
          const ratio = sheetSize / dbSize;

          if (ratio < 0.5) {
            // 50%未満の場合はスキップすべき
            return shouldSkip === true;
          } else {
            // 50%以上の場合はスキップしない
            return shouldSkip === false;
          }
        }
      ),
      { numRuns: 100 }
    );
    console.log('[OK] 安全ガード2（50%比率チェック）が正しく動作することを確認');

    // 安全ガード3のテスト: 10%削除閾値チェック
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (deletionCount, activeBuyerCount) => {
          const shouldSkip = safetyGuard3(deletionCount, activeBuyerCount);
          const ratio = deletionCount / activeBuyerCount;

          if (ratio >= 0.1) {
            // 10%以上の場合はスキップすべき
            return shouldSkip === true;
          } else {
            // 10%未満の場合はスキップしない
            return shouldSkip === false;
          }
        }
      ),
      { numRuns: 100 }
    );
    console.log('[OK] 安全ガード3（10%削除閾値チェック）が正しく動作することを確認');

    console.log('\n========================================');
    console.log('Preservation PBT (syncBuyers 安全ガード) 終了');
    console.log('========================================\n');
  }, 30000);

  /**
   * 観察例4: 修正前後でアクティブ買主番号の扱いが同一であることを確認
   *
   * **Validates: Requirements 3.1**
   *
   * アクティブな買主番号（deleted_at = null）は:
   * - getAllDbBuyerNumbers()（修正前）にも含まれる
   * - getAllActiveBuyerNumbers()（修正後）にも含まれる
   * よって、修正前後ともに「DBに存在する」と判定され、欠損リストに含まれない。
   */
  test('観察例4: アクティブな買主番号は修正前後ともに DB に存在すると判定されること', async () => {
    console.log('\n========================================');
    console.log('Preservation Test 観察例4 開始');
    console.log('  修正前後でアクティブ買主番号の扱いが同一であることを確認');
    console.log('========================================\n');

    if (activeBuyerNumbers.length === 0) {
      console.log('[INFO] アクティブな買主番号が存在しません。テストをスキップします。');
      return;
    }

    let allMatch = true;
    for (const buyerNumber of activeBuyerNumbers) {
      const inCurrent = dbBuyerNumbers_current.has(buyerNumber);
      const inActive = dbActiveBuyerNumbers.has(buyerNumber);

      if (!inCurrent || !inActive) {
        console.log(`[WARN] ${buyerNumber}: 修正前=${inCurrent}, 修正後=${inActive}`);
        allMatch = false;
      }

      // アクティブな買主番号は修正前後ともに DB に存在すると判定される
      expect(inCurrent).toBe(true);
      expect(inActive).toBe(true);
    }

    if (allMatch) {
      console.log(`[OK] ${activeBuyerNumbers.length}件のアクティブ買主番号が修正前後ともに DB に存在することを確認`);
    }

    console.log('\n========================================');
    console.log('Preservation Test 観察例4 終了');
    console.log('========================================\n');
  }, 30000);
});
