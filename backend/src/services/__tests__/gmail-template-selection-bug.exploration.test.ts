/**
 * バグ条件探索テスト: Gmail テンプレート選択バグ
 *
 * このテストは未修正コードでバグを再現し、根本原因を確認するためのものです。
 * バグ条件: EmailTemplateService.getTemplates() が GoogleSheetsClient の
 * authenticate() または spreadsheets.values.get() の例外をキャッチして
 * 空配列を返す（エラーを握りつぶす）
 *
 * 未修正コードでは:
 *   - テストシナリオ1, 2 は FAIL する（getTemplates() が例外をスローせず [] を返すため）
 *   - これがバグの存在を証明する
 *
 * Validates: Requirements 1.3
 */

import { EmailTemplateService } from '../EmailTemplateService';
import { GoogleSheetsClient } from '../GoogleSheetsClient';

// GoogleSheetsClient をモック
jest.mock('../GoogleSheetsClient');

const MockedGoogleSheetsClient = GoogleSheetsClient as jest.MockedClass<typeof GoogleSheetsClient>;

describe('バグ条件探索: EmailTemplateService.getTemplates() のエラー握りつぶし', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('テストシナリオ1: authenticate() が例外をスローする場合', () => {
    it('getTemplates() は例外をスローすべきである（未修正コードでは [] を返すため FAIL）', async () => {
      // Arrange: authenticate() が例外をスローするようにモック
      const authError = new Error('認証失敗: GOOGLE_SERVICE_ACCOUNT_JSON が未設定');
      MockedGoogleSheetsClient.mockImplementation(() => ({
        authenticate: jest.fn().mockRejectedValue(authError),
        sheets: null,
      } as any));

      const service = new EmailTemplateService();

      // Act & Assert: 例外がスローされることを期待
      // 未修正コードでは catch ブロックが return [] するため、この expect は FAIL する
      // → これがバグの存在を証明する反例
      await expect(service.getTemplates()).rejects.toThrow();
    });
  });

  describe('テストシナリオ2: spreadsheets.values.get() が例外をスローする場合', () => {
    it('getTemplates() は例外をスローすべきである（未修正コードでは [] を返すため FAIL）', async () => {
      // Arrange: authenticate() は成功するが spreadsheets.values.get() が例外をスロー
      const sheetsError = new Error('スプレッドシートアクセス失敗: スプレッドシートIDが不正');
      const mockSheetsInstance = {
        spreadsheets: {
          values: {
            get: jest.fn().mockRejectedValue(sheetsError),
          },
        },
      };

      MockedGoogleSheetsClient.mockImplementation(() => ({
        authenticate: jest.fn().mockResolvedValue(undefined),
        sheets: mockSheetsInstance,
      } as any));

      const service = new EmailTemplateService();

      // Act & Assert: 例外がスローされることを期待
      // 未修正コードでは catch ブロックが return [] するため、この expect は FAIL する
      // → これがバグの存在を証明する反例
      await expect(service.getTemplates()).rejects.toThrow();
    });
  });
});
