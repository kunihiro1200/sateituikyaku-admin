/**
 * Bug Condition探索テスト: 内覧形態（viewing_type）同期不具合
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは未修正コードで実行すると FAIL する（これが正しい - バグの存在を証明する）
 * 修正後は PASS する（バグが修正されたことを確認）
 *
 * バグ概要:
 * - `gas/buyer-sync/BuyerSync.gs` の `BUYER_COLUMN_MAPPING['内覧形態']` が `'viewing_type'` にマッピングされている
 * - `backend/src/config/buyer-column-mapping.json` では `"内覧形態": "viewing_mobile"` と定義されている
 * - この不一致により、スプレッドシートの「内覧形態」列の値がDBの正しいカラムに書き込まれない
 *
 * 根本原因:
 * - GASが `buyers.viewing_type` に書き込むが、フロントエンドは `buyers.viewing_mobile` を参照する
 * - DBに `viewing_mobile` カラムが存在しないため、バックエンド経由の同期では値が反映されない
 *
 * 期待されるカウンターサンプル:
 * - `BUYER_COLUMN_MAPPING['内覧形態']` が `'viewing_mobile'` ではなく `'viewing_type'` を返す
 * - `buyer-column-mapping.json` の `'内覧形態'` は `'viewing_mobile'` を返す（不一致）
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// GASファイルからBUYER_COLUMN_MAPPINGを読み込む
// ============================================================

/**
 * gas/buyer-sync/BuyerSync.gs から BUYER_COLUMN_MAPPING を解析して返す
 */
function parseBuyerColumnMappingFromGas(): Record<string, string> {
  const gasFilePath = path.resolve(__dirname, '../../../gas/buyer-sync/BuyerSync.gs');
  const content = fs.readFileSync(gasFilePath, 'utf-8');

  // BUYER_COLUMN_MAPPING オブジェクトを抽出
  const mappingMatch = content.match(/var BUYER_COLUMN_MAPPING\s*=\s*\{([\s\S]*?)\};/);
  if (!mappingMatch) {
    throw new Error('BUYER_COLUMN_MAPPING が BuyerSync.gs に見つかりません');
  }

  const mappingBody = mappingMatch[1];
  const result: Record<string, string> = {};

  // 各エントリを解析: '日本語キー': 'value', または "日本語キー": "value",
  const entryRegex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = entryRegex.exec(mappingBody)) !== null) {
    result[match[1]] = match[2];
  }

  return result;
}

/**
 * backend/src/config/buyer-column-mapping.json から spreadsheetToDatabaseExtended を読み込む
 */
function parseBuyerColumnMappingFromJson(): Record<string, string> {
  const jsonFilePath = path.resolve(
    __dirname,
    '../config/buyer-column-mapping.json'
  );
  const content = fs.readFileSync(jsonFilePath, 'utf-8');
  const json = JSON.parse(content);

  // spreadsheetToDatabase と spreadsheetToDatabaseExtended を結合
  return {
    ...json.spreadsheetToDatabase,
    ...json.spreadsheetToDatabaseExtended,
  };
}

// ============================================================
// テストスイート
// ============================================================

describe('Bug Condition: 内覧形態マッピング不一致バグ（viewing-type-sync-fix）', () => {
  let gasMapping: Record<string, string>;
  let jsonMapping: Record<string, string>;

  beforeAll(() => {
    gasMapping = parseBuyerColumnMappingFromGas();
    jsonMapping = parseBuyerColumnMappingFromJson();
  });

  /**
   * テスト1: GASのBUYER_COLUMN_MAPPINGで「内覧形態」が'viewing_mobile'にマッピングされているか確認
   *
   * **Validates: Requirements 1.1**
   *
   * 未修正コードでは FAIL する（'viewing_type' が返るため）
   * 修正後は PASS する（'viewing_mobile' が返るため）
   */
  test('Bug Condition 1.1: GASのBUYER_COLUMN_MAPPING["内覧形態"] が "viewing_mobile" であること', () => {
    const gasValue = gasMapping['内覧形態'];

    console.log('\n[Bug Condition Test 1.1] GASのBUYER_COLUMN_MAPPING["内覧形態"] を確認');
    console.log(`  実際の値: "${gasValue}"`);
    console.log(`  期待値:   "viewing_mobile"`);

    if (gasValue === 'viewing_type') {
      console.log('\n  ❌ バグ確認: GASのマッピングが "viewing_type" になっている（バグ条件を満たす）');
      console.log('  カウンターサンプル: BUYER_COLUMN_MAPPING["内覧形態"] === "viewing_type"');
    }

    // 未修正コードでは失敗する（バグの存在を証明）
    // 修正後は成功する（'viewing_mobile' が返る）
    expect(gasValue).toBe('viewing_mobile');
  });

  /**
   * テスト2: buyer-column-mapping.jsonで「内覧形態」が'viewing_mobile'にマッピングされているか確認
   *
   * **Validates: Requirements 1.2**
   *
   * このテストは未修正コードでも PASS する（JSONは正しい定義を持つため）
   * バグはGAS側にある
   */
  test('Bug Condition 1.2: buyer-column-mapping.json の "内覧形態" が "viewing_mobile" であること', () => {
    const jsonValue = jsonMapping['内覧形態'];

    console.log('\n[Bug Condition Test 1.2] buyer-column-mapping.json の "内覧形態" を確認');
    console.log(`  実際の値: "${jsonValue}"`);
    console.log(`  期待値:   "viewing_mobile"`);

    // JSONは正しい定義を持つため、このテストは PASS する
    expect(jsonValue).toBe('viewing_mobile');
  });

  /**
   * テスト3: GASとJSONのマッピングが一致しているか確認（不一致がバグ）
   *
   * **Validates: Requirements 1.1, 1.2**
   *
   * 未修正コードでは FAIL する（GASが'viewing_type'、JSONが'viewing_mobile'で不一致）
   * 修正後は PASS する（両方が'viewing_mobile'で一致）
   */
  test('Bug Condition 1.3: GASとJSONの "内覧形態" マッピングが一致していること', () => {
    const gasValue = gasMapping['内覧形態'];
    const jsonValue = jsonMapping['内覧形態'];

    console.log('\n[Bug Condition Test 1.3] GASとJSONのマッピング不一致を確認');
    console.log(`  GAS値:  "${gasValue}"`);
    console.log(`  JSON値: "${jsonValue}"`);

    if (gasValue !== jsonValue) {
      console.log('\n  ❌ バグ確認: GASとJSONのマッピングが不一致（バグ条件を満たす）');
      console.log(`  カウンターサンプル: GAS="${gasValue}" !== JSON="${jsonValue}"`);
      console.log('  根本原因: GASのBUYER_COLUMN_MAPPINGが更新されていない');
    }

    // 未修正コードでは失敗する（バグの存在を証明）
    // 修正後は成功する（両方が'viewing_mobile'で一致）
    expect(gasValue).toBe(jsonValue);
  });

  /**
   * テスト4: Property-Based Test - 全フィールドのマッピング整合性確認
   *
   * **Validates: Requirements 1.1, 1.2**
   *
   * GASとJSONの全フィールドを比較し、不一致フィールドを検出する
   * 未修正コードでは「内覧形態」フィールドで不一致が検出される（FAIL）
   * 修正後は全フィールドが一致する（PASS）
   */
  test('Bug Condition 1.4: Property-Based - GASとJSONの全マッピングが一致していること', () => {
    console.log('\n[Bug Condition Test 1.4] GASとJSONの全マッピング整合性確認');

    // GASとJSONの両方に存在するキーを取得
    const gasKeys = Object.keys(gasMapping);
    const jsonKeys = Object.keys(jsonMapping);
    const commonKeys = gasKeys.filter(key => jsonKeys.includes(key));

    console.log(`  GASキー数: ${gasKeys.length}`);
    console.log(`  JSONキー数: ${jsonKeys.length}`);
    console.log(`  共通キー数: ${commonKeys.length}`);

    // 不一致フィールドを収集
    const mismatches: Array<{ key: string; gasValue: string; jsonValue: string }> = [];
    for (const key of commonKeys) {
      if (gasMapping[key] !== jsonMapping[key]) {
        mismatches.push({
          key,
          gasValue: gasMapping[key],
          jsonValue: jsonMapping[key],
        });
      }
    }

    if (mismatches.length > 0) {
      console.log('\n  ❌ バグ確認: 以下のフィールドでGASとJSONのマッピングが不一致:');
      for (const m of mismatches) {
        console.log(`    - "${m.key}": GAS="${m.gasValue}" !== JSON="${m.jsonValue}"`);
      }
    } else {
      console.log('\n  ✅ 全フィールドのマッピングが一致している');
    }

    // 未修正コードでは「内覧形態」の不一致が検出される（FAIL）
    // 修正後は不一致が0件になる（PASS）
    expect(mismatches).toHaveLength(0);
  });

  /**
   * テスト5: Property-Based Test - isBugCondition関数の検証
   *
   * **Validates: Requirements 1.1, 1.2**
   *
   * design.mdで定義されたisBugCondition関数を実装し、バグ条件を検証する
   *
   * FUNCTION isBugCondition(mapping)
   *   RETURN mapping.key === '内覧形態'
   *          AND mapping.value === 'viewing_type'
   *          AND buyer-column-mapping.json['内覧形態'] === 'viewing_mobile'
   * END FUNCTION
   *
   * 未修正コードでは「内覧形態」エントリがバグ条件を満たす（FAIL）
   * 修正後はバグ条件を満たすエントリが存在しない（PASS）
   */
  test('Bug Condition 1.5: Property-Based - isBugCondition を満たすエントリが存在しないこと', () => {
    console.log('\n[Bug Condition Test 1.5] isBugCondition の検証');

    /**
     * design.mdで定義されたバグ条件関数
     */
    function isBugCondition(key: string, gasValue: string, jsonValue: string): boolean {
      return (
        key === '内覧形態' &&
        gasValue === 'viewing_type' &&
        jsonValue === 'viewing_mobile'
      );
    }

    // GASの全エントリに対してバグ条件を確認
    const bugEntries: Array<{ key: string; gasValue: string; jsonValue: string }> = [];
    for (const key of Object.keys(gasMapping)) {
      const gasValue = gasMapping[key];
      const jsonValue = jsonMapping[key];
      if (jsonValue !== undefined && isBugCondition(key, gasValue, jsonValue)) {
        bugEntries.push({ key, gasValue, jsonValue });
      }
    }

    if (bugEntries.length > 0) {
      console.log('\n  ❌ バグ条件を満たすエントリが検出された:');
      for (const entry of bugEntries) {
        console.log(`    - key="${entry.key}", GAS="${entry.gasValue}", JSON="${entry.jsonValue}"`);
      }
      console.log('\n  根本原因: GASのBUYER_COLUMN_MAPPING["内覧形態"]が"viewing_type"のまま');
      console.log('  修正方法: "viewing_type" を "viewing_mobile" に変更する');
    }

    // 未修正コードでは「内覧形態」エントリがバグ条件を満たす（FAIL）
    // 修正後はバグ条件を満たすエントリが0件になる（PASS）
    expect(bugEntries).toHaveLength(0);
  });

  /**
   * テスト6: Property-Based Test - fast-checkによるランダム検証
   *
   * **Validates: Requirements 1.1, 1.2**
   *
   * fast-checkを使用して、GASマッピングの任意のエントリに対して
   * JSONマッピングとの整合性を確認する
   *
   * 未修正コードでは「内覧形態」エントリで失敗する（FAIL）
   * 修正後は全エントリが一致する（PASS）
   */
  test('Bug Condition 1.6: Property-Based (fast-check) - GASの任意のマッピングエントリがJSONと一致すること', () => {
    console.log('\n[Bug Condition Test 1.6] fast-checkによるランダム検証');

    // GASとJSONの両方に存在するキーのリスト
    const commonKeys = Object.keys(gasMapping).filter(key => jsonMapping[key] !== undefined);

    if (commonKeys.length === 0) {
      console.log('  共通キーが存在しないためスキップ');
      return;
    }

    // fast-checkで共通キーからランダムにサンプリングして検証
    // 「内覧形態」キーを必ず含めるため、biasedKeyArbitraryを使用
    const biasedKeyArbitrary = fc.oneof(
      { weight: 10, arbitrary: fc.constant('内覧形態') }, // バグキーを高確率でサンプリング
      { weight: 1, arbitrary: fc.constantFrom(...commonKeys) }
    );

    fc.assert(
      fc.property(
        biasedKeyArbitrary,
        (key) => {
          const gasValue = gasMapping[key];
          const jsonValue = jsonMapping[key];

          if (gasValue !== undefined && jsonValue !== undefined && gasValue !== jsonValue) {
            console.log(`\n  ❌ 不一致検出: key="${key}", GAS="${gasValue}", JSON="${jsonValue}"`);
          }

          // GASとJSONのマッピングが一致することを確認
          // 未修正コードでは「内覧形態」で失敗する
          if (gasValue === undefined || jsonValue === undefined) return true; // 片方にしか存在しないキーはスキップ
          return gasValue === jsonValue;
        }
      ),
      {
        numRuns: 50,
        verbose: true,
      }
    );
  });
});
