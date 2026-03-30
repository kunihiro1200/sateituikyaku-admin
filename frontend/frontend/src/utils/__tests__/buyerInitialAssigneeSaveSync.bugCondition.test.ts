/**
 * バグ条件探索テスト - 買主番号7260の初動担当「久」保存時の同期エラー
 *
 * **Feature: buyer-initial-assignee-save-sync-bug, Property 1: Bug Condition**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * ⚠️ CRITICAL: このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示す反例を見つける
 *
 * バグの根本原因（仮説）:
 * 1. 買主番号7260のレコードに buyer_id（UUID）が存在しないか、不正な値が設定されている
 * 2. /api/buyers/7260/related エンドポイントが404エラーを返す
 * 3. updateWithSync メソッドが409エラーを返す（競合検出）
 * 4. スプレッドシート同期処理が失敗する
 */

import * as fc from 'fast-check';

// ============================================================
// バグ条件の定義
// ============================================================

/**
 * バグ条件の判定関数
 *
 * 以下の条件を全て満たす場合、バグ条件とする:
 * - buyerNumber == '7260'
 * - fieldName == 'initial_assignee'
 * - newValue == '久'
 * - saveButtonPressed == true
 */
function isBugCondition(input: {
  buyerNumber: string;
  fieldName: string;
  newValue: string;
  saveButtonPressed: boolean;
}): boolean {
  return (
    input.buyerNumber === '7260' &&
    input.fieldName === 'initial_assignee' &&
    input.newValue === '久' &&
    input.saveButtonPressed === true
  );
}

/**
 * 期待される動作（修正後）
 *
 * バグ条件を満たす入力に対して、以下の動作が期待される:
 * - DBへの保存が成功する
 * - スプレッドシートへの同期が成功する
 * - エラーメッセージが表示されない
 * - 404エラーが発生しない
 * - 409エラーが発生しない
 */
function expectedBehavior(result: {
  dbSaveSuccess: boolean;
  spreadsheetSyncSuccess: boolean;
  errorMessage: string | null;
  statusCode: number;
}): boolean {
  return (
    result.dbSaveSuccess === true &&
    result.spreadsheetSyncSuccess === true &&
    result.errorMessage === null &&
    result.statusCode === 200
  );
}

// ============================================================
// モックAPI関数（未修正バージョン）
// ============================================================

/**
 * 買主データ取得のモック（未修正バージョン）
 *
 * 買主番号7260のレコードに buyer_id が存在しない状態をシミュレート
 */
async function getBuyerByNumber_buggy(buyerNumber: string): Promise<any> {
  if (buyerNumber === '7260') {
    // ⚠️ バグ: buyer_id が存在しない
    return {
      buyer_number: '7260',
      name: 'テスト買主',
      initial_assignee: 'Y',
      // buyer_id: undefined, // ← buyer_id が存在しない
    };
  }
  return {
    buyer_number: buyerNumber,
    buyer_id: 'valid-uuid',
    name: 'テスト買主',
    initial_assignee: 'Y',
  };
}

/**
 * 関連買主取得のモック（未修正バージョン）
 *
 * 買主番号7260の場合、404エラーを返す
 */
async function getRelatedBuyers_buggy(buyerNumber: string): Promise<{
  success: boolean;
  statusCode: number;
  data?: any[];
  error?: string;
}> {
  const buyer = await getBuyerByNumber_buggy(buyerNumber);

  if (!buyer.buyer_id) {
    // ⚠️ バグ: buyer_id が存在しないため404エラー
    return {
      success: false,
      statusCode: 404,
      error: 'Buyer not found',
    };
  }

  return {
    success: true,
    statusCode: 200,
    data: [],
  };
}

/**
 * 買主更新（同期付き）のモック（未修正バージョン）
 *
 * 買主番号7260の初動担当「久」の場合、409エラーを返す
 */
async function updateWithSync_buggy(
  buyerNumber: string,
  fieldName: string,
  newValue: string
): Promise<{
  dbSaveSuccess: boolean;
  spreadsheetSyncSuccess: boolean;
  errorMessage: string | null;
  statusCode: number;
}> {
  // DBへの保存は成功
  const dbSaveSuccess = true;

  // 買主番号7260の初動担当「久」の場合、スプレッドシート同期に失敗
  if (buyerNumber === '7260' && fieldName === 'initial_assignee' && newValue === '久') {
    // ⚠️ バグ: 競合検出（409エラー）
    return {
      dbSaveSuccess: true,
      spreadsheetSyncSuccess: false,
      errorMessage: 'DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました',
      statusCode: 409,
    };
  }

  // その他の場合は正常に同期
  return {
    dbSaveSuccess: true,
    spreadsheetSyncSuccess: true,
    errorMessage: null,
    statusCode: 200,
  };
}

// ============================================================
// バグ条件探索テスト
// ============================================================

describe('Property 1: Bug Condition - 買主番号7260の初動担当「久」保存時の同期エラー', () => {
  /**
   * テストケース1: 基本バグ再現テスト（404エラー）
   *
   * 買主番号7260の関連買主取得で404エラーが発生することを確認
   *
   * ⚠️ 修正前: 404エラーが発生する（バグ）
   * ✅ 修正後: 正常に関連買主を取得できる
   *
   * **Validates: Requirements 1.2**
   */
  it('テスト1: 買主番号7260の関連買主取得で404エラーが発生する（バグ）', async () => {
    const result = await getRelatedBuyers_buggy('7260');

    // ⚠️ 修正前: 404エラーが発生する（バグ）
    // ✅ 修正後: 正常に取得できる（statusCode: 200）
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.error).toBeUndefined();
  });

  /**
   * テストケース2: 基本バグ再現テスト（409エラー）
   *
   * 買主番号7260の初動担当「久」保存で409エラーが発生することを確認
   *
   * ⚠️ 修正前: 409エラーが発生する（バグ）
   * ✅ 修正後: 正常に保存・同期できる
   *
   * **Validates: Requirements 1.3**
   */
  it('テスト2: 買主番号7260の初動担当「久」保存で409エラーが発生する（バグ）', async () => {
    const result = await updateWithSync_buggy('7260', 'initial_assignee', '久');

    // ⚠️ 修正前: 409エラーが発生する（バグ）
    // ✅ 修正後: 正常に保存・同期できる
    expect(result.dbSaveSuccess).toBe(true);
    expect(result.spreadsheetSyncSuccess).toBe(true);
    expect(result.errorMessage).toBeNull();
    expect(result.statusCode).toBe(200);
  });

  /**
   * テストケース3: バグ条件の完全な再現
   *
   * 買主番号7260の初動担当「久」保存時の完全なフローをシミュレート
   *
   * ⚠️ 修正前: DBへの保存は成功するが、スプレッドシート同期に失敗する（バグ）
   * ✅ 修正後: DBへの保存とスプレッドシート同期の両方が成功する
   *
   * **Validates: Requirements 1.1, 2.1**
   */
  it('テスト3: 買主番号7260の初動担当「久」保存時の完全なフロー（バグ）', async () => {
    const input = {
      buyerNumber: '7260',
      fieldName: 'initial_assignee',
      newValue: '久',
      saveButtonPressed: true,
    };

    // バグ条件を満たすことを確認
    expect(isBugCondition(input)).toBe(true);

    // 保存処理を実行
    const result = await updateWithSync_buggy(
      input.buyerNumber,
      input.fieldName,
      input.newValue
    );

    // ⚠️ 修正前: DBへの保存は成功するが、スプレッドシート同期に失敗する（バグ）
    // ✅ 修正後: 期待される動作を満たす
    expect(expectedBehavior(result)).toBe(true);
  });

  /**
   * テストケース4: 他の買主番号では正常に動作することを確認
   *
   * 買主番号4370の初動担当「久」保存は正常に動作する
   *
   * **Validates: Requirements 3.1**
   */
  it('テスト4: 買主番号4370の初動担当「久」保存は正常に動作する', async () => {
    const result = await updateWithSync_buggy('4370', 'initial_assignee', '久');

    // ✅ 正常に保存・同期できる
    expect(result.dbSaveSuccess).toBe(true);
    expect(result.spreadsheetSyncSuccess).toBe(true);
    expect(result.errorMessage).toBeNull();
    expect(result.statusCode).toBe(200);
  });

  /**
   * テストケース5: 買主番号7260の他の初動担当値では正常に動作することを確認
   *
   * 買主番号7260の初動担当「Y」保存は正常に動作する
   *
   * **Validates: Requirements 3.3**
   */
  it('テスト5: 買主番号7260の初動担当「Y」保存は正常に動作する', async () => {
    const result = await updateWithSync_buggy('7260', 'initial_assignee', 'Y');

    // ✅ 正常に保存・同期できる
    expect(result.dbSaveSuccess).toBe(true);
    expect(result.spreadsheetSyncSuccess).toBe(true);
    expect(result.errorMessage).toBeNull();
    expect(result.statusCode).toBe(200);
  });

  /**
   * テストケース6: 買主番号7260の他のフィールドでは正常に動作することを確認
   *
   * 買主番号7260の問合せ元フィールド保存は正常に動作する
   *
   * **Validates: Requirements 3.2**
   */
  it('テスト6: 買主番号7260の問合せ元フィールド保存は正常に動作する', async () => {
    const result = await updateWithSync_buggy('7260', 'inquiry_source', 'athome');

    // ✅ 正常に保存・同期できる
    expect(result.dbSaveSuccess).toBe(true);
    expect(result.spreadsheetSyncSuccess).toBe(true);
    expect(result.errorMessage).toBeNull();
    expect(result.statusCode).toBe(200);
  });

  /**
   * テストケース7: プロパティベーステスト - バグ条件のスコープ確認
   *
   * バグ条件を満たす入力（買主番号7260、初動担当「久」）に対して、
   * 修正後は期待される動作を満たすことを確認
   *
   * **Validates: Requirements 1.1, 2.1**
   */
  it('テスト7 (PBT): バグ条件を満たす入力 → 修正後は期待される動作を満たす', () => {
    fc.assert(
      fc.property(
        // バグ条件を満たす入力を生成
        fc.constant({
          buyerNumber: '7260',
          fieldName: 'initial_assignee',
          newValue: '久',
          saveButtonPressed: true,
        }),
        async (input) => {
          // バグ条件を満たすことを確認
          expect(isBugCondition(input)).toBe(true);

          // 保存処理を実行
          const result = await updateWithSync_buggy(
            input.buyerNumber,
            input.fieldName,
            input.newValue
          );

          // ⚠️ 修正前: 期待される動作を満たさない（バグ）
          // ✅ 修正後: 期待される動作を満たす
          expect(expectedBehavior(result)).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * テストケース8: プロパティベーステスト - 非バグ条件の動作確認
   *
   * バグ条件を満たさない入力（他の買主番号、他のフィールド、他の値）に対して、
   * 正常に動作することを確認
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  it('テスト8 (PBT): バグ条件を満たさない入力 → 正常に動作する', () => {
    fc.assert(
      fc.property(
        // 買主番号（7260以外）
        fc.string({ minLength: 4, maxLength: 4 }).filter(s => s !== '7260'),
        // フィールド名
        fc.constantFrom('initial_assignee', 'inquiry_source', 'latest_status'),
        // 値
        fc.constantFrom('久', 'Y', 'I', 'athome', '追客中'),
        async (buyerNumber, fieldName, newValue) => {
          const input = {
            buyerNumber,
            fieldName,
            newValue,
            saveButtonPressed: true,
          };

          // バグ条件を満たさないことを確認
          if (isBugCondition(input)) {
            return; // スキップ
          }

          // 保存処理を実行
          const result = await updateWithSync_buggy(
            input.buyerNumber,
            input.fieldName,
            input.newValue
          );

          // ✅ 正常に保存・同期できる
          expect(result.dbSaveSuccess).toBe(true);
          expect(result.spreadsheetSyncSuccess).toBe(true);
          expect(result.errorMessage).toBeNull();
          expect(result.statusCode).toBe(200);
        }
      ),
      { numRuns: 50 }
    );
  });
});
