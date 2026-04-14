/**
 * Preservation プロパティテスト: 内覧形態以外のフィールドの同期動作保全
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * このテストは未修正コードで PASS する（保全すべきベースライン動作を確認）
 * 修正後も引き続き PASS する（リグレッションがないことを確認）
 *
 * 観察された動作パターン:
 * - BUYER_COLUMN_MAPPING['内覧形態_一般媒介'] === 'viewing_type_general'
 * - BUYER_COLUMN_MAPPING['●内覧日(最新）'] === 'viewing_date'
 * - BUYER_COLUMN_MAPPING['●時間'] === 'viewing_time'
 * - これらのフィールドはGASとJSONで一致しており、バグの影響を受けない
 *
 * 保全すべきベースライン:
 * - 「内覧形態」以外の全フィールドのGAS↔JSONマッピングが一致している
 * - 特に viewing_type_general, viewing_date, viewing_time は正しくマッピングされている
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
 * backend/src/config/buyer-column-mapping.json から全マッピングを読み込む
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

describe('Preservation: 内覧形態以外のフィールドの同期動作保全（viewing-type-sync-fix）', () => {
  let gasMapping: Record<string, string>;
  let jsonMapping: Record<string, string>;

  beforeAll(() => {
    gasMapping = parseBuyerColumnMappingFromGas();
    jsonMapping = parseBuyerColumnMappingFromJson();
  });

  /**
   * テスト1: viewing_type_general のマッピングが正しいこと
   *
   * **Validates: Requirements 3.1**
   *
   * 観察: BUYER_COLUMN_MAPPING['内覧形態_一般媒介'] が 'viewing_type_general' を返すことを確認
   * 未修正コードでも PASS する（このフィールドはバグの影響を受けない）
   */
  test('Preservation 3.1a: GASのBUYER_COLUMN_MAPPING["内覧形態_一般媒介"] が "viewing_type_general" であること', () => {
    const gasValue = gasMapping['内覧形態_一般媒介'];

    console.log('\n[Preservation Test 3.1a] GASのBUYER_COLUMN_MAPPING["内覧形態_一般媒介"] を確認');
    console.log(`  実際の値: "${gasValue}"`);
    console.log(`  期待値:   "viewing_type_general"`);

    expect(gasValue).toBe('viewing_type_general');
  });

  /**
   * テスト2: viewing_date のマッピングが正しいこと
   *
   * **Validates: Requirements 3.1**
   *
   * 観察: BUYER_COLUMN_MAPPING['●内覧日(最新）'] が 'viewing_date' を返すことを確認
   * 未修正コードでも PASS する（このフィールドはバグの影響を受けない）
   */
  test('Preservation 3.1b: GASのBUYER_COLUMN_MAPPING["●内覧日(最新）"] が "viewing_date" であること', () => {
    const gasValue = gasMapping['●内覧日(最新）'];

    console.log('\n[Preservation Test 3.1b] GASのBUYER_COLUMN_MAPPING["●内覧日(最新）"] を確認');
    console.log(`  実際の値: "${gasValue}"`);
    console.log(`  期待値:   "viewing_date"`);

    expect(gasValue).toBe('viewing_date');
  });

  /**
   * テスト3: viewing_time のマッピングが正しいこと
   *
   * **Validates: Requirements 3.1**
   *
   * 観察: BUYER_COLUMN_MAPPING['●時間'] が 'viewing_time' を返すことを確認
   * 未修正コードでも PASS する（このフィールドはバグの影響を受けない）
   */
  test('Preservation 3.1c: GASのBUYER_COLUMN_MAPPING["●時間"] が "viewing_time" であること', () => {
    const gasValue = gasMapping['●時間'];

    console.log('\n[Preservation Test 3.1c] GASのBUYER_COLUMN_MAPPING["●時間"] を確認');
    console.log(`  実際の値: "${gasValue}"`);
    console.log(`  期待値:   "viewing_time"`);

    expect(gasValue).toBe('viewing_time');
  });

  /**
   * テスト4: 「内覧形態」以外の全フィールドでGASとJSONのマッピングが一致していること
   *
   * **Validates: Requirements 3.1, 3.3**
   *
   * 「内覧形態」フィールドを除いた全フィールドについて、
   * GASとJSONのマッピングが一致していることを確認する
   * 未修正コードでも PASS する（バグは「内覧形態」のみ）
   */
  test('Preservation 3.1d: 「内覧形態」以外の全フィールドでGASとJSONのマッピングが一致していること', () => {
    console.log('\n[Preservation Test 3.1d] 「内覧形態」以外の全フィールドのマッピング整合性確認');

    // GASとJSONの両方に存在するキーを取得（「内覧形態」を除く）
    const gasKeys = Object.keys(gasMapping);
    const jsonKeys = Object.keys(jsonMapping);
    const commonKeys = gasKeys.filter(
      key => jsonKeys.includes(key) && key !== '内覧形態'
    );

    console.log(`  GASキー数: ${gasKeys.length}`);
    console.log(`  JSONキー数: ${jsonKeys.length}`);
    console.log(`  共通キー数（内覧形態除く）: ${commonKeys.length}`);

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
      console.log('\n  ❌ 不一致フィールドが検出された（「内覧形態」以外）:');
      for (const m of mismatches) {
        console.log(`    - "${m.key}": GAS="${m.gasValue}" !== JSON="${m.jsonValue}"`);
      }
    } else {
      console.log('\n  ✅ 「内覧形態」以外の全フィールドのマッピングが一致している（ベースライン確認）');
    }

    // 未修正コードでも PASS する（バグは「内覧形態」のみ）
    expect(mismatches).toHaveLength(0);
  });

  /**
   * テスト5: Property-Based Test - 「内覧形態」以外の任意フィールドのマッピング保全
   *
   * **Validates: Requirements 3.1, 3.3**
   *
   * fast-checkを使用して、「内覧形態」以外の任意フィールドに対して
   * GASとJSONのマッピングが一致していることを確認する
   * 未修正コードでも PASS する（バグは「内覧形態」のみ）
   */
  test('Preservation 3.1e: Property-Based (fast-check) - 「内覧形態」以外の任意フィールドのマッピングが保全されていること', () => {
    console.log('\n[Preservation Test 3.1e] fast-checkによる保全プロパティ検証');

    // 「内覧形態」を除いた共通キーのリスト
    const preservedKeys = Object.keys(gasMapping).filter(
      key => jsonMapping[key] !== undefined && key !== '内覧形態'
    );

    if (preservedKeys.length === 0) {
      console.log('  保全対象キーが存在しないためスキップ');
      return;
    }

    console.log(`  保全対象キー数: ${preservedKeys.length}`);

    // fast-checkで保全対象キーからランダムにサンプリングして検証
    // viewing_type_general, viewing_date, viewing_time を高確率でサンプリング
    const biasedKeyArbitrary = fc.oneof(
      { weight: 5, arbitrary: fc.constant('内覧形態_一般媒介') },
      { weight: 5, arbitrary: fc.constant('●内覧日(最新）') },
      { weight: 5, arbitrary: fc.constant('●時間') },
      { weight: 1, arbitrary: fc.constantFrom(...preservedKeys) }
    );

    fc.assert(
      fc.property(
        biasedKeyArbitrary,
        (key) => {
          const gasValue = gasMapping[key];
          const jsonValue = jsonMapping[key];

          // 「内覧形態」はこのテストの対象外
          if (key === '内覧形態') return true;

          if (gasValue === undefined || jsonValue === undefined) return true;

          if (gasValue !== jsonValue) {
            console.log(`\n  ❌ 保全違反: key="${key}", GAS="${gasValue}", JSON="${jsonValue}"`);
          }

          // 「内覧形態」以外のフィールドはGASとJSONが一致していること
          return gasValue === jsonValue;
        }
      ),
      {
        numRuns: 100,
        verbose: false,
      }
    );

    console.log('  ✅ 保全プロパティ確認完了: 「内覧形態」以外の全フィールドが保全されている');
  });

  /**
   * テスト6: viewing_type_general, viewing_date, viewing_time がJSONとも一致していること
   *
   * **Validates: Requirements 3.1**
   *
   * 観察された3つの重要フィールドについて、GASとJSONの両方で一致していることを確認
   * 未修正コードでも PASS する
   */
  test('Preservation 3.1f: 重要フィールド（viewing_type_general, viewing_date, viewing_time）がGASとJSONで一致していること', () => {
    console.log('\n[Preservation Test 3.1f] 重要フィールドのGAS↔JSON整合性確認');

    const importantFields = [
      { spreadsheetKey: '内覧形態_一般媒介', expectedDbColumn: 'viewing_type_general' },
      { spreadsheetKey: '●内覧日(最新）', expectedDbColumn: 'viewing_date' },
      { spreadsheetKey: '●時間', expectedDbColumn: 'viewing_time' },
    ];

    for (const field of importantFields) {
      const gasValue = gasMapping[field.spreadsheetKey];
      const jsonValue = jsonMapping[field.spreadsheetKey];

      console.log(`\n  フィールド: "${field.spreadsheetKey}"`);
      console.log(`    GAS値:      "${gasValue}"`);
      console.log(`    JSON値:     "${jsonValue}"`);
      console.log(`    期待値:     "${field.expectedDbColumn}"`);

      // GASとJSONの両方が期待値と一致していること
      expect(gasValue).toBe(field.expectedDbColumn);
      expect(jsonValue).toBe(field.expectedDbColumn);
    }

    console.log('\n  ✅ 重要フィールドの整合性確認完了');
  });
});
