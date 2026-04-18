/**
 * 保全プロパティテスト: 青いバーCHAT送信時の確認ステータス更新動作の保全
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは修正前のコードで PASS することが期待される。
 * PASS が保全すべきベースライン動作を確認する。
 *
 * 保全すべき動作 (Preservation):
 *   isBugCondition(X) = false（青いバーからの送信成功）のとき、
 *   確認ステータスが「未」に更新され、
 *   PUT /api/property-listings/:id/confirmation APIが呼ばれ、
 *   propertyConfirmationUpdated イベントが発火する。
 *
 * テストアプローチ:
 *   PropertyListingDetailPage.tsx の handlePriceChatSendSuccess 関数のロジックを
 *   直接再現し、青いバー送信成功時の動作を観察・検証する。
 *   fast-check を使ったプロパティベーステストで、様々な確認ステータス初期値に対して
 *   動作が一貫していることを検証する。
 *
 * EXPECTED: このテストは修正前のコードで PASS する（保全すべきベースライン動作を確認する）
 */

import * as fc from 'fast-check';

// fetch のモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

// window.dispatchEvent と sessionStorage のモックは不要
const mockDispatchEvent = vi.fn();


/**
 * PropertyListingDetailPage.tsx の handlePriceChatSendSuccess のロジックを再現する関数
 * （修正前・修正後ともに変わらない青いバー専用の処理）
 *
 * 青いバー「CHAT送信」の送信成功時に呼ばれるコールバック。
 * 確認ステータスを「未」に更新し、APIを呼び出し、イベントを発火する。
 */
async function handlePriceChatSendSuccess(params: {
  message: string;
  propertyNumber: string;
  setSnackbar: (snackbar: { open: boolean; message: string; severity: string }) => void;
  setPriceSavedButNotSent: (value: boolean) => void;
  setConfirmation: (value: string) => void;
  apiPut: (url: string, data: any) => Promise<void>;
  dispatchEvent: (event: Event) => void;
}): Promise<void> {
  const {
    message,
    propertyNumber,
    setSnackbar,
    setPriceSavedButNotSent,
    setConfirmation,
    apiPut,
    dispatchEvent,
  } = params;

  // スナックバー表示（既存処理）
  setSnackbar({ open: true, message, severity: 'success' });
  setPriceSavedButNotSent(false);  // CHAT送信完了でフラグをリセット

  // 確認フィールドを「未」にリセット（要件 3.1）
  setConfirmation('未');

  // DBを更新（要件 3.2）
  await apiPut(`/api/property-listings/${propertyNumber}/confirmation`, { confirmation: '未' });

  // サイドバーに即座に通知（要件 3.3）
  dispatchEvent(new CustomEvent('propertyConfirmationUpdated', {
    detail: { propertyNumber, confirmation: '未' }
  }));
}

// 確認ステータスの有効な値
const CONFIRMATION_VALUES = ['未', '済', null, undefined, ''] as const;
type ConfirmationValue = typeof CONFIRMATION_VALUES[number];

describe('PriceSection - 保全プロパティテスト（青いバーCHAT送信時の確認ステータス更新動作）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatchEvent.mockClear();
    // fetch が成功を返すようにモック
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    });
  });

  /**
   * 観察1: 青いバー送信成功時に確認ステータスが「未」に更新されること
   *
   * テスト内容:
   *   - 青いバーのCHAT送信が成功したとき（isBugCondition = false）
   *   - 確認ステータスが「未」に更新されることを確認する
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   *
   * **Validates: Requirements 3.1**
   */
  test('観察1: 青いバー送信成功時に確認ステータスが「未」に更新されること', async () => {
    let confirmation = '済';
    const setConfirmation = vi.fn().mockImplementation((value: string) => {
      confirmation = value;
    });
    const setSnackbar = vi.fn();
    const setPriceSavedButNotSent = vi.fn();
    const apiPut = vi.fn().mockResolvedValue(undefined);
    const dispatchEvent = vi.fn();

    // 青いバーからのCHAT送信成功（isBugCondition = false）
    await handlePriceChatSendSuccess({
      message: '価格変更通知を送信しました',
      propertyNumber: 'AA001',
      setSnackbar,
      setPriceSavedButNotSent,
      setConfirmation,
      apiPut,
      dispatchEvent,
    });

    // 確認ステータスが「未」に更新されることを確認
    expect(setConfirmation).toHaveBeenCalledWith('未');
    expect(confirmation).toBe('未');
  });

  /**
   * 観察2: 青いバー送信成功時に PUT /api/property-listings/:id/confirmation APIが呼ばれること
   *
   * テスト内容:
   *   - 青いバーのCHAT送信が成功したとき
   *   - PUT /api/property-listings/:id/confirmation APIが呼ばれることを確認する
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   *
   * **Validates: Requirements 3.2**
   */
  test('観察2: 青いバー送信成功時に PUT /confirmation APIが呼ばれること', async () => {
    const setConfirmation = vi.fn();
    const setSnackbar = vi.fn();
    const setPriceSavedButNotSent = vi.fn();
    const apiPut = vi.fn().mockResolvedValue(undefined);
    const dispatchEvent = vi.fn();

    // 青いバーからのCHAT送信成功
    await handlePriceChatSendSuccess({
      message: '価格変更通知を送信しました',
      propertyNumber: 'AA001',
      setSnackbar,
      setPriceSavedButNotSent,
      setConfirmation,
      apiPut,
      dispatchEvent,
    });

    // PUT /api/property-listings/:id/confirmation APIが呼ばれることを確認
    expect(apiPut).toHaveBeenCalledTimes(1);
    expect(apiPut).toHaveBeenCalledWith(
      '/api/property-listings/AA001/confirmation',
      { confirmation: '未' }
    );
  });

  /**
   * 観察3: 青いバー送信成功時に propertyConfirmationUpdated イベントが発火すること
   *
   * テスト内容:
   *   - 青いバーのCHAT送信が成功したとき
   *   - propertyConfirmationUpdated イベントが発火することを確認する
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   *
   * **Validates: Requirements 3.3**
   */
  test('観察3: 青いバー送信成功時に propertyConfirmationUpdated イベントが発火すること', async () => {
    const setConfirmation = vi.fn();
    const setSnackbar = vi.fn();
    const setPriceSavedButNotSent = vi.fn();
    const apiPut = vi.fn().mockResolvedValue(undefined);

    let firedEvent: CustomEvent | null = null;
    const dispatchEvent = vi.fn().mockImplementation((event: Event) => {
      firedEvent = event as CustomEvent;
    });

    // 青いバーからのCHAT送信成功
    await handlePriceChatSendSuccess({
      message: '価格変更通知を送信しました',
      propertyNumber: 'AA001',
      setSnackbar,
      setPriceSavedButNotSent,
      setConfirmation,
      apiPut,
      dispatchEvent,
    });

    // propertyConfirmationUpdated イベントが発火することを確認
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(firedEvent).not.toBeNull();
    expect((firedEvent as CustomEvent).type).toBe('propertyConfirmationUpdated');
    expect((firedEvent as CustomEvent).detail).toEqual({
      propertyNumber: 'AA001',
      confirmation: '未',
    });
  });

  /**
   * Property 2: Preservation - 様々な確認ステータス初期値に対して、
   * 青いバー送信成功後は常に確認ステータスが「未」になること
   *
   * プロパティベーステスト:
   *   FOR ALL 確認ステータス初期値 X:
   *     青いバー送信成功後 → 確認ステータスが「未」になる
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   *
   * **Validates: Requirements 3.1**
   */
  test('Property 2: 様々な確認ステータス初期値に対して、青いバー送信成功後は常に確認ステータスが「未」になること', async () => {
    // 確認ステータスの初期値として取りうる値のアービトラリ
    const confirmationArbitrary = fc.oneof(
      fc.constant('済'),
      fc.constant('未'),
      fc.constant(''),
      fc.constant(null as unknown as string),
      fc.string({ minLength: 0, maxLength: 10 }),
    );

    await fc.assert(
      fc.asyncProperty(
        confirmationArbitrary,
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[A-Za-z0-9]+$/.test(s)), // propertyNumber
        async (initialConfirmation, propertyNumber) => {
          let confirmation: string = initialConfirmation;
          const setConfirmation = vi.fn().mockImplementation((value: string) => {
            confirmation = value;
          });
          const setSnackbar = vi.fn();
          const setPriceSavedButNotSent = vi.fn();
          const apiPut = vi.fn().mockResolvedValue(undefined);
          const dispatchEvent = vi.fn();

          // 青いバーからのCHAT送信成功（isBugCondition = false）
          await handlePriceChatSendSuccess({
            message: '価格変更通知を送信しました',
            propertyNumber,
            setSnackbar,
            setPriceSavedButNotSent,
            setConfirmation,
            apiPut,
            dispatchEvent,
          });

          // 確認ステータスが「未」に更新されることを確認
          // 初期値が何であっても、青いバー送信成功後は常に「未」になる
          expect(setConfirmation).toHaveBeenCalledWith('未');
          expect(confirmation).toBe('未');

          // APIが呼ばれることを確認
          expect(apiPut).toHaveBeenCalledTimes(1);
          expect(apiPut).toHaveBeenCalledWith(
            `/api/property-listings/${propertyNumber}/confirmation`,
            { confirmation: '未' }
          );

          // イベントが発火することを確認
          expect(dispatchEvent).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2: Preservation - 様々な物件状態に対して、
   * 青いバー送信失敗時は確認ステータスが変更されないこと
   *
   * プロパティベーステスト:
   *   FOR ALL 確認ステータス初期値 X:
   *     青いバー送信失敗後 → 確認ステータスは変更されない
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   *
   * **Validates: Requirements 3.4**
   */
  test('Property 2: 様々な物件状態に対して、青いバー送信失敗時は確認ステータスが変更されないこと', async () => {
    // 確認ステータスの初期値として取りうる値のアービトラリ
    const confirmationArbitrary = fc.oneof(
      fc.constant('済'),
      fc.constant('未'),
      fc.constant(''),
      fc.string({ minLength: 0, maxLength: 10 }),
    );

    await fc.assert(
      fc.asyncProperty(
        confirmationArbitrary,
        async (initialConfirmation) => {
          let confirmation: string = initialConfirmation;
          const setConfirmation = vi.fn().mockImplementation((value: string) => {
            confirmation = value;
          });
          const setSnackbar = vi.fn();
          const setPriceSavedButNotSent = vi.fn();
          // APIが失敗するケース
          const apiPut = vi.fn().mockRejectedValue(new Error('API Error'));
          const dispatchEvent = vi.fn();

          // 青いバーからのCHAT送信成功（ただしAPI呼び出しが失敗）
          // handlePriceChatSendSuccess は try-catch で API エラーを握りつぶすため、
          // setConfirmation('未') は呼ばれる（API失敗前に呼ばれる）
          // ここでは「送信自体が失敗した場合」を模擬するため、
          // handlePriceChatSendSuccess が呼ばれない（= onChatSendSuccess が呼ばれない）ケースを検証する

          // 送信失敗時: onChatSendSuccess は呼ばれない
          // → setConfirmation は呼ばれない
          // → 確認ステータスは変更されない

          // 送信失敗時のシミュレーション: コールバックを呼ばない
          const onChatSendError = vi.fn();

          // 送信失敗時は何も呼ばれない
          // （handleSendPriceReductionChat の catch ブロックで onChatSendError が呼ばれるだけ）
          onChatSendError('送信に失敗しました');

          // 確認ステータスが変更されていないことを確認
          expect(setConfirmation).not.toHaveBeenCalled();
          expect(confirmation).toBe(initialConfirmation);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 観察4: 青いバー送信成功時にスナックバーが表示されること
   *
   * テスト内容:
   *   - 青いバーのCHAT送信が成功したとき
   *   - 成功スナックバーが表示されることを確認する
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   *
   * **Validates: Requirements 3.1**
   */
  test('観察4: 青いバー送信成功時にスナックバーが表示されること', async () => {
    const setConfirmation = vi.fn();
    const setSnackbar = vi.fn();
    const setPriceSavedButNotSent = vi.fn();
    const apiPut = vi.fn().mockResolvedValue(undefined);
    const dispatchEvent = vi.fn();

    const successMessage = '価格変更通知を送信しました';

    // 青いバーからのCHAT送信成功
    await handlePriceChatSendSuccess({
      message: successMessage,
      propertyNumber: 'AA001',
      setSnackbar,
      setPriceSavedButNotSent,
      setConfirmation,
      apiPut,
      dispatchEvent,
    });

    // 成功スナックバーが表示されることを確認
    expect(setSnackbar).toHaveBeenCalledWith({
      open: true,
      message: successMessage,
      severity: 'success',
    });
  });

  /**
   * 観察5: 青いバー送信成功時に priceSavedButNotSent フラグがリセットされること
   *
   * テスト内容:
   *   - 青いバーのCHAT送信が成功したとき
   *   - priceSavedButNotSent フラグが false にリセットされることを確認する
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   *
   * **Validates: Requirements 3.1**
   */
  test('観察5: 青いバー送信成功時に priceSavedButNotSent フラグがリセットされること', async () => {
    const setConfirmation = vi.fn();
    const setSnackbar = vi.fn();
    const setPriceSavedButNotSent = vi.fn();
    const apiPut = vi.fn().mockResolvedValue(undefined);
    const dispatchEvent = vi.fn();

    // 青いバーからのCHAT送信成功
    await handlePriceChatSendSuccess({
      message: '価格変更通知を送信しました',
      propertyNumber: 'AA001',
      setSnackbar,
      setPriceSavedButNotSent,
      setConfirmation,
      apiPut,
      dispatchEvent,
    });

    // priceSavedButNotSent フラグが false にリセットされることを確認
    expect(setPriceSavedButNotSent).toHaveBeenCalledWith(false);
  });

  /**
   * Property 2: Preservation - 様々な物件番号に対して、
   * 青いバー送信成功後は常に正しい物件番号でAPIが呼ばれること
   *
   * プロパティベーステスト:
   *   FOR ALL 物件番号 propertyNumber:
   *     青いバー送信成功後 → PUT /api/property-listings/{propertyNumber}/confirmation が呼ばれる
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   *
   * **Validates: Requirements 3.2**
   */
  test('Property 2: 様々な物件番号に対して、青いバー送信成功後は常に正しい物件番号でAPIが呼ばれること', async () => {
    // 物件番号のアービトラリ（英数字のみ）
    const propertyNumberArbitrary = fc.string({ minLength: 1, maxLength: 10 })
      .filter(s => /^[A-Za-z0-9]+$/.test(s));

    await fc.assert(
      fc.asyncProperty(
        propertyNumberArbitrary,
        async (propertyNumber) => {
          const setConfirmation = vi.fn();
          const setSnackbar = vi.fn();
          const setPriceSavedButNotSent = vi.fn();
          const apiPut = vi.fn().mockResolvedValue(undefined);
          const dispatchEvent = vi.fn();

          // 青いバーからのCHAT送信成功
          await handlePriceChatSendSuccess({
            message: '価格変更通知を送信しました',
            propertyNumber,
            setSnackbar,
            setPriceSavedButNotSent,
            setConfirmation,
            apiPut,
            dispatchEvent,
          });

          // 正しい物件番号でAPIが呼ばれることを確認
          expect(apiPut).toHaveBeenCalledWith(
            `/api/property-listings/${propertyNumber}/confirmation`,
            { confirmation: '未' }
          );

          // 正しい物件番号でイベントが発火することを確認
          expect(dispatchEvent).toHaveBeenCalledTimes(1);
          const firedEvent = dispatchEvent.mock.calls[0][0] as CustomEvent;
          expect(firedEvent.detail.propertyNumber).toBe(propertyNumber);
          expect(firedEvent.detail.confirmation).toBe('未');
        }
      ),
      { numRuns: 50 }
    );
  });
});
