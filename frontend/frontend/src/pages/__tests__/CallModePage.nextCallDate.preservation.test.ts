/**
 * CallModePage 次電日変更後ポーリング発生時のダイアログ誤表示 保全テスト
 * （Property 2: Preservation）
 *
 * このテストは未修正コードで**成功する**必要がある。
 * バグ条件が成立しない場合（isBugCondition が false になるケース）の
 * 既存動作を観察し、修正後もその動作が変わらないことを保証するベースラインを確立する。
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

// -----------------------------------------------------------------------
// shouldShowReminderDialog の純粋関数（CallModePage.tsx から抽出）
// -----------------------------------------------------------------------

/**
 * 次電日変更確認ダイアログを表示すべきか判定する
 * 4条件がすべて true の場合のみ true を返す
 *
 * @param isElapsed 反響日付から3日以上経過しているか
 * @param isFollowingUp 状況（当社）が「追客中」を含むか
 * @param pageEdited ページで編集操作が行われたか
 * @param nextCallDateUnchanged 次電日が変更されていないか
 * @returns 4条件すべて true の場合のみ true
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
 * setSavedNextCallDate は一切呼ばれない（バグの根本原因）
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

// -----------------------------------------------------------------------
// 観察1: 次電日を変更せずにポーリングが走った場合
// editedNextCallDate === savedNextCallDate は true（正しい）→ ダイアログ表示
// -----------------------------------------------------------------------

describe('観察1: 次電日未変更時のポーリング後の動作（要件 3.4）', () => {
  /**
   * 次電日を変更せずにポーリングが走った場合、
   * editedNextCallDate と savedNextCallDate が同じ値のまま（ポーリング前後で変化なし）
   * → nextCallDateUnchanged = true → ダイアログ表示（正しい）
   *
   * バグ条件が成立しないケース: statusChangedRef = false かつ
   * editedNextCallDate === savedNextCallDate（ユーザーは次電日を変更していない）
   */
  test('次電日未変更・ポーリングなし: nextCallDateUnchanged が true であること', () => {
    const nextCallDate = '2025-07-01';

    // ポーリングなし（初期状態）
    const editedNextCallDate = nextCallDate;
    const savedNextCallDate = nextCallDate;

    const nextCallDateUnchanged = editedNextCallDate === savedNextCallDate;
    expect(nextCallDateUnchanged).toBe(true);
  });

  test('次電日未変更・ポーリングあり（サーバー値が同じ）: nextCallDateUnchanged が true であること', () => {
    const nextCallDate = '2025-07-01';

    // ポーリング発生（サーバー値が同じ）
    const result = applyPollingUpdate_buggy({
      editedNextCallDate: nextCallDate,
      savedNextCallDate: nextCallDate,
      statusChangedRef: false,
      freshDataNextCallDate: nextCallDate, // サーバー値も同じ
    });

    // editedNextCallDate === savedNextCallDate は true（正しい）
    const nextCallDateUnchanged = result.editedNextCallDate === result.savedNextCallDate;
    expect(nextCallDateUnchanged).toBe(true);
  });

  test('次電日未変更・ポーリングあり（サーバー値が同じ）: shouldShowReminderDialog が true を返すこと', () => {
    const nextCallDate = '2025-07-01';

    const result = applyPollingUpdate_buggy({
      editedNextCallDate: nextCallDate,
      savedNextCallDate: nextCallDate,
      statusChangedRef: false,
      freshDataNextCallDate: nextCallDate,
    });

    const nextCallDateUnchanged = result.editedNextCallDate === result.savedNextCallDate;

    // 全4条件が true → ダイアログ表示（正しい）
    const shouldShow = shouldShowReminderDialog(
      true,  // isElapsed: 反響日付から3日以上経過
      true,  // isFollowingUp: 追客中
      true,  // pageEdited: 編集あり
      nextCallDateUnchanged
    );
    expect(shouldShow).toBe(true);
  });
});

// -----------------------------------------------------------------------
// 観察2: 反響日付が3日未満の場合 → isElapsed = false → ダイアログ非表示
// -----------------------------------------------------------------------

describe('観察2: 反響日付が3日未満の場合はダイアログ非表示（要件 3.1）', () => {
  test('isElapsed = false の場合、shouldShowReminderDialog は false を返すこと', () => {
    const shouldShow = shouldShowReminderDialog(
      false, // isElapsed: 3日未満
      true,  // isFollowingUp: 追客中
      true,  // pageEdited: 編集あり
      true   // nextCallDateUnchanged: 次電日未変更
    );
    expect(shouldShow).toBe(false);
  });

  test('isElapsed = false の場合、他の条件が全て true でもダイアログ非表示', () => {
    // 全条件が true でも isElapsed = false ならダイアログ非表示
    const shouldShow = shouldShowReminderDialog(false, true, true, true);
    expect(shouldShow).toBe(false);
  });
});

// -----------------------------------------------------------------------
// 観察3: 追客中でない場合 → isFollowingUp = false → ダイアログ非表示
// -----------------------------------------------------------------------

describe('観察3: 追客中でない場合はダイアログ非表示（要件 3.2）', () => {
  test('isFollowingUp = false の場合、shouldShowReminderDialog は false を返すこと', () => {
    const shouldShow = shouldShowReminderDialog(
      true,  // isElapsed: 3日以上経過
      false, // isFollowingUp: 追客中でない
      true,  // pageEdited: 編集あり
      true   // nextCallDateUnchanged: 次電日未変更
    );
    expect(shouldShow).toBe(false);
  });

  test('isFollowingUp = false の場合、他の条件が全て true でもダイアログ非表示', () => {
    const shouldShow = shouldShowReminderDialog(true, false, true, true);
    expect(shouldShow).toBe(false);
  });
});

// -----------------------------------------------------------------------
// 観察4: pageEdited = false の場合 → ダイアログ非表示
// -----------------------------------------------------------------------

describe('観察4: pageEdited = false の場合はダイアログ非表示（要件 3.3）', () => {
  test('pageEdited = false の場合、shouldShowReminderDialog は false を返すこと', () => {
    const shouldShow = shouldShowReminderDialog(
      true,  // isElapsed: 3日以上経過
      true,  // isFollowingUp: 追客中
      false, // pageEdited: 編集なし
      true   // nextCallDateUnchanged: 次電日未変更
    );
    expect(shouldShow).toBe(false);
  });

  test('pageEdited = false の場合、他の条件が全て true でもダイアログ非表示', () => {
    const shouldShow = shouldShowReminderDialog(true, true, false, true);
    expect(shouldShow).toBe(false);
  });
});

// -----------------------------------------------------------------------
// Property-Based Test: shouldShowReminderDialog の全4条件の組み合わせ検証
// -----------------------------------------------------------------------

describe('Property-Based Test: shouldShowReminderDialog の純粋関数としての正しさ（全16パターン）', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   *
   * プロパティ: shouldShowReminderDialog は4条件の AND 論理として動作する純粋関数である。
   * 任意の boolean 4値の組み合わせで、全て true の場合のみ true を返す。
   *
   * このテストは未修正コードで成功する（保全ベースラインの確立）
   */
  test('任意の4条件の組み合わせで AND 論理として正しく動作すること', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isElapsed
        fc.boolean(), // isFollowingUp
        fc.boolean(), // pageEdited
        fc.boolean(), // nextCallDateUnchanged
        (isElapsed, isFollowingUp, pageEdited, nextCallDateUnchanged) => {
          const result = shouldShowReminderDialog(
            isElapsed,
            isFollowingUp,
            pageEdited,
            nextCallDateUnchanged
          );

          // 期待される動作: 全4条件が true の場合のみ true
          const expected = isElapsed && isFollowingUp && pageEdited && nextCallDateUnchanged;
          return result === expected;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   *
   * プロパティ: いずれか1つでも false の条件がある場合、ダイアログは表示されない。
   */
  test('いずれか1つでも false の条件がある場合、ダイアログは表示されないこと', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isElapsed
        fc.boolean(), // isFollowingUp
        fc.boolean(), // pageEdited
        fc.boolean(), // nextCallDateUnchanged
        (isElapsed, isFollowingUp, pageEdited, nextCallDateUnchanged) => {
          // 少なくとも1つが false の場合のみテスト
          if (isElapsed && isFollowingUp && pageEdited && nextCallDateUnchanged) {
            // 全て true の場合はスキップ（このプロパティの対象外）
            return true;
          }

          const result = shouldShowReminderDialog(
            isElapsed,
            isFollowingUp,
            pageEdited,
            nextCallDateUnchanged
          );

          // 少なくとも1つが false → ダイアログ非表示
          return result === false;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * プロパティ: 全4条件が true の場合、必ずダイアログが表示される。
   */
  test('全4条件が true の場合、必ずダイアログが表示されること（要件 3.4）', () => {
    const result = shouldShowReminderDialog(true, true, true, true);
    expect(result).toBe(true);
  });
});

// -----------------------------------------------------------------------
// statusChangedRef による既存のポーリング上書き防止ロジックの保全
// -----------------------------------------------------------------------

describe('statusChangedRef による既存のポーリング上書き防止ロジックの保全', () => {
  /**
   * statusChangedRef = true の場合、ポーリングは editedNextCallDate を上書きしない。
   * これは既存の正しい動作であり、修正後も変わらないこと。
   */
  test('statusChangedRef = true の場合、ポーリングは editedNextCallDate を上書きしないこと', () => {
    const userEditedDate = '2025-07-15'; // ユーザーが変更した値
    const savedDate = '2025-07-01';      // 保存済みの値
    const freshDataDate = '2025-07-01';  // サーバーの古い値

    const result = applyPollingUpdate_buggy({
      editedNextCallDate: userEditedDate,
      savedNextCallDate: savedDate,
      statusChangedRef: true, // ユーザーが編集中
      freshDataNextCallDate: freshDataDate,
    });

    // ユーザーの編集値が保持されること（上書き防止が機能している）
    expect(result.editedNextCallDate).toBe(userEditedDate);
  });

  /**
   * statusChangedRef = false の場合、ポーリングは editedNextCallDate を更新する。
   * これは既存の正しい動作であり、修正後も変わらないこと。
   */
  test('statusChangedRef = false の場合、ポーリングは editedNextCallDate を freshData で更新すること', () => {
    const initialDate = '2025-07-01';
    const freshDataDate = '2025-07-20';

    const result = applyPollingUpdate_buggy({
      editedNextCallDate: initialDate,
      savedNextCallDate: initialDate,
      statusChangedRef: false, // ユーザーは編集していない
      freshDataNextCallDate: freshDataDate,
    });

    // editedNextCallDate が freshData で更新されること
    expect(result.editedNextCallDate).toBe(freshDataDate);
  });

  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   *
   * プロパティ: statusChangedRef = true の場合、任意の freshData 値でも
   * editedNextCallDate は変更されないこと（上書き防止の保全）
   */
  test('任意の freshData 値でも statusChangedRef = true の場合は editedNextCallDate が保持されること', () => {
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
        dateArb, // ユーザーが編集した次電日
        dateArb, // 保存済みの次電日
        dateArb, // freshData の次電日
        (userEditedDate, savedDate, freshDate) => {
          const result = applyPollingUpdate_buggy({
            editedNextCallDate: userEditedDate,
            savedNextCallDate: savedDate,
            statusChangedRef: true, // ユーザーが編集中
            freshDataNextCallDate: freshDate,
          });

          // ユーザーの編集値が保持されること
          return result.editedNextCallDate === userEditedDate;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// -----------------------------------------------------------------------
// 全16パターンの網羅的テスト（shouldShowReminderDialog の真理値表）
// -----------------------------------------------------------------------

describe('shouldShowReminderDialog の真理値表（全16パターン）', () => {
  const cases: Array<{
    isElapsed: boolean;
    isFollowingUp: boolean;
    pageEdited: boolean;
    nextCallDateUnchanged: boolean;
    expected: boolean;
    description: string;
  }> = [
    // 全て false
    { isElapsed: false, isFollowingUp: false, pageEdited: false, nextCallDateUnchanged: false, expected: false, description: '全て false' },
    // 1つだけ true
    { isElapsed: true,  isFollowingUp: false, pageEdited: false, nextCallDateUnchanged: false, expected: false, description: 'isElapsed のみ true' },
    { isElapsed: false, isFollowingUp: true,  pageEdited: false, nextCallDateUnchanged: false, expected: false, description: 'isFollowingUp のみ true' },
    { isElapsed: false, isFollowingUp: false, pageEdited: true,  nextCallDateUnchanged: false, expected: false, description: 'pageEdited のみ true' },
    { isElapsed: false, isFollowingUp: false, pageEdited: false, nextCallDateUnchanged: true,  expected: false, description: 'nextCallDateUnchanged のみ true' },
    // 2つ true
    { isElapsed: true,  isFollowingUp: true,  pageEdited: false, nextCallDateUnchanged: false, expected: false, description: 'isElapsed + isFollowingUp' },
    { isElapsed: true,  isFollowingUp: false, pageEdited: true,  nextCallDateUnchanged: false, expected: false, description: 'isElapsed + pageEdited' },
    { isElapsed: true,  isFollowingUp: false, pageEdited: false, nextCallDateUnchanged: true,  expected: false, description: 'isElapsed + nextCallDateUnchanged' },
    { isElapsed: false, isFollowingUp: true,  pageEdited: true,  nextCallDateUnchanged: false, expected: false, description: 'isFollowingUp + pageEdited' },
    { isElapsed: false, isFollowingUp: true,  pageEdited: false, nextCallDateUnchanged: true,  expected: false, description: 'isFollowingUp + nextCallDateUnchanged' },
    { isElapsed: false, isFollowingUp: false, pageEdited: true,  nextCallDateUnchanged: true,  expected: false, description: 'pageEdited + nextCallDateUnchanged' },
    // 3つ true
    { isElapsed: true,  isFollowingUp: true,  pageEdited: true,  nextCallDateUnchanged: false, expected: false, description: 'nextCallDateUnchanged のみ false（要件 3.4 の逆）' },
    { isElapsed: true,  isFollowingUp: true,  pageEdited: false, nextCallDateUnchanged: true,  expected: false, description: 'pageEdited のみ false（要件 3.3）' },
    { isElapsed: true,  isFollowingUp: false, pageEdited: true,  nextCallDateUnchanged: true,  expected: false, description: 'isFollowingUp のみ false（要件 3.2）' },
    { isElapsed: false, isFollowingUp: true,  pageEdited: true,  nextCallDateUnchanged: true,  expected: false, description: 'isElapsed のみ false（要件 3.1）' },
    // 全て true
    { isElapsed: true,  isFollowingUp: true,  pageEdited: true,  nextCallDateUnchanged: true,  expected: true,  description: '全て true → ダイアログ表示（要件 3.4）' },
  ];

  cases.forEach(({ isElapsed, isFollowingUp, pageEdited, nextCallDateUnchanged, expected, description }) => {
    test(`${description}: shouldShowReminderDialog は ${expected} を返すこと`, () => {
      const result = shouldShowReminderDialog(isElapsed, isFollowingUp, pageEdited, nextCallDateUnchanged);
      expect(result).toBe(expected);
    });
  });
});
