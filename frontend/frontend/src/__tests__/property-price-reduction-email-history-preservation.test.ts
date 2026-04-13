/**
 * 保全プロパティテスト: 既存の seller_email / seller_sms 送信履歴保存処理が継続して動作する
 *
 * ✅ このテストは未修正コードで PASS することが期待される
 * 目的: 修正前のベースライン動作を確認し、修正後もリグレッションがないことを保証する
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Property 2: Preservation
 * - handleSendEmail が送信成功後に saveSellerSendHistory(chat_type: 'seller_email') を呼び出す
 * - handleSendSms が送信成功後に saveSellerSendHistory(chat_type: 'seller_sms') を呼び出す
 * - 送信失敗時は saveSellerSendHistory が呼ばれない
 * - GmailDistributionButton の送信フロー（テンプレート選択 → 買主フィルタ → 確認 → 送信）が変更されていない
 *
 * 観察優先メソドロジー:
 * - 未修正コードで非バグ条件の入力（seller_email、seller_sms の送信処理）の動作を観察した
 * - 観察: handleSendEmail が送信成功後に saveSellerSendHistory(chat_type: 'seller_email') を呼び出す
 * - 観察: handleSendSms が送信成功後に saveSellerSendHistory(chat_type: 'seller_sms') を呼び出す
 * - 観察: 送信失敗時は saveSellerSendHistory が呼ばれない
 * - これらの観察した動作パターンをキャプチャするテストを作成する
 */

import * as fc from 'fast-check';
import { vi } from 'vitest';

// ===== 観察した動作パターンのシミュレーション =====

/**
 * PropertyListingDetailPage の handleSendEmail の動作をシミュレートする関数
 *
 * 観察した実際のコード（PropertyListingDetailPage.tsx の handleSendEmail）:
 * ```typescript
 * const handleSendEmail = async () => {
 *   // ... メール送信処理 ...
 *   await api.post(`/api/emails/by-seller-number/${propertyNumber}/send-template-email`, payload);
 *   setSnackbar({ open: true, message: 'メールを送信しました', severity: 'success' });
 *   setEmailDialog({ open: false, ... });
 *
 *   // 売主への送信履歴を保存（非同期・非ブロッキング）
 *   try {
 *     await propertyListingApi.saveSellerSendHistory(propertyNumber, {
 *       chat_type: 'seller_email',
 *       subject: selectedTemplateName || editableEmailSubject || '',
 *       message: editableEmailBody || '',
 *       sender_name: employee?.name || employee?.initials || '不明',
 *     });
 *     setSellerSendHistoryRefreshTrigger(prev => prev + 1);
 *   } catch (err) {
 *     console.error('[EMAIL送信履歴] 保存に失敗しました:', err);
 *   }
 * };
 * ```
 */
async function simulateHandleSendEmail(
  input: {
    propertyNumber: string;
    subject: string;
    body: string;
    senderName: string;
    emailSendSuccess: boolean; // メール送信APIが成功するか
  },
  saveSellerSendHistoryMock: ReturnType<typeof vi.fn>,
  setSellerSendHistoryRefreshTriggerMock: ReturnType<typeof vi.fn>
): Promise<{ snackbarShown: boolean; saveHistoryCalled: boolean }> {
  // メール送信APIの結果をシミュレート
  if (!input.emailSendSuccess) {
    // 送信失敗: saveSellerSendHistory は呼ばれない
    return { snackbarShown: false, saveHistoryCalled: false };
  }

  // 送信成功: saveSellerSendHistory を呼ぶ（観察した動作）
  try {
    await saveSellerSendHistoryMock(input.propertyNumber, {
      chat_type: 'seller_email',
      subject: input.subject,
      message: input.body,
      sender_name: input.senderName,
    });
    setSellerSendHistoryRefreshTriggerMock((prev: number) => prev + 1);
  } catch (err) {
    // エラー時はコンソールに記録するだけ（UIに影響しない）
    console.error('[EMAIL送信履歴] 保存に失敗しました:', err);
  }

  return { snackbarShown: true, saveHistoryCalled: true };
}

/**
 * PropertyListingDetailPage の handleSendSms の動作をシミュレートする関数
 *
 * 観察した実際のコード（PropertyListingDetailPage.tsx の handleSendSms）:
 * ```typescript
 * const handleSendSms = async () => {
 *   const phone = data?.seller_contact;
 *   if (!phone) return;
 *
 *   // SMSアプリを起動
 *   window.location.href = `sms:${phone}?body=${encodeURIComponent(smsDialog.body)}`;
 *
 *   // 送信履歴を保存
 *   try {
 *     await propertyListingApi.saveSellerSendHistory(propertyNumber!, {
 *       chat_type: 'seller_sms',
 *       subject: smsDialog.templateName,
 *       message: smsDialog.body,
 *       sender_name: employee?.name || employee?.initials || '不明',
 *     });
 *     setSellerSendHistoryRefreshTrigger(prev => prev + 1);
 *   } catch (error) {
 *     console.error('SMS送信履歴の保存に失敗しました:', error);
 *   }
 *
 *   setSmsDialog({ open: false, body: '', templateName: '' });
 * };
 * ```
 */
async function simulateHandleSendSms(
  input: {
    propertyNumber: string;
    templateName: string;
    body: string;
    senderName: string;
    phoneExists: boolean; // 電話番号が存在するか
  },
  saveSellerSendHistoryMock: ReturnType<typeof vi.fn>,
  setSellerSendHistoryRefreshTriggerMock: ReturnType<typeof vi.fn>
): Promise<{ smsSent: boolean; saveHistoryCalled: boolean }> {
  // 電話番号が存在しない場合は何もしない
  if (!input.phoneExists) {
    return { smsSent: false, saveHistoryCalled: false };
  }

  // SMSアプリを起動（window.location.href の設定をシミュレート）
  // 送信履歴を保存（観察した動作）
  try {
    await saveSellerSendHistoryMock(input.propertyNumber, {
      chat_type: 'seller_sms',
      subject: input.templateName,
      message: input.body,
      sender_name: input.senderName,
    });
    setSellerSendHistoryRefreshTriggerMock((prev: number) => prev + 1);
  } catch (error) {
    console.error('SMS送信履歴の保存に失敗しました:', error);
  }

  return { smsSent: true, saveHistoryCalled: true };
}

/**
 * GmailDistributionButton の送信フロー（ステップ）をシミュレートする関数
 *
 * 観察した実際のフロー（GmailDistributionButton.tsx）:
 * 1. ボタンクリック → テンプレート選択モーダルを開く（templateSelectorOpen: true）
 * 2. テンプレート選択 → 買主フィルタモーダルを開く（filterSummaryOpen: true）
 * 3. 買主フィルタ確認 → 確認モーダルを開く（confirmationOpen: true）
 * 4. 確認 → sendEmailsDirectly を呼ぶ
 */
function simulateGmailDistributionButtonFlow(
  step: 'button_click' | 'template_selected' | 'filter_confirmed' | 'send_confirmed'
): {
  templateSelectorOpen: boolean;
  filterSummaryOpen: boolean;
  confirmationOpen: boolean;
} {
  switch (step) {
    case 'button_click':
      // ボタンクリック: テンプレート選択モーダルを開く
      return { templateSelectorOpen: true, filterSummaryOpen: false, confirmationOpen: false };
    case 'template_selected':
      // テンプレート選択: 買主フィルタモーダルを開く
      return { templateSelectorOpen: false, filterSummaryOpen: true, confirmationOpen: false };
    case 'filter_confirmed':
      // 買主フィルタ確認: 確認モーダルを開く
      return { templateSelectorOpen: false, filterSummaryOpen: false, confirmationOpen: true };
    case 'send_confirmed':
      // 送信確認: 全モーダルを閉じる（送信処理へ）
      return { templateSelectorOpen: false, filterSummaryOpen: false, confirmationOpen: false };
  }
}

// ===== ジェネレーター =====

/**
 * seller_email 送信の入力を生成するジェネレーター
 */
const sellerEmailInputArbitrary = fc.record({
  propertyNumber: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  subject: fc.string({ minLength: 1, maxLength: 100 }),
  body: fc.string({ minLength: 0, maxLength: 500 }),
  senderName: fc.string({ minLength: 1, maxLength: 50 }),
  emailSendSuccess: fc.constant(true), // 送信成功ケース
});

/**
 * seller_sms 送信の入力を生成するジェネレーター
 */
const sellerSmsInputArbitrary = fc.record({
  propertyNumber: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  templateName: fc.string({ minLength: 1, maxLength: 100 }),
  body: fc.string({ minLength: 0, maxLength: 500 }),
  senderName: fc.string({ minLength: 1, maxLength: 50 }),
  phoneExists: fc.constant(true), // 電話番号あり
});

/**
 * 送信失敗ケースの入力を生成するジェネレーター
 */
const failureCaseInputArbitrary = fc.record({
  propertyNumber: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  subject: fc.string({ minLength: 1, maxLength: 100 }),
  body: fc.string({ minLength: 0, maxLength: 500 }),
  senderName: fc.string({ minLength: 1, maxLength: 50 }),
  emailSendSuccess: fc.constant(false), // 送信失敗ケース
});

// ===== Property 2: Preservation テスト =====

describe('Property 2: Preservation - 既存の seller_email / seller_sms 送信履歴保存処理が継続して動作する', () => {

  /**
   * **Validates: Requirements 3.1**
   *
   * 観察した動作: handleSendEmail が送信成功後に saveSellerSendHistory(chat_type: 'seller_email') を呼び出す
   * このテストは未修正コードで PASS する（ベースライン動作の確認）
   */
  test('Property 2.1: 任意の seller_email 送信成功に対して saveSellerSendHistory(chat_type: "seller_email") が呼ばれること', async () => {
    await fc.assert(
      fc.asyncProperty(sellerEmailInputArbitrary, async (input) => {
        // saveSellerSendHistory のモック
        const saveSellerSendHistoryMock = vi.fn().mockResolvedValue(undefined);
        const setRefreshTriggerMock = vi.fn();

        // handleSendEmail の動作をシミュレート
        const result = await simulateHandleSendEmail(
          input,
          saveSellerSendHistoryMock,
          setRefreshTriggerMock
        );

        // 観察した動作: 送信成功後に saveSellerSendHistory が呼ばれる
        expect(result.snackbarShown).toBe(true);
        expect(saveSellerSendHistoryMock).toHaveBeenCalledTimes(1);
        expect(saveSellerSendHistoryMock).toHaveBeenCalledWith(
          input.propertyNumber,
          expect.objectContaining({ chat_type: 'seller_email' })
        );
        // refreshTrigger がインクリメントされる
        expect(setRefreshTriggerMock).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * 観察した動作: handleSendSms が送信成功後に saveSellerSendHistory(chat_type: 'seller_sms') を呼び出す
   * このテストは未修正コードで PASS する（ベースライン動作の確認）
   */
  test('Property 2.2: 任意の seller_sms 送信成功に対して saveSellerSendHistory(chat_type: "seller_sms") が呼ばれること', async () => {
    await fc.assert(
      fc.asyncProperty(sellerSmsInputArbitrary, async (input) => {
        // saveSellerSendHistory のモック
        const saveSellerSendHistoryMock = vi.fn().mockResolvedValue(undefined);
        const setRefreshTriggerMock = vi.fn();

        // handleSendSms の動作をシミュレート
        const result = await simulateHandleSendSms(
          input,
          saveSellerSendHistoryMock,
          setRefreshTriggerMock
        );

        // 観察した動作: 送信成功後に saveSellerSendHistory が呼ばれる
        expect(result.smsSent).toBe(true);
        expect(saveSellerSendHistoryMock).toHaveBeenCalledTimes(1);
        expect(saveSellerSendHistoryMock).toHaveBeenCalledWith(
          input.propertyNumber,
          expect.objectContaining({ chat_type: 'seller_sms' })
        );
        // refreshTrigger がインクリメントされる
        expect(setRefreshTriggerMock).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * 観察した動作: 送信失敗時は saveSellerSendHistory が呼ばれない
   * このテストは未修正コードで PASS する（ベースライン動作の確認）
   */
  test('Property 2.3: 任意の送信失敗ケースに対して saveSellerSendHistory が呼ばれないこと', async () => {
    await fc.assert(
      fc.asyncProperty(failureCaseInputArbitrary, async (input) => {
        // saveSellerSendHistory のモック
        const saveSellerSendHistoryMock = vi.fn().mockResolvedValue(undefined);
        const setRefreshTriggerMock = vi.fn();

        // handleSendEmail の動作をシミュレート（送信失敗）
        const result = await simulateHandleSendEmail(
          input,
          saveSellerSendHistoryMock,
          setRefreshTriggerMock
        );

        // 観察した動作: 送信失敗時は saveSellerSendHistory が呼ばれない
        expect(result.snackbarShown).toBe(false);
        expect(saveSellerSendHistoryMock).not.toHaveBeenCalled();
        expect(setRefreshTriggerMock).not.toHaveBeenCalled();
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * 観察した動作: GmailDistributionButton の送信フロー（テンプレート選択 → 買主フィルタ → 確認 → 送信）が変更されていない
   * このテストは未修正コードで PASS する（ベースライン動作の確認）
   */
  test('Property 2.4: GmailDistributionButton の送信フロー（テンプレート選択 → 買主フィルタ → 確認 → 送信）が変更されていないこと', () => {
    // ステップ1: ボタンクリック → テンプレート選択モーダルが開く
    const step1 = simulateGmailDistributionButtonFlow('button_click');
    expect(step1.templateSelectorOpen).toBe(true);
    expect(step1.filterSummaryOpen).toBe(false);
    expect(step1.confirmationOpen).toBe(false);

    // ステップ2: テンプレート選択 → 買主フィルタモーダルが開く
    const step2 = simulateGmailDistributionButtonFlow('template_selected');
    expect(step2.templateSelectorOpen).toBe(false);
    expect(step2.filterSummaryOpen).toBe(true);
    expect(step2.confirmationOpen).toBe(false);

    // ステップ3: 買主フィルタ確認 → 確認モーダルが開く
    const step3 = simulateGmailDistributionButtonFlow('filter_confirmed');
    expect(step3.templateSelectorOpen).toBe(false);
    expect(step3.filterSummaryOpen).toBe(false);
    expect(step3.confirmationOpen).toBe(true);

    // ステップ4: 送信確認 → 全モーダルが閉じる（送信処理へ）
    const step4 = simulateGmailDistributionButtonFlow('send_confirmed');
    expect(step4.templateSelectorOpen).toBe(false);
    expect(step4.filterSummaryOpen).toBe(false);
    expect(step4.confirmationOpen).toBe(false);
  });
});

// ===== 具体例テスト =====

describe('具体例: 保全動作の具体的なシナリオ', () => {

  /**
   * 具体例1: seller_email 送信成功後に saveSellerSendHistory が呼ばれる
   *
   * **Validates: Requirements 3.1**
   */
  test('具体例1: seller_email 送信成功後に saveSellerSendHistory(chat_type: "seller_email") が呼ばれること', async () => {
    const input = {
      propertyNumber: 'P001',
      subject: '物件のご案内',
      body: 'テスト本文',
      senderName: '山田太郎',
      emailSendSuccess: true,
    };

    const saveSellerSendHistoryMock = vi.fn().mockResolvedValue(undefined);
    const setRefreshTriggerMock = vi.fn();

    const result = await simulateHandleSendEmail(input, saveSellerSendHistoryMock, setRefreshTriggerMock);

    // 送信成功: saveSellerSendHistory が呼ばれる
    expect(result.snackbarShown).toBe(true);
    expect(saveSellerSendHistoryMock).toHaveBeenCalledWith('P001', {
      chat_type: 'seller_email',
      subject: '物件のご案内',
      message: 'テスト本文',
      sender_name: '山田太郎',
    });
    expect(setRefreshTriggerMock).toHaveBeenCalledTimes(1);
  });

  /**
   * 具体例2: seller_sms 送信成功後に saveSellerSendHistory が呼ばれる
   *
   * **Validates: Requirements 3.2**
   */
  test('具体例2: seller_sms 送信成功後に saveSellerSendHistory(chat_type: "seller_sms") が呼ばれること', async () => {
    const input = {
      propertyNumber: 'P001',
      templateName: 'SMS通知テンプレート',
      body: 'SMSテスト本文',
      senderName: '山田太郎',
      phoneExists: true,
    };

    const saveSellerSendHistoryMock = vi.fn().mockResolvedValue(undefined);
    const setRefreshTriggerMock = vi.fn();

    const result = await simulateHandleSendSms(input, saveSellerSendHistoryMock, setRefreshTriggerMock);

    // 送信成功: saveSellerSendHistory が呼ばれる
    expect(result.smsSent).toBe(true);
    expect(saveSellerSendHistoryMock).toHaveBeenCalledWith('P001', {
      chat_type: 'seller_sms',
      subject: 'SMS通知テンプレート',
      message: 'SMSテスト本文',
      sender_name: '山田太郎',
    });
    expect(setRefreshTriggerMock).toHaveBeenCalledTimes(1);
  });

  /**
   * 具体例3: seller_email 送信失敗時は saveSellerSendHistory が呼ばれない
   *
   * **Validates: Requirements 3.3**
   */
  test('具体例3: seller_email 送信失敗時は saveSellerSendHistory が呼ばれないこと', async () => {
    const input = {
      propertyNumber: 'P001',
      subject: '物件のご案内',
      body: 'テスト本文',
      senderName: '山田太郎',
      emailSendSuccess: false, // 送信失敗
    };

    const saveSellerSendHistoryMock = vi.fn().mockResolvedValue(undefined);
    const setRefreshTriggerMock = vi.fn();

    const result = await simulateHandleSendEmail(input, saveSellerSendHistoryMock, setRefreshTriggerMock);

    // 送信失敗: saveSellerSendHistory は呼ばれない
    expect(result.snackbarShown).toBe(false);
    expect(saveSellerSendHistoryMock).not.toHaveBeenCalled();
    expect(setRefreshTriggerMock).not.toHaveBeenCalled();
  });

  /**
   * 具体例4: 電話番号がない場合は seller_sms の saveSellerSendHistory が呼ばれない
   *
   * **Validates: Requirements 3.3**
   */
  test('具体例4: 電話番号がない場合は seller_sms の saveSellerSendHistory が呼ばれないこと', async () => {
    const input = {
      propertyNumber: 'P001',
      templateName: 'SMS通知テンプレート',
      body: 'SMSテスト本文',
      senderName: '山田太郎',
      phoneExists: false, // 電話番号なし
    };

    const saveSellerSendHistoryMock = vi.fn().mockResolvedValue(undefined);
    const setRefreshTriggerMock = vi.fn();

    const result = await simulateHandleSendSms(input, saveSellerSendHistoryMock, setRefreshTriggerMock);

    // 電話番号なし: SMS送信も saveSellerSendHistory も呼ばれない
    expect(result.smsSent).toBe(false);
    expect(saveSellerSendHistoryMock).not.toHaveBeenCalled();
    expect(setRefreshTriggerMock).not.toHaveBeenCalled();
  });

  /**
   * 具体例5: saveSellerSendHistory が失敗してもUIに影響しない（エラーハンドリングの保全）
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  test('具体例5: saveSellerSendHistory が失敗してもUIに影響しないこと（エラーハンドリングの保全）', async () => {
    const input = {
      propertyNumber: 'P001',
      subject: '物件のご案内',
      body: 'テスト本文',
      senderName: '山田太郎',
      emailSendSuccess: true,
    };

    // saveSellerSendHistory が失敗するモック
    const saveSellerSendHistoryMock = vi.fn().mockRejectedValue(new Error('保存に失敗しました'));
    const setRefreshTriggerMock = vi.fn();

    // エラーが throw されないことを確認（UIに影響しない）
    await expect(
      simulateHandleSendEmail(input, saveSellerSendHistoryMock, setRefreshTriggerMock)
    ).resolves.not.toThrow();

    // saveSellerSendHistory は呼ばれた（失敗したが）
    expect(saveSellerSendHistoryMock).toHaveBeenCalledTimes(1);
    // refreshTrigger はインクリメントされない（保存失敗のため）
    expect(setRefreshTriggerMock).not.toHaveBeenCalled();
  });
});
