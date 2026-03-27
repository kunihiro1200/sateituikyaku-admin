/**
 * バグ条件探索テスト: SpreadsheetSyncService が暗号化フィールドを復号せずにスプレッドシートに書き込む
 *
 * このテストは未修正コードでバグを再現し、根本原因を確認するためのものです。
 *
 * バグ条件 (isBugCondition):
 *   SpreadsheetSyncService が Supabase から取得した売主データの
 *   name・phone_number・email を decrypt() せずに ColumnMapper.mapToSheet() に渡している。
 *   その結果、スプレッドシートの「名前(漢字のみ）」「電話番号\nハイフン不要」「メールアドレス」列に
 *   AES-256-GCM の Base64 暗号文（例: acLCZeMGRDaf/DM8rFZBircz+...）が書き込まれる。
 *
 * 未修正コードでは:
 *   - ケース1〜3 は FAIL する（暗号文ではなく平文が書き込まれることをアサートするため）
 *   - これがバグの存在を証明する
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import { SpreadsheetSyncService } from '../SpreadsheetSyncService';
import { encrypt } from '../../utils/encryption';

// ============================================================
// テスト用 ENCRYPTION_KEY（32文字）を beforeAll で設定
// ============================================================
const TEST_ENCRYPTION_KEY = 'TestEncryptKey123456789012345678'; // 32文字

// 暗号化済みデータ（beforeAll で生成）
let encryptedName: string;
let encryptedPhone: string;
let encryptedEmail: string;

// ============================================================
// モック設定
// ============================================================

// GoogleSheetsClient をモック
jest.mock('../GoogleSheetsClient');

// GoogleSheetsClient のモックインスタンス
const mockSheetsClient = {
  authenticate: jest.fn().mockResolvedValue(undefined),
  findRowByColumn: jest.fn().mockResolvedValue(null), // 既存行なし → appendRow を呼ぶ
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
// Supabase モック生成ヘルパー
// ============================================================
function createSupabaseMock(sellerData: any) {
  return {
    from: jest.fn().mockImplementation((table: string) => ({
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
// テストスイート
// ============================================================

describe('バグ条件探索: SpreadsheetSyncService が暗号化フィールドを復号せずに書き込む', () => {
  beforeAll(() => {
    // テスト用 ENCRYPTION_KEY を設定してから暗号化済みデータを生成
    const originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

    encryptedName = encrypt('田中太郎');
    encryptedPhone = encrypt('09012345678');
    encryptedEmail = encrypt('test@example.com');

    // 元のキーを復元
    if (originalKey !== undefined) {
      process.env.ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }

    // 暗号化が正しく行われたことを確認
    expect(isEncryptedValue(encryptedName)).toBe(true);
    expect(isEncryptedValue(encryptedPhone)).toBe(true);
    expect(isEncryptedValue(encryptedEmail)).toBe(true);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // ケース1: name が暗号文のまま「名前(漢字のみ）」列に書き込まれる
  // ============================================================
  describe('ケース1: name が暗号化されている場合', () => {
    it('スプレッドシートの「名前(漢字のみ）」列に平文「田中太郎」が書き込まれるべきである（未修正コードでは FAIL）', async () => {
      // Arrange: 暗号化済み name を持つ売主データ
      const mockSeller = {
        id: 'test-seller-id-001',
        seller_number: 'AA99001',
        name: encryptedName,
        phone_number: encryptedPhone,
        email: encryptedEmail,
        address: '東京都渋谷区1-1-1',
        status: '追客中',
        next_call_date: '2026-04-01',
        visit_date: null,
        visit_time: null,
        visit_assignee: null,
        inquiry_date: '2026-01-01',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        synced_to_sheet_at: null,
      };

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      // Act: テスト用キーで復号できるよう ENCRYPTION_KEY を設定
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
      try {
        await service.syncToSpreadsheet('test-seller-id-001');
      } finally {
        if (originalKey !== undefined) {
          process.env.ENCRYPTION_KEY = originalKey;
        } else {
          delete process.env.ENCRYPTION_KEY;
        }
      }

      // Assert: appendRow に渡された SheetRow を確認
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);
      const sheetRow = mockSheetsClient.appendRow.mock.calls[0][0];

      // 「名前(漢字のみ）」列の値が平文であることを確認
      const nameValue = sheetRow['名前(漢字のみ）'];
      expect(nameValue).toBeDefined();

      // 未修正コードでは暗号文が書き込まれるため、このアサートが FAIL する → バグの存在を証明
      // 修正後は decrypt() が呼ばれ、平文「田中太郎」が書き込まれる
      expect(isEncryptedValue(String(nameValue))).toBe(false);
      expect(nameValue).toBe('田中太郎');
    });
  });

  // ============================================================
  // ケース2: phone_number が暗号文のまま「電話番号\nハイフン不要」列に書き込まれる
  // ============================================================
  describe('ケース2: phone_number が暗号化されている場合', () => {
    it('スプレッドシートの「電話番号\\nハイフン不要」列に平文「09012345678」が書き込まれるべきである（未修正コードでは FAIL）', async () => {
      // Arrange
      const mockSeller = {
        id: 'test-seller-id-002',
        seller_number: 'AA99002',
        name: encryptedName,
        phone_number: encryptedPhone,
        email: encryptedEmail,
        address: '東京都渋谷区1-1-1',
        status: '追客中',
        next_call_date: '2026-04-01',
        visit_date: null,
        visit_time: null,
        visit_assignee: null,
        inquiry_date: '2026-01-01',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        synced_to_sheet_at: null,
      };

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
      try {
        await service.syncToSpreadsheet('test-seller-id-002');
      } finally {
        if (originalKey !== undefined) {
          process.env.ENCRYPTION_KEY = originalKey;
        } else {
          delete process.env.ENCRYPTION_KEY;
        }
      }

      // Assert
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);
      const sheetRow = mockSheetsClient.appendRow.mock.calls[0][0];

      const phoneValue = sheetRow['電話番号\nハイフン不要'];
      expect(phoneValue).toBeDefined();

      // 未修正コードでは暗号文が書き込まれるため、このアサートが FAIL する → バグの存在を証明
      expect(isEncryptedValue(String(phoneValue))).toBe(false);
      expect(phoneValue).toBe('09012345678');
    });
  });

  // ============================================================
  // ケース3: email が暗号文のまま「メールアドレス」列に書き込まれる
  // ============================================================
  describe('ケース3: email が暗号化されている場合', () => {
    it('スプレッドシートの「メールアドレス」列に平文「test@example.com」が書き込まれるべきである（未修正コードでは FAIL）', async () => {
      // Arrange
      const mockSeller = {
        id: 'test-seller-id-003',
        seller_number: 'AA99003',
        name: encryptedName,
        phone_number: encryptedPhone,
        email: encryptedEmail,
        address: '東京都渋谷区1-1-1',
        status: '追客中',
        next_call_date: '2026-04-01',
        visit_date: null,
        visit_time: null,
        visit_assignee: null,
        inquiry_date: '2026-01-01',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        synced_to_sheet_at: null,
      };

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
      try {
        await service.syncToSpreadsheet('test-seller-id-003');
      } finally {
        if (originalKey !== undefined) {
          process.env.ENCRYPTION_KEY = originalKey;
        } else {
          delete process.env.ENCRYPTION_KEY;
        }
      }

      // Assert
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);
      const sheetRow = mockSheetsClient.appendRow.mock.calls[0][0];

      const emailValue = sheetRow['メールアドレス'];
      expect(emailValue).toBeDefined();

      // 未修正コードでは暗号文が書き込まれるため、このアサートが FAIL する → バグの存在を証明
      expect(isEncryptedValue(String(emailValue))).toBe(false);
      expect(emailValue).toBe('test@example.com');
    });
  });

  // ============================================================
  // ケース4: email が null の場合はクラッシュしない（修正前後ともに PASS する可能性あり）
  // ============================================================
  describe('ケース4: email が null の場合', () => {
    it('「メールアドレス」列が空のまま書き込まれ、クラッシュしないこと', async () => {
      // Arrange
      const mockSeller = {
        id: 'test-seller-id-004',
        seller_number: 'AA99004',
        name: encryptedName,
        phone_number: encryptedPhone,
        email: null, // email が null
        address: '東京都渋谷区1-1-1',
        status: '追客中',
        next_call_date: '2026-04-01',
        visit_date: null,
        visit_time: null,
        visit_assignee: null,
        inquiry_date: '2026-01-01',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        synced_to_sheet_at: null,
      };

      const mockSupabase = createSupabaseMock(mockSeller);
      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
      let result: any;
      try {
        result = await service.syncToSpreadsheet('test-seller-id-004');
      } finally {
        if (originalKey !== undefined) {
          process.env.ENCRYPTION_KEY = originalKey;
        } else {
          delete process.env.ENCRYPTION_KEY;
        }
      }

      // Assert: 成功すること
      expect(result.success).toBe(true);
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);

      const sheetRow = mockSheetsClient.appendRow.mock.calls[0][0];
      // email が null の場合、「メールアドレス」列は空文字または undefined
      const emailValue = sheetRow['メールアドレス'];
      expect(emailValue === '' || emailValue === undefined || emailValue === null).toBe(true);
    });
  });

  // ============================================================
  // ケース5: syncBatchToSpreadsheet でも同様のバグが発生する
  // ============================================================
  describe('ケース5: syncBatchToSpreadsheet でも暗号化フィールドが復号されない', () => {
    it('バッチ同期でも「名前(漢字のみ）」列に平文が書き込まれるべきである（未修正コードでは FAIL）', async () => {
      // Arrange
      const mockSellers = [
        {
          id: 'test-seller-id-005',
          seller_number: 'AA99005',
          name: encryptedName,
          phone_number: encryptedPhone,
          email: encryptedEmail,
          address: '東京都渋谷区1-1-1',
          status: '追客中',
          next_call_date: '2026-04-01',
          visit_date: null,
          visit_time: null,
          visit_assignee: null,
          inquiry_date: '2026-01-01',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          synced_to_sheet_at: null,
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => ({
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: mockSellers, error: null }),
          }),
          update: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ error: null }),
          }),
        })),
      } as any;

      const service = new SpreadsheetSyncService(mockSheetsClient, mockSupabase);

      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
      try {
        await service.syncBatchToSpreadsheet(['test-seller-id-005']);
      } finally {
        if (originalKey !== undefined) {
          process.env.ENCRYPTION_KEY = originalKey;
        } else {
          delete process.env.ENCRYPTION_KEY;
        }
      }

      // Assert
      expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);
      const sheetRow = mockSheetsClient.appendRow.mock.calls[0][0];

      const nameValue = sheetRow['名前(漢字のみ）'];
      expect(nameValue).toBeDefined();

      // 未修正コードでは暗号文が書き込まれるため、このアサートが FAIL する → バグの存在を証明
      expect(isEncryptedValue(String(nameValue))).toBe(false);
      expect(nameValue).toBe('田中太郎');
    });
  });
});
