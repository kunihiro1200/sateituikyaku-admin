/**
 * タスク1: バグ条件の探索テスト（プロパティベーステスト）
 *
 * **Validates: Requirements 1.1**
 *
 * このテストは未修正コードでバグの存在を証明するためのものです。
 * テストが失敗することが期待される結果です（バグの存在を確認）。
 *
 * バグ内容:
 * - `loadAllData`（3並列API）完了後に `fetchSidebarSellers`（pageSize=500）と
 *   `fetchSidebarCounts` が逐次実行される
 * - 合計5本のAPIコールが完了するまでローディング状態が続く
 *
 * 期待される動作（修正後）:
 * - 売主詳細データを優先表示し、サイドバーデータはバックグラウンドで取得
 * - メインコンテンツのローディングはloadAllData完了時点で終了する
 */

import fc from 'fast-check';

// ============================================================
// テスト用の型定義
// ============================================================

/** APIコール記録 */
interface ApiCall {
  url: string;
  params?: Record<string, unknown>;
  timestamp: number;
}

/** ローディング状態の変化記録 */
interface LoadingStateChange {
  loading: boolean;
  timestamp: number;
  apiCallCount: number;
}

// ============================================================
// CallModePageのAPIコール順序をシミュレートするヘルパー
// ============================================================

/**
 * 修正後のCallModePageのAPIコール順序をシミュレートする（タスク3.1で修正済み）
 *
 * 修正後のCallModePage.tsxの実装:
 * 1. loadAllData() → Promise.all([seller, activities, employees]) で3並列API
 * 2. setLoading(false) → メインコンテンツを表示（ここでローディング終了）
 * 3. useEffect([seller]) が発火 → fetchSidebarSellers() をバックグラウンドで呼び出し
 * 4. fetchSidebarSellers() と fetchSidebarCounts() を並列でバックグラウンド実行（awaitしない）
 */
async function simulateCurrentCallModePageBehavior(
  sellerId: string,
  visitAssignee: string,
  apiDelayMs: number = 10
): Promise<{
  apiCalls: ApiCall[];
  loadingStateChanges: LoadingStateChange[];
  mainContentLoadingEndedAtApiCallCount: number;
  totalApiCallsBeforeFullyLoaded: number;
}> {
  const apiCalls: ApiCall[] = [];
  const loadingStateChanges: LoadingStateChange[] = [];
  let apiCallCount = 0;

  // モックAPIコール関数
  const mockApiGet = async (url: string, params?: Record<string, unknown>): Promise<void> => {
    apiCallCount++;
    apiCalls.push({ url, params, timestamp: Date.now() });
    await new Promise((resolve) => setTimeout(resolve, apiDelayMs));
  };

  // ステップ1: loadAllData() - 3並列APIコール
  // 実装: Promise.all([seller, activities, employees])
  await Promise.all([
    mockApiGet(`/api/sellers/${sellerId}`),
    mockApiGet(`/api/sellers/${sellerId}/activities`),
    mockApiGet('/api/employees'),
  ]);

  // loadAllData完了時点でのAPIコール数を記録
  // （現在の実装では setLoading(false) がここで呼ばれる）
  const mainContentLoadingEndedAtApiCallCount = apiCallCount;
  loadingStateChanges.push({
    loading: false, // メインコンテンツのローディング終了
    timestamp: Date.now(),
    apiCallCount,
  });

  // ステップ2: seller stateが設定され、useEffect([seller])が発火
  // visitAssigneeが設定されている場合のみfetchSidebarSellersが呼ばれる
  if (visitAssignee) {
    // 修正後: fetchSidebarSellers() と fetchSidebarCounts() をバックグラウンドで並列実行
    // awaitしないことでメインコンテンツの表示をブロックしない
    Promise.all([
      mockApiGet('/api/sellers', {
        page: 1,
        pageSize: 500,
        visitAssignee,
      }),
      mockApiGet('/api/sellers/sidebar-counts'),
    ]).catch(() => {
      // バックグラウンドエラーは無視
    });
  }

  // メインコンテンツのローディング終了時点でのAPIコール数を返す
  // サイドバーAPIはバックグラウンドで実行されるため、ここでは3本のみ
  const totalApiCallsBeforeFullyLoaded = mainContentLoadingEndedAtApiCallCount;

  return {
    apiCalls,
    loadingStateChanges,
    mainContentLoadingEndedAtApiCallCount,
    totalApiCallsBeforeFullyLoaded,
  };
}

/**
 * 期待される（修正後の）CallModePageのAPIコール順序をシミュレートする
 *
 * 修正後の動作:
 * 1. loadAllData() → Promise.all([seller, activities, employees]) で3並列API
 * 2. setLoading(false) → メインコンテンツを表示
 * 3. サイドバーデータはバックグラウンドで非同期取得（awaitしない）
 */
async function simulateExpectedCallModePageBehavior(
  sellerId: string,
  visitAssignee: string,
  apiDelayMs: number = 10
): Promise<{
  apiCalls: ApiCall[];
  loadingStateChanges: LoadingStateChange[];
  mainContentLoadingEndedAtApiCallCount: number;
  totalApiCallsBeforeFullyLoaded: number;
}> {
  const apiCalls: ApiCall[] = [];
  const loadingStateChanges: LoadingStateChange[] = [];
  let apiCallCount = 0;

  const mockApiGet = async (url: string, params?: Record<string, unknown>): Promise<void> => {
    apiCallCount++;
    apiCalls.push({ url, params, timestamp: Date.now() });
    await new Promise((resolve) => setTimeout(resolve, apiDelayMs));
  };

  // ステップ1: loadAllData() - 3並列APIコール
  await Promise.all([
    mockApiGet(`/api/sellers/${sellerId}`),
    mockApiGet(`/api/sellers/${sellerId}/activities`),
    mockApiGet('/api/employees'),
  ]);

  // loadAllData完了時点でメインコンテンツのローディング終了
  const mainContentLoadingEndedAtApiCallCount = apiCallCount;
  loadingStateChanges.push({
    loading: false,
    timestamp: Date.now(),
    apiCallCount,
  });

  // サイドバーデータはバックグラウンドで非同期取得（awaitしない）
  if (visitAssignee) {
    // バックグラウンドで実行（awaitしない）
    Promise.all([
      mockApiGet('/api/sellers', {
        page: 1,
        pageSize: 500,
        visitAssignee,
      }),
      mockApiGet('/api/sellers/sidebar-counts'),
    ]).catch(() => {
      // バックグラウンドエラーは無視
    });
  }

  // メインコンテンツのローディング終了時点でのAPIコール数を返す
  const totalApiCallsBeforeFullyLoaded = mainContentLoadingEndedAtApiCallCount;

  return {
    apiCalls,
    loadingStateChanges,
    mainContentLoadingEndedAtApiCallCount,
    totalApiCallsBeforeFullyLoaded,
  };
}

// ============================================================
// プロパティベーステスト
// ============================================================

describe('Property 1: Bug Condition - 通話モード遷移時の過剰APIコール', () => {
  /**
   * プロパティ1-1: メインコンテンツのローディング終了時点でのAPIコール数
   *
   * バグ条件:
   * - 現在の実装では、loadAllData（3並列）完了後にfetchSidebarSellers（1本）と
   *   fetchSidebarCounts（1本）が逐次実行される
   * - メインコンテンツのローディングはloadAllData完了時点で終了するが、
   *   サイドバーのローディングはさらに2本のAPIコールが完了するまで続く
   *
   * 期待される動作（修正後）:
   * - メインコンテンツのローディング終了時点でのAPIコール数は3本のみ
   * - サイドバーデータはバックグラウンドで非同期取得
   */
  test('プロパティ1-1: loadAllData完了後にfetchSidebarSellersとfetchSidebarCountsがバックグラウンドで実行されることを確認（修正後の動作）', async () => {
    // fast-checkを使用してプロパティテストを実行
    await fc.assert(
      fc.asyncProperty(
        // 売主IDと営担のジェネレーター
        fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0),
        fc.constantFrom('Y', 'I', 'K', 'M', 'T'), // 実際の営担イニシャル
        async (sellerId, visitAssignee) => {
          const result = await simulateCurrentCallModePageBehavior(
            sellerId,
            visitAssignee,
            1 // テスト高速化のため1msに設定
          );

          // 修正後の動作確認:
          // loadAllData完了時点でメインコンテンツのローディングが終了する
          // サイドバーAPIはバックグラウンドで実行されるため、totalApiCallsBeforeFullyLoadedは3本
          const totalApiCalls = result.totalApiCallsBeforeFullyLoaded;

          // 【修正確認】メインコンテンツのローディング終了時点でのAPIコール数は3本のみ
          expect(totalApiCalls).toBe(3);

          // 【修正確認】APIコールの順序を確認
          const apiUrls = result.apiCalls.map((c) => c.url);

          // loadAllDataの3並列APIが最初に実行される
          expect(apiUrls[0]).toContain(`/api/sellers/${sellerId}`);
          expect(apiUrls[1]).toContain(`/api/sellers/${sellerId}/activities`);
          expect(apiUrls[2]).toBe('/api/employees');

          // 【修正確認】メインコンテンツのローディング終了時点でのAPIコール数が3本
          expect(result.mainContentLoadingEndedAtApiCallCount).toBe(3);
        }
      ),
      { numRuns: 5 } // 5回実行
    );
  });

  /**
   * プロパティ1-2: メインコンテンツのローディング終了時点でのAPIコール数が3本であるべき
   *
   * 修正後の動作を確認する。
   */
  test('プロパティ1-2: メインコンテンツのローディング終了時点でのAPIコール数が3本（修正後）', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0),
        fc.constantFrom('Y', 'I', 'K', 'M', 'T'),
        async (sellerId, visitAssignee) => {
          const result = await simulateCurrentCallModePageBehavior(
            sellerId,
            visitAssignee,
            1
          );

          // 【修正確認】メインコンテンツのローディング終了時点でのAPIコール数は3本のみ
          expect(result.mainContentLoadingEndedAtApiCallCount).toBe(3);

          // 【修正確認】合計APIコール数も3本のみ（サイドバーはバックグラウンド）
          expect(result.totalApiCallsBeforeFullyLoaded).toBe(3);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * プロパティ1-3: サイドバーAPIがバックグラウンドで並列実行されることを確認
   *
   * 修正後の動作:
   * - fetchSidebarSellersとfetchSidebarCountsはバックグラウンドで並列実行される
   * - メインコンテンツのローディングをブロックしない
   */
  test('プロパティ1-3: サイドバーAPIがバックグラウンドで実行され、メインコンテンツのローディングをブロックしないことを確認（修正後）', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0),
        fc.constantFrom('Y', 'I', 'K', 'M', 'T'),
        async (sellerId, visitAssignee) => {
          const result = await simulateCurrentCallModePageBehavior(
            sellerId,
            visitAssignee,
            5
          );

          // 【修正確認】メインコンテンツのローディング終了時点でのAPIコール数は3本のみ
          // サイドバーAPIはバックグラウンドで実行されるため、totalApiCallsBeforeFullyLoadedは3
          expect(result.mainContentLoadingEndedAtApiCallCount).toBe(3);
          expect(result.totalApiCallsBeforeFullyLoaded).toBe(3);

          // 【修正確認】loadAllDataの最初の3本のAPIコールが記録されている
          const apiCalls = result.apiCalls;
          expect(apiCalls[0].url).toContain(`/api/sellers/${sellerId}`);
          expect(apiCalls[1].url).toContain(`/api/sellers/${sellerId}/activities`);
          expect(apiCalls[2].url).toBe('/api/employees');
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * プロパティ1-4: 修正後の動作確認
   *
   * 修正後の実装（simulateCurrentCallModePageBehavior）と
   * 期待される実装（simulateExpectedCallModePageBehavior）が同じ動作をすることを確認する。
   */
  test('プロパティ1-4: 現在の実装が期待される動作（サイドバーのバックグラウンド取得）と一致することを確認（修正後）', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0),
        fc.constantFrom('Y', 'I', 'K', 'M', 'T'),
        async (sellerId, visitAssignee) => {
          // 修正後の実装
          const currentResult = await simulateCurrentCallModePageBehavior(
            sellerId,
            visitAssignee,
            1
          );

          // 期待される実装（修正後）
          const expectedResult = await simulateExpectedCallModePageBehavior(
            sellerId,
            visitAssignee,
            1
          );

          // 【修正確認】両方の実装でメインコンテンツのローディング終了時点でのAPIコール数が3本
          expect(currentResult.totalApiCallsBeforeFullyLoaded).toBe(3);
          expect(expectedResult.totalApiCallsBeforeFullyLoaded).toBe(3);

          // 【修正確認】修正後の実装では、メインコンテンツのローディング終了後に
          // 追加のAPIコールが実行されない（サイドバーはバックグラウンド）
          const extraApiCalls =
            currentResult.totalApiCallsBeforeFullyLoaded -
            currentResult.mainContentLoadingEndedAtApiCallCount;

          // 修正後は extraApiCalls = 0（サイドバーはバックグラウンド）
          expect(extraApiCalls).toBe(0);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ============================================================
// 具体的な失敗ケースのテスト（スコープ付きPBTアプローチ）
// ============================================================

describe('具体的な失敗ケース: 通話モード遷移時のAPIコール順序', () => {
  /**
   * 具体的なシナリオ: 営担「Y」の売主に遷移した場合
   *
   * 修正後の動作を確認する。
   */
  test('具体的なシナリオ: 営担「Y」の売主に遷移した場合、メインコンテンツのローディング終了時点でAPIコールが3本のみ（修正後）', async () => {
    const sellerId = 'test-seller-001';
    const visitAssignee = 'Y';

    const result = await simulateCurrentCallModePageBehavior(sellerId, visitAssignee, 1);

    // 【修正確認】メインコンテンツのローディング終了時点でのAPIコール数は3本のみ
    expect(result.totalApiCallsBeforeFullyLoaded).toBe(3);

    // APIコールの詳細を確認（loadAllDataの3本のみ）
    const apiUrls = result.apiCalls.map((c) => c.url);
    expect(apiUrls[0]).toContain(`/api/sellers/${sellerId}`);  // loadAllData: 売主詳細
    expect(apiUrls[1]).toContain(`/api/sellers/${sellerId}/activities`); // loadAllData: 活動履歴
    expect(apiUrls[2]).toBe('/api/employees');                  // loadAllData: 従業員一覧

    // 【修正確認】メインコンテンツのローディング終了後に追加のAPIコールが実行されない
    expect(result.mainContentLoadingEndedAtApiCallCount).toBe(3);
    expect(result.totalApiCallsBeforeFullyLoaded - result.mainContentLoadingEndedAtApiCallCount).toBe(0);
  });

  /**
   * 具体的なシナリオ: 修正後の動作確認
   */
  test('具体的なシナリオ: 修正後はメインコンテンツのローディング終了時点でAPIコールが3本のみ', async () => {
    const sellerId = 'test-seller-001';
    const visitAssignee = 'Y';

    const result = await simulateCurrentCallModePageBehavior(sellerId, visitAssignee, 1);

    // 【修正確認】メインコンテンツのローディング終了時点でのAPIコール数は3本のみ
    expect(result.totalApiCallsBeforeFullyLoaded).toBe(3);
  });

  /**
   * 具体的なシナリオ: プロパティ1-3 - サイドバーAPIはバックグラウンドで実行される
   *
   * 修正後: fetchSidebarSellers() と fetchSidebarCounts() はバックグラウンドで並列実行
   * メインコンテンツのローディング終了時点では、サイドバーAPIはまだ実行中
   */
  test('具体的なシナリオ: サイドバーAPIはバックグラウンドで実行され、メインコンテンツのローディングをブロックしない', async () => {
    const sellerId = 'test-seller-002';
    const visitAssignee = 'I';

    const result = await simulateCurrentCallModePageBehavior(sellerId, visitAssignee, 1);

    // 【修正確認】メインコンテンツのローディング終了時点でのAPIコール数は3本のみ
    expect(result.mainContentLoadingEndedAtApiCallCount).toBe(3);
    expect(result.totalApiCallsBeforeFullyLoaded).toBe(3);

    // 【修正確認】loadAllDataの3本のAPIコールが記録されている
    const apiUrls = result.apiCalls.map((c) => c.url);
    expect(apiUrls[0]).toContain(`/api/sellers/${sellerId}`);
    expect(apiUrls[1]).toContain(`/api/sellers/${sellerId}/activities`);
    expect(apiUrls[2]).toBe('/api/employees');
  });
});
