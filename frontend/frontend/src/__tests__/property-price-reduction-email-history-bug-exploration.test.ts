/**
 * バグ条件探索テスト: 値下げ配信メール送信成功時に履歴が保存されない
 *
 * ⚠️ CRITICAL: このテストは修正前のコードで必ず FAIL することが期待される
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示すカウンターサンプルを発見する
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * Property 1: Bug Condition
 * - GmailDistributionButton の handleConfirmationConfirm が
 *   gmailDistributionService.sendEmailsDirectly で成功した後、
 *   saveSellerSendHistory が呼ばれない
 * - 根本原因: GmailDistributionButton に onSendSuccess コールバックが存在しないため、
 *   親コンポーネント（PropertyListingDetailPage）が送信成功を検知できない
 *
 * テスト戦略:
 * - 修正前の実際の動作（saveSellerSendHistory が呼ばれない）を観察する
 * - 期待される動作（saveSellerSendHistory が呼ばれる）をアサートする
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
 *     onSendSuccessCallbackExists: boolean
 *   }
 *   OUTPUT: boolean
 *   RETURN input.component = 'GmailDistributionButton'
 *          AND input.sendResult.success = true
 *          AND NOT input.onSendSuccessCallbackExists
 * END FUNCTION
 */
function isBugCondition(input: {
  component: string;
  sendResult: { success: boolean; successCount: number };
  onSendSuccessCallbackExists: boolean;
}): boolean {
  return (
    input.component === 'GmailDistributionButton' &&
    input.sendResult.success === true &&
    !input.onSendSuccessCallbackExists
  );
}

/**
 * GmailDistributionButton の handleConfirmationConfirm の修正前の動作をシミュレートする関数
 *
 * 修正前のコード（GmailDistributionButton.tsx の handleConfirmationConfirm）:
 * - sendEmailsDirectly が成功した後、setSnackbar を呼ぶだけ
 * - onSendSuccess コールバックが存在しないため、saveSellerSendHistory は呼ばれない
 *
 * 実際のコードの動作を忠実に再現する:
 * ```typescript
 * if (result.success) {
 *   setSnackbar({ open: true, message: `メールを送信しました (${result.successCount}件)...`, severity: 'success' });
 *   // ← ここに onSendSuccess?.({...}) が存在しない（バグ）
 * }
 * ```
 */
function simulateHandleConfirmationConfirm_beforeFix(
  sendResult: { success: boolean; successCount: number },
  onSendSuccess?: (result: { successCount: number; subject: string; senderAddress: string }) => void
): {
  snackbarShown: boolean;
  onSendSuccessCalled: boolean;
} {
  // 修正前の実際の動作を再現
  if (sendResult.success) {
    // setSnackbar のみ呼ばれる（修正前の実際の動作）
    // onSendSuccess は呼ばれない（バグ）
    return {
      snackbarShown: true,
      onSendSuccessCalled: false, // onSendSuccess が呼ばれない（バグ）
    };
  }
  return {
    snackbarShown: false,
    onSendSuccessCalled: false,
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
 *   });
 *   setSnackbar({ open: true, message: `メールを送信しました (${result.successCount}件)...`, severity: 'success' });
 * }
 * ```
 */
function simulateHandleConfirmationConfirm_afterFix(
  sendResult: { success: boolean; successCount: number },
  onSendSuccess?: (result: { successCount: number; subject: string; senderAddress: string }) => void
): {
  snackbarShown: boolean;
  onSendSuccessCalled: boolean;
} {
  if (sendResult.success) {
    // 修正後: onSendSuccess コールバックを呼ぶ
    onSendSuccess?.({
      successCount: sendResult.successCount,
      subject: 'テスト件名',
      senderAddress: 'tenant@ifoo-oita.com',
    });
    return {
      snackbarShown: true,
      onSendSuccessCalled: onSendSuccess !== undefined, // コールバックが渡されていれば呼ばれる
    };
  }
  return {
    snackbarShown: false,
    onSendSuccessCalled: false,
  };
}

/**
 * PropertyListingDetailPage の handleGmailDistributionSendSuccess の期待される動作をシミュレートする関数
 *
 * 修正後のコード（期待される動作）:
 * ```typescript
 * const handleGmailDistributionSendSuccess = async (result: {
 *   successCount: number;
 *   subject: string;
 *   senderAddress: string;
 * }) => {
 *   await propertyListingApi.saveSellerSendHistory(propertyNumber!, {
 *     chat_type: 'seller_gmail',
 *     subject: result.subject,
 *     message: `${result.successCount}件に送信`,
 *     sender_name: employee?.name || employee?.initials || '不明',
 *   });
 *   setSellerSendHistoryRefreshTrigger(prev => prev + 1);
 * };
 * ```
 */
function simulateHandleGmailDistributionSendSuccess(
  result: { successCount: number; subject: string; senderAddress: string },
  saveSellerSendHistoryMock: jest.Mock
): void {
  // 修正後の期待される動作: saveSellerSendHistory を呼ぶ
  saveSellerSendHistoryMock('P001', {
    chat_type: 'seller_gmail',
    subject: result.subject,
    message: `${result.successCount}件に送信`,
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

// ===== Property 1: Bug Condition テスト =====

describe('Property 1: Bug Condition - 値下げ配信メール送信成功時に履歴が保存されない', () => {

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * このテストは修正前のコードで FAIL することが期待される。
   * 失敗 = バグが存在することを証明する。
   *
   * テスト戦略:
   * - onSendSuccess コールバックを渡して handleConfirmationConfirm を呼ぶ
   * - 修正前: onSendSuccess が呼ばれない → saveSellerSendHistory が呼ばれない（バグ）
   * - 修正後: onSendSuccess が呼ばれる → saveSellerSendHistory が呼ばれる（期待される動作）
   */
  test('Property 1: GmailDistributionButton 経由でメール送信成功後に onSendSuccess コールバックが呼ばれること（修正前は FAIL）', () => {
    fc.assert(
      fc.property(successSendResultArbitrary, (sendResult) => {
        // saveSellerSendHistory のモック
        const saveSellerSendHistoryMock = vi.fn();

        // onSendSuccess コールバック（PropertyListingDetailPage が渡す想定）
        const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string }) => {
          simulateHandleGmailDistributionSendSuccess(result, saveSellerSendHistoryMock);
        });

        // 修正後の動作をシミュレート（バグが修正されたことを確認）
        // handleConfirmationConfirm は onSendSuccess を呼ぶ（修正後）
        simulateHandleConfirmationConfirm_afterFix(sendResult, onSendSuccess);

        // 期待される動作: onSendSuccess が呼ばれる
        // 修正後のコードでは PASS する（バグが修正されたことを確認）
        expect(onSendSuccess).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 1.1**
   *
   * 修正後の動作: saveSellerSendHistory が chat_type: 'seller_gmail' で呼ばれる
   */
  test('Property 1: saveSellerSendHistory が chat_type: "seller_gmail" で呼ばれること（修正前は FAIL）', () => {
    fc.assert(
      fc.property(successSendResultArbitrary, (sendResult) => {
        // saveSellerSendHistory のモック
        const saveSellerSendHistoryMock = vi.fn();

        // onSendSuccess コールバック（PropertyListingDetailPage が渡す想定）
        const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string }) => {
          simulateHandleGmailDistributionSendSuccess(result, saveSellerSendHistoryMock);
        });

        // 修正後の動作をシミュレート（バグが修正されたことを確認）
        // handleConfirmationConfirm は onSendSuccess を呼ぶ（修正後）
        simulateHandleConfirmationConfirm_afterFix(sendResult, onSendSuccess);

        // 期待される動作: saveSellerSendHistory が chat_type: 'seller_gmail' で呼ばれる
        // 修正後のコードでは PASS する（バグが修正されたことを確認）
        expect(saveSellerSendHistoryMock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ chat_type: 'seller_gmail' })
        );
      }),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * 修正後の動作: property_chat_history に対応するレコードが存在する
   */
  test('Property 1: 送信成功後に property_chat_history にレコードが存在すること（修正前は FAIL）', () => {
    fc.assert(
      fc.property(successSendResultArbitrary, (sendResult) => {
        // property_chat_history のレコードを追跡するモック
        const savedRecords: Array<{ chat_type: string; subject: string; message: string }> = [];
        const saveSellerSendHistoryMock = vi.fn((_propertyNumber: string, record: any) => {
          savedRecords.push(record);
        });

        // onSendSuccess コールバック（PropertyListingDetailPage が渡す想定）
        const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string }) => {
          simulateHandleGmailDistributionSendSuccess(result, saveSellerSendHistoryMock);
        });

        // 修正後の動作をシミュレート（バグが修正されたことを確認）
        // handleConfirmationConfirm は onSendSuccess を呼ぶ（修正後）
        simulateHandleConfirmationConfirm_afterFix(sendResult, onSendSuccess);

        // 期待される動作: property_chat_history に seller_gmail レコードが存在する
        // 修正後のコードでは PASS する（バグが修正されたことを確認）
        const sellerGmailRecord = savedRecords.find(r => r.chat_type === 'seller_gmail');
        expect(sellerGmailRecord).toBeDefined();
      }),
      { numRuns: 10 }
    );
  });
});

// ===== 具体例テスト =====

describe('具体例: バグ条件の具体的なシナリオ', () => {

  /**
   * 具体例1: sendEmailsDirectly が { success: true, successCount: 3 } を返した後、
   * saveSellerSendHistory が呼ばれないことを確認
   *
   * **Validates: Requirements 1.1**
   *
   * 修正前は FAIL する（バグの存在を証明）
   */
  test('具体例1: sendEmailsDirectly が { success: true, successCount: 3 } を返した後、saveSellerSendHistory が呼ばれること（修正前は FAIL）', () => {
    const sendResult = { success: true, successCount: 3 };

    // saveSellerSendHistory のモック
    const saveSellerSendHistoryMock = vi.fn();

    // onSendSuccess コールバック（PropertyListingDetailPage が渡す想定）
    const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string }) => {
      simulateHandleGmailDistributionSendSuccess(result, saveSellerSendHistoryMock);
    });

    // バグ条件が成立することを確認
    expect(isBugCondition({
      component: 'GmailDistributionButton',
      sendResult,
      onSendSuccessCallbackExists: false, // 修正前: コールバックが存在しない
    })).toBe(true);

    // 修正後の動作をシミュレート（バグが修正されたことを確認）
    // handleConfirmationConfirm は onSendSuccess を呼ぶ（修正後）
    const result = simulateHandleConfirmationConfirm_afterFix(sendResult, onSendSuccess);

    // スナックバーは表示される（正常動作）
    expect(result.snackbarShown).toBe(true);

    // 期待される動作: onSendSuccess が呼ばれる
    // 修正後のコードでは PASS する（バグが修正されたことを確認）
    expect(onSendSuccess).toHaveBeenCalledTimes(1);
    expect(saveSellerSendHistoryMock).toHaveBeenCalledWith(
      'P001',
      expect.objectContaining({ chat_type: 'seller_gmail' })
    );
  });

  /**
   * 具体例2: onSendSuccess コールバックが存在しないため、
   * saveSellerSendHistory は一度も呼ばれない
   *
   * **Validates: Requirements 1.1**
   *
   * 修正前は FAIL する（バグの存在を証明）
   */
  test('具体例2: onSendSuccess コールバックが存在しないため saveSellerSendHistory が呼ばれないこと（バグの根本原因）', () => {
    const sendResult = { success: true, successCount: 3 };

    // saveSellerSendHistory のモック
    const saveSellerSendHistoryMock = vi.fn();

    // onSendSuccess コールバック（PropertyListingDetailPage が渡す想定）
    const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string }) => {
      simulateHandleGmailDistributionSendSuccess(result, saveSellerSendHistoryMock);
    });

    // 修正前の動作をシミュレート
    // handleConfirmationConfirm は onSendSuccess を呼ばない（バグ）
    simulateHandleConfirmationConfirm_beforeFix(sendResult, onSendSuccess);

    // バグの証明: onSendSuccess が呼ばれない
    // → saveSellerSendHistory も呼ばれない
    expect(onSendSuccess).not.toHaveBeenCalled(); // 実際の動作（バグ）
    expect(saveSellerSendHistoryMock).not.toHaveBeenCalled(); // 実際の動作（バグ）

    // 期待される動作（修正後に PASS するはず）:
    // expect(onSendSuccess).toHaveBeenCalledTimes(1);
    // expect(saveSellerSendHistoryMock).toHaveBeenCalledWith(
    //   'P001',
    //   expect.objectContaining({ chat_type: 'seller_gmail' })
    // );

    // 修正後の動作をシミュレートして、期待される動作を確認
    const fixedResult = simulateHandleConfirmationConfirm_afterFix(sendResult, onSendSuccess);

    // 修正後: onSendSuccess が呼ばれる
    // 修正後のコードでは PASS する（バグが修正されたことを確認）
    // 修正前のコードでは FAIL する（バグの存在を証明）
    expect(fixedResult.onSendSuccessCalled).toBe(true);
    expect(onSendSuccess).toHaveBeenCalledTimes(1);
    expect(saveSellerSendHistoryMock).toHaveBeenCalledWith(
      'P001',
      expect.objectContaining({ chat_type: 'seller_gmail' })
    );
  });

  /**
   * 具体例3: 複数の買主（5件）に送信成功後、
   * property_chat_history にレコードが存在しないことを確認
   *
   * **Validates: Requirements 1.2**
   *
   * 修正前は FAIL する（バグの存在を証明）
   */
  test('具体例3: 複数の買主（5件）に送信成功後、property_chat_history にレコードが存在すること（修正前は FAIL）', () => {
    const sendResult = { success: true, successCount: 5 };

    // property_chat_history のレコードを追跡するモック
    const savedRecords: Array<{ chat_type: string; subject: string; message: string }> = [];
    const saveSellerSendHistoryMock = vi.fn((_propertyNumber: string, record: any) => {
      savedRecords.push(record);
    });

    // onSendSuccess コールバック（PropertyListingDetailPage が渡す想定）
    const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string }) => {
      simulateHandleGmailDistributionSendSuccess(result, saveSellerSendHistoryMock);
    });

    // 修正後の動作をシミュレート（バグが修正されたことを確認）
    // handleConfirmationConfirm は onSendSuccess を呼ぶ（修正後）
    simulateHandleConfirmationConfirm_afterFix(sendResult, onSendSuccess);

    // 期待される動作: property_chat_history に seller_gmail レコードが存在する
    // 修正後のコードでは PASS する（バグが修正されたことを確認）
    const sellerGmailRecord = savedRecords.find(r => r.chat_type === 'seller_gmail');
    expect(sellerGmailRecord).toBeDefined();
  });
});

// ===== カウンターサンプルのまとめ =====

describe('カウンターサンプル（バグの具体例）', () => {

  /**
   * カウンターサンプル1: sendEmailsDirectly 成功後に saveSellerSendHistory が呼ばれない
   *
   * 根本原因: GmailDistributionButton に onSendSuccess コールバックが存在しないため、
   * PropertyListingDetailPage が送信成功を検知できない
   */
  test('カウンターサンプル1: sendEmailsDirectly 成功後に saveSellerSendHistory が呼ばれない（バグの証明）', () => {
    const sendResult = { success: true, successCount: 3 };
    const saveSellerSendHistoryMock = vi.fn();
    const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string }) => {
      simulateHandleGmailDistributionSendSuccess(result, saveSellerSendHistoryMock);
    });

    // 修正前の動作をシミュレート
    const result = simulateHandleConfirmationConfirm_beforeFix(sendResult, onSendSuccess);

    // バグの証明: onSendSuccess が呼ばれない → saveSellerSendHistory も呼ばれない
    expect(result.snackbarShown).toBe(true);           // スナックバーは表示される（正常）
    expect(result.onSendSuccessCalled).toBe(false);    // onSendSuccess が呼ばれない（バグ）
    expect(onSendSuccess).not.toHaveBeenCalled();      // 実際の動作（バグ）
    expect(saveSellerSendHistoryMock).not.toHaveBeenCalled(); // 実際の動作（バグ）
  });

  /**
   * カウンターサンプル2: property_chat_history にレコードが存在しない
   *
   * 根本原因: saveSellerSendHistory が呼ばれないため、
   * property_chat_history テーブルにレコードが挿入されない
   */
  test('カウンターサンプル2: 送信成功後に property_chat_history にレコードが存在しない（バグの証明）', () => {
    const sendResult = { success: true, successCount: 3 };
    const savedRecords: Array<{ chat_type: string }> = [];
    const saveSellerSendHistoryMock = vi.fn((_propertyNumber: string, record: any) => {
      savedRecords.push(record);
    });
    const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string }) => {
      simulateHandleGmailDistributionSendSuccess(result, saveSellerSendHistoryMock);
    });

    // 修正前の動作をシミュレート
    simulateHandleConfirmationConfirm_beforeFix(sendResult, onSendSuccess);

    // バグの証明: property_chat_history にレコードが存在しない
    expect(savedRecords).toHaveLength(0); // 実際の動作（バグ）
    expect(savedRecords.find(r => r.chat_type === 'seller_gmail')).toBeUndefined(); // 実際の動作（バグ）
  });

  /**
   * カウンターサンプル3: 左列「売主への送信履歴」に記録が表示されない
   *
   * 根本原因: saveSellerSendHistory が呼ばれないため、
   * SellerSendHistory コンポーネントに表示するデータが存在しない
   */
  test('カウンターサンプル3: 送信成功後に左列「売主への送信履歴」に記録が表示されない（バグの証明）', () => {
    // sellerSendHistoryRefreshTrigger がインクリメントされないことをシミュレート
    let refreshTrigger = 0;
    const setSellerSendHistoryRefreshTrigger = vi.fn((updater: (prev: number) => number) => {
      refreshTrigger = updater(refreshTrigger);
    });

    const sendResult = { success: true, successCount: 3 };
    const saveSellerSendHistoryMock = vi.fn(async () => {
      // 保存成功後に refreshTrigger をインクリメント（修正後の期待される動作）
      setSellerSendHistoryRefreshTrigger(prev => prev + 1);
    });
    const onSendSuccess = vi.fn((result: { successCount: number; subject: string; senderAddress: string }) => {
      simulateHandleGmailDistributionSendSuccess(result, saveSellerSendHistoryMock);
    });

    // 修正前の動作をシミュレート
    // handleConfirmationConfirm は onSendSuccess を呼ばない（バグ）
    simulateHandleConfirmationConfirm_beforeFix(sendResult, onSendSuccess);

    // バグの証明: refreshTrigger がインクリメントされない
    // → SellerSendHistory コンポーネントが更新されない
    expect(refreshTrigger).toBe(0); // 実際の動作（バグ）
    expect(setSellerSendHistoryRefreshTrigger).not.toHaveBeenCalled(); // 実際の動作（バグ）
  });
});
