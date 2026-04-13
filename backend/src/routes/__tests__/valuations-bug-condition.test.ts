/**
 * バグ条件探索テスト: seller.property が null の場合の「当社調べ」フィールド優先バグ
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * このテストは修正前のコードで**失敗**することが期待される。
 * 失敗がバグの存在を証明する。
 *
 * バグの概要:
 *   seller.property が null の場合のフォールバック処理で、
 *   landAreaVerified と buildingAreaVerified が PropertyInfo に含まれていないため、
 *   「当社調べ」フィールドの値が無視されて通常フィールドで計算されてしまう。
 *
 * isBugCondition が true になるケース:
 *   seller.property IS NULL
 *   AND (seller.landAreaVerified IS NOT NULL OR seller.buildingAreaVerified IS NOT NULL)
 *
 * 修正前: このテストは失敗する（バグの存在を証明）
 * 修正後: このテストは通過する（バグ修正の確認）
 */

import request from 'supertest';
import express from 'express';

// calculateValuationAmount1 に渡された PropertyInfo を記録するための変数
let capturedPropertyInfo: any = null;

// 認証ミドルウェアをモック化
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.employee = { id: 'test-employee-id', email: 'test@example.com' };
    next();
  },
}));

// SellerService をモック化
const mockGetSeller = jest.fn();
jest.mock('../../services/SellerService.supabase', () => ({
  SellerService: jest.fn().mockImplementation(() => ({
    getSeller: mockGetSeller,
  })),
}));

// ValuationEngine をモック化
jest.mock('../../services/ValuationEngine.supabase', () => ({
  ValuationEngine: jest.fn().mockImplementation(() => ({})),
}));

// ValuationCalculatorService をモック化して、渡された PropertyInfo を記録する
const mockCalculateValuationAmount1 = jest.fn();
jest.mock('../../services/ValuationCalculatorService', () => ({
  valuationCalculatorService: {
    calculateValuationAmount1: mockCalculateValuationAmount1,
    calculateValuationAmount2: jest.fn().mockResolvedValue(0),
    calculateValuationAmount3: jest.fn().mockResolvedValue(0),
  },
}));

import valuationsRouter from '../valuations';

// テスト用 Express アプリケーション
const app = express();
app.use(express.json());
app.use('/api/sellers', valuationsRouter);

describe('Property 1: Bug Condition - 「当社調べ」フィールド優先使用バグ', () => {
  beforeEach(() => {
    mockGetSeller.mockReset();
    mockCalculateValuationAmount1.mockReset();
    capturedPropertyInfo = null;

    // calculateValuationAmount1 が呼ばれたとき、渡された PropertyInfo を記録する
    mockCalculateValuationAmount1.mockImplementation((_seller: any, propertyInfo: any) => {
      capturedPropertyInfo = propertyInfo;
      return Promise.resolve(10000000); // ダミーの査定額
    });
  });

  // ===========================================================================
  // ケース1: landAreaVerified のみ設定（buildingAreaVerified は null）
  // ===========================================================================
  it('ケース1: seller.property=null, landAreaVerified=165.3, landArea=150.0 → PropertyInfo に landAreaVerified が含まれること', async () => {
    // バグ条件: seller.property = null, landAreaVerified に値あり
    const seller = {
      id: 'test-seller-id',
      property: null, // ← バグ条件: property が null
      landArea: 150.0,
      buildingArea: 90.0,
      landAreaVerified: 165.3, // ← 「土地（当社調べ）」に値あり
      buildingAreaVerified: null, // ← 「建物（当社調べ）」は null
      propertyAddress: '東京都渋谷区テスト1-1-1',
      propertyType: '戸建',
      buildYear: 2000,
      structure: '木造',
      floorPlan: '3LDK',
      fixedAssetTaxRoadPrice: 200000,
    };
    mockGetSeller.mockResolvedValue(seller);

    const response = await request(app)
      .post('/api/sellers/test-seller-id/calculate-valuation-amount1')
      .send({});

    expect(response.status).toBe(200);

    // calculateValuationAmount1 が呼ばれたことを確認
    expect(mockCalculateValuationAmount1).toHaveBeenCalledTimes(1);

    // ❌ 修正前: capturedPropertyInfo.landAreaVerified は undefined（バグ）
    // ✅ 修正後: capturedPropertyInfo.landAreaVerified は 165.3 であるべき
    expect(capturedPropertyInfo).not.toBeNull();
    expect(capturedPropertyInfo.landAreaVerified).toBe(165.3);
  });

  // ===========================================================================
  // ケース2: buildingAreaVerified のみ設定（landAreaVerified は null）
  // ===========================================================================
  it('ケース2: seller.property=null, buildingAreaVerified=99.2, buildingArea=90.0 → PropertyInfo に buildingAreaVerified が含まれること', async () => {
    // バグ条件: seller.property = null, buildingAreaVerified に値あり
    const seller = {
      id: 'test-seller-id',
      property: null, // ← バグ条件: property が null
      landArea: 150.0,
      buildingArea: 90.0,
      landAreaVerified: null, // ← 「土地（当社調べ）」は null
      buildingAreaVerified: 99.2, // ← 「建物（当社調べ）」に値あり
      propertyAddress: '東京都渋谷区テスト1-1-1',
      propertyType: '戸建',
      buildYear: 2000,
      structure: '木造',
      floorPlan: '3LDK',
      fixedAssetTaxRoadPrice: 200000,
    };
    mockGetSeller.mockResolvedValue(seller);

    const response = await request(app)
      .post('/api/sellers/test-seller-id/calculate-valuation-amount1')
      .send({});

    expect(response.status).toBe(200);

    // calculateValuationAmount1 が呼ばれたことを確認
    expect(mockCalculateValuationAmount1).toHaveBeenCalledTimes(1);

    // ❌ 修正前: capturedPropertyInfo.buildingAreaVerified は undefined（バグ）
    // ✅ 修正後: capturedPropertyInfo.buildingAreaVerified は 99.2 であるべき
    expect(capturedPropertyInfo).not.toBeNull();
    expect(capturedPropertyInfo.buildingAreaVerified).toBe(99.2);
  });

  // ===========================================================================
  // ケース3: landAreaVerified と buildingAreaVerified の両方を設定
  // ===========================================================================
  it('ケース3: seller.property=null, landAreaVerified=165.3, buildingAreaVerified=99.2 → PropertyInfo に両方が含まれること', async () => {
    // バグ条件: seller.property = null, 両方の「当社調べ」フィールドに値あり
    const seller = {
      id: 'test-seller-id',
      property: null, // ← バグ条件: property が null
      landArea: 150.0,
      buildingArea: 90.0,
      landAreaVerified: 165.3, // ← 「土地（当社調べ）」に値あり
      buildingAreaVerified: 99.2, // ← 「建物（当社調べ）」に値あり
      propertyAddress: '東京都渋谷区テスト1-1-1',
      propertyType: '戸建',
      buildYear: 2000,
      structure: '木造',
      floorPlan: '3LDK',
      fixedAssetTaxRoadPrice: 200000,
    };
    mockGetSeller.mockResolvedValue(seller);

    const response = await request(app)
      .post('/api/sellers/test-seller-id/calculate-valuation-amount1')
      .send({});

    expect(response.status).toBe(200);

    // calculateValuationAmount1 が呼ばれたことを確認
    expect(mockCalculateValuationAmount1).toHaveBeenCalledTimes(1);

    // ❌ 修正前: capturedPropertyInfo.landAreaVerified と buildingAreaVerified は undefined（バグ）
    // ✅ 修正後: 両方の値が PropertyInfo に含まれるべき
    expect(capturedPropertyInfo).not.toBeNull();
    expect(capturedPropertyInfo.landAreaVerified).toBe(165.3);
    expect(capturedPropertyInfo.buildingAreaVerified).toBe(99.2);
  });

  // ===========================================================================
  // ケース4: AA13965相当 — 実際のバグ発生ケース
  // ===========================================================================
  it('ケース4（AA13965相当）: landAreaVerified=165.3, buildingAreaVerified=99.2, landArea=150.0, buildingArea=90.0 → 「当社調べ」値が PropertyInfo に含まれること', async () => {
    // AA13965相当のデータ: seller.property = null, 両方の「当社調べ」フィールドに値あり
    const seller = {
      id: 'AA13965',
      property: null, // ← バグ条件: propertiesテーブルにレコードなし
      landArea: 150.0, // ← 通常の土地面積
      buildingArea: 90.0, // ← 通常の建物面積
      landAreaVerified: 165.3, // ← 「土地（当社調べ）」= 独自調査値
      buildingAreaVerified: 99.2, // ← 「建物（当社調べ）」= 独自調査値
      propertyAddress: '東京都世田谷区AA13965-1-1',
      propertyType: '戸建',
      buildYear: 1995,
      structure: '木造',
      floorPlan: '4LDK',
      fixedAssetTaxRoadPrice: 250000,
    };
    mockGetSeller.mockResolvedValue(seller);

    const response = await request(app)
      .post('/api/sellers/AA13965/calculate-valuation-amount1')
      .send({});

    expect(response.status).toBe(200);

    // calculateValuationAmount1 が呼ばれたことを確認
    expect(mockCalculateValuationAmount1).toHaveBeenCalledTimes(1);

    // ❌ 修正前（バグあり）:
    //   capturedPropertyInfo = { landArea: 150.0, buildingArea: 90.0, ... }
    //   landAreaVerified と buildingAreaVerified が含まれていない
    //
    // ✅ 修正後（期待される動作）:
    //   capturedPropertyInfo = { landArea: 150.0, buildingArea: 90.0,
    //                            landAreaVerified: 165.3, buildingAreaVerified: 99.2, ... }
    expect(capturedPropertyInfo).not.toBeNull();
    expect(capturedPropertyInfo.landAreaVerified).toBe(165.3);
    expect(capturedPropertyInfo.buildingAreaVerified).toBe(99.2);

    // 通常フィールドも引き続き含まれていることを確認（保持）
    expect(capturedPropertyInfo.landArea).toBe(150.0);
    expect(capturedPropertyInfo.buildingArea).toBe(90.0);
  });
});
