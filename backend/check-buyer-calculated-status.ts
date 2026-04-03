import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

import { BuyerService } from './src/services/BuyerService';

async function checkBuyerCalculatedStatus() {
  const buyerService = new BuyerService();
  
  console.log('🔍 買主の calculated_status を確認...\n');
  
  // ステータス付きで全買主を取得
  const allBuyers = await buyerService.getBuyersWithStatus();
  
  console.log(`📊 取得した買主数: ${allBuyers.length}件\n`);
  
  // 最初の10件を表示
  allBuyers.slice(0, 10).forEach((buyer: any) => {
    console.log(`買主番号: ${buyer.buyer_number}`);
    console.log(`  氏名: ${buyer.name}`);
    console.log(`  calculated_status: "${buyer.calculated_status}"`);
    console.log(`  内覧日: ${buyer.viewing_date || '未設定'}`);
    console.log('');
  });
  
  // ステータスカテゴリ別の買主数を確認
  console.log('\n📊 ステータスカテゴリ別の買主数:');
  const statusCounts: Record<string, number> = {};
  allBuyers.forEach((buyer: any) => {
    const status = buyer.calculated_status || '未設定';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}件`);
  });
}

checkBuyerCalculatedStatus().catch(console.error);
