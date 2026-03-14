/**
 * 保全プロパティテスト: Gmail テンプレート選択バグ修正
 *
 * このテストはスプレッドシートアクセスが成功するケース（バグ条件が成立しない場合）の
 * 動作を確認するためのものです。修正前後で同じ動作が保持されることを検証します。
 *
 * 未修正コードでも PASS することを確認し、ベースライン動作を記録します。
 * 修正後も引き続き PASS することでリグレッションがないことを確認します。
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 */

import { EmailTemplateService } from '../EmailTemplateService';
import { GoogleSheetsClient } from '../GoogleSheetsClient';

// GoogleSheetsClient をモック
jest.mock('../GoogleSheetsClient');

const MockedGoogleSheetsClient = GoogleSheetsClient as jest.MockedClass<typeof GoogleSheetsClient>;

/**
 * スプレッドシートの「テンプレート」シートのモックデータ
 * C列=区分, D列=種別（タイトル）, E列=件名, F列=本文
 * 1行目はヘッダー
 */
const MOCK_SPREADSHEET_ROWS = [
  ['区分', '種別', '件名', '本文'],                                    // ヘッダー行
  ['買主', '物件紹介', '物件のご紹介', '{{buyerName}} 様\n物件をご紹介します。'],
  ['買主', '内覧案内', '内覧のご案内', '{{buyerName}} 様\n内覧のご案内です。'],
  ['売主', '査定報告', '査定結果のご報告', '{{name}} 様\n査定結果をご報告します。'], // 売主区分（除外される）
  ['買主', '契約確認', '契約内容のご確認', '{{buyerName}} 様\n契約内容をご確認ください。'],
];

describe('保全プロパティテスト: EmailTemplateService.getTemplates() の正常動作', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // スプレッドシートアクセスが成功するようにモック
    const mockSheetsInstance = {
      spreadsheets: {
        values: {
          get: jest.fn().mockResolvedValue({
            data: {
              values: MOCK_SPREADSHEET_ROWS,
            },
          }),
        },
      },
    };

    MockedGoogleSheetsClient.mockImplementation(() => ({
      authenticate: jest.fn().mockResolvedValue(undefined),
      sheets: mockSheetsInstance,
    } as any));
  });

  describe('テストシナリオ1: スプレッドシートアクセスが成功する場合', () => {
    it('getTemplates() は EmailTemplate[] を返すべきである', async () => {
      const service = new EmailTemplateService();

      const result = await service.getTemplates();

      // 配列が返ること
      expect(Array.isArray(result)).toBe(true);
      // 「買主」区分のテンプレートのみ返ること（売主区分は除外）
      expect(result.length).toBe(3); // 買主区分は3件
    });
  });

  describe('テストシナリオ2: 返却される EmailTemplate オブジェクトの構造', () => {
    it('各テンプレートは id・name・description・subject・body を持つべきである', async () => {
      const service = new EmailTemplateService();

      const result = await service.getTemplates();

      expect(result.length).toBeGreaterThan(0);

      // 全テンプレートが必須フィールドを持つことを確認
      for (const template of result) {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('subject');
        expect(template).toHaveProperty('body');

        // 各フィールドが文字列であること
        expect(typeof template.id).toBe('string');
        expect(typeof template.name).toBe('string');
        expect(typeof template.description).toBe('string');
        expect(typeof template.subject).toBe('string');
        expect(typeof template.body).toBe('string');

        // id が空でないこと
        expect(template.id.length).toBeGreaterThan(0);
        // name が空でないこと（区分が「買主」かつ種別が空の行は除外される）
        expect(template.name.length).toBeGreaterThan(0);
      }
    });

    it('テンプレートの内容がスプレッドシートのデータと一致すること', async () => {
      const service = new EmailTemplateService();

      const result = await service.getTemplates();

      // 最初のテンプレートを確認
      const firstTemplate = result[0];
      expect(firstTemplate.name).toBe('物件紹介');
      expect(firstTemplate.description).toBe('物件紹介');
      expect(firstTemplate.subject).toBe('物件のご紹介');
      expect(firstTemplate.body).toBe('{{buyerName}} 様\n物件をご紹介します。');
    });
  });
});
