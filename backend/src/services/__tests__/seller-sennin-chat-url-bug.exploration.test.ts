/**
 * バグ条件探索テスト - 専任媒介通知が誤って他決Chat URLに送信される
 *
 * **Feature: seller-call-mode-sennin-chat-url-bug, Property 1: Bug Condition**
 * **Validates: Requirements 1.1, 1.2**
 *
 * ⚠️ CRITICAL: このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示す反例（counterexample）を見つける
 *
 * バグの根本原因:
 * ChatNotificationService のコンストラクタは GOOGLE_CHAT_WEBHOOK_URL のみを読み込み、
 * sendExclusiveContractNotification() も sendToGoogleChat(message) を呼び出す際に
 * this.webhookUrl（= GOOGLE_CHAT_WEBHOOK_URL）を使用してしまう。
 * GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL を使う仕組みが存在しない。
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
              name: 'dGVzdA==', // 暗号化済みダミー（decrypt でエラーになるが try-catch で処理される）
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

describe('Property 1: Bug Condition - 専任媒介通知が誤って他決Chat URLに送信される', () => {
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
   * テスト1: sendExclusiveContractNotification() が GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL を使用するべき
   *
   * ⚠️ 未修正コードでは GOOGLE_CHAT_WEBHOOK_URL（他決Chat URL）を使用するため FAIL する
   * ✅ 修正後は GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL を使用するため PASS する
   *
   * **Validates: Requirements 1.2, 2.2**
   */
  it('テスト1: sendExclusiveContractNotification() が GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL で axios.post を呼ぶ（未修正コードでは FAIL）', async () => {
    // ChatNotificationService を新規インスタンス化（環境変数を読み込む）
    const service = new ChatNotificationService();

    await service.sendExclusiveContractNotification('seller-001', {
      assignee: '担当者A',
      notes: 'テスト備考',
    });

    // axios.post が呼ばれたことを確認
    expect(mockedAxios.post).toHaveBeenCalled();

    const calledUrl = mockedAxios.post.mock.calls[0][0];

    console.log('axios.post が呼ばれたURL:', calledUrl);
    console.log('期待値 (EXCLUSIVE_WEBHOOK_URL):', EXCLUSIVE_WEBHOOK_URL);
    console.log('実際の値 (COMMON_WEBHOOK_URL):', COMMON_WEBHOOK_URL);
    console.log('');
    console.log('⚠️ 未修正コードでは COMMON_WEBHOOK_URL（他決Chat）が使われるためこのテストは FAIL する');
    console.log('✅ 修正後は EXCLUSIVE_WEBHOOK_URL（専任媒介Chat）が使われるため PASS する');

    // ✅ 修正後に PASS するアサーション
    // ⚠️ 未修正コードでは COMMON_WEBHOOK_URL が使われるため FAIL する（バグの存在を証明）
    expect(calledUrl).toBe(EXCLUSIVE_WEBHOOK_URL);
  });

  /**
   * テスト2: 未修正コードでは GOOGLE_CHAT_WEBHOOK_URL（他決Chat URL）が使われることを確認
   *
   * このテストはバグの存在を「逆から」証明する。
   * 未修正コードでは COMMON_WEBHOOK_URL が使われることを確認する（PASS する）。
   * 修正後はこのテストが FAIL する（EXCLUSIVE_WEBHOOK_URL が使われるため）。
   *
   * **Validates: Requirements 1.2**
   */
  it.skip('テスト2: 未修正コードでは sendExclusiveContractNotification() が GOOGLE_CHAT_WEBHOOK_URL（他決Chat URL）を使用する（バグの証明 - 修正後はスキップ）', async () => {
    const service = new ChatNotificationService();

    await service.sendExclusiveContractNotification('seller-001', {
      assignee: '担当者A',
    });

    expect(mockedAxios.post).toHaveBeenCalled();

    const calledUrl = mockedAxios.post.mock.calls[0][0];

    console.log('axios.post が呼ばれたURL:', calledUrl);
    console.log('バグ確認: COMMON_WEBHOOK_URL（他決Chat）が使われているか?', calledUrl === COMMON_WEBHOOK_URL);

    // バグの存在を証明: 未修正コードでは COMMON_WEBHOOK_URL が使われる
    // このアサーションは未修正コードで PASS する（バグの存在を確認）
    // 修正後は FAIL する（EXCLUSIVE_WEBHOOK_URL が使われるため）
    expect(calledUrl).toBe(COMMON_WEBHOOK_URL);
  });

  /**
   * テスト3: プロパティベーステスト
   * 任意の売主IDとデータで sendExclusiveContractNotification() を呼び出したとき、
   * 常に GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL が使われることを検証
   *
   * ⚠️ 未修正コードでは GOOGLE_CHAT_WEBHOOK_URL が使われるため FAIL する
   * ✅ 修正後は GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL が使われるため PASS する
   *
   * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
   */
  it('テスト3 (PBT): 任意の入力で sendExclusiveContractNotification() が常に GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL を使う（未修正コードでは FAIL）', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 任意の売主ID（英数字）
        fc.string({ minLength: 1, maxLength: 36 }).filter(s => s.trim().length > 0),
        // 任意の担当者名
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        // 任意の備考
        fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
        async (sellerId, assignee, notes) => {
          jest.clearAllMocks();
          mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

          const service = new ChatNotificationService();

          await service.sendExclusiveContractNotification(sellerId, {
            assignee: assignee ?? undefined,
            notes: notes ?? undefined,
          });

          if (mockedAxios.post.mock.calls.length === 0) {
            // axios.post が呼ばれなかった場合はスキップ
            return;
          }

          const calledUrl = mockedAxios.post.mock.calls[0][0];

          // ✅ 修正後に PASS するアサーション
          // ⚠️ 未修正コードでは COMMON_WEBHOOK_URL が使われるため FAIL する
          expect(calledUrl).toBe(EXCLUSIVE_WEBHOOK_URL);
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  });
});
