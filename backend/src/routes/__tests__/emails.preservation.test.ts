/**
 * Property-Based Test: Preservation - 既存メール送信動作の保持
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * このテストは修正前のコードで全て通過することを確認する（ベースライン動作の確認）。
 * バグ条件が成立しない（isBugCondition が false を返す）入力に対して、
 * 既存の動作が変わらないことを検証する。
 *
 * isBugCondition が false になるケース:
 *   - selectedImages が null の場合
 *   - selectedImages が空配列の場合
 *   - template.id === 'valuation' の場合（査定メール専用フロー）
 *   - sendAction が 'sms' の場合（SMS送信フロー）
 *   - send-template-email エンドポイントが attachments なしのリクエストを受け取った場合
 */

import * as fc from 'fast-check';
import request from 'supertest';
import express from 'express';

// モック用の関数を保持する変数
const mockSendTemplateEmail = jest.fn();
const mockSendValuationEmail = jest.fn();
const mockSendEmailWithCcAndAttachments = jest.fn();
const mockGetSeller = jest.fn();

// 認証ミドルウェアをモック化
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.employee = { id: 'test-employee-id', email: 'test@example.com' };
    next();
  },
}));

// EmailService をモック化（外部依存を排除）
jest.mock('../../services/EmailService.supabase', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendTemplateEmail: mockSendTemplateEmail,
    sendValuationEmail: mockSendValuationEmail,
    sendEmailWithCcAndAttachments: mockSendEmailWithCcAndAttachments,
  })),
}));

// SellerService をモック化
jest.mock('../../services/SellerService.supabase', () => ({
  SellerService: jest.fn().mockImplementation(() => ({
    getSeller: mockGetSeller,
  })),
}));

// ValuationEngine をモック化
jest.mock('../../services/ValuationEngine.supabase', () => ({
  ValuationEngine: jest.fn().mockImplementation(() => ({})),
}));

import emailsRouter from '../emails';

// テスト用 Express アプリケーション
const app = express();
app.use(express.json());
app.use('/api/sellers', emailsRouter);

// デフォルトの売主データ（査定額なし）
const defaultSeller = {
  id: 'test-seller-id',
  email: 'seller@example.com',
  name: 'テスト売主',
};

// 査定額ありの売主データ
const sellerWithValuation = {
  id: 'test-seller-id',
  email: 'seller@example.com',
  name: 'テスト売主',
  valuationAmount1: 30000000,
  valuationAmount2: 35000000,
  valuationAmount3: 40000000,
  fixedAssetTaxRoadPrice: 100000,
};

describe('Property 2: Preservation - 既存メール送信動作の保持', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    mockSendTemplateEmail.mockReset();
    mockSendValuationEmail.mockReset();
    mockSendEmailWithCcAndAttachments.mockReset();
    mockGetSeller.mockReset();

    // デフォルトの戻り値を設定
    mockSendTemplateEmail.mockResolvedValue({
      messageId: 'mock-message-id',
      sentAt: new Date(),
      success: true,
    });
    mockSendValuationEmail.mockResolvedValue({
      messageId: 'mock-valuation-message-id',
      sentAt: new Date(),
      success: true,
    });
    mockSendEmailWithCcAndAttachments.mockResolvedValue({
      messageId: 'mock-attachment-message-id',
      sentAt: new Date(),
      success: true,
    });
    mockGetSeller.mockResolvedValue(defaultSeller);
  });

  // =========================================================================
  // Requirement 3.1: 画像を選択せずにメールを送信した場合、添付なしで送信し続ける
  // =========================================================================
  describe('Requirement 3.1: selectedImages が null の場合、添付なしでメールを送信する', () => {
    /**
     * Property: selectedImages が null（バグ条件が成立しない）の場合、
     * send-template-email エンドポイントは従来通り sendTemplateEmail を呼び出す。
     * attachments フィールドなしのリクエストは既存フローを通る。
     *
     * **Validates: Requirements 3.1**
     */
    it('任意のテンプレートIDで attachments なしのリクエストは sendTemplateEmail を呼び出す', async () => {
      await fc.assert(
        fc.asyncProperty(
          // バグ条件が成立しないテンプレートID（valuation 以外）
          fc.constantFrom('follow-up', 'introduction', 'reminder', 'custom', 'general'),
          fc.emailAddress(),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          async (templateId, toEmail, subject, content) => {
            mockSendTemplateEmail.mockReset();
            mockSendEmailWithCcAndAttachments.mockReset();
            mockSendTemplateEmail.mockResolvedValue({
              messageId: 'mock-message-id',
              sentAt: new Date(),
              success: true,
            });

            const response = await request(app)
              .post('/api/sellers/test-seller-id/send-template-email')
              .send({
                templateId,
                to: toEmail,
                subject,
                content,
                // attachments フィールドなし（selectedImages が null のケース）
              });

            // レスポンスが成功であることを確認
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // sendTemplateEmail が呼び出されたことを確認（既存フロー）
            expect(mockSendTemplateEmail).toHaveBeenCalled();

            // sendEmailWithCcAndAttachments は呼び出されていないことを確認
            expect(mockSendEmailWithCcAndAttachments).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: attachments が空配列の場合も、sendTemplateEmail を呼び出す。
     *
     * **Validates: Requirements 3.1, 3.5**
     */
    it('attachments が空配列の場合も sendTemplateEmail を呼び出す', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('follow-up', 'introduction', 'reminder'),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          async (templateId, subject, content) => {
            mockSendTemplateEmail.mockReset();
            mockSendEmailWithCcAndAttachments.mockReset();
            mockSendTemplateEmail.mockResolvedValue({
              messageId: 'mock-message-id',
              sentAt: new Date(),
              success: true,
            });

            const response = await request(app)
              .post('/api/sellers/test-seller-id/send-template-email')
              .send({
                templateId,
                to: 'seller@example.com',
                subject,
                content,
                attachments: [], // 空配列
              });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // 空配列の場合は既存フロー（sendTemplateEmail）を呼び出す
            expect(mockSendTemplateEmail).toHaveBeenCalled();
            expect(mockSendEmailWithCcAndAttachments).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // =========================================================================
  // Requirement 3.2: Base64埋め込み画像付きメールは従来通り送信し続ける
  // =========================================================================
  describe('Requirement 3.2: htmlBody に Base64 埋め込み画像がある場合、従来通り sendTemplateEmail を呼び出す', () => {
    /**
     * Property: htmlBody に Base64 埋め込み画像が含まれる場合（attachments なし）、
     * 従来通り sendTemplateEmail が呼び出される。
     * これは isBugCondition が false のケース（selectedImages は null）。
     *
     * **Validates: Requirements 3.2**
     */
    it('htmlBody に Base64 画像が含まれていても attachments なしなら sendTemplateEmail を呼び出す', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          async (subject, content) => {
            mockSendTemplateEmail.mockReset();
            mockSendEmailWithCcAndAttachments.mockReset();
            mockSendTemplateEmail.mockResolvedValue({
              messageId: 'mock-message-id',
              sentAt: new Date(),
              success: true,
            });

            // Base64 埋め込み画像を含む htmlBody（attachments フィールドなし）
            const htmlBodyWithBase64 = `<p>${content}</p><img src="data:image/jpeg;base64,/9j/4AAQSkZJRgAB" />`;

            const response = await request(app)
              .post('/api/sellers/test-seller-id/send-template-email')
              .send({
                templateId: 'follow-up',
                to: 'seller@example.com',
                subject,
                content,
                htmlBody: htmlBodyWithBase64,
                // attachments フィールドなし
              });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // attachments なしなので sendTemplateEmail が呼び出される（既存フロー）
            expect(mockSendTemplateEmail).toHaveBeenCalled();
            expect(mockSendEmailWithCcAndAttachments).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  // =========================================================================
  // Requirement 3.3: 査定メール（template.id === 'valuation'）は専用フローを使用し続ける
  // =========================================================================
  describe('Requirement 3.3: 査定メールは send-valuation-email エンドポイントで処理される', () => {
    /**
     * Property: send-template-email エンドポイントに templateId='valuation' を送っても、
     * attachments なしなら sendTemplateEmail が呼び出される。
     *
     * **Validates: Requirements 3.3**
     */
    it('templateId が valuation でも attachments なしなら sendTemplateEmail を呼び出す', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          async (subject, content) => {
            mockSendTemplateEmail.mockReset();
            mockSendEmailWithCcAndAttachments.mockReset();
            mockSendTemplateEmail.mockResolvedValue({
              messageId: 'mock-message-id',
              sentAt: new Date(),
              success: true,
            });

            const response = await request(app)
              .post('/api/sellers/test-seller-id/send-template-email')
              .send({
                templateId: 'valuation',
                to: 'seller@example.com',
                subject,
                content,
                // attachments なし
              });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // attachments なしなので sendTemplateEmail が呼び出される
            expect(mockSendTemplateEmail).toHaveBeenCalled();
            expect(mockSendEmailWithCcAndAttachments).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 15 }
      );
    });

    /**
     * Property: send-valuation-email エンドポイントは常に sendValuationEmail を呼び出す。
     * 査定メール専用フローは変更されない。
     *
     * **Validates: Requirements 3.3**
     */
    it('send-valuation-email エンドポイントは sendValuationEmail を呼び出す', async () => {
      // 査定額が設定された売主をモック
      mockGetSeller.mockResolvedValue(sellerWithValuation);

      const response = await request(app)
        .post('/api/sellers/test-seller-id/send-valuation-email')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(mockSendValuationEmail).toHaveBeenCalled();
      // sendTemplateEmail は呼び出されない
      expect(mockSendTemplateEmail).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Requirement 3.5: attachments なしのリクエストは従来通り sendTemplateEmail を呼び出す
  // =========================================================================
  describe('Requirement 3.5: send-template-email エンドポイントが attachments なしのリクエストを受け取った場合', () => {
    /**
     * Property: 任意の有効なリクエスト（attachments なし）に対して、
     * send-template-email エンドポイントは常に sendTemplateEmail を呼び出す。
     * これが修正前の動作（ベースライン）である。
     *
     * **Validates: Requirements 3.5**
     */
    it('任意の有効なリクエスト（attachments なし）で sendTemplateEmail が呼び出される', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 様々なテンプレートID
          fc.constantFrom('follow-up', 'introduction', 'reminder', 'custom', 'valuation', 'general'),
          // 様々な件名
          fc.string({ minLength: 1, maxLength: 100 }),
          // 様々な本文
          fc.string({ minLength: 1, maxLength: 1000 }),
          // オプションの from アドレス
          fc.option(fc.emailAddress(), { nil: undefined }),
          async (templateId, subject, content, fromEmail) => {
            mockSendTemplateEmail.mockReset();
            mockSendEmailWithCcAndAttachments.mockReset();
            mockSendTemplateEmail.mockResolvedValue({
              messageId: 'mock-message-id',
              sentAt: new Date(),
              success: true,
            });

            const requestBody: any = {
              templateId,
              to: 'seller@example.com',
              subject,
              content,
            };

            if (fromEmail !== undefined) {
              requestBody.from = fromEmail;
            }

            const response = await request(app)
              .post('/api/sellers/test-seller-id/send-template-email')
              .send(requestBody);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // attachments なしなので必ず sendTemplateEmail が呼び出される（修正前の動作）
            expect(mockSendTemplateEmail).toHaveBeenCalledTimes(1);
            expect(mockSendEmailWithCcAndAttachments).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 30 }
      );
    });

    /**
     * Property: レスポンスには templateId が含まれる（既存の動作）。
     *
     * **Validates: Requirements 3.5**
     */
    it('レスポンスには templateId が含まれる', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('follow-up', 'introduction', 'reminder', 'custom'),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          async (templateId, subject, content) => {
            mockSendTemplateEmail.mockReset();
            mockSendTemplateEmail.mockResolvedValue({
              messageId: 'mock-message-id',
              sentAt: new Date(),
              success: true,
            });

            const response = await request(app)
              .post('/api/sellers/test-seller-id/send-template-email')
              .send({
                templateId,
                to: 'seller@example.com',
                subject,
                content,
              });

            expect(response.status).toBe(200);
            expect(response.body.templateId).toBe(templateId);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: sendTemplateEmail に渡される引数が正しい（既存の動作）。
     * seller の email が上書きされ、subject, content, htmlBody, from が正しく渡される。
     *
     * **Validates: Requirements 3.5**
     */
    it('sendTemplateEmail に正しい引数が渡される', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          async (subject, content) => {
            mockSendTemplateEmail.mockReset();
            mockSendTemplateEmail.mockResolvedValue({
              messageId: 'mock-message-id',
              sentAt: new Date(),
              success: true,
            });

            const response = await request(app)
              .post('/api/sellers/test-seller-id/send-template-email')
              .send({
                templateId: 'follow-up',
                to: 'seller@example.com',
                subject,
                content,
              });

            expect(response.status).toBe(200);

            expect(mockSendTemplateEmail).toHaveBeenCalledWith(
              expect.objectContaining({ email: 'seller@example.com' }), // seller with updated email
              subject,
              content,
              'test@example.com', // employee email
              'test-employee-id', // employee id
              undefined, // htmlBody
              undefined  // from
            );
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  // =========================================================================
  // バリデーションエラーの保持（既存の動作）
  // =========================================================================
  describe('バリデーションエラーの保持', () => {
    /**
     * Property: subject が空の場合、バリデーションエラーを返す（既存の動作）。
     *
     * **Validates: Requirements 3.5**
     */
    it('subject が空の場合はバリデーションエラーを返す', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }),
          async (content) => {
            const response = await request(app)
              .post('/api/sellers/test-seller-id/send-template-email')
              .send({
                templateId: 'follow-up',
                to: 'seller@example.com',
                subject: '', // 空の subject
                content,
              });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
          }
        ),
        { numRuns: 10 }
      );
    });

    /**
     * Property: content が空の場合、バリデーションエラーを返す（既存の動作）。
     *
     * **Validates: Requirements 3.5**
     */
    it('content が空の場合はバリデーションエラーを返す', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (subject) => {
            const response = await request(app)
              .post('/api/sellers/test-seller-id/send-template-email')
              .send({
                templateId: 'follow-up',
                to: 'seller@example.com',
                subject,
                content: '', // 空の content
              });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
