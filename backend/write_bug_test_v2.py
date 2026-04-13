#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
バグ条件探索テストファイル（v2）を UTF-8 で書き込むスクリプト
スプレッドシートから数値型の値が返ってくる場合も含めてテストする
"""

content = '''/**
 * バグ条件探索テスト - 買主番号採番の文字列連結バグ
 *
 * **Feature: buyer-number-generation-bug, Property 1: Bug Condition**
 * **Validates: Requirements 1.1, 1.2**
 *
 * ⚠️ CRITICAL: このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示す反例を発見する
 *
 * バグの概要:
 * 採番スプレッドシートのセルから現在の最大番号（例: 7358）を取得し、
 * +1 した値（7359）を返すべきところ、文字列連結により "73581" が返される。
 *
 * 調査結果:
 * BuyerNumberSpreadsheetClient.getNextBuyerNumber() のコードは
 * parseInt(String(rawValue), 10) + 1 を正しく実行しているが、
 * 実際のスプレッドシートから返ってくる値の型（数値型 vs 文字列型）によって
 * 動作が異なる可能性がある。
 *
 * 特に、Google Sheets API が valueRenderOption を指定しない場合、
 * 数値セルは数値型として返ってくる可能性があり、
 * TypeScript の型定義 string[][] と実際の型が乖離している可能性がある。
 *
 * テストアサーション:
 * result === String(parseInt(String(rawValue), 10) + 1) を満たすこと
 */

import { BuyerNumberSpreadsheetClient } from '../BuyerNumberSpreadsheetClient';
import { GoogleSheetsClient } from '../GoogleSheetsClient';

// GoogleSheetsClient をモックする
jest.mock('../GoogleSheetsClient');
jest.mock('../RateLimiter', () => ({
  sheetsRateLimiter: {
    executeRequest: jest.fn((fn: () => Promise<any>) => fn()),
  },
}));

/**
 * バグ条件の判定関数
 *
 * バグ条件: getNextBuyerNumber() の結果が数値加算ではなく文字列連結になっている
 * 正しい動作: String(parseInt(String(rawValue), 10) + 1)
 */
function isBugCondition(rawValue: string | number, result: string): boolean {
  const expected = String(parseInt(String(rawValue), 10) + 1);
  return result !== expected;
}

/**
 * モック GoogleSheetsClient を作成するヘルパー
 * @param rawValue スプレッドシートのセルから返す値（文字列型または数値型）
 */
function createMockSheetsClient(rawValue: string | number): jest.Mocked<GoogleSheetsClient> {
  const mockClient = new GoogleSheetsClient({
    spreadsheetId: 'test-spreadsheet-id',
    sheetName: 'test-sheet',
  }) as jest.Mocked<GoogleSheetsClient>;

  // readRawRange が rawValue を返すようにモック
  // 実際のGoogle Sheets APIは数値セルに対して数値型を返す可能性がある
  mockClient.readRawRange = jest.fn().mockResolvedValue([[rawValue]]);

  return mockClient;
}

describe('Property 1: Bug Condition - 買主番号採番の文字列連結バグ', () => {
  describe('文字列型の rawValue（writeRawCell で書き込んだ後の状態）', () => {
    /**
     * テストケース1: rawValue = "7358"（文字列型）のとき "7359" を返すか確認
     *
     * 文字列連結バグがある場合: "73581" が返される
     * 正しい動作: "7359" が返される
     *
     * **Validates: Requirements 1.1, 1.2**
     */
    it('テスト1: rawValue="7358"（文字列型）のとき getNextBuyerNumber() が "7359" を返す（文字列連結なら "73581" になる）', async () => {
      const rawValue = '7358';
      const mockClient = createMockSheetsClient(rawValue);
      const client = new BuyerNumberSpreadsheetClient(mockClient, 'B2');

      const result = await client.getNextBuyerNumber();

      console.log(`rawValue="${rawValue}"（型: ${typeof rawValue}）→ result="${result}"`);
      console.log(`期待値: "7359", 実際値: "${result}"`);
      console.log(`バグ条件（文字列連結）: ${isBugCondition(rawValue, result) ? 'YES（バグあり）' : 'NO（正常）'}`);

      // ⚠️ 未修正コードでは "73581" が返されるため FAIL する（これが正しい）
      // ✅ 修正後は "7359" が返されるため PASS する
      expect(result).toBe('7359');
    });

    /**
     * テストケース2: rawValue = "1"（文字列型）のとき "2" を返すか確認
     *
     * **Validates: Requirements 1.1, 1.2**
     */
    it('テスト2: rawValue="1"（文字列型）のとき getNextBuyerNumber() が "2" を返す（文字列連結なら "11" になる）', async () => {
      const rawValue = '1';
      const mockClient = createMockSheetsClient(rawValue);
      const client = new BuyerNumberSpreadsheetClient(mockClient, 'B2');

      const result = await client.getNextBuyerNumber();

      console.log(`rawValue="${rawValue}"（型: ${typeof rawValue}）→ result="${result}"`);
      console.log(`期待値: "2", 実際値: "${result}"`);
      console.log(`バグ条件（文字列連結）: ${isBugCondition(rawValue, result) ? 'YES（バグあり）' : 'NO（正常）'}`);

      expect(result).toBe('2');
    });

    /**
     * テストケース3: rawValue = "9999"（文字列型）のとき "10000" を返すか確認（桁上がりのエッジケース）
     *
     * **Validates: Requirements 1.1, 1.2**
     */
    it('テスト3: rawValue="9999"（文字列型）のとき getNextBuyerNumber() が "10000" を返す（桁上がりのエッジケース）', async () => {
      const rawValue = '9999';
      const mockClient = createMockSheetsClient(rawValue);
      const client = new BuyerNumberSpreadsheetClient(mockClient, 'B2');

      const result = await client.getNextBuyerNumber();

      console.log(`rawValue="${rawValue}"（型: ${typeof rawValue}）→ result="${result}"`);
      console.log(`期待値: "10000", 実際値: "${result}"`);
      console.log(`バグ条件（文字列連結）: ${isBugCondition(rawValue, result) ? 'YES（バグあり）' : 'NO（正常）'}`);

      expect(result).toBe('10000');
    });
  });

  describe('数値型の rawValue（Google Sheets API が数値セルを数値型で返す場合）', () => {
    /**
     * テストケース4: rawValue = 7358（数値型）のとき "7359" を返すか確認
     *
     * Google Sheets API は valueRenderOption を指定しない場合、
     * 数値セルを数値型として返す可能性がある。
     * TypeScript の型定義は string[][] だが、実際の型は number の可能性がある。
     *
     * **Validates: Requirements 1.1, 1.2**
     */
    it('テスト4: rawValue=7358（数値型）のとき getNextBuyerNumber() が "7359" を返す（数値型の場合も正しく動作するか）', async () => {
      const rawValue = 7358; // 数値型
      const mockClient = createMockSheetsClient(rawValue);
      const client = new BuyerNumberSpreadsheetClient(mockClient, 'B2');

      const result = await client.getNextBuyerNumber();

      console.log(`rawValue=${rawValue}（型: ${typeof rawValue}）→ result="${result}"`);
      console.log(`期待値: "7359", 実際値: "${result}"`);
      console.log(`バグ条件（文字列連結）: ${isBugCondition(rawValue, result) ? 'YES（バグあり）' : 'NO（正常）'}`);

      // 数値型の場合: parseInt(String(7358), 10) + 1 = 7359 → "7359"
      expect(result).toBe('7359');
    });

    /**
     * テストケース5: rawValue = 1（数値型）のとき "2" を返すか確認
     *
     * **Validates: Requirements 1.1, 1.2**
     */
    it('テスト5: rawValue=1（数値型）のとき getNextBuyerNumber() が "2" を返す', async () => {
      const rawValue = 1; // 数値型
      const mockClient = createMockSheetsClient(rawValue);
      const client = new BuyerNumberSpreadsheetClient(mockClient, 'B2');

      const result = await client.getNextBuyerNumber();

      console.log(`rawValue=${rawValue}（型: ${typeof rawValue}）→ result="${result}"`);
      console.log(`期待値: "2", 実際値: "${result}"`);
      console.log(`バグ条件（文字列連結）: ${isBugCondition(rawValue, result) ? 'YES（バグあり）' : 'NO（正常）'}`);

      expect(result).toBe('2');
    });

    /**
     * テストケース6: rawValue = 9999（数値型）のとき "10000" を返すか確認（桁上がりのエッジケース）
     *
     * **Validates: Requirements 1.1, 1.2**
     */
    it('テスト6: rawValue=9999（数値型）のとき getNextBuyerNumber() が "10000" を返す（桁上がりのエッジケース）', async () => {
      const rawValue = 9999; // 数値型
      const mockClient = createMockSheetsClient(rawValue);
      const client = new BuyerNumberSpreadsheetClient(mockClient, 'B2');

      const result = await client.getNextBuyerNumber();

      console.log(`rawValue=${rawValue}（型: ${typeof rawValue}）→ result="${result}"`);
      console.log(`期待値: "10000", 実際値: "${result}"`);
      console.log(`バグ条件（文字列連結）: ${isBugCondition(rawValue, result) ? 'YES（バグあり）' : 'NO（正常）'}`);

      expect(result).toBe('10000');
    });
  });
});
'''

output_path = 'src/services/__tests__/BuyerNumberSpreadsheetClient.test.ts'

with open(output_path, 'wb') as f:
    f.write(content.encode('utf-8'))

print(f'✅ テストファイルを書き込みました: {output_path}')

# BOMチェック
with open(output_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (b\'\\xef\\xbb\\xbf\' はBOM付き、それ以外はBOMなしUTF-8)')
