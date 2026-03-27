/**
 * 保全プロパティテスト: 非暗号化フィールドの書き込み動作が変わらない
 *
 * このテストは未修正コードでベースライン動作を確認するためのものです。
 * isBugCondition(seller) が false（name・phone_number・email が平文）の売主データを対象にします。
 *
 * 未修正コードでは全テストが PASS することが期待されます（ベースライン確認）。
 * 修正後も全テストが PASS することで、リグレッションがないことを確認します。
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { SpreadsheetSyncService } from '../SpreadsheetSyncService';

// ============================================================
// モック設定
// ============================================================

// GoogleSheetsClient をモック
jest.mock('../GoogleSheetsClient');

// GoogleSheetsClient のモックインスタンス（各テストで再利用）
const mockSheetsClient = {
  authenticate: jest.fn().mockResolvedValue(undefined),
  findRowByColumn: jest.fn(),
  appendRow: jest.fn().mockResolvedValue(undefined),
  updateRowPartial: jest.fn().mockResolvedValue(undefined),
} as any;

// ============================================================
// ヘルパー: 暗号文かどうかを判定
// AES-256-GCM 暗号文の最小長: IV(16) + SALT(64) + TAG(16) = 96 バイト → Base64 で 128 文字以上
// ============================================================
function isEncryptedValue(value: string): boolean {
  if (!value || value === '') return false;
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length >= 96;
  } catch {
    return false;
  }
}

// ============================================================
// Supabase モック生成ヘルパー（単一売主）
// ============================================================
function createSupabaseMock(sellerData: any) {
  return {
    from: jest.fn().mockImplementation((_table: string) => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: sellerData, error: null }),
        }),
        in: jest.fn().mockResolvedValue({ data: [sellerData], error: null }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
        in: jest.fn().mockResolvedValue({ error: null }),
      }),
    })),
  } as any;
}

// ============================================================
// 平文の売主データ（isBugCondition = false）
// ============================================================
function createPlaintextSeller(overrides: Partial<any> = {}): any {
  return {
    id: 'preservation-seller-id-001',
    seller_number: 'AA88001',
    name: '山田花子',           // 平文
    phone_number: '08011112222', // 平文
    email: 'yamada@example.com', // 平文
    address: '大阪府大阪市1-2-3',
    status: '追客中',
    next_call_date: '2026-05-01',
    visit_date: null,
    visit_time: null,
    visit_assignee: null,
    inquiry_date: '2026-02-01',
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    synced_to_sheet_at: null,
    ...overrides,
  };
}

// ============================================================
// テストスイート
// ============================================================

describe('保全プロパティ: 非暗号化フィールドの書き込み動作が変わらない', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // デフォルト: 既存行なし → appendRow を呼ぶ
    mockSheetsClient.findRowByColumn.mockResolvedValue(null);
    mockSheetsClient.appendRow.mockResolvedValue(undefined);
    mockSheetsClient.updateRowPartial.mockResolvedValue(undefined);
  });

  // ============================================================
  // テスト1: 非暗号化フィールド（status・next_call_date・seller_number）が正しく書き込まれる
  // ============================================================
  describe('テスト1: 非暗号化フィールドが正しく書き込まれる', () => {
    it('status・next_call_date・seller_number 等の非暗号化フィールドが変更なくスプレッドシートに書き込まれること', async () => {
      // Arrange: 平文フィールドを持つ売主データ
      const mockSeller = createPlaintextSeller({
        status: '追客中',
        next_call_date: '2026-05-15',
        seller_number: 'AA88001',
      });

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act
      const result = await service.syncToSpreadsheet('preservation-seller-id-001');

      // Assert: 同期が成功すること
      expect(result.success).toBe(true);
      expect(result.operation).toBe('create'); // 新規行追加

      // appendRow が呼ばれたことを確認
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);
      const sheetRow = mockSheetsClient.appendRow.mock.calls[0][0];

      // 売主番号が正しく書き込まれること
      expect(sheetRow['売主番号']).toBe('AA88001');

      // 状況（当社）が正しく書き込まれること
      expect(sheetRow['状況（当社）']).toBe('追客中');

      // 次電日が正しく書き込まれること（日付フォーマット変換後）
      expect(sheetRow['次電日']).toBeDefined();
    });
  });

  // ============================================================
  // テスト2: email = null の場合にクラッシュせず「メールアドレス」列が空のまま書き込まれる
  // ============================================================
  describe('テスト2: email = null の場合の動作', () => {
    it('email が null の場合、クラッシュせず「メールアドレス」列が空のまま書き込まれること', async () => {
      // Arrange: email が null の売主データ
      const mockSeller = createPlaintextSeller({
        id: 'preservation-seller-id-002',
        seller_number: 'AA88002',
        email: null, // email が null
      });

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act: クラッシュしないことを確認
      let result: any;
      let thrownError: any = null;
      try {
        result = await service.syncToSpreadsheet('preservation-seller-id-002');
      } catch (err) {
        thrownError = err;
      }

      // Assert: 例外が発生しないこと
      expect(thrownError).toBeNull();
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // appendRow が呼ばれたことを確認
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);
      const sheetRow = mockSheetsClient.appendRow.mock.calls[0][0];

      // 「メールアドレス」列が空（空文字・undefined・null のいずれか）であること
      const emailValue = sheetRow['メールアドレス'];
      expect(emailValue === '' || emailValue === undefined || emailValue === null).toBe(true);
    });

    it('email が空文字の場合も、クラッシュせず「メールアドレス」列が空のまま書き込まれること', async () => {
      // Arrange: email が空文字の売主データ
      const mockSeller = createPlaintextSeller({
        id: 'preservation-seller-id-003',
        seller_number: 'AA88003',
        email: '', // email が空文字
      });

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act
      const result = await service.syncToSpreadsheet('preservation-seller-id-003');

      // Assert
      expect(result.success).toBe(true);
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);
      const sheetRow = mockSheetsClient.appendRow.mock.calls[0][0];

      const emailValue = sheetRow['メールアドレス'];
      expect(emailValue === '' || emailValue === undefined || emailValue === null).toBe(true);
    });
  });

  // ============================================================
  // テスト3: seller_number による既存行検索（findRowByColumn）が正しく動作する
  // ============================================================
  describe('テスト3: seller_number による既存行検索が正しく動作する', () => {
    it('既存行が見つかった場合、updateRowPartial が呼ばれること（appendRow は呼ばれない）', async () => {
      // Arrange: 既存行あり（行番号 5）
      mockSheetsClient.findRowByColumn.mockResolvedValue(5);

      const mockSeller = createPlaintextSeller({
        id: 'preservation-seller-id-004',
        seller_number: 'AA88004',
      });

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act
      const result = await service.syncToSpreadsheet('preservation-seller-id-004');

      // Assert: 更新操作が実行されること
      expect(result.success).toBe(true);
      expect(result.operation).toBe('update');

      // updateRowPartial が呼ばれること
      expect(mockSheetsClient.updateRowPartial).toHaveBeenCalledTimes(1);
      expect(mockSheetsClient.updateRowPartial).toHaveBeenCalledWith(5, expect.any(Object));

      // appendRow は呼ばれないこと
      expect(mockSheetsClient.appendRow).not.toHaveBeenCalled();
    });

    it('findRowByColumn が「売主番号」列で検索されること', async () => {
      // Arrange
      mockSheetsClient.findRowByColumn.mockResolvedValue(null);

      const mockSeller = createPlaintextSeller({
        id: 'preservation-seller-id-005',
        seller_number: 'AA88005',
      });

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act
      await service.syncToSpreadsheet('preservation-seller-id-005');

      // Assert: findRowByColumn が「売主番号」列で呼ばれること
      expect(mockSheetsClient.findRowByColumn).toHaveBeenCalledWith('売主番号', 'AA88005');
    });
  });

  // ============================================================
  // テスト4: 既存行がない場合の新規行追加（appendRow）ロジックが変更されていない
  // ============================================================
  describe('テスト4: 既存行がない場合の新規行追加ロジック', () => {
    it('既存行がない場合、appendRow が呼ばれ operation が create であること', async () => {
      // Arrange: 既存行なし
      mockSheetsClient.findRowByColumn.mockResolvedValue(null);

      const mockSeller = createPlaintextSeller({
        id: 'preservation-seller-id-006',
        seller_number: 'AA88006',
      });

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act
      const result = await service.syncToSpreadsheet('preservation-seller-id-006');

      // Assert
      expect(result.success).toBe(true);
      expect(result.operation).toBe('create');
      expect(result.rowsAffected).toBe(1);

      // appendRow が1回呼ばれること
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);

      // updateRowPartial は呼ばれないこと
      expect(mockSheetsClient.updateRowPartial).not.toHaveBeenCalled();
    });

    it('新規行追加時、SheetRow に売主番号が含まれること', async () => {
      // Arrange
      mockSheetsClient.findRowByColumn.mockResolvedValue(null);

      const mockSeller = createPlaintextSeller({
        id: 'preservation-seller-id-007',
        seller_number: 'AA88007',
        name: '鈴木一郎',
        status: '査定済み',
      });

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act
      await service.syncToSpreadsheet('preservation-seller-id-007');

      // Assert: appendRow に渡された SheetRow を確認
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);
      const sheetRow = mockSheetsClient.appendRow.mock.calls[0][0];

      // 売主番号が含まれること
      expect(sheetRow['売主番号']).toBe('AA88007');

      // 名前が平文で書き込まれること（暗号文でないこと）
      const nameValue = sheetRow['名前(漢字のみ）'];
      if (nameValue !== undefined && nameValue !== '') {
        expect(isEncryptedValue(String(nameValue))).toBe(false);
        expect(nameValue).toBe('鈴木一郎');
      }
    });
  });

  // ============================================================
  // テスト5: 平文フィールドが暗号文として書き込まれないこと（保全確認）
  // ============================================================
  describe('テスト5: 平文フィールドが暗号文として書き込まれないこと', () => {
    it('平文の name・phone_number・email が暗号文として書き込まれないこと', async () => {
      // Arrange: 全フィールドが平文の売主データ
      const mockSeller = createPlaintextSeller({
        id: 'preservation-seller-id-008',
        seller_number: 'AA88008',
        name: '田中次郎',
        phone_number: '09099998888',
        email: 'tanaka@example.com',
      });

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act
      const result = await service.syncToSpreadsheet('preservation-seller-id-008');

      // Assert
      expect(result.success).toBe(true);
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);
      const sheetRow = mockSheetsClient.appendRow.mock.calls[0][0];

      // 名前が暗号文でないこと
      const nameValue = sheetRow['名前(漢字のみ）'];
      if (nameValue !== undefined && nameValue !== '') {
        expect(isEncryptedValue(String(nameValue))).toBe(false);
      }

      // 電話番号が暗号文でないこと
      const phoneValue = sheetRow['電話番号\nハイフン不要'];
      if (phoneValue !== undefined && phoneValue !== '') {
        expect(isEncryptedValue(String(phoneValue))).toBe(false);
      }

      // メールアドレスが暗号文でないこと
      const emailValue = sheetRow['メールアドレス'];
      if (emailValue !== undefined && emailValue !== '') {
        expect(isEncryptedValue(String(emailValue))).toBe(false);
      }
    });
  });

  // ============================================================
  // テスト6: syncBatchToSpreadsheet でも保全動作が維持される
  // ============================================================
  describe('テスト6: syncBatchToSpreadsheet の保全動作', () => {
    it('バッチ同期でも非暗号化フィールドが正しく書き込まれること', async () => {
      // Arrange: 平文フィールドを持つ複数の売主データ
      const mockSellers = [
        createPlaintextSeller({
          id: 'preservation-seller-id-009',
          seller_number: 'AA88009',
          name: '佐藤三郎',
          status: '追客中',
        }),
      ];

      const mockSupabase = {
        from: jest.fn().mockImplementation((_table: string) => ({
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: mockSellers, error: null }),
          }),
          update: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ error: null }),
          }),
        })),
      } as any;

      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act
      const result = await service.syncBatchToSpreadsheet(['preservation-seller-id-009']);

      // Assert: バッチ同期が成功すること
      expect(result.success).toBe(true);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);

      // appendRow が呼ばれたことを確認
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);
      const sheetRow = mockSheetsClient.appendRow.mock.calls[0][0];

      // 売主番号が正しく書き込まれること
      expect(sheetRow['売主番号']).toBe('AA88009');

      // 名前が暗号文でないこと
      const nameValue = sheetRow['名前(漢字のみ）'];
      if (nameValue !== undefined && nameValue !== '') {
        expect(isEncryptedValue(String(nameValue))).toBe(false);
      }
    });

    it('バッチ同期で既存行がある場合、updateRowPartial が呼ばれること', async () => {
      // Arrange: 既存行あり
      mockSheetsClient.findRowByColumn.mockResolvedValue(10);

      const mockSellers = [
        createPlaintextSeller({
          id: 'preservation-seller-id-010',
          seller_number: 'AA88010',
        }),
      ];

      const mockSupabase = {
        from: jest.fn().mockImplementation((_table: string) => ({
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: mockSellers, error: null }),
          }),
          update: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ error: null }),
          }),
        })),
      } as any;

      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act
      const result = await service.syncBatchToSpreadsheet(['preservation-seller-id-010']);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSheetsClient.updateRowPartial).toHaveBeenCalledTimes(1);
      expect(mockSheetsClient.appendRow).not.toHaveBeenCalled();
    });
  });
});
