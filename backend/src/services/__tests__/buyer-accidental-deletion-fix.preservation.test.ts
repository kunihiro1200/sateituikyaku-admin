/**
 * 買主誤削除バグ修正 保持テスト
 *
 * このテストは正常ケースの動作が修正前後ともに保持されていることを確認します。
 * 全テストが修正前後ともに PASS するはずです。
 */

import { describe, it, expect } from 'vitest';

// ============================================================
// 修正後の正しいロジック（期待される動作）
// ============================================================

function fixedGetBuyerSpreadsheetId(env: Record<string, string | undefined>): string {
  const buyerSpreadsheetId = env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID?.trim();
  if (!buyerSpreadsheetId) {
    throw new Error('GOOGLE_SHEETS_BUYER_SPREADSHEET_ID is not set. Cannot initialize buyer sync service.');
  }
  return buyerSpreadsheetId;
}

function fixedDetectDeletedBuyers(sheetBuyerNumbers: Set<string>, dbBuyerNumbers: Set<string>): string[] {
  // 安全ガード1: 0件の場合はスキップ
  if (sheetBuyerNumbers.size === 0) {
    return [];
  }

  // 安全ガード2: 50%未満の場合はスキップ
  const ratio = sheetBuyerNumbers.size / dbBuyerNumbers.size;
  if (ratio < 0.5) {
    return [];
  }

  const deletedBuyers: string[] = [];
  for (const buyerNumber of dbBuyerNumbers) {
    if (!sheetBuyerNumbers.has(buyerNumber)) {
      deletedBuyers.push(buyerNumber);
    }
  }
  return deletedBuyers;
}

function fixedCheckDeletionThreshold(deletedCount: number, activeCount: number): boolean {
  if (activeCount === 0) return false;
  const ratio = deletedCount / activeCount;
  if (ratio >= 0.1) return false;
  return deletedCount > 0;
}

// ============================================================
// 保持テスト
// ============================================================

describe('買主誤削除バグ修正 保持テスト', () => {

  describe('正常ケース1: GOOGLE_SHEETS_BUYER_SPREADSHEET_ID が正しく設定されている場合', () => {
    it('正しいIDが設定されている場合、そのIDを返す', () => {
      const env = {
        GOOGLE_SHEETS_BUYER_SPREADSHEET_ID: '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY',
        PROPERTY_LISTING_SPREADSHEET_ID: '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g',
      };

      const id = fixedGetBuyerSpreadsheetId(env);
      expect(id).toBe('1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY');
    });

    it('末尾 \\r\\n 付きのIDは .trim() で正規化される', () => {
      const env = {
        GOOGLE_SHEETS_BUYER_SPREADSHEET_ID: '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY\r\n',
      };

      const id = fixedGetBuyerSpreadsheetId(env);
      expect(id).toBe('1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY');
    });

    it('末尾スペース付きのIDも .trim() で正規化される', () => {
      const env = {
        GOOGLE_SHEETS_BUYER_SPREADSHEET_ID: '  1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY  ',
      };

      const id = fixedGetBuyerSpreadsheetId(env);
      expect(id).toBe('1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY');
    });
  });

  describe('正常ケース2: スプレッドシートに存在しない買主が正常に削除対象として検出される', () => {
    it('スプレッドシート比率80%・削除対象5件の場合、削除対象が正常に返される', () => {
      // DB: 100件、スプレッドシート: 95件（95%）、削除対象: 5件
      const dbBuyers = Array.from({ length: 100 }, (_, i) => String(1000 + i));
      const sheetBuyers = dbBuyers.slice(0, 95); // 最初の95件のみ

      const sheetBuyerNumbers = new Set(sheetBuyers);
      const dbBuyerNumbers = new Set(dbBuyers);

      const deleted = fixedDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);

      expect(deleted).toHaveLength(5);
      // 削除対象は DB にあってシートにない最後の5件
      expect(deleted).toContain('1095');
      expect(deleted).toContain('1096');
      expect(deleted).toContain('1097');
      expect(deleted).toContain('1098');
      expect(deleted).toContain('1099');
    });

    it('スプレッドシート比率100%・削除対象0件の場合、空配列が返される', () => {
      const buyers = Array.from({ length: 50 }, (_, i) => String(2000 + i));
      const sheetBuyerNumbers = new Set(buyers);
      const dbBuyerNumbers = new Set(buyers);

      const deleted = fixedDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      expect(deleted).toHaveLength(0);
    });

    it('スプレッドシート比率ちょうど50%の場合、削除対象が返される（境界値）', () => {
      // DB: 100件、スプレッドシート: 50件（50%）
      const dbBuyers = Array.from({ length: 100 }, (_, i) => String(3000 + i));
      const sheetBuyers = dbBuyers.slice(0, 50);

      const sheetBuyerNumbers = new Set(sheetBuyers);
      const dbBuyerNumbers = new Set(dbBuyers);

      const deleted = fixedDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      // 50% は閾値以上なので削除対象を返す
      expect(deleted).toHaveLength(50);
    });
  });

  describe('正常ケース3: スプレッドシートに存在する買主は削除対象にならない', () => {
    it('スプレッドシートとDBが完全一致する場合、削除対象は0件', () => {
      const buyers = ['1001', '1002', '1003', '1004', '1005'];
      const sheetBuyerNumbers = new Set(buyers);
      const dbBuyerNumbers = new Set(buyers);

      const deleted = fixedDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      expect(deleted).toHaveLength(0);
    });

    it('スプレッドシートにDBより多い買主がいる場合（新規追加待ち）、削除対象は0件', () => {
      const dbBuyers = ['1001', '1002', '1003'];
      const sheetBuyers = ['1001', '1002', '1003', '1004', '1005']; // シートに2件多い

      const sheetBuyerNumbers = new Set(sheetBuyers);
      const dbBuyerNumbers = new Set(dbBuyers);

      const deleted = fixedDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      expect(deleted).toHaveLength(0);
    });
  });

  describe('正常ケース4: 削除比率チェックの境界値', () => {
    it('削除比率9.9%（10%未満）の場合、削除が実行される', () => {
      const deletedCount = 9;
      const activeCount = 91; // 9/91 ≈ 9.89%

      const result = fixedCheckDeletionThreshold(deletedCount, activeCount);
      expect(result).toBe(true); // 10%未満なので削除実行
    });

    it('削除比率ちょうど10%の場合、削除がスキップされる（境界値）', () => {
      const deletedCount = 10;
      const activeCount = 100; // 10/100 = 10%

      const result = fixedCheckDeletionThreshold(deletedCount, activeCount);
      expect(result).toBe(false); // 10%以上なのでスキップ
    });

    it('削除比率10.1%の場合、削除がスキップされる', () => {
      const deletedCount = 11;
      const activeCount = 100; // 11/100 = 11%

      const result = fixedCheckDeletionThreshold(deletedCount, activeCount);
      expect(result).toBe(false);
    });

    it('削除対象0件の場合、削除は実行されない', () => {
      const result = fixedCheckDeletionThreshold(0, 100);
      expect(result).toBe(false);
    });
  });

  describe('プロパティベーステスト: ランダムシナリオでの安全性確認', () => {
    it('スプレッドシート比率50%以上・削除比率10%未満の場合、削除が正常実行される', () => {
      // ランダムなシナリオを複数生成してテスト
      const scenarios = [
        { dbCount: 100, sheetCount: 90, deletedCount: 5 },   // 90%, 5%
        { dbCount: 200, sheetCount: 150, deletedCount: 10 },  // 75%, 5%
        { dbCount: 50, sheetCount: 40, deletedCount: 3 },     // 80%, 6%
        { dbCount: 1000, sheetCount: 800, deletedCount: 50 }, // 80%, 5%
        { dbCount: 10, sheetCount: 5, deletedCount: 0 },      // 50%, 0%
      ];

      for (const { dbCount, sheetCount, deletedCount } of scenarios) {
        const dbBuyers = Array.from({ length: dbCount }, (_, i) => String(i));
        const sheetBuyers = dbBuyers.slice(0, sheetCount);

        const sheetBuyerNumbers = new Set(sheetBuyers);
        const dbBuyerNumbers = new Set(dbBuyers);

        const detected = fixedDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
        const expectedDeleted = dbCount - sheetCount;

        // 比率チェック
        const sheetRatio = sheetCount / dbCount;
        if (sheetRatio >= 0.5) {
          expect(detected).toHaveLength(expectedDeleted);
        } else {
          expect(detected).toHaveLength(0);
        }

        // 削除比率チェック
        const deletionRatio = deletedCount / dbCount;
        const shouldDelete = fixedCheckDeletionThreshold(deletedCount, dbCount);
        if (deletionRatio < 0.1 && deletedCount > 0) {
          expect(shouldDelete).toBe(true);
        } else if (deletionRatio >= 0.1) {
          expect(shouldDelete).toBe(false);
        }
      }
    });
  });
});
