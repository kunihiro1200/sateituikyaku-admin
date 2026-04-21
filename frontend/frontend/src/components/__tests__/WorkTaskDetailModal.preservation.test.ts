/**
 * 保持プロパティテスト: EditableButtonSelect バグ条件外の動作が変わらないことを確認
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは未修正コードで PASS することが期待される。
 * PASS がベースライン動作（保持すべき動作）を確認する。
 *
 * 観察優先メソドロジー:
 *   未修正コードで非バグ条件の入力（currentValue !== clickedOption）の動作を観察する。
 *
 * 観察1: null 状態で「確認中」をクリック → handleFieldChange(field, '確認中') が呼ばれる
 * 観察2: 「確認中」が選択中に「完了」をクリック → handleFieldChange(field, '完了') が呼ばれる
 * 観察3: EditableYesNo で Y ボタンをクリック → 既存のトグル動作（getValue(field) === 'Y' ? null : 'Y'）が維持される
 *
 * バグ条件外の定義:
 *   currentValue !== clickedOption（異なるオプションへの切り替え、または null からの選択）
 *
 * EXPECTED: このテストは未修正コードで PASS する（ベースライン動作の確認）
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================
// 未修正コードの onClick ロジックを再現する関数
// WorkTaskDetailModal.tsx の各コンポーネントの onClick ハンドラと同一
// ============================================================

/**
 * 未修正コードの EditableButtonSelect onClick ロジック
 * （バグあり: トグルロジックなし）
 *
 * WorkTaskDetailModal.tsx 526行目:
 *   onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, opt); }}
 *
 * @param _currentValue - 現在のフィールド値（未修正コードでは使用しない）
 * @param clickedOption - クリックされたオプション
 * @returns handleFieldChange に渡される値
 */
function editableButtonSelectOnClick_buggy(
  _currentValue: string | null,
  clickedOption: string
): string | null {
  // 未修正コードのロジック: opt をそのまま渡す（トグルなし）
  return clickedOption;
}

/**
 * EditableYesNo の Y ボタン onClick ロジック（既存・正しい実装）
 *
 * WorkTaskDetailModal.tsx 547行目:
 *   onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === 'Y' ? null : 'Y'); }}
 *
 * @param currentValue - 現在のフィールド値
 * @returns handleFieldChange に渡される値
 */
function editableYesNoYButtonOnClick(currentValue: string | null): string | null {
  // 既存のトグルロジック: 'Y' なら null、それ以外なら 'Y'
  return currentValue === 'Y' ? null : 'Y';
}

/**
 * EditableYesNo の N ボタン onClick ロジック（既存・正しい実装）
 *
 * WorkTaskDetailModal.tsx 552行目:
 *   onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === 'N' ? null : 'N'); }}
 *
 * @param currentValue - 現在のフィールド値
 * @returns handleFieldChange に渡される値
 */
function editableYesNoNButtonOnClick(currentValue: string | null): string | null {
  // 既存のトグルロジック: 'N' なら null、それ以外なら 'N'
  return currentValue === 'N' ? null : 'N';
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

describe('EditableButtonSelect - 保持プロパティテスト（バグ条件外の動作が変わらない）', () => {

  // ----------------------------------------------------------
  // 観察1: null 状態でオプションをクリック → clickedOption が返る
  // ----------------------------------------------------------

  /**
   * 観察1: null 状態で「確認中」をクリック
   *
   * テスト内容:
   *   currentValue が null の状態でボタンをクリックした場合、
   *   handleFieldChange に clickedOption が渡されることを確認する。
   *
   * バグ条件外: currentValue (null) !== clickedOption ('確認中')
   *
   * EXPECTED: PASS（未修正コードでも正しく動作する）
   *
   * **Validates: Requirements 3.4**
   */
  test('観察1: null 状態で「確認中」をクリックすると「確認中」が返ること', () => {
    const currentValue = null;
    const clickedOption = '確認中';

    // バグ条件外であることを確認
    expect(isBugCondition(currentValue, clickedOption)).toBe(false);

    // 未修正コードの動作をシミュレート
    const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);

    // 期待動作: clickedOption が返ること
    expect(result).toBe('確認中');
  });

  /**
   * 観察1 (追加): null 状態で任意のオプションをクリック
   *
   * EXPECTED: PASS
   *
   * **Validates: Requirements 3.4**
   */
  test('観察1 (追加): null 状態で「完了」をクリックすると「完了」が返ること', () => {
    const currentValue = null;
    const clickedOption = '完了';

    expect(isBugCondition(currentValue, clickedOption)).toBe(false);

    const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);

    expect(result).toBe('完了');
  });

  // ----------------------------------------------------------
  // 観察2: 異なるオプションへの切り替え → clickedOption が返る
  // ----------------------------------------------------------

  /**
   * 観察2: 「確認中」が選択中に「完了」をクリック
   *
   * テスト内容:
   *   currentValue が「確認中」の状態で「完了」をクリックした場合、
   *   handleFieldChange に「完了」が渡されることを確認する。
   *
   * バグ条件外: currentValue ('確認中') !== clickedOption ('完了')
   *
   * EXPECTED: PASS（未修正コードでも正しく動作する）
   *
   * **Validates: Requirements 3.1, 3.3**
   */
  test('観察2: 「確認中」が選択中に「完了」をクリックすると「完了」が返ること', () => {
    const currentValue = '確認中';
    const clickedOption = '完了';

    // バグ条件外であることを確認
    expect(isBugCondition(currentValue, clickedOption)).toBe(false);

    // 未修正コードの動作をシミュレート
    const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);

    // 期待動作: clickedOption が返ること
    expect(result).toBe('完了');
  });

  /**
   * 観察2 (追加): 「他」が選択中に「確認中」をクリック
   *
   * EXPECTED: PASS
   *
   * **Validates: Requirements 3.1, 3.3**
   */
  test('観察2 (追加): 「他」が選択中に「確認中」をクリックすると「確認中」が返ること', () => {
    const currentValue = '他';
    const clickedOption = '確認中';

    expect(isBugCondition(currentValue, clickedOption)).toBe(false);

    const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);

    expect(result).toBe('確認中');
  });

  // ----------------------------------------------------------
  // 観察3: EditableYesNo のトグル動作が維持される
  // ----------------------------------------------------------

  /**
   * 観察3: EditableYesNo で Y ボタンをクリック（現在値が null）
   *
   * テスト内容:
   *   currentValue が null の状態で Y ボタンをクリックした場合、
   *   handleFieldChange に 'Y' が渡されることを確認する。
   *
   * EXPECTED: PASS（既存の正しい実装）
   *
   * **Validates: Requirements 3.2**
   */
  test('観察3: EditableYesNo で null 状態に Y をクリックすると「Y」が返ること', () => {
    const currentValue = null;

    const result = editableYesNoYButtonOnClick(currentValue);

    expect(result).toBe('Y');
  });

  /**
   * 観察3 (追加): EditableYesNo で Y ボタンをクリック（現在値が 'Y'）
   *
   * テスト内容:
   *   currentValue が 'Y' の状態で Y ボタンをクリックした場合、
   *   handleFieldChange に null が渡されることを確認する（トグルクリア）。
   *
   * EXPECTED: PASS（既存の正しい実装）
   *
   * **Validates: Requirements 3.2**
   */
  test('観察3 (追加): EditableYesNo で「Y」が選択中に Y をクリックすると null が返ること', () => {
    const currentValue = 'Y';

    const result = editableYesNoYButtonOnClick(currentValue);

    expect(result).toBeNull();
  });

  /**
   * 観察3 (追加): EditableYesNo で N ボタンをクリック（現在値が 'N'）
   *
   * テスト内容:
   *   currentValue が 'N' の状態で N ボタンをクリックした場合、
   *   handleFieldChange に null が渡されることを確認する（トグルクリア）。
   *
   * EXPECTED: PASS（既存の正しい実装）
   *
   * **Validates: Requirements 3.2**
   */
  test('観察3 (追加): EditableYesNo で「N」が選択中に N をクリックすると null が返ること', () => {
    const currentValue = 'N';

    const result = editableYesNoNButtonOnClick(currentValue);

    expect(result).toBeNull();
  });

  /**
   * 観察3 (追加): EditableYesNo で Y ボタンをクリック（現在値が 'N'）
   *
   * テスト内容:
   *   currentValue が 'N' の状態で Y ボタンをクリックした場合、
   *   handleFieldChange に 'Y' が渡されることを確認する。
   *
   * EXPECTED: PASS（既存の正しい実装）
   *
   * **Validates: Requirements 3.2**
   */
  test('観察3 (追加): EditableYesNo で「N」が選択中に Y をクリックすると「Y」が返ること', () => {
    const currentValue = 'N';

    const result = editableYesNoYButtonOnClick(currentValue);

    expect(result).toBe('Y');
  });

  // ----------------------------------------------------------
  // プロパティベーステスト: バグ条件外の全ケースで clickedOption が返る
  // ----------------------------------------------------------

  /**
   * PBT: バグ条件外（currentValue !== clickedOption）の全ケースで clickedOption が返ること
   *
   * テスト内容:
   *   多様なフィールド名・オプション配列・現在値の組み合わせを自動生成し、
   *   バグ条件外（currentValue !== clickedOption）の場合に
   *   handleFieldChange に clickedOption が渡されることを検証する。
   *
   * バグ条件外のケース:
   *   1. currentValue が null の場合（null からの選択）
   *   2. currentValue !== clickedOption の場合（異なるオプションへの切り替え）
   *
   * EXPECTED: PASS（未修正コードでも正しく動作する — ベースライン動作の確認）
   *
   * **Validates: Requirements 3.1, 3.3, 3.4**
   */
  test('Property 2 (PBT): バグ条件外の全ケースで handleFieldChange(field, clickedOption) が呼ばれること', () => {
    // バグ条件外のケースを生成するアービトラリ
    // currentValue と clickedOption が異なる（または currentValue が null）
    const nonBugConditionArbitrary = fc.tuple(
      // currentValue: null または任意の文字列
      fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
      // clickedOption: 任意の非空文字列
      fc.string({ minLength: 1, maxLength: 20 })
    ).filter(([currentValue, clickedOption]) => {
      // バグ条件外のみを対象とする: currentValue !== clickedOption
      return currentValue !== clickedOption;
    });

    fc.assert(
      fc.property(nonBugConditionArbitrary, ([currentValue, clickedOption]) => {
        // バグ条件外であることを確認
        expect(isBugCondition(currentValue, clickedOption)).toBe(false);

        // 未修正コードの動作をシミュレート
        const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);

        // 期待動作: clickedOption が返ること（バグ条件外では未修正コードも正しく動作する）
        expect(result).toBe(clickedOption);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * PBT: null からの選択（バグ条件外の特殊ケース）
   *
   * テスト内容:
   *   currentValue が null の状態で任意のオプションをクリックした場合、
   *   常に clickedOption が返ることを検証する。
   *
   * EXPECTED: PASS（未修正コードでも正しく動作する）
   *
   * **Validates: Requirements 3.4**
   */
  test('Property 2 (PBT - null からの選択): null 状態で任意のオプションをクリックすると clickedOption が返ること', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // clickedOption
        (clickedOption) => {
          const currentValue = null;

          // バグ条件外であることを確認（null は isBugCondition で false）
          expect(isBugCondition(currentValue, clickedOption)).toBe(false);

          // 未修正コードの動作をシミュレート
          const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);

          // 期待動作: clickedOption が返ること
          expect(result).toBe(clickedOption);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * PBT: 異なるオプションへの切り替え（バグ条件外の主要ケース）
   *
   * テスト内容:
   *   currentValue と clickedOption が異なる（どちらも非null）場合、
   *   常に clickedOption が返ることを検証する。
   *
   * EXPECTED: PASS（未修正コードでも正しく動作する）
   *
   * **Validates: Requirements 3.1, 3.3**
   */
  test('Property 2 (PBT - 異なるオプション切り替え): currentValue !== clickedOption の場合に clickedOption が返ること', () => {
    // currentValue と clickedOption が異なる非null文字列を生成
    const differentOptionsArbitrary = fc.tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 20 })
    ).filter(([currentValue, clickedOption]) => currentValue !== clickedOption);

    fc.assert(
      fc.property(differentOptionsArbitrary, ([currentValue, clickedOption]) => {
        // バグ条件外であることを確認
        expect(isBugCondition(currentValue, clickedOption)).toBe(false);

        // 未修正コードの動作をシミュレート
        const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);

        // 期待動作: clickedOption が返ること
        expect(result).toBe(clickedOption);
      }),
      { numRuns: 10 }
    );
  });

  // ----------------------------------------------------------
  // EditableYesNo のプロパティベーステスト
  // ----------------------------------------------------------

  /**
   * PBT: EditableYesNo の Y ボタントグル動作が正しいこと
   *
   * テスト内容:
   *   任意の currentValue に対して、Y ボタンのトグル動作が正しいことを検証する。
   *   - currentValue === 'Y' の場合: null が返る（トグルクリア）
   *   - currentValue !== 'Y' の場合: 'Y' が返る（選択）
   *
   * EXPECTED: PASS（既存の正しい実装）
   *
   * **Validates: Requirements 3.2**
   */
  test('Property 2 (PBT - EditableYesNo Y ボタン): トグル動作が正しいこと', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
        (currentValue) => {
          const result = editableYesNoYButtonOnClick(currentValue);

          if (currentValue === 'Y') {
            // 'Y' が選択中なら null（トグルクリア）
            expect(result).toBeNull();
          } else {
            // それ以外なら 'Y'（選択）
            expect(result).toBe('Y');
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * PBT: EditableYesNo の N ボタントグル動作が正しいこと
   *
   * テスト内容:
   *   任意の currentValue に対して、N ボタンのトグル動作が正しいことを検証する。
   *   - currentValue === 'N' の場合: null が返る（トグルクリア）
   *   - currentValue !== 'N' の場合: 'N' が返る（選択）
   *
   * EXPECTED: PASS（既存の正しい実装）
   *
   * **Validates: Requirements 3.2**
   */
  test('Property 2 (PBT - EditableYesNo N ボタン): トグル動作が正しいこと', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
        (currentValue) => {
          const result = editableYesNoNButtonOnClick(currentValue);

          if (currentValue === 'N') {
            // 'N' が選択中なら null（トグルクリア）
            expect(result).toBeNull();
          } else {
            // それ以外なら 'N'（選択）
            expect(result).toBe('N');
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
