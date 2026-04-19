/**
 * 保全プロパティテスト - 他決・一般媒介通知が引き続き GOOGLE_CHAT_WEBHOOK_URL を使用する
 *
 * **Feature: seller-call-mode-sennin-chat-url-bug, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2**
 *
 * ✅ このテストは未修正コードで PASS することが期待される（保全すべきベースライン動作を確認）
 * GOAL: sendExclusiveContractNotification() 以外のメソッドが引き続き GOOGLE_CHAT_WEBHOOK_URL を使用することを確認する
 *
 * 保全要件:
 * - sendGeneralContractNotification() は GOOGLE_CHAT_WEBHOOK_URL を使用する（要件 3.1）
 * - sendPostVisitOtherDecisionNotification() は GOOGLE_CHAT_WEBHOOK_URL を使用する（要件 3.2）
 * - sendPreVisitOtherDecisionNotification() は GOOGLE_CHAT_WEBHOOK_URL を使用する（要件 3.2）
 * - sendPropertyIntroductionNotification() は GOOGLE_CHAT_WEBHOOK_URL を使用する（要件 3.1）
 */

import axios from 'axios';
import * as fc from 'fast-check';

// axios をモック化
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// @supabase/supabase-js をモック化（DB接続不要）
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              seller_number: 'AA0001',
              name: 'dGVzdA==', // 暗号化済みダミー
              property_address: '東京都渋谷区1-1-1',
              property_type: 'マンション',
              valuation_amount_2: 50000000,
              exclusive_other_decision_factor: '価格',
              visit_assignee: '担当者A',
            },
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

// encryption をモック化（復号処理をスキップ）
jest.mock('../../utils/encryption', () => ({
  decrypt: jest.fn((val: string) => val + '_decrypted'),
}));

// テスト対象のサービスをインポート（モック設定後）
import { ChatNotificationService } from '../ChatNotificationService';

const EXCLUSIVE_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAAAEz1pOnw/messages?key=test_exclusive';
const COMMON_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAAA_OTHER/messages?key=test_common';

describe('Property 2: Preservation - 他決・一般媒介通知が引き続き GOOGLE_CHAT_WEBHOOK_URL を使用する', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // 2つの異なるWebhook URLを環境変数に設定
    process.env.GOOGLE_CHAT_WEBHOOK_URL = COMMON_WEBHOOK_URL;
    process.env.GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL = EXCLUSIVE_WEBHOOK_URL;

    // axios.post が成功レスポンスを返すようにモック
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} });
  });

  afterEach(() => {
    delete process.env.GOOGLE_CHAT_WEBHOOK_URL;
    delete process.env.GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL;
  });

  /**
   * 観察1: sendGeneralContractNotification() が GOOGLE_CHAT_WEBHOOK_URL を使用する
   *
   * ✅ 未修正コードでも修正後でも PASS するべきテスト（保全確認）
   *
   * **Validates: Requirements 3.1**
   */
  it('観察1: sendGeneralContractNotification() が GOOGLE_CHAT_WEBHOOK_URL（共通URL）で axios.post を呼ぶ', async () => {
    const service = new ChatNotificationService();

    await service.sendGeneralContractNotification('seller-001', {
      assignee: '担当者A',
      notes: 'テスト備考',
    });

    expect(mockedAxios.post).toHaveBeenCalled();

    const calledUrl = mockedAxios.post.mock.calls[0][0];

    console.log('sendGeneralContractNotification が呼ばれたURL:', calledUrl);
    console.log('期待値 (COMMON_WEBHOOK_URL):', COMMON_WEBHOOK_URL);

    // ✅ 保全確認: COMMON_WEBHOOK_URL が使われることを確認
    expect(calledUrl).toBe(COMMON_WEBHOOK_URL);
  });

  /**
   * 観察2: sendPostVisitOtherDecisionNotification() が GOOGLE_CHAT_WEBHOOK_URL を使用する
   *
   * ✅ 未修正コードでも修正後でも PASS するべきテスト（保全確認）
   *
   * **Validates: Requirements 3.2**
   */
  it('観察2: sendPostVisitOtherDecisionNotification() が GOOGLE_CHAT_WEBHOOK_URL（共通URL）で axios.post を呼ぶ', async () => {
    const service = new ChatNotificationService();

    await service.sendPostVisitOtherDecisionNotification('seller-001', {
      assignee: '担当者A',
      reason: '価格',
    });

    expect(mockedAxios.post).toHaveBeenCalled();

    const calledUrl = mockedAxios.post.mock.calls[0][0];

    console.log('sendPostVisitOtherDecisionNotification が呼ばれたURL:', calledUrl);
    console.log('期待値 (COMMON_WEBHOOK_URL):', COMMON_WEBHOOK_URL);

    // ✅ 保全確認: COMMON_WEBHOOK_URL が使われることを確認
    expect(calledUrl).toBe(COMMON_WEBHOOK_URL);
  });

  /**
   * 観察3: sendPreVisitOtherDecisionNotification() が GOOGLE_CHAT_WEBHOOK_URL を使用する
   *
   * ✅ 未修正コードでも修正後でも PASS するべきテスト（保全確認）
   *
   * **Validates: Requirements 3.2**
   */
  it('観察3: sendPreVisitOtherDecisionNotification() が GOOGLE_CHAT_WEBHOOK_URL（共通URL）で axios.post を呼ぶ', async () => {
    const service = new ChatNotificationService();

    await service.sendPreVisitOtherDecisionNotification('seller-001', {
      assignee: '担当者A',
      reason: '価格',
    });

    expect(mockedAxios.post).toHaveBeenCalled();

    const calledUrl = mockedAxios.post.mock.calls[0][0];

    console.log('sendPreVisitOtherDecisionNotification が呼ばれたURL:', calledUrl);
    console.log('期待値 (COMMON_WEBHOOK_URL):', COMMON_WEBHOOK_URL);

    // ✅ 保全確認: COMMON_WEBHOOK_URL が使われることを確認
    expect(calledUrl).toBe(COMMON_WEBHOOK_URL);
  });

  /**
   * 観察4: sendPropertyIntroductionNotification() が GOOGLE_CHAT_WEBHOOK_URL を使用する
   *
   * ✅ 未修正コードでも修正後でも PASS するべきテスト（保全確認）
   *
   * **Validates: Requirements 3.1**
   */
  it('観察4: sendPropertyIntroductionNotification() が GOOGLE_CHAT_WEBHOOK_URL（共通URL）で axios.post を呼ぶ', async () => {
    const service = new ChatNotificationService();

    await service.sendPropertyIntroductionNotification('seller-001', 'テスト物件紹介文');

    expect(mockedAxios.post).toHaveBeenCalled();

    const calledUrl = mockedAxios.post.mock.calls[0][0];

    console.log('sendPropertyIntroductionNotification が呼ばれたURL:', calledUrl);
    console.log('期待値 (COMMON_WEBHOOK_URL):', COMMON_WEBHOOK_URL);

    // ✅ 保全確認: COMMON_WEBHOOK_URL が使われることを確認
    expect(calledUrl).toBe(COMMON_WEBHOOK_URL);
  });

  /**
   * PBT: sendGeneralContractNotification() が任意の入力で常に GOOGLE_CHAT_WEBHOOK_URL を使用する
   *
   * ✅ 未修正コードでも修正後でも PASS するべきテスト（保全確認）
   *
   * **Validates: Requirements 3.1**
   */
  it('PBT: 任意の入力で sendGeneralContractNotification() が常に GOOGLE_CHAT_WEBHOOK_URL を使う', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 36 }).filter(s => s.trim().length > 0),
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
        async (sellerId, assignee, notes) => {
          jest.clearAllMocks();
          mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

          const service = new ChatNotificationService();

          await service.sendGeneralContractNotification(sellerId, {
            assignee: assignee ?? undefined,
            notes: notes ?? undefined,
          });

          if (mockedAxios.post.mock.calls.length === 0) {
            return;
          }

          const calledUrl = mockedAxios.post.mock.calls[0][0];

          // ✅ 保全確認: 常に COMMON_WEBHOOK_URL が使われることを確認
          expect(calledUrl).toBe(COMMON_WEBHOOK_URL);
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  });

  /**
   * PBT: sendPostVisitOtherDecisionNotification() が任意の入力で常に GOOGLE_CHAT_WEBHOOK_URL を使用する
   *
   * ✅ 未修正コードでも修正後でも PASS するべきテスト（保全確認）
   *
   * **Validates: Requirements 3.2**
   */
  it('PBT: 任意の入力で sendPostVisitOtherDecisionNotification() が常に GOOGLE_CHAT_WEBHOOK_URL を使う', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 36 }).filter(s => s.trim().length > 0),
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
        async (sellerId, assignee, reason) => {
          jest.clearAllMocks();
          mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

          const service = new ChatNotificationService();

          await service.sendPostVisitOtherDecisionNotification(sellerId, {
            assignee: assignee ?? undefined,
            reason: reason ?? undefined,
          });

          if (mockedAxios.post.mock.calls.length === 0) {
            return;
          }

          const calledUrl = mockedAxios.post.mock.calls[0][0];

          // ✅ 保全確認: 常に COMMON_WEBHOOK_URL が使われることを確認
          expect(calledUrl).toBe(COMMON_WEBHOOK_URL);
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  });

  /**
   * PBT: sendPreVisitOtherDecisionNotification() が任意の入力で常に GOOGLE_CHAT_WEBHOOK_URL を使用する
   *
   * ✅ 未修正コードでも修正後でも PASS するべきテスト（保全確認）
   *
   * **Validates: Requirements 3.2**
   */
  it('PBT: 任意の入力で sendPreVisitOtherDecisionNotification() が常に GOOGLE_CHAT_WEBHOOK_URL を使う', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 36 }).filter(s => s.trim().length > 0),
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
        async (sellerId, assignee, reason) => {
          jest.clearAllMocks();
          mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

          const service = new ChatNotificationService();

          await service.sendPreVisitOtherDecisionNotification(sellerId, {
            assignee: assignee ?? undefined,
            reason: reason ?? undefined,
          });

          if (mockedAxios.post.mock.calls.length === 0) {
            return;
          }

          const calledUrl = mockedAxios.post.mock.calls[0][0];

          // ✅ 保全確認: 常に COMMON_WEBHOOK_URL が使われることを確認
          expect(calledUrl).toBe(COMMON_WEBHOOK_URL);
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  });

  /**
   * PBT: sendPropertyIntroductionNotification() が任意の入力で常に GOOGLE_CHAT_WEBHOOK_URL を使用する
   *
   * ✅ 未修正コードでも修正後でも PASS するべきテスト（保全確認）
   *
   * **Validates: Requirements 3.1**
   */
  it('PBT: 任意の入力で sendPropertyIntroductionNotification() が常に GOOGLE_CHAT_WEBHOOK_URL を使う', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 36 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 0, maxLength: 200 }),
        async (sellerId, introduction) => {
          jest.clearAllMocks();
          mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

          const service = new ChatNotificationService();

          await service.sendPropertyIntroductionNotification(sellerId, introduction);

          if (mockedAxios.post.mock.calls.length === 0) {
            return;
          }

          const calledUrl = mockedAxios.post.mock.calls[0][0];

          // ✅ 保全確認: 常に COMMON_WEBHOOK_URL が使われることを確認
          expect(calledUrl).toBe(COMMON_WEBHOOK_URL);
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  });
});
