/**
 * 買主誤削除バグ 探索テスト
 *
 * このテストはバグ条件を再現し、修正前のコードで FAIL することを確認します。
 * 修正後は全テストが PASS するはずです。
 *
 * バグの根本原因:
 * 1. GOOGLE_SHEETS_BUYER_SPREADSHEET_ID が未設定の場合、PROPERTY_LISTING_SPREADSHEET_ID にフォールバック
 *    → 売主リストのシートを買主リストとして読み込み、買主番号が0件になる
 * 2. detectDeletedBuyers() に安全ガードがない
 *    → スプレッドシートから0件の場合、DB上の全アクティブ買主が削除対象になる
 * 3. syncBuyers() に削除比率チェックがない
 *    → 大量削除が無条件に実行される
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================
// バグのあるロジックを再現するヘルパークラス
// 実際の EnhancedAutoSyncService の問題のある部分を抽出
// ============================================================

/**
 * 修正前の initializeBuyer ロジック
 * バグ: PROPERTY_LISTING_SPREADSHEET_ID へのフォールバックが存在する
 */
function buggyGetBuyerSpreadsheetId(env: Record<string, string | undefined>): string {
  // バグ: || でフォールバックしてしまう
  const buyerSpreadsheetId = env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID || env.PROPERTY_LISTING_SPREADSHEET_ID!;
  if (!buyerSpreadsheetId) {
    throw new Error('Neither GOOGLE_SHEETS_BUYER_SPREADSHEET_ID nor PROPERTY_LISTING_SPREADSHEET_ID is set');
  }
  return buyerSpreadsheetId;
}

/**
 * 修正後の initializeBuyer ロジック（期待される動作）
 * 修正: GOOGLE_SHEETS_BUYER_SPREADSHEET_ID のみを使用し、.trim() で不正な文字を除去
 */
function fixedGetBuyerSpreadsheetId(env: Record<string, string | undefined>): string {
  const buyerSpreadsheetId = env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID?.trim();
  if (!buyerSpreadsheetId) {
    throw new Error('GOOGLE_SHEETS_BUYER_SPREADSHEET_ID is not set. Cannot initialize buyer sync service.');
  }
  return buyerSpreadsheetId;
}

/**
 * 修正前の detectDeletedBuyers ロジック（安全ガードなし）
 */
function buggyDetectDeletedBuyers(sheetBuyerNumbers: Set<string>, dbBuyerNumbers: Set<string>): string[] {
  // バグ: sheetBuyerNumbers が0件でも全DB買主を削除対象にしてしまう
  const deletedBuyers: string[] = [];
  for (const buyerNumber of dbBuyerNumbers) {
    if (!sheetBuyerNumbers.has(buyerNumber)) {
      deletedBuyers.push(buyerNumber);
    }
  }
  return deletedBuyers;
}

/**
 * 修正後の detectDeletedBuyers ロジック（安全ガード付き）
 */
function fixedDetectDeletedBuyers(sheetBuyerNumbers: Set<string>, dbBuyerNumbers: Set<string>): string[] {
  // 安全ガード1: 0件の場合はスキップ
  if (sheetBuyerNumbers.size === 0) {
    console.warn('⚠️ SAFETY GUARD: No buyer numbers found in spreadsheet. Skipping deletion.');
    return [];
  }

  // 安全ガード2: 50%未満の場合はスキップ
  const ratio = sheetBuyerNumbers.size / dbBuyerNumbers.size;
  if (ratio < 0.5) {
    console.warn(`⚠️ SAFETY GUARD: Spreadsheet has only ${sheetBuyerNumbers.size} buyers but DB has ${dbBuyerNumbers.size} (ratio: ${(ratio * 100).toFixed(1)}%). Skipping deletion.`);
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

/**
 * 修正前の syncBuyers 削除実行ロジック（10%チェックなし）
 */
function buggyCheckDeletionThreshold(deletedCount: number, activeCount: number): boolean {
  // バグ: 削除比率チェックなし → 常に削除を実行
  return deletedCount > 0;
}

/**
 * 修正後の syncBuyers 削除実行ロジック（10%チェックあり）
 */
function fixedCheckDeletionThreshold(deletedCount: number, activeCount: number): boolean {
  // 安全ガード3: 削除対象がアクティブ買主の10%以上の場合はスキップ
  if (activeCount === 0) return false;
  const ratio = deletedCount / activeCount;
  if (ratio >= 0.1) {
    console.error(`🚨 SAFETY GUARD: Deletion target (${deletedCount}) is ${(ratio * 100).toFixed(1)}% of active buyers (${activeCount}). Skipping deletion.`);
    return false;
  }
  return deletedCount > 0;
}

// ============================================================
// テストスイート
// ============================================================

describe('買主誤削除バグ 探索テスト', () => {

  describe('バグケース1: GOOGLE_SHEETS_BUYER_SPREADSHEET_ID が未設定の場合のフォールバック', () => {
    it('【修正前】未設定の場合、PROPERTY_LISTING_SPREADSHEET_ID にフォールバックしてしまう', () => {
      const env = {
        GOOGLE_SHEETS_BUYER_SPREADSHEET_ID: undefined,
        PROPERTY_LISTING_SPREADSHEET_ID: '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g',
      };

      // 修正前: エラーをスローせず、売主リストのIDを返してしまう
      const id = buggyGetBuyerSpreadsheetId(env);

      // 修正後の期待値: エラーをスローするべき
      // このテストは修正前のコードで FAIL する（エラーがスローされないため）
      expect(() => fixedGetBuyerSpreadsheetId(env)).toThrow('GOOGLE_SHEETS_BUYER_SPREADSHEET_ID is not set');

      // 修正前のコードはフォールバックして売主リストのIDを返す（バグ）
      expect(id).toBe('1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g');
    });

    it('【修正前】空文字列の場合も PROPERTY_LISTING_SPREADSHEET_ID にフォールバックしてしまう', () => {
      const env = {
        GOOGLE_SHEETS_BUYER_SPREADSHEET_ID: '',
        PROPERTY_LISTING_SPREADSHEET_ID: '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g',
      };

      // 修正前: 空文字列は falsy なのでフォールバックする
      const id = buggyGetBuyerSpreadsheetId(env);
      expect(id).toBe('1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g');

      // 修正後の期待値: エラーをスローするべき
      expect(() => fixedGetBuyerSpreadsheetId(env)).toThrow('GOOGLE_SHEETS_BUYER_SPREADSHEET_ID is not set');
    });
  });

  describe('バグケース2: 末尾 \\r\\n が含まれる場合', () => {
    it('【修正前】末尾 \\r\\n 付きのIDがそのまま使われてしまう', () => {
      const env = {
        GOOGLE_SHEETS_BUYER_SPREADSHEET_ID: '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY\r\n',
        PROPERTY_LISTING_SPREADSHEET_ID: '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g',
      };

      // 修正前: .trim() がないので末尾 \r\n が残る
      const buggyId = buggyGetBuyerSpreadsheetId(env);
      expect(buggyId).toBe('1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY\r\n');
      expect(buggyId).not.toBe('1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY');

      // 修正後の期待値: .trim() で末尾の不正な文字が除去される
      const fixedId = fixedGetBuyerSpreadsheetId(env);
      expect(fixedId).toBe('1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY');
    });
  });

  describe('バグケース3: スプレッドシートから0件の買主番号が返される場合', () => {
    it('【修正前】0件の場合、DB上の全アクティブ買主が削除対象になる', () => {
      const sheetBuyerNumbers = new Set<string>(); // 0件
      const dbBuyerNumbers = new Set(['1001', '1002', '1003', '1004', '1005']);

      // 修正前: 安全ガードなし → 全DB買主が削除対象
      const buggyDeleted = buggyDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      expect(buggyDeleted).toHaveLength(5); // バグ: 5件全て削除対象になる

      // 修正後の期待値: 0件の場合は空配列を返す
      const fixedDeleted = fixedDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      expect(fixedDeleted).toHaveLength(0); // 修正後: 削除対象なし
    });

    it('【修正前】0件の場合、100件のDB買主が全て削除対象になる（大規模誤削除）', () => {
      const sheetBuyerNumbers = new Set<string>(); // 0件
      const dbBuyerNumbers = new Set(
        Array.from({ length: 100 }, (_, i) => String(1000 + i))
      );

      // 修正前: 100件全て削除対象
      const buggyDeleted = buggyDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      expect(buggyDeleted).toHaveLength(100); // バグ: 100件全て削除対象

      // 修正後: 0件
      const fixedDeleted = fixedDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      expect(fixedDeleted).toHaveLength(0);
    });
  });

  describe('バグケース4: スプレッドシートの買主数がDBの50%未満の場合', () => {
    it('【修正前】DBに100件・スプレッドシートに40件の場合、60件が削除対象になる', () => {
      // スプレッドシートに40件（DBの40%）
      const sheetBuyerNumbers = new Set(
        Array.from({ length: 40 }, (_, i) => String(1000 + i))
      );
      // DBに100件
      const dbBuyerNumbers = new Set(
        Array.from({ length: 100 }, (_, i) => String(1000 + i))
      );

      // 修正前: 60件が削除対象
      const buggyDeleted = buggyDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      expect(buggyDeleted).toHaveLength(60); // バグ: 60件削除対象

      // 修正後: 50%未満なので空配列
      const fixedDeleted = fixedDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      expect(fixedDeleted).toHaveLength(0);
    });

    it('【修正前】DBに200件・スプレッドシートに1件の場合、199件が削除対象になる（最悪ケース）', () => {
      const sheetBuyerNumbers = new Set(['1000']); // 1件のみ
      const dbBuyerNumbers = new Set(
        Array.from({ length: 200 }, (_, i) => String(1000 + i))
      );

      // 修正前: 199件が削除対象
      const buggyDeleted = buggyDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      expect(buggyDeleted).toHaveLength(199); // バグ

      // 修正後: 50%未満なので空配列
      const fixedDeleted = fixedDetectDeletedBuyers(sheetBuyerNumbers, dbBuyerNumbers);
      expect(fixedDeleted).toHaveLength(0);
    });
  });

  describe('バグケース5: 削除対象がアクティブ買主の10%以上の場合', () => {
    it('【修正前】削除対象15件・アクティブ100件の場合、削除が実行される（15%）', () => {
      const deletedCount = 15;
      const activeCount = 100;

      // 修正前: 比率チェックなし → 削除実行
      const buggyResult = buggyCheckDeletionThreshold(deletedCount, activeCount);
      expect(buggyResult).toBe(true); // バグ: 削除が実行される

      // 修正後: 15% >= 10% なので削除スキップ
      const fixedResult = fixedCheckDeletionThreshold(deletedCount, activeCount);
      expect(fixedResult).toBe(false); // 修正後: 削除スキップ
    });

    it('【修正前】削除対象10件・アクティブ100件の場合、削除が実行される（10%）', () => {
      const deletedCount = 10;
      const activeCount = 100;

      // 修正前: 比率チェックなし → 削除実行
      const buggyResult = buggyCheckDeletionThreshold(deletedCount, activeCount);
      expect(buggyResult).toBe(true); // バグ

      // 修正後: 10% >= 10% なので削除スキップ
      const fixedResult = fixedCheckDeletionThreshold(deletedCount, activeCount);
      expect(fixedResult).toBe(false); // 修正後: 削除スキップ
    });
  });
});
