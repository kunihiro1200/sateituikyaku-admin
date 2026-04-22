/**
 * 保持プロパティテスト - AAプレフィックス売主への「大分県」自動付加動作の保持
 *
 * **Feature: seller-callmode-fi17-position-bug, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2**
 *
 * ✅ このテストは未修正コードで PASS することが期待される（ベースライン動作を確認）
 * 目的: 修正前後でリグレッションが発生しないことを保証するベースラインを確立する
 *
 * 観察優先メソドロジー:
 * - 未修正コードでAAプレフィックスの現在の動作を観察・記録する
 * - 修正後も同じ動作が維持されることを検証する
 *
 * 観察した動作（修正前コード）:
 * - geocodeAddress('大分市府内町1-1-1')     → 「大分県大分市府内町1-1-1」としてAPIが呼ばれる
 * - geocodeAddress('別府市北浜1-1-1')       → 「大分県別府市北浜1-1-1」としてAPIが呼ばれる
 * - geocodeAddress('大分県大分市府内町1-1-1') → 「大分県大分市府内町1-1-1」のまま（重複付加なし）
 *
 * Preservation Requirements（design.mdより）:
 * - AAプレフィックスの売主への「大分県」自動付加は変更しない
 * - 既に都道府県名を含む住所への重複付加防止は変更しない
 */

import * as fc from 'fast-check';
import axios from 'axios';

// axios をモック化（実際のGoogle Maps APIを呼び出さない）
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// テスト対象のサービスをインポート
import { GeocodingService } from '../GeocodingService';

// テスト用のダミー座標（大分市府内町付近）
const OITA_FUNACHO_COORDS = {
  lat: 33.2382,
  lng: 131.6126,
};

// テスト用のダミー座標（別府市北浜付近）
const BEPPU_KITAHAMA_COORDS = {
  lat: 33.2795,
  lng: 131.4912,
};

/**
 * Google Geocoding API のモックレスポンスを生成する
 */
function createMockGeocodingResponse(lat: number, lng: number, formattedAddress: string) {
  return {
    data: {
      status: 'OK',
      results: [
        {
          geometry: {
            location: { lat, lng },
          },
          formatted_address: formattedAddress,
        },
      ],
    },
  };
}

describe('Property 2: Preservation - AAプレフィックス売主への「大分県」自動付加動作の保持', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // GOOGLE_MAPS_API_KEY を設定（GeocodingService のコンストラクタが必要とする）
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  // ============================================================
  // 観察テスト: 修正前コードでのAAプレフィックス動作を確認
  // ============================================================

  describe('観察テスト: 修正前コードでのAAプレフィックス動作', () => {
    /**
     * 観察1: geocodeAddress('大分市府内町1-1-1') が「大分県」を付加してAPIを呼ぶ
     *
     * ✅ 修正前後ともに PASS する（保持すべき動作）
     *
     * **Validates: Requirements 3.1**
     */
    it('観察1: geocodeAddress("大分市府内町1-1-1") が「大分県大分市府内町1-1-1」としてAPIを呼ぶ', async () => {
      const address = '大分市府内町1-1-1';
      const expectedFullAddress = '大分県大分市府内町1-1-1';

      mockedAxios.get.mockResolvedValue(
        createMockGeocodingResponse(
          OITA_FUNACHO_COORDS.lat,
          OITA_FUNACHO_COORDS.lng,
          '日本、〒870-0021 大分県大分市府内町1丁目1−1'
        )
      );

      const service = new GeocodingService();
      await service.geocodeAddress(address);

      expect(mockedAxios.get).toHaveBeenCalled();

      const calledParams = mockedAxios.get.mock.calls[0][1]?.params;
      const calledAddress = calledParams?.address;

      console.log('axios.get に渡されたaddress:', calledAddress);
      console.log('期待値（大分県付加あり）:', expectedFullAddress);

      // ✅ 「大分県」が付加されることを確認（保持すべき動作）
      expect(calledAddress).toBe(expectedFullAddress);
      expect(calledAddress).toContain('大分県');
    });

    /**
     * 観察2: geocodeAddress('別府市北浜1-1-1') が「大分県」を付加してAPIを呼ぶ
     *
     * ✅ 修正前後ともに PASS する（保持すべき動作）
     *
     * **Validates: Requirements 3.1**
     */
    it('観察2: geocodeAddress("別府市北浜1-1-1") が「大分県別府市北浜1-1-1」としてAPIを呼ぶ', async () => {
      const address = '別府市北浜1-1-1';
      const expectedFullAddress = '大分県別府市北浜1-1-1';

      mockedAxios.get.mockResolvedValue(
        createMockGeocodingResponse(
          BEPPU_KITAHAMA_COORDS.lat,
          BEPPU_KITAHAMA_COORDS.lng,
          '日本、〒874-0920 大分県別府市北浜1丁目1−1'
        )
      );

      const service = new GeocodingService();
      await service.geocodeAddress(address);

      expect(mockedAxios.get).toHaveBeenCalled();

      const calledParams = mockedAxios.get.mock.calls[0][1]?.params;
      const calledAddress = calledParams?.address;

      console.log('axios.get に渡されたaddress:', calledAddress);
      console.log('期待値（大分県付加あり）:', expectedFullAddress);

      // ✅ 「大分県」が付加されることを確認（保持すべき動作）
      expect(calledAddress).toBe(expectedFullAddress);
      expect(calledAddress).toContain('大分県');
    });

    /**
     * 観察3: geocodeAddress('大分県大分市府内町1-1-1') が重複付加されないことを確認
     *
     * ✅ 修正前後ともに PASS する（保持すべき動作）
     *
     * **Validates: Requirements 3.2**
     */
    it('観察3: geocodeAddress("大分県大分市府内町1-1-1") が「大分県」を重複付加しない', async () => {
      const address = '大分県大分市府内町1-1-1';

      mockedAxios.get.mockResolvedValue(
        createMockGeocodingResponse(
          OITA_FUNACHO_COORDS.lat,
          OITA_FUNACHO_COORDS.lng,
          '日本、〒870-0021 大分県大分市府内町1丁目1−1'
        )
      );

      const service = new GeocodingService();
      await service.geocodeAddress(address);

      expect(mockedAxios.get).toHaveBeenCalled();

      const calledParams = mockedAxios.get.mock.calls[0][1]?.params;
      const calledAddress = calledParams?.address;

      console.log('axios.get に渡されたaddress:', calledAddress);
      console.log('期待値（重複付加なし）:', address);

      // ✅ 「大分県」が重複付加されないことを確認（保持すべき動作）
      expect(calledAddress).toBe(address);
      expect(calledAddress).not.toBe(`大分県${address}`);
      // 「大分県大分県」が含まれていないことを確認
      expect(calledAddress).not.toContain('大分県大分県');
    });

    /**
     * 観察4: geocodeAddress が正しい座標を返すことを確認
     *
     * ✅ 修正前後ともに PASS する（保持すべき動作）
     *
     * **Validates: Requirements 3.1**
     */
    it('観察4: geocodeAddress("大分市府内町1-1-1") が正しい座標を返す', async () => {
      const address = '大分市府内町1-1-1';

      mockedAxios.get.mockResolvedValue(
        createMockGeocodingResponse(
          OITA_FUNACHO_COORDS.lat,
          OITA_FUNACHO_COORDS.lng,
          '日本、〒870-0021 大分県大分市府内町1丁目1−1'
        )
      );

      const service = new GeocodingService();
      const result = await service.geocodeAddress(address);

      console.log('返却された座標:', result);

      // ✅ 正しい座標が返ることを確認
      expect(result).not.toBeNull();
      expect(result?.lat).toBe(OITA_FUNACHO_COORDS.lat);
      expect(result?.lng).toBe(OITA_FUNACHO_COORDS.lng);
      // 後方互換性フィールドも確認
      expect(result?.latitude).toBe(OITA_FUNACHO_COORDS.lat);
      expect(result?.longitude).toBe(OITA_FUNACHO_COORDS.lng);
    });
  });

  // ============================================================
  // プロパティベーステスト
  // ============================================================

  describe('プロパティベーステスト', () => {
    /**
     * プロパティ1: 「大分県」を含まない大分県内の住所では「大分県」が付加される
     *
     * AAプレフィックスの売主IDと「大分県」を含まない住所の組み合わせで、
     * 「大分県」が付加されることを検証する。
     *
     * ✅ 修正前後ともに PASS する（保持すべき動作）
     *
     * **Validates: Requirements 3.1**
     */
    it('プロパティ1: 「大分県」を含まない住所では「大分県」が付加される', async () => {
      // 大分県内の市区町村名のジェネレーター（「大分県」を含まない）
      const oitaCityArb = fc.constantFrom(
        '大分市府内町1-1-1',
        '別府市北浜1-1-1',
        '中津市豊田町1-1-1',
        '日田市元町1-1-1',
        '佐伯市城下東町1-1-1',
        '臼杵市大浜1-1-1',
        '津久見市中央町1-1-1',
        '竹田市竹田1-1-1',
        '豊後高田市玉津1-1-1',
        '杵築市大字杵築1-1-1',
        '宇佐市大字宇佐1-1-1',
        '豊後大野市三重町市場1-1-1',
        '由布市湯布院町川上1-1-1',
        '国東市国東町国東1-1-1'
      );

      await fc.assert(
        fc.asyncProperty(oitaCityArb, async (address) => {
          // 事前条件: 住所に「大分県」が含まれていないことを確認
          expect(address).not.toContain('大分県');

          mockedAxios.get.mockResolvedValue(
            createMockGeocodingResponse(
              OITA_FUNACHO_COORDS.lat,
              OITA_FUNACHO_COORDS.lng,
              `日本、大分県${address}`
            )
          );

          const service = new GeocodingService();
          await service.geocodeAddress(address);

          const calledParams = mockedAxios.get.mock.calls[0][1]?.params;
          const calledAddress = calledParams?.address;

          // ✅ 「大分県」が付加されることを確認（保持すべき動作）
          expect(calledAddress).toBe(`大分県${address}`);
          expect(calledAddress).toContain('大分県');

          jest.clearAllMocks();
        }),
        { numRuns: 14 }
      );
    });

    /**
     * プロパティ2: 既に「大分県」を含む住所では重複付加されない
     *
     * 既に都道府県名を含む住所では、修正前後ともに重複付加されないことを検証する。
     *
     * ✅ 修正前後ともに PASS する（保持すべき動作）
     *
     * **Validates: Requirements 3.2**
     */
    it('プロパティ2: 既に「大分県」を含む住所では重複付加されない', async () => {
      // 既に「大分県」を含む住所のジェネレーター
      const addressWithOitaArb = fc.constantFrom(
        '大分県大分市府内町1-1-1',
        '大分県別府市北浜1-1-1',
        '大分県中津市豊田町1-1-1',
        '大分県日田市元町1-1-1',
        '大分県佐伯市城下東町1-1-1',
        '大分県臼杵市大浜1-1-1',
        '大分県由布市湯布院町川上1-1-1'
      );

      await fc.assert(
        fc.asyncProperty(addressWithOitaArb, async (address) => {
          // 事前条件: 住所に「大分県」が含まれていることを確認
          expect(address).toContain('大分県');

          mockedAxios.get.mockResolvedValue(
            createMockGeocodingResponse(
              OITA_FUNACHO_COORDS.lat,
              OITA_FUNACHO_COORDS.lng,
              `日本、${address}`
            )
          );

          const service = new GeocodingService();
          await service.geocodeAddress(address);

          const calledParams = mockedAxios.get.mock.calls[0][1]?.params;
          const calledAddress = calledParams?.address;

          // ✅ 「大分県」が重複付加されないことを確認（保持すべき動作）
          expect(calledAddress).toBe(address);
          expect(calledAddress).not.toContain('大分県大分県');

          jest.clearAllMocks();
        }),
        { numRuns: 7 }
      );
    });

    /**
     * プロパティ3: 「大分県」を含まない住所では、APIに渡されるアドレスが
     *              元の住所に「大分県」を先頭付加した形式になる
     *
     * 修正前後で同じ変換ロジックが適用されることを検証する。
     *
     * ✅ 修正前後ともに PASS する（保持すべき動作）
     *
     * **Validates: Requirements 3.1**
     */
    it('プロパティ3: 「大分県」を含まない住所のAPIアドレスは「大分県」+元住所の形式になる', async () => {
      // 「大分県」を含まない任意の住所文字列のジェネレーター
      const addressWithoutOitaArb = fc.string({ minLength: 3, maxLength: 30 }).filter(
        s => !s.includes('大分県') && s.trim().length > 0
      );

      await fc.assert(
        fc.asyncProperty(addressWithoutOitaArb, async (address) => {
          // 事前条件: 住所に「大分県」が含まれていないことを確認
          expect(address).not.toContain('大分県');

          mockedAxios.get.mockResolvedValue(
            createMockGeocodingResponse(
              OITA_FUNACHO_COORDS.lat,
              OITA_FUNACHO_COORDS.lng,
              `日本、大分県${address}`
            )
          );

          const service = new GeocodingService();
          await service.geocodeAddress(address);

          const calledParams = mockedAxios.get.mock.calls[0][1]?.params;
          const calledAddress = calledParams?.address;

          // ✅ APIに渡されるアドレスが「大分県」+元住所の形式になることを確認
          expect(calledAddress).toBe(`大分県${address}`);

          jest.clearAllMocks();
        }),
        { numRuns: 50 }
      );
    });
  });
});
