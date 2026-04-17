/**
 * Bug Condition探索テスト: BuyerService.updateWithSync() の property_listings クエリに
 * CH〜CN列対応7フィールドが含まれないバグ
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
 *
 * このテストは未修正コードで FAIL することが期待される（FAIL = バグの存在を証明）
 *
 * バグ条件:
 *   X.property_number != null AND X.property_number != ''
 *
 * 根本原因:
 *   backend/src/services/BuyerService.ts の updateWithSync() メソッド内で
 *   property_listings テーブルから取得するフィールドが
 *   'address, display_address, price, sales_assignee' の4フィールドのみであり、
 *   CH〜CN列に対応する以下7フィールドが欠落している:
 *     - pre_viewing_notes  (CH列: 内覧前伝達事項)
 *     - key_info           (CI列: 鍵等)
 *     - sale_reason        (CJ列: 売却理由)
 *     - price_reduction_history (CK列: 値下げ履歴)
 *     - viewing_notes      (CL列: 内覧の時の伝達事項)
 *     - parking            (CM列: 駐車場)
 *     - viewing_parking    (CN列: 内覧時駐車場)
 *
 * 期待される動作（修正後）:
 *   select() クエリに7フィールドが含まれ、allowedData に追加されること
 */

import * as fs from 'fs';
import * as path from 'path';

// 確認対象ファイルのパス
const BUYER_SERVICE_PATH = path.resolve(__dirname, '../services/BuyerService.ts');

// バグ条件: property_number が非null・非空文字の場合に発現する7フィールド
const REQUIRED_FIELDS = [
  'pre_viewing_notes',
  'key_info',
  'sale_reason',
  'price_reduction_history',
  'viewing_notes',
  'parking',
  'viewing_parking',
] as const;

/**
 * BuyerService.ts のソースコードを読み込む
 */
function readBuyerServiceSource(): string {
  return fs.readFileSync(BUYER_SERVICE_PATH, 'utf-8');
}

/**
 * updateWithSync() メソッドのブロックを抽出する
 * （property_number チェック以降の property_listings クエリ部分）
 */
function extractUpdateWithSyncBlock(source: string): string {
  // updateWithSync メソッドの開始位置を検索
  const methodStart = source.indexOf('async updateWithSync(');
  if (methodStart === -1) {
    throw new Error('updateWithSync メソッドが見つかりません');
  }

  // メソッド開始から2000文字を抽出（property_listingsクエリを含む範囲）
  return source.slice(methodStart, methodStart + 3000);
}

/**
 * updateWithSync() 内の property_listings select() クエリ文字列を抽出する
 */
function extractPropertyListingsSelectQuery(source: string): string | null {
  const updateWithSyncBlock = extractUpdateWithSyncBlock(source);

  // property_number チェック後の property_listings クエリを検索
  // バグ条件: property_number != null AND property_number != '' の場合に実行されるクエリ
  const selectMatch = updateWithSyncBlock.match(
    /\.from\('property_listings'\)\s*\n?\s*\.select\('([^']+)'\)/
  );

  if (!selectMatch) {
    return null;
  }

  return selectMatch[1];
}

/**
 * allowedData への7フィールド追加コードが存在するか確認する
 */
function checkAllowedDataAssignments(source: string): Record<string, boolean> {
  const updateWithSyncBlock = extractUpdateWithSyncBlock(source);

  const result: Record<string, boolean> = {};
  for (const field of REQUIRED_FIELDS) {
    // allowedData.{field} = propertyListing.{field} のパターンを検索
    const pattern = new RegExp(`allowedData\\.${field}\\s*=\\s*propertyListing\\.${field}`);
    result[field] = pattern.test(updateWithSyncBlock);
  }

  return result;
}

// ============================================================
// テスト本体
// ============================================================

describe('Bug Condition探索: BuyerService.updateWithSync() の property_listings select() に7フィールドが含まれないバグ', () => {
  let source: string;

  beforeAll(() => {
    source = readBuyerServiceSource();
  });

  /**
   * Property 1: Bug Condition - select() クエリに7フィールドが含まれること
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
   *
   * 未修正コードでは select() に7フィールドが含まれないため、このテストは FAIL する。
   * FAIL = バグの存在を証明する。
   * 修正後は PASS する（バグが修正されたことを確認）。
   */
  describe('Property 1: select() クエリに7フィールドが含まれること', () => {
    let selectQuery: string | null;

    beforeAll(() => {
      selectQuery = extractPropertyListingsSelectQuery(source);
    });

    it('updateWithSync() 内に property_listings の select() クエリが存在すること', () => {
      console.log('\n========================================');
      console.log('🔍 Bug Condition探索テスト開始');
      console.log('========================================\n');
      console.log(`📄 確認対象ファイル: ${BUYER_SERVICE_PATH}`);
      console.log(`📋 select() クエリ: ${selectQuery ?? '(見つかりません)'}`);

      expect(selectQuery).not.toBeNull();
    });

    for (const field of REQUIRED_FIELDS) {
      it(`select() クエリに "${field}" が含まれること（未修正コードで FAIL 期待）`, () => {
        if (!selectQuery) {
          throw new Error('select() クエリが見つかりません');
        }

        const fields = selectQuery.split(',').map(f => f.trim());
        const hasField = fields.includes(field);

        console.log(`\n📊 フィールド確認: "${field}"`);
        console.log(`  - select() クエリ: "${selectQuery}"`);
        console.log(`  - "${field}" が含まれるか: ${hasField}`);

        if (!hasField) {
          console.log(`  ❌ バグ確認: "${field}" が select() クエリに含まれていません`);
          console.log(`     → スプレッドシートのCH〜CN列に値が反映されません`);
        } else {
          console.log(`  ✅ 修正確認: "${field}" が select() クエリに含まれています`);
        }

        // 未修正コードではこのアサーションが失敗する（バグの存在を証明）
        expect(hasField).toBe(true);
      });
    }
  });

  /**
   * Property 1 (allowedData): allowedData への7フィールド追加コードが存在すること
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
   *
   * 未修正コードでは allowedData への追加コードが存在しないため、このテストは FAIL する。
   */
  describe('Property 1 (allowedData): allowedData への7フィールド追加コードが存在すること', () => {
    let assignments: Record<string, boolean>;

    beforeAll(() => {
      assignments = checkAllowedDataAssignments(source);
    });

    for (const field of REQUIRED_FIELDS) {
      it(`allowedData.${field} = propertyListing.${field} の代入コードが存在すること（未修正コードで FAIL 期待）`, () => {
        const hasAssignment = assignments[field];

        console.log(`\n📊 allowedData 代入確認: "${field}"`);
        console.log(`  - allowedData.${field} = propertyListing.${field} が存在するか: ${hasAssignment}`);

        if (!hasAssignment) {
          console.log(`  ❌ バグ確認: allowedData.${field} への代入コードが存在しません`);
          console.log(`     → property_listings から取得しても allowedData に追加されません`);
        } else {
          console.log(`  ✅ 修正確認: allowedData.${field} への代入コードが存在します`);
        }

        // 未修正コードではこのアサーションが失敗する（バグの存在を証明）
        expect(hasAssignment).toBe(true);
      });
    }
  });

  /**
   * Property 1 (統合): バグ条件の全体確認
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
   *
   * select() クエリと allowedData 代入の両方が揃っていることを確認する。
   * 未修正コードでは両方とも欠落しているため、このテストは FAIL する。
   */
  it('Property 1 (統合): select() クエリと allowedData 代入の両方に7フィールドが含まれること（未修正コードで FAIL 期待）', () => {
    console.log('\n========================================');
    console.log('🔍 統合バグ条件確認テスト');
    console.log('========================================\n');

    const selectQuery = extractPropertyListingsSelectQuery(source);
    const assignments = checkAllowedDataAssignments(source);

    console.log(`📋 select() クエリ: ${selectQuery ?? '(見つかりません)'}`);
    console.log('\n📊 フィールド別確認結果:');

    const results: Array<{ field: string; inSelect: boolean; inAllowedData: boolean }> = [];

    for (const field of REQUIRED_FIELDS) {
      const inSelect = selectQuery
        ? selectQuery.split(',').map(f => f.trim()).includes(field)
        : false;
      const inAllowedData = assignments[field] ?? false;

      results.push({ field, inSelect, inAllowedData });

      const status = inSelect && inAllowedData ? '✅' : '❌';
      console.log(`  ${status} ${field}:`);
      console.log(`     - select() に含まれる: ${inSelect}`);
      console.log(`     - allowedData 代入あり: ${inAllowedData}`);
    }

    const missingFields = results.filter(r => !r.inSelect || !r.inAllowedData);

    if (missingFields.length > 0) {
      console.log('\n❌ バグ確認: 以下のフィールドが欠落しています:');
      missingFields.forEach(r => {
        if (!r.inSelect) {
          console.log(`  - "${r.field}": select() クエリに含まれていません`);
        }
        if (!r.inAllowedData) {
          console.log(`  - "${r.field}": allowedData への代入コードが存在しません`);
        }
      });
      console.log('\n  → これらのフィールドはスプレッドシートのCH〜CN列に反映されません');
      console.log('  → これがバグの存在を証明するカウンターエグザンプルです');
    } else {
      console.log('\n✅ 修正確認: 全7フィールドが select() と allowedData の両方に含まれています');
    }

    console.log('\n========================================');
    console.log('🔍 統合バグ条件確認テスト終了');
    console.log('========================================\n');

    // 未修正コードではこのアサーションが失敗する（バグの存在を証明）
    for (const result of results) {
      expect(result.inSelect).toBe(true);
      expect(result.inAllowedData).toBe(true);
    }
  });
});
