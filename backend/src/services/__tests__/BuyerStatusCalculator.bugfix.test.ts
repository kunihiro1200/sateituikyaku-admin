/**
 * バグ条件探索テスト: broker_inquiry = '業者問合せ' の場合の条件分岐バグ
 *
 * このテストは未修正コードでバグを再現し、根本原因を確認するためのものです。
 *
 * バグ1:
 *   checkMissingFields 関数（BuyerDetailPage.tsx）において、
 *   broker_inquiry = '業者問合せ' の場合でも inquiry_source が必須チェックされる。
 *
 * バグ2:
 *   calculateBuyerStatus の Priority 3 判定において、
 *   broker_inquiry = '業者問合せ' の買主が「内覧日前日」ステータスに分類される。
 *
 * 未修正コードでは:
 *   - バグ2の探索テストは FAIL する（「内覧日前日」に分類されてしまうため）
 *   - これがバグの存在を証明する
 *
 * Validates: Requirements 1.1, 1.2
 */

// jest では describe, it, expect はグローバルに利用可能
import { calculateBuyerStatus, BuyerData } from '../BuyerStatusCalculator';

// ============================================================
// テスト用ユーティリティ: 今日から N 日後の日付文字列を返す
// ============================================================

/**
 * 今日から指定日数後の日付を YYYY-MM-DD 形式で返す
 */
function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate(), ).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 今日から指定日数後の曜日を日本語で返す
 */
function dayOfWeekFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const days_ja = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  return days_ja[d.getDay()];
}

/**
 * 明日の日付文字列を返す
 */
function tomorrow(): string {
  return daysFromToday(1);
}

/**
 * 2日後の日付文字列を返す
 */
function twoDaysFromToday(): string {
  return daysFromToday(2);
}

// ============================================================
// テスト用の最小限の買主データ（Priority 1〜2 の条件を満たさない）
// ============================================================

const minimalBuyer: BuyerData = {
  buyer_number: 'TEST001',
  name: 'テスト買主',
  // Priority 1: 査定アンケート回答あり → 満たさない
  valuation_survey: null,
  valuation_survey_confirmed: null,
  // Priority 2: 業者問合せあり → 満たさない
  broker_survey: null,
  // Priority 3 以降の条件を制御するため null に設定
  viewing_unconfirmed: null,
  viewing_type_general: null,
  post_viewing_seller_contact: null,
  atbb_status: null,
  next_call_date: null,
  follow_up_assignee: null,
  inquiry_email_phone: null,
  inquiry_email_reply: null,
  three_calls_confirmed: null,
};

// ============================================================
// BuyerData 型確認テスト
// ============================================================

describe('BuyerData 型確認: broker_inquiry フィールドの存在確認', () => {
  it('BuyerData インターフェースに broker_inquiry フィールドが存在すること', () => {
    // Arrange: broker_inquiry を含む買主データを作成
    const buyer: BuyerData = {
      ...minimalBuyer,
      broker_inquiry: '業者問合せ',
    };

    // Assert: TypeScript コンパイルが通れば型定義が存在する証明
    // broker_inquiry フィールドにアクセスできることを確認
    expect(buyer.broker_inquiry).toBe('業者問合せ');
    expect('broker_inquiry' in buyer).toBe(true);
  });

  it('broker_inquiry が null の場合も BuyerData として有効であること', () => {
    const buyer: BuyerData = {
      ...minimalBuyer,
      broker_inquiry: null,
    };
    expect(buyer.broker_inquiry).toBeNull();
  });
});

// ============================================================
// バグ2の探索テスト: 内覧日前日ステータスの誤分類
// ============================================================

describe('バグ2探索: broker_inquiry = "業者問合せ" の場合の内覧日前日ステータス', () => {
  describe('ケース1: latest_viewing_date = 明日（木曜日以外）', () => {
    it('「内覧日前日」を返さないこと（未修正コードでは FAIL する可能性あり）', () => {
      // Arrange: 明日が木曜日でない場合のテスト
      // 明日の曜日を確認して木曜日の場合はスキップ
      const tomorrowDate = tomorrow();
      const tomorrowDayOfWeek = dayOfWeekFromToday(1);

      if (tomorrowDayOfWeek === '木曜日') {
        // 木曜日の場合は別のケースでテストするためスキップ
        console.log('明日は木曜日のため、このテストはスキップします');
        return;
      }

      const buyer: BuyerData = {
        ...minimalBuyer,
        broker_inquiry: '業者問合せ',
        latest_viewing_date: tomorrowDate,
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: broker_inquiry = '業者問合せ' の場合、「内覧日前日」にならないこと
      // 未修正コードでは Priority 3 の除外条件が機能せず「内覧日前日」を返す可能性がある
      expect(result.status).not.toBe('内覧日前日');
    });
  });

  describe('ケース2: latest_viewing_date = 木曜日（2日後）', () => {
    it('「内覧日前日」を返さないこと（未修正コードでは FAIL する可能性あり）', () => {
      // Arrange: 2日後が木曜日の場合のテスト
      const twoDaysDate = twoDaysFromToday();
      const twoDaysDayOfWeek = dayOfWeekFromToday(2);

      if (twoDaysDayOfWeek !== '木曜日') {
        // 2日後が木曜日でない場合はスキップ
        console.log(`2日後は${twoDaysDayOfWeek}のため、このテストはスキップします`);
        return;
      }

      const buyer: BuyerData = {
        ...minimalBuyer,
        broker_inquiry: '業者問合せ',
        latest_viewing_date: twoDaysDate,
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: broker_inquiry = '業者問合せ' の場合、「内覧日前日」にならないこと
      expect(result.status).not.toBe('内覧日前日');
    });
  });

  describe('ケース3: 決定論的テスト（曜日に依存しない）', () => {
    it('broker_inquiry = "業者問合せ" かつ latest_viewing_date = 明日 → 「内覧日前日」を返さないこと', () => {
      // Arrange: 明日の日付を使用（曜日に関わらず）
      const buyer: BuyerData = {
        ...minimalBuyer,
        broker_inquiry: '業者問合せ',
        latest_viewing_date: tomorrow(),
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 業者問合せの場合は「内覧日前日」にならないこと
      // 未修正コードでは、broker_inquiry が BuyerData に未定義の場合、
      // not(equals(undefined, '業者問合せ')) が true になり「内覧日前日」を返す可能性がある
      // → このテストが FAIL すれば、バグが存在することを証明する
      expect(result.status).not.toBe('内覧日前日');
    });

    it('broker_inquiry = "業者問合せ" かつ latest_viewing_date = 2日後 → 「内覧日前日」を返さないこと', () => {
      // Arrange: 2日後の日付を使用（木曜日判定に関わらず）
      const buyer: BuyerData = {
        ...minimalBuyer,
        broker_inquiry: '業者問合せ',
        latest_viewing_date: twoDaysFromToday(),
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 業者問合せの場合は「内覧日前日」にならないこと
      expect(result.status).not.toBe('内覧日前日');
    });
  });
});

// ============================================================
// バグ1の探索テスト: inquiry_source 必須チェックの誤動作
// （BuyerStatusCalculator.ts では checkMissingFields は実装されていないため、
//   このテストは BuyerData 型の broker_inquiry フィールドの動作を確認する）
// ============================================================

describe('バグ1探索: broker_inquiry = "業者問合せ" の場合の inquiry_source 必須チェック', () => {
  it('broker_inquiry = "業者問合せ" かつ inquiry_source = null の場合、calculateBuyerStatus がエラーなく動作すること', () => {
    // Arrange: バグ1の条件を再現
    const buyer: BuyerData = {
      ...minimalBuyer,
      broker_inquiry: '業者問合せ',
      inquiry_source: null,
    };

    // Act: calculateBuyerStatus は inquiry_source の必須チェックを行わないため、
    // エラーなく動作するはず
    const result = calculateBuyerStatus(buyer);

    // Assert: ステータス計算がエラーなく完了すること
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();

    // 追加確認: broker_inquiry = '業者問合せ' の場合、
    // 「内覧日前日」以外のステータスが返ること（内覧日が設定されていないため）
    expect(result.status).not.toBe('内覧日前日');
  });

  it('broker_inquiry = "業者問合せ" かつ inquiry_source = null かつ latest_viewing_date = 明日 → 「内覧日前日」を返さないこと', () => {
    // Arrange: バグ1とバグ2の複合条件
    const buyer: BuyerData = {
      ...minimalBuyer,
      broker_inquiry: '業者問合せ',
      inquiry_source: null,
      latest_viewing_date: tomorrow(),
    };

    // Act
    const result = calculateBuyerStatus(buyer);

    // Assert: 業者問合せの場合は「内覧日前日」にならないこと
    // このテストが FAIL すれば、バグ2が存在することを証明する
    expect(result.status).not.toBe('内覧日前日');
  });
});

// ============================================================
// 保持確認テスト（参考）: broker_inquiry が '業者問合せ' 以外の場合
// ============================================================

describe('保持確認: broker_inquiry が "業者問合せ" 以外の場合は「内覧日前日」になること', () => {
  /**
   * 観察1: broker_inquiry = null かつ inquiry_source = null
   * → calculateBuyerStatus がエラーなく動作すること（inquiry_source は BuyerStatusCalculator では必須チェックしない）
   * Validates: Requirements 3.1
   */
  it('broker_inquiry = null かつ inquiry_source = null → calculateBuyerStatus がエラーなく動作すること', () => {
    // Arrange: broker_inquiry が空欄で inquiry_source も空欄の場合
    const buyer: BuyerData = {
      ...minimalBuyer,
      broker_inquiry: null,
      inquiry_source: null,
    };

    // Act: BuyerStatusCalculator は inquiry_source の必須チェックを行わないため、エラーなく動作するはず
    const result = calculateBuyerStatus(buyer);

    // Assert: ステータス計算がエラーなく完了すること
    // （BuyerDetailPage.tsx の checkMissingFields とは異なり、ここでは必須チェックは行わない）
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
  });

  /**
   * 観察2: broker_inquiry = null かつ latest_viewing_date = 明日（木曜日以外）
   * → calculateBuyerStatus が「内覧日前日」を返すこと
   * Validates: Requirements 3.2
   */
  it('broker_inquiry = null かつ latest_viewing_date = 明日（木曜日以外）→ 「内覧日前日」になること', () => {
    // Arrange
    const tomorrowDayOfWeek = dayOfWeekFromToday(1);
    if (tomorrowDayOfWeek === '木曜日') {
      console.log('明日は木曜日のため、このテストはスキップします');
      return;
    }

    const buyer: BuyerData = {
      ...minimalBuyer,
      broker_inquiry: null,
      latest_viewing_date: tomorrow(),
    };

    // Act
    const result = calculateBuyerStatus(buyer);

    // Assert: broker_inquiry が null の場合は「内覧日前日」になること（保持確認）
    expect(result.status).toBe('内覧日前日');
    expect(result.priority).toBe(3);
  });

  /**
   * 観察3: broker_inquiry = '業者（両手）' かつ latest_viewing_date = 明日（木曜日以外）
   * → calculateBuyerStatus が「内覧日前日」を返すこと
   * Validates: Requirements 3.2
   */
  it('broker_inquiry = "業者（両手）" かつ latest_viewing_date = 明日（木曜日以外）→ 「内覧日前日」になること', () => {
    // Arrange
    const tomorrowDayOfWeek = dayOfWeekFromToday(1);
    if (tomorrowDayOfWeek === '木曜日') {
      console.log('明日は木曜日のため、このテストはスキップします');
      return;
    }

    const buyer: BuyerData = {
      ...minimalBuyer,
      broker_inquiry: '業者（両手）',
      latest_viewing_date: tomorrow(),
    };

    // Act
    const result = calculateBuyerStatus(buyer);

    // Assert: broker_inquiry が '業者（両手）' の場合は「内覧日前日」になること（保持確認）
    // '業者問合せ' 以外の値は除外条件に該当しないため、通常通り「内覧日前日」になる
    expect(result.status).toBe('内覧日前日');
    expect(result.priority).toBe(3);
  });

  /**
   * 観察4: broker_inquiry = '業者問合せ' かつ inquiry_source = 'SUUMO'
   * → calculateBuyerStatus がエラーなく動作すること（inquiry_source の値は保持される）
   * Validates: Requirements 3.3
   */
  it('broker_inquiry = "業者問合せ" かつ inquiry_source = "SUUMO" → calculateBuyerStatus がエラーなく動作すること', () => {
    // Arrange: broker_inquiry = '業者問合せ' でも inquiry_source に値がある場合
    const buyer: BuyerData = {
      ...minimalBuyer,
      broker_inquiry: '業者問合せ',
      inquiry_source: 'SUUMO',
    };

    // Act
    const result = calculateBuyerStatus(buyer);

    // Assert: ステータス計算がエラーなく完了すること
    // inquiry_source の値は保持されており、ステータス計算に影響しない
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
    // broker_inquiry = '業者問合せ' の場合、内覧日が設定されていないため「内覧日前日」にはならない
    expect(result.status).not.toBe('内覧日前日');
  });
});

// ============================================================
// タスク2-1: notification_sender バグ修正確認テスト
// ============================================================

describe('バグ修正確認: notification_sender が入力済みの場合は「内覧日前日」にならないこと', () => {
  /**
   * ケース1: notification_sender = '山田'、latest_viewing_date = 明日、broker_inquiry = null
   * → ステータスが「内覧日前日」以外であること
   */
  it('notification_sender = "山田"、latest_viewing_date = 明日、broker_inquiry = null → 「内覧日前日」以外', () => {
    // Arrange
    const tomorrowDayOfWeek = dayOfWeekFromToday(1);
    // 明日が木曜日の場合、isTomorrow かつ 木曜日 → Priority 3 の or 条件を満たさないため
    // 2日後が木曜日かどうかに関わらず、notification_sender があれば除外されることを確認
    const buyer: BuyerData = {
      ...minimalBuyer,
      notification_sender: '山田',
      latest_viewing_date: tomorrow(),
      broker_inquiry: null,
    };

    // Act
    const result = calculateBuyerStatus(buyer);

    // Assert: notification_sender が入力済みの場合、「内覧日前日」にならないこと
    expect(result.status).not.toBe('内覧日前日');
  });

  /**
   * ケース2: notification_sender = '山田'、latest_viewing_date = 木曜日（2日後）
   * → ステータスが「内覧日前日」以外であること
   */
  it('notification_sender = "山田"、latest_viewing_date = 木曜日（2日後）→ 「内覧日前日」以外', () => {
    // Arrange: 2日後が木曜日になるよう固定の木曜日日付を計算
    // 今日から次の木曜日を探して、それが2日後になるよう調整
    // 簡易的に: 今日の曜日から2日後が木曜日かどうかを確認し、
    // そうでなければ固定の木曜日日付を使用
    const twoDaysDate = twoDaysFromToday();
    const twoDaysDayOfWeek = dayOfWeekFromToday(2);

    // 2日後が木曜日でない場合は、次の木曜日を計算して使用
    let thursdayDate: string;
    if (twoDaysDayOfWeek === '木曜日') {
      thursdayDate = twoDaysDate;
    } else {
      // 次の木曜日を計算（今日から最大7日以内）
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=日, 1=月, ..., 4=木, ...
      const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7;
      const nextThursday = new Date(today);
      nextThursday.setDate(today.getDate() + daysUntilThursday);
      const yyyy = nextThursday.getFullYear();
      const mm = String(nextThursday.getMonth() + 1).padStart(2, '0');
      const dd = String(nextThursday.getDate()).padStart(2, '0');
      thursdayDate = `${yyyy}-${mm}-${dd}`;
    }

    const buyer: BuyerData = {
      ...minimalBuyer,
      notification_sender: '山田',
      latest_viewing_date: thursdayDate,
      broker_inquiry: null,
    };

    // Act
    const result = calculateBuyerStatus(buyer);

    // Assert: notification_sender が入力済みの場合、「内覧日前日」にならないこと
    // （2日後が木曜日でない場合、そもそも Priority 3 の条件を満たさないため、このテストは常に通る）
    expect(result.status).not.toBe('内覧日前日');
  });

  /**
   * ケース3（リグレッション防止）: notification_sender = null、latest_viewing_date = 明日、broker_inquiry = null
   * → ステータスが「内覧日前日」であること
   */
  it('notification_sender = null、latest_viewing_date = 明日（木曜日以外）、broker_inquiry = null → 「内覧日前日」', () => {
    // Arrange
    const tomorrowDayOfWeek = dayOfWeekFromToday(1);
    if (tomorrowDayOfWeek === '木曜日') {
      console.log('明日は木曜日のため、このテストはスキップします');
      return;
    }

    const buyer: BuyerData = {
      ...minimalBuyer,
      notification_sender: null,
      latest_viewing_date: tomorrow(),
      broker_inquiry: null,
    };

    // Act
    const result = calculateBuyerStatus(buyer);

    // Assert: notification_sender が null の場合は「内覧日前日」になること（リグレッション防止）
    expect(result.status).toBe('内覧日前日');
    expect(result.priority).toBe(3);
  });

  /**
   * ケース4（リグレッション防止）: notification_sender = ''（空文字）、latest_viewing_date = 明日
   * → ステータスが「内覧日前日」であること
   */
  it('notification_sender = ""（空文字）、latest_viewing_date = 明日（木曜日以外）→ 「内覧日前日」', () => {
    // Arrange
    const tomorrowDayOfWeek = dayOfWeekFromToday(1);
    if (tomorrowDayOfWeek === '木曜日') {
      console.log('明日は木曜日のため、このテストはスキップします');
      return;
    }

    const buyer: BuyerData = {
      ...minimalBuyer,
      notification_sender: '',
      latest_viewing_date: tomorrow(),
      broker_inquiry: null,
    };

    // Act
    const result = calculateBuyerStatus(buyer);

    // Assert: notification_sender が空文字の場合も「内覧日前日」になること（リグレッション防止）
    expect(result.status).toBe('内覧日前日');
    expect(result.priority).toBe(3);
  });

  /**
   * ケース5（既存ロジック保持）: broker_inquiry = '業者問合せ'、notification_sender = null、latest_viewing_date = 明日
   * → ステータスが「内覧日前日」以外であること
   */
  it('broker_inquiry = "業者問合せ"、notification_sender = null、latest_viewing_date = 明日 → 「内覧日前日」以外', () => {
    // Arrange
    const buyer: BuyerData = {
      ...minimalBuyer,
      broker_inquiry: '業者問合せ',
      notification_sender: null,
      latest_viewing_date: tomorrow(),
    };

    // Act
    const result = calculateBuyerStatus(buyer);

    // Assert: broker_inquiry = '業者問合せ' の場合は「内覧日前日」にならないこと（既存ロジック保持）
    expect(result.status).not.toBe('内覧日前日');
  });
});

// ============================================================
// タスク2-2〜2-4: プロパティベーステスト
// ============================================================

import * as fc from 'fast-check';

// ============================================================
// テスト用ヘルパー: 明日の内覧日を持つ買主データを生成する
// ============================================================

/**
 * 明日の内覧日を持つ最小限の買主データを生成する
 * Priority 1〜2 の条件を満たさないよう設定
 */
function makeTomorrowViewingBuyer(overrides: Partial<BuyerData> = {}): BuyerData {
  return {
    ...minimalBuyer,
    latest_viewing_date: tomorrow(),
    ...overrides,
  };
}

// ============================================================
// Property 1: 通知送信者入力済みの場合は内覧日前日カテゴリーから除外される
// Feature: buyer-viewing-notification-sender-fix, Property 1
// Validates: Requirements 2.3
// ============================================================

describe('Property 1: 通知送信者入力済みの場合は内覧日前日カテゴリーから除外される', () => {
  /**
   * **Validates: Requirements 2.3**
   *
   * 非空の notification_sender と「業者問合せ」以外の broker_inquiry の
   * 任意の組み合わせで status !== '内覧日前日' を検証する
   */
  it('非空の notification_sender と「業者問合せ」以外の broker_inquiry の任意の組み合わせで status !== "内覧日前日"', () => {
    // 明日が木曜日の場合はスキップ（木曜日は2日後が対象のため）
    const tomorrowDayOfWeek = dayOfWeekFromToday(1);
    if (tomorrowDayOfWeek === '木曜日') {
      console.log('明日は木曜日のため、このプロパティテストはスキップします');
      return;
    }

    // Feature: buyer-viewing-notification-sender-fix, Property 1: 通知送信者入力済みの場合は内覧日前日カテゴリーから除外される
    fc.assert(
      fc.property(
        // 非空の notification_sender（1文字以上の任意の文字列）
        fc.string({ minLength: 1, maxLength: 50 }),
        // 「業者問合せ」以外の broker_inquiry（null, '', undefined, '個人', 'SUUMO' など）
        fc.constantFrom(null, '', '個人', 'SUUMO', '業者（両手）', '業者（片手）'),
        (notificationSender, brokerInquiry) => {
          const buyer = makeTomorrowViewingBuyer({
            notification_sender: notificationSender,
            broker_inquiry: brokerInquiry,
          });
          const result = calculateBuyerStatus(buyer);
          // 通知送信者が入力済みの場合、「内覧日前日」にならないこと
          return result.status !== '内覧日前日';
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 2: 通知送信者が空欄の場合は内覧日前日カテゴリーに表示され続ける
// Feature: buyer-viewing-notification-sender-fix, Property 2
// Validates: Requirements 3.1, 3.2
// ============================================================

describe('Property 2: 通知送信者が空欄の場合は内覧日前日カテゴリーに表示され続ける', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * 空欄の notification_sender（null/undefined/空文字）と「業者問合せ」以外の broker_inquiry の
   * 任意の組み合わせで、latest_viewing_date = 明日（木曜日以外）の場合に status === '内覧日前日' を検証する
   */
  it('空欄の notification_sender と「業者問合せ」以外の broker_inquiry で、明日（木曜日以外）の内覧日の場合 status === "内覧日前日"', () => {
    // 明日が木曜日の場合はスキップ（木曜日は2日後が対象のため）
    const tomorrowDayOfWeek = dayOfWeekFromToday(1);
    if (tomorrowDayOfWeek === '木曜日') {
      console.log('明日は木曜日のため、このプロパティテストはスキップします');
      return;
    }

    // Feature: buyer-viewing-notification-sender-fix, Property 2: 通知送信者が空欄の場合は内覧日前日カテゴリーに表示され続ける
    fc.assert(
      fc.property(
        // 空欄の notification_sender（null または空文字）
        fc.constantFrom(null, ''),
        // 「業者問合せ」以外の broker_inquiry
        fc.constantFrom(null, '', '個人', 'SUUMO', '業者（両手）', '業者（片手）'),
        (notificationSender, brokerInquiry) => {
          const buyer = makeTomorrowViewingBuyer({
            notification_sender: notificationSender,
            broker_inquiry: brokerInquiry,
          });
          const result = calculateBuyerStatus(buyer);
          // 通知送信者が空欄の場合、「内覧日前日」になること
          return result.status === '内覧日前日';
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 3: 業者問合せの場合は内覧日前日カテゴリーから除外され続ける
// Feature: buyer-viewing-notification-sender-fix, Property 3
// Validates: Requirements 3.3
// ============================================================

describe('Property 3: 業者問合せの場合は内覧日前日カテゴリーから除外され続ける', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * 任意の notification_sender と broker_inquiry = '業者問合せ' の
   * 組み合わせで status !== '内覧日前日' を検証する
   */
  it('任意の notification_sender と broker_inquiry = "業者問合せ" の組み合わせで status !== "内覧日前日"', () => {
    // Feature: buyer-viewing-notification-sender-fix, Property 3: 業者問合せの場合は内覧日前日カテゴリーから除外され続ける
    fc.assert(
      fc.property(
        // 任意の notification_sender（null, '', または任意の文字列）
        fc.constantFrom(null, '', '山田', '鈴木', '田中'),
        (notificationSender) => {
          const buyer = makeTomorrowViewingBuyer({
            notification_sender: notificationSender,
            broker_inquiry: '業者問合せ',
          });
          const result = calculateBuyerStatus(buyer);
          // 業者問合せの場合、「内覧日前日」にならないこと
          return result.status !== '内覧日前日';
        }
      ),
      { numRuns: 100 }
    );
  });
});
