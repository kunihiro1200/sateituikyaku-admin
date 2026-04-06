import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testBuyer7294API() {
  console.log('[test-buyer-7294-api] ===== START =====');
  
  try {
    // /api/buyers/status-categories-with-buyers を呼び出し
    console.log('[test-buyer-7294-api] Calling /api/buyers/status-categories-with-buyers...');
    const response = await axios.get(`${API_BASE_URL}/api/buyers/status-categories-with-buyers`);
    
    const { categories, buyers, normalStaffInitials } = response.data;
    
    console.log('[test-buyer-7294-api] Total buyers:', buyers.length);
    console.log('[test-buyer-7294-api] normalStaffInitials:', normalStaffInitials);
    
    // 買主7294を検索
    const buyer7294 = buyers.find((b: any) => b.buyer_number === '7294');
    
    if (buyer7294) {
      console.log('[test-buyer-7294-api] ✅ Buyer 7294 found!');
      console.log('[test-buyer-7294-api] Buyer 7294 data:');
      console.log('  buyer_number:', buyer7294.buyer_number);
      console.log('  name:', buyer7294.name);
      console.log('  calculated_status:', buyer7294.calculated_status);
      console.log('  status_priority:', buyer7294.status_priority);
      console.log('  three_calls_confirmed:', buyer7294.three_calls_confirmed);
      console.log('  inquiry_email_phone:', buyer7294.inquiry_email_phone);
    } else {
      console.log('[test-buyer-7294-api] ❌ Buyer 7294 NOT found!');
    }
    
    // 「３回架電未」カテゴリの買主を抽出
    const threeCallUncheckedBuyers = buyers.filter((b: any) => b.calculated_status === '3回架電未');
    console.log('[test-buyer-7294-api] "3回架電未" buyers count:', threeCallUncheckedBuyers.length);
    
    if (threeCallUncheckedBuyers.length > 0) {
      console.log('[test-buyer-7294-api] "3回架電未" buyers:');
      threeCallUncheckedBuyers.forEach((b: any) => {
        console.log(`  - ${b.buyer_number}: ${b.name}`);
      });
    }
    
    // categoriesを確認
    console.log('[test-buyer-7294-api] categories.threeCallUnchecked:', categories.threeCallUnchecked);
    
  } catch (error: any) {
    console.error('[test-buyer-7294-api] Error:', error.message);
  }
  
  console.log('[test-buyer-7294-api] ===== END =====');
}

testBuyer7294API();
