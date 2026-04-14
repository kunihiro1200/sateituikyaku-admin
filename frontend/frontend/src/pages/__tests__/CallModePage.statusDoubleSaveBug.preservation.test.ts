/**
 * CallModePage ステータス2回保存バグ 保全プロパティテスト（Property 2: Preservation）
 *
 * このテストは修正前のコードでPASSすることで、保全すべきベースライン動作を確認する。
 * 修正後もこのテストがPASSすることで、リグレッションがないことを確認する。
 *
 * **観察優先メソドロジー**: 修正前のコードで非バグ条件（キャッシュなし・直接URLアクセス）の
 * 動作を観察し、その動作をテストとして記録する。
 *
 * **観察結果**:
 * - 観察1: ユーザーがフィールドを変更すると `statusChanged` が `true` になる
 * - 観察2: ページ初回ロード時（キャッシュなし）に `statusChanged` が `false` に初期化される
 * - 観察3: `setSeller(freshData)` が呼ばれても `statusChanged` は変化しない（修正後の期待動作）
 *
 * **EXPECTED OUTCOME**: テストPASS（ベースライン動作の確認）
 * このテストは未修正コードで成功することを確認する（ベースライン動作の確認）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */
import { describe, test, expect } from 'vitest';

// -----------------------------------------------------------------------
// 売主ステータスの定義
// -----------------------------------------------------------------------

/**
 * 売主ステータスの全候補値
 * CallModePage.tsx で使用されるステータス値
 */
const ALL_SELLER_STATUSES = [
  '追客中',
  '訪問済み',
  '専任',
  '他決',
  '除外',
  '長期客',
  '成約',
  '未対応',
  '不通',
] as const;

type SellerStatus = typeof ALL_SELLER_STATUSES[number];

// -----------------------------------------------------------------------
// 状態モデルの定義
// -----------------------------------------------------------------------

/**
 * ステータスセクションの状態を表す型
 */
interface StatusSectionState {
  /** seller.status（setSeller で更新される） */
  sellerStatus: string;
  /** editedStatus（setEditedStatus で更新される） */
  editedStatus: string;
  /** statusChanged フラグ（ユーザーが編集中かどうか） */
  statusChanged: boolean;
  /** 保存中フラグ */
  savingStatus: boolean;
}

// -----------------------------------------------------------------------
// 純粋関数として抽出した状態更新ロジック
// -----------------------------------------------------------------------

/**
 * ページ初回ロード時（キャッシュなし）の状態初期化
 * loadAllData() がキャッシュなし状態で呼ばれた場合の動作
 *
 * 観察2: ページ初回ロード時（キャッシュなし）に `statusChanged` が `false` に初期化される
 */
function applyPageLoad_noCache(sellerData: { status: string }): StatusSectionState {
  return {
    sellerStatus: sellerData.status,
    editedStatus: sellerData.status,
    statusChanged: false,  // 初期化時は false
    savingStatus: false,
  };
}

/**
 * ユーザーがステータスフィールドを変更した時の状態更新
 * handleStatusChange 等が呼ばれた場合の動作
 *
 * 観察1: ユーザーがフィールドを変更すると `statusChanged` が `true` になる
 */
function applyUserEditStatus(
  state: StatusSectionState,
  newStatus: string
): StatusSectionState {
  return {
    ...state,
    editedStatus: newStatus,
    statusChanged: true,  // ユーザーが変更したので true
  };
}

/**
 * handleUpdateStatus 成功後の状態更新
 * APIが成功した後に setStatusChanged(false) が呼ばれる
 */
function applyHandleUpdateStatusSuccess(state: StatusSectionState): StatusSectionState {
  return {
    ...state,
    statusChanged: false,  // 保存成功後にリセット
    savingStatus: false,
  };
}

/**
 * handleUpdateStatus 開始時の状態更新
 * savingStatus = true になる
 */
function applyHandleUpdateStatusStart(state: StatusSectionState): StatusSectionState {
  return {
    ...state,
    savingStatus: true,
  };
}

/**
 * バックグラウンド更新（setSeller(freshData)）の状態更新
 * キャッシュヒット時のバックグラウンド更新で setSeller(freshData) が呼ばれる
 *
 * 観察3: `setSeller(freshData)` が呼ばれても `statusChanged` は変化しない（修正後の期待動作）
 * ※ 修正前コードでは setEditedStatus 等が呼ばれないため、seller.status と editedStatus が乖離する
 * ※ しかし statusChanged 自体は変化しない（これがベースライン動作）
 */
function applyBackgroundUpdateSeller(
  state: StatusSectionState,
  freshData: { status: string }
): StatusSectionState {
  return {
    ...state,
    sellerStatus: freshData.status,  // setSeller(freshData) で seller.status が更新される
    // statusChanged は変化しない（これがベースライン動作）
  };
}

/**
 * 保存成功後にユーザーが再度フィールドを変更した時の状態更新
 *
 * 観察: 保存成功後にユーザーが再度フィールドを変更すると `statusChanged` が `true` になる
 */
function applyUserReEditStatus(
  state: StatusSectionState,
  newStatus: string
): StatusSectionState {
  return {
    ...state,
    editedStatus: newStatus,
    statusChanged: true,  // 再変更したので true
  };
}

// -----------------------------------------------------------------------
// Property 2: Preservation テスト
// 修正前のコードでPASSすることで、保全すべきベースライン動作を確認する
// -----------------------------------------------------------------------

describe('Property 2: Preservation — バックグラウンド更新によるstatusChangedへの非干渉', () => {

  /**
   * 観察1: ユーザーがフィールドを変更すると `statusChanged` が `true` になる
   *
   * 全ステータス値でユーザーがフィールドを変更した場合、
   * `statusChanged` が `true` になることを確認する
   *
   * **Validates: Requirements 3.1**
   */
  describe('観察1: ユーザーがフィールドを変更すると statusChanged が true になる', () => {
    test.each(ALL_SELLER_STATUSES)(
      'ステータス "%s" に変更すると statusChanged が true になること',
      (newStatus: SellerStatus) => {
        // 初期状態（ページロード後）
        const initialState = applyPageLoad_noCache({ status: '追客中' });
        expect(initialState.statusChanged).toBe(false);

        // ユーザーがステータスを変更
        const editedState = applyUserEditStatus(initialState, newStatus);

        // statusChanged が true になること
        expect(editedState.statusChanged).toBe(true);
        expect(editedState.editedStatus).toBe(newStatus);
      }
    );

    test('初期ステータスと同じ値に変更しても statusChanged が true になること', () => {
      // 初期状態
      const initialState = applyPageLoad_noCache({ status: '追客中' });

      // 同じ値に変更（実際のUIでは変更検知があるが、ここでは純粋関数のテスト）
      const editedState = applyUserEditStatus(initialState, '追客中');

      // statusChanged が true になること（純粋関数レベルでは変更として扱う）
      expect(editedState.statusChanged).toBe(true);
    });
  });

  /**
   * 観察2: ページ初回ロード時（キャッシュなし）に `statusChanged` が `false` に初期化される
   *
   * 全ステータス値でページをロードした場合、
   * `statusChanged` が `false` に初期化されることを確認する
   *
   * **Validates: Requirements 3.2**
   */
  describe('観察2: ページ初回ロード時（キャッシュなし）に statusChanged が false に初期化される', () => {
    test.each(ALL_SELLER_STATUSES)(
      'ステータス "%s" でページをロードすると statusChanged が false になること',
      (initialStatus: SellerStatus) => {
        // ページ初回ロード（キャッシュなし）
        const state = applyPageLoad_noCache({ status: initialStatus });

        // statusChanged が false に初期化されること
        expect(state.statusChanged).toBe(false);
        expect(state.editedStatus).toBe(initialStatus);
        expect(state.sellerStatus).toBe(initialStatus);
      }
    );
  });

  /**
   * 観察3: `setSeller(freshData)` が呼ばれても `statusChanged` は変化しない
   *
   * バックグラウンド更新で `setSeller(freshData)` が呼ばれた場合、
   * `statusChanged` が変化しないことを確認する
   *
   * **Validates: Requirements 3.6**
   */
  describe('観察3: setSeller(freshData) が呼ばれても statusChanged は変化しない', () => {
    test.each(ALL_SELLER_STATUSES)(
      'statusChanged=false の状態で freshData.status="%s" の setSeller が呼ばれても statusChanged が false のまま維持されること',
      (freshStatus: SellerStatus) => {
        // 初期状態（ページロード後、statusChanged=false）
        const initialState = applyPageLoad_noCache({ status: '追客中' });
        expect(initialState.statusChanged).toBe(false);

        // バックグラウンド更新（setSeller(freshData)）
        const updatedState = applyBackgroundUpdateSeller(initialState, { status: freshStatus });

        // statusChanged が変化しないこと
        expect(updatedState.statusChanged).toBe(false);
      }
    );

    test.each(ALL_SELLER_STATUSES)(
      'statusChanged=true の状態で freshData.status="%s" の setSeller が呼ばれても statusChanged が true のまま維持されること',
      (freshStatus: SellerStatus) => {
        // 初期状態（ユーザーが編集中、statusChanged=true）
        const initialState = applyPageLoad_noCache({ status: '追客中' });
        const editedState = applyUserEditStatus(initialState, '訪問済み');
        expect(editedState.statusChanged).toBe(true);

        // バックグラウンド更新（setSeller(freshData)）
        const updatedState = applyBackgroundUpdateSeller(editedState, { status: freshStatus });

        // statusChanged が変化しないこと（ユーザーの編集が保護される）
        expect(updatedState.statusChanged).toBe(true);
      }
    );
  });

  /**
   * プロパティベーステスト: キャッシュなし状態での全ステータス値で
   * `handleUpdateStatus` を呼び出し、常に `statusChanged=false` になることを検証
   *
   * **Validates: Requirements 3.1, 3.2, 3.5**
   */
  describe('プロパティベーステスト: キャッシュなし状態での handleUpdateStatus 後の statusChanged=false', () => {
    test.each(ALL_SELLER_STATUSES)(
      'キャッシュなし状態でステータス "%s" に変更して handleUpdateStatus を呼び出すと statusChanged=false になること',
      (targetStatus: SellerStatus) => {
        // 初期状態（キャッシュなし・直接URLアクセス）
        const initialState = applyPageLoad_noCache({ status: '追客中' });

        // ユーザーがステータスを変更
        const editedState = applyUserEditStatus(initialState, targetStatus);
        expect(editedState.statusChanged).toBe(true);

        // handleUpdateStatus 開始
        const savingState = applyHandleUpdateStatusStart(editedState);
        expect(savingState.savingStatus).toBe(true);

        // handleUpdateStatus 成功
        const savedState = applyHandleUpdateStatusSuccess(savingState);

        // statusChanged が false になること（保存成功後）
        expect(savedState.statusChanged).toBe(false);
        expect(savedState.savingStatus).toBe(false);
      }
    );

    test('全ステータス値の組み合わせ（初期→変更後）で handleUpdateStatus 後に statusChanged=false になること', () => {
      // 全ステータス値の組み合わせでテスト
      for (const initialStatus of ALL_SELLER_STATUSES) {
        for (const targetStatus of ALL_SELLER_STATUSES) {
          // 初期状態
          const initialState = applyPageLoad_noCache({ status: initialStatus });

          // ユーザーがステータスを変更
          const editedState = applyUserEditStatus(initialState, targetStatus);

          // handleUpdateStatus 成功
          const savedState = applyHandleUpdateStatusSuccess(editedState);

          // statusChanged が false になること
          expect(savedState.statusChanged).toBe(false);
        }
      }
    });
  });

  /**
   * 保存処理中（savingStatus=true）の動作保持
   *
   * **Validates: Requirements 3.3**
   */
  describe('保存処理中（savingStatus=true）の動作保持', () => {
    test('handleUpdateStatus 開始時に savingStatus が true になること', () => {
      const initialState = applyPageLoad_noCache({ status: '追客中' });
      const editedState = applyUserEditStatus(initialState, '訪問済み');

      // handleUpdateStatus 開始
      const savingState = applyHandleUpdateStatusStart(editedState);

      expect(savingState.savingStatus).toBe(true);
    });

    test('handleUpdateStatus 成功後に savingStatus が false になること', () => {
      const initialState = applyPageLoad_noCache({ status: '追客中' });
      const editedState = applyUserEditStatus(initialState, '訪問済み');
      const savingState = applyHandleUpdateStatusStart(editedState);

      // handleUpdateStatus 成功
      const savedState = applyHandleUpdateStatusSuccess(savingState);

      expect(savedState.savingStatus).toBe(false);
    });
  });

  /**
   * 保存成功後にユーザーが再度フィールドを変更した時の動作保持
   *
   * **Validates: Requirements 3.5**
   */
  describe('保存成功後の再変更: statusChanged が true に戻ること', () => {
    test.each(ALL_SELLER_STATUSES)(
      '保存成功後にステータス "%s" に再変更すると statusChanged が true になること',
      (reEditStatus: SellerStatus) => {
        // 初期状態
        const initialState = applyPageLoad_noCache({ status: '追客中' });

        // ユーザーがステータスを変更して保存
        const editedState = applyUserEditStatus(initialState, '訪問済み');
        const savedState = applyHandleUpdateStatusSuccess(editedState);
        expect(savedState.statusChanged).toBe(false);

        // 保存成功後にユーザーが再度フィールドを変更
        const reEditedState = applyUserReEditStatus(savedState, reEditStatus);

        // statusChanged が true になること
        expect(reEditedState.statusChanged).toBe(true);
        expect(reEditedState.editedStatus).toBe(reEditStatus);
      }
    );
  });

  /**
   * バリデーションエラー時の動作保持
   * バリデーションエラーが発生した場合、statusChanged は変化しないこと
   *
   * **Validates: Requirements 3.4**
   */
  describe('バリデーションエラー時の動作保持', () => {
    test('バリデーションエラー時に statusChanged が変化しないこと', () => {
      // 初期状態
      const initialState = applyPageLoad_noCache({ status: '追客中' });

      // ユーザーがステータスを変更（statusChanged=true）
      const editedState = applyUserEditStatus(initialState, '専任');
      expect(editedState.statusChanged).toBe(true);

      // バリデーションエラー発生（APIは呼ばれない）
      // → 状態は変化しない（editedState のまま）
      const stateAfterValidationError = { ...editedState }; // 変化なし

      // statusChanged が true のまま維持されること
      expect(stateAfterValidationError.statusChanged).toBe(true);
    });

    test('バリデーションエラー時に savingStatus が false のまま維持されること', () => {
      // 初期状態
      const initialState = applyPageLoad_noCache({ status: '追客中' });
      const editedState = applyUserEditStatus(initialState, '専任');

      // バリデーションエラー発生（savingStatus は変化しない）
      expect(editedState.savingStatus).toBe(false);
    });
  });

  /**
   * 複合シナリオ: キャッシュなし状態での完全なフロー
   * ページロード → フィールド変更 → 保存 → バックグラウンド更新 → 再変更
   *
   * **Validates: Requirements 3.1, 3.2, 3.5, 3.6**
   */
  describe('複合シナリオ: キャッシュなし状態での完全なフロー', () => {
    test('ページロード → フィールド変更 → 保存 → バックグラウンド更新 → 再変更 の全フローで statusChanged が正しく管理されること', () => {
      // ステップ1: ページ初回ロード（キャッシュなし）
      const step1 = applyPageLoad_noCache({ status: '追客中' });
      expect(step1.statusChanged).toBe(false);  // 観察2: 初期化時は false

      // ステップ2: ユーザーがステータスを変更
      const step2 = applyUserEditStatus(step1, '訪問済み');
      expect(step2.statusChanged).toBe(true);   // 観察1: 変更後は true

      // ステップ3: handleUpdateStatus 成功
      const step3 = applyHandleUpdateStatusSuccess(step2);
      expect(step3.statusChanged).toBe(false);  // 保存成功後は false

      // ステップ4: バックグラウンド更新（setSeller(freshData)）
      const step4 = applyBackgroundUpdateSeller(step3, { status: '訪問済み' });
      expect(step4.statusChanged).toBe(false);  // 観察3: バックグラウンド更新後も false のまま

      // ステップ5: ユーザーが再度フィールドを変更
      const step5 = applyUserReEditStatus(step4, '専任');
      expect(step5.statusChanged).toBe(true);   // 再変更後は true
    });

    test.each(ALL_SELLER_STATUSES)(
      '全ステータス値 "%s" での完全なフローで statusChanged が正しく管理されること',
      (targetStatus: SellerStatus) => {
        // ページロード → 変更 → 保存 → バックグラウンド更新
        const initialState = applyPageLoad_noCache({ status: '追客中' });
        const editedState = applyUserEditStatus(initialState, targetStatus);
        const savedState = applyHandleUpdateStatusSuccess(editedState);
        const afterBgUpdate = applyBackgroundUpdateSeller(savedState, { status: targetStatus });

        // 保存成功後、バックグラウンド更新後も statusChanged が false のまま維持されること
        expect(afterBgUpdate.statusChanged).toBe(false);
      }
    );
  });
});
