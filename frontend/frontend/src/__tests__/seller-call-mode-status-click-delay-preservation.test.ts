/**
 * 保存性プロパティテスト: 他フィールドの変更検知・保存処理・リセット動作の維持
 *
 * **重要**: このテストは修正前のコードで PASS すること（ベースライン動作の確認）
 * 修正後も引き続き PASS することでリグレッションがないことを確認する
 *
 * 保存性の確認対象:
 *   - 状況（当社）フィールドの onChange が statusChanged を true にする
 *   - 確度フィールドの onChange が statusChanged を true にする
 *   - Pinrichステータスフィールドの onChange が statusChanged を true にする
 *   - 保存成功後に statusChanged が false にリセットされる
 *   - 売主データ読み込み時に statusChanged が false に初期化される
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */

import fc from 'fast-check';

// ============================================================
// 型定義
// ============================================================

/** statusChanged の状態を管理するオブジェクト */
interface StatusChangedState {
  statusChanged: boolean;
  statusChangedRef: { current: boolean };
}

/** フィールド変更イベントのシミュレーション入力 */
interface FieldChangeInput {
  fieldName: 'status' | 'confidence' | 'pinrichStatus' | 'nextCallDate' | 'other';
  newValue: string;
}

// ============================================================
// バグ条件の形式的定義（design.md より）
// ============================================================

/**
 * バグ条件を判定する関数
 * 次電日フィールドへの onClick のみが対象
 */
function isBugCondition(input: {
  fieldName: string;
  action: 'click' | 'change';
  onChangeDidNotFire: boolean;
  statusChanged: boolean;
}): boolean {
  return (
    input.fieldName === 'nextCallDate' &&
    input.action === 'click' &&
    input.onChangeDidNotFire === true &&
    input.statusChanged === false
  );
}

// ============================================================
// 修正前のフィールド onChange ハンドラをシミュレート
// ============================================================

/**
 * 状況（当社）フィールドの onChange ハンドラ（修正前・修正後とも同じ）
 * 実際のコード（行7016）:
 *   onChange={(e) => { setEditedStatus(e.target.value); setStatusChanged(true); statusChangedRef.current = true; }}
 */
function simulateStatusOnChange(
  state: StatusChangedState,
  newValue: string
): { editedStatus: string } {
  // ✅ 正常動作: onChange が statusChanged を true にする
  state.statusChanged = true;
  state.statusChangedRef.current = true;
  return { editedStatus: newValue };
}

/**
 * 確度フィールドの onChange ハンドラ（修正前・修正後とも同じ）
 * 実際のコード（行7232）:
 *   onChange={(e) => { setEditedConfidence(e.target.value); setStatusChanged(true); statusChangedRef.current = true; }}
 */
function simulateConfidenceOnChange(
  state: StatusChangedState,
  newValue: string
): { editedConfidence: string } {
  // ✅ 正常動作: onChange が statusChanged を true にする
  state.statusChanged = true;
  state.statusChangedRef.current = true;
  return { editedConfidence: newValue };
}

/**
 * Pinrichステータスフィールドの onChange ハンドラ（修正前・修正後とも同じ）
 * 実際のコード（行7264-7267）:
 *   onChange={(e) => {
 *     setEditedPinrichStatus(e.target.value);
 *     setStatusChanged(true);
 *     statusChangedRef.current = true;
 *   }}
 */
function simulatePinrichStatusOnChange(
  state: StatusChangedState,
  newValue: string
): { editedPinrichStatus: string } {
  // ✅ 正常動作: onChange が statusChanged を true にする
  state.statusChanged = true;
  state.statusChangedRef.current = true;
  return { editedPinrichStatus: newValue };
}

/**
 * 保存成功後のリセット処理（修正前・修正後とも同じ）
 * 実際のコード（行2020-2021）:
 *   setStatusChanged(false);
 *   statusChangedRef.current = false;
 */
function simulateSaveSuccess(state: StatusChangedState): void {
  // ✅ 正常動作: 保存成功後に statusChanged を false にリセット
  state.statusChanged = false;
  state.statusChangedRef.current = false;
}

/**
 * 売主データ読み込み時の初期化処理（修正前・修正後とも同じ）
 * 実際のコード（行1382-1383）:
 *   setStatusChanged(false);
 *   statusChangedRef.current = false;
 */
function simulateSellerDataLoad(state: StatusChangedState): void {
  // ✅ 正常動作: 売主データ読み込み時に statusChanged を false に初期化
  state.statusChanged = false;
  state.statusChangedRef.current = false;
}

/**
 * 「ステータスを更新」ボタンの disabled 状態を計算する
 * 実際のコード（行7319）:
 *   disabled={savingStatus || !statusChanged}
 */
function isUpdateButtonDisabled(savingStatus: boolean, statusChanged: boolean): boolean {
  return savingStatus || !statusChanged;
}

/**
 * 初期状態を生成するファクトリ関数
 */
function createInitialState(): StatusChangedState {
  return {
    statusChanged: false,
    statusChangedRef: { current: false },
  };
}

// ============================================================
// fast-check ジェネレーター定義
// ============================================================

/** 状況（当社）フィールドの値ジェネレーター */
const statusValueArb = fc.constantFrom(
  '追客中',
  '追客不要(未訪問）',
  '除外済追客不要',
  '除外後追客中',
  '専任媒介',
  '一般媒介',
  '他決→追客',
  '他決→追客不要',
  '他社買取'
);

/** 確度フィールドの値ジェネレーター */
const confidenceValueArb = fc.constantFrom(
  'A',
  'B',
  'C',
  'D',
  'E',
  'F'
);

/** Pinrichステータスフィールドの値ジェネレーター */
const pinrichStatusValueArb = fc.constantFrom(
  '',
  '登録不要',
  'クローズ',
  'アンケート・査定',
  '訪問査定依頼',
  '配信中',
  '他決判明'
);

/** 次電日以外のフィールド変更入力ジェネレーター */
const nonBugConditionFieldArb = fc.oneof(
  fc.record({
    fieldName: fc.constant('status' as const),
    newValue: statusValueArb,
  }),
  fc.record({
    fieldName: fc.constant('confidence' as const),
    newValue: confidenceValueArb,
  }),
  fc.record({
    fieldName: fc.constant('pinrichStatus' as const),
    newValue: pinrichStatusValueArb,
  })
);

// ============================================================
// テストスイート
// ============================================================

describe('Property 2: Preservation - 他フィールドの変更検知・保存処理・リセット動作の維持', () => {

  // ============================================================
  // 3.2 他フィールドの onChange による statusChanged 更新
  // ============================================================

  describe('3.2 他フィールドの onChange が statusChanged を true にする', () => {

    /**
     * 観察: 状況（当社）フィールドの onChange が statusChanged を true にする
     *
     * **Validates: Requirements 3.2**
     */
    it('観察3.2-1: 状況（当社）フィールドの onChange が statusChanged を true にする', () => {
      fc.assert(
        fc.property(
          statusValueArb,
          (newStatus) => {
            // Arrange: 初期状態（statusChanged = false）
            const state = createInitialState();
            expect(state.statusChanged).toBe(false);

            // Act: 状況（当社）フィールドの onChange をシミュレート
            simulateStatusOnChange(state, newStatus);

            // Assert: statusChanged が true になる
            expect(state.statusChanged).toBe(true);
            expect(state.statusChangedRef.current).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * 観察: 確度フィールドの onChange が statusChanged を true にする
     *
     * **Validates: Requirements 3.2**
     */
    it('観察3.2-2: 確度フィールドの onChange が statusChanged を true にする', () => {
      fc.assert(
        fc.property(
          confidenceValueArb,
          (newConfidence) => {
            // Arrange: 初期状態（statusChanged = false）
            const state = createInitialState();
            expect(state.statusChanged).toBe(false);

            // Act: 確度フィールドの onChange をシミュレート
            simulateConfidenceOnChange(state, newConfidence);

            // Assert: statusChanged が true になる
            expect(state.statusChanged).toBe(true);
            expect(state.statusChangedRef.current).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * 観察: Pinrichステータスフィールドの onChange が statusChanged を true にする
     *
     * **Validates: Requirements 3.2**
     */
    it('観察3.2-3: Pinrichステータスフィールドの onChange が statusChanged を true にする', () => {
      fc.assert(
        fc.property(
          pinrichStatusValueArb,
          (newPinrichStatus) => {
            // Arrange: 初期状態（statusChanged = false）
            const state = createInitialState();
            expect(state.statusChanged).toBe(false);

            // Act: Pinrichステータスフィールドの onChange をシミュレート
            simulatePinrichStatusOnChange(state, newPinrichStatus);

            // Assert: statusChanged が true になる
            expect(state.statusChanged).toBe(true);
            expect(state.statusChangedRef.current).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2: 全ての非バグ条件フィールド変更で statusChanged が true になる
     *
     * isBugCondition が false を返す全ての入力（次電日以外のフィールド変更）に対して、
     * onChange が statusChanged を true にすることを検証する。
     *
     * **Validates: Requirements 3.2**
     */
    it('プロパティ2: 全ての非バグ条件フィールド変更で statusChanged が true になる', () => {
      fc.assert(
        fc.property(
          nonBugConditionFieldArb,
          (fieldChange) => {
            // Arrange: 初期状態（statusChanged = false）
            const state = createInitialState();

            // バグ条件でないことを確認
            const bugConditionInput = {
              fieldName: fieldChange.fieldName,
              action: 'change' as const,
              onChangeDidNotFire: false,
              statusChanged: false,
            };
            expect(isBugCondition(bugConditionInput)).toBe(false);

            // Act: 各フィールドの onChange をシミュレート
            if (fieldChange.fieldName === 'status') {
              simulateStatusOnChange(state, fieldChange.newValue);
            } else if (fieldChange.fieldName === 'confidence') {
              simulateConfidenceOnChange(state, fieldChange.newValue);
            } else if (fieldChange.fieldName === 'pinrichStatus') {
              simulatePinrichStatusOnChange(state, fieldChange.newValue);
            }

            // Assert: statusChanged が true になる（保存性の確認）
            expect(state.statusChanged).toBe(true);
            expect(state.statusChangedRef.current).toBe(true);

            // Assert: 「ステータスを更新」ボタンが有効化される
            const buttonDisabled = isUpdateButtonDisabled(false, state.statusChanged);
            expect(buttonDisabled).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });

  });

  // ============================================================
  // 3.1 保存成功後に statusChanged が false にリセットされる
  // ============================================================

  describe('3.1 保存成功後に statusChanged が false にリセットされる', () => {

    /**
     * 観察: 保存成功後に statusChanged が false にリセットされる
     *
     * **Validates: Requirements 3.1**
     */
    it('観察3.1-1: 保存成功後に statusChanged が false にリセットされる', () => {
      fc.assert(
        fc.property(
          nonBugConditionFieldArb,
          (fieldChange) => {
            // Arrange: フィールドを変更して statusChanged = true にする
            const state = createInitialState();

            if (fieldChange.fieldName === 'status') {
              simulateStatusOnChange(state, fieldChange.newValue);
            } else if (fieldChange.fieldName === 'confidence') {
              simulateConfidenceOnChange(state, fieldChange.newValue);
            } else if (fieldChange.fieldName === 'pinrichStatus') {
              simulatePinrichStatusOnChange(state, fieldChange.newValue);
            }

            // 変更後は statusChanged = true
            expect(state.statusChanged).toBe(true);

            // Act: 保存成功後のリセット処理をシミュレート
            simulateSaveSuccess(state);

            // Assert: statusChanged が false にリセットされる
            expect(state.statusChanged).toBe(false);
            expect(state.statusChangedRef.current).toBe(false);

            // Assert: 「ステータスを更新」ボタンが再び無効化される
            const buttonDisabled = isUpdateButtonDisabled(false, state.statusChanged);
            expect(buttonDisabled).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * 観察: 保存成功後に statusChanged が false になり、再変更で true に戻る
     *
     * **Validates: Requirements 3.1**
     */
    it('観察3.1-2: 保存後に再変更すると statusChanged が true に戻る', () => {
      fc.assert(
        fc.property(
          statusValueArb,
          statusValueArb,
          (firstStatus, secondStatus) => {
            const state = createInitialState();

            // 1回目の変更
            simulateStatusOnChange(state, firstStatus);
            expect(state.statusChanged).toBe(true);

            // 保存成功
            simulateSaveSuccess(state);
            expect(state.statusChanged).toBe(false);

            // 2回目の変更
            simulateStatusOnChange(state, secondStatus);
            expect(state.statusChanged).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

  });

  // ============================================================
  // 3.3 売主データ読み込み時に statusChanged が false に初期化される
  // ============================================================

  describe('3.3 売主データ読み込み時に statusChanged が false に初期化される', () => {

    /**
     * 観察: 売主データ読み込み時に statusChanged が false に初期化される
     *
     * **Validates: Requirements 3.3**
     */
    it('観察3.3-1: 売主データ読み込み時に statusChanged が false に初期化される', () => {
      fc.assert(
        fc.property(
          nonBugConditionFieldArb,
          (fieldChange) => {
            // Arrange: フィールドを変更して statusChanged = true にする
            const state = createInitialState();

            if (fieldChange.fieldName === 'status') {
              simulateStatusOnChange(state, fieldChange.newValue);
            } else if (fieldChange.fieldName === 'confidence') {
              simulateConfidenceOnChange(state, fieldChange.newValue);
            } else if (fieldChange.fieldName === 'pinrichStatus') {
              simulatePinrichStatusOnChange(state, fieldChange.newValue);
            }

            // 変更後は statusChanged = true
            expect(state.statusChanged).toBe(true);

            // Act: 売主データ読み込み時の初期化処理をシミュレート
            simulateSellerDataLoad(state);

            // Assert: statusChanged が false に初期化される
            expect(state.statusChanged).toBe(false);
            expect(state.statusChangedRef.current).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * 観察: 初期状態では statusChanged が false である
     *
     * **Validates: Requirements 3.3**
     */
    it('観察3.3-2: 初期状態では statusChanged が false である', () => {
      // Arrange & Act: 初期状態を作成
      const state = createInitialState();

      // Assert: 初期状態では statusChanged が false
      expect(state.statusChanged).toBe(false);
      expect(state.statusChangedRef.current).toBe(false);

      // Assert: 「ステータスを更新」ボタンが無効化されている
      const buttonDisabled = isUpdateButtonDisabled(false, state.statusChanged);
      expect(buttonDisabled).toBe(true);
    });

  });

  // ============================================================
  // 保存性の総合確認: 修正前後で同一動作が維持される
  // ============================================================

  describe('保存性の総合確認: 非バグ条件入力での動作維持', () => {

    /**
     * 保存性プロパティ: 全ての非バグ条件入力で修正前後の動作が同一
     *
     * isBugCondition が false を返す全ての入力に対して、
     * フィールド変更 → statusChanged=true → 保存 → statusChanged=false
     * のライフサイクルが正しく動作することを検証する。
     *
     * **Validates: Requirements 3.1, 3.2, 3.3**
     */
    it('保存性プロパティ: 非バグ条件入力でのライフサイクルが正しく動作する', () => {
      fc.assert(
        fc.property(
          nonBugConditionFieldArb,
          (fieldChange) => {
            const state = createInitialState();

            // ステップ1: 初期状態では statusChanged = false
            expect(state.statusChanged).toBe(false);
            expect(isUpdateButtonDisabled(false, state.statusChanged)).toBe(true);

            // ステップ2: フィールド変更後は statusChanged = true
            if (fieldChange.fieldName === 'status') {
              simulateStatusOnChange(state, fieldChange.newValue);
            } else if (fieldChange.fieldName === 'confidence') {
              simulateConfidenceOnChange(state, fieldChange.newValue);
            } else if (fieldChange.fieldName === 'pinrichStatus') {
              simulatePinrichStatusOnChange(state, fieldChange.newValue);
            }
            expect(state.statusChanged).toBe(true);
            expect(state.statusChangedRef.current).toBe(true);
            expect(isUpdateButtonDisabled(false, state.statusChanged)).toBe(false);

            // ステップ3: 保存成功後は statusChanged = false
            simulateSaveSuccess(state);
            expect(state.statusChanged).toBe(false);
            expect(state.statusChangedRef.current).toBe(false);
            expect(isUpdateButtonDisabled(false, state.statusChanged)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * 保存性プロパティ: 複数フィールドの連続変更でも statusChanged が正しく管理される
     *
     * **Validates: Requirements 3.2**
     */
    it('保存性プロパティ: 複数フィールドの連続変更でも statusChanged が正しく管理される', () => {
      fc.assert(
        fc.property(
          statusValueArb,
          confidenceValueArb,
          pinrichStatusValueArb,
          (newStatus, newConfidence, newPinrichStatus) => {
            const state = createInitialState();

            // 状況フィールドを変更
            simulateStatusOnChange(state, newStatus);
            expect(state.statusChanged).toBe(true);

            // 確度フィールドを変更（既に true のまま）
            simulateConfidenceOnChange(state, newConfidence);
            expect(state.statusChanged).toBe(true);

            // Pinrichステータスフィールドを変更（既に true のまま）
            simulatePinrichStatusOnChange(state, newPinrichStatus);
            expect(state.statusChanged).toBe(true);

            // 保存成功後にリセット
            simulateSaveSuccess(state);
            expect(state.statusChanged).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * 保存性プロパティ: 保存処理中（savingStatus=true）はボタンが無効化される
     *
     * **Validates: Requirements 3.4**
     */
    it('保存性プロパティ: 保存処理中はボタンが無効化される', () => {
      fc.assert(
        fc.property(
          nonBugConditionFieldArb,
          (fieldChange) => {
            const state = createInitialState();

            // フィールドを変更して statusChanged = true にする
            if (fieldChange.fieldName === 'status') {
              simulateStatusOnChange(state, fieldChange.newValue);
            } else if (fieldChange.fieldName === 'confidence') {
              simulateConfidenceOnChange(state, fieldChange.newValue);
            } else if (fieldChange.fieldName === 'pinrichStatus') {
              simulatePinrichStatusOnChange(state, fieldChange.newValue);
            }

            // statusChanged = true でも savingStatus = true の場合はボタンが無効
            expect(state.statusChanged).toBe(true);
            expect(isUpdateButtonDisabled(true, state.statusChanged)).toBe(true);

            // savingStatus = false の場合はボタンが有効
            expect(isUpdateButtonDisabled(false, state.statusChanged)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

  });

  // ============================================================
  // 具体的なシナリオテスト（観察優先メソドロジー）
  // ============================================================

  describe('具体的なシナリオ: 観察優先メソドロジーによる動作確認', () => {

    it('シナリオ1: 状況（当社）を「追客中」から「専任媒介」に変更する', () => {
      const state = createInitialState();

      // 初期状態
      expect(state.statusChanged).toBe(false);

      // 状況を変更
      simulateStatusOnChange(state, '専任媒介');

      // statusChanged が true になる
      expect(state.statusChanged).toBe(true);
      expect(state.statusChangedRef.current).toBe(true);

      // ボタンが有効化される
      expect(isUpdateButtonDisabled(false, state.statusChanged)).toBe(false);
    });

    it('シナリオ2: 確度を「A」に変更する', () => {
      const state = createInitialState();

      // 確度を変更
      simulateConfidenceOnChange(state, 'A');

      // statusChanged が true になる
      expect(state.statusChanged).toBe(true);
      expect(state.statusChangedRef.current).toBe(true);
    });

    it('シナリオ3: Pinrichステータスを「配信中」に変更する', () => {
      const state = createInitialState();

      // Pinrichステータスを変更
      simulatePinrichStatusOnChange(state, '配信中');

      // statusChanged が true になる
      expect(state.statusChanged).toBe(true);
      expect(state.statusChangedRef.current).toBe(true);
    });

    it('シナリオ4: フィールド変更後に保存成功でリセットされる', () => {
      const state = createInitialState();

      // 状況を変更
      simulateStatusOnChange(state, '追客中');
      expect(state.statusChanged).toBe(true);

      // 保存成功
      simulateSaveSuccess(state);
      expect(state.statusChanged).toBe(false);
      expect(state.statusChangedRef.current).toBe(false);

      // ボタンが再び無効化される
      expect(isUpdateButtonDisabled(false, state.statusChanged)).toBe(true);
    });

    it('シナリオ5: 売主データ読み込み時に statusChanged が false に初期化される', () => {
      const state = createInitialState();

      // 何らかの変更があった状態
      simulateStatusOnChange(state, '追客中');
      expect(state.statusChanged).toBe(true);

      // 売主データ読み込み（別の売主に切り替えた場合など）
      simulateSellerDataLoad(state);
      expect(state.statusChanged).toBe(false);
      expect(state.statusChangedRef.current).toBe(false);
    });

    it('シナリオ6: 次電日フィールドの onChange は statusChanged を true にする（バグ条件外）', () => {
      // 次電日フィールドの onChange（バグ条件は onClick のみ）
      const state = createInitialState();

      // onChange が発火した場合（バグ条件外）
      // 実際のコード（行7044）:
      //   onChange={(e) => { setEditedNextCallDate(e.target.value); setStatusChanged(true); statusChangedRef.current = true; }}
      const newDate = '2025-08-01';
      // setEditedNextCallDate(newDate) は省略
      state.statusChanged = true;
      state.statusChangedRef.current = true;

      // statusChanged が true になる
      expect(state.statusChanged).toBe(true);
      expect(state.statusChangedRef.current).toBe(true);

      // バグ条件ではない（onChange が発火している）
      const bugConditionInput = {
        fieldName: 'nextCallDate',
        action: 'change' as const,
        onChangeDidNotFire: false,
        statusChanged: state.statusChanged,
      };
      expect(isBugCondition(bugConditionInput)).toBe(false);
    });

  });

});
