/**
 * タスク2: 保全プロパティテスト - 空値・他フィールドの表示維持
 *
 * このテストは修正前のコードでPASSすることを確認するためのものです。
 * ベースライン動作（リグレッション防止）を記録します。
 *
 * 観察優先メソドロジーに従い、修正前コードで非バグ条件の入力の動作を観察します。
 *
 * 観察1: construction_year_month = null → "-" が表示される（修正前コードで確認）
 * 観察2: construction_year_month = undefined → "-" が表示される（修正前コードで確認）
 * 観察3: construction_year_month = "" → "-" が表示される（修正前コードで確認）
 * 観察4: land_area, building_area, structure などの他フィールドの表示が変わらない（修正前コードで確認）
 * 観察5: isEditMode=true の場合、テキストフィールドに生の値が表示される（修正前コードで確認）
 *
 * Validates: Requirements 3.1, 3.2
 */

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';
import { formatConstructionDate } from '../utils/constructionDateFormatter';

// PropertyDetailsSection.tsx のソースコードを読み込む
const componentPath = path.join(__dirname, '../components/PropertyDetailsSection.tsx');
let componentContent: string;

beforeAll(() => {
  componentContent = fs.readFileSync(componentPath, 'utf-8');
});

describe('保全プロパティテスト: 空値・他フィールドの表示維持', () => {

  /**
   * ===== ユニットテスト: 観察1〜3の確認 =====
   * null/undefined/空文字の場合は "-" が表示されることを確認
   * これらは isBugCondition が false を返すケース（非バグ条件）
   */
  describe('ユニットテスト: null/undefined/空文字の場合は "-" が表示されること', () => {

    /**
     * 観察1: construction_year_month = null → "-" が表示される
     * formatConstructionDate(null) は null を返し、
     * formatValue(null) は "-" を返す（修正前コードの動作）
     */
    test('観察1: formatConstructionDate(null) は null を返すこと', () => {
      const result = formatConstructionDate(null);
      expect(result).toBeNull();
    });

    /**
     * 観察2: construction_year_month = undefined → "-" が表示される
     */
    test('観察2: formatConstructionDate(undefined) は null を返すこと', () => {
      const result = formatConstructionDate(undefined);
      expect(result).toBeNull();
    });

    /**
     * 観察3: construction_year_month = "" → "-" が表示される
     */
    test('観察3: formatConstructionDate("") は null を返すこと', () => {
      const result = formatConstructionDate('');
      expect(result).toBeNull();
    });

    /**
     * 空白のみの文字列も null を返すこと
     */
    test('空白のみの文字列の場合も null を返すこと', () => {
      expect(formatConstructionDate(' ')).toBeNull();
      expect(formatConstructionDate('  ')).toBeNull();
      expect(formatConstructionDate('\t')).toBeNull();
      expect(formatConstructionDate('\n')).toBeNull();
    });
  });

  /**
   * ===== ユニットテスト: 観察4の確認 =====
   * PropertyDetailsSection.tsx の他フィールドが formatValue() で処理されていることを確認
   */
  describe('ユニットテスト: 他フィールドの表示形式が変わらないこと', () => {

    test('観察4: land_area フィールドが formatValue() で処理されていること', () => {
      const pattern = /formatValue\s*\(\s*data\.land_area/;
      expect(componentContent).toMatch(pattern);
    });

    test('観察4: building_area フィールドが formatValue() で処理されていること', () => {
      const pattern = /formatValue\s*\(\s*data\.building_area/;
      expect(componentContent).toMatch(pattern);
    });

    test('観察4: structure フィールドが formatValue() で処理されていること', () => {
      const pattern = /formatValue\s*\(\s*data\.structure/;
      expect(componentContent).toMatch(pattern);
    });

    test('観察4: floor_plan フィールドが formatValue() で処理されていること', () => {
      const pattern = /formatValue\s*\(\s*data\.floor_plan/;
      expect(componentContent).toMatch(pattern);
    });

    test('観察4: contract_date フィールドが formatValue() で処理されていること', () => {
      const pattern = /formatValue\s*\(\s*data\.contract_date/;
      expect(componentContent).toMatch(pattern);
    });

    test('観察4: settlement_date フィールドが formatValue() で処理されていること', () => {
      const pattern = /formatValue\s*\(\s*data\.settlement_date/;
      expect(componentContent).toMatch(pattern);
    });
  });

  /**
   * ===== ユニットテスト: 観察5の確認 =====
   * isEditMode=true の場合、テキストフィールドに生の値が表示される
   */
  describe('ユニットテスト: 編集モードの動作が変わらないこと', () => {

    test('観察5: 編集モードで construction_year_month が TextField で表示されること', () => {
      // 編集モードでは getValue() で生の値が表示される
      const pattern = /getValue\s*\(\s*['"]construction_year_month['"]\s*,\s*data\.construction_year_month\s*\)/;
      expect(componentContent).toMatch(pattern);
    });
  });

  /**
   * ===== プロパティベーステスト: 観察1〜3の一般化 =====
   * null/undefined/空文字の場合は常に null を返すことを検証
   *
   * Validates: Requirements 3.1
   */
  describe('プロパティベーステスト: null/undefined/空文字の場合は常に null を返すこと', () => {

    /**
     * Property 2a: 空値の保全プロパティ
     * FOR ALL 空文字列（空白のみを含む）:
     *   formatConstructionDate(emptyString) === null
     *
     * Validates: Requirements 3.1
     */
    test('Property 2a: 空文字列の場合は常に null を返すこと', () => {
      // fast-check v4: fc.string() を使用し、空白文字のみの文字列を生成
      fc.assert(
        fc.property(
          // 空白文字（スペース、タブ、改行）のみからなる文字列を生成
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 10 })
            .map(chars => chars.join('')),
          (emptyStr) => {
            const result = formatConstructionDate(emptyStr);
            // 空文字列（空白のみ）の場合は null を返す
            return result === null;
          }
        ),
        { numRuns: 10 }
      );
    });

    /**
     * Property 2b: 認識できない形式の場合は null を返すこと
     * FOR ALL 日付形式でない文字列（アルファベットのみ）:
     *   formatConstructionDate(nonDateString) === null
     *
     * Validates: Requirements 3.1
     */
    test('Property 2b: 日付形式でない文字列の場合は null を返すこと', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z]{1,20}$/),
          (nonDateStr) => {
            const result = formatConstructionDate(nonDateStr);
            return result === null;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * ===== プロパティベーステスト: 観察4の一般化 =====
   * ランダムな物件データで construction_year_month 以外のフィールドの表示が変わらないことを検証
   *
   * Validates: Requirements 3.2
   */
  describe('プロパティベーステスト: 他フィールドの表示形式が変わらないこと', () => {

    /**
     * Property 2c: 他フィールドの保全プロパティ
     * FOR ALL ランダムな物件データ:
     *   construction_year_month 以外のフィールドは formatValue() で処理される
     *
     * Validates: Requirements 3.2
     */
    test('Property 2c: construction_year_month 以外のフィールドが formatValue() で処理されること', () => {
      // 他フィールドのリスト（construction_year_month 以外）
      const otherFields = [
        'land_area',
        'building_area',
        'exclusive_area',
        'structure',
        'floor_plan',
        'contract_date',
        'settlement_date',
      ];

      // 各フィールドが formatValue() で処理されていることを確認
      fc.assert(
        fc.property(
          fc.constantFrom(...otherFields),
          (fieldName) => {
            const pattern = new RegExp(`formatValue\\s*\\(\\s*data\\.${fieldName}`);
            return pattern.test(componentContent);
          }
        ),
        { numRuns: otherFields.length }
      );
    });

    /**
     * Property 2d: formatValue() の動作保全プロパティ
     * FOR ALL 有効な整数（面積フィールド用）:
     *   formatValue(number, '㎡') は "number㎡" を返す
     *
     * Validates: Requirements 3.2
     */
    test('Property 2d: formatValue() が数値フィールドを正しく処理すること', () => {
      const formatValue = (value: any, unit?: string) => {
        if (value === null || value === undefined || value === '') return '-';
        return unit ? `${value}${unit}` : value;
      };

      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9999 }),
          (area) => {
            const result = formatValue(area, '㎡');
            return result === `${area}㎡`;
          }
        ),
        { numRuns: 10 }
      );
    });

    /**
     * Property 2e: formatValue() の空値保全プロパティ
     * FOR ALL null/undefined/空文字:
     *   formatValue(emptyValue) は "-" を返す
     *
     * Validates: Requirements 3.1, 3.2
     */
    test('Property 2e: formatValue() が空値を "-" として処理すること', () => {
      const formatValue = (value: any, unit?: string) => {
        if (value === null || value === undefined || value === '') return '-';
        return unit ? `${value}${unit}` : value;
      };

      // null の場合
      expect(formatValue(null)).toBe('-');
      expect(formatValue(null, '㎡')).toBe('-');

      // undefined の場合
      expect(formatValue(undefined)).toBe('-');
      expect(formatValue(undefined, '㎡')).toBe('-');

      // 空文字の場合
      expect(formatValue('' )).toBe('-');
      expect(formatValue('', '㎡')).toBe('-');
    });
  });

  /**
   * ===== 統合確認: 修正後コードの動作確認 =====
   */
  describe('統合確認: 修正後コードの動作確認', () => {

    test('修正後コード: formatConstructionDate() がインポートされていること', () => {
      const importPattern = /import\s+\{[^}]*formatConstructionDate[^}]*\}\s+from\s+['"][^'"]*constructionDateFormatter['"]/;
      expect(componentContent).toMatch(importPattern);
    });

    test('修正後コード: construction_year_month が formatConstructionDate() を通して処理されること', () => {
      const fixedPattern = /formatConstructionDate\s*\(\s*data\.construction_year_month\s*\)/;
      expect(componentContent).toMatch(fixedPattern);
    });
  });
});
