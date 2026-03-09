import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

async function check() {
  try {
    // ローカルAPIを叩いてAA13688のデータを確認
    const response = await axios.get('http://localhost:3000/api/sellers', {
      params: { limit: 2000 }
    });
    
    const sellers = response.data.sellers || response.data;
    const aa13688 = sellers.find((s: any) => s.sellerNumber === 'AA13688');
    
    if (!aa13688) {
      console.log('AA13688が見つかりません');
      console.log('総件数:', sellers.length);
      return;
    }
    
    console.log('AA13688のAPIレスポンス:');
    console.log(JSON.stringify({
      sellerNumber: aa13688.sellerNumber,
      status: aa13688.status,
      nextCallDate: aa13688.nextCallDate,
      contactMethod: aa13688.contactMethod,
      preferredContactTime: aa13688.preferredContactTime,
      phoneContactPerson: aa13688.phoneContactPerson,
      visitAssignee: aa13688.visitAssignee,
      visitAssigneeInitials: aa13688.visitAssigneeInitials,
    }, null, 2));
  } catch (error: any) {
    console.error('エラー:', error.message);
  }
}

check();
