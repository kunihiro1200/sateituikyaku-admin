# BuyerCandidateService.ts の getPropertyCoordsFromAddress を
# 座標カラム優先（latitude/longitude）に変更するスクリプト
import sys

filepath = 'src/services/BuyerCandidateService.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '''  private async getPropertyCoordsFromAddress(property: any): Promise<{ lat: number; lng: number } | null> {
    try {
      const address = (property.address || '').trim();
      if (!address) {
        return null;
      }

      const coords = await this.geocodingService.geocodeAddress(address);
      if (!coords) {
        return null;
      }

      return { lat: coords.latitude, lng: coords.longitude };
    } catch (error) {
      console.error(`[BuyerCandidateService] Error geocoding property address:`, error);
      return null;
    }
  }'''

new = '''  private async getPropertyCoordsFromAddress(property: any): Promise<{ lat: number; lng: number } | null> {
    try {
      // 1. property_listings の latitude/longitude カラムを優先使用（GeocodingService不要）
      if (property.latitude != null && property.longitude != null) {
        console.log(`[BuyerCandidateService] Using stored coords for ${property.property_number}: (${property.latitude}, ${property.longitude})`);
        return { lat: property.latitude, lng: property.longitude };
      }

      // 2. 座標カラムがない場合は GeocodingService にフォールバック
      const address = (property.address || '').trim();
      if (!address) {
        return null;
      }

      const coords = await this.geocodingService.geocodeAddress(address);
      if (!coords) {
        return null;
      }

      return { lat: coords.latitude, lng: coords.longitude };
    } catch (error) {
      console.error(`[BuyerCandidateService] Error getting property coords:`, error);
      return null;
    }
  }'''

if old not in text:
    print('ERROR: old string not found')
    sys.exit(1)

text = text.replace(old, new)

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! getPropertyCoordsFromAddress updated to use stored coords first.')
