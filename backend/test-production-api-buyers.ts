import fetch from 'node-fetch';

async function testProductionAPI() {
  console.log('🔍 Testing production API...\n');

  // 1. GET /api/buyers (一覧取得)
  console.log('1️⃣ Testing GET /api/buyers...');
  try {
    const response = await fetch('https://sateituikyaku-admin-backend.vercel.app/api/buyers?limit=5');
    console.log('   Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('   Response keys:', Object.keys(data));
      console.log('   Data structure:', JSON.stringify(data, null, 2).substring(0, 500));
    } else {
      console.log('   Error:', await response.text());
    }
  } catch (error: any) {
    console.log('   Error:', error.message);
  }

  // 2. GET /api/buyers/5641 (個別取得)
  console.log('\n2️⃣ Testing GET /api/buyers/5641...');
  try {
    const response = await fetch('https://sateituikyaku-admin-backend.vercel.app/api/buyers/5641');
    console.log('   Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('   Response keys:', Object.keys(data));
      console.log('   buyer_number:', data.buyer_number);
      console.log('   buyer_id:', data.buyer_id);
      console.log('   next_call_date:', data.next_call_date);
      console.log('   follow_up_assignee:', data.follow_up_assignee);
    } else {
      const errorText = await response.text();
      console.log('   Error:', errorText);
    }
  } catch (error: any) {
    console.log('   Error:', error.message);
  }

  // 3. GET /api/buyers/sidebar-counts (サイドバーカウント)
  console.log('\n3️⃣ Testing GET /api/buyers/sidebar-counts...');
  try {
    const response = await fetch('https://sateituikyaku-admin-backend.vercel.app/api/buyers/sidebar-counts');
    console.log('   Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('   Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('   Error:', await response.text());
    }
  } catch (error: any) {
    console.log('   Error:', error.message);
  }
}

testProductionAPI().catch(console.error);
