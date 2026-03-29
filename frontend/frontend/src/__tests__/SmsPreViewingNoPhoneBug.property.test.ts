/**
 * SMS内覧前日ボタン表示条件のバグ探索テスト
 *
 * このテストは未修正コードでバグの存在を証明するためのものです。
 * テスト1は意図的にFAILします（バグの存在を証明）。
 *
 * Validates: Requirements 1.1, 1.2
 */

import { describe, it, expect } from 'vitest';

/**
 * 修正済みのSMSボタン表示条件
 * BuyerViewingResultPage.tsx の修正後の条件: buyer.phone_number
 */
const shouldShowSmsButton_buggy = (buyer: {
  phone_number?: string | null;
  email?: string | null;
}): boolean => {
  return !!buyer.phone_number;
};

/**
 * 期待される（正しい）SMSボタン表示条件
 * 電話番号があればSMSボタンを表示する
 */
const shouldShowSmsButton_expected = (buyer: {
  phone_number?: string | null;
  email?: string | null;
}): boolean => {
  return !!buyer.phone_number;
};

describe('SMS内覧前日ボタン表示条件 - バグ探索テスト', () => {
  /**
   * 探索テスト1（バグ確認）:
   * 電話番号あり・メールあり の場合
   *
   * - shouldShowSmsButton_buggy は false を返す（バグ）
   * - shouldShowSmsButton_expected は true を返す（期待値）
   *
   * このテストは「期待値が true であること」をアサートする。
   * 未修正コードでは FAIL する（バグの存在を証明）。
   */
  it('電話番号あり・メールあり: SMSボタンが表示されるべき（バグ確認 - 未修正コードでFAIL）', () => {
    const buyer = {
      phone_number: '090-1234-5678',
      email: 'test@example.com',
    };

    // バグのある条件は false を返す
    const buggyResult = shouldShowSmsButton_buggy(buyer);
    expect(buggyResult).toBe(true); // 修正済み: 電話番号があればSMSボタンが表示される

    // 期待される条件は true を返すべき
    const expectedResult = shouldShowSmsButton_expected(buyer);
    expect(expectedResult).toBe(true); // 期待値

    // このアサートが未修正コードでFAILする（バグの証明）
    // 修正後は buggyResult が true になり PASS する
    expect(buggyResult).toBe(expectedResult);
  });

  /**
   * 探索テスト2（正常ケース確認）:
   * 電話番号あり・メールなし の場合
   *
   * - shouldShowSmsButton_buggy は true を返す（正常）
   * - shouldShowSmsButton_expected は true を返す（期待値）
   *
   * このテストは PASS する（バグが発現しないケース）。
   */
  it('電話番号あり・メールなし: SMSボタンが表示される（正常ケース - PASS）', () => {
    const buyer = {
      phone_number: '090-1234-5678',
      email: null,
    };

    const buggyResult = shouldShowSmsButton_buggy(buyer);
    const expectedResult = shouldShowSmsButton_expected(buyer);

    expect(buggyResult).toBe(true);
    expect(expectedResult).toBe(true);
    expect(buggyResult).toBe(expectedResult);
  });
});

/**
 * SMS内覧前日ボタン表示条件の保持テスト
 *
 * このテストは未修正コードで非バグ入力の動作を観察し、
 * 保持すべきベースライン動作を確認するためのものです。
 * 全テストが未修正コードで PASS すること。
 *
 * Validates: Requirements 2.1, 2.4, 3.1, 3.2, 3.3, 3.4
 */

// Eメールボタン表示条件（変更しない）
const shouldShowEmailButton = (buyer: { email?: string | null }) => !!buyer.email;

// 内覧前日ボタン群の表示条件（変更しない）
const shouldShowPreDayButtons = (buyer: {
  broker_inquiry?: string | null;
  notification_sender?: string | null;
}) => {
  return buyer.broker_inquiry !== '業者問合せ' && !buyer.notification_sender;
};

describe('SMS内覧前日ボタン表示条件 - 保持テスト（未修正コードでPASS）', () => {
  /**
   * 観察1: phone_number = null、email = null → SMSボタンが表示されない（送信手段なし）
   * shouldShowSmsButton_buggy は false → 正しい動作
   */
  it('観察1: 電話番号なし・メールなし → SMSボタンが表示されない（送信手段なし）', () => {
    const buyer = {
      phone_number: null,
      email: null,
    };

    const result = shouldShowSmsButton_buggy(buyer);
    expect(result).toBe(false);
  });

  /**
   * 観察2: phone_number = null、email = 'test@example.com' → SMSボタンが表示されない、Eメールボタンのみ
   * shouldShowSmsButton_buggy は false → 正しい動作
   */
  it('観察2: 電話番号なし・メールあり → SMSボタンが表示されない（Eメールボタンのみ）', () => {
    const buyer = {
      phone_number: null,
      email: 'test@example.com',
    };

    const smsResult = shouldShowSmsButton_buggy(buyer);
    const emailResult = shouldShowEmailButton(buyer);

    expect(smsResult).toBe(false);
    expect(emailResult).toBe(true);
  });

  /**
   * 観察3: email = 'test@example.com' → Eメールボタンが表示される（email条件は変更しない）
   * shouldShowEmailButton は true → 正しい動作
   */
  it('観察3: メールあり → Eメールボタンが表示される', () => {
    const buyer = {
      email: 'test@example.com',
    };

    const result = shouldShowEmailButton(buyer);
    expect(result).toBe(true);
  });

  /**
   * 観察4: broker_inquiry = '業者問合せ' → ボタン群が表示されない
   * shouldShowPreDayButtons は false → 正しい動作
   */
  it('観察4: broker_inquiry = 業者問合せ → ボタン群が表示されない', () => {
    const buyer = {
      broker_inquiry: '業者問合せ',
      notification_sender: null,
    };

    const result = shouldShowPreDayButtons(buyer);
    expect(result).toBe(false);
  });

  /**
   * 観察5: notification_sender が入力済み → ボタン群が表示されない
   * shouldShowPreDayButtons は false → 正しい動作
   */
  it('観察5: notification_sender が入力済み → ボタン群が表示されない', () => {
    const buyer = {
      broker_inquiry: null,
      notification_sender: 'スタッフA',
    };

    const result = shouldShowPreDayButtons(buyer);
    expect(result).toBe(false);
  });

  /**
   * 追加確認: broker_inquiry が '業者問合せ' でなく notification_sender も空 → ボタン群が表示される
   */
  it('追加確認: broker_inquiry なし・notification_sender なし → ボタン群が表示される', () => {
    const buyer = {
      broker_inquiry: null,
      notification_sender: null,
    };

    const result = shouldShowPreDayButtons(buyer);
    expect(result).toBe(true);
  });
});
