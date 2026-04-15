/**
 * バグ条件探索テスト: 買付フィールド不在時に Google Chat 通知が誤送信されるバグ
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは修正前のコードで**失敗**することが期待される。
 * 失敗がバグの存在を証明する。
 *
 * バグの概要:
 *   PUT /api/property-listings/:propertyNumber エンドポイントは、
 *   リクエストボディに買付フィールド（offer_date, offer_status, offer_amount, offer_comment）が
 *   一切含まれない場合でも、無条件に notifyGoogleChatOfferSaved を呼び出している。
 *
 * isBugCondition が true になるケース:
 *   NOT (updates contains any of ['offer_date', 'offer_status', 'offer_amount', 'offer_comment'])
 *
 * 修正前: このテストは失敗する（バグの存在を証明）
 * 修正後: このテストは通過する（バグ修正の確認）
 */

import request from 'supertest';
import express from 'express';

// axios をモック化（notifyGoogleChatOfferSaved の内部で使用）
const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  post: mockAxiosPost,
}));

// PropertyListingService をモック化（DB接続を排除）
const mockUpdate = jest.fn();
jest.mock('../../services/PropertyListingService', () => ({
  PropertyListingService: jest.fn().mockImplementation(() => ({
    getAll: jest.fn(),
    getStats: jest.fn(),
    getByPropertyNumber: jest.fn(),
    update: mockUpdate,
    getPublicProperties: jest.fn(),
    getHiddenImages: jest.fn(),
    getVisibleImages: jest.fn(),
    hideImage: jest.fn(),
  })),
}));

// BuyerLinkageService をモック化
jest.mock('../../services/BuyerLinkageService', () => ({
  BuyerLinkageService: jest.fn().mockImplementation(() => ({
    getBuyerCountsForProperties: jest.fn(),
    getBuyersForProperty: jest.fn(),
    getPropertiesWithHighConfidenceBuyers: jest.fn(),
  })),
}));

// BuyerLinkageCache をモック化
jest.mock('../../services/BuyerLinkageCache', () => ({
  BuyerLinkageCache: jest.fn().mockImplementation(() => ({
    getBuyerCount: jest.fn().mockResolvedValue(null),
    setBuyerCount: jest.fn(),
    getBuyerList: jest.fn().mockResolvedValue(null),
    setBuyerList: jest.fn(),
  })),
}));

// BuyerDistributionService をモック化
jest.mock('../../services/BuyerDistributionService', () => ({
  BuyerDistributionService: jest.fn().mockImplementation(() => ({
    getQualifiedBuyers: jest.fn(),
  })),
}));

// EnhancedBuyerDistributionService をモック化
jest.mock('../../services/EnhancedBuyerDistributionService', () => ({
  EnhancedBuyerDistributionService: jest.fn().mockImplementation(() => ({
    getQualifiedBuyersWithAllCriteria: jest.fn(),
  })),
}));

// DataIntegrityDiagnosticService をモック化
jest.mock('../../services/DataIntegrityDiagnosticService', () => ({
  DataIntegrityDiagnosticService: jest.fn().mockImplementation(() => ({
    diagnoseProperty: jest.fn(),
  })),
}));

// BuyerCandidateService をモック化
jest.mock('../../services/BuyerCandidateService', () => ({
  BuyerCandidateService: jest.fn().mockImplementation(() => ({
    getCandidatesForProperty: jest.fn(),
  })),
}));

// UrlValidator をモック化
jest.mock('../../utils/urlValidator', () => ({
  UrlValidator: jest.fn().mockImplementation(() => ({})),
}));

// EmailService をモック化
jest.mock('../../services/EmailService.supabase', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendTemplateEmail: jest.fn(),
  })),
}));

// 認証ミドルウェアをモック化
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.employee = { id: 'test-employee-id', email: 'test@example.com' };
    next();
  },
}));

// @supabase/supabase-js をモック化
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

import propertyListingsRouter from '../propertyListings';

// テスト用 Express アプリケーション
const app = express();
app.use(express.json());
app.use('/api/property-listings', propertyListingsRouter);

// デフォルトの更新結果（DBから返されるデータ）
const defaultUpdateResult = {
  property_number: 'TEST001',
  address: '東京都渋谷区テスト1-1-1',
  display_address: '渋谷区テスト',
  property_type: '戸建',
  sales_assignee: 'テスト担当者',
  offer_date: null,
  offer_status: null,
  offer_amount: null,
  offer_comment: null,
};

describe('Property 1: Bug Condition - 買付フィールド不在時に通知が誤送信されるバグ', () => {
  beforeEach(() => {
    mockAxiosPost.mockReset();
    mockUpdate.mockReset();

    // デフォルト: update は成功する
    mockUpdate.mockResolvedValue(defaultUpdateResult);
    // axios.post は成功する（通知送信のシミュレーション）
    mockAxiosPost.mockResolvedValue({ status: 200 });
  });

  // ===========================================================================
  // ケース1: special_notes のみ更新（報告書ページからの保存）
  // ===========================================================================
  it('ケース1: { special_notes: "テスト" } のみ → 通知が呼ばれないこと（修正前は FAIL）', async () => {
    const response = await request(app)
      .put('/api/property-listings/TEST001')
      .send({ special_notes: 'テスト' });

    expect(response.status).toBe(200);

    // notifyGoogleChatOfferSaved の内部で axios.post が呼ばれる
    // 修正前: 買付フィールドがなくても呼ばれる（バグ）→ このアサートが FAIL する
    // 修正後: 買付フィールドがないので呼ばれない（正常）→ このアサートが PASS する
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  // ===========================================================================
  // ケース2: report_date のみ更新
  // ===========================================================================
  it('ケース2: { report_date: "2026-01-01" } のみ → 通知が呼ばれないこと（修正前は FAIL）', async () => {
    const response = await request(app)
      .put('/api/property-listings/TEST001')
      .send({ report_date: '2026-01-01' });

    expect(response.status).toBe(200);

    // 修正前: 買付フィールドがなくても呼ばれる（バグ）→ FAIL
    // 修正後: 買付フィールドがないので呼ばれない（正常）→ PASS
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  // ===========================================================================
  // ケース3: status のみ更新
  // ===========================================================================
  it('ケース3: { status: "販売中" } のみ → 通知が呼ばれないこと（修正前は FAIL）', async () => {
    const response = await request(app)
      .put('/api/property-listings/TEST001')
      .send({ status: '販売中' });

    expect(response.status).toBe(200);

    // 修正前: 買付フィールドがなくても呼ばれる（バグ）→ FAIL
    // 修正後: 買付フィールドがないので呼ばれない（正常）→ PASS
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  // ===========================================================================
  // ケース4: 空のボディ
  // ===========================================================================
  it('ケース4: {} 空のボディ → 通知が呼ばれないこと（修正前は FAIL）', async () => {
    const response = await request(app)
      .put('/api/property-listings/TEST001')
      .send({});

    expect(response.status).toBe(200);

    // 修正前: 買付フィールドがなくても呼ばれる（バグ）→ FAIL
    // 修正後: 買付フィールドがないので呼ばれない（正常）→ PASS
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });
});

/**
 * Property 2: Preservation - 買付フィールド存在時は通知が送信される
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * このテストは未修正コードで**PASS**することが期待される（ベースライン確認）。
 * 買付フィールドのいずれかを含むリクエストでは、修正前も修正後も通知が送信されること。
 *
 * isBugCondition が false になるケース（= 買付フィールドが含まれる場合）:
 *   X.updates contains any of ['offer_date', 'offer_status', 'offer_amount', 'offer_comment']
 *
 * 修正前: このテストは PASS する（ベースライン確認）
 * 修正後: このテストは引き続き PASS する（リグレッションなし）
 */
describe('Property 2: Preservation - 買付フィールド存在時は通知が送信される', () => {
  beforeEach(() => {
    mockAxiosPost.mockReset();
    mockUpdate.mockReset();

    // デフォルト: update は成功する
    mockUpdate.mockResolvedValue(defaultUpdateResult);
    // axios.post は成功する（通知送信のシミュレーション）
    mockAxiosPost.mockResolvedValue({ status: 200 });
  });

  // ===========================================================================
  // ケース1: offer_date のみ更新
  // ===========================================================================
  it('ケース1: { offer_date: "2026-01-01" } → 通知が呼ばれること（修正前も PASS）', async () => {
    const response = await request(app)
      .put('/api/property-listings/TEST001')
      .send({ offer_date: '2026-01-01' });

    expect(response.status).toBe(200);

    // 買付フィールドが含まれるので通知が呼ばれるべき
    // 修正前: 無条件に呼ばれる（バグだが結果的に正しい）→ PASS
    // 修正後: hasOfferUpdate=true なので呼ばれる（正常）→ PASS
    expect(mockAxiosPost).toHaveBeenCalled();
  });

  // ===========================================================================
  // ケース2: offer_status のみ更新
  // ===========================================================================
  it('ケース2: { offer_status: "交渉中" } → 通知が呼ばれること（修正前も PASS）', async () => {
    const response = await request(app)
      .put('/api/property-listings/TEST001')
      .send({ offer_status: '交渉中' });

    expect(response.status).toBe(200);

    // 買付フィールドが含まれるので通知が呼ばれるべき
    expect(mockAxiosPost).toHaveBeenCalled();
  });

  // ===========================================================================
  // ケース3: offer_amount のみ更新
  // ===========================================================================
  it('ケース3: { offer_amount: "5000万円" } → 通知が呼ばれること（修正前も PASS）', async () => {
    const response = await request(app)
      .put('/api/property-listings/TEST001')
      .send({ offer_amount: '5000万円' });

    expect(response.status).toBe(200);

    // 買付フィールドが含まれるので通知が呼ばれるべき
    expect(mockAxiosPost).toHaveBeenCalled();
  });

  // ===========================================================================
  // ケース4: offer_comment のみ更新
  // ===========================================================================
  it('ケース4: { offer_comment: "コメント" } → 通知が呼ばれること（修正前も PASS）', async () => {
    const response = await request(app)
      .put('/api/property-listings/TEST001')
      .send({ offer_comment: 'コメント' });

    expect(response.status).toBe(200);

    // 買付フィールドが含まれるので通知が呼ばれるべき
    expect(mockAxiosPost).toHaveBeenCalled();
  });

  // ===========================================================================
  // ケース5: 複数の買付フィールドを含む場合
  // ===========================================================================
  it('ケース5: 複数の買付フィールド（offer_date + offer_status + offer_amount + offer_comment）→ 通知が呼ばれること（修正前も PASS）', async () => {
    const response = await request(app)
      .put('/api/property-listings/TEST001')
      .send({
        offer_date: '2026-01-01',
        offer_status: '交渉中',
        offer_amount: '5000万円',
        offer_comment: 'コメント',
      });

    expect(response.status).toBe(200);

    // 全買付フィールドが含まれるので通知が呼ばれるべき
    expect(mockAxiosPost).toHaveBeenCalled();
  });

  // ===========================================================================
  // ケース6: 買付フィールド＋非買付フィールドの混在
  // ===========================================================================
  it('ケース6: { offer_date: "2026-01-01", special_notes: "テスト" } 混在 → 通知が呼ばれること（修正前も PASS）', async () => {
    const response = await request(app)
      .put('/api/property-listings/TEST001')
      .send({
        offer_date: '2026-01-01',
        special_notes: 'テスト',
      });

    expect(response.status).toBe(200);

    // 買付フィールドが含まれるので通知が呼ばれるべき
    expect(mockAxiosPost).toHaveBeenCalled();
  });
});
