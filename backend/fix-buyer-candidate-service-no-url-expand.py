"""
BuyerCandidateService.ts から google_map_url のリアルタイム展開を排除する。
- getPropertyCoordsFromAddress: latitude/longitude カラムのみ使用
- matchesByInquiryDistance: latitude/longitude カラムのみ使用
"""
import re

filepath = 'backend/src/services/BuyerCandidateService.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# --- getPropertyCoordsFromAddress を修正 ---
old_get_coords = '''  /**
   * 物件の座標を取得
   * 優先順位: 1. google_map_url から抽出 → 2. latitude/longitude カラム → 3. GeocodingService
   */
  private async getPropertyCoordsFromAddress(property: any): Promise<{ lat: number; lng: number } | null> {
    try {
      // 1. google_map_url から座標を抽出（最優先）
      if (property.google_map_url) {
        const coords = await this.geolocationService.extractCoordinatesFromUrl(property.google_map_url);
        if (coords) {
          console.log(`[BuyerCandidateService] Using google_map_url coords for ${property.property_number}: (${coords.lat}, ${coords.lng})`);
          return { lat: coords.lat, lng: coords.lng };
        }
      }

      // 2. latitude/longitude カラムを使用
      if (property.latitude != null && property.longitude != null) {
        console.log(`[BuyerCandidateService] Using stored coords for ${property.property_number}: (${property.latitude}, ${property.longitude})`);
        return { lat: property.latitude, lng: property.longitude };
      }

      // 3. GeocodingService にフォールバック
      const address = (property.address || '').trim();
      if (!address) {
        return null;
      }

      const geocoded = await this.geocodingService.geocodeAddress(address);
      if (!geocoded) {
        return null;
      }

      return { lat: geocoded.latitude, lng: geocoded.longitude };
    } catch (error) {
      console.error(`[BuyerCandidateService] Error getting property coords:`, error);
      return null;
    }
  }'''

new_get_coords = '''  /**
   * 物件の座標を取得
   * DBに保存済みの latitude/longitude カラムのみ使用（リアルタイムURL展開は行わない）
   */
  private async getPropertyCoordsFromAddress(property: any): Promise<{ lat: number; lng: number } | null> {
    try {
      // latitude/longitude カラムを使用（DBに保存済みの座標）
      if (property.latitude != null && property.longitude != null) {
        console.log(`[BuyerCandidateService] Using stored coords for ${property.property_number}: (${property.latitude}, ${property.longitude})`);
        return { lat: property.latitude, lng: property.longitude };
      }

      // 座標がなければスキップ
      console.log(`[BuyerCandidateService] No stored coords for ${property.property_number}, skipping distance matching`);
      return null;
    } catch (error) {
      console.error(`[BuyerCandidateService] Error getting property coords:`, error);
      return null;
    }
  }'''

if old_get_coords in text:
    text = text.replace(old_get_coords, new_get_coords)
    print('✅ getPropertyCoordsFromAddress を修正しました')
else:
    print('❌ getPropertyCoordsFromAddress のパターンが見つかりません')

# --- matchesByInquiryDistance を修正 ---
old_match_distance = '''      let inquiryCoords: { lat: number; lng: number } | null = null;

      // 1. google_map_url から座標を抽出（最優先）
      if (inquiryProperty.google_map_url) {
        const coords = await this.geolocationService.extractCoordinatesFromUrl(inquiryProperty.google_map_url);
        if (coords) {
          inquiryCoords = { lat: coords.lat, lng: coords.lng };
        }
      }

      // 2. latitude/longitude カラムを使用
      if (!inquiryCoords && inquiryProperty.latitude != null && inquiryProperty.longitude != null) {
        inquiryCoords = { lat: inquiryProperty.latitude, lng: inquiryProperty.longitude };
      } else if (!inquiryCoords && inquiryProperty.address) {
        // 3. GeocodingService にフォールバック
        const coords = await this.geocodingService.geocodeAddress(inquiryProperty.address);
        if (coords) {
          inquiryCoords = { lat: coords.latitude, lng: coords.longitude };
        }
      }'''

new_match_distance = '''      let inquiryCoords: { lat: number; lng: number } | null = null;

      // DBに保存済みの latitude/longitude カラムのみ使用（リアルタイムURL展開は行わない）
      if (inquiryProperty.latitude != null && inquiryProperty.longitude != null) {
        inquiryCoords = { lat: inquiryProperty.latitude, lng: inquiryProperty.longitude };
      }'''

if old_match_distance in text:
    text = text.replace(old_match_distance, new_match_distance)
    print('✅ matchesByInquiryDistance を修正しました')
else:
    print('❌ matchesByInquiryDistance のパターンが見つかりません')

# getCandidatesForProperty の property select に latitude/longitude を追加
old_select = "      .select('*')"
new_select = "      .select('*')"
# すでに * で全カラム取得しているので変更不要

# 書き込み
with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

# 確認
with open(filepath, 'rb') as f:
    verify = f.read().decode('utf-8')

if 'リアルタイムURL展開は行わない' in verify:
    print('✅ 修正が正しく適用されています')
else:
    print('❌ 修正の確認に失敗しました')
