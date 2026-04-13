/**
 * Bug Condition Exploration Test: 買主内覧前日通知メール 500エラー
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * このテストは修正前のコードで実行すると失敗する（これが正しい - バグの存在を証明する）
 * 修正後は成功する（バグが修正されたことを確認）
 *
 * バグ条件:
 * - `GoogleAuthService.getAuthenticatedClient()` が `client.refreshAccessToken()` を呼ばずに
 *   アクセストークンを直接 `setCredentials({ access_token, refresh_token })` で設定している
 * - `getAuthenticatedClientForEmployee()` は `refreshAccessToken()` を呼んでトークンを更新するが、
 *   `getAuthenticatedClient()` はそれを行っていない
 * - その結果、アクセストークンが期限切れの場合にメール送信が失敗する
 *
 * 期待される動作（修正後）:
 * - `getAuthenticatedClient()` が `getAuthenticatedClientForEmployee()` と同様に
 *   `refreshAccessToken()` を呼んでトークンを更新する
 * - `EmailService.sendBuyerEmail()` が有効なパラメータで `{ success: true }` を返す
 *
 * 未修正コードでの期待される失敗:
 * - `sendBuyerEmail()` が `{ success: false, error: "..." }` を返す
 * - `POST /api/gmail/send` が 500 Internal Server Error を返す
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fc from 'fast-check';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { EmailService } from '../services/EmailService';

// 環境変数を読み込む（backendディレクトリの.envファイルを明示的に指定）
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('買主内覧前日通知メール 500エラー - バグ条件探索', () => {
  let googleAuthService: GoogleAuthService;
  let emailService: EmailService;

  beforeAll(() => {
    googleAuthService = new GoogleAuthService();
    emailService = new EmailService();
  });

  /**
   * Property 1: Bug Condition - getAuthenticatedClient が refreshAccessToken を呼ばない
   *
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * バグ条件:
   * - `getAuthenticatedClient()` は `setCredentials({ access_token, refresh_token })` で
   *   アクセストークンを直接設定するが、`refreshAccessToken()` を呼ばない
   * - `getAuthenticatedClientForEmployee()` は `refreshAccessToken()` を呼んでトークンを更新する
   *
   * このテストは未修正コードで FAIL する（これがバグの存在を証明する）
   *
   * **CRITICAL**: このアサーションは未修正コードで FAIL する
   */
  it('getAuthenticatedClient() が refreshAccessToken() を呼んでトークンを更新すること（バグ証明）', async () => {
    console.log('\n========================================');
    console.log('🔍 バグ条件探索テスト開始: getAuthenticatedClient');
    console.log('========================================\n');

    // getAuthenticatedClient() を呼び出す
    let client: any;
    let clientError: Error | null = null;

    try {
      client = await googleAuthService.getAuthenticatedClient();
      console.log('✅ getAuthenticatedClient() 呼び出し成功');
    } catch (error: any) {
      clientError = error;
      console.log('❌ getAuthenticatedClient() 呼び出し失敗:', error.message);
    }

    if (clientError) {
      // 認証エラーの場合はバグが存在する（GOOGLE_AUTH_REQUIRED）
      console.log('❌ バグ確認: getAuthenticatedClient() がエラーをスロー:', clientError.message);
      // このアサーションは未修正コードで FAIL する
      expect(clientError).toBeNull();
      return;
    }

    // クライアントが返された場合、refreshAccessToken() が呼ばれたか確認する
    // 修正後は credentials に access_token が含まれているはず
    const credentials = client.credentials;
    console.log('クライアントのcredentials:', {
      hasAccessToken: !!credentials?.access_token,
      hasRefreshToken: !!credentials?.refresh_token,
      expiryDate: credentials?.expiry_date,
    });

    // **CRITICAL**: 修正後は refreshAccessToken() が呼ばれ、
    // credentials に有効な access_token が含まれているはず
    // 未修正コードでは getAccessToken() で取得したトークンが直接設定されるが、
    // refreshAccessToken() は呼ばれないため、トークンが期限切れの場合に失敗する

    // refreshAccessToken() が呼ばれた場合、expiry_date が設定されているはず
    // 未修正コードでは expiry_date が設定されない可能性がある
    console.log('\n🔍 getAuthenticatedClientForEmployee() との比較:');
    console.log('  - getAuthenticatedClient(): refreshAccessToken() を呼ばない（バグ）');
    console.log('  - getAuthenticatedClientForEmployee(): refreshAccessToken() を呼ぶ（正常）');

    // **CRITICAL**: このアサーションは未修正コードで FAIL する
    // 修正後は refreshAccessToken() が呼ばれ、expiry_date が設定されているはず
    expect(credentials?.expiry_date).toBeDefined();

    console.log('\n========================================');
    console.log('🔍 バグ条件探索テスト終了');
    console.log('========================================\n');
  }, 30000);

  /**
   * Property 1 (メール送信): sendBuyerEmail() が有効なパラメータで success: false を返す
   *
   * **Validates: Requirements 1.2, 1.4**
   *
   * バグ条件:
   * - 有効なパラメータで `sendBuyerEmail()` を呼び出すと `{ success: false }` が返る
   * - 原因は `getAuthenticatedClient()` の失敗
   *
   * **CRITICAL**: このテストは未修正コードで FAIL する（バグの存在を証明する）
   */
  it('sendBuyerEmail() が有効なパラメータで success: true を返すこと（バグ証明）', async () => {
    console.log('\n========================================');
    console.log('🔍 sendBuyerEmail バグ条件探索テスト開始');
    console.log('========================================\n');

    // 有効なパラメータを設定（内覧前日通知メールのシミュレーション）
    const validParams = {
      to: 'test-buyer@example.com',
      subject: '内覧前日のご確認',
      body: '明日の内覧についてご確認ください。\n\n日時: 2026年4月10日 14:00\n場所: 大分市〇〇',
      from: 'tenant@ifoo-oita.com',
    };

    console.log('📧 送信パラメータ:', {
      to: validParams.to,
      subject: validParams.subject,
      bodyLength: validParams.body.length,
    });

    // sendBuyerEmail() を呼び出す
    const result = await emailService.sendBuyerEmail(validParams);

    console.log('\n📊 sendBuyerEmail() の結果:');
    console.log('  - success:', result.success);
    console.log('  - messageId:', result.messageId);
    console.log('  - error:', result.error);

    if (!result.success) {
      console.log('\n❌ バグ確認: sendBuyerEmail() が success: false を返しました');
      console.log('  エラーメッセージ:', result.error);
      console.log('  これはバグの存在を証明します');
    } else {
      console.log('\n✅ sendBuyerEmail() が success: true を返しました（バグなし）');
    }

    console.log('\n========================================');
    console.log('🔍 sendBuyerEmail バグ条件探索テスト終了');
    console.log('========================================\n');

    // **CRITICAL**: このアサーションは未修正コードで FAIL する
    // 未修正コードでは getAuthenticatedClient() の失敗により success: false が返る
    expect(result.success).toBe(true);
  }, 30000);

  /**
   * Property-Based Test: isBugCondition - 有効なパラメータで常に success: false になる
   *
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * バグ条件の定義:
   * `isBugCondition(input)` = 有効なパラメータを送信した際に `sendBuyerEmail()` が `success: false` を返す
   *
   * 様々な有効なメールパラメータを生成し、
   * 未修正コードでは常に `success: false` が返ることを確認する
   *
   * **CRITICAL**: このテストは未修正コードで FAIL する（バグの存在を証明する）
   */
  it('Property-Based: 有効なパラメータで sendBuyerEmail() が常に success: true を返すこと（バグ証明）', async () => {
    console.log('\n========================================');
    console.log('🔍 Property-Based バグ条件探索テスト開始');
    console.log('========================================\n');

    // 有効なメールパラメータのジェネレーター
    const validEmailArbitrary = fc.record({
      // 有効なメールアドレス（テスト用）
      to: fc.constantFrom(
        'test-buyer1@example.com',
        'test-buyer2@example.com',
        'test-buyer3@example.com'
      ),
      // 内覧前日通知メールの件名パターン
      subject: fc.constantFrom(
        '内覧前日のご確認',
        '【内覧前日通知】明日の内覧について',
        '☆内覧前日通知メール',
        '内覧のご確認（前日）'
      ),
      // 有効なメール本文
      body: fc.constantFrom(
        '明日の内覧についてご確認ください。',
        '内覧前日のご連絡です。\n\n日時: 2026年4月10日 14:00',
        '内覧のご確認をお願いします。\n場所: 大分市〇〇'
      ),
      from: fc.constant('tenant@ifoo-oita.com'),
    });

    let failCount = 0;
    let successCount = 0;
    const results: Array<{ params: any; result: any }> = [];

    await fc.assert(
      fc.asyncProperty(
        validEmailArbitrary,
        async (params) => {
          console.log(`\n📧 テスト実行: subject="${params.subject}"`);

          const result = await emailService.sendBuyerEmail(params);

          results.push({ params, result });

          if (result.success) {
            successCount++;
            console.log('  ✅ success: true');
          } else {
            failCount++;
            console.log('  ❌ success: false, error:', result.error);
          }

          // **CRITICAL**: このアサーションは未修正コードで FAIL する
          // 未修正コードでは getAuthenticatedClient() の失敗により success: false が返る
          return result.success === true;
        }
      ),
      {
        numRuns: 3, // 3回のランダムテストを実行（APIコール数を抑制）
        verbose: true,
      }
    );

    console.log('\n📊 テスト結果サマリー:');
    console.log(`  - 成功: ${successCount}件`);
    console.log(`  - 失敗: ${failCount}件`);

    if (failCount > 0) {
      console.log('\n❌ バグ確認: 有効なパラメータで success: false が返されました');
      console.log('  これはバグの存在を証明します');
      console.log('\n反例（counterexamples）:');
      results
        .filter(r => !r.result.success)
        .forEach((r, i) => {
          console.log(`  反例 ${i + 1}:`);
          console.log(`    subject: "${r.params.subject}"`);
          console.log(`    error: "${r.result.error}"`);
        });
    }

    console.log('\n========================================');
    console.log('🔍 Property-Based バグ条件探索テスト終了');
    console.log('========================================\n');
  }, 60000);
});
