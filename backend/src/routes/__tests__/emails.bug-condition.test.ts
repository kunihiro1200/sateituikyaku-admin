/**
 * Property-Based Test: Bug Condition - 画像添付メール送信バグ
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * このテストは修正後のコードで全て通過することを確認する（バグ修正の確認）。
 * バグ条件が成立する（isBugCondition が true を返す）入力に対して、
 * 選択された画像が添付ファイルとしてメールに含まれることを検証する。
 *
 * isBugCondition が true になるケース:
 *   - sendAction = 'email' かつ selectedImages が null でなく空でない かつ template.id !== 'valuation'
 *
 * 修正前: このテストは失敗する（バグの存在を証明）
 * 修正後: このテストは通過する（バグ修正の確認）
 */

import * as fc from 'fast-check';
import request from 'supertest';
import express from 'express';

// モック用の関数を保持する変数
const mockSendTemplateEmail = jest.fn();
const mockSendValuationEmail = jest.fn();
const mockSendEmailWithCcAndAttachments = jest.fn();
const mockGetSeller = jest.fn();
const mockGetFile = jest.fn();

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

// GoogleDriveService をモック化
jest.mock('../../services/GoogleDriveService', () => ({
  GoogleDriveService: jest.fn().mockImplementation(() => ({
    getFile: mockGetFile,
  })),
}));

import emailsRouter from '../emails';

// テスト用 Express アプリケーション
const app = express();
app.use(express.json());
app.use('/api/sellers', emailsRouter);

// デフォルトの売主データ
const defaultSeller = {
  id: 'test-seller-id',
  email: 'seller@example.com',
  name: 'テスト売主',
};

// テスト用の画像データ
const mockImageData = {
  mimeType: 'image/jpeg',
  data: Buffer.from('fake-image-data').toString('base64'),
};

describe('Property 1: Bug Condition - 画像添付メール送信バグ', () => {
  beforeEach(() => {
    mockSendTemplateEmail.mockReset();
    mockSendValuationEmail.mockReset();
    mockSendEmailWithCcAndAttachments.mockReset();
    mockGetSeller.mockReset();
    mockGetFile.mockReset();

    mockGetSeller.mockResolvedValue(defaultSeller);
    mockGetFile.mockResolvedValue(mockImageData);
    mockSendEmailWithCcAndAttachments.mockResolvedValue({
      messageId: 'mock-attachment-message-id',
      sentAt: new Date(),
      success: true,
    });
    mockSendTemplateEmail.mockResolvedValue({
      messageId: 'mock-message-id',
      sentAt: new Date(),
      success: true,
    });
  });

  // =========================================================================
  // Requirement 2.2, 2.3: attachments を含むリクエストで sendEmailWithCcAndAttachments が呼ばれる
  // =========================================================================
  describe('Requirement 2.2, 2.3: attachments がある場合 sendEmailWithCcAndAttachments を呼び出す', () => {
    /**
     * Property: attachments に1枚以上の画像がある場合、
     * send-template-email エンドポイントは sendEmailWithCcAndAttachments を呼び出す。
     * sendTemplateEmail は呼び出されない。
     *
     * **Validates: Requirements 2.2, 2.3**
     */
    it('1枚の画像を添付した場合 sendEmailWithCcAndAttachments が呼び出される', async () => {
      const attachments = [{ id: 'drive-file-id-1', name: 'image1.jpg' }];

      const response = await request(app)
        .post('/api/sellers/test-seller-id/send-template-email')
        .send({
          templateId: 'follow-up',
          to: 'seller@example.com',
          subject: 'テスト件名',
          content: 'テスト本文',
          attachments,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // sendEmailWithCcAndAttachments が呼び出されたことを確認（バグ修正の確認）
      expect(mockSendEmailWithCcAndAttachments).toHaveBeenCalledTimes(1);
      // sendTemplateEmail は呼び出されていないことを確認
      expect(mockSendTemplateEmail).not.toHaveBeenCalled();
    });

    /**
     * Property: 任意の枚数（1〜5枚）の画像を添付した場合、
     * sendEmailWithCcAndAttachments が呼び出され、
     * Google Drive から各画像データが取得される。
     *
     * **Validates: Requirements 2.2, 2.3**
     */
    it('任意の枚数の画像を添付した場合 sendEmailWithCcAndAttachments が呼び出される', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 1〜5枚の画像リスト
          fc.array(
            fc.record({
              id: fc.string({ minLength: 5, maxLength: 20 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.constantFrom('follow-up', 'introduction', 'reminder', 'custom'),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          async (attachments, templateId, subject, content) => {
            mockSendEmailWithCcAndAttachments.mockReset();
            mockSendTemplateEmail.mockReset();
            mockGetFile.mockReset();
            mockSendEmailWithCcAndAttachments.mockResolvedValue({
              messageId: 'mock-attachment-message-id',
              sentAt: new Date(),
              success: true,
            });
            mockGetFile.mockResolvedValue(mockImageData);

            const response = await request(app)
              .post('/api/sellers/test-seller-id/send-template-email')
              .send({
                templateId,
                to: 'seller@example.com',
                subject,
                content,
                attachments,
              });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // sendEmailWithCcAndAttachments が呼び出されたことを確認
            expect(mockSendEmailWithCcAndAttachments).toHaveBeenCalledTimes(1);
            // sendTemplateEmail は呼び出されていないことを確認
            expect(mockSendTemplateEmail).not.toHaveBeenCalled();

            // Google Drive から各画像データが取得されたことを確認
            expect(mockGetFile).toHaveBeenCalledTimes(attachments.length);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: sendEmailWithCcAndAttachments に渡される attachments の数が
     * リクエストの attachments の数と一致する。
     *
     * **Validates: Requirements 2.3**
     */
    it('sendEmailWithCcAndAttachments に正しい数の添付ファイルが渡される', async () => {
      const attachments = [
        { id: 'drive-file-id-1', name: 'image1.jpg' },
        { id: 'drive-file-id-2', name: 'image2.png' },
        { id: 'drive-file-id-3', name: 'image3.gif' },
      ];

      const response = await request(app)
        .post('/api/sellers/test-seller-id/send-template-email')
        .send({
          templateId: 'follow-up',
          to: 'seller@example.com',
          subject: 'テスト件名',
          content: 'テスト本文',
          attachments,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // sendEmailWithCcAndAttachments に渡された引数を確認
      expect(mockSendEmailWithCcAndAttachments).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'seller@example.com',
          subject: 'テスト件名',
          attachments: expect.arrayContaining([
            expect.objectContaining({ filename: 'image1.jpg' }),
            expect.objectContaining({ filename: 'image2.png' }),
            expect.objectContaining({ filename: 'image3.gif' }),
          ]),
        })
      );

      // Google Drive から3枚分の画像データが取得されたことを確認
      expect(mockGetFile).toHaveBeenCalledTimes(3);
    });

    /**
     * Property: レスポンスに templateId が含まれる（添付ありの場合も同様）。
     *
     * **Validates: Requirements 2.1**
     */
    it('添付ありの場合もレスポンスに templateId が含まれる', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('follow-up', 'introduction', 'reminder'),
          async (templateId) => {
            mockSendEmailWithCcAndAttachments.mockReset();
            mockGetFile.mockReset();
            mockSendEmailWithCcAndAttachments.mockResolvedValue({
              messageId: 'mock-attachment-message-id',
              sentAt: new Date(),
              success: true,
            });
            mockGetFile.mockResolvedValue(mockImageData);

            const response = await request(app)
              .post('/api/sellers/test-seller-id/send-template-email')
              .send({
                templateId,
                to: 'seller@example.com',
                subject: 'テスト件名',
                content: 'テスト本文',
                attachments: [{ id: 'drive-file-id-1', name: 'image1.jpg' }],
              });

            expect(response.status).toBe(200);
            expect(response.body.templateId).toBe(templateId);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // =========================================================================
  // エラーハンドリング
  // =========================================================================
  describe('エラーハンドリング', () => {
    /**
     * Property: Google Drive からの画像取得に失敗した場合、500エラーを返す。
     */
    it('Google Drive からの画像取得に失敗した場合 500 エラーを返す', async () => {
      mockGetFile.mockRejectedValue(new Error('Google Drive API error'));

      const response = await request(app)
        .post('/api/sellers/test-seller-id/send-template-email')
        .send({
          templateId: 'follow-up',
          to: 'seller@example.com',
          subject: 'テスト件名',
          content: 'テスト本文',
          attachments: [{ id: 'drive-file-id-1', name: 'image1.jpg' }],
        });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('EMAIL_SEND_ERROR');
    });
  });
});
