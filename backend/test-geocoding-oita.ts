// 「大分県」自動追加機能のテスト
import { GeocodingService } from './src/services/GeocodingService';

async function testGeocodingOita() {
  console.log('===== Geocoding Test: Oita Prefecture Auto-Prefix =====\n');

  const geocodingService = new GeocodingService();

  const testCases = [
    '別府市',
    '大分市',
    '大分市舞鶴町',
    '大分県別府市',
    '大分県大分市',
    '大分県大分市舞鶴町',
  ];

  for (const address of testCases) {
    console.log(`\n--- Testing: "${address}" ---`);
    try {
      const coordinates = await geocodingService.geocodeAddress(address);
      if (coordinates) {
        console.log(`✅ Success: lat=${coordinates.lat}, lng=${coordinates.lng}`);
      } else {
        console.log(`❌ Failed: Unable to geocode`);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // レート制限対策：1秒待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n===== Test Complete =====');
}

testGeocodingOita().catch(console.error);
