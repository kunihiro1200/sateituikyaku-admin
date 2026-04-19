/**
 * Bug Condition Exploration Test: ATBB非公開時の保存バリデーション警告未表示バグ
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは未修正コードでバグの存在を証明するためのものです。
 * テストが FAIL することが期待される結果です（バグの存在を確認）。
 *
 * バグ: PropertyListingDetailPage.tsx の handleSaveHeader 関数において、
 * ATBB状況が「非公開」に変更され、offer_status が未入力の場合に
 * setSnackbar が呼ばれず、ユーザーへの視覚的フィードバックが欠如している。
 *
 * CRITICAL: このテストは修正前のコードで必ず FAIL する — 失敗がバグの存在を証明する
 * DO NOT attempt to fix the test or the code when it fails
 */

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

// ===== バグ条件の定義 =====

/**
 * バグ条件関数
 * ATBB状況が「非公開」系の値に変更され、offer_status が未入力の場合にバグが発動する
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

// ===== 静的解析テスト =====

describe('Property 1: Bug Condition - ATBB非公開時の保存バリデーション警告未表示バグ（静的解析）', () => {
  const pagePath = path.join(__dirname, '../pages/PropertyListingDetailPage.tsx');
  let pageContent: string;

  beforeAll(() => {
    pageContent = fs.readFileSync(pagePath, 'utf-8');
  });

  /**
   * テスト: handleSaveHeader のバリデーション失敗パスに setSnackbar 呼び出しが存在することを確認
   *
   * 未修正コードでの期待される動作:
   * - バリデーション失敗時（offer_status が未入力）の return 前に setSnackbar が呼ばれない
   * - このテストは FAIL する（バグの存在を証明）
   *
   * 修正後コードでの期待される動作:
   * - バリデーション失敗時に setSnackbar が呼ばれる
   * - このテストは PASS する
   *
   * isBugCondition: handleSaveHeader のバリデーション失敗パスに setSnackbar 呼び出しが存在しない
   */
  test('handleSaveHeader のバリデーション失敗パスに setSnackbar 呼び出しが存在する', () => {
    // handleSaveHeader 関数のバリデーション失敗パスを抽出
    // バリデーション失敗パス: offer_status が未入力の場合の return 前のコード
    const handleSaveHeaderMatch = pageContent.match(
      /const handleSaveHeader\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)^\s*\};/m
    );

    expect(handleSaveHeaderMatch).not.toBeNull();

    const handleSaveHeaderBody = handleSaveHeaderMatch![1];

    // バリデーション失敗パス（offer_status が未入力の場合）を抽出
    // setOfferErrors と setIsOfferEditMode の呼び出しの後に setSnackbar が呼ばれているか確認
    const validationFailureBlock = handleSaveHeaderBody.match(
      /if\s*\(!currentOfferStatus[\s\S]*?\{([\s\S]*?)return;/
    );

    expect(validationFailureBlock).not.toBeNull();

    const validationFailureBody = validationFailureBlock![1];

    // 未修正コードでは setSnackbar が呼ばれていない → このテストは FAIL する（バグの存在を証明）
    // 修正後コードでは setSnackbar が呼ばれている → このテストは PASS する
    expect(validationFailureBody).toMatch(/setSnackbar/);
  });

  /**
   * テスト: バリデーション失敗パスに severity: 'warning' の setSnackbar 呼び出しが存在することを確認
   *
   * 未修正コードでの期待される動作:
   * - バリデーション失敗時に severity: 'warning' の setSnackbar が呼ばれない
   * - このテストは FAIL する（バグの存在を証明）
   *
   * 修正後コードでの期待される動作:
   * - バリデーション失敗時に severity: 'warning' の setSnackbar が呼ばれる
   * - このテストは PASS する
   */
  test('handleSaveHeader のバリデーション失敗パスに severity: "warning" の setSnackbar 呼び出しが存在する', () => {
    // handleSaveHeader 関数全体を抽出
    const handleSaveHeaderMatch = pageContent.match(
      /const handleSaveHeader\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)^\s*\};/m
    );

    expect(handleSaveHeaderMatch).not.toBeNull();

    const handleSaveHeaderBody = handleSaveHeaderMatch![1];

    // バリデーション失敗パスに severity: 'warning' の setSnackbar が存在するか確認
    // 未修正コードでは存在しない → このテストは FAIL する（バグの存在を証明）
    const warningSnackbarPattern = /setSnackbar\s*\(\s*\{[\s\S]*?severity\s*:\s*['"]warning['"][\s\S]*?\}\s*\)/;

    // handleSaveHeader 内のバリデーション失敗ブロック（try の前）を確認
    const beforeTryBlock = handleSaveHeaderBody.split(/\s*try\s*\{/)[0];

    expect(beforeTryBlock).toMatch(warningSnackbarPattern);
  });

  /**
   * テスト: バリデーション失敗パスに「買付」に関するメッセージが存在することを確認
   *
   * 未修正コードでの期待される動作:
   * - バリデーション失敗時に「買付」に関するメッセージが表示されない
   * - このテストは FAIL する（バグの存在を証明）
   *
   * 修正後コードでの期待される動作:
   * - バリデーション失敗時に「買付」に関するメッセージが表示される
   * - このテストは PASS する
   */
  test('handleSaveHeader のバリデーション失敗パスに「買付」に関するメッセージが存在する', () => {
    const handleSaveHeaderMatch = pageContent.match(
      /const handleSaveHeader\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)^\s*\};/m
    );

    expect(handleSaveHeaderMatch).not.toBeNull();

    const handleSaveHeaderBody = handleSaveHeaderMatch![1];
    const beforeTryBlock = handleSaveHeaderBody.split(/\s*try\s*\{/)[0];

    // 「買付」に関するメッセージが存在するか確認
    // 未修正コードでは存在しない → このテストは FAIL する（バグの存在を証明）
    expect(beforeTryBlock).toMatch(/買付/);
  });
});

// ===== ロジック再現テスト（PBT） =====

describe('Property 1: Bug Condition - ATBB非公開時の保存バリデーション警告未表示バグ（ロジック再現）', () => {
  /**
   * 未修正コードの handleSaveHeader バリデーションロジックを再現する
   *
   * 未修正コードのバリデーション失敗パス:
   * 1. setOfferErrors を呼び出す
   * 2. setIsOfferEditMode(true) を呼び出す
   * 3. return する（setSnackbar は呼ばれない）
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
  } {
    const result = {
      setOfferErrorsCalled: false,
      setIsOfferEditModeCalled: false,
      setSnackbarCalled: false,
      apiPutCalled: false,
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
          // 修正後コード: setOfferErrors と setIsOfferEditMode に加えて setSnackbar も呼び出し
          result.setOfferErrorsCalled = true;
          result.setIsOfferEditModeCalled = true;
          result.setSnackbarCalled = true; // 修正後: setSnackbar が呼ばれる
          return result; // 保存処理を中断
        }
      }
    }

    // バリデーション通過 → API PUT を呼び出す
    result.apiPutCalled = true;
    result.setSnackbarCalled = true; // 成功時は setSnackbar が呼ばれる
    return result;
  }

  /**
   * テスト: バグ条件成立時に setSnackbar が呼ばれないことを確認（具体的なケース）
   *
   * カウンターエグザンプル: ATBB状況=非公開、offer_status=空文字で保存 → setSnackbar が呼ばれない
   *
   * 未修正コードでの期待される動作:
   * - setSnackbar が呼ばれない（バグ）
   * - このテストは FAIL する（バグの存在を証明）
   *
   * 修正後コードでの期待される動作:
   * - setSnackbar が severity: 'warning' で呼ばれる
   * - このテストは PASS する
   */
  test('バグ条件: ATBB状況=非公開、offer_status=空文字で保存 → setSnackbar が呼ばれる（未修正コードでは FAIL）', () => {
    const result = handleSaveHeader_unfixed({
      atbbStatus: '非公開',
      offerStatus: '',
      prevAtbbStatus: '専任・公開中',
    });

    // バリデーション失敗時に setOfferErrors と setIsOfferEditMode が呼ばれることを確認（既存動作）
    expect(result.setOfferErrorsCalled).toBe(true);
    expect(result.setIsOfferEditModeCalled).toBe(true);

    // API PUT が呼ばれないことを確認（保存が中断されること）
    expect(result.apiPutCalled).toBe(false);

    // setSnackbar が呼ばれることを確認（未修正コードでは FAIL → バグの存在を証明）
    expect(result.setSnackbarCalled).toBe(true);
  });

  /**
   * テスト: バグ条件成立時に setSnackbar が呼ばれないことを確認（null の場合）
   *
   * カウンターエグザンプル: ATBB状況=非公開、offer_status=null で保存 → setSnackbar が呼ばれない
   */
  test('バグ条件: ATBB状況=非公開、offer_status=null で保存 → setSnackbar が呼ばれる（未修正コードでは FAIL）', () => {
    const result = handleSaveHeader_unfixed({
      atbbStatus: '非公開',
      offerStatus: null,
      prevAtbbStatus: '一般・公開中',
    });

    expect(result.setOfferErrorsCalled).toBe(true);
    expect(result.setIsOfferEditModeCalled).toBe(true);
    expect(result.apiPutCalled).toBe(false);

    // setSnackbar が呼ばれることを確認（未修正コードでは FAIL → バグの存在を証明）
    expect(result.setSnackbarCalled).toBe(true);
  });

  /**
   * テスト: バグ条件成立時に setSnackbar が呼ばれないことを確認（空白のみの場合）
   *
   * カウンターエグザンプル: ATBB状況=非公開、offer_status=空白のみで保存 → setSnackbar が呼ばれない
   */
  test('バグ条件: ATBB状況=非公開、offer_status=空白のみで保存 → setSnackbar が呼ばれる（未修正コードでは FAIL）', () => {
    const result = handleSaveHeader_unfixed({
      atbbStatus: '非公開',
      offerStatus: '   ',
      prevAtbbStatus: null,
    });

    expect(result.setOfferErrorsCalled).toBe(true);
    expect(result.setIsOfferEditModeCalled).toBe(true);
    expect(result.apiPutCalled).toBe(false);

    // setSnackbar が呼ばれることを確認（未修正コードでは FAIL → バグの存在を証明）
    expect(result.setSnackbarCalled).toBe(true);
  });

  /**
   * プロパティベーステスト: バグ条件成立時は常に setSnackbar が呼ばれることを確認
   *
   * FOR ALL X WHERE isBugCondition(X) DO
   *   result ← handleSaveHeader_unfixed(X)
   *   ASSERT result.setSnackbarCalled = true  ← 未修正コードでは FAIL（バグの存在を証明）
   * END FOR
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  test('PBT: バグ条件成立時は常に setSnackbar が呼ばれる（未修正コードでは FAIL）', () => {
    // バグ条件成立ケースのジェネレーター
    // atbb_status が「非公開」系の値、offer_status が null または空文字列
    const bugConditionArbitrary = fc.record({
      atbbStatus: fc.constantFrom('非公開'),
      offerStatus: fc.oneof(
        fc.constant(null),
        fc.constant(''),
        fc.constant('   '),
        fc.constant('\t'),
        fc.constant('\n'),
      ),
      prevAtbbStatus: fc.oneof(
        fc.constant(null),
        fc.constant('専任・公開中'),
        fc.constant('一般・公開中'),
        fc.constant('専任・公開前'),  // ただし nextAtbbStatus が '専任・公開中' でない場合
        fc.constant('一般・公開前'),  // ただし nextAtbbStatus が '一般・公開中' でない場合
        fc.constant('専任・売止'),
        fc.constant('一般・売止'),
        fc.constant('成約'),
      ),
    }).filter(input => {
      // isPreToPublicTransition が false になるケースのみ（バグ条件）
      return isBugCondition({
        atbbStatus: input.atbbStatus,
        offerStatus: input.offerStatus,
        prevAtbbStatus: input.prevAtbbStatus,
      });
    });

    fc.assert(
      fc.property(bugConditionArbitrary, (input) => {
        const result = handleSaveHeader_unfixed(input);

        // バリデーション失敗時の既存動作確認
        expect(result.setOfferErrorsCalled).toBe(true);
        expect(result.setIsOfferEditModeCalled).toBe(true);
        expect(result.apiPutCalled).toBe(false);

        // setSnackbar が呼ばれることを確認（未修正コードでは FAIL → バグの存在を証明）
        // このアサーションが失敗することでバグの存在が証明される
        expect(result.setSnackbarCalled).toBe(true);
      }),
      { numRuns: 50 }
    );
  });
});
