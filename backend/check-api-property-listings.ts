import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkApiPropertyListings() {
  console.log('APIエンドポイントから物件データを取得中...\n');
  
  try {
    const response = await axios.get('https://sateituikyaku-admin-backend.vercel.app/api/property-listings', {
      params: { limit: 1000, offset: 0 }
    });
    
    const listings = response.data.data || [];
    console.log(`取得した物件数: ${listings.length}件\n`);
    
    const incompleteListings = listings.filter((l: any) => l.confirmation === '未');
    console.log(`確認フィールドが「未」の物件: ${incompleteListings.length}件\n`);
    
    if (incompleteListings.length > 0) {
      console.log('確認フィールドが「未」の物件一覧:');
      incompleteListings.forEach((l: any) => {
        console.log(`  - ${l.property_number}: 確認=${l.confirmation}`);
      });
    } else {
      console.log('  （該当物件なし）');
    }
  } catch (error: any) {
    console.error('エラー:', error.message);
  }
}

checkApiPropertyListings();
