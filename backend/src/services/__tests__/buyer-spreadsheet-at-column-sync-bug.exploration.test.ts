/**
 * バグ条件探索テスト: AT列（物件番号）に紐づくBR列（物件担当者）が同期されないバグ
 *
 * **Property 1: Bug Condition** - AT列物件番号に紐づくBR列（物件担当者）が同期されないバグ
 *
 * **重要**: このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails
 * GOAL: バグが存在することを示すカウンターエグザンプルを発見する
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// テスト1: buyer-column-mapping.json の databaseToSpreadsheet に
//          property_assignee キーが存在しないことを確認
// ============================================================

describe('バグ条件探索: buyer-spreadsheet-at-column-sync-bug', () => {

  // ----------------------------------------------------------
  // テスト1: databaseToSpreadsheet に property_assignee が存在しない
  // ----------------------------------------------------------
  describe('テスト1: databaseToSpreadsheet マッピングの property_assignee キー欠落', () => {
    /**
     * バグ条件: buyer-column-mapping.json の databaseToSpreadsheet セクションに
     * property_assignee キーが存在しないため、たとえ allowedData に property_assignee を
     * 設定しても、スプレッドシートのBR列（物件担当者）に書き込まれない。
     *
     * 未修正コードでは FAIL する（バグの存在を証明）
     * 修正後は PASS する（property_assignee -> 物件担当者 のマッピングが追加される）
     *
     * カウンターエグザンプル:
     *   databaseToSpreadsheet に property_assignee キーが存在しない
     *   → スプレッドシートのBR列（物件担当者）が空白のまま
     */
    it('Bug Condition: databaseToSpreadsheet に property_assignee キーが存在する', () => {
      const columnMappingPath = path.resolve(__dirname, '../../config/buyer-column-mapping.json');
      const columnMapping = JSON.parse(fs.readFileSync(columnMappingPath, 'utf-8'));
      const databaseToSpreadsheet = columnMapping.databaseToSpreadsheet;

      console.log('[テスト1] databaseToSpreadsheet の property_assignee:',
        databaseToSpreadsheet['property_assignee']);
      console.log('[テスト1] 期待: "物件担当者"');
      console.log('[テスト1] 実際:', databaseToSpreadsheet['property_assignee']);
      console.log('[テスト1] カウンターエグザンプル: property_assignee キーが存在しないため、');
      console.log('[テスト1]   allowedData.property_assignee を設定しても BR列に書き込まれない');

      // 未修正コードでは FAIL（property_assignee キーが存在しない）
      // 修正後は PASS（"物件担当者" が返る）
      expect(databaseToSpreadsheet).toHaveProperty('property_assignee', '物件担当者');
    });

    it('Bug Condition: spreadsheetToDatabase には 物件担当者 -> property_assignee が存在する（逆方向のみ存在）', () => {
      // このテストは PASS する（逆方向マッピングは存在する）
      // バグの非対称性を示す: spreadsheetToDatabase には存在するが databaseToSpreadsheet には存在しない
      const columnMappingPath = path.resolve(__dirname, '../../config/buyer-column-mapping.json');
      const columnMapping = JSON.parse(fs.readFileSync(columnMappingPath, 'utf-8'));

      const spreadsheetToDatabase = columnMapping.spreadsheetToDatabase;
      const databaseToSpreadsheet = columnMapping.databaseToSpreadsheet;

      console.log('[テスト1b] spreadsheetToDatabase["物件担当者"]:', spreadsheetToDatabase['物件担当者']);
      console.log('[テスト1b] databaseToSpreadsheet["property_assignee"]:', databaseToSpreadsheet['property_assignee']);
      console.log('[テスト1b] バグの非対称性: spreadsheetToDatabase には存在するが databaseToSpreadsheet には存在しない');

      // spreadsheetToDatabase には存在する（これは PASS する）
      expect(spreadsheetToDatabase['物件担当者']).toBe('property_assignee');

      // databaseToSpreadsheet には存在しない（これが FAIL する - バグの証明）
      expect(databaseToSpreadsheet).toHaveProperty('property_assignee', '物件担当者');
    });
  });

  // ----------------------------------------------------------
  // テスト2: updateWithSync の select クエリに sales_assignee が含まれない
  // ----------------------------------------------------------
  describe('テスト2: updateWithSync の property_listings クエリに sales_assignee が含まれない', () => {
    /**
     * バグ条件: BuyerService.updateWithSync() で property_listings から
     * select('address, display_address, price') のみを取得しており、
     * sales_assignee（物件担当者）が含まれていない。
     *
     * 未修正コードでは FAIL する（バグの存在を証明）
     * 修正後は PASS する（sales_assignee が select に追加される）
     *
     * カウンターエグザンプル:
     *   updateWithSync で property_listings から sales_assignee を取得していない
     *   → allowedData.property_assignee が設定されない
     *   → スプレッドシートのBR列（物件担当者）が空白のまま
     */
    it('Bug Condition: updateWithSync の property_listings クエリに sales_assignee が含まれる', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      // updateWithSync メソッドの範囲を抽出
      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';

      // property_listings の select クエリに sales_assignee が含まれるか確認
      const selectPattern = /\.select\(['"]([^'"]*)['"]\)/g;
      const matches: string[] = [];
      let match;
      while ((match = selectPattern.exec(funcBody)) !== null) {
        matches.push(match[1]);
      }

      console.log('[テスト2] updateWithSync の select クエリ:', matches);
      console.log('[テスト2] 期待: sales_assignee を含む select クエリが存在する');
      console.log('[テスト2] カウンターエグザンプル: select("address, display_address, price") のみで');
      console.log('[テスト2]   sales_assignee が含まれていない');

      // sales_assignee を含む select クエリが存在するか確認
      const hasSalesAssigneeInSelect = matches.some(q => q.includes('sales_assignee'));

      console.log('[テスト2] sales_assignee を含む select クエリが存在するか:', hasSalesAssigneeInSelect);

      // 未修正コードでは FAIL（sales_assignee が select に含まれていない）
      // 修正後は PASS
      expect(hasSalesAssigneeInSelect).toBe(true);
    });

    it('Bug Condition: updateWithSync に allowedData.property_assignee を設定する処理が存在する', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      // updateWithSync メソッドの範囲を抽出
      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';

      // allowedData.property_assignee への代入が存在するか確認
      const hasPropertyAssigneeAssignment =
        funcBody.includes('allowedData.property_assignee') ||
        funcBody.includes("allowedData['property_assignee']");

      console.log('[テスト2b] allowedData.property_assignee への代入が存在するか:', hasPropertyAssigneeAssignment);
      console.log('[テスト2b] 期待: true（property_assignee を allowedData に設定する処理が存在する）');
      console.log('[テスト2b] カウンターエグザンプル: allowedData.property_assignee への代入がない');
      console.log('[テスト2b]   → property_assignee が allowedData に含まれない');
      console.log('[テスト2b]   → スプレッドシートのBR列（物件担当者）が空白のまま');

      // 未修正コードでは FAIL（allowedData.property_assignee への代入がない）
      // 修正後は PASS
      expect(hasPropertyAssigneeAssignment).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // テスト3: create の select クエリに sales_assignee が含まれない
  // ----------------------------------------------------------
  describe('テスト3: create の property_listings クエリに sales_assignee が含まれない', () => {
    /**
     * バグ条件: BuyerService.create() で property_listings から
     * select('address, display_address, price') のみを取得しており、
     * sales_assignee（物件担当者）が含まれていない。
     *
     * 未修正コードでは FAIL する（バグの存在を証明）
     * 修正後は PASS する（sales_assignee が select に追加される）
     *
     * カウンターエグザンプル:
     *   create で property_listings から sales_assignee を取得していない
     *   → appendData.property_assignee が設定されない
     *   → 新規登録時にスプレッドシートのBR列（物件担当者）が空白のまま
     */
    it('Bug Condition: create の property_listings クエリに sales_assignee が含まれる', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      // create メソッドの範囲を抽出
      const funcStart = sourceCode.indexOf('  async create(buyerData: Partial<any>): Promise<any> {');
      const funcEnd = sourceCode.indexOf('\n  private async initBuyerNumberClient()', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';

      // property_listings の select クエリに sales_assignee が含まれるか確認
      const selectPattern = /\.select\(['"]([^'"]*)['"]\)/g;
      const matches: string[] = [];
      let match;
      while ((match = selectPattern.exec(funcBody)) !== null) {
        matches.push(match[1]);
      }

      console.log('[テスト3] create の select クエリ:', matches);
      console.log('[テスト3] 期待: sales_assignee を含む select クエリが存在する');
      console.log('[テスト3] カウンターエグザンプル: select("address, display_address, price") のみで');
      console.log('[テスト3]   sales_assignee が含まれていない');

      // sales_assignee を含む select クエリが存在するか確認
      const hasSalesAssigneeInSelect = matches.some(q => q.includes('sales_assignee'));

      console.log('[テスト3] sales_assignee を含む select クエリが存在するか:', hasSalesAssigneeInSelect);

      // 未修正コードでは FAIL（sales_assignee が select に含まれていない）
      // 修正後は PASS
      expect(hasSalesAssigneeInSelect).toBe(true);
    });

    it('Bug Condition: create に appendData.property_assignee を設定する処理が存在する', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      // create メソッドの範囲を抽出
      const funcStart = sourceCode.indexOf('  async create(buyerData: Partial<any>): Promise<any> {');
      const funcEnd = sourceCode.indexOf('\n  private async initBuyerNumberClient()', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';

      // appendData.property_assignee への代入が存在するか確認
      const hasPropertyAssigneeAssignment =
        funcBody.includes('appendData.property_assignee') ||
        funcBody.includes("appendData['property_assignee']");

      console.log('[テスト3b] appendData.property_assignee への代入が存在するか:', hasPropertyAssigneeAssignment);
      console.log('[テスト3b] 期待: true（property_assignee を appendData に設定する処理が存在する）');
      console.log('[テスト3b] カウンターエグザンプル: appendData.property_assignee への代入がない');
      console.log('[テスト3b]   → property_assignee が appendData に含まれない');
      console.log('[テスト3b]   → 新規登録時にスプレッドシートのBR列（物件担当者）が空白のまま');

      // 未修正コードでは FAIL（appendData.property_assignee への代入がない）
      // 修正後は PASS
      expect(hasPropertyAssigneeAssignment).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // テスト4: AU/AY/BQ列は同期されるが BR列は同期されない（バグの部分的な性質）
  // ----------------------------------------------------------
  describe('テスト4: AU/AY/BQ列は同期されるが BR列は同期されない（バグの部分的な性質）', () => {
    /**
     * このテストは PASS する（AU/AY/BQ列の同期は正常に動作している）
     * バグはBR列（物件担当者）のみに影響する
     */
    it('Partial Bug: updateWithSync に property_address/display_address/price の同期処理が存在する', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';

      // property_address / display_address / price の同期処理が存在するか確認
      const hasPropertyAddressSync = funcBody.includes('allowedData.property_address');
      const hasDisplayAddressSync = funcBody.includes('allowedData.display_address');
      const hasPriceSync = funcBody.includes('allowedData.price');

      console.log('[テスト4] allowedData.property_address の同期処理:', hasPropertyAddressSync);
      console.log('[テスト4] allowedData.display_address の同期処理:', hasDisplayAddressSync);
      console.log('[テスト4] allowedData.price の同期処理:', hasPriceSync);
      console.log('[テスト4] これらは PASS する（AU/AY/BQ列は正常に同期される）');
      console.log('[テスト4] バグはBR列（物件担当者）のみ: allowedData.property_assignee が設定されない');

      // これらは PASS する（AU/AY/BQ列の同期は正常）
      expect(hasPropertyAddressSync).toBe(true);
      expect(hasDisplayAddressSync).toBe(true);
      expect(hasPriceSync).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // バグ条件サマリー
  // ----------------------------------------------------------
  describe('バグ条件サマリー', () => {
    it('根本原因1の確認: databaseToSpreadsheet に property_assignee が存在しない', () => {
      const columnMappingPath = path.resolve(__dirname, '../../config/buyer-column-mapping.json');
      const columnMapping = JSON.parse(fs.readFileSync(columnMappingPath, 'utf-8'));
      const hasPropertyAssignee = 'property_assignee' in columnMapping.databaseToSpreadsheet;

      console.log('[サマリー] databaseToSpreadsheet に property_assignee が存在するか:', hasPropertyAssignee);
      console.log('[サマリー] カウンターエグザンプル: property_assignee キーが存在しないため、');
      console.log('[サマリー]   allowedData.property_assignee を設定しても BR列に書き込まれない');
      console.log('[サマリー]   → スプレッドシートのBR列（物件担当者）が空白のまま');

      // 未修正コードでは FAIL（property_assignee が存在しない）
      // 修正後は PASS
      expect(hasPropertyAssignee).toBe(true);
    });

    it('根本原因2の確認: updateWithSync の property_listings クエリに sales_assignee が含まれない', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';

      // property_listings の select クエリを抽出
      const selectMatch = funcBody.match(/from\('property_listings'\)[\s\S]*?\.select\(['"]([^'"]*)['"]\)/);
      const selectQuery = selectMatch ? selectMatch[1] : '（見つからない）';

      console.log('[サマリー] updateWithSync の property_listings select クエリ:', selectQuery);
      console.log('[サマリー] カウンターエグザンプル: select("address, display_address, price") のみで');
      console.log('[サマリー]   sales_assignee が含まれていない');
      console.log('[サマリー]   → allowedData.property_assignee が設定されない');
      console.log('[サマリー]   → スプレッドシートのBR列（物件担当者）が空白のまま');

      const hasSalesAssignee = selectQuery.includes('sales_assignee');

      // 未修正コードでは FAIL（sales_assignee が含まれていない）
      // 修正後は PASS
      expect(hasSalesAssignee).toBe(true);
    });

    it('根本原因3の確認: create の property_listings クエリに sales_assignee が含まれない', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      const funcStart = sourceCode.indexOf('  async create(buyerData: Partial<any>): Promise<any> {');
      const funcEnd = sourceCode.indexOf('\n  private async initBuyerNumberClient()', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';

      // property_listings の select クエリを抽出
      const selectMatch = funcBody.match(/from\('property_listings'\)[\s\S]*?\.select\(['"]([^'"]*)['"]\)/);
      const selectQuery = selectMatch ? selectMatch[1] : '（見つからない）';

      console.log('[サマリー] create の property_listings select クエリ:', selectQuery);
      console.log('[サマリー] カウンターエグザンプル: select("address, display_address, price") のみで');
      console.log('[サマリー]   sales_assignee が含まれていない');
      console.log('[サマリー]   → appendData.property_assignee が設定されない');
      console.log('[サマリー]   → 新規登録時にスプレッドシートのBR列（物件担当者）が空白のまま');

      const hasSalesAssignee = selectQuery.includes('sales_assignee');

      // 未修正コードでは FAIL（sales_assignee が含まれていない）
      // 修正後は PASS
      expect(hasSalesAssignee).toBe(true);
    });
  });
});
