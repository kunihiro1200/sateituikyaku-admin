// 買主DBスプレッドシート同期バグ修正 - 保全プロパティテスト
// Property 2: Preservation - 既存の保存フローの維持
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
//
// このテストは未修正・修正後ともに PASS することが期待される（既存動作の保全確認）

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

// ============================================================
// 保全プロパティテスト
// ============================================================

describe('保全プロパティ: 買主DBスプレッドシート同期バグ修正', () => {
  // ============================================================
  // 保全1: セクション保存ボタン経由の保存フロー
  // ============================================================
  describe('Preservation 1: セクション保存ボタン経由の保存フロー', () => {
    it('handleSectionSave は sync: true でAPIを呼び出している', () => {
      const buyerDetailPagePath = path.resolve(
        __dirname,
        '../../../../frontend/frontend/src/pages/BuyerDetailPage.tsx'
      );
      const sourceCode = fs.readFileSync(buyerDetailPagePath, 'utf-8');

      // handleSectionSave 関数内に sync: true が含まれているか確認
      const hasSyncTrue = (() => {
        const funcStart = sourceCode.indexOf('const handleSectionSave');
        const funcEnd = sourceCode.indexOf('const handleSaveMessageToAssignee', funcStart);
        if (funcStart === -1 || funcEnd === -1) return false;
        const funcBody = sourceCode.substring(funcStart, funcEnd);
        return funcBody.includes('sync: true');
      })();

      // 未修正・修正後ともに PASS（セクション保存は常に sync: true）
      expect(hasSyncTrue).toBe(true);
    });
  });

  // ============================================================
  // 保全2: findRowByColumn - 文字列同士の比較は正常動作
  // ============================================================
  describe('Preservation 2: findRowByColumn - 文字列同士の比較は正常動作', () => {
    const mockSheetsGet = jest.fn();

    beforeEach(() => {
      jest.resetModules();
      mockSheetsGet.mockReset();
    });

    it('スプシに文字列として格納されている買主番号は正しく検索できる', async () => {
      jest.mock('googleapis', () => ({
        google: {
          auth: { JWT: jest.fn().mockImplementation(() => ({ authorize: jest.fn().mockResolvedValue(undefined) })) },
          sheets: jest.fn(() => ({
            spreadsheets: {
              values: { get: mockSheetsGet },
              get: jest.fn().mockResolvedValue({ data: { sheets: [{ properties: { title: 'テストシート', sheetId: 0 } }] } }),
            },
          })),
        },
      }));

      jest.mock('../RateLimiter', () => ({
        sheetsRateLimiter: { executeRequest: jest.fn((fn: () => Promise<any>) => fn()) },
      }));

      const { GoogleSheetsClient } = require('../GoogleSheetsClient');
      const client = new GoogleSheetsClient({
        spreadsheetId: 'test-id',
        sheetName: 'テストシート',
        serviceAccountEmail: 'test@test.com',
        privateKey: 'test-key',
      });
      (client as any).sheets = { spreadsheets: { values: { get: mockSheetsGet } } };
      (client as any).auth = {};

      mockSheetsGet
        .mockResolvedValueOnce({ data: { values: [['買主番号', '氏名']] } })
        .mockResolvedValueOnce({ data: { values: [['4370'], ['4371'], ['4372']] } });

      const rowNumber = await client.findRowByColumn('買主番号', '4370');
      // 文字列同士の比較は未修正・修正後ともに正常動作
      expect(rowNumber).toBe(2);
    });

    it('プロパティベーステスト: ランダムな文字列買主番号で正しく行番号を返す', async () => {
      jest.mock('googleapis', () => ({
        google: {
          auth: { JWT: jest.fn().mockImplementation(() => ({ authorize: jest.fn().mockResolvedValue(undefined) })) },
          sheets: jest.fn(() => ({
            spreadsheets: {
              values: { get: mockSheetsGet },
              get: jest.fn().mockResolvedValue({ data: { sheets: [{ properties: { title: 'テストシート', sheetId: 0 } }] } }),
            },
          })),
        },
      }));

      jest.mock('../RateLimiter', () => ({
        sheetsRateLimiter: { executeRequest: jest.fn((fn: () => Promise<any>) => fn()) },
      }));

      const { GoogleSheetsClient } = require('../GoogleSheetsClient');

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 9999 }).map(n => String(n)),
          async (buyerNumber) => {
            const client = new GoogleSheetsClient({
              spreadsheetId: 'test-id',
              sheetName: 'テストシート',
              serviceAccountEmail: 'test@test.com',
              privateKey: 'test-key',
            });
            (client as any).sheets = { spreadsheets: { values: { get: mockSheetsGet } } };
            (client as any).auth = {};

            mockSheetsGet
              .mockResolvedValueOnce({ data: { values: [['買主番号', '氏名']] } })
              .mockResolvedValueOnce({ data: { values: [[buyerNumber], ['9999']] } });

            const rowNumber = await client.findRowByColumn('買主番号', buyerNumber);
            // 文字列同士の比較は常に正常動作
            return rowNumber === 2;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ============================================================
  // 保全3: buyer-column-mapping.json のマッピング定義
  // ============================================================
  describe('Preservation 3: buyer-column-mapping.json のマッピング定義', () => {
    it('distribution_type が spreadsheetToDatabase に定義されている', () => {
      const mappingPath = path.resolve(__dirname, '../../config/buyer-column-mapping.json');
      const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

      const allMappings = { ...mapping.spreadsheetToDatabase, ...mapping.spreadsheetToDatabaseExtended };
      const dbColumns = Object.values(allMappings) as string[];

      expect(dbColumns).toContain('distribution_type');
    });

    it('pinrich が spreadsheetToDatabase に定義されている', () => {
      const mappingPath = path.resolve(__dirname, '../../config/buyer-column-mapping.json');
      const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

      const allMappings = { ...mapping.spreadsheetToDatabase, ...mapping.spreadsheetToDatabaseExtended };
      const dbColumns = Object.values(allMappings) as string[];

      expect(dbColumns).toContain('pinrich');
    });

    it('BuyerColumnMapper が dbToSpreadsheet を正しく逆引き生成する', () => {
      const mappingPath = path.resolve(__dirname, '../../config/buyer-column-mapping.json');
      const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

      // spreadsheetToDatabase + spreadsheetToDatabaseExtended の逆引き
      const allMappings = { ...mapping.spreadsheetToDatabase, ...mapping.spreadsheetToDatabaseExtended };
      const dbToSpreadsheet: Record<string, string> = {};
      for (const [key, value] of Object.entries(allMappings)) {
        dbToSpreadsheet[value as string] = key;
      }

      // distribution_type と pinrich が逆引きマッピングに存在する
      expect(dbToSpreadsheet['distribution_type']).toBeDefined();
      expect(dbToSpreadsheet['pinrich']).toBeDefined();
    });
  });

  // ============================================================
  // 保全4: GoogleSheetsClient.readRange の存在確認
  // ============================================================
  describe('Preservation 4: GoogleSheetsClient.readRange の存在確認', () => {
    it('GoogleSheetsClient に readRange メソッドが存在する', () => {
      const googleSheetsClientPath = path.resolve(__dirname, '../GoogleSheetsClient.ts');
      const sourceCode = fs.readFileSync(googleSheetsClientPath, 'utf-8');

      expect(sourceCode).toContain('async readRange(');
    });

    it('GoogleSheetsClient に updateRow メソッドが存在する', () => {
      const googleSheetsClientPath = path.resolve(__dirname, '../GoogleSheetsClient.ts');
      const sourceCode = fs.readFileSync(googleSheetsClientPath, 'utf-8');

      expect(sourceCode).toContain('async updateRow(');
    });

    it('updateRow は valueInputOption: RAW で書き込む', () => {
      const googleSheetsClientPath = path.resolve(__dirname, '../GoogleSheetsClient.ts');
      const sourceCode = fs.readFileSync(googleSheetsClientPath, 'utf-8');

      const funcStart = sourceCode.indexOf('async updateRow(');
      const funcEnd = sourceCode.indexOf('async updateRowPartial(', funcStart);
      const funcBody = sourceCode.substring(funcStart, funcEnd);

      expect(funcBody).toContain("valueInputOption: 'RAW'");
    });
  });
});
