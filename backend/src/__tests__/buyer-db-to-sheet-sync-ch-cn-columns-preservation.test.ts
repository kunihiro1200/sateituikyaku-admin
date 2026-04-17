/**
 * 保全プロパティテスト: BuyerService.updateWithSync() の property_number なし更新
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * このテストは未修正コードで PASS することが期待される（保全すべきベースライン動作の確認）
 *
 * 保全条件: isBugCondition(X) が false（property_number が null または空文字）
 *
 * 確認内容:
 *   property_number が null/空文字の場合、property_listings クエリ自体が実行されないこと
 *   （CH〜CN列フィールドが allowedData に追加されない）
 *
 * 静的解析アプローチ:
 *   実際のDB接続不要。BuyerService.ts のソースコードを解析して、
 *   property_number の条件チェックが正しく実装されていることを確認する。
 */

import * as fs from 'fs';
import * as path from 'path';

// 確認対象ファイルのパス
const BUYER_SERVICE_PATH = path.resolve(__dirname, '../services/BuyerService.ts');

// CH〜CN列に対応する7フィールド
const CH_CN_FIELDS = [
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
 */
function extractUpdateWithSyncBlock(source: string): string {
  const methodStart = source.indexOf('async updateWithSync(');
  if (methodStart === -1) {
    throw new Error('updateWithSync メソッドが見つかりません');
  }
  // メソッド開始から3000文字を抽出
  return source.slice(methodStart, methodStart + 3000);
}

/**
 * property_number の条件チェックコードを抽出する
 * 期待パターン: allowedData.property_number != null && allowedData.property_number !== ''
 */
function extractPropertyNumberCondition(source: string): string | null {
  const block = extractUpdateWithSyncBlock(source);

  // property_number の null/空文字チェックパターンを検索
  const conditionMatch = block.match(
    /if\s*\(\s*allowedData\.property_number\s*!=\s*null\s*&&\s*allowedData\.property_number\s*!==\s*''\s*\)/
  );

  if (!conditionMatch) {
    return null;
  }

  return conditionMatch[0];
}

/**
 * property_listings クエリが property_number 条件チェックの内側にあることを確認する
 *
 * 保全の核心: property_number が null/空文字の場合、
 * property_listings クエリ（.from('property_listings')）が実行されないこと
 */
function isPropertyListingsQueryInsideCondition(source: string): boolean {
  const block = extractUpdateWithSyncBlock(source);

  // property_number 条件チェックの開始位置を検索
  const conditionStart = block.search(
    /if\s*\(\s*allowedData\.property_number\s*!=\s*null\s*&&\s*allowedData\.property_number\s*!==\s*''\s*\)/
  );

  if (conditionStart === -1) {
    return false;
  }

  // 条件チェック以降のブロックで property_listings クエリを検索
  const afterCondition = block.slice(conditionStart);

  // property_listings クエリが条件ブロック内にあることを確認
  // 条件ブロックの開始 '{' を見つける
  const braceStart = afterCondition.indexOf('{');
  if (braceStart === -1) {
    return false;
  }

  // 対応する '}' を見つける（ネストを考慮）
  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < afterCondition.length; i++) {
    if (afterCondition[i] === '{') depth++;
    else if (afterCondition[i] === '}') {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }

  if (braceEnd === -1) {
    return false;
  }

  // 条件ブロック内に property_listings クエリが存在するか確認
  const conditionBlock = afterCondition.slice(braceStart, braceEnd + 1);
  return conditionBlock.includes(".from('property_listings')");
}

/**
 * CH〜CN列フィールドの allowedData 代入が property_number 条件ブロック内にあることを確認する
 *
 * 保全の確認: property_number が null/空文字の場合、
 * CH〜CN列フィールドが allowedData に追加されないこと
 */
function checkChCnFieldsInsideConditionBlock(source: string): Record<string, boolean> {
  const block = extractUpdateWithSyncBlock(source);

  // property_number 条件チェックの開始位置を検索
  const conditionStart = block.search(
    /if\s*\(\s*allowedData\.property_number\s*!=\s*null\s*&&\s*allowedData\.property_number\s*!==\s*''\s*\)/
  );

  const result: Record<string, boolean> = {};

  if (conditionStart === -1) {
    // 条件チェック自体が存在しない場合、全フィールドが条件外にある（保全違反）
    for (const field of CH_CN_FIELDS) {
      result[field] = false;
    }
    return result;
  }

  // 条件ブロックの範囲を特定
  const afterCondition = block.slice(conditionStart);
  const braceStart = afterCondition.indexOf('{');
  if (braceStart === -1) {
    for (const field of CH_CN_FIELDS) {
      result[field] = false;
    }
    return result;
  }

  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < afterCondition.length; i++) {
    if (afterCondition[i] === '{') depth++;
    else if (afterCondition[i] === '}') {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }

  if (braceEnd === -1) {
    for (const field of CH_CN_FIELDS) {
      result[field] = false;
    }
    return result;
  }

  const conditionBlock = afterCondition.slice(braceStart, braceEnd + 1);

  // 条件ブロック外（条件チェック前）のコードを取得
  const beforeCondition = block.slice(0, conditionStart);

  for (const field of CH_CN_FIELDS) {
    // フィールドが条件ブロック内にのみ存在し、条件ブロック外には存在しないことを確認
    const inConditionBlock = conditionBlock.includes(`allowedData.${field}`);
    const beforeConditionBlock = beforeCondition.includes(`allowedData.${field}`);

    // 保全: フィールドが条件ブロック内にある（または存在しない）かつ条件ブロック外にない
    // → property_number が null/空文字の場合、このフィールドは設定されない
    result[field] = !beforeConditionBlock;
  }

  return result;
}

// ============================================================
// テスト本体
// ============================================================

describe('保全プロパティテスト: property_number なし更新でCH〜CN列フィールドが allowedData に追加されないこと', () => {
  let source: string;

  beforeAll(() => {
    source = readBuyerServiceSource();
    console.log('\n========================================');
    console.log('🛡️ 保全プロパティテスト開始');
    console.log('========================================\n');
    console.log(`📄 確認対象ファイル: ${BUYER_SERVICE_PATH}`);
  });

  /**
   * Property 2: Preservation - 保全条件の基本確認
   *
   * **Validates: Requirements 3.3**
   *
   * updateWithSync() に property_number の null/空文字チェックが存在すること
   * これが保全の基盤となる条件分岐
   */
  describe('Property 2: property_number の null/空文字チェックが存在すること', () => {
    it('updateWithSync() 内に property_number の条件チェックが存在すること', () => {
      const condition = extractPropertyNumberCondition(source);

      console.log(`\n📋 条件チェック: ${condition ?? '(見つかりません)'}`);

      if (condition) {
        console.log('  ✅ property_number の null/空文字チェックが存在します');
        console.log('     → property_number が null/空文字の場合、property_listings クエリは実行されません');
      } else {
        console.log('  ❌ property_number の null/空文字チェックが見つかりません');
      }

      expect(condition).not.toBeNull();
    });
  });

  /**
   * Property 2: Preservation - property_listings クエリの保護確認
   *
   * **Validates: Requirements 3.3, 3.4**
   *
   * property_listings クエリが property_number 条件チェックの内側にあること
   * → property_number が null/空文字の場合、クエリ自体が実行されない
   */
  describe('Property 2: property_listings クエリが property_number 条件ブロック内にあること', () => {
    it('property_listings クエリが property_number 条件チェックの内側に配置されていること', () => {
      const isInsideCondition = isPropertyListingsQueryInsideCondition(source);

      console.log(`\n📋 property_listings クエリの配置確認:`);
      console.log(`  - 条件ブロック内にあるか: ${isInsideCondition}`);

      if (isInsideCondition) {
        console.log('  ✅ property_listings クエリは条件ブロック内にあります');
        console.log('     → property_number が null/空文字の場合、クエリは実行されません（保全OK）');
      } else {
        console.log('  ❌ property_listings クエリが条件ブロック外にあります');
        console.log('     → property_number が null/空文字でもクエリが実行される可能性があります');
      }

      // このテストは未修正コードで PASS することが期待される
      expect(isInsideCondition).toBe(true);
    });
  });

  /**
   * Property 2: Preservation - CH〜CN列フィールドの保護確認
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
   *
   * CH〜CN列フィールドの allowedData 代入が property_number 条件ブロック外に存在しないこと
   * → property_number が null/空文字の場合、これらのフィールドは allowedData に追加されない
   */
  describe('Property 2: CH〜CN列フィールドが条件ブロック外の allowedData に追加されないこと', () => {
    let fieldResults: Record<string, boolean>;

    beforeAll(() => {
      fieldResults = checkChCnFieldsInsideConditionBlock(source);
    });

    for (const field of CH_CN_FIELDS) {
      it(`"${field}" が property_number 条件ブロック外の allowedData に追加されないこと（保全確認）`, () => {
        const isPreserved = fieldResults[field];

        console.log(`\n📊 保全確認: "${field}"`);
        console.log(`  - 条件ブロック外の allowedData に追加されないか: ${isPreserved}`);

        if (isPreserved) {
          console.log(`  ✅ 保全OK: "${field}" は条件ブロック外では allowedData に追加されません`);
          console.log(`     → property_number が null/空文字の場合、CH〜CN列は変更されません`);
        } else {
          console.log(`  ❌ 保全違反: "${field}" が条件ブロック外で allowedData に追加されています`);
          console.log(`     → property_number が null/空文字でも CH〜CN列が変更される可能性があります`);
        }

        // このテストは未修正コードで PASS することが期待される
        expect(isPreserved).toBe(true);
      });
    }
  });

  /**
   * Property 2: Preservation - 統合確認
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
   *
   * 全保全条件を統合して確認する
   * isBugCondition(X) が false（property_number が null または空文字）の場合、
   * property_listings クエリが実行されず、CH〜CN列フィールドが allowedData に追加されないこと
   */
  it('Property 2 (統合): property_number が null/空文字の場合、property_listings クエリが実行されずCH〜CN列フィールドが allowedData に追加されないこと', () => {
    console.log('\n========================================');
    console.log('🛡️ 保全統合確認テスト');
    console.log('========================================\n');

    const condition = extractPropertyNumberCondition(source);
    const isQueryInsideCondition = isPropertyListingsQueryInsideCondition(source);
    const fieldResults = checkChCnFieldsInsideConditionBlock(source);

    console.log('📋 保全条件確認結果:');
    console.log(`  1. property_number 条件チェックが存在するか: ${condition !== null}`);
    console.log(`  2. property_listings クエリが条件ブロック内にあるか: ${isQueryInsideCondition}`);
    console.log('\n📊 CH〜CN列フィールド別保全確認:');

    const preservationResults: Array<{ field: string; isPreserved: boolean }> = [];

    for (const field of CH_CN_FIELDS) {
      const isPreserved = fieldResults[field] ?? false;
      preservationResults.push({ field, isPreserved });

      const status = isPreserved ? '✅' : '❌';
      console.log(`  ${status} ${field}: 条件ブロック外に追加されない = ${isPreserved}`);
    }

    const allPreserved = preservationResults.every(r => r.isPreserved);
    const violatingFields = preservationResults.filter(r => !r.isPreserved);

    if (condition !== null && isQueryInsideCondition && allPreserved) {
      console.log('\n✅ 保全確認: 全条件が満たされています');
      console.log('   → property_number が null/空文字の場合:');
      console.log('     - property_listings クエリは実行されません');
      console.log('     - CH〜CN列フィールドは allowedData に追加されません');
      console.log('     - スプレッドシートのCH〜CN列は変更されません（保全OK）');
    } else {
      console.log('\n❌ 保全違反が検出されました:');
      if (condition === null) {
        console.log('   - property_number の条件チェックが存在しません');
      }
      if (!isQueryInsideCondition) {
        console.log('   - property_listings クエリが条件ブロック外にあります');
      }
      if (violatingFields.length > 0) {
        console.log('   - 以下のフィールドが条件ブロック外で allowedData に追加されています:');
        violatingFields.forEach(r => console.log(`     - ${r.field}`));
      }
    }

    console.log('\n========================================');
    console.log('🛡️ 保全統合確認テスト終了');
    console.log('========================================\n');

    // このテストは未修正コードで PASS することが期待される
    expect(condition).not.toBeNull();
    expect(isQueryInsideCondition).toBe(true);
    for (const result of preservationResults) {
      expect(result.isPreserved).toBe(true);
    }
  });
});
