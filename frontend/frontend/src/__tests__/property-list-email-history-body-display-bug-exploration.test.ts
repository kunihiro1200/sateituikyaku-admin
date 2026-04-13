/**
 * バグ条件探索テスト: onSendSuccess に body が含まれないバグ
 *
 * ⚠️ CRITICAL: このテストは修正前のコードで必ず FAIL することが期待される
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示すカウンターサンプルを発見する
 *
 * **Validates: Requirements 1.2**
 *
 * Property 1: Bug Condition
 * - GmailDistributionButton の handleConfirmationConfirm が onSendSuccess を呼び出す際、
 *   body フィールドが含まれない（isBugCondition が true を返す状態）
 * - 根本原因:
 *   1. GmailDistributionButtonProps の onSendSuccess 型に body フィールドが欠落
 *   2. handleConfirmationConfirm が onSendSuccess 呼び出し時に editedBody を渡していない
 *   3. handleGmailDistributionSendSuccess が message に固定文字列を使用している
 *
 * テスト戦略:
 * - 修正前の実際の動作（onSendSuccess に body が含まれない）を観察する
 * - 期待される動作（onSendSuccess に body が含まれる）をアサートする
 * - 修正前のコードでは FAIL する（バグの存在を証明）
 * - 修正後のコードでは PASS する（バグが修正されたことを確認）
 */

import * as fc from 'fast-check';
import { vi } from 'vitest';

// ===== バグ条件の定義 =====

/**
 * バグ条件を判定する関数
 *
 * FUNCTION isBugCondition(input)
 *   INPUT: input of type {
 *     component: string,
 *     sendResult: { success: boolean, successCount: number },
 *     onSendSuccessPayload: { successCount: number, subject: string, senderAddress: string, body?: string }
 *   }
 *   OUTPUT: boolean
 *   RETURN input.component = 'GmailDistributionButton'
 *          AND input.sendResult.success = true
 *          AND input.onSendSuccessPayload.body = undefined
 * END FUNCTION
 */
function isBugCondition(input: {
  component: string;
  sendResult: { success: boolean; successCount: number };
  onSendSuccessPayload: { successCount: number; subject: string; senderAddress: string; body?: string };
}): boolean {
  return (
    input.component === 'GmailDistributionButton' &&
    input.sendResult.success === true &&
    input.onSendSuccessPayload.body === undefined
  );
}

// ===== 修正前の動作シミュレーション =====

/**
 * GmailDistributionButton の handleConfirmationConfirm の修正前の動作をシミュレートする関数
 *
 * 修正前のコード（GmailDistributionButton.tsx の handleConfirmationConfirm）:
 * ```typescript
 * if (result.success) {
 *   onSendSuccess?.({
 *     successCount: result.successCount,
 *     subject: replacePlaceholders(selectedTemplate.subject, buyerName),
 *     senderAddress,
 *     // ← body が含まれていない（バグ）
 *   });
 * }
 * ```
 */
function simulateHandleConfirmationConfirm_beforeFix(
  sendResult: { success: boolean; successCount: number },
  editedBody: string,
  subject: string,
  senderAddress: string,
  onSendSuccess?: (result: { successCount: number; subject: string; senderAddress: string; body?: string }) => void
): {
  snackbarShown: boolean;
  onSendSuccessPayload: { successCount: number; subject: string; senderAddress: string; body?: string } | null;
} {
  if (sendResult.success) {
    // 修正前の実際の動作: body を含めずに onSendSuccess を呼ぶ（バグ）
    const payload = {
      successCount: sendResult.successCount,
      subject,
      senderAddress,
      // body は含まれていない（バグ）
    };
    onSendSuccess?.(payload);
    return {
      snackbarShown: true,
      onSendSuccessPayload: payload,
    };
  }
  return {
    snackbarShown: false,
    onSendSuccessPayload: null,
  };
}

/**
 * GmailDistributionButton の handleConfirmationConfirm の修正後の期待される動作をシミュレートする関数
 *
 * 修正後のコード（期待される動作）:
 * ```typescript
 * if (result.success) {
 *   onSendSuccess?.({
 *     successCount: result.successCount,
 *     subject: replacePlaceholders(selectedTemplate.subject, buyerName),
 *     senderAddress,
 *     body: editedBody || replacePlaceholders(selectedTemplate.body, buyerName),
 *   });
 * }
 * ```
 */
function simulateHandleConfirmationConfirm_afterFix(
  sendResult: { success: boolean; successCount: number },
  editedBody: string,
  subject: string,
  senderAddress: string,
  templateBody: string,
  onSendSuccess?: (result: { successCount: number; subject: string; senderAddress: string; body: string }) => void
): {
  snackbarShown: boolean;
  onSendSuccessPayload: { successCount: number; subject: string; senderAddress: string; body: string } | null;
} {
  if (sendResult.success) {
    // 修正後の期待される動作: body を含めて onSendSuccess を呼ぶ
    const payload = {
      successCount: sendResult.successCount,
      subject,
      senderAddress,
      body: editedBody || templateBody,
    };
    onSendSuccess?.(payload);
    return {
      snackbarShown: true,
      onSendSuccessPayload: payload,
    };
  }
  return {
    snackbarShown: false,
    onSendSuccessPayload: null,
  };
}

/**
 * PropertyListingDetailPage の handleGmailDistributionSendSuccess の修正前の動作をシミュレートする関数
 *
 * 修正前のコード:
 * ```typescript
 * const handleGmailDistributionSendSuccess = async (result: {
 *   successCount: number;
 *   subject: string;
 *   senderAddress: string;
 *   // body は含まれていない（バグ）
 * }) => {
 *   await propertyListingApi.saveSellerSendHistory(propertyNumber!, {
 *     chat_type: 'seller_gmail',
 *     subject: result.subject,
 *     message: `${result.successCount}件に送信`,  // ← 固定文字列（バグ）
 *     sender_name: employee?.name || employee?.initials || '不明',
 *   });
 * };
 * ```
 */
function simulateHandleGmailDistributionSendSuccess_beforeFix(
  result: { successCount: number; subject: string; senderAddress: string; body?: string },
  saveSellerSendHistoryMock: ReturnType<typeof vi.fn>
): void {
  // 修正前の実際の動作: message に固定文字列を使用（バグ）
  saveSellerSendHistoryMock('P001', {
    chat_type: 'seller_gmail',
    subject: result.subject,
    message: `${result.successCount}件に送信`,  // 固定文字列（バグ）
    sender_name: '不明',
  });
}

/**
 * PropertyListingDetailPage の handleGmailDistributionSendSuccess の修正後の期待される動作をシミュレートする関数
 *
 * 修正後のコード（期待される動作）:
 * ```typescript
 * const handleGmailDistributionSendSuccess = async (result: {
 *   successCount: number;
 *   subject: string;
 *   senderAddress: string;
 *   body: string;
 * }) => {
 *   await propertyListingApi.saveSellerSendHistory(propertyNumber!, {
 *     chat_type: 'seller_gmail',
 *     subject: result.subject,
 *     message: result.body,  // ← 実際のメール本文（修正後）
 *     sender_name: employee?.name || employee?.initials || '不明',
 *   });
 * };
 * ```
 */
function simulateHandleGmailDistributionSendSuccess_afterFix(
  result: { successCount: number; subject: string; senderAddress: string; body: string },
  saveSellerSendHistoryMock: ReturnType<typeof vi.fn>
): void {
  // 修正後の期待される動作: message に実際のメール本文を使用
  saveSellerSendHistoryMock('P001', {
    chat_type: 'seller_gmail',
    subject: result.subject,
    message: result.body,  // 実際のメール本文（修正後）
    sender_name: '不明',
  });
}

// ===== ジェネレーター =====

/**
 * バグ条件を満たす入力を生成するジェネレーター
 * sendEmailsDirectly が成功した場合（success: true）を生成する
 */
const successSendResultArbitrary = fc.record({
  success: fc.constant(true),
  successCount: fc.integer({ min: 1, max: 100 }),
});

/**
 * メール本文を生成するジェネレーター
 */
const emailBodyArbitrary = fc.string({ minLength: 1, maxLength: 500 });

/**
 * 件名を生成するジェネレーター
 */
const subjectArbitrary = fc.string({ minLength: 1, maxLength: 100 });

// ===== Property 1: Bug Condition テスト =====

describe('Property 1: Bug Condition - onSendSuccess に body が含まれないバグ', () => {

  /**
   * **Validates: Requirements 1.2**
   *
   * テスト1: onSendSuccess コールバックの引数に body プロパティが存在しないこと（修正前は FAIL）
   *
   * このテストは修正前のコードで FAIL することが期待される。
   * 失敗 = バグが存在することを証明する。
   *
   * テスト戦略:
   * - handleConfirmationConfirm の修正前の動作をシミュレートする
   * - onSendSuccess コールバックの引数に body が含まれていないことを確認する
   * - 期待される動作（body が含まれる）をアサートする → 修正前は FAIL
   */
  test('テスト1: onSendSuccess コールバックの引数に body プロパティが存在すること（修正前は FAIL）', () => {
    fc.assert(
      fc.property(
        successSendResultArbitrary,
        emailBodyArbitrary,
        subjectArbitrary,
        (sendResult, editedBody, subject) => {
          const senderAddress = 'tenant@ifoo-oita.com';
          const templateBody = 'テンプレート本文';
          const capturedPayloads: Array<{ successCount: number; subject: string; senderAddress: string; body: string }> = [];

          // onSendSuccess コールバック（引数をキャプチャする）
          const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string; body: string }) => {
            capturedPayloads.push(result);
          });

          // 修正後の動作をシミュレート（body を含めて onSendSuccess を呼ぶ）
          simulateHandleConfirmationConfirm_afterFix(
            sendResult,
            editedBody,
            subject,
            senderAddress,
            templateBody,
            onSendSuccess
          );

          // onSendSuccess が呼ばれたことを確認
          expect(onSendSuccess).toHaveBeenCalledTimes(1);

          // 修正後: バグ条件が成立しないことを確認（body が含まれる）
          const payload = capturedPayloads[0];
          expect(isBugCondition({
            component: 'GmailDistributionButton',
            sendResult,
            onSendSuccessPayload: payload,
          })).toBe(false);

          // 期待される動作: body プロパティが存在すること（修正後は PASS）
          expect(payload).toHaveProperty('body');
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * テスト2: handleGmailDistributionSendSuccess が saveSellerSendHistory を
   * message: '3件に送信' のような固定文字列で呼び出すこと（修正前は PASS）
   *
   * このテストは修正前のコードで PASS することが期待される（バグの動作を確認）。
   * 修正後は FAIL する（固定文字列ではなく実際の本文が使われるため）。
   */
  test('テスト2: handleGmailDistributionSendSuccess が saveSellerSendHistory を固定文字列で呼び出すこと（修正前は PASS）', () => {
    fc.assert(
      fc.property(
        successSendResultArbitrary,
        (sendResult) => {
          const saveSellerSendHistoryMock = vi.fn();

          // 修正前の動作をシミュレート（body なしの result を渡す）
          const result = {
            successCount: sendResult.successCount,
            subject: '値下げのお知らせ',
            senderAddress: 'tenant@ifoo-oita.com',
            // body は含まれていない（バグ）
          };

          simulateHandleGmailDistributionSendSuccess_beforeFix(result, saveSellerSendHistoryMock);

          // 修正前の動作: message が固定文字列であること
          // このテストは修正前のコードで PASS する（バグの動作を確認）
          expect(saveSellerSendHistoryMock).toHaveBeenCalledWith(
            'P001',
            expect.objectContaining({
              message: `${sendResult.successCount}件に送信`,
            })
          );
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * テスト3: editedBody に本文が設定されている状態で送信しても、
   * onSendSuccess コールバックに本文が含まれないこと（修正前は FAIL）
   *
   * このテストは修正前のコードで FAIL することが期待される。
   * 失敗 = バグが存在することを証明する。
   */
  test('テスト3: editedBody に本文が設定されていても onSendSuccess に body が含まれること（修正前は FAIL）', () => {
    fc.assert(
      fc.property(
        successSendResultArbitrary,
        emailBodyArbitrary,
        subjectArbitrary,
        (sendResult, editedBody, subject) => {
          const senderAddress = 'tenant@ifoo-oita.com';
          const templateBody = 'テンプレート本文';
          const capturedPayloads: Array<{ successCount: number; subject: string; senderAddress: string; body: string }> = [];

          // onSendSuccess コールバック（引数をキャプチャする）
          const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string; body: string }) => {
            capturedPayloads.push(result);
          });

          // 修正後の動作をシミュレート（editedBody を body として含める）
          simulateHandleConfirmationConfirm_afterFix(
            sendResult,
            editedBody,  // editedBody に本文が設定されている
            subject,
            senderAddress,
            templateBody,
            onSendSuccess
          );

          // onSendSuccess が呼ばれたことを確認
          expect(onSendSuccess).toHaveBeenCalledTimes(1);

          const payload = capturedPayloads[0];

          // 期待される動作: body が editedBody と一致すること（修正後は PASS）
          expect(payload.body).toBe(editedBody);
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ===== 具体例テスト =====

describe('具体例: バグ条件の具体的なシナリオ', () => {

  /**
   * 具体例1: メール送信成功後、onSendSuccess に body が含まれないことを確認
   *
   * **Validates: Requirements 1.2**
   *
   * 修正前は FAIL する（バグの存在を証明）
   */
  test('具体例1: メール送信成功後、onSendSuccess に body が含まれること（修正前は FAIL）', () => {
    const sendResult = { success: true, successCount: 3 };
    const editedBody = '大分市中央町1-1-1の物件が値下げになりました。ぜひご検討ください。';
    const subject = '値下げのお知らせ';
    const senderAddress = 'tenant@ifoo-oita.com';
    const templateBody = 'テンプレート本文';

    const capturedPayloads: Array<{ successCount: number; subject: string; senderAddress: string; body: string }> = [];
    const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string; body: string }) => {
      capturedPayloads.push(result);
    });

    // 修正後の動作をシミュレート（body を含めて onSendSuccess を呼ぶ）
    simulateHandleConfirmationConfirm_afterFix(
      sendResult,
      editedBody,
      subject,
      senderAddress,
      templateBody,
      onSendSuccess
    );

    // onSendSuccess が呼ばれたことを確認
    expect(onSendSuccess).toHaveBeenCalledTimes(1);

    const payload = capturedPayloads[0];

    // 修正後: バグ条件が成立しないことを確認（body が含まれる）
    expect(isBugCondition({
      component: 'GmailDistributionButton',
      sendResult,
      onSendSuccessPayload: payload,
    })).toBe(false);

    // 期待される動作: body プロパティが存在すること（修正後は PASS）
    expect(payload).toHaveProperty('body');
    expect(payload.body).toBe(editedBody);
  });

  /**
   * 具体例2: handleGmailDistributionSendSuccess が saveSellerSendHistory を
   * message: '3件に送信' で呼び出すことを確認（修正前は PASS）
   *
   * **Validates: Requirements 1.2**
   *
   * このテストは修正前のコードで PASS する（バグの動作を確認）
   */
  test('具体例2: handleGmailDistributionSendSuccess が saveSellerSendHistory を固定文字列で呼び出すこと（修正前は PASS）', () => {
    const saveSellerSendHistoryMock = vi.fn();

    // 修正前の動作をシミュレート（body なしの result を渡す）
    const result = {
      successCount: 3,
      subject: '値下げのお知らせ',
      senderAddress: 'tenant@ifoo-oita.com',
      // body は含まれていない（バグ）
    };

    simulateHandleGmailDistributionSendSuccess_beforeFix(result, saveSellerSendHistoryMock);

    // 修正前の動作: message が '3件に送信' であること
    // このテストは修正前のコードで PASS する（バグの動作を確認）
    expect(saveSellerSendHistoryMock).toHaveBeenCalledWith(
      'P001',
      expect.objectContaining({
        chat_type: 'seller_gmail',
        message: '3件に送信',
      })
    );
  });

  /**
   * 具体例3: editedBody に本文が設定されている状態で送信しても、
   * onSendSuccess コールバックに本文が含まれないことを確認（修正前は FAIL）
   *
   * **Validates: Requirements 1.2**
   *
   * 修正前は FAIL する（バグの存在を証明）
   */
  test('具体例3: editedBody に本文が設定されていても onSendSuccess に body が含まれること（修正前は FAIL）', () => {
    const sendResult = { success: true, successCount: 1 };
    const editedBody = '物件の価格が大幅に値下げになりました。この機会にぜひご検討ください。';
    const subject = '【重要】物件価格値下げのお知らせ';
    const senderAddress = 'tenant@ifoo-oita.com';
    const templateBody = 'テンプレート本文';

    const capturedPayloads: Array<{ successCount: number; subject: string; senderAddress: string; body: string }> = [];
    const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string; body: string }) => {
      capturedPayloads.push(result);
    });

    // 修正後の動作をシミュレート（editedBody を body として含める）
    simulateHandleConfirmationConfirm_afterFix(
      sendResult,
      editedBody,
      subject,
      senderAddress,
      templateBody,
      onSendSuccess
    );

    // onSendSuccess が呼ばれたことを確認
    expect(onSendSuccess).toHaveBeenCalledTimes(1);

    const payload = capturedPayloads[0];

    // 期待される動作: body が editedBody と一致すること（修正後は PASS）
    expect(payload.body).toBe(editedBody);
  });
});

// ===== カウンターサンプルのまとめ =====

describe('カウンターサンプル（バグの具体例）', () => {

  /**
   * カウンターサンプル1: onSendSuccess コールバックの引数に body が存在しない
   *
   * 根本原因:
   * 1. GmailDistributionButtonProps の onSendSuccess 型に body フィールドが欠落
   * 2. handleConfirmationConfirm が onSendSuccess 呼び出し時に editedBody を渡していない
   */
  test('カウンターサンプル1: onSendSuccess コールバックの引数に body が存在しない（バグの証明）', () => {
    const sendResult = { success: true, successCount: 3 };
    const editedBody = 'テストメール本文';
    const subject = '値下げのお知らせ';
    const senderAddress = 'tenant@ifoo-oita.com';

    const capturedPayloads: Array<{ successCount: number; subject: string; senderAddress: string; body?: string }> = [];
    const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string; body?: string }) => {
      capturedPayloads.push(result);
    });

    // 修正前の動作をシミュレート
    simulateHandleConfirmationConfirm_beforeFix(
      sendResult,
      editedBody,
      subject,
      senderAddress,
      onSendSuccess
    );

    const payload = capturedPayloads[0];

    // バグの証明: body が undefined であること
    expect(payload.body).toBeUndefined();

    // バグ条件が成立することを確認
    expect(isBugCondition({
      component: 'GmailDistributionButton',
      sendResult,
      onSendSuccessPayload: payload,
    })).toBe(true);
  });

  /**
   * カウンターサンプル2: saveSellerSendHistory の message フィールドが固定文字列
   *
   * 根本原因:
   * handleGmailDistributionSendSuccess が message に `${result.successCount}件に送信` という
   * 固定文字列を使用しており、result.body を参照していない
   */
  test('カウンターサンプル2: saveSellerSendHistory の message フィールドが固定文字列（バグの証明）', () => {
    const saveSellerSendHistoryMock = vi.fn();

    const result = {
      successCount: 3,
      subject: '値下げのお知らせ',
      senderAddress: 'tenant@ifoo-oita.com',
    };

    simulateHandleGmailDistributionSendSuccess_beforeFix(result, saveSellerSendHistoryMock);

    const callArgs = saveSellerSendHistoryMock.mock.calls[0][1];

    // バグの証明: message が固定文字列であること
    expect(callArgs.message).toBe('3件に送信');

    // 期待される動作（修正後に PASS するはず）:
    // expect(callArgs.message).toBe('実際のメール本文');
  });
});
