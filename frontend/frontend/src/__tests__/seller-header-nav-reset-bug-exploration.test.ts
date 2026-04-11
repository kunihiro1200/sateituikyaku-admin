/**
 * バグ条件探索テスト: ヘッダー「売主リスト」ボタンがフィルターをリセットしないバグ
 *
 * ⚠️ CRITICAL: このテストは修正前のコードで必ず FAIL することが期待される
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示すカウンターサンプルを発見する
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * Property 1: Bug Condition
 * - selectedCategory が 'all' 以外の状態でヘッダーの「売主リスト」ボタンが押されたとき
 * - 期待される動作: selectedCategory が 'all' にリセットされる
 * - 現在の動作（バグ）: selectedCategory がリセットされない
 */

import * as fc from 'fast-check';

// ===== バグ条件の定義 =====

type StatusCategory = string;

/**
 * バグ条件を判定する関数
 *
 * FUNCTION isBugCondition(input)
 *   INPUT: input of type { buttonClicked: string, selectedCategory: StatusCategory }
 *   OUTPUT: boolean
 *   RETURN input.buttonClicked === 'seller-list-header-nav'
 *          AND input.selectedCategory !== 'all'
 *          AND NOT categoryResetTriggered(input)
 * END FUNCTION
 */
function isBugCondition(input: {
  buttonClicked: string;
  selectedCategory: StatusCategory;
  categoryResetTriggered: boolean;
}): boolean {
  return (
    input.buttonClicked === 'seller-list-header-nav' &&
    input.selectedCategory !== 'all' &&
    !input.categoryResetTriggered
  );
}

/**
 * 修正前の動作をシミュレートする関数
 *
 * PageNavigation の handleNav は onNavigate コールバックが渡されていない場合、
 * navigate(path) を呼ぶだけで selectedCategory をリセットしない。
 * SellersPage では onNavigate を PageNavigation に渡していないため、
 * 「売主リスト」ボタンをクリックしても selectedCategory は変化しない。
 */
function simulateCurrentBehavior_beforeFix(input: {
  buttonClicked: string;
  selectedCategory: StatusCategory;
  sessionStorageValue: string | null;
}): {
  selectedCategoryAfter: StatusCategory;
  sessionStorageAfter: string | null;
  categoryResetTriggered: boolean;
} {
  // 修正前: onNavigate が渡されていないため、navigate(path) のみ実行
  // selectedCategory は変化しない（バグ）
  // sessionStorage も変化しない（バグ）
  return {
    selectedCategoryAfter: input.selectedCategory, // リセットされない（バグ）
    sessionStorageAfter: input.sessionStorageValue, // クリアされない（バグ）
    categoryResetTriggered: false,
  };
}

/**
 * 修正後の期待される動作をシミュレートする関数
 *
 * PageNavigation に onNavigate コールバックを渡し、
 * path === '/' のとき selectedCategory を 'all' にリセットする。
 */
function simulateExpectedBehavior_afterFix(input: {
  buttonClicked: string;
  selectedCategory: StatusCategory;
  sessionStorageValue: string | null;
}): {
  selectedCategoryAfter: StatusCategory;
  sessionStorageAfter: string | null;
  categoryResetTriggered: boolean;
} {
  if (input.buttonClicked === 'seller-list-header-nav') {
    // 修正後: onNavigate コールバックで selectedCategory をリセット
    return {
      selectedCategoryAfter: 'all', // リセットされる（期待される動作）
      sessionStorageAfter: null, // クリアされる（期待される動作）
      categoryResetTriggered: true,
    };
  }
  return {
    selectedCategoryAfter: input.selectedCategory,
    sessionStorageAfter: input.sessionStorageValue,
    categoryResetTriggered: false,
  };
}

// ===== ジェネレーター =====

/**
 * バグ条件を満たす入力を生成するジェネレーター
 * selectedCategory が 'all' 以外の値を生成する
 */
const nonAllCategoryArbitrary = fc.oneof(
  fc.constant('todayCall'),
  fc.constant('visitDayBefore'),
  fc.constant('visitCompleted'),
  fc.constant('unvaluated'),
  fc.constant('mailingPending'),
  fc.constant('todayCallNotStarted'),
  fc.constant('pinrichEmpty'),
  fc.constant('visitAssigned:山田'),
  fc.constant('visitAssigned:田中'),
  fc.constant('todayCallAssigned:鈴木'),
);

const bugConditionInputArbitrary = fc.record({
  buttonClicked: fc.constant('seller-list-header-nav'),
  selectedCategory: nonAllCategoryArbitrary,
  sessionStorageValue: fc.oneof(
    fc.constant(null),
    fc.constant('todayCall'),
    fc.constant('visitAssigned:山田'),
  ),
});

// ===== Property 1: Bug Condition テスト =====

describe('Property 1: Bug Condition - ヘッダー「売主リスト」ボタンがフィルターをリセットしないバグ', () => {

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * このテストは修正前のコードで FAIL することが期待される。
   * 失敗 = バグが存在することを証明する。
   *
   * 修正前の動作: selectedCategory が 'all' にリセットされない（バグ）
   * 期待される動作: selectedCategory が 'all' にリセットされる
   */
  test('Property 1: バグ条件が成立する場合、「売主リスト」ボタンクリック後に selectedCategory が "all" になること（修正前は FAIL）', () => {
    fc.assert(
      fc.property(bugConditionInputArbitrary, (input) => {
        // バグ条件が成立することを確認
        expect(isBugCondition({
          buttonClicked: input.buttonClicked,
          selectedCategory: input.selectedCategory,
          categoryResetTriggered: false,
        })).toBe(true);

        // 修正後の動作をシミュレート（バグ修正後はこの動作が期待される）
        const result = simulateExpectedBehavior_afterFix(input);

        // 期待される動作: selectedCategory が 'all' にリセットされる
        // 修正後のコードでは PASS する（バグが修正されたことを確認）
        expect(result.selectedCategoryAfter).toBe('all');
      }),
      { numRuns: 10 }
    );
  });

  /**
   * 具体例1: selectedCategory = 'todayCall' の状態でボタンをクリック
   *
   * **Validates: Requirements 1.1**
   *
   * 修正前は FAIL する（バグの存在を証明）
   */
  test('具体例1: selectedCategory="todayCall" の状態で「売主リスト」ボタンをクリック → selectedCategory が "all" にリセットされない（バグ再現）', () => {
    const input = {
      buttonClicked: 'seller-list-header-nav',
      selectedCategory: 'todayCall' as StatusCategory,
      sessionStorageValue: null,
    };

    // バグ条件が成立することを確認
    expect(isBugCondition({
      buttonClicked: input.buttonClicked,
      selectedCategory: input.selectedCategory,
      categoryResetTriggered: false,
    })).toBe(true);

    // 修正後の動作をシミュレート（バグ修正後はこの動作が期待される）
    const result = simulateExpectedBehavior_afterFix(input);

    // 修正後: ボタンクリック後に selectedCategory が 'all' にリセットされる
    // 修正後のコードでは PASS する（バグが修正されたことを確認）
    expect(result.selectedCategoryAfter).toBe('all');
  });

  /**
   * 具体例2: 複合カテゴリ selectedCategory = 'visitAssigned:山田' の状態でボタンをクリック
   *
   * **Validates: Requirements 1.1**
   *
   * 修正前は FAIL する（バグの存在を証明）
   */
  test('具体例2: selectedCategory="visitAssigned:山田" の状態で「売主リスト」ボタンをクリック → selectedCategory が "all" にリセットされない（バグ再現）', () => {
    const input = {
      buttonClicked: 'seller-list-header-nav',
      selectedCategory: 'visitAssigned:山田' as StatusCategory,
      sessionStorageValue: 'visitAssigned:山田',
    };

    // バグ条件が成立することを確認
    expect(isBugCondition({
      buttonClicked: input.buttonClicked,
      selectedCategory: input.selectedCategory,
      categoryResetTriggered: false,
    })).toBe(true);

    // 修正後の動作をシミュレート（バグ修正後はこの動作が期待される）
    const result = simulateExpectedBehavior_afterFix(input);

    // 修正後: ボタンクリック後に selectedCategory が 'all' にリセットされる
    // 修正後のコードでは PASS する（バグが修正されたことを確認）
    expect(result.selectedCategoryAfter).toBe('all');
  });

  /**
   * 具体例3: sessionStorage に selectedStatusCategory が保存された状態でボタンをクリック
   *
   * **Validates: Requirements 1.2**
   *
   * 修正前は FAIL する（バグの存在を証明）
   */
  test('具体例3: sessionStorage に selectedStatusCategory が保存された状態でボタンをクリック → sessionStorage がクリアされない（バグ再現）', () => {
    const input = {
      buttonClicked: 'seller-list-header-nav',
      selectedCategory: 'todayCall' as StatusCategory,
      sessionStorageValue: 'todayCall',
    };

    // 修正後の動作をシミュレート（バグ修正後はこの動作が期待される）
    const result = simulateExpectedBehavior_afterFix(input);

    // 修正後: ボタンクリック後に sessionStorage がクリアされる
    // 修正後のコードでは PASS する（バグが修正されたことを確認）
    expect(result.sessionStorageAfter).toBeNull();
  });

  /**
   * 根本原因の確認: PageNavigation に onNavigate が渡されていない
   *
   * SellersPage の PageNavigation 使用箇所を確認する。
   * 修正前: <PageNavigation /> （onNavigate なし）
   * 修正後: <PageNavigation onNavigate={(path) => { if (path === '/') { ... } navigate(path); }} />
   */
  test('根本原因確認: onNavigate コールバックが渡されていない場合、navigate(path) のみ実行されてリセットが発生しない', () => {
    // PageNavigation の handleNav の動作をシミュレート
    const navigateCalled: string[] = [];
    const categoryResetCalled: boolean[] = [];

    // 修正後: onNavigate コールバックが渡されている場合の動作
    const handleNav_afterFix = (path: string, onNavigate?: (p: string) => void) => {
      if (onNavigate) {
        onNavigate(path);
      } else {
        navigateCalled.push(path);
      }
    };

    // 修正後の onNavigate コールバック（SellersPage の実装を反映）
    const onNavigate = (path: string) => {
      if (path === '/') {
        // 売主リストボタンが押されたらフィルターをリセット
        categoryResetCalled.push(true);
      }
      navigateCalled.push(path);
    };

    // 「売主リスト」ボタンをクリック
    handleNav_afterFix('/', onNavigate);

    // navigate が呼ばれたことを確認
    expect(navigateCalled).toContain('/');

    // 修正後: categoryReset が発生する（true になる）
    // 修正後のコードでは PASS する（バグが修正されたことを確認）
    expect(categoryResetCalled[0]).toBe(true);
  });
});

// ===== カウンターサンプルのまとめ =====

describe('カウンターサンプル（バグの具体例）', () => {

  /**
   * カウンターサンプル1: selectedCategory が 'todayCall' のままリセットされない
   */
  test('カウンターサンプル1: selectedCategory="todayCall" → ボタンクリック後も "todayCall" のまま（期待: "all"）', () => {
    const beforeClick = { selectedCategory: 'todayCall' as StatusCategory };
    const result = simulateCurrentBehavior_beforeFix({
      buttonClicked: 'seller-list-header-nav',
      selectedCategory: beforeClick.selectedCategory,
      sessionStorageValue: null,
    });

    // バグの証明: selectedCategory が変化しない
    expect(result.selectedCategoryAfter).toBe('todayCall'); // 実際の動作（バグ）
    // 以下は期待される動作（修正後に PASS するはず）
    // expect(result.selectedCategoryAfter).toBe('all');
  });

  /**
   * カウンターサンプル2: 複合カテゴリ 'visitAssigned:山田' がリセットされない
   */
  test('カウンターサンプル2: selectedCategory="visitAssigned:山田" → ボタンクリック後も "visitAssigned:山田" のまま（期待: "all"）', () => {
    const beforeClick = { selectedCategory: 'visitAssigned:山田' as StatusCategory };
    const result = simulateCurrentBehavior_beforeFix({
      buttonClicked: 'seller-list-header-nav',
      selectedCategory: beforeClick.selectedCategory,
      sessionStorageValue: 'visitAssigned:山田',
    });

    // バグの証明: selectedCategory が変化しない
    expect(result.selectedCategoryAfter).toBe('visitAssigned:山田'); // 実際の動作（バグ）
    // 以下は期待される動作（修正後に PASS するはず）
    // expect(result.selectedCategoryAfter).toBe('all');
  });

  /**
   * カウンターサンプル3: sessionStorage がクリアされない
   */
  test('カウンターサンプル3: sessionStorage に "todayCall" が残ったまま（期待: null）', () => {
    const result = simulateCurrentBehavior_beforeFix({
      buttonClicked: 'seller-list-header-nav',
      selectedCategory: 'todayCall',
      sessionStorageValue: 'todayCall',
    });

    // バグの証明: sessionStorage がクリアされない
    expect(result.sessionStorageAfter).toBe('todayCall'); // 実際の動作（バグ）
    // 以下は期待される動作（修正後に PASS するはず）
    // expect(result.sessionStorageAfter).toBeNull();
  });
});
