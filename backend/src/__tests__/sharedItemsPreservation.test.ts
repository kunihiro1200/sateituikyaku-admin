/**
 * 保全プロパティテスト: 共有ページ 既存エントリーへの影響なし
 *
 * **Validates: Requirements 3.1, 3.2**
 *
 * このテストは未修正コードで**成功**することが期待される。
 * 修正後も引き続き成功することで、リグレッションがないことを確認する。
 *
 * 保全すべきベースライン動作:
 * - getAll() が既存エントリーを正常に返すこと
 * - update() が既存エントリーを正常に更新すること
 * - getCategories() が正常に動作すること
 */

import { GoogleSheetsClient, SheetRow } from '../services/GoogleSheetsClient';
import { SharedItemsService, SharedItem } from '../services/SharedItemsService';

// GoogleSheetsClient をモック
jest.mock('../services/GoogleSheetsClient');

const MockedGoogleSheetsClient = GoogleSheetsClient as jest.MockedClass<typeof GoogleSheetsClient>;

// テスト用の既存エントリーデータ（日本語キー = スプレッドシートのヘッダーと一致）
const existingRows: SheetRow[] = [
  {
    'ID': '100',
    '日付': '2026/01/10',
    '入力者': '田中',
    '共有場': '朝礼',
    '項目': '契約関係',
    'タイトル': '契約更新のお知らせ',
    '内容': '3月末に契約更新があります',
    '共有日': '2026/01/10',
    '共有できていない': null,
    '確認日': null,
  },
  {
    'ID': '101',
    '日付': '2026/02/15',
    '入力者': '鈴木',
    '共有場': '夕礼',
    '項目': '業務連絡',
    'タイトル': '業務システムメンテナンス',
    '内容': '2月20日にシステムメンテナンスがあります',
    '共有日': null,
    '共有できていない': '山田',
    '確認日': null,
  },
  {
    'ID': '102',
    '日付': '2026/03/01',
    '入力者': '山田',
    '共有場': '朝礼',
    '項目': '安全管理',
    'タイトル': '安全確認事項',
    '内容': '現場での安全確認を徹底してください',
    '共有日': '2026/03/01',
    '共有できていない': null,
    '確認日': '2026/03/02',
  },
];

describe('共有ページ保全テスト - 既存エントリーへの影響なし', () => {
  let mockReadAll: jest.Mock;
  let mockFindRowByColumn: jest.Mock;
  let mockUpdateRow: jest.Mock;
  let mockAuthenticate: jest.Mock;
  let mockGetHeaders: jest.Mock;

  beforeEach(() => {
    // スプレッドシートのヘッダー（日本語）
    const sheetHeaders = ['ID', '日付', '入力者', '共有場', '項目', 'タイトル', '内容', '共有日', '共有できていない', '確認日'];

    mockAuthenticate = jest.fn().mockResolvedValue(undefined);
    mockGetHeaders = jest.fn().mockResolvedValue(sheetHeaders);
    mockReadAll = jest.fn().mockResolvedValue([...existingRows]);
    mockFindRowByColumn = jest.fn().mockImplementation(async (columnName: string, value: string) => {
      // IDカラムで検索
      if (columnName === 'ID') {
        const index = existingRows.findIndex(row => String(row['ID']) === String(value));
        if (index !== -1) {
          return index + 2; // 1-indexed、ヘッダー行を除く
        }
      }
      return null;
    });
    mockUpdateRow = jest.fn().mockResolvedValue(undefined);

    // GoogleSheetsClient のインスタンスメソッドをモック
    MockedGoogleSheetsClient.prototype.authenticate = mockAuthenticate;
    MockedGoogleSheetsClient.prototype.getHeaders = mockGetHeaders;
    MockedGoogleSheetsClient.prototype.readAll = mockReadAll;
    MockedGoogleSheetsClient.prototype.findRowByColumn = mockFindRowByColumn;
    MockedGoogleSheetsClient.prototype.updateRow = mockUpdateRow;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================
  // getAll() の保全テスト
  // =========================================================

  describe('getAll() - 既存エントリーの一覧取得', () => {
    test('getAll() が既存エントリーを正常に返す', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const items = await service.getAll();

      // 全件返ること
      expect(items).toHaveLength(3);

      // 各エントリーのIDが正しいこと
      expect(items[0].id).toBe('100');
      expect(items[1].id).toBe('101');
      expect(items[2].id).toBe('102');
    });

    test('getAll() が返すエントリーに必須フィールドが含まれる', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const items = await service.getAll();

      for (const item of items) {
        // 必須フィールドが存在すること
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('sharing_location');
        // sharing_date は null 許容
        expect('sharing_date' in item).toBe(true);
      }
    });

    test('getAll() が sharing_location（共有場）を正しくマッピングする', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const items = await service.getAll();

      expect(items[0].sharing_location).toBe('朝礼');
      expect(items[1].sharing_location).toBe('夕礼');
      expect(items[2].sharing_location).toBe('朝礼');
    });

    test('getAll() が sharing_date（共有日）を正しくマッピングする', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const items = await service.getAll();

      // 共有日あり
      expect(items[0].sharing_date).not.toBeNull();
      // 共有日なし（null）
      expect(items[1].sharing_date).toBeNull();
      // 共有日あり
      expect(items[2].sharing_date).not.toBeNull();
    });

    test('getAll() が staff_not_shared（共有できていない）を正しくマッピングする', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const items = await service.getAll();

      expect(items[0].staff_not_shared).toBeNull();
      expect(items[1].staff_not_shared).toBe('山田');
      expect(items[2].staff_not_shared).toBeNull();
    });

    test('getAll() が readAll() を1回だけ呼び出す', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      await service.getAll();

      expect(mockReadAll).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================
  // update() の保全テスト
  // =========================================================

  describe('update() - 既存エントリーの更新', () => {
    test('update() が既存エントリーを正常に更新する', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const updates = {
        'タイトル': '更新されたタイトル',
        '内容': '更新された内容',
      };

      const result = await service.update('100', updates);

      // 更新が成功すること
      expect(result).toBeDefined();
      expect(result.id).toBe('100');
    });

    test('update() が findRowByColumn を呼び出してIDから行番号を取得する', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      await service.update('101', { 'タイトル': '更新テスト' });

      expect(mockFindRowByColumn).toHaveBeenCalledWith('ID', '101');
    });

    test('update() が updateRow を正しい行番号で呼び出す', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      // ID '100' は existingRows の index 0 → 行番号 2
      await service.update('100', { 'タイトル': '更新テスト' });

      expect(mockUpdateRow).toHaveBeenCalledWith(2, expect.any(Object));
    });

    test('update() が存在しないIDに対してエラーをスローする', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      // 存在しないIDに対して findRowByColumn が null を返す
      mockFindRowByColumn.mockResolvedValueOnce(null);

      await expect(service.update('999', { 'タイトル': '更新テスト' }))
        .rejects
        .toThrow();
    });

    test('update() が更新データに id を含めて返す', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const updates = { 'タイトル': '更新されたタイトル' };
      const result = await service.update('102', updates);

      expect(result.id).toBe('102');
    });
  });

  // =========================================================
  // getCategories() の保全テスト
  // =========================================================

  describe('getCategories() - カテゴリー一覧取得', () => {
    test('getCategories() が正常にカテゴリー一覧を返す', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const categories = await service.getCategories();

      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    test('getCategories() が返す各カテゴリーに key, label, count が含まれる', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const categories = await service.getCategories();

      for (const category of categories) {
        expect(category).toHaveProperty('key');
        expect(category).toHaveProperty('label');
        expect(category).toHaveProperty('count');
        expect(typeof category.count).toBe('number');
        expect(category.count).toBeGreaterThan(0);
      }
    });

    test('getCategories() のカウント合計がエントリー総数と一致する', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const categories = await service.getCategories();
      const totalCount = categories.reduce((sum, cat) => sum + cat.count, 0);

      // 全エントリー数（3件）と一致すること
      expect(totalCount).toBe(existingRows.length);
    });

    test('getCategories() が staff_not_shared のあるエントリーを「要確認」カテゴリーに分類する', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const categories = await service.getCategories();

      // ID '101' は staff_not_shared='山田', confirmation_date=null → '山田は要確認' カテゴリー
      const staffCategory = categories.find(cat => cat.key.includes('要確認'));
      expect(staffCategory).toBeDefined();
      expect(staffCategory!.count).toBeGreaterThanOrEqual(1);
    });

    test('getCategories() が sharing_location（共有場）をカテゴリーキーとして使用する', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const categories = await service.getCategories();
      const categoryKeys = categories.map(cat => cat.key);

      // '朝礼' カテゴリーが存在すること（ID 100, 102 が朝礼）
      // ただし ID 102 は confirmation_date があるため calculateCategory の結果が異なる可能性あり
      // → ID 100 は staff_not_shared=null なので '朝礼' カテゴリーに入る
      expect(categoryKeys).toContain('朝礼');
    });
  });

  // =========================================================
  // プロパティベーステスト: 任意の既存エントリーに対する保全確認
  // =========================================================

  describe('プロパティベーステスト - 保全プロパティ', () => {
    /**
     * Property 2: Preservation - 既存エントリーへの影響なし
     *
     * 任意の既存エントリーIDに対して getAll() が同じ結果を返すことを確認する。
     * 複数回呼び出しても結果が変わらないこと（冪等性）。
     *
     * **Validates: Requirements 3.1, 3.2**
     */
    test('getAll() は複数回呼び出しても同じ結果を返す（冪等性）', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const result1 = await service.getAll();
      const result2 = await service.getAll();

      // 件数が同じこと
      expect(result1.length).toBe(result2.length);

      // 各エントリーのIDが同じこと
      for (let i = 0; i < result1.length; i++) {
        expect(result1[i].id).toBe(result2[i].id);
        expect(result1[i].sharing_location).toBe(result2[i].sharing_location);
      }
    });

    test('任意の既存エントリーIDに対して update() が成功する', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      // 全ての既存エントリーIDに対して update() が成功すること
      const existingIds = existingRows.map(row => String(row['ID']));

      for (const id of existingIds) {
        const result = await service.update(id, { 'タイトル': `更新テスト_${id}` });
        expect(result).toBeDefined();
        expect(result.id).toBe(id);
      }

      // updateRow が existingIds.length 回呼ばれること
      expect(mockUpdateRow).toHaveBeenCalledTimes(existingIds.length);
    });

    test('getCategories() の結果は getAll() の結果から導出できる', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const items = await service.getAll();
      const categories = await service.getCategories();

      // カテゴリーのカウント合計 = エントリー総数
      const totalFromCategories = categories.reduce((sum, cat) => sum + cat.count, 0);
      expect(totalFromCategories).toBe(items.length);
    });

    test('update() 後も getAll() は同じ件数のエントリーを返す', async () => {
      const service = new SharedItemsService();
      await service.initialize();

      const beforeItems = await service.getAll();
      const beforeCount = beforeItems.length;

      // 既存エントリーを更新
      await service.update('100', { 'タイトル': '更新後のタイトル' });

      const afterItems = await service.getAll();
      const afterCount = afterItems.length;

      // 更新後も件数が変わらないこと
      expect(afterCount).toBe(beforeCount);
    });
  });
});
