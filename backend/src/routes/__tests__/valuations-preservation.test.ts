/**
 * 保持プロパティテスト: 「当社調べ」フィールドがない場合の動作保持
 *
 * **Validates: Requirements 3.1, 3.2**
 *
 * このテストは修正前のコードで**パス**することが期待される。
 * パスが保持すべきベースライン動作を確認する。
 *
 * 保持すべき動作:
 *   「土地（当社調べ）」「建物（当社調べ）」の両方がnullの場合、
 *   通常の土地面積・建物面積フィールドから査定額を計算する動作は変わらない。
 *
 * 検証対象:
 *   - seller.property = null, landAreaVerified = null, buildingAreaVerified = null の場合、
 *     通常フィールド（landArea, buildingArea）が PropertyInfo に含まれること
 *   - seller.property が存在する場合、フォールバック処理を通らないため影響なし
 *   - ランダムな landArea / buildingArea の値でも、「当社調べ」フィールドがnullなら
 *     通常フィールドが使われること
 *
 * 修正前: このテストはパスする（保持すべきベースライン動作を確認）
 * 修正後: このテストは引き続きパスする（リグレッションなし）
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

describe('Property 2: Preservation - 「当社調べ」フィールドがない場合の動作保持', () => {
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
  // ケース1: seller.property = null, 「当社調べ」フィールドが両方null
  //   → 通常フィールド（landArea, buildingArea）が PropertyInfo に含まれること
  // ===========================================================================
  it('ケース1: seller.property=null, landAreaVerified=null, buildingAreaVerified=null, landArea=150.0, buildingArea=90.0 → 通常フィールドで計算される', async () => {
    // 保持ケース: 「当社調べ」フィールドが両方null
    const seller = {
      id: 'test-seller-id',
      property: null, // フォールバック処理を通る
      landArea: 150.0, // ← 通常の土地面積
      buildingArea: 90.0, // ← 通常の建物面積
      landAreaVerified: null, // ← 「土地（当社調べ）」は null（バグ条件に該当しない）
      buildingAreaVerified: null, // ← 「建物（当社調べ）」は null（バグ条件に該当しない）
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

    // ✅ 通常フィールドが PropertyInfo に含まれていることを確認（保持）
    expect(capturedPropertyInfo).not.toBeNull();
    expect(capturedPropertyInfo.landArea).toBe(150.0);
    expect(capturedPropertyInfo.buildingArea).toBe(90.0);
  });

  // ===========================================================================
  // ケース2: seller.property が存在する場合
  //   → フォールバック処理を通らないため、「当社調べ」フィールドの有無に関わらず影響なし
  // ===========================================================================
  it('ケース2: seller.property が存在する場合 → フォールバック処理を通らないため影響なし', async () => {
    // seller.property が存在するケース（バグ条件に該当しない）
    const propertyObject = {
      id: 'property-id',
      sellerId: 'test-seller-id',
      address: '東京都渋谷区テスト1-1-1',
      propertyType: '戸建',
      landArea: 200.0,
      buildingArea: 120.0,
      buildYear: 2005,
      structure: '木造',
      floorPlan: '4LDK',
    };
    const seller = {
      id: 'test-seller-id',
      property: propertyObject, // ← property が存在する（フォールバック処理を通らない）
      landArea: 150.0,
      buildingArea: 90.0,
      landAreaVerified: null,
      buildingAreaVerified: null,
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

    // ✅ seller.property がそのまま使われることを確認（フォールバック処理を通らない）
    expect(capturedPropertyInfo).not.toBeNull();
    expect(capturedPropertyInfo).toBe(propertyObject);
    expect(capturedPropertyInfo.landArea).toBe(200.0);
    expect(capturedPropertyInfo.buildingArea).toBe(120.0);
  });

  // ===========================================================================
  // プロパティベーステスト: ランダムな landArea / buildingArea の値を生成し、
  //   「当社調べ」フィールドがnullの場合に通常フィールドが使われることを検証
  // ===========================================================================
  it('プロパティベーステスト: ランダムな landArea / buildingArea の値で、「当社調べ」フィールドがnullなら通常フィールドが使われること', async () => {
    // ランダムな面積値のサンプルを生成（プロパティベーステストの代替として複数ケースを検証）
    const testCases = [
      { landArea: 50.0, buildingArea: 30.0 },
      { landArea: 100.0, buildingArea: 60.0 },
      { landArea: 150.0, buildingArea: 90.0 },
      { landArea: 200.0, buildingArea: 120.0 },
      { landArea: 300.0, buildingArea: 180.0 },
      { landArea: 500.0, buildingArea: 250.0 },
      { landArea: 0.1, buildingArea: 0.1 }, // 最小値に近いケース
      { landArea: 999.9, buildingArea: 999.9 }, // 大きな値のケース
    ];

    for (const { landArea, buildingArea } of testCases) {
      // 各テストケースの前にリセット
      mockGetSeller.mockReset();
      mockCalculateValuationAmount1.mockReset();
      capturedPropertyInfo = null;
      mockCalculateValuationAmount1.mockImplementation((_seller: any, propertyInfo: any) => {
        capturedPropertyInfo = propertyInfo;
        return Promise.resolve(10000000);
      });

      // 「当社調べ」フィールドが両方null（バグ条件に該当しない）
      const seller = {
        id: 'test-seller-id',
        property: null,
        landArea, // ← ランダムな通常土地面積
        buildingArea, // ← ランダムな通常建物面積
        landAreaVerified: null, // ← 「土地（当社調べ）」は null
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
      expect(mockCalculateValuationAmount1).toHaveBeenCalledTimes(1);

      // ✅ 通常フィールドが PropertyInfo に含まれていることを確認（保持）
      expect(capturedPropertyInfo).not.toBeNull();
      expect(capturedPropertyInfo.landArea).toBe(landArea);
      expect(capturedPropertyInfo.buildingArea).toBe(buildingArea);

      // ✅ 「当社調べ」フィールドが undefined または null であることを確認
      //    （バグ条件に該当しないため、修正前後で動作が変わらない）
      const landAreaVerifiedValue = capturedPropertyInfo.landAreaVerified;
      const buildingAreaVerifiedValue = capturedPropertyInfo.buildingAreaVerified;
      expect(landAreaVerifiedValue == null || landAreaVerifiedValue === undefined).toBe(true);
      expect(buildingAreaVerifiedValue == null || buildingAreaVerifiedValue === undefined).toBe(true);
    }
  });

  // ===========================================================================
  // ケース3: 「当社調べ」フィールドがnullの場合、レスポンスに valuationAmount1 が含まれること
  // ===========================================================================
  it('ケース3: 「当社調べ」フィールドがnullの場合、レスポンスに valuationAmount1 が含まれること', async () => {
    const seller = {
      id: 'test-seller-id',
      property: null,
      landArea: 150.0,
      buildingArea: 90.0,
      landAreaVerified: null,
      buildingAreaVerified: null,
      propertyAddress: '東京都渋谷区テスト1-1-1',
      propertyType: '戸建',
      buildYear: 2000,
      structure: '木造',
      floorPlan: '3LDK',
      fixedAssetTaxRoadPrice: 200000,
    };
    mockGetSeller.mockResolvedValue(seller);

    // ダミーの査定額を設定
    const expectedValuationAmount = 15000000;
    mockCalculateValuationAmount1.mockImplementation((_seller: any, propertyInfo: any) => {
      capturedPropertyInfo = propertyInfo;
      return Promise.resolve(expectedValuationAmount);
    });

    const response = await request(app)
      .post('/api/sellers/test-seller-id/calculate-valuation-amount1')
      .send({});

    expect(response.status).toBe(200);

    // ✅ レスポンスに valuationAmount1 が含まれていることを確認
    expect(response.body).toHaveProperty('valuationAmount1');
    expect(response.body.valuationAmount1).toBe(expectedValuationAmount);

    // ✅ 通常フィールドが使われていることを確認
    expect(capturedPropertyInfo.landArea).toBe(150.0);
    expect(capturedPropertyInfo.buildingArea).toBe(90.0);
  });
});
