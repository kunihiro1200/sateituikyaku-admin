// 買主リスト「●問合時ヒアリング」同期不具合修正 - Preservation property tests
// Property 2: Preservation - 他のフィールドの同期機能保持
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
//
// このテストは未修正・修正後ともに PASS することが期待される（既存動作の保全確認）

import * as fc from 'fast-check';
import { BuyerColumnMapper } from '../BuyerColumnMapper';
import { BuyerWriteService } from '../BuyerWriteService';
import { GoogleSheetsClient } from '../GoogleSheetsClient';

// ============================================================
// Preservation Property Tests
// ============================================================

describe('Preservation: 買主リスト「●問合時ヒアリング」同期不具合修正', () => {
  
  // ============================================================
  // Preservation 1: 他のフィールドの即時同期機能
  // ============================================================
  describe('Preservation 1: 他のフィールド（inquiry_hearing以外）の即時同期機能', () => {
    
    it('Property: name（●氏名・会社名）フィールドの更新がスプレッドシートに反映される', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            buyerNumber: fc.constantFrom('7294', '7295', '7296'),
            name: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async ({ buyerNumber, name }) => {
            // モックの設定
            const mockSheetsClient = {
              findRowByColumn: jest.fn().mockResolvedValue(2),
              readRange: jest.fn().mockResolvedValue([
                { '買主番号': buyerNumber, '●氏名・会社名': '旧名前' }
              ]),
              updateRowPartial: jest.fn().mockResolvedValue(undefined),
              clearHeaderCache: jest.fn(),
            } as unknown as GoogleSheetsClient;

            const columnMapper = new BuyerColumnMapper();
            const writeService = new BuyerWriteService(mockSheetsClient, columnMapper);

            // nameフィールドを更新
            const result = await writeService.updateFields(buyerNumber, { name });

            // アサーション
            expect(result.success).toBe(true);
            expect(mockSheetsClient.updateRowPartial).toHaveBeenCalledWith(
              2,
              expect.objectContaining({ '●氏名・会社名': name })
            );

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('Property: viewing_date（●内覧日(最新））フィールドの更新がスプレッドシートに反映される', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            buyerNumber: fc.constantFrom('7294', '7295', '7296'),
            viewingDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
              .map(d => d.toISOString().split('T')[0]),
          }),
          async ({ buyerNumber, viewingDate }) => {
            // モックの設定
            const mockSheetsClient = {
              findRowByColumn: jest.fn().mockResolvedValue(2),
              readRange: jest.fn().mockResolvedValue([
                { '買主番号': buyerNumber, '●内覧日(最新）': '2024-01-01' }
              ]),
              updateRowPartial: jest.fn().mockResolvedValue(undefined),
              clearHeaderCache: jest.fn(),
            } as unknown as GoogleSheetsClient;

            const columnMapper = new BuyerColumnMapper();
            const writeService = new BuyerWriteService(mockSheetsClient, columnMapper);

            // viewing_dateフィールドを更新
            const result = await writeService.updateFields(buyerNumber, { viewing_date: viewingDate });

            // アサーション
            expect(result.success).toBe(true);
            expect(mockSheetsClient.updateRowPartial).toHaveBeenCalled();

            // 日付フォーマットの確認（YYYY/MM/DD形式）
            const callArgs = (mockSheetsClient.updateRowPartial as jest.Mock).mock.calls[0];
            const updatedRow = callArgs[1];
            expect(updatedRow['●内覧日(最新）']).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('Property: phone_number（●電話番号）フィールドの更新がスプレッドシートに反映される', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            buyerNumber: fc.constantFrom('7294', '7295', '7296'),
            phoneNumber: fc.constantFrom('09012345678', '08011112222', '07099998888'),
          }),
          async ({ buyerNumber, phoneNumber }) => {
            // モックの設定
            const mockSheetsClient = {
              findRowByColumn: jest.fn().mockResolvedValue(2),
              readRange: jest.fn().mockResolvedValue([
                { '買主番号': buyerNumber, '●電話番号\n（ハイフン不要）': '09012345678' }
              ]),
              updateRowPartial: jest.fn().mockResolvedValue(undefined),
              clearHeaderCache: jest.fn(),
            } as unknown as GoogleSheetsClient;

            const columnMapper = new BuyerColumnMapper();
            const writeService = new BuyerWriteService(mockSheetsClient, columnMapper);

            // phone_numberフィールドを更新
            const result = await writeService.updateFields(buyerNumber, { phone_number: phoneNumber });

            // アサーション
            expect(result.success).toBe(true);
            expect(mockSheetsClient.updateRowPartial).toHaveBeenCalledWith(
              2,
              expect.objectContaining({ '●電話番号\n（ハイフン不要）': phoneNumber })
            );

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // ============================================================
  // Preservation 2: updateRowPartialによる数式保護機能
  // ============================================================
  describe('Preservation 2: updateRowPartialによる数式保護機能', () => {
    
    it('updateRowPartialは指定されたカラムのみを更新し、他のカラムは変更しない', async () => {
      // モックの設定
      const mockSheetsClient = {
        findRowByColumn: jest.fn().mockResolvedValue(2),
        readRange: jest.fn().mockResolvedValue([
          { 
            '買主番号': '7294', 
            '●氏名・会社名': '旧名前',
            '●内覧日(最新）': '2024-01-01',
            '●希望時期': 'すぐ'
          }
        ]),
        updateRowPartial: jest.fn().mockResolvedValue(undefined),
        clearHeaderCache: jest.fn(),
      } as unknown as GoogleSheetsClient;

      const columnMapper = new BuyerColumnMapper();
      const writeService = new BuyerWriteService(mockSheetsClient, columnMapper);

      // nameフィールドのみを更新
      await writeService.updateFields('7294', { name: '新名前' });

      // updateRowPartialが呼び出されたことを確認
      expect(mockSheetsClient.updateRowPartial).toHaveBeenCalledTimes(1);

      // 更新されたカラムがnameのみであることを確認
      const callArgs = (mockSheetsClient.updateRowPartial as jest.Mock).mock.calls[0];
      const updatedRow = callArgs[1];
      
      expect(updatedRow).toHaveProperty('●氏名・会社名', '新名前');
      expect(updatedRow).not.toHaveProperty('●内覧日(最新）');
      expect(updatedRow).not.toHaveProperty('●希望時期');
    });

    it('Property: 複数フィールドを更新しても、指定されたフィールドのみが更新される', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            buyerNumber: fc.constantFrom('7294', '7295', '7296'),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            phoneNumber: fc.constantFrom('09012345678', '08011112222'),
          }),
          async ({ buyerNumber, name, phoneNumber }) => {
            // モックの設定
            const mockSheetsClient = {
              findRowByColumn: jest.fn().mockResolvedValue(2),
              readRange: jest.fn().mockResolvedValue([
                { 
                  '買主番号': buyerNumber, 
                  '●氏名・会社名': '旧名前',
                  '●電話番号\n（ハイフン不要）': '09012345678',
                  '●内覧日(最新）': '2024-01-01'
                }
              ]),
              updateRowPartial: jest.fn().mockResolvedValue(undefined),
              clearHeaderCache: jest.fn(),
            } as unknown as GoogleSheetsClient;

            const columnMapper = new BuyerColumnMapper();
            const writeService = new BuyerWriteService(mockSheetsClient, columnMapper);

            // nameとphone_numberフィールドを更新
            await writeService.updateFields(buyerNumber, { 
              name, 
              phone_number: phoneNumber 
            });

            // updateRowPartialが呼び出されたことを確認
            expect(mockSheetsClient.updateRowPartial).toHaveBeenCalledTimes(1);

            // 更新されたカラムがnameとphone_numberのみであることを確認
            const callArgs = (mockSheetsClient.updateRowPartial as jest.Mock).mock.calls[0];
            const updatedRow = callArgs[1];
            
            expect(updatedRow).toHaveProperty('●氏名・会社名', name);
            expect(updatedRow).toHaveProperty('●電話番号\n（ハイフン不要）', phoneNumber);
            expect(updatedRow).not.toHaveProperty('●内覧日(最新）');

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // ============================================================
  // Preservation 3: 他のHTMLフィールドのHTMLストリップ処理
  // ============================================================
  describe('Preservation 3: 他のHTMLフィールド（viewing_result_follow_up）のHTMLストリップ処理', () => {
    
    it('Property: viewing_result_follow_up（★内覧結果・後続対応）のHTMLタグがプレーンテキストに変換される', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            buyerNumber: fc.constantFrom('7294', '7295', '7296'),
            htmlContent: fc.constantFrom(
              '<p>内覧結果：良好</p>',
              '<p>後続対応：<br>電話連絡予定</p>',
              '<p><strong>重要</strong>：再内覧希望</p>'
            ),
          }),
          async ({ buyerNumber, htmlContent }) => {
            // モックの設定
            const mockSheetsClient = {
              findRowByColumn: jest.fn().mockResolvedValue(2),
              readRange: jest.fn().mockResolvedValue([
                { '買主番号': buyerNumber, '★内覧結果・後続対応': '' }
              ]),
              updateRowPartial: jest.fn().mockResolvedValue(undefined),
              clearHeaderCache: jest.fn(),
            } as unknown as GoogleSheetsClient;

            const columnMapper = new BuyerColumnMapper();
            const writeService = new BuyerWriteService(mockSheetsClient, columnMapper);

            // viewing_result_follow_upフィールドを更新
            await writeService.updateFields(buyerNumber, { 
              viewing_result_follow_up: htmlContent 
            });

            // updateRowPartialが呼び出されたことを確認
            expect(mockSheetsClient.updateRowPartial).toHaveBeenCalledTimes(1);

            // HTMLタグが除去されていることを確認
            const callArgs = (mockSheetsClient.updateRowPartial as jest.Mock).mock.calls[0];
            const updatedRow = callArgs[1];
            const strippedValue = updatedRow['★内覧結果・後続対応'];
            
            expect(strippedValue).not.toContain('<p>');
            expect(strippedValue).not.toContain('</p>');
            expect(strippedValue).not.toContain('<br>');
            expect(strippedValue).not.toContain('<strong>');
            expect(strippedValue).not.toContain('</strong>');

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('HTMLタグが正しく除去される', () => {
      const columnMapper = new BuyerColumnMapper();
      
      // HTMLタグを含むテストケース
      const testCases = [
        { input: '<p>テスト</p>', field: 'viewing_result_follow_up', column: '★内覧結果・後続対応', expected: 'テスト' },
        { input: '<p>改行<br>テスト</p>', field: 'viewing_result_follow_up', column: '★内覧結果・後続対応', expected: '改行\nテスト' },
        { input: '<strong>強調</strong>', field: 'viewing_result_follow_up', column: '★内覧結果・後続対応', expected: '強調' },
      ];

      testCases.forEach(({ input, field, column, expected }) => {
        const result = columnMapper.mapDatabaseToSpreadsheet({ 
          [field]: input 
        });
        expect(result[column]).toBe(expected);
      });
    });
  });

  // ============================================================
  // Preservation 4: BuyerColumnMapperのマッピング定義
  // ============================================================
  describe('Preservation 4: BuyerColumnMapperのマッピング定義', () => {
    
    it('databaseToSpreadsheetマッピングに主要フィールドが定義されている', () => {
      const columnMapper = new BuyerColumnMapper();
      
      // 主要フィールドのマッピングを確認
      expect(columnMapper.getSpreadsheetColumnName('buyer_number')).toBe('買主番号');
      expect(columnMapper.getSpreadsheetColumnName('name')).toBe('●氏名・会社名');
      expect(columnMapper.getSpreadsheetColumnName('viewing_date')).toBe('●内覧日(最新）');
      expect(columnMapper.getSpreadsheetColumnName('phone_number')).toBe('●電話番号\n（ハイフン不要）');
      expect(columnMapper.getSpreadsheetColumnName('viewing_result_follow_up')).toBe('★内覧結果・後続対応');
    });

    it('inquiry_hearingのマッピングが定義されている', () => {
      const columnMapper = new BuyerColumnMapper();
      
      // inquiry_hearingのマッピングを確認
      expect(columnMapper.getSpreadsheetColumnName('inquiry_hearing')).toBe('●問合時ヒアリング');
    });

    it('HTMLフィールドのリストにinquiry_hearing、viewing_result_follow_upが含まれている', () => {
      const columnMapper = new BuyerColumnMapper();
      
      // HTMLタグを含むテストデータ
      const testData = {
        inquiry_hearing: '<p>問合時ヒアリング</p>',
        viewing_result_follow_up: '<p>内覧結果</p>',
      };

      const result = columnMapper.mapDatabaseToSpreadsheet(testData);

      // HTMLタグが除去されていることを確認
      expect(result['●問合時ヒアリング']).toBe('問合時ヒアリング');
      expect(result['★内覧結果・後続対応']).toBe('内覧結果');
    });
  });
});
