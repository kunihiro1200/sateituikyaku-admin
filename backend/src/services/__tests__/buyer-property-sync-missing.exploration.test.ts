/**
 * バグ条件探索テスト: property_number保存時の物件情報スプレッドシート同期欠落
 *
 * **Property 1: Bug Condition** - property_number保存時の物件情報スプレッドシート同期欠落
 *
 * **重要**: このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails
 * GOAL: バグが存在することを示すカウンターエグザンプルを発見する
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */

import { BuyerColumnMapper } from '../BuyerColumnMapper';

// ============================================================
// テスト1: display_address マッピングの欠落確認
// ============================================================

describe('バグ条件探索: buyer-property-sync-missing', () => {
  let mapper: BuyerColumnMapper;

  beforeEach(() => {
    mapper = new BuyerColumnMapper();
  });

  // ----------------------------------------------------------
  // テスト1: mapDatabaseToSpreadsheet に display_address を渡した場合
  // ----------------------------------------------------------
  describe('テスト1: display_address マッピング欠落', () => {
    /**
     * バグ条件: databaseToSpreadsheet に display_address が存在しないため、
     * mapDatabaseToSpreadsheet({ display_address: "中央1-1-1" }) が {} を返す
     *
     * 未修正コードでは FAIL する（バグの存在を証明）
     * 修正後は PASS する（display_address -> 住居表示 のマッピングが追加される）
     *
     * カウンターエグザンプル:
     *   mapDatabaseToSpreadsheet({ display_address: "中央1-1-1" }) => {} （住居表示キーなし）
     */
    it('Bug Condition: mapDatabaseToSpreadsheet({ display_address: "中央1-1-1" }) の結果に 住居表示 キーが存在する', () => {
      // バグ条件: databaseToSpreadsheet に display_address がないため {} が返る
      const result = mapper.mapDatabaseToSpreadsheet({ display_address: '中央1-1-1' });

      console.log('[テスト1] mapDatabaseToSpreadsheet({ display_address: "中央1-1-1" }) =>', JSON.stringify(result));
      console.log('[テスト1] 期待: { "住居表示": "中央1-1-1" }');
      console.log('[テスト1] 実際:', JSON.stringify(result));

      // 未修正コードでは FAIL（住居表示キーが存在しない）
      // 修正後は PASS（display_address -> 住居表示 のマッピングが追加される）
      expect(result).toHaveProperty('住居表示', '中央1-1-1');
    });
  });

  // ----------------------------------------------------------
  // テスト2: dbToSpreadsheet マップに display_address キーが存在しない
  // ----------------------------------------------------------
  describe('テスト2: dbToSpreadsheet マップの display_address キー欠落', () => {
    /**
     * バグ条件: BuyerColumnMapper の内部 dbToSpreadsheet マップに
     * display_address キーが存在しない
     *
     * 未修正コードでは FAIL する（バグの存在を証明）
     * 修正後は PASS する
     *
     * カウンターエグザンプル:
     *   getSpreadsheetColumnName('display_address') => null
     */
    it('Bug Condition: getSpreadsheetColumnName("display_address") が 住居表示 を返す', () => {
      const spreadsheetColumnName = mapper.getSpreadsheetColumnName('display_address');

      console.log('[テスト2] getSpreadsheetColumnName("display_address") =>', spreadsheetColumnName);
      console.log('[テスト2] 期待: "住居表示"');
      console.log('[テスト2] 実際:', spreadsheetColumnName);

      // 未修正コードでは FAIL（null が返る）
      // 修正後は PASS（"住居表示" が返る）
      expect(spreadsheetColumnName).toBe('住居表示');
    });

    it('Bug Condition: databaseToSpreadsheet マッピングに display_address キーが存在する', () => {
      // buyer-column-mapping.json を直接確認
      const columnMapping = require('../../config/buyer-column-mapping.json');
      const databaseToSpreadsheet = columnMapping.databaseToSpreadsheet;

      console.log('[テスト2] databaseToSpreadsheet の display_address:', databaseToSpreadsheet['display_address']);
      console.log('[テスト2] 期待: "住居表示"');

      // 未修正コードでは FAIL（display_address キーが存在しない）
      // 修正後は PASS
      expect(databaseToSpreadsheet).toHaveProperty('display_address', '住居表示');
    });
  });

  // ----------------------------------------------------------
  // テスト3: property_number 更新時に物件情報が allowedData に追加されない
  // ----------------------------------------------------------
  describe('テスト3: property_number 更新時の物件情報同期欠落', () => {
    /**
     * バグ条件: BuyerService.updateWithSync() で property_number を更新した際、
     * writeService.updateFields() に渡される updates に
     * property_address / display_address / price が含まれない
     *
     * このテストはソースコードの静的解析で確認する
     *
     * 未修正コードでは FAIL する（バグの存在を証明）
     * 修正後は PASS する
     *
     * カウンターエグザンプル:
     *   updateWithSync(id, { property_number: "BB5678" }) を呼び出すと、
     *   writeService.updateFields() に property_address/display_address/price が含まれない
     */
    it('Bug Condition: BuyerService.updateWithSync() に property_number 保存時の物件情報取得処理が存在する', () => {
      const fs = require('fs');
      const path = require('path');

      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      // updateWithSync メソッドの範囲を抽出
      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';

      console.log('[テスト3] updateWithSync メソッドの長さ:', funcBody.length, '文字');

      // property_number の条件分岐が存在するか確認
      const hasPropertyNumberCheck = funcBody.includes('property_number') &&
        (funcBody.includes('property_listings') || funcBody.includes('getByPropertyNumber'));

      console.log('[テスト3] property_number 保存時の物件情報取得処理が存在するか:', hasPropertyNumberCheck);
      console.log('[テスト3] 期待: true（property_listings からの取得処理が存在する）');

      // 未修正コードでは FAIL（property_listings からの取得処理が存在しない）
      // 修正後は PASS
      expect(hasPropertyNumberCheck).toBe(true);
    });

    it('Bug Condition: BuyerService.updateWithSync() に property_address/display_address/price を allowedData に追加する処理が存在する', () => {
      const fs = require('fs');
      const path = require('path');

      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      // updateWithSync メソッドの範囲を抽出
      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';

      // allowedData に property_address / display_address / price を追加する処理が存在するか
      const hasPropertyAddressSync = funcBody.includes('property_address') &&
        funcBody.includes('allowedData');
      const hasDisplayAddressSync = funcBody.includes('display_address') &&
        funcBody.includes('allowedData');
      const hasPriceSync = funcBody.includes("'price'") || funcBody.includes('"price"');

      console.log('[テスト3] allowedData に property_address を追加する処理:', hasPropertyAddressSync);
      console.log('[テスト3] allowedData に display_address を追加する処理:', hasDisplayAddressSync);
      console.log('[テスト3] price の同期処理:', hasPriceSync);

      // 未修正コードでは FAIL（これらの処理が存在しない）
      // 修正後は PASS
      expect(hasPropertyAddressSync).toBe(true);
      expect(hasDisplayAddressSync).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // バグ条件サマリー
  // ----------------------------------------------------------
  describe('バグ条件サマリー', () => {
    it('根本原因1の確認: databaseToSpreadsheet に display_address が存在しない', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      const hasDisplayAddress = 'display_address' in columnMapping.databaseToSpreadsheet;

      console.log('[サマリー] databaseToSpreadsheet に display_address が存在するか:', hasDisplayAddress);
      console.log('[サマリー] カウンターエグザンプル: display_address キーが存在しないため、');
      console.log('[サマリー]   mapDatabaseToSpreadsheet({ display_address: "中央1-1-1" }) => {} が返る');

      // 未修正コードでは FAIL（display_address が存在しない）
      expect(hasDisplayAddress).toBe(true);
    });

    it('根本原因2の確認: updateWithSync に property_number 保存時の物件情報同期処理が存在しない', () => {
      const fs = require('fs');
      const path = require('path');

      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';

      // property_listings テーブルへのアクセスが存在するか
      const hasPropertyListingsAccess = funcBody.includes('property_listings');

      console.log('[サマリー] updateWithSync に property_listings アクセスが存在するか:', hasPropertyListingsAccess);
      console.log('[サマリー] カウンターエグザンプル: property_number を保存しても');
      console.log('[サマリー]   property_listings から address/display_address/price を取得する処理がない');
      console.log('[サマリー]   → スプレッドシートのAY/BQ/BR列が空白のまま');

      // 未修正コードでは FAIL（property_listings へのアクセスが存在しない）
      expect(hasPropertyListingsAccess).toBe(true);
    });
  });
});
