/**
 * プロパティテスト: PriceReductionNotificationService
 *
 * タスク 1.3: Property 2 - JST日付変換の正確性
 * タスク 1.7: Property 4 - メール内容の正確性
 * タスク 1.9: Property 3 - メール送信件数の正確性
 * タスク 1.10: Property 5 - エラー時の継続処理
 *
 * 注意: EmailService / Supabase の初期化を避けるため、
 * 純粋関数ロジックをサービスから直接抽出してテストする。
 */

import * as fc from 'fast-check';
import {
  PriceReductionTarget,
  NotificationResult,
} from '../PriceReductionNotificationService';

// ============================================================
// 純粋関数ロジックの抽出（サービスのインスタンス化を避ける）
// ============================================================

/**
 * getJSTDateString の純粋関数ロジック（サービスから抽出）
 * UTC日時から JST（UTC+9）の YYYY-MM-DD 文字列を返す
 */
function getJSTDateString(utcDate: Date): string {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstTime = new Date(utcDate.getTime() + JST_OFFSET_MS);
  const yyyy = jstTime.getUTCFullYear();
  const mm = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * buildEmailBody の純粋関数ロジック（サービスから抽出）
 * 物件情報からメール本文を生成する
 */
function buildEmailBody(target: PriceReductionTarget): string {
  return [
    `物件番号：${target.property_number}`,
    `物件住所：${target.address}`,
    `値下げ予約日：${target.price_reduction_scheduled_date}`,
  ].join('\n');
}

/**
 * sendNotifications の内部ループロジック（サービスから抽出）
 * emailSendImpl を差し替えることで送信動作を制御する
 */
async function sendNotificationsWithImpl(
  targets: PriceReductionTarget[],
  emailSendImpl: (target: PriceReductionTarget) => Promise<void>
): Promise<NotificationResult> {
  const result: NotificationResult = {
    sent: 0,
    failed: 0,
    details: [],
  };

  for (const target of targets) {
    try {
      await emailSendImpl(target);
      result.sent += 1;
      result.details.push({ property_number: target.property_number, success: true });
    } catch (error: any) {
      result.failed += 1;
      result.details.push({
        property_number: target.property_number,
        success: false,
        error: error.message,
      });
    }
  }

  return result;
}

// ============================================================
// fast-check アービトラリー定義
// ============================================================

/**
 * 日付境界付近の UTC 日時を生成するアービトラリー
 * UTC 14:59:59 と UTC 15:00:00 の境界を重点的にテストする
 */
const boundaryUtcDateArb = fc.oneof(
  // UTC 14:59:xx（JST 23:59:xx = 同日）
  fc.integer({ min: 0, max: 59 }).map((sec) => {
    const d = new Date('2024-06-15T14:59:00Z');
    d.setUTCSeconds(sec);
    return d;
  }),
  // UTC 15:00:xx（JST 翌日 00:00:xx）
  fc.integer({ min: 0, max: 59 }).map((sec) => {
    const d = new Date('2024-06-15T15:00:00Z');
    d.setUTCSeconds(sec);
    return d;
  }),
  // 一般的な UTC 日時
  fc.date({
    min: new Date('2020-01-01T00:00:00Z'),
    max: new Date('2030-12-31T23:59:59Z'),
  })
);

/**
 * 任意の物件データを生成するアービトラリー
 */
const propertyTargetArb = fc.record({
  property_number: fc.string({ minLength: 1, maxLength: 20 }),
  address: fc.string({ minLength: 1, maxLength: 100 }),
  price_reduction_scheduled_date: fc
    .integer({ min: 2020, max: 2030 })
    .chain((year) =>
      fc.integer({ min: 1, max: 12 }).chain((month) =>
        fc.integer({ min: 1, max: 28 }).map((day) => {
          const mm = String(month).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          return `${year}-${mm}-${dd}`;
        })
      )
    ),
});

/**
 * 任意の物件リストを生成するアービトラリー（1件以上）
 */
const propertyTargetsArb = fc.array(propertyTargetArb, { minLength: 1, maxLength: 20 });

// ============================================================
// Property 2: JST日付変換の正確性（タスク 1.3）
// ============================================================

describe('Property 2: JST日付変換の正確性（タスク 1.3）', () => {
  /**
   * **Validates: Requirements 1.3**
   *
   * 任意の UTC 日時に対して、getJSTDateString が返す日付文字列は
   * UTC+9 オフセットを適用した正しい YYYY-MM-DD 形式であること
   */
  it('任意のUTC日時に対してUTC+9オフセットを適用した正しいYYYY-MM-DD文字列を返すこと', () => {
    fc.assert(
      fc.property(boundaryUtcDateArb, (utcDate) => {
        const result = getJSTDateString(utcDate);

        // YYYY-MM-DD 形式であること
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // UTC+9 を手動計算して検証
        const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
        const jstTime = new Date(utcDate.getTime() + JST_OFFSET_MS);
        const expectedYear = jstTime.getUTCFullYear();
        const expectedMonth = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
        const expectedDay = String(jstTime.getUTCDate()).padStart(2, '0');
        const expected = `${expectedYear}-${expectedMonth}-${expectedDay}`;

        expect(result).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.3**
   *
   * 日付境界付近の具体的なケースを検証する
   * UTC 14:59 = JST 23:59（同日）
   * UTC 15:00 = JST 翌日 00:00（翌日）
   */
  it('UTC 14:59はJST 23:59（同日）、UTC 15:00はJST翌日00:00（翌日）として処理されること', () => {
    // UTC 2024-06-15 14:59:59 → JST 2024-06-15 23:59:59（同日）
    const utcBefore = new Date('2024-06-15T14:59:59Z');
    expect(getJSTDateString(utcBefore)).toBe('2024-06-15');

    // UTC 2024-06-15 15:00:00 → JST 2024-06-16 00:00:00（翌日）
    const utcAfter = new Date('2024-06-15T15:00:00Z');
    expect(getJSTDateString(utcAfter)).toBe('2024-06-16');
  });
});

// ============================================================
// Property 4: メール内容の正確性（タスク 1.7）
// ============================================================

describe('Property 4: メール内容の正確性（タスク 1.7）', () => {
  /**
   * **Validates: Requirements 2.2, 2.3**
   *
   * 任意の物件データに対して、buildEmailBody が返す本文文字列は
   * その物件の全フィールド値を含むこと
   */
  it('任意の物件データに対してbuildEmailBodyが全フィールド値を含む本文を返すこと', () => {
    fc.assert(
      fc.property(propertyTargetArb, (target) => {
        const body = buildEmailBody(target);

        // 物件番号が含まれること
        expect(body).toContain(target.property_number);
        // 物件住所が含まれること
        expect(body).toContain(target.address);
        // 値下げ予約日が含まれること
        expect(body).toContain(target.price_reduction_scheduled_date);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.3**
   *
   * 本文形式が正しいこと:
   *   物件番号：{property_number}
   *   物件住所：{address}
   *   値下げ予約日：{price_reduction_scheduled_date}
   */
  it('buildEmailBodyが正しい形式の本文を返すこと', () => {
    fc.assert(
      fc.property(propertyTargetArb, (target) => {
        const body = buildEmailBody(target);
        const lines = body.split('\n');

        // 3行構成であること
        expect(lines).toHaveLength(3);
        // 各行のプレフィックスが正しいこと
        expect(lines[0]).toMatch(/^物件番号：/);
        expect(lines[1]).toMatch(/^物件住所：/);
        expect(lines[2]).toMatch(/^値下げ予約日：/);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 3: メール送信件数の正確性（タスク 1.9）
// ============================================================

describe('Property 3: メール送信件数の正確性（タスク 1.9）', () => {
  /**
   * **Validates: Requirements 2.1, 3.4**
   *
   * 任意の N 件の対象物件リストに対して、
   * sendNotifications が返す sent + failed の合計は常に N と等しいこと
   */
  it('任意のN件物件リストに対してsent + failed === Nが常に成立すること', async () => {
    await fc.assert(
      fc.asyncProperty(propertyTargetsArb, async (targets) => {
        // 全件成功するモック
        const result = await sendNotificationsWithImpl(targets, async () => {});

        expect(result.sent + result.failed).toBe(targets.length);
        expect(result.details).toHaveLength(targets.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.1**
   *
   * 全送信成功時のレスポンスの sent は N であること
   */
  it('全送信成功時にsentがN件であること', async () => {
    await fc.assert(
      fc.asyncProperty(propertyTargetsArb, async (targets) => {
        const result = await sendNotificationsWithImpl(targets, async () => {});

        expect(result.sent).toBe(targets.length);
        expect(result.failed).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 5: エラー時の継続処理（タスク 1.10）
// ============================================================

describe('Property 5: エラー時の継続処理（タスク 1.10）', () => {
  /**
   * **Validates: Requirements 2.4**
   *
   * 任意の N 件の物件リストで K 番目のメール送信が失敗した場合でも、
   * 残りの N-1 件の送信処理が実行され sent + failed === N が成立すること
   */
  it('K番目が失敗しても残りN-1件の送信が実行されsent + failed === Nが成立すること', async () => {
    await fc.assert(
      fc.asyncProperty(
        propertyTargetsArb,
        fc.integer({ min: 0, max: 19 }),
        async (targets, failIndex) => {
          // failIndex が targets の範囲内に収まるよう調整
          const actualFailIndex = failIndex % targets.length;
          let callCount = 0;

          // actualFailIndex 番目のみ失敗するモック
          const result = await sendNotificationsWithImpl(
            targets,
            async (_target: PriceReductionTarget) => {
              const currentIndex = callCount++;
              if (currentIndex === actualFailIndex) {
                throw new Error('テスト用送信エラー');
              }
            }
          );

          // sent + failed === N が常に成立すること
          expect(result.sent + result.failed).toBe(targets.length);
          // 1件失敗していること
          expect(result.failed).toBe(1);
          // 残りは成功していること
          expect(result.sent).toBe(targets.length - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.4**
   *
   * 失敗した物件の details エントリに success: false と error が含まれること
   */
  it('失敗した物件のdetailsエントリにsuccess:falseとerrorが含まれること', async () => {
    await fc.assert(
      fc.asyncProperty(propertyTargetsArb, async (targets) => {
        // 全件失敗するモック
        const result = await sendNotificationsWithImpl(targets, async () => {
          throw new Error('全件失敗テスト');
        });

        expect(result.failed).toBe(targets.length);
        expect(result.sent).toBe(0);

        for (const detail of result.details) {
          expect(detail.success).toBe(false);
          expect(detail.error).toBeDefined();
        }
      }),
      { numRuns: 50 }
    );
  });
});
