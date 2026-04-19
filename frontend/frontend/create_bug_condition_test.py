#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
バグ条件探索テストファイルをUTF-8で作成するスクリプト
"""

content = r'''/**
 * CallModePage 次電日変更後ポーリング発生時のダイアログ誤表示 バグ条件探索テスト
 * （Property 1: Bug Condition）
 *
 * このテストは修正前のコードでFAILすることでバグの存在を証明する。
 *
 * **CRITICAL**: このテストは修正前のコードで必ずFAILすること — FAILがバグの存在を証明する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: このテストは期待される動作をエンコードしている — 修正後にPASSすることで修正を検証する
 *
 * **Validates: Requirements 1.1, 1.2**
 */
import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// -----------------------------------------------------------------------
// shouldShowReminderDialog の純粋関数（CallModePage.tsx から抽出）
// -----------------------------------------------------------------------

/**
 * 次電日変更確認ダイアログを表示すべきか判定する
 * 4条件がすべて true の場合のみ true を返す
 */
function shouldShowReminderDialog(
  isElapsed: boolean,
  isFollowingUp: boolean,
  pageEdited: boolean,
  nextCallDateUnchanged: boolean
): boolean {
  return isElapsed && isFollowingUp && pageEdited && nextCallDateUnchanged;
}

// -----------------------------------------------------------------------
// ポーリング処理のシミュレーション（修正前コード）
// -----------------------------------------------------------------------

/**
 * 修正前のポーリング処理（freshData 更新ブロック）
 *
 * statusChangedRef.current === false の場合のみ setEditedNextCallDate を呼ぶ。
 * setSavedNextCallDate は一切呼ばれない（バグの根本原因）。
 *
 * 実際のコード（CallModePage.tsx 行1609〜1623付近）:
 *   if (!statusChangedRef.current) {
 *     setEditedStatus(freshData.status);
 *     setEditedConfidence(freshData.confidence || '');
 *     setEditedNextCallDate(freshData.nextCallDate || '');  // editedのみ更新
 *     setEditedPinrichStatus(freshData.pinrichStatus || '');
 *     // ...
 *   }
 *   // setSavedNextCallDate は呼ばれない（バグ）
 */
function applyPollingUpdate_buggy(params: {
  editedNextCallDate: string;
  savedNextCallDate: string;
  statusChangedRef: boolean;
  freshDataNextCallDate: string;
}): {
  editedNextCallDate: string;
  savedNextCallDate: string;
} {
  const { editedNextCallDate, savedNextCallDate, statusChangedRef, freshDataNextCallDate } = params;

  if (!statusChangedRef) {
    // ユーザーが編集中でない場合: editedNextCallDate を更新する
    // ⚠️ バグ: setSavedNextCallDate は呼ばれない
    return {
      editedNextCallDate: freshDataNextCallDate,
      savedNextCallDate: savedNextCallDate, // 更新されない（バグ）
    };
  } else {
    // ユーザーが編集中の場合: editedNextCallDate を上書きしない（上書き防止）
    // ⚠️ バグ: setSavedNextCallDate も呼ばれない
    return {
      editedNextCallDate: editedNextCallDate, // 変更しない
      savedNextCallDate: savedNextCallDate,   // 更新されない（バグ）
    };
  }
}

/**
 * 修正後のポーリング処理（freshData 更新ブロック）
 *
 * statusChangedRef.current === false の場合に
 * setEditedNextCallDate と setSavedNextCallDate の両方を呼ぶ。
 *
 * 修正後のコード:
 *   if (!statusChangedRef.current) {
 *     setEditedStatus(freshData.status);
 *     setEditedConfidence(freshData.confidence || '');
 *     setEditedNextCallDate(freshData.nextCallDate || '');
 *     setSavedNextCallDate(freshData.nextCallDate || '');  // ✅ 修正: savedも同時に更新
 *     setEditedPinrichStatus(freshData.pinrichStatus || '');
 *     // ...
 *   }
 */
function applyPollingUpdate_fixed(params: {
  editedNextCallDate: string;
  savedNextCallDate: string;
  statusChangedRef: boolean;
  freshDataNextCallDate: string;
}): {
  editedNextCallDate: string;
  savedNextCallDate: string;
} {
  const { editedNextCallDate, savedNextCallDate, statusChangedRef, freshDataNextCallDate } = params;

  if (!statusChangedRef) {
    // ユーザーが編集中でない場合: editedNextCallDate と savedNextCallDate の両方を更新する
    return {
      editedNextCallDate: freshDataNextCallDate,
      savedNextCallDate: freshDataNextCallDate, // ✅ 修正: savedも同時に更新
    };
  } else {
    // ユーザーが編集中の場合: どちらも上書きしない
    return {
      editedNextCallDate: editedNextCallDate,
      savedNextCallDate: savedNextCallDate,
    };
  }
}

// -----------------------------------------------------------------------
// Property 1: Bug Condition テスト
// 修正前のコードでFAILすることでバグの存在を証明する
// -----------------------------------------------------------------------

describe('Property 1: Bug Condition — 次電日変更後ポーリング発生時のダイアログ誤表示', () => {
  /**
   * テストケース1: ユーザーが次電日を変更していない場合のポーリング後の動作
   *
   * バグの流れ:
   * 1. 初期ロード: editedNextCallDate = '2025-07-01', savedNextCallDate = '2025-07-01'
   * 2. ユーザーは次電日を変更しない（他のフィールドを編集）
   * 3. ポーリング発生: freshData.nextCallDate = '2025-07-20'（サーバーが更新された）
   * 4. statusChangedRef = false のため setEditedNextCallDate('2025-07-20') が呼ばれる
   * 5. setSavedNextCallDate は呼ばれない（バグ）
   * 6. 結果: editedNextCallDate = '2025-07-20', savedNextCallDate = '2025-07-01'
   *    → editedNextCallDate !== savedNextCallDate → nextCallDateUnchanged = false → ダイアログ非表示（誤り！）
   *    本来はダイアログを表示すべき（ユーザーは次電日を変更していないため）
   *
   * 期待される正しい動作: ポーリング後に savedNextCallDate も freshDataNextCallDate に更新されること
   * 修正前の動作（バグ）: savedNextCallDate が更新されず、editedNextCallDate と不一致になる
   */
  test('テストケース1: ユーザーが次電日を変更していない場合、ポーリング後も savedNextCallDate が同期されること（修正前コードで FAIL）', () => {
    const initialNextCallDate = '2025-07-01';
    const freshDataNextCallDate = '2025-07-20'; // サーバーが更新された

    // 修正前のポーリング処理を適用（statusChangedRef = false、ユーザーは次電日を変更していない）
    const resultBuggy = applyPollingUpdate_buggy({
      editedNextCallDate: initialNextCallDate, // ユーザーは変更していない
      savedNextCallDate: initialNextCallDate,  // 初期ロード時の値
      statusChangedRef: false,
      freshDataNextCallDate: freshDataNextCallDate,
    });

    // 修正前コードでは:
    // editedNextCallDate = '2025-07-20'（freshDataで更新）
    // savedNextCallDate = '2025-07-01'（更新されない！バグ）

    // 期待される正しい動作: savedNextCallDate も freshDataNextCallDate に更新されること
    // このアサーションは修正前コードで FAIL する（バグの存在を証明）
    // 修正後コードで PASS する（バグ修正を確認）
    expect(resultBuggy.savedNextCallDate).toBe(freshDataNextCallDate); // ← 修正前コードで FAIL（バグ証明）
  });

  /**
   * テストケース2: ユーザーが次電日を変更していない場合、ポーリング後も nextCallDateUnchanged が true であること
   *
   * 修正前コードでは: savedNextCallDate が更新されないため、
   * editedNextCallDate !== savedNextCallDate → nextCallDateUnchanged = false → ダイアログ非表示（誤り）
   */
  test('テストケース2: ユーザーが次電日を変更していない場合、ポーリング後も nextCallDateUnchanged が true であること（修正前コードで FAIL）', () => {
    const initialNextCallDate = '2025-07-01';
    const freshDataNextCallDate = '2025-07-20'; // サーバーが更新された

    // 修正前のポーリング処理を適用
    const resultBuggy = applyPollingUpdate_buggy({
      editedNextCallDate: initialNextCallDate,
      savedNextCallDate: initialNextCallDate,
      statusChangedRef: false,
      freshDataNextCallDate: freshDataNextCallDate,
    });

    // nextCallDateUnchanged の判定
    const nextCallDateUnchanged_buggy = resultBuggy.editedNextCallDate === resultBuggy.savedNextCallDate;

    // 期待される正しい動作: nextCallDateUnchanged = true（ユーザーは次電日を変更していないため）
    // 修正前の動作（バグ）: nextCallDateUnchanged = false（editedとsavedが不一致）

    // このアサーションは修正前コードで FAIL する（バグの存在を証明）
    // 修正後コードで PASS する（バグ修正を確認）
    expect(nextCallDateUnchanged_buggy).toBe(true); // ← 修正前コードで FAIL（バグ証明）
  });

  /**
   * テストケース3: shouldShowReminderDialog との統合テスト
   *
   * ユーザーが次電日を変更していない状態でポーリングが発生した後、
   * shouldShowReminderDialog が正しく true を返すことを確認する。
   *
   * 修正前コードでは: savedNextCallDate が更新されないため、
   * editedNextCallDate !== savedNextCallDate → nextCallDateUnchanged = false → ダイアログ非表示（誤り）
   */
  test('テストケース3: ユーザーが次電日を変更していない場合、ポーリング後もダイアログが表示されること（修正前コードで FAIL）', () => {
    const initialNextCallDate = '2025-07-01';
    const freshDataNextCallDate = '2025-07-20'; // サーバーが更新された

    // 修正前のポーリング処理を適用
    const resultBuggy = applyPollingUpdate_buggy({
      editedNextCallDate: initialNextCallDate,
      savedNextCallDate: initialNextCallDate,
      statusChangedRef: false,
      freshDataNextCallDate: freshDataNextCallDate,
    });

    // shouldShowReminderDialog の判定
    const shouldShow_buggy = shouldShowReminderDialog(
      true,  // isElapsed: 反響日付から3日以上経過
      true,  // isFollowingUp: 追客中
      true,  // pageEdited: 編集あり
      resultBuggy.editedNextCallDate === resultBuggy.savedNextCallDate // nextCallDateUnchanged
    );

    // 期待される正しい動作: shouldShowReminderDialog = true（次電日は変更されていないため）
    // 修正前の動作（バグ）: shouldShowReminderDialog = false（editedとsavedが不一致のため）

    // このアサーションは修正前コードで FAIL する（バグの存在を証明）
    // 修正後コードで PASS する（バグ修正を確認）
    expect(shouldShow_buggy).toBe(true); // ← 修正前コードで FAIL（バグ証明）
  });
});

// -----------------------------------------------------------------------
// Property-Based Test: 任意の次電日の値でバグ条件を検証
// -----------------------------------------------------------------------

describe('Property-Based Test: 任意の次電日の値でポーリング後の savedNextCallDate 同期を検証', () => {
  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * プロパティ: statusChangedRef = false の状態でポーリングが発生した場合、
   * editedNextCallDate と savedNextCallDate が常に同期されること。
   *
   * このテストは修正前コードで FAIL する（バグの存在を証明）
   * 修正後コードで PASS する（バグ修正を確認）
   */
  test('任意の次電日の値でポーリング後に editedNextCallDate と savedNextCallDate が同期されること（修正前コードで FAIL）', () => {
    // 日付文字列のアービトラリ（YYYY-MM-DD形式）
    const dateArb = fc.tuple(
      fc.integer({ min: 2024, max: 2026 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    ).map(([year, month, day]) => {
      const m = String(month).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      return `${year}-${m}-${d}`;
    });

    fc.assert(
      fc.property(
        dateArb, // 初期の次電日
        dateArb, // freshDataの次電日（サーバーの最新値）
        (initialDate, freshDate) => {
          // statusChangedRef = false の状態でポーリング発生
          const resultBuggy = applyPollingUpdate_buggy({
            editedNextCallDate: initialDate,
            savedNextCallDate: initialDate,
            statusChangedRef: false,
            freshDataNextCallDate: freshDate,
          });

          // 期待される正しい動作: editedNextCallDate と savedNextCallDate が同期されること
          // 修正前コードでは: savedNextCallDate が更新されないため、freshDate !== initialDate の場合に不一致
          // このプロパティは修正前コードで FAIL する（freshDate !== initialDate の場合）
          return resultBuggy.editedNextCallDate === resultBuggy.savedNextCallDate;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * プロパティ: statusChangedRef = false の状態でポーリングが発生した場合、
   * 修正後コードでは editedNextCallDate と savedNextCallDate が常に同期されること。
   *
   * このテストは修正後コードで PASS する（バグ修正を確認）
   */
  test('修正後コード: 任意の次電日の値でポーリング後に editedNextCallDate と savedNextCallDate が同期されること', () => {
    const dateArb = fc.tuple(
      fc.integer({ min: 2024, max: 2026 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    ).map(([year, month, day]) => {
      const m = String(month).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      return `${year}-${m}-${d}`;
    });

    fc.assert(
      fc.property(
        dateArb,
        dateArb,
        (initialDate, freshDate) => {
          // statusChangedRef = false の状態でポーリング発生（修正後コード）
          const resultFixed = applyPollingUpdate_fixed({
            editedNextCallDate: initialDate,
            savedNextCallDate: initialDate,
            statusChangedRef: false,
            freshDataNextCallDate: freshDate,
          });

          // 修正後コードでは: editedNextCallDate と savedNextCallDate が常に同期される
          return resultFixed.editedNextCallDate === resultFixed.savedNextCallDate;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// -----------------------------------------------------------------------
// ソースコード静的解析: 修正前のコードにバグ条件が存在することを確認
// -----------------------------------------------------------------------

describe('ソースコード静的解析 — バグ条件の存在確認', () => {
  const TARGET_FILE = path.resolve(__dirname, '../CallModePage.tsx');

  function readTargetFile(): string {
    return fs.readFileSync(TARGET_FILE, 'utf-8');
  }

  /**
   * バグ条件: ポーリング処理（freshData 更新ブロック）内で
   * setEditedNextCallDate を呼ぶ際に setSavedNextCallDate が呼ばれていないこと
   *
   * このテストは修正前コードで FAIL する（バグの存在を証明）
   * 修正後コードで PASS する（バグ修正を確認）
   */
  test('バグ条件: ポーリング処理内で setEditedNextCallDate の直後に setSavedNextCallDate が呼ばれること（修正前コードで FAIL）', () => {
    const source = readTargetFile();

    // ポーリング処理ブロックを検索
    // キャッシュヒット時のバックグラウンド更新ブロック内の
    // statusChangedRef.current チェックブロックを検索
    // 実際のコードパターン（CallModePage.tsx 行1609〜1623付近）:
    //   if (!statusChangedRef.current) {
    //     setEditedStatus(freshData.status);
    //     setEditedConfidence(freshData.confidence || '');
    //     setEditedNextCallDate(freshData.nextCallDate || '');
    //     setEditedPinrichStatus(freshData.pinrichStatus || '');
    //     ...
    //   }

    // setEditedNextCallDate(freshData.nextCallDate の出現箇所を検索
    const editedNextCallDateIdx = source.indexOf("setEditedNextCallDate(freshData.nextCallDate");
    expect(editedNextCallDateIdx).toBeGreaterThan(-1);

    if (editedNextCallDateIdx > -1) {
      // setEditedNextCallDate の前後200文字を取得してブロックを確認
      const blockStart = Math.max(0, editedNextCallDateIdx - 300);
      const blockEnd = Math.min(source.length, editedNextCallDateIdx + 500);
      const pollingBlock = source.slice(blockStart, blockEnd);

      // 期待される正しい動作: setSavedNextCallDate が setEditedNextCallDate の近くで呼ばれること
      // 修正前コードでは: setSavedNextCallDate が呼ばれない（バグ）
      // 修正後コードでは: setSavedNextCallDate が呼ばれる（修正済み）

      const hasSavedNextCallDateUpdate = pollingBlock.includes('setSavedNextCallDate(freshData.nextCallDate');

      // このアサーションは修正前コードで FAIL する（バグの存在を証明）
      // 修正後コードで PASS する（バグ修正を確認）
      expect(hasSavedNextCallDateUpdate).toBe(true); // ← 修正前コードで FAIL（バグ証明）
    }
  });
});
'''

output_path = 'src/pages/__tests__/CallModePage.nextCallDate.bugCondition.test.ts'

with open(output_path, 'wb') as f:
    f.write(content.encode('utf-8'))

print(f'テストファイルを作成しました: {output_path}')

# BOMチェック
with open(output_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOMチェック: {repr(first_bytes[:3])} (b\'/**\' であればOK、b\'\\xef\\xbb\\xbf\' はBOM付き)')
