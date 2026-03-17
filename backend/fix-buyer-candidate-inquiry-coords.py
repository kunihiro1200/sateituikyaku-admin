# matchesByInquiryDistance を座標カラム優先に変更するスクリプト
import sys

filepath = 'src/services/BuyerCandidateService.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '''      // property_listings から住所を取得
      const { data: inquiryProperty, error } = await this.supabase
        .from('property_listings')
        .select('address')
        .eq('property_number', firstPropertyNumber)
        .single();

      if (error || !inquiryProperty || !inquiryProperty.address) {
        geocodingCache.set(firstPropertyNumber, null);
        return false;
      }

      // GeocodingService で座標を取得
      const coords = await this.geocodingService.geocodeAddress(inquiryProperty.address);
      if (!coords) {
        geocodingCache.set(firstPropertyNumber, null);
        return false;
      }

      const inquiryCoords = { lat: coords.latitude, lng: coords.longitude };
      geocodingCache.set(firstPropertyNumber, inquiryCoords);'''

new = '''      // property_listings から住所と座標を取得
      const { data: inquiryProperty, error } = await this.supabase
        .from('property_listings')
        .select('address, latitude, longitude')
        .eq('property_number', firstPropertyNumber)
        .single();

      if (error || !inquiryProperty) {
        geocodingCache.set(firstPropertyNumber, null);
        return false;
      }

      let inquiryCoords: { lat: number; lng: number } | null = null;

      // 1. 座標カラムを優先使用
      if (inquiryProperty.latitude != null && inquiryProperty.longitude != null) {
        inquiryCoords = { lat: inquiryProperty.latitude, lng: inquiryProperty.longitude };
      } else if (inquiryProperty.address) {
        // 2. 座標カラムがない場合は GeocodingService にフォールバック
        const coords = await this.geocodingService.geocodeAddress(inquiryProperty.address);
        if (coords) {
          inquiryCoords = { lat: coords.latitude, lng: coords.longitude };
        }
      }

      if (!inquiryCoords) {
        geocodingCache.set(firstPropertyNumber, null);
        return false;
      }

      geocodingCache.set(firstPropertyNumber, inquiryCoords);'''

if old not in text:
    print('ERROR: old string not found')
    sys.exit(1)

text = text.replace(old, new)

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! matchesByInquiryDistance updated to use stored coords first.')
