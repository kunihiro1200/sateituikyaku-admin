/**
 * 本番環境のAPIレスポンスを確認するスクリプト
 */

async function testProductionAPI() {
  const BACKEND_URL = 'https://sateituikyaku-admin-backend.vercel.app';
  
  console.log('🔍 Testing production API for AA13729...\n');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/sellers/by-number?sellerNumber=AA13729`);
    
    if (!response.ok) {
      console.error('❌ API request failed:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ API Response received\n');
    console.log('📊 Seller data:');
    console.log('  - ID:', data.id);
    console.log('  - Seller Number:', data.sellerNumber);
    console.log('  - Visit Date:', data.visitDate);
    console.log('  - Visit Assignee:', data.visitAssignee);
    console.log('\n📝 Full response:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testProductionAPI();
