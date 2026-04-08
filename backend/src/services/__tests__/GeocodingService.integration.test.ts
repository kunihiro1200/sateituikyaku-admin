import { GeocodingService } from '../GeocodingService';

describe('GeocodingService Integration Tests', () => {
  // Note: これらのテストは実際のGoogle Maps APIを呼び出すため、
  // APIキーが設定されている環境でのみ実行されます
  
  let service: GeocodingService;

  beforeAll(() => {
    // APIキーが設定されていない場合はテストをスキップ
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.warn('GOOGLE_MAPS_API_KEY is not set. Skipping integration tests.');
    }
  });

  beforeEach(() => {
    if (process.env.GOOGLE_MAPS_API_KEY) {
      service = new GeocodingService();
    }
  });

  describe('geocodeAddress', () => {
    it('should geocode a valid Japanese address', async () => {
      if (!process.env.GOOGLE_MAPS_API_KEY) {
        console.warn('Skipping test: GOOGLE_MAPS_API_KEY not set');
        return;
      }

      const address = '大分県大分市府内町1-1-1';
      const coordinates = await service.geocodeAddress(address);

      expect(coordinates).not.toBeNull();
      expect(coordinates?.lat).toBeGreaterThan(33.0);
      expect(coordinates?.lat).toBeLessThan(34.0);
      expect(coordinates?.lng).toBeGreaterThan(131.0);
      expect(coordinates?.lng).toBeLessThan(132.0);
    }, 10000); // 10秒タイムアウト

    it('should return null for invalid address', async () => {
      if (!process.env.GOOGLE_MAPS_API_KEY) {
        console.warn('Skipping test: GOOGLE_MAPS_API_KEY not set');
        return;
      }

      const address = 'あいうえおかきくけこ';
      const coordinates = await service.geocodeAddress(address);

      expect(coordinates).toBeNull();
    }, 10000);

    it('should geocode Tokyo Station', async () => {
      if (!process.env.GOOGLE_MAPS_API_KEY) {
        console.warn('Skipping test: GOOGLE_MAPS_API_KEY not set');
        return;
      }

      const address = '東京都千代田区丸の内1-9-1';
      const coordinates = await service.geocodeAddress(address);

      expect(coordinates).not.toBeNull();
      // 東京駅の座標は約35.68, 139.77
      expect(coordinates?.lat).toBeGreaterThan(35.6);
      expect(coordinates?.lat).toBeLessThan(35.7);
      expect(coordinates?.lng).toBeGreaterThan(139.7);
      expect(coordinates?.lng).toBeLessThan(139.8);
    }, 10000);
  });

  describe('Integration: geocodeAddress + calculateDistance', () => {
    it('should calculate distance between two geocoded addresses', async () => {
      if (!process.env.GOOGLE_MAPS_API_KEY) {
        console.warn('Skipping test: GOOGLE_MAPS_API_KEY not set');
        return;
      }

      // 大分市と別府市の住所をジオコーディング
      const oitaAddress = '大分県大分市府内町1-1-1';
      const beppuAddress = '大分県別府市上野口町1-15';

      const oitaCoords = await service.geocodeAddress(oitaAddress);
      const beppuCoords = await service.geocodeAddress(beppuAddress);

      expect(oitaCoords).not.toBeNull();
      expect(beppuCoords).not.toBeNull();

      // 距離を計算
      const distance = service.calculateDistance(
        oitaCoords!.lat,
        oitaCoords!.lng,
        beppuCoords!.lat,
        beppuCoords!.lng
      );

      // 大分市と別府市の距離は約10-15km
      expect(distance).toBeGreaterThan(8);
      expect(distance).toBeLessThan(20);
    }, 20000); // 20秒タイムアウト（2回のAPI呼び出し）
  });
});
