// Google Geocoding APIを使用して住所から座標を取得するサービス
import axios from 'axios';

export interface Coordinates {
  lat: number;
  lng: number;
  latitude: number;  // 後方互換性のため
  longitude: number; // 後方互換性のため
}

export class GeocodingService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is not set');
    }
  }

  /**
   * 住所を地理座標に変換
   * @param address 住所（例: "大分県大分市府内町1-1-1"）
   * @returns 緯度経度、または変換失敗時はnull
   */
  async geocodeAddress(address: string, sellerPrefix?: string): Promise<Coordinates | null> {
    try {
      // 「大分県」が含まれていない場合は自動的に追加（AAプレフィックスまたは未指定の場合のみ）
      let fullAddress = address;
      if (!address.includes('大分県') && (!sellerPrefix || sellerPrefix === 'AA')) {
        fullAddress = `大分県${address}`;
      }
      
      console.log(`[GeocodingService] Geocoding address: "${address}" -> "${fullAddress}" (sellerPrefix: ${sellerPrefix || 'none'})`);
      
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: fullAddress,
          key: this.apiKey,
          language: 'ja',
          region: 'jp',
        },
      });

      if (response.data.status !== 'OK' || response.data.results.length === 0) {
        console.error('[GeocodingService] Geocoding failed:', response.data.status);
        console.error('[GeocodingService] Error message:', response.data.error_message);
        console.error('[GeocodingService] Full response:', JSON.stringify(response.data, null, 2));
        return null;
      }

      const location = response.data.results[0].geometry.location;
      const formattedAddress = response.data.results[0].formatted_address;
      
      console.log(`[GeocodingService] Geocoding success: "${fullAddress}" -> lat=${location.lat}, lng=${location.lng}, formatted="${formattedAddress}"`);
      
      return {
        lat: location.lat,
        lng: location.lng,
        latitude: location.lat,  // 後方互換性のため
        longitude: location.lng, // 後方互換性のため
      };
    } catch (error: any) {
      console.error('[GeocodingService] Error calling Google Maps API:', error);
      return null;
    }
  }

  /**
   * Haversine公式を使用して2点間の距離を計算
   * @param lat1 地点1の緯度
   * @param lng1 地点1の経度
   * @param lat2 地点2の緯度
   * @param lng2 地点2の経度
   * @returns 距離（km）
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // 地球の半径（km）
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * 複数の住所を一括でジオコーディング（レート制限対策付き）
   * @param addresses 住所の配列
   * @param delayMs リクエスト間の遅延（ミリ秒）
   * @returns 座標の配列
   */
  async geocodeAddressesBatch(
    addresses: string[],
    delayMs: number = 200
  ): Promise<Array<{ address: string; coordinates: Coordinates | null }>> {
    const results: Array<{ address: string; coordinates: Coordinates | null }> = [];

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      console.log(`[GeocodingService] Processing ${i + 1}/${addresses.length}: ${address}`);

      const coordinates = await this.geocodeAddress(address);
      results.push({ address, coordinates });

      // レート制限対策：次のリクエストまで待機
      if (i < addresses.length - 1) {
        await this.delay(delayMs);
      }
    }

    return results;
  }

  /**
   * 指定時間待機
   * @param ms ミリ秒
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
