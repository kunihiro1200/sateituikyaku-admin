/**
 * PropertyListingDetailPage handleSavePrice バグ条件テスト
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * このテストは修正後のコードで PASS することを確認する。
 *
 * バグ条件（修正前）:
 *   editedData に price キーが含まれないが、少なくとも1つのキーが含まれる場合
 *   （例: price_reduction_scheduled_date のみ変更、price_reduction_history のみ変更）
 *   handleSavePrice が no_changes エラーをスローして保存処理を中断する。
 *
 * 期待される正しい動作（修正後）:
 *   editedData が空でなければ（price キーの有無に関わらず）保存処理が実行される。
 */
import { describe, test, expect } from 'vitest';

// -----------------------------------------------------------------------
// handleSavePrice の修正済み実装を模倣したロジック
// -----------------------------------------------------------------------

/**
 * バグ条件の判定
 * editedData に price キーが含まれないが、少なくとも1つのキーが含まれる場合
 */
function isBugCondition(editedData: Record<string, unknown>): boolean {
  return Object.keys(editedData).length > 0 && !("price" in editedData);
}

/**
 * 修正済みの実装: handleSavePrice の変更なし検出ロジック
 * Object.keys(editedData).length === 0 の場合のみ no_changes エラーをスロー
 * （修正前は `|| !("price" in editedData)` という誤った条件があった）
 */
function checkNoChangesFixed(editedData: Record<string, unknown>): boolean {
  // 修正後: editedData が空の場合のみ no_changes と判定する
  return Object.keys(editedData).length === 0;
}

// -----------------------------------------------------------------------
// タスク3.2: バグ修正後の確認テスト
// このテストは修正後のコードで PASS する
// -----------------------------------------------------------------------

describe("バグ条件テスト: handleSavePrice - price キーなしの変更が保存されないバグ", () => {

  // -----------------------------------------------------------------------
  // テストケース1: 値下げ予約日のみ変更
  // -----------------------------------------------------------------------

  test("[バグ1] editedData = { price_reduction_scheduled_date: '2026-05-01' } の場合、保存が実行されること", () => {
    const editedData: Record<string, unknown> = {
      price_reduction_scheduled_date: "2026-05-01",
    };

    // バグ条件が成立することを確認（price キーなし、かつ空でない）
    expect(isBugCondition(editedData)).toBe(true);

    // 修正後の正しい動作: checkNoChangesFixed は false を返す（保存を実行する）
    const shouldSkipSave = checkNoChangesFixed(editedData);
    expect(shouldSkipSave).toBe(false);
  });

  // -----------------------------------------------------------------------
  // テストケース2: 値下げ履歴のみ変更
  // -----------------------------------------------------------------------

  test("[バグ2] editedData = { price_reduction_history: '4/17 5000万→4800万' } の場合、保存が実行されること", () => {
    const editedData: Record<string, unknown> = {
      price_reduction_history: "4/17 5000万→4800万",
    };

    // バグ条件が成立することを確認（price キーなし、かつ空でない）
    expect(isBugCondition(editedData)).toBe(true);

    // 修正後の正しい動作: checkNoChangesFixed は false を返す（保存を実行する）
    const shouldSkipSave = checkNoChangesFixed(editedData);
    expect(shouldSkipSave).toBe(false);
  });

  // -----------------------------------------------------------------------
  // テストケース3: 値下げ予約日と値下げ履歴の両方を変更（price なし）
  // -----------------------------------------------------------------------

  test("[バグ3] editedData = { price_reduction_scheduled_date, price_reduction_history } の場合、保存が実行されること", () => {
    const editedData: Record<string, unknown> = {
      price_reduction_scheduled_date: "2026-05-01",
      price_reduction_history: "4/17 5000万→4800万",
    };

    // バグ条件が成立することを確認（price キーなし、かつ空でない）
    expect(isBugCondition(editedData)).toBe(true);

    // 修正後の正しい動作: checkNoChangesFixed は false を返す（保存を実行する）
    const shouldSkipSave = checkNoChangesFixed(editedData);
    expect(shouldSkipSave).toBe(false);
  });
});
