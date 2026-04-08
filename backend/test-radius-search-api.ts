import axios from 'axios';

async function testRadiusSearchAPI() {
  console.log('=== Testing radius search API ===');
  
  const API_URL = 'https://sateituikyaku-admin-backend.vercel.app';
  
  try {
    const response = await axios.post(`${API_URL}/api/buyers/radius-search`, {
      address: '大分市大津町',
      priceRange: '1000万円~2999万円',
      propertyTypes: ['マンション']
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    console.log('Buyers count:', response.data.buyers?.length || 0);
    
    if (response.data.buyers && response.data.buyers.length > 0) {
      console.log('\nFirst buyer:');
      console.log(JSON.stringify(response.data.buyers[0], null, 2));
    }
  } catch (error: any) {
    console.error('Error:', error.response?.status, error.response?.statusText);
    console.error('Error data:', JSON.stringify(error.response?.data, null, 2));
  }
}

testRadiusSearchAPI().catch(console.error);
