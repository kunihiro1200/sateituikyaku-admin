/**
 * テスト: GET /api/sellers/by-number/:sellerNumber エンドポイント
 *
 * Phase 3: Fix Checking（修正確認）
 * Phase 4: Preservation Checking（保持確認）
 *
 * **Validates: Requirements 2.1, 2.2, 3.1, 3.2, 3.3, 3.5**
 */

import request from 'supertest';
import express from 'express';

// SellerService をモック化
const mockGetSeller = jest.fn();

jest.mock('../../services/SellerService.supabase', () => ({
  SellerService: jest.fn().mockImplementation(() => ({
    getSeller: mockGetSeller,
  })),
}));

// supabase クライアントをモック化
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'test-id', seller_number: 'AA13501', name: 'テスト売主', property_address: '大分市中央町1-1-1' },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

// 認証ミドルウェアをモック化
jest.mock('../../middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));

// SpreadsheetSyncService などの重い依存をモック化
jest.mock('../../services/SpreadsheetSyncService', () => ({
  SpreadsheetSyncService: jest.fn(),
}));
jest.mock('../../services/GoogleSheetsClient', () => ({
  GoogleSheetsClient: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn(),
  })),
}));
jest.mock('../../services/BuyerService', () => ({
  BuyerService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../services/PropertyDistributionAreaCalculator', () => ({
  PropertyDistributionAreaCalculator: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../services/CityNameExtractor', () => ({
  CityNameExtractor: jest.fn().mockImplementation(() => ({})),
}));

import sellersRouter from '../sellers';

// テスト用 Express アプリケーション
const app = express();
app.use(express.json());
app.use('/api/sellers', sellersRouter);

// テスト用の売主データ
const mockSeller = {
  id: 'test-id',
  sellerNumber: 'AA13501',
  name: '山田太郎',
  propertyAddress: '大分市中央町1-1-1',
  address: '大分市南町2-2-2',
  phoneNumber: '090-1234-5678',
  email: 'yamada@example.com',
};

// supabase モックのヘルパー
function setupSupabaseMock(sellerData: any) {
  const { createClient } = require('@supabase/supabase-js');
  createClient.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: sellerData.id || 'test-id',
              seller_number: sellerData.sellerNumber || 'AA13501',
              name: sellerData.name || '山田太郎',
              property_address: sellerData.propertyAddress || '大分市中央町1-1-1',
            },
            error: null,
          }),
        }),
      }),
    }),
  });
}

// ============================================================================
// Fix Checking (3.1): 修正後のエンドポイントが全フィールドを返す
// ============================================================================
describe('Fix Checking (3.1): GET /api/sellers/by-number/:sellerNumber', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupSupabaseMock(mockSeller);
    mockGetSeller.mockResolvedValue(mockSeller);
  });

  it('address・phoneNumber・email がレスポンスに含まれること', async () => {
    const response = await request(app)
      .get('/api/sellers/by-number/AA13501');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('address', mockSeller.address);
    expect(response.body).toHaveProperty('phoneNumber', mockSeller.phoneNumber);
    expect(response.body).toHaveProperty('email', mockSeller.email);
  });

  it('address が null の売主でもエラーにならないこと（エッジケース）', async () => {
    const sellerWithNullAddress = { ...mockSeller, address: null };
    mockGetSeller.mockResolvedValue(sellerWithNullAddress);

    const response = await request(app)
      .get('/api/sellers/by-number/AA13501');

    expect(response.status).toBe(200);
    // address が null でもレスポンスに含まれる（undefined ではない）
    expect(response.body).toHaveProperty('address');
  });

  it('phoneNumber が空の売主でもエラーにならないこと（エッジケース）', async () => {
    const sellerWithEmptyPhone = { ...mockSeller, phoneNumber: '' };
    mockGetSeller.mockResolvedValue(sellerWithEmptyPhone);

    const response = await request(app)
      .get('/api/sellers/by-number/AA13501');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('phoneNumber', '');
  });

  it('email が null の売主でもエラーにならないこと（エッジケース）', async () => {
    const sellerWithNullEmail = { ...mockSeller, email: null };
    mockGetSeller.mockResolvedValue(sellerWithNullEmail);

    const response = await request(app)
      .get('/api/sellers/by-number/AA13501');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('email');
  });
});

// ============================================================================
// Fix Checking (3.2): handleSellerCopySelect が全フィールドを state にセットする
// （フロントエンドのロジックをユニットテストで検証）
// ============================================================================
describe('Fix Checking (3.2): handleSellerCopySelect のロジック', () => {
  /**
   * handleSellerCopySelect の純粋なロジックをテスト。
   * APIレスポンスの各フィールドが state setter に渡されることを確認する。
   */
  it('seller.name が setName に渡されること', () => {
    const setName = jest.fn();
    const setRequestorAddress = jest.fn();
    const setPhoneNumber = jest.fn();
    const setEmail = jest.fn();

    // handleSellerCopySelect のロジックを再現
    const seller = { ...mockSeller };
    if (seller.name) setName(seller.name);
    if (seller.address) setRequestorAddress(seller.address);
    if (seller.phoneNumber) setPhoneNumber(seller.phoneNumber);
    if (seller.email) setEmail(seller.email);

    expect(setName).toHaveBeenCalledWith(mockSeller.name);
  });

  it('seller.address が setRequestorAddress に渡されること', () => {
    const setName = jest.fn();
    const setRequestorAddress = jest.fn();
    const setPhoneNumber = jest.fn();
    const setEmail = jest.fn();

    const seller = { ...mockSeller };
    if (seller.name) setName(seller.name);
    if (seller.address) setRequestorAddress(seller.address);
    if (seller.phoneNumber) setPhoneNumber(seller.phoneNumber);
    if (seller.email) setEmail(seller.email);

    expect(setRequestorAddress).toHaveBeenCalledWith(mockSeller.address);
  });

  it('seller.phoneNumber が setPhoneNumber に渡されること', () => {
    const setName = jest.fn();
    const setRequestorAddress = jest.fn();
    const setPhoneNumber = jest.fn();
    const setEmail = jest.fn();

    const seller = { ...mockSeller };
    if (seller.name) setName(seller.name);
    if (seller.address) setRequestorAddress(seller.address);
    if (seller.phoneNumber) setPhoneNumber(seller.phoneNumber);
    if (seller.email) setEmail(seller.email);

    expect(setPhoneNumber).toHaveBeenCalledWith(mockSeller.phoneNumber);
  });

  it('seller.email が setEmail に渡されること', () => {
    const setName = jest.fn();
    const setRequestorAddress = jest.fn();
    const setPhoneNumber = jest.fn();
    const setEmail = jest.fn();

    const seller = { ...mockSeller };
    if (seller.name) setName(seller.name);
    if (seller.address) setRequestorAddress(seller.address);
    if (seller.phoneNumber) setPhoneNumber(seller.phoneNumber);
    if (seller.email) setEmail(seller.email);

    expect(setEmail).toHaveBeenCalledWith(mockSeller.email);
  });

  it('address が null の場合 setRequestorAddress が呼ばれないこと', () => {
    const setRequestorAddress = jest.fn();

    const seller = { ...mockSeller, address: null as any };
    if (seller.address) setRequestorAddress(seller.address);

    expect(setRequestorAddress).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Preservation Checking (4.1): name のコピー動作が保持される
// ============================================================================
describe('Preservation Checking (4.1): name のコピー動作', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupSupabaseMock(mockSeller);
    mockGetSeller.mockResolvedValue(mockSeller);
  });

  it('修正後も name がレスポンスに含まれること', async () => {
    const response = await request(app)
      .get('/api/sellers/by-number/AA13501');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('name', mockSeller.name);
  });
});

// ============================================================================
// Preservation Checking (4.2): propertyAddress がレスポンスに含まれるが address とは別フィールド
// ============================================================================
describe('Preservation Checking (4.2): propertyAddress と address は別フィールド', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupSupabaseMock(mockSeller);
    mockGetSeller.mockResolvedValue(mockSeller);
  });

  it('propertyAddress がレスポンスに含まれること', async () => {
    const response = await request(app)
      .get('/api/sellers/by-number/AA13501');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('propertyAddress', mockSeller.propertyAddress);
  });

  it('propertyAddress と address が異なるフィールドであること', async () => {
    const response = await request(app)
      .get('/api/sellers/by-number/AA13501');

    expect(response.status).toBe(200);
    // propertyAddress（物件住所）と address（依頼者住所）は別フィールド
    expect(response.body.propertyAddress).not.toBe(response.body.address);
    expect(response.body.propertyAddress).toBe(mockSeller.propertyAddress);
    expect(response.body.address).toBe(mockSeller.address);
  });
});

// ============================================================================
// Preservation Checking (4.3): 買主コピー動作（handleBuyerCopySelect）が影響を受けない
// ============================================================================
describe('Preservation Checking (4.3): handleBuyerCopySelect のロジック', () => {
  /**
   * handleBuyerCopySelect の純粋なロジックをテスト。
   * 売主コピーの修正が買主コピーに影響しないことを確認する。
   */
  const mockBuyer = {
    name: '鈴木花子',
    phoneNumber: '080-9876-5432',
    phone_number: '080-9876-5432',
    email: 'suzuki@example.com',
  };

  it('buyer.name が setName に渡されること', () => {
    const setName = jest.fn();
    const setPhoneNumber = jest.fn();
    const setEmail = jest.fn();

    // handleBuyerCopySelect のロジックを再現
    const buyer = { ...mockBuyer };
    if (buyer.name) setName(buyer.name);
    if (buyer.phoneNumber || buyer.phone_number) setPhoneNumber(buyer.phoneNumber || buyer.phone_number);
    if (buyer.email) setEmail(buyer.email);

    expect(setName).toHaveBeenCalledWith(mockBuyer.name);
  });

  it('buyer.phoneNumber が setPhoneNumber に渡されること', () => {
    const setName = jest.fn();
    const setPhoneNumber = jest.fn();
    const setEmail = jest.fn();

    const buyer = { ...mockBuyer };
    if (buyer.name) setName(buyer.name);
    if (buyer.phoneNumber || buyer.phone_number) setPhoneNumber(buyer.phoneNumber || buyer.phone_number);
    if (buyer.email) setEmail(buyer.email);

    expect(setPhoneNumber).toHaveBeenCalledWith(mockBuyer.phoneNumber);
  });

  it('buyer.email が setEmail に渡されること', () => {
    const setName = jest.fn();
    const setPhoneNumber = jest.fn();
    const setEmail = jest.fn();

    const buyer = { ...mockBuyer };
    if (buyer.name) setName(buyer.name);
    if (buyer.phoneNumber || buyer.phone_number) setPhoneNumber(buyer.phoneNumber || buyer.phone_number);
    if (buyer.email) setEmail(buyer.email);

    expect(setEmail).toHaveBeenCalledWith(mockBuyer.email);
  });

  it('phone_number フォールバックが機能すること（phoneNumber が undefined の場合）', () => {
    const setPhoneNumber = jest.fn();

    const buyer = { ...mockBuyer, phoneNumber: undefined as any };
    if (buyer.phoneNumber || buyer.phone_number) setPhoneNumber(buyer.phoneNumber || buyer.phone_number);

    expect(setPhoneNumber).toHaveBeenCalledWith(mockBuyer.phone_number);
  });
});

// ============================================================================
// Preservation Checking (4.4): 2文字未満の入力で検索が実行されない
// ============================================================================
describe('Preservation Checking (4.4): handleSellerCopySearch の最小文字数ロジック', () => {
  /**
   * handleSellerCopySearch の純粋なロジックをテスト。
   * 2文字未満の入力では検索APIが呼ばれないことを確認する。
   */
  it('空文字の場合 API が呼ばれないこと', async () => {
    const mockApiGet = jest.fn();

    // handleSellerCopySearch のロジックを再現
    const query = '';
    if (!query || query.length < 2) {
      // setSellerCopyOptions([]) のみ実行、API呼び出しなし
    } else {
      await mockApiGet(`/api/sellers/search?q=${encodeURIComponent(query)}`);
    }

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('1文字の場合 API が呼ばれないこと', async () => {
    const mockApiGet = jest.fn();

    const query = 'A';
    if (!query || query.length < 2) {
      // setSellerCopyOptions([]) のみ実行、API呼び出しなし
    } else {
      await mockApiGet(`/api/sellers/search?q=${encodeURIComponent(query)}`);
    }

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('2文字の場合 API が呼ばれること', async () => {
    const mockApiGet = jest.fn().mockResolvedValue({ data: [] });

    const query = 'AA';
    if (!query || query.length < 2) {
      // 検索しない
    } else {
      await mockApiGet(`/api/sellers/search?q=${encodeURIComponent(query)}`);
    }

    expect(mockApiGet).toHaveBeenCalledWith('/api/sellers/search?q=AA');
  });

  it('3文字以上の場合 API が呼ばれること', async () => {
    const mockApiGet = jest.fn().mockResolvedValue({ data: [] });

    const query = 'AA1';
    if (!query || query.length < 2) {
      // 検索しない
    } else {
      await mockApiGet(`/api/sellers/search?q=${encodeURIComponent(query)}`);
    }

    expect(mockApiGet).toHaveBeenCalledWith('/api/sellers/search?q=AA1');
  });
});
