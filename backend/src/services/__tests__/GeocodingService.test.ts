import { GeocodingService } from '../GeocodingService';

describe('GeocodingService', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      const service = new GeocodingService();
      
      // 大分市と別府市の距離（約4.6km）
      const distance = service.calculateDistance(
        33.2382, 131.6126, // 大分市
        33.2795, 131.6128  // 別府市
      );
      
      // 約4.6kmであることを確認（誤差±0.5km）
      expect(distance).toBeGreaterThan(4.0);
      expect(distance).toBeLessThan(5.5);
    });

    it('should return 0 for same coordinates', () => {
      const service = new GeocodingService();
      
      const distance = service.calculateDistance(
        33.2382, 131.6126,
        33.2382, 131.6126
      );
      
      expect(distance).toBe(0);
    });

    it('should always return non-negative distance', () => {
      const service = new GeocodingService();
      
      // ランダムな座標で距離を計算
      const distance1 = service.calculateDistance(35.6762, 139.6503, 34.6937, 135.5023); // 東京-大阪
      const distance2 = service.calculateDistance(43.0642, 141.3469, 26.2124, 127.6809); // 札幌-那覇
      
      expect(distance1).toBeGreaterThanOrEqual(0);
      expect(distance2).toBeGreaterThanOrEqual(0);
    });

    it('should calculate Tokyo-Osaka distance correctly (approximately 400km)', () => {
      const service = new GeocodingService();
      
      // 東京駅と大阪駅の距離（約400km）
      const distance = service.calculateDistance(
        35.6812, 139.7671, // 東京駅
        34.7024, 135.4959  // 大阪駅
      );
      
      // 約400kmであることを確認（誤差±20km）
      expect(distance).toBeGreaterThan(380);
      expect(distance).toBeLessThan(420);
    });
  });

  describe('geocodeAddress', () => {
    // Note: このテストはGoogle Maps APIキーが必要なため、実際のAPIを呼び出します
    // CI/CD環境では環境変数が設定されていない場合はスキップされます
    
    it('should throw error if API key is not set', () => {
      // 環境変数を一時的に削除
      const originalKey = process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;
      
      expect(() => {
        new GeocodingService();
      }).toThrow('GOOGLE_MAPS_API_KEY is not set');
      
      // 環境変数を復元
      process.env.GOOGLE_MAPS_API_KEY = originalKey;
    });
  });
});
