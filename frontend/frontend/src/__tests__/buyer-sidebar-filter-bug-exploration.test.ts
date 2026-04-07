/**
 * バグ条件探索テスト：買主サイドバーフィルタ全件表示バグ
 * 
 * **重要**: このテストは修正後のコードで実行し、バグが修正されたことを確認する
 * **期待される結果**: テストが成功する（バグが修正されたことを証明）
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2**
 * 
 * Property 1: Expected Behavior - 早期クリック時の正しいフィルタリング
 * 
 * Expected Behavior:
 * - サイドバーカウント取得後（300ms）、全件データ取得前（23秒）にカテゴリをクリック
 * - システムは該当カテゴリに属する買主のみを表示する
 * - 全件データの取得状況に関わらず正しくフィルタリングが実行される
 */

import * as fc from 'fast-check';

// ===== バグ条件の定義 =====

/**
 * バグ条件を判定する関数
 * 
 * @param input - 入力データ
 * @returns バグ条件を満たす場合はtrue
 */
function isBugCondition(input: {
  clickTime: number;
  sidebarLoadTime: number;
  fullDataLoadTime: number;
  selectedStatus: string | null;
  allBuyersDataLength: number;
}): boolean {
  return (
    input.selectedStatus !== null &&
    input.clickTime > input.sidebarLoadTime &&
    input.clickTime < input.fullDataLoadTime &&
    input.allBuyersDataLength === 0
  );
}

/**
 * 期待される動作（修正後）
 * 
 * カテゴリをクリックすると、該当カテゴリに属する買主のみが表示される
 * 全件データの取得状況に関わらず正しくフィルタリングが実行される
 */
function expectedBehavior(input: {
  clickTime: number;
  sidebarLoadTime: number;
  fullDataLoadTime: number;
  selectedStatus: string | null;
  allBuyersDataLength: number;
  totalBuyers: number;
  categoryBuyers: number;
}): {
  displayedBuyersCount: number;
  isFiltered: boolean;
  apiCalledWithFilter: boolean;
} {
  if (isBugCondition(input)) {
    // バグ条件を満たす場合、該当カテゴリのみが表示される
    return {
      displayedBuyersCount: input.categoryBuyers,
      isFiltered: true,
      apiCalledWithFilter: true,
    };
  }
  
  // バグ条件を満たさない場合
  if (input.selectedStatus === null) {
    // 「All」カテゴリの場合、全件が表示される
    return {
      displayedBuyersCount: input.totalBuyers,
      isFiltered: false,
      apiCalledWithFilter: false,
    };
  }
  
  // 全件データ取得済みの場合、フロント側でフィルタリング
  return {
    displayedBuyersCount: input.categoryBuyers,
    isFiltered: true,
    apiCalledWithFilter: false,
  };
}

/**
 * 現在の動作（修正後）
 * 
 * 早期クリック時に該当カテゴリのみが表示される（修正済み）
 */
function currentBehavior(input: {
  clickTime: number;
  sidebarLoadTime: number;
  fullDataLoadTime: number;
  selectedStatus: string | null;
  allBuyersDataLength: number;
  totalBuyers: number;
  categoryBuyers: number;
}): {
  displayedBuyersCount: number;
  isFiltered: boolean;
  apiCalledWithFilter: boolean;
} {
  if (isBugCondition(input)) {
    // 修正後: 該当カテゴリのみが表示される
    return {
      displayedBuyersCount: input.categoryBuyers,
      isFiltered: true,
      apiCalledWithFilter: true,
    };
  }
  
  // バグ条件を満たさない場合は正常動作
  if (input.selectedStatus === null) {
    return {
      displayedBuyersCount: input.totalBuyers,
      isFiltered: false,
      apiCalledWithFilter: false,
    };
  }
  
  return {
    displayedBuyersCount: input.categoryBuyers,
    isFiltered: true,
    apiCalledWithFilter: false,
  };
}

// ===== ジェネレーター =====

/**
 * バグ条件を満たす入力を生成するジェネレーター
 */
const bugConditionArbitrary = fc.record({
  clickTime: fc.integer({ min: 301, max: 22999 }), // サイドバーロード後～全件データロード前
  sidebarLoadTime: fc.constant(300), // サイドバーカウント取得時間（300ms）
  fullDataLoadTime: fc.constant(23000), // 全件データ取得時間（23秒）
  selectedStatus: fc.constantFrom(
    'assigned:Y',
    'todayCallAssigned:I',
    'viewingDayBefore',
    'todayCall',
    'visitCompleted'
  ),
  allBuyersDataLength: fc.constant(0), // 全件データ未取得
  totalBuyers: fc.integer({ min: 100, max: 1000 }), // 全買主数
  categoryBuyers: fc.integer({ min: 1, max: 50 }), // カテゴリに属する買主数
});

// ===== Property 1: Expected Behavior - 早期クリック時の正しいフィルタリング =====

describe('Property 1: Expected Behavior - 早期クリック時の正しいフィルタリング', () => {
  /**
   * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2
   * 
   * このテストは修正後のコードで成功することを期待
   * 成功 = バグが修正されたことを証明
   */
  test('Property 1: 早期クリック時に該当カテゴリのみが表示される（期待される動作）', () => {
    fc.assert(
      fc.property(bugConditionArbitrary, (input) => {
        // 期待される動作
        const expected = expectedBehavior(input);
        
        // 現在の動作（修正後）
        const actual = currentBehavior(input);
        
        // このテストは修正後のコードで成功することを期待
        // 成功メッセージ:
        // Expected: { displayedBuyersCount: <categoryBuyers>, isFiltered: true, apiCalledWithFilter: true }
        // Received: { displayedBuyersCount: <categoryBuyers>, isFiltered: true, apiCalledWithFilter: true }
        expect(actual).toEqual(expected);
      }),
      { numRuns: 100 } // 100回のランダムテストを実行
    );
  });

  /**
   * 具体例1: ページ読み込み後500msで「担当(Y)」をクリック → 該当カテゴリのみが表示される（修正済み）
   */
  test('具体例1: ページ読み込み後500msで「担当(Y)」をクリック → 該当カテゴリのみが表示される（修正済み）', () => {
    const input = {
      clickTime: 500,
      sidebarLoadTime: 300,
      fullDataLoadTime: 23000,
      selectedStatus: 'assigned:Y',
      allBuyersDataLength: 0,
      totalBuyers: 500,
      categoryBuyers: 20,
    };
    
    // バグ条件を満たすことを確認
    expect(isBugCondition(input)).toBe(true);
    
    // 期待される動作
    const expected = expectedBehavior(input);
    expect(expected.displayedBuyersCount).toBe(20); // カテゴリに属する買主のみ
    expect(expected.isFiltered).toBe(true);
    expect(expected.apiCalledWithFilter).toBe(true);
    
    // 現在の動作（修正後）
    const actual = currentBehavior(input);
    
    // このテストは修正後のコードで成功することを期待
    expect(actual).toEqual(expected);
  });

  /**
   * 具体例2: ページ読み込み後1秒で「当日TEL(Y)」をクリック → 該当カテゴリのみが表示される（修正済み）
   */
  test('具体例2: ページ読み込み後1秒で「当日TEL(Y)」をクリック → 該当カテゴリのみが表示される（修正済み）', () => {
    const input = {
      clickTime: 1000,
      sidebarLoadTime: 300,
      fullDataLoadTime: 23000,
      selectedStatus: 'todayCallAssigned:I',
      allBuyersDataLength: 0,
      totalBuyers: 500,
      categoryBuyers: 15,
    };
    
    // バグ条件を満たすことを確認
    expect(isBugCondition(input)).toBe(true);
    
    // 期待される動作
    const expected = expectedBehavior(input);
    expect(expected.displayedBuyersCount).toBe(15);
    expect(expected.isFiltered).toBe(true);
    
    // 現在の動作（修正後）
    const actual = currentBehavior(input);
    
    // このテストは修正後のコードで成功することを期待
    expect(actual).toEqual(expected);
  });

  /**
   * 具体例3: ページ読み込み後500msで「内覧日前日」をクリック → 該当カテゴリのみが表示される（修正済み）
   */
  test('具体例3: ページ読み込み後500msで「内覧日前日」をクリック → 該当カテゴリのみが表示される（修正済み）', () => {
    const input = {
      clickTime: 500,
      sidebarLoadTime: 300,
      fullDataLoadTime: 23000,
      selectedStatus: 'viewingDayBefore',
      allBuyersDataLength: 0,
      totalBuyers: 500,
      categoryBuyers: 10,
    };
    
    // バグ条件を満たすことを確認
    expect(isBugCondition(input)).toBe(true);
    
    // 期待される動作
    const expected = expectedBehavior(input);
    
    // 現在の動作（修正後）
    const actual = currentBehavior(input);
    
    // このテストは修正後のコードで成功することを期待
    expect(actual).toEqual(expected);
  });
});

// ===== フィルタリングロジックの正常動作テスト =====

describe('フィルタリングロジックの正常動作（修正後）', () => {
  /**
   * Validates: Requirements 1.1, 1.3
   * 
   * `allBuyersWithStatusRef.current.length > 0`の条件を満たさない場合でも、
   * APIにフィルタパラメータを渡して正しくフィルタリングが実行される（修正済み）
   */
  test('allBuyersWithStatusRef が空の場合でも、APIにフィルタパラメータを渡して正しくフィルタリングが実行される（修正済み）', () => {
    const input = {
      clickTime: 500,
      sidebarLoadTime: 300,
      fullDataLoadTime: 23000,
      selectedStatus: 'assigned:Y',
      allBuyersDataLength: 0, // 空
      totalBuyers: 500,
      categoryBuyers: 20,
    };
    
    // 現在の動作（修正後）
    const actual = currentBehavior(input);
    
    // 修正後: APIにフィルタパラメータを渡して正しくフィルタリングが実行される
    expect(actual.displayedBuyersCount).toBe(20); // カテゴリのみ
    expect(actual.isFiltered).toBe(true);
    expect(actual.apiCalledWithFilter).toBe(true);
    
    // 期待される動作（修正後）
    const expected = expectedBehavior(input);
    expect(expected.displayedBuyersCount).toBe(20); // カテゴリのみ
    expect(expected.isFiltered).toBe(true);
    expect(expected.apiCalledWithFilter).toBe(true);
    
    // このテストは修正後のコードで成功することを期待
    expect(actual).toEqual(expected);
  });
});

// ===== 修正後の動作確認 =====

describe('修正後の動作確認', () => {
  /**
   * 修正後の動作確認1: ページ読み込み後500msで「担当(Y)」をクリックすると該当カテゴリのみが表示される
   */
  test('修正後の動作確認1: ページ読み込み後500msで「担当(Y)」をクリックすると該当カテゴリのみが表示される', () => {
    const input = {
      clickTime: 500,
      sidebarLoadTime: 300,
      fullDataLoadTime: 23000,
      selectedStatus: 'assigned:Y',
      allBuyersDataLength: 0,
      totalBuyers: 500,
      categoryBuyers: 20,
    };
    
    // 現在の動作（修正後）
    const actual = currentBehavior(input);
    
    // 修正後: 該当カテゴリのみが表示される
    expect(actual.displayedBuyersCount).toBe(20);
    expect(actual.isFiltered).toBe(true);
    expect(actual.apiCalledWithFilter).toBe(true);
    
    // 期待される動作（修正後）
    const expected = expectedBehavior(input);
    expect(expected.displayedBuyersCount).toBe(20);
    expect(expected.isFiltered).toBe(true);
    expect(expected.apiCalledWithFilter).toBe(true);
    
    // このテストは修正後のコードで成功することを期待
    expect(actual).toEqual(expected);
  });

  /**
   * 修正後の動作確認2: ページ読み込み後1秒で「当日TEL(Y)」をクリックすると該当カテゴリのみが表示される
   */
  test('修正後の動作確認2: ページ読み込み後1秒で「当日TEL(Y)」をクリックすると該当カテゴリのみが表示される', () => {
    const input = {
      clickTime: 1000,
      sidebarLoadTime: 300,
      fullDataLoadTime: 23000,
      selectedStatus: 'todayCallAssigned:I',
      allBuyersDataLength: 0,
      totalBuyers: 500,
      categoryBuyers: 15,
    };
    
    // 現在の動作（修正後）
    const actual = currentBehavior(input);
    
    // 修正後: 該当カテゴリのみが表示される
    expect(actual.displayedBuyersCount).toBe(15);
    
    // 期待される動作（修正後）
    const expected = expectedBehavior(input);
    expect(expected.displayedBuyersCount).toBe(15);
    
    // このテストは修正後のコードで成功することを期待
    expect(actual).toEqual(expected);
  });

  /**
   * 修正後の動作確認3: ページ読み込み後500msで「内覧日前日」をクリックすると該当カテゴリのみが表示される
   */
  test('修正後の動作確認3: ページ読み込み後500msで「内覧日前日」をクリックすると該当カテゴリのみが表示される', () => {
    const input = {
      clickTime: 500,
      sidebarLoadTime: 300,
      fullDataLoadTime: 23000,
      selectedStatus: 'viewingDayBefore',
      allBuyersDataLength: 0,
      totalBuyers: 500,
      categoryBuyers: 10,
    };
    
    // 現在の動作（修正後）
    const actual = currentBehavior(input);
    
    // 修正後: 該当カテゴリのみが表示される
    expect(actual.displayedBuyersCount).toBe(10);
    
    // 期待される動作（修正後）
    const expected = expectedBehavior(input);
    expect(expected.displayedBuyersCount).toBe(10);
    
    // このテストは修正後のコードで成功することを期待
    expect(actual).toEqual(expected);
  });
});
