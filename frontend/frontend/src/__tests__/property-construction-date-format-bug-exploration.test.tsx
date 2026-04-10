/**
 * タスク1: バグ条件の探索テスト - 新築年月の未フォーマット表示バグ
 *
 * このテストは未修正コードでバグの存在を証明するためのものです。
 * テストが失敗することが期待される結果です（バグの存在を確認）。
 *
 * バグ内容:
 *   PropertyDetailsSection.tsx の表示モード（isEditMode=false）で
 *   construction_year_month フィールドが formatConstructionDate() を通さずに
 *   そのまま描画されるバグ。
 *
 * テストアプローチ:
 *   1. ソースコード静的解析: PropertyDetailsSection.tsx が formatConstructionDate() を
 *      インポート・使用していないことを確認（バグ条件の証明）
 *   2. formatConstructionDate() の動作確認: 各種形式の入力に対して正しく変換できることを確認
 *      （修正後に使用すべき関数が正しく動作することを証明）
 *
 * Validates: Requirements 1.1, 1.2
 */

import * as fs from 'fs';
import * as path from 'path';
import { formatConstructionDate } from '../utils/constructionDateFormatter';

describe('バグ条件の探索テスト: 新築年月の未フォーマット表示バグ', () => {
  // PropertyDetailsSection.tsx のソースコードを読み込む
  const componentPath = path.join(__dirname, '../components/PropertyDetailsSection.tsx');
  let componentContent: string;

  beforeAll(() => {
    componentContent = fs.readFileSync(componentPath, 'utf-8');
  });

  /**
   * テストケース1: PropertyDetailsSection.tsx が formatConstructionDate() を
   * インポートしていないことを確認（バグ条件の証明）
   *
   * バグ条件: formatConstructionDate() がインポートされていない
   * 未修正コードでは: インポート文が存在しない → このテストは FAIL する
   * 修正後の期待値: インポート文が存在する → このテストは PASS する
   *
   * 反例（未修正コード）:
   *   - formatConstructionDate のインポート文が存在しない
   *   - construction_year_month が formatValue() のみで処理されている
   */
  test('テストケース1: PropertyDetailsSection.tsx が formatConstructionDate() をインポートしていること', () => {
    // formatConstructionDate のインポート文を確認
    const importPattern = /import\s+\{[^}]*formatConstructionDate[^}]*\}\s+from\s+['"][^'"]*constructionDateFormatter['"]/;

    // 未修正コードでは、このアサーションは失敗する（インポート文が存在しない）
    // 修正後コードでは、このアサーションはパスする
    expect(componentContent).toMatch(importPattern);
  });

  /**
   * テストケース2: PropertyDetailsSection.tsx の表示モードで
   * formatConstructionDate() が使用されていることを確認（バグ条件の証明）
   *
   * バグ条件: 表示モードで formatConstructionDate() が呼ばれていない
   * 未修正コードでは: formatConstructionDate の呼び出しが存在しない → このテストは FAIL する
   * 修正後の期待値: formatConstructionDate の呼び出しが存在する → このテストは PASS する
   *
   * 反例（未修正コード）:
   *   - construction_year_month が {formatValue(data.construction_year_month)} のみで表示される
   *   - formatConstructionDate() が呼ばれない
   */
  test('テストケース2: PropertyDetailsSection.tsx で formatConstructionDate() が使用されていること', () => {
    // formatConstructionDate の使用箇所を確認
    const usagePattern = /formatConstructionDate\s*\(/;

    // 未修正コードでは、このアサーションは失敗する（使用箇所が存在しない）
    // 修正後コードでは、このアサーションはパスする
    expect(componentContent).toMatch(usagePattern);
  });

  /**
   * テストケース3: formatConstructionDate() が "2020-03" を "2020年03月" に変換することを確認
   *
   * このテストは formatConstructionDate() 関数自体の動作を確認する。
   * 修正後は PropertyDetailsSection.tsx でこの関数が呼ばれるべきである。
   *
   * 未修正コードでは: PropertyDetailsSection.tsx が formatConstructionDate() を呼ばないため、
   *   "2020-03" がそのまま表示される（"2020年03月" にならない）
   * 修正後の期待値: formatConstructionDate("2020-03") = "2020年03月"
   *
   * このテスト自体は PASS するが、PropertyDetailsSection.tsx がこの関数を呼ばないことが
   * バグの根本原因であることを示す。
   */
  test('テストケース3（参考）: formatConstructionDate("2020-03") が "2020年03月" を返すこと', () => {
    // formatConstructionDate() は正しく動作する
    const result = formatConstructionDate('2020-03');
    expect(result).toBe('2020年03月');
  });

  /**
   * テストケース4: formatConstructionDate() が Date.toString()形式を正しく変換することを確認
   * （修正後: "1978年04月" を返す）
   */
  test('テストケース4: formatConstructionDate() が Date.toString()形式を "1978年04月" に変換すること', () => {
    const dateToStringValue = 'Sat Apr 01 1978 00:00:00 GMT+0900 (Japan Standard Time)';
    const result = formatConstructionDate(dateToStringValue);
    expect(result).toBe('1978年04月');
  });
});
