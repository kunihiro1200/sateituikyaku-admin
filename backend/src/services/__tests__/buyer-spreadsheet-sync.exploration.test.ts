// 買主DBスプレッドシート同期バグ修正 - バグ条件探索テスト
// Property 1: Bug Condition - インライン編集フィールドのスプシ同期スキップ
// **Validates: Requirements 1.1, 1.2**
//
// このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
// DO NOT attempt to fix the test or the code when it fails
// GOAL: バグが存在することを示すカウンターサンプルを発見する

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// バグ条件探索テスト
// ============================================================

describe('バグ条件探索: 買主DBスプレッドシート同期バグ', () => {
  // ============================================================
  // バグ条件1: handleInlineFieldSave が sync: false で呼ばれる
  // ============================================================
  describe('Bug Condition 1: handleInlineFieldSave が sync: false で呼ばれる', () => {
    const buyerDetailPagePath = path.resolve(
      __dirname,
      '../../../../frontend/frontend/src/pages/BuyerDetailPage.tsx'
    );

    let sourceCode: string;

    beforeAll(() => {
      sourceCode = fs.readFileSync(buyerDetailPagePath, 'utf-8');
    });

    it('BuyerDetailPage.tsx が存在する', () => {
      expect(fs.existsSync(buyerDetailPagePath)).toBe(true);
    });

    it('Bug Condition: handleInlineFieldSave が sync: false でAPIを呼び出している', () => {
      // バグ条件: handleInlineFieldSave 内で { sync: false } が使われている
      // 修正後は { sync: true } に変更されるため、このテストは修正後に FAIL する
      // 未修正コードでは PASS する（バグが存在することを確認）
      //
      // カウンターサンプル:
      // handleInlineFieldSave('distribution_type', '配信あり') を呼び出すと、
      // buyerApi.update() が { sync: false } で呼ばれ、スプシ同期がスキップされる

      // handleInlineFieldSave 関数内に sync: false が含まれているか確認
      const hasSyncFalse = sourceCode.includes("{ sync: false }");
      
      // 未修正コードでは sync: false が含まれているため PASS
      // 修正後は sync: true に変更されるため FAIL → バグが修正されたことを確認
      expect(hasSyncFalse).toBe(false); // ← 未修正コードでは FAIL（バグ条件のカウンターサンプル）
    });

    it('Bug Condition: handleInlineFieldSave 内のコメントにスプシ同期スキップが明記されている', () => {
      // バグ条件の証拠: コメントに「DBのみ保存（スプシ同期は保存ボタン押下時）」と明記されている
      // これはインライン編集でスプシ同期が意図的にスキップされていることを示す
      const hasSkipComment = sourceCode.includes('DBのみ保存') || 
                              sourceCode.includes('スプシ同期は保存ボタン押下時');
      
      // 未修正コードではコメントが存在するため PASS
      // 修正後はコメントが変更されるため FAIL → バグが修正されたことを確認
      expect(hasSkipComment).toBe(false); // ← 未修正コードでは FAIL（バグ条件のカウンターサンプル）
    });
  });

  // ============================================================
  // バグ条件2: findRowByColumn の型不一致
  // ============================================================
  describe('Bug Condition 2: findRowByColumn が文字列と数値の型不一致で null を返す', () => {
    // GoogleSheetsClient の findRowByColumn を直接テスト
    // モックを使用してスプシに数値が格納されているケースをシミュレート

    // GoogleSheetsClient のモック設定
    const mockSheetsGet = jest.fn();
    
    jest.mock('googleapis', () => ({
      google: {
        auth: {
          JWT: jest.fn().mockImplementation(() => ({
            authorize: jest.fn().mockResolvedValue(undefined),
          })),
        },
        sheets: jest.fn(() => ({
          spreadsheets: {
            values: {
              get: mockSheetsGet,
            },
          },
        })),
      },
    }));

    jest.mock('../RateLimiter', () => ({
      sheetsRateLimiter: {
        executeRequest: jest.fn((fn: () => Promise<any>) => fn()),
      },
    }));

    it('Bug Condition: スプシに数値 4370 が格納されている場合、文字列 "4370" で検索すると null が返る', async () => {
      // バグ条件: findRowByColumn が === で厳密等価比較するため、
      // スプシの数値 4370 と文字列 "4370" が一致しない
      //
      // カウンターサンプル:
      // findRowByColumn("買主番号", "4370") を呼び出すと、
      // スプシに数値 4370 が格納されている場合に null が返る

      const { GoogleSheetsClient } = require('../GoogleSheetsClient');
      
      const client = new GoogleSheetsClient({
        spreadsheetId: 'test-spreadsheet-id',
        sheetName: 'テストシート',
        serviceAccountEmail: 'test@test.com',
        privateKey: 'test-key',
      });

      // 認証済み状態をシミュレート
      (client as any).sheets = {
        spreadsheets: {
          values: {
            get: mockSheetsGet,
          },
        },
      };
      (client as any).auth = {};

      // ヘッダー行のモック
      mockSheetsGet
        .mockResolvedValueOnce({
          data: { values: [['買主番号', '氏名']] },
        })
        // 買主番号列のデータ（数値として格納）
        .mockResolvedValueOnce({
          data: { values: [[4370], [4371], [4372]] }, // 数値として格納
        });

      // 文字列 "4370" で検索
      const rowNumber = await client.findRowByColumn('買主番号', '4370');

      // バグ条件: 数値 4370 と文字列 "4370" が === で一致しないため null が返る
      // 修正後は String() 変換により正しく行番号が返る
      expect(rowNumber).not.toBeNull(); // ← 未修正コードでは FAIL（バグ条件のカウンターサンプル）
      expect(rowNumber).toBe(2); // ← 未修正コードでは FAIL
    });

    it('Bug Condition: スプシに文字列 "4370" が格納されている場合は正しく行番号が返る（バグなし）', async () => {
      // 比較: 文字列同士の比較は正常に動作する（バグなし）
      const { GoogleSheetsClient } = require('../GoogleSheetsClient');
      
      const client = new GoogleSheetsClient({
        spreadsheetId: 'test-spreadsheet-id',
        sheetName: 'テストシート',
        serviceAccountEmail: 'test@test.com',
        privateKey: 'test-key',
      });

      (client as any).sheets = {
        spreadsheets: {
          values: {
            get: mockSheetsGet,
          },
        },
      };
      (client as any).auth = {};

      // ヘッダー行のモック
      mockSheetsGet
        .mockResolvedValueOnce({
          data: { values: [['買主番号', '氏名']] },
        })
        // 買主番号列のデータ（文字列として格納）
        .mockResolvedValueOnce({
          data: { values: [['4370'], ['4371'], ['4372']] }, // 文字列として格納
        });

      // 文字列 "4370" で検索
      const rowNumber = await client.findRowByColumn('買主番号', '4370');

      // 文字列同士の比較は正常に動作する
      expect(rowNumber).toBe(2); // ← 未修正・修正後ともに PASS
    });
  });

  // ============================================================
  // バグ条件サマリー
  // ============================================================
  describe('バグ条件サマリー', () => {
    it('根本原因1: handleInlineFieldSave が sync: false でAPIを呼び出している', () => {
      const buyerDetailPagePath = path.resolve(
        __dirname,
        '../../../../frontend/frontend/src/pages/BuyerDetailPage.tsx'
      );
      const sourceCode = fs.readFileSync(buyerDetailPagePath, 'utf-8');
      
      // handleInlineFieldSave 関数内に sync: false が含まれているか確認
      // 未修正コードでは true（バグあり）、修正後は false（バグなし）
      const hasSyncFalseInInlineHandler = (() => {
        // handleInlineFieldSave 関数の範囲を抽出
        const funcStart = sourceCode.indexOf('const handleInlineFieldSave');
        const funcEnd = sourceCode.indexOf('const handleFieldChange', funcStart);
        if (funcStart === -1 || funcEnd === -1) return false;
        const funcBody = sourceCode.substring(funcStart, funcEnd);
        return funcBody.includes('sync: false');
      })();
      
      // カウンターサンプル: handleInlineFieldSave 内に sync: false が存在する
      // 未修正コードでは FAIL（バグが存在することを証明）
      expect(hasSyncFalseInInlineHandler).toBe(false);
    });

    it('根本原因2: findRowByColumn が === で厳密等価比較している', () => {
      const googleSheetsClientPath = path.resolve(
        __dirname,
        '../GoogleSheetsClient.ts'
      );
      const sourceCode = fs.readFileSync(googleSheetsClientPath, 'utf-8');
      
      // findRowByColumn 関数内に === value が含まれているか確認
      // 未修正コードでは values[i][0] === value が使われている
      const hasSrictEqualInFindRow = (() => {
        const funcStart = sourceCode.indexOf('async findRowByColumn');
        const funcEnd = sourceCode.indexOf('private numberToColumnLetter', funcStart);
        if (funcStart === -1 || funcEnd === -1) return false;
        const funcBody = sourceCode.substring(funcStart, funcEnd);
        // String() 変換なしの === 比較が存在するか
        return funcBody.includes('values[i][0] === value') && 
               !funcBody.includes('String(values[i][0]) === String(value)');
      })();
      
      // カウンターサンプル: findRowByColumn 内に型変換なしの === 比較が存在する
      // 未修正コードでは FAIL（バグが存在することを証明）
      expect(hasSrictEqualInFindRow).toBe(false);
    });
  });
});
