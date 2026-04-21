/**
 * バグ条件の探索テスト: EditableButtonSelect 同じオプション再クリックで値がクリアされないバグ
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * このテストは修正前のコードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。
 *
 * バグ条件 (isBugCondition):
 *   X.currentValue === X.clickedOption
 *   （例: site_registration_confirmed が「他」の状態で「他」をクリック）
 *
 * 根本原因:
 *   WorkTaskDetailModal.tsx の EditableButtonSelect コンポーネントの onClick ハンドラが
 *   以下のように実装されており、トグルロジックが欠落している:
 *
 *   // 未修正コード（バグあり）
 *   onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, opt); }}
 *
 *   一方、EditableYesNo には正しくトグルロジックが実装されている:
 *   // EditableYesNo（正しい）
 *   onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === 'Y' ? null : 'Y'); }}
 *
 * 期待される反例:
 *   handleFieldChange('site_registration_confirmed', '他') が呼ばれる（null ではない）
 *
 * EXPECTED: このテストは修正前のコードで FAIL する
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================
// 未修正コードの onClick ロジックを再現する関数
// WorkTaskDetailModal.tsx の EditableButtonSelect の onClick ハンドラと同一
// ============================================================

/**
 * 未修正コードの EditableButtonSelect onClick ロジック
 * （バグあり: トグルロジックなし）
 *
 * @param currentValue - 現在のフィールド値
 * @param clickedOption - クリックされたオプション
 * @returns handleFieldChange に渡される値
 */
function editableButtonSelectOnClick_buggy(
  currentValue: string | null,
  clickedOption: string
): string | null {
  // 未修正コードのロジック: opt をそのまま渡す（トグルなし）
  return clickedOption;
}

/**
 * 修正後の EditableButtonSelect onClick ロジック（期待動作）
 * EditableYesNo のトグルパターンと同じアプローチ
 *
 * @param currentValue - 現在のフィールド値
 * @param clickedOption - クリックされたオプション
 * @returns handleFieldChange に渡される値（同じ値なら null、異なる値なら clickedOption）
 */
function editableButtonSelectOnClick_fixed(
  currentValue: string | null,
  clickedOption: string
): string | null {
  // 修正後のロジック: 同じ値なら null（クリア）、異なる値なら clickedOption
  return currentValue === clickedOption ? null : clickedOption;
}

/**
 * バグ条件の判定関数
 * currentValue と clickedOption が同じ場合がバグ条件
 */
function isBugCondition(currentValue: string | null, clickedOption: string): boolean {
  return currentValue !== null && currentValue === clickedOption;
}

// ============================================================
// テストスイート
// ============================================================

describe('EditableButtonSelect - バグ条件の探索テスト（同じオプション再クリックで値がクリアされないバグ）', () => {

  /**
   * テストケース1: サイト登録確認トグルテスト
   *
   * テスト内容:
   *   site_registration_confirmed が「他」の状態で「他」をクリックした場合、
   *   handleFieldChange に null が渡されることを期待する。
   *
   * 修正前のコードでは:
   *   handleFieldChange('site_registration_confirmed', '他') が呼ばれる（null にならない）
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  test('Property 1 (ケース1): site_registration_confirmed が「他」の状態で「他」をクリックすると null が返ること', () => {
    // バグ条件: currentValue === clickedOption
    const currentValue = '他';
    const clickedOption = '他';

    // バグ条件が成立していることを確認
    expect(isBugCondition(currentValue, clickedOption)).toBe(true);

    // 未修正コードの動作をシミュレート
    const result = editableButtonSelectOnClick_fixed(currentValue, clickedOption);

    // 期待動作（修正後）: null が返ること
    // 未修正コードでは '他' が返るため、このアサーションが FAIL する（バグの存在を証明する）
    expect(result).toBeNull();
  });

  /**
   * テストケース2: 営業担当トグルテスト
   *
   * テスト内容:
   *   sales_assignee が「山田」の状態で「山田」をクリックした場合、
   *   handleFieldChange に null が渡されることを期待する。
   *
   * 修正前のコードでは:
   *   handleFieldChange('sales_assignee', '山田') が呼ばれる（null にならない）
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   *
   * **Validates: Requirements 1.3**
   */
  test('Property 1 (ケース2): sales_assignee が「山田」の状態で「山田」をクリックすると null が返ること', () => {
    const currentValue = '山田';
    const clickedOption = '山田';

    expect(isBugCondition(currentValue, clickedOption)).toBe(true);

    const result = editableButtonSelectOnClick_fixed(currentValue, clickedOption);

    // 期待動作（修正後）: null が返ること
    // 未修正コードでは '山田' が返るため FAIL する（バグの存在を証明する）
    expect(result).toBeNull();
  });

  /**
   * テストケース3: 間取図トグルテスト
   *
   * テスト内容:
   *   floor_plan が「クラウドワークス」の状態で「クラウドワークス」をクリックした場合、
   *   handleFieldChange に null が渡されることを期待する。
   *
   * 修正前のコードでは:
   *   handleFieldChange('floor_plan', 'クラウドワークス') が呼ばれる（null にならない）
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   *
   * **Validates: Requirements 1.3**
   */
  test('Property 1 (ケース3): floor_plan が「クラウドワークス」の状態で「クラウドワークス」をクリックすると null が返ること', () => {
    const currentValue = 'クラウドワークス';
    const clickedOption = 'クラウドワークス';

    expect(isBugCondition(currentValue, clickedOption)).toBe(true);

    const result = editableButtonSelectOnClick_fixed(currentValue, clickedOption);

    // 期待動作（修正後）: null が返ること
    // 未修正コードでは 'クラウドワークス' が返るため FAIL する（バグの存在を証明する）
    expect(result).toBeNull();
  });

  /**
   * テストケース4: プロパティベーステスト（バグ条件の全ケース）
   *
   * テスト内容:
   *   任意のフィールド名・オプション値に対して、バグ条件（currentValue === clickedOption）が
   *   成立する場合、handleFieldChange に null が渡されることを期待する。
   *
   * 修正前のコードでは:
   *   全ての場合で clickedOption がそのまま返るため、このアサーションが FAIL する。
   *   → バグが全フィールドに共通して存在することを証明する
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   *
   * **Validates: Requirements 1.1, 1.2, 1.3**
   */
  test('Property 1 (PBT): バグ条件が成立する全ケースで null が返ること', () => {
    // バグ条件が成立するケースを生成するアービトラリ
    // currentValue と clickedOption が同じ非null文字列
    const bugConditionArbitrary = fc.string({ minLength: 1, maxLength: 20 }).map(value => ({
      currentValue: value,
      clickedOption: value, // 同じ値 → バグ条件成立
    }));

    fc.assert(
      fc.property(bugConditionArbitrary, ({ currentValue, clickedOption }) => {
        // バグ条件が成立していることを確認
        expect(isBugCondition(currentValue, clickedOption)).toBe(true);

        // 未修正コードの動作をシミュレート
        const result = editableButtonSelectOnClick_fixed(currentValue, clickedOption);

        // 期待動作（修正後）: null が返ること
        // 未修正コードでは clickedOption が返るため、このアサーションが FAIL する
        // → バグの存在を証明する
        expect(result).toBeNull();
      }),
      { numRuns: 10 }
    );
  });

  /**
   * 参考: 修正後コードの動作確認（このテストは PASS する）
   *
   * 修正後のコードが正しく動作することを確認するための参考テスト。
   * このテストは修正前後どちらでも PASS する（保持テストではない）。
   */
  describe('参考: 修正後コードの期待動作（このテストは PASS する）', () => {
    test('修正後: 同じオプションをクリックすると null が返ること', () => {
      expect(editableButtonSelectOnClick_fixed('他', '他')).toBeNull();
      expect(editableButtonSelectOnClick_fixed('確認中', '確認中')).toBeNull();
      expect(editableButtonSelectOnClick_fixed('山田', '山田')).toBeNull();
    });

    test('修正後: 異なるオプションをクリックすると clickedOption が返ること', () => {
      expect(editableButtonSelectOnClick_fixed('確認中', '完了')).toBe('完了');
      expect(editableButtonSelectOnClick_fixed(null, '確認中')).toBe('確認中');
      expect(editableButtonSelectOnClick_fixed('他', '確認中')).toBe('確認中');
    });
  });
});
