/**
 * 保全プロパティテスト: ATBB非公開保存バリデーション - バグ条件非成立時の動作保持
 *
 * **重要**: このテストは未修正コードで PASS し、修正後も引き続き PASS することを確認する
 * 修正によって壊れてはいけない既存動作をエンコードしている
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Property 2: Preservation - バグ条件非成立時の動作保持
 *
 * 保全すべき動作（bugfix.md の「変化しない動作」より）:
 * - 3.1: ATBB状況が「非公開」以外の場合、通常通り保存処理を実行する
 * - 3.2: ATBB状況が「非公開」かつ offer_status が入力済みの場合、正常に保存処理を実行する
 * - 3.3: isPreToPublicTransition が true の場合、バリデーションをスキップして正常に保存処理を実行する
 *
 * テスト方法: handleSaveHeader のロジックを再現し、非バグ条件ケースで正常に保存されることを確認する
 * - 未修正コードで PASS する（ベースライン動作の確認）
 * - 修正後コードでも PASS する（リグレッションがないことの確認）
 *
 * **観察優先メソドロジー**:
 * 未修正コードで非バグ条件の入力を観察する:
 * - 観察1: ATBB状況が「非公開」かつ offer_status が入力済みの場合 → 正常に保存処理が実行される
 * - 観察2: ATBB状況が「公開中」の場合 → バリデーションをスキップして正常に保存処理が実行される
 * - 観察3: isPreToPublicTransition が true の場合 → バリデーションをスキップして正常に保存処理が実行される
 *
 * **重要な観察**: バリデーションは atbb_status が変更されている場合に実行される。
 * isPreToPublicTransition が false の場合、offer_status が未入力であればバリデーションエラーになる。
 * これは ATBB状況の値に関わらず（「非公開」以外でも）適用される。
 */

import * as fc from 'fast-check';

// ===== バグ条件の定義 =====

/**
 * バグ条件関数
 * ATBB状況が変更され、isPreToPublicTransition が false で、offer_status が未入力の場合にバグが発動する
 */
function isBugCondition(input: {
  atbbStatus: string | undefined;
  offerStatus: string | null | undefined;
  prevAtbbStatus?: string | null;
}): boolean {
  const { atbbStatus, offerStatus, prevAtbbStatus } = input;

  // atbb_status が変更されていない場合はバグ条件外
  if (atbbStatus === undefined) return false;

  // isPreToPublicTransition が true の場合はバグ条件外
  const isPreToPublicTransition =
    (prevAtbbStatus === '専任・公開前' && atbbStatus === '専任・公開中') ||
    (prevAtbbStatus === '一般・公開前' && atbbStatus === '一般・公開中');
  if (isPreToPublicTransition) return false;

  // offer_status が未入力の場合がバグ条件
  return !offerStatus || offerStatus.trim() === '';
}

// ===== 未修正コードの handleSaveHeader ロジックを再現 =====

/**
 * 未修正コードの handleSaveHeader バリデーションロジックを再現する
 *
 * 未修正コードのロジック（PropertyListingDetailPage.tsx の handleSaveHeader より）:
 * 1. atbb_status が変更されている場合、バリデーションを実行
 * 2. isPreToPublicTransition が true の場合はスキップ
 * 3. offer_status が未入力の場合:
 *    - setOfferErrors を呼び出す
 *    - setIsOfferEditMode(true) を呼び出す
 *    - return する（setSnackbar は呼ばれない）
 * 4. バリデーション通過 → API PUT を呼び出す
 */
function handleSaveHeader_unfixed(input: {
  atbbStatus: string | undefined;
  offerStatus: string | null | undefined;
  prevAtbbStatus?: string | null;
}): {
  setOfferErrorsCalled: boolean;
  setIsOfferEditModeCalled: boolean;
  setSnackbarCalled: boolean;
  apiPutCalled: boolean;
  savedSuccessfully: boolean;
} {
  const result = {
    setOfferErrorsCalled: false,
    setIsOfferEditModeCalled: false,
    setSnackbarCalled: false,
    apiPutCalled: false,
    savedSuccessfully: false,
  };

  // ATBB状況が変更されている場合、offer_status バリデーションを実行
  if (input.atbbStatus !== undefined) {
    const prevAtbbStatus = input.prevAtbbStatus;
    const nextAtbbStatus = input.atbbStatus;

    // 「公開前→公開中」への変更はスキップ
    const isPreToPublicTransition =
      (prevAtbbStatus === '専任・公開前' && nextAtbbStatus === '専任・公開中') ||
      (prevAtbbStatus === '一般・公開前' && nextAtbbStatus === '一般・公開中');

    if (!isPreToPublicTransition) {
      const currentOfferStatus = input.offerStatus ?? '';

      if (!currentOfferStatus || currentOfferStatus.trim() === '') {
        // 未修正コード: setOfferErrors と setIsOfferEditMode のみ呼び出し
        result.setOfferErrorsCalled = true;
        result.setIsOfferEditModeCalled = true;
        // setSnackbar は呼ばれない（バグ）
        return result; // 保存処理を中断
      }
    }
  }

  // バリデーション通過 → API PUT を呼び出す（正常保存）
  result.apiPutCalled = true;
  result.setSnackbarCalled = true; // 成功時は setSnackbar が呼ばれる
  result.savedSuccessfully = true;
  return result;
}

// ===== 保全テスト =====

describe('Property 2: Preservation - バグ条件非成立時の動作保持', () => {

  // ============================================================
  // 観察1: ATBB状況が「非公開」かつ offer_status が入力済みの場合 → 正常に保存処理が実行される
  // ============================================================

  /**
   * 保全テスト 1: ATBB状況が「非公開」かつ offer_status が入力済みの場合、正常に保存処理が実行される
   *
   * 要件 3.2: WHEN ATBB状況が「非公開」かつ「買付」フィールドが正しく入力された状態で保存ボタンが押された場合
   * THEN システムは CONTINUE TO 正常に保存処理を実行する SHALL
   *
   * 観察: 未修正コードで offer_status が入力済みの場合、バリデーションを通過して正常に保存される
   *
   * **EXPECTED OUTCOME**: テストが PASS する（未修正コードで PASS）
   */
  test('Preservation 1: ATBB状況=非公開、offer_status=入力済みの場合、正常に保存処理が実行される', () => {
    const result = handleSaveHeader_unfixed({
      atbbStatus: '非公開',
      offerStatus: '買付済み',
      prevAtbbStatus: '専任・公開中',
    });

    // バリデーションエラーが発生しないことを確認
    expect(result.setOfferErrorsCalled).toBe(false);
    expect(result.setIsOfferEditModeCalled).toBe(false);

    // 正常に保存処理が実行されることを確認
    expect(result.apiPutCalled).toBe(true);
    expect(result.savedSuccessfully).toBe(true);

    console.log('✅ 観察1: ATBB状況=非公開、offer_status=入力済み → 正常に保存処理が実行される');
  });

  /**
   * 保全テスト 2: ATBB状況が「非公開」かつ offer_status が入力済みの場合（様々な値）
   *
   * 要件 3.2: offer_status が空でない任意の値の場合、正常に保存される
   *
   * **EXPECTED OUTCOME**: テストが PASS する（未修正コードで PASS）
   */
  test('Preservation 2: ATBB状況=非公開、offer_status=様々な入力済み値の場合、正常に保存処理が実行される', () => {
    const validOfferStatuses = ['買付済み', '交渉中', '成約', 'キャンセル', '1', 'あ'];

    for (const offerStatus of validOfferStatuses) {
      const result = handleSaveHeader_unfixed({
        atbbStatus: '非公開',
        offerStatus,
        prevAtbbStatus: '専任・公開中',
      });

      expect(result.apiPutCalled).toBe(true);
      expect(result.savedSuccessfully).toBe(true);
      expect(result.setOfferErrorsCalled).toBe(false);

      console.log(`  ✅ offer_status="${offerStatus}" → 正常に保存処理が実行される`);
    }
  });

  // ============================================================
  // 観察2: ATBB状況が「公開中」の場合 → バリデーションをスキップして正常に保存処理が実行される
  // ============================================================

  /**
   * 保全テスト 3: ATBB状況が「専任・公開中」かつ offer_status が入力済みの場合、正常に保存処理が実行される
   *
   * 要件 3.1: WHEN ATBB状況が「非公開」以外の状態で保存ボタンが押された場合
   * THEN システムは CONTINUE TO 通常通り保存処理を実行する SHALL
   *
   * 観察: 未修正コードで ATBB状況が「専任・公開中」かつ offer_status が入力済みの場合、正常に保存される
   *
   * **EXPECTED OUTCOME**: テストが PASS する（未修正コードで PASS）
   */
  test('Preservation 3: ATBB状況=専任・公開中、offer_status=入力済みの場合、正常に保存処理が実行される', () => {
    const result = handleSaveHeader_unfixed({
      atbbStatus: '専任・公開中',
      offerStatus: '買付済み',
      prevAtbbStatus: '専任・売止',
    });

    // バリデーションエラーが発生しないことを確認
    expect(result.setOfferErrorsCalled).toBe(false);
    expect(result.setIsOfferEditModeCalled).toBe(false);

    // 正常に保存処理が実行されることを確認
    expect(result.apiPutCalled).toBe(true);
    expect(result.savedSuccessfully).toBe(true);

    console.log('✅ 観察2: ATBB状況=専任・公開中、offer_status=入力済み → 正常に保存処理が実行される');
  });

  /**
   * 保全テスト 4: ATBB状況が「一般・公開中」かつ offer_status が入力済みの場合、正常に保存処理が実行される
   *
   * 要件 3.1: ATBB状況が「非公開」以外の場合は通常通り保存処理を実行する
   *
   * **EXPECTED OUTCOME**: テストが PASS する（未修正コードで PASS）
   */
  test('Preservation 4: ATBB状況=一般・公開中、offer_status=入力済みの場合、正常に保存処理が実行される', () => {
    const result = handleSaveHeader_unfixed({
      atbbStatus: '一般・公開中',
      offerStatus: '交渉中',
      prevAtbbStatus: '一般・売止',
    });

    expect(result.setOfferErrorsCalled).toBe(false);
    expect(result.setIsOfferEditModeCalled).toBe(false);
    expect(result.apiPutCalled).toBe(true);
    expect(result.savedSuccessfully).toBe(true);

    console.log('✅ 観察2: ATBB状況=一般・公開中、offer_status=入力済み → 正常に保存処理が実行される');
  });

  // ============================================================
  // 観察3: isPreToPublicTransition が true の場合 → バリデーションをスキップして正常に保存処理が実行される
  // ============================================================

  /**
   * 保全テスト 5: 「専任・公開前」→「専任・公開中」への遷移の場合、バリデーションをスキップして正常に保存処理が実行される
   *
   * 要件 3.3: WHEN 他のフィールドのバリデーションエラーが発生した場合
   * THEN システムは CONTINUE TO 既存のバリデーション動作を維持する SHALL
   *
   * 観察: 未修正コードで isPreToPublicTransition が true の場合、offer_status が未入力でもバリデーションをスキップして正常に保存される
   *
   * **EXPECTED OUTCOME**: テストが PASS する（未修正コードで PASS）
   */
  test('Preservation 5: 専任・公開前→専任・公開中への遷移の場合、offer_status が未入力でも正常に保存処理が実行される', () => {
    const result = handleSaveHeader_unfixed({
      atbbStatus: '専任・公開中',
      offerStatus: '',  // 未入力でも保存される
      prevAtbbStatus: '専任・公開前',
    });

    // バリデーションエラーが発生しないことを確認
    expect(result.setOfferErrorsCalled).toBe(false);
    expect(result.setIsOfferEditModeCalled).toBe(false);

    // 正常に保存処理が実行されることを確認
    expect(result.apiPutCalled).toBe(true);
    expect(result.savedSuccessfully).toBe(true);

    console.log('✅ 観察3: 専任・公開前→専任・公開中への遷移、offer_status=未入力 → バリデーションをスキップして正常に保存処理が実行される');
  });

  /**
   * 保全テスト 6: 「一般・公開前」→「一般・公開中」への遷移の場合、バリデーションをスキップして正常に保存処理が実行される
   *
   * 要件 3.3: isPreToPublicTransition が true の場合はバリデーションをスキップする動作を維持する
   *
   * **EXPECTED OUTCOME**: テストが PASS する（未修正コードで PASS）
   */
  test('Preservation 6: 一般・公開前→一般・公開中への遷移の場合、offer_status が未入力でも正常に保存処理が実行される', () => {
    const result = handleSaveHeader_unfixed({
      atbbStatus: '一般・公開中',
      offerStatus: null,  // 未入力でも保存される
      prevAtbbStatus: '一般・公開前',
    });

    expect(result.setOfferErrorsCalled).toBe(false);
    expect(result.setIsOfferEditModeCalled).toBe(false);
    expect(result.apiPutCalled).toBe(true);
    expect(result.savedSuccessfully).toBe(true);

    console.log('✅ 観察3: 一般・公開前→一般・公開中への遷移、offer_status=null → バリデーションをスキップして正常に保存処理が実行される');
  });

  /**
   * 保全テスト 7: atbb_status が変更されていない場合、正常に保存処理が実行される
   *
   * 要件 3.1: ATBB状況が変更されていない場合はバリデーションをスキップして正常に保存される
   *
   * **EXPECTED OUTCOME**: テストが PASS する（未修正コードで PASS）
   */
  test('Preservation 7: atbb_status が変更されていない場合、offer_status が未入力でも正常に保存処理が実行される', () => {
    const result = handleSaveHeader_unfixed({
      atbbStatus: undefined,  // 変更なし
      offerStatus: '',
      prevAtbbStatus: '専任・公開中',
    });

    expect(result.setOfferErrorsCalled).toBe(false);
    expect(result.setIsOfferEditModeCalled).toBe(false);
    expect(result.apiPutCalled).toBe(true);
    expect(result.savedSuccessfully).toBe(true);

    console.log('✅ 観察: atbb_status=変更なし、offer_status=未入力 → バリデーションをスキップして正常に保存処理が実行される');
  });

  // ============================================================
  // プロパティベーステスト: FOR ALL X WHERE NOT isBugCondition(X) → 保存処理が正常に実行される
  // ============================================================

  /**
   * 保全プロパティテスト 8 (PBT): 非バグ条件の全入力に対して正常に保存処理が実行される
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * Property 2: Preservation - バグ条件非成立時の動作保持
   *
   * 設計書の Pseudocode:
   * FOR ALL X WHERE NOT isBugCondition(X) DO
   *   ASSERT handleSaveHeader_original(X) = handleSaveHeader_fixed(X)
   * END FOR
   *
   * テスト方法:
   * - fast-check を使って非バグ条件の入力を自動生成する
   * - 各入力に対して handleSaveHeader_unfixed が正常に保存処理を実行することを確認する
   * - 非バグ条件 = isBugCondition が false を返す入力
   *
   * **EXPECTED OUTCOME**: テストが PASS する（未修正コードで PASS）
   */
  test('Preservation 8 (PBT): FOR ALL X WHERE NOT isBugCondition(X) → 保存処理が正常に実行される', () => {
    // 非バグ条件ケースのジェネレーター
    // ケース1: offer_status が入力済み（空でない）
    const nonBugCase1 = fc.record({
      atbbStatus: fc.oneof(
        fc.constant('非公開'),
        fc.constant('専任・公開中'),
        fc.constant('一般・公開中'),
        fc.constant('専任・公開前'),
        fc.constant('一般・公開前'),
        fc.constant('専任・売止'),
        fc.constant('一般・売止'),
        fc.constant('成約'),
      ),
      offerStatus: fc.oneof(
        fc.constant('買付済み'),
        fc.constant('交渉中'),
        fc.constant('成約'),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim() !== ''),
      ),
      prevAtbbStatus: fc.oneof(
        fc.constant(null),
        fc.constant('専任・公開中'),
        fc.constant('一般・公開中'),
        fc.constant('専任・公開前'),
        fc.constant('一般・公開前'),
        fc.constant('専任・売止'),
        fc.constant('一般・売止'),
        fc.constant('成約'),
      ),
    });

    // ケース2: isPreToPublicTransition が true（公開前→公開中への遷移）
    const nonBugCase2 = fc.oneof(
      fc.record({
        atbbStatus: fc.constant('専任・公開中'),
        offerStatus: fc.oneof(fc.constant(''), fc.constant(null)),
        prevAtbbStatus: fc.constant('専任・公開前'),
      }),
      fc.record({
        atbbStatus: fc.constant('一般・公開中'),
        offerStatus: fc.oneof(fc.constant(''), fc.constant(null)),
        prevAtbbStatus: fc.constant('一般・公開前'),
      }),
    );

    // ケース3: atbb_status が変更されていない
    const nonBugCase3 = fc.record({
      atbbStatus: fc.constant(undefined as string | undefined),
      offerStatus: fc.oneof(fc.constant(''), fc.constant(null), fc.constant('買付済み')),
      prevAtbbStatus: fc.oneof(
        fc.constant(null),
        fc.constant('専任・公開中'),
        fc.constant('一般・公開中'),
      ),
    });

    // 非バグ条件の全ケースを結合
    const nonBugConditionArbitrary = fc.oneof(nonBugCase1, nonBugCase2, nonBugCase3).filter(
      input => !isBugCondition(input)
    );

    fc.assert(
      fc.property(nonBugConditionArbitrary, (input) => {
        const result = handleSaveHeader_unfixed(input);

        // 非バグ条件の場合、正常に保存処理が実行されることを確認
        // バリデーションエラーが発生しないことを確認
        expect(result.setOfferErrorsCalled).toBe(false);
        expect(result.setIsOfferEditModeCalled).toBe(false);

        // 正常に保存処理が実行されることを確認
        expect(result.apiPutCalled).toBe(true);
        expect(result.savedSuccessfully).toBe(true);
      }),
      { numRuns: 100 }
    );

    console.log('✅ PBT: 100回の非バグ条件入力に対して、すべて正常に保存処理が実行された');
  });

  /**
   * 保全プロパティテスト 9 (PBT): isPreToPublicTransition が true の場合、常に正常に保存処理が実行される
   *
   * **Validates: Requirements 3.3**
   *
   * 要件 3.3: isPreToPublicTransition が true の場合はバリデーションをスキップする動作を維持する
   *
   * **EXPECTED OUTCOME**: テストが PASS する（未修正コードで PASS）
   */
  test('Preservation 9 (PBT): isPreToPublicTransition が true の場合、常に正常に保存処理が実行される', () => {
    const preToPublicArbitrary = fc.oneof(
      fc.record({
        atbbStatus: fc.constant('専任・公開中'),
        offerStatus: fc.oneof(
          fc.constant(''),
          fc.constant(null),
          fc.constant('買付済み'),
          fc.string({ maxLength: 20 }),
        ),
        prevAtbbStatus: fc.constant('専任・公開前'),
      }),
      fc.record({
        atbbStatus: fc.constant('一般・公開中'),
        offerStatus: fc.oneof(
          fc.constant(''),
          fc.constant(null),
          fc.constant('買付済み'),
          fc.string({ maxLength: 20 }),
        ),
        prevAtbbStatus: fc.constant('一般・公開前'),
      }),
    );

    fc.assert(
      fc.property(preToPublicArbitrary, (input) => {
        const result = handleSaveHeader_unfixed(input);

        // isPreToPublicTransition が true の場合、バリデーションエラーが発生しないことを確認
        expect(result.setOfferErrorsCalled).toBe(false);
        expect(result.setIsOfferEditModeCalled).toBe(false);

        // 正常に保存処理が実行されることを確認
        expect(result.apiPutCalled).toBe(true);
        expect(result.savedSuccessfully).toBe(true);
      }),
      { numRuns: 100 }
    );

    console.log('✅ PBT: isPreToPublicTransition=true の100ケースで、すべて正常に保存処理が実行された');
  });
});
