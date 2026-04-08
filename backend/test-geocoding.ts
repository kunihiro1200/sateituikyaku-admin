// Google Geocoding APIのテスト
import { GeocodingService } from './src/services/GeocodingService';

async function testGeocoding() {
  try {
    console.log('Testing GeocodingService...');
    console.log('GOOGLE_MAPS_API_KEY:', process.env.GOOGLE_MAPS_API_KEY ? 'Set' : 'Not set');
    
    const geocodingService = new GeocodingService();
    
    // テスト住所
    const testAddress = '大分県大分市舞鶴町1-3-30';
    console.log(`\nGeocoding address: ${testAddress}`);
    
    const coordinates = await geocodingService.geocodeAddress(testAddress);
    
    if (coordinates) {
      console.log('✅ Success!');
      console.log('Coordinates:', coordinates);
    } else {
      console.log('❌ Failed: coordinates is null');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testGeocoding();
