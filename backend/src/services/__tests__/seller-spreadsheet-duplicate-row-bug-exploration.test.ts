/**
 * バグ条件探索テスト: 売主スプレッドシート重複行追加バグ
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 * 
 * このテストは修正後のコードで実行し、バグが修正されたことを確認します。
 * 
 * バグ条件 (isBugCondition):
 *   同じ売主番号に対して複数の同期リクエストが短時間（0.5秒間隔）で実行される場合、
 *   既存行が存在するにもかかわらず findRowByColumn() が null を返し、
 *   重複行が追加される。
 * 
 * 期待される動作（修正後）:
 *   - ロック機構により、同じ売主番号の同期処理が直列化される
 *   - リトライロジックにより、既存行が確実に見つかる
 *   - 重複行が追加されず、既存行が更新される
 * 
 * 期待される結果（修正後）:
 *   テストが成功する（バグが修正されたことを証明）
 */

import { SpreadsheetSyncService } from '../SpreadsheetSyncService';
import { GoogleSheetsClient } from '../GoogleSheetsClient';
import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// モックヘルパー
// ============================================================

/**
 * Supabaseモックを作成
 */
function createSupabaseMock(mockSeller: any): any {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockSeller,
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    }),
  } as any;
}

/**
 * GoogleSheetsClientモックを作成（競合状態をシミュレート）
 */
function createGoogleSheetsClientMock(): any {
  let appendedRows: any[] = [];
  let updatedRows: Map<number, any> = new Map();
  let findCallCount = 0;

  return {
    authenticate: jest.fn().mockResolvedValue(undefined),
    getHeaders: jest.fn().mockResolvedValue([
      '売主番号',
      '名前(漢字のみ）',
      '電話番号\nハイフン不要',
      'メールアドレス',
    ]),
    
    // ヘッダーキャッシュをクリア（修正で追加されたメソッド）
    clearHeaderCache: jest.fn(),
    
    // 競合状態をシミュレート: 最初の呼び出しでは null を返し、2回目以降は行番号を返す
    findRowByColumn: jest.fn().mockImplementation(async (columnName: string, value: string) => {
      findCallCount++;
      console.log(`🔍 [Mock] findRowByColumn called (count: ${findCallCount}), value: ${value}`);
      
      // 最初の呼び出しでは null を返す（競合状態をシミュレート）
      if (findCallCount === 1) {
        console.log(`❌ [Mock] First call - returning null (simulating race condition)`);
        return null;
      }
      
      // 2回目以降は行番号を返す（既存行が見つかる）
      console.log(`✅ [Mock] Subsequent call - returning row 2 (existing row found)`);
      return 2;
    }),
    
    appendRow: jest.fn().mockImplementation(async (row: any) => {
      console.log(`➕ [Mock] appendRow called, total appended: ${appendedRows.length + 1}`);
      appendedRows.push(row);
    }),
    
    updateRowPartial: jest.fn().mockImplementation(async (rowIndex: number, row: any) => {
      console.log(`📝 [Mock] updateRowPartial called for row ${rowIndex}`);
      updatedRows.set(rowIndex, row);
    }),
    
    // テスト用のヘルパーメソッド
    _getAppendedRows: () => appendedRows,
    _getUpdatedRows: () => updatedRows,
    _resetCallCount: () => { findCallCount = 0; },
  } as any;
}

// ============================================================
// テストスイート
// ============================================================

describe('バグ条件探索: 売主スプレッドシート重複行追加バグ', () => {
  
  describe('Property 1: Bug Condition - 既存行検索の失敗（競合状態）', () => {
    
    it('同じ売主番号に対して複数の同期リクエストを短時間（0.5秒間隔）で実行すると、重複行が追加される', async () => {
      // Arrange
      const mockSeller = {
        id: 'test-seller-id',
        seller_number: 'AA13888',
        name: '山田太郎',
        phone_number: '09012345678',
        email: 'test@example.com',
      };

      const mockSupabase = createSupabaseMock(mockSeller);
      const mockSheetsClient = createGoogleSheetsClientMock();
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act: 同じ売主番号に対して2回の同期を短時間（0.5秒間隔）で実行
      console.log('\n🚀 [Test] Starting first sync...');
      const result1Promise = service.syncToSpreadsheet('test-seller-id');
      
      // 0.5秒待機
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('\n🚀 [Test] Starting second sync (0.5s after first)...');
      const result2Promise = service.syncToSpreadsheet('test-seller-id');
      
      // 両方の同期が完了するまで待つ
      const [result1, result2] = await Promise.all([result1Promise, result2Promise]);

      // Assert: 期待される動作（修正後）
      // - リトライロジックにより、既存行が確実に見つかる
      // - 両方とも既存行を更新（operation: 'update'）
      // - 重複行は追加されない（appendRow は呼ばれない）
      
      console.log('\n📊 [Test] Results:');
      console.log('Result 1:', result1);
      console.log('Result 2:', result2);
      console.log('Appended rows:', mockSheetsClient._getAppendedRows().length);
      console.log('Updated rows:', mockSheetsClient._getUpdatedRows().size);

      // 修正後は、リトライロジックにより既存行が見つかり、両方とも更新となる
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      // 期待される動作: appendRow は呼ばれない（リトライで既存行が見つかる）
      expect(mockSheetsClient._getAppendedRows().length).toBe(0);
      
      // 期待される動作: updateRowPartial は1回呼ばれる
      expect(mockSheetsClient._getUpdatedRows().size).toBe(1);
      
      // 期待される動作: 両方とも update
      expect(result1.operation).toBe('update');
      expect(result2.operation).toBe('update');
    });

    it('同じ売主番号に対して3回の同期を即座に実行すると、重複行が追加される', async () => {
      // Arrange
      const mockSeller = {
        id: 'test-seller-id-2',
        seller_number: 'AA13889',
        name: '佐藤花子',
        phone_number: '08012345678',
        email: 'test2@example.com',
      };

      const mockSupabase = createSupabaseMock(mockSeller);
      const mockSheetsClient = createGoogleSheetsClientMock();
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act: 同じ売主番号に対して3回の同期を即座に実行
      console.log('\n🚀 [Test] Starting 3 concurrent syncs...');
      const results = await Promise.all([
        service.syncToSpreadsheet('test-seller-id-2'),
        service.syncToSpreadsheet('test-seller-id-2'),
        service.syncToSpreadsheet('test-seller-id-2'),
      ]);

      // Assert
      console.log('\n📊 [Test] Results:');
      results.forEach((result, index) => {
        console.log(`Result ${index + 1}:`, result);
      });
      console.log('Appended rows:', mockSheetsClient._getAppendedRows().length);
      console.log('Updated rows:', mockSheetsClient._getUpdatedRows().size);

      // 全ての同期が成功する
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // 期待される動作: appendRow は呼ばれない（リトライで既存行が見つかる）
      expect(mockSheetsClient._getAppendedRows().length).toBe(0);
      
      // 期待される動作: updateRowPartial は1回呼ばれる
      expect(mockSheetsClient._getUpdatedRows().size).toBeGreaterThanOrEqual(1);
      
      // 期待される動作: 全て update（ロック機構により直列化される）
      const createCount = results.filter(r => r.operation === 'create').length;
      const updateCount = results.filter(r => r.operation === 'update').length;
      
      expect(createCount).toBe(0);
      expect(updateCount).toBe(3);
    });

    it('正常動作: 同期が完了してから次の同期を実行すると、既存行が正しく更新される', async () => {
      // Arrange
      const mockSeller = {
        id: 'test-seller-id-3',
        seller_number: 'AA13890',
        name: '鈴木一郎',
        phone_number: '07012345678',
        email: 'test3@example.com',
      };

      const mockSupabase = createSupabaseMock(mockSeller);
      const mockSheetsClient = createGoogleSheetsClientMock();
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act: 1回目の同期を実行し、完了を待つ
      console.log('\n🚀 [Test] Starting first sync...');
      const result1 = await service.syncToSpreadsheet('test-seller-id-3');
      
      console.log('✅ [Test] First sync completed');
      
      // 2回目の同期を実行
      console.log('\n🚀 [Test] Starting second sync (after first completed)...');
      const result2 = await service.syncToSpreadsheet('test-seller-id-3');
      
      console.log('✅ [Test] Second sync completed');

      // Assert
      console.log('\n📊 [Test] Results:');
      console.log('Result 1:', result1);
      console.log('Result 2:', result2);
      console.log('Appended rows:', mockSheetsClient._getAppendedRows().length);
      console.log('Updated rows:', mockSheetsClient._getUpdatedRows().size);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      // 期待される動作: appendRow は呼ばれない（リトライで既存行が見つかる）
      expect(mockSheetsClient._getAppendedRows().length).toBe(0);
      
      // 期待される動作: updateRowPartial は1回呼ばれる
      expect(mockSheetsClient._getUpdatedRows().size).toBe(1);
      
      // 期待される動作: 両方とも update
      expect(result1.operation).toBe('update');
      expect(result2.operation).toBe('update');
    });
  });
});
