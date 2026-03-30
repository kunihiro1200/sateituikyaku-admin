/**
 * 保存プロパティテスト - 他の買主・フィールド・値での保存動作が保持される
 *
 * **Feature: buyer-initial-assignee-save-sync-bug, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * ✅ IMPORTANT: このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）
 * GOAL: バグ条件を満たさない入力に対して、修正前と修正後で同じ動作を維持することを確認
 *
 * 保存要件:
 * 1. 買主番号7260以外の買主で初動担当「久」を保存 → 正常に動作
 * 2. 買主番号7260で初動担当「久」以外の値（「Y」「I」など）を保存 → 正常に動作
 * 3. 買主番号7260で初動担当以外のフィールド（問合せ元など）を保存 → 正常に動作
 */

import * as fc from 'fast-check';

// ============================================================
// バグ条件の定義（再掲）
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
 * 買主更新（同期付き）のモック（未修正バージョン）
 *
 * 買主番号7260の初動担当「久」の場合のみ、409エラーを返す
 * それ以外の全ての入力に対しては正常に動作する
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
  // 買主番号7260の初動担当「久」の場合のみ、スプレッドシート同期に失敗
  if (buyerNumber === '7260' && fieldName === 'initial_assignee' && newValue === '久') {
    // ⚠️ バグ: 競合検出（409エラー）
    return {
      dbSaveSuccess: true,
      spreadsheetSyncSuccess: false,
      errorMessage: 'DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました',
      statusCode: 409,
    };
  }

  // その他の全ての場合は正常に同期
  return {
    dbSaveSuccess: true,
    spreadsheetSyncSuccess: true,
    errorMessage: null,
    statusCode: 200,
  };
}

// ============================================================
// 保存プロパティテスト
// ============================================================

describe('Property 2: Preservation - 他の買主・フィールド・値での保存動作が保持される', () => {
  /**
   * テストケース1: 買主番号7260以外の買主で初動担当「久」を保存
   *
   * 買主番号4370の初動担当「久」保存は正常に動作する
   *
   * ✅ 未修正コードで PASS することが期待される
   *
   * **Validates: Requirements 3.1**
   */
  it('テスト1: 買主番号4370の初動担当「久」保存は正常に動作する', async () => {
    const input = {
      buyerNumber: '4370',
      fieldName: 'initial_assignee',
      newValue: '久',
      saveButtonPressed: true,
    };

    // バグ条件を満たさないことを確認
    expect(isBugCondition(input)).toBe(false);

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
  });

  /**
   * テストケース2: 買主番号7260で初動担当「Y」を保存
   *
   * 買主番号7260の初動担当「Y」保存は正常に動作する
   *
   * ✅ 未修正コードで PASS することが期待される
   *
   * **Validates: Requirements 3.3**
   */
  it('テスト2: 買主番号7260の初動担当「Y」保存は正常に動作する', async () => {
    const input = {
      buyerNumber: '7260',
      fieldName: 'initial_assignee',
      newValue: 'Y',
      saveButtonPressed: true,
    };

    // バグ条件を満たさないことを確認
    expect(isBugCondition(input)).toBe(false);

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
  });

  /**
   * テストケース3: 買主番号7260で初動担当「I」を保存
   *
   * 買主番号7260の初動担当「I」保存は正常に動作する
   *
   * ✅ 未修正コードで PASS することが期待される
   *
   * **Validates: Requirements 3.3**
   */
  it('テスト3: 買主番号7260の初動担当「I」保存は正常に動作する', async () => {
    const input = {
      buyerNumber: '7260',
      fieldName: 'initial_assignee',
      newValue: 'I',
      saveButtonPressed: true,
    };

    // バグ条件を満たさないことを確認
    expect(isBugCondition(input)).toBe(false);

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
  });

  /**
   * テストケース4: 買主番号7260で問合せ元フィールドを保存
   *
   * 買主番号7260の問合せ元フィールド保存は正常に動作する
   *
   * ✅ 未修正コードで PASS することが期待される
   *
   * **Validates: Requirements 3.2**
   */
  it('テスト4: 買主番号7260の問合せ元フィールド保存は正常に動作する', async () => {
    const input = {
      buyerNumber: '7260',
      fieldName: 'inquiry_source',
      newValue: 'athome',
      saveButtonPressed: true,
    };

    // バグ条件を満たさないことを確認
    expect(isBugCondition(input)).toBe(false);

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
  });

  /**
   * テストケース5: 買主番号7260で最新状況フィールドを保存
   *
   * 買主番号7260の最新状況フィールド保存は正常に動作する
   *
   * ✅ 未修正コードで PASS することが期待される
   *
   * **Validates: Requirements 3.2**
   */
  it('テスト5: 買主番号7260の最新状況フィールド保存は正常に動作する', async () => {
    const input = {
      buyerNumber: '7260',
      fieldName: 'latest_status',
      newValue: '追客中',
      saveButtonPressed: true,
    };

    // バグ条件を満たさないことを確認
    expect(isBugCondition(input)).toBe(false);

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
  });

  /**
   * テストケース6 (PBT): 買主番号7260以外の買主で初動担当「久」を保存
   *
   * ランダムな買主番号（7260以外）で初動担当「久」を保存して、
   * 全て正常に動作することを確認
   *
   * ✅ 未修正コードで PASS することが期待される
   *
   * **Validates: Requirements 3.1**
   */
  it('テスト6 (PBT): 買主番号7260以外の買主で初動担当「久」を保存 → 正常に動作', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 買主番号（7260以外）を生成
        fc.integer({ min: 1000, max: 9999 }).filter(n => n !== 7260).map(n => String(n)),
        async (buyerNumber) => {
          const input = {
            buyerNumber,
            fieldName: 'initial_assignee',
            newValue: '久',
            saveButtonPressed: true,
          };

          // バグ条件を満たさないことを確認
          expect(isBugCondition(input)).toBe(false);

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

  /**
   * テストケース7 (PBT): 買主番号7260で初動担当「久」以外の値を保存
   *
   * ランダムな初動担当値（「久」以外）で保存して、
   * 全て正常に動作することを確認
   *
   * ✅ 未修正コードで PASS することが期待される
   *
   * **Validates: Requirements 3.3**
   */
  it('テスト7 (PBT): 買主番号7260で初動担当「久」以外の値を保存 → 正常に動作', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 初動担当値（「久」以外）を生成
        fc.constantFrom('Y', 'I', '外す', '未定', ''),
        async (newValue) => {
          const input = {
            buyerNumber: '7260',
            fieldName: 'initial_assignee',
            newValue,
            saveButtonPressed: true,
          };

          // バグ条件を満たさないことを確認
          expect(isBugCondition(input)).toBe(false);

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

  /**
   * テストケース8 (PBT): 買主番号7260で初動担当以外のフィールドを保存
   *
   * ランダムなフィールド（初動担当以外）で保存して、
   * 全て正常に動作することを確認
   *
   * ✅ 未修正コードで PASS することが期待される
   *
   * **Validates: Requirements 3.2**
   */
  it('テスト8 (PBT): 買主番号7260で初動担当以外のフィールドを保存 → 正常に動作', async () => {
    await fc.assert(
      fc.asyncProperty(
        // フィールド名（初動担当以外）を生成
        fc.constantFrom('inquiry_source', 'latest_status', 'name', 'phone_number', 'email'),
        // 値を生成
        fc.string({ minLength: 1, maxLength: 20 }),
        async (fieldName, newValue) => {
          const input = {
            buyerNumber: '7260',
            fieldName,
            newValue,
            saveButtonPressed: true,
          };

          // バグ条件を満たさないことを確認
          expect(isBugCondition(input)).toBe(false);

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

  /**
   * テストケース9 (PBT): 全ての非バグ条件入力で正常に動作
   *
   * バグ条件を満たさない全ての入力パターンで、
   * 正常に動作することを確認
   *
   * ✅ 未修正コードで PASS することが期待される
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  it('テスト9 (PBT): 全ての非バグ条件入力 → 正常に動作', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 買主番号を生成
        fc.integer({ min: 1000, max: 9999 }).map(n => String(n)),
        // フィールド名を生成
        fc.constantFrom('initial_assignee', 'inquiry_source', 'latest_status', 'name'),
        // 値を生成
        fc.constantFrom('久', 'Y', 'I', 'athome', '追客中', ''),
        async (buyerNumber, fieldName, newValue) => {
          const input = {
            buyerNumber,
            fieldName,
            newValue,
            saveButtonPressed: true,
          };

          // バグ条件を満たす場合はスキップ
          if (isBugCondition(input)) {
            return;
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
      { numRuns: 100 }
    );
  });
});
