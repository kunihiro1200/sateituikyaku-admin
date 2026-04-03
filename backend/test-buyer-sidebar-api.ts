import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を最初に読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

import { BuyerService } from './src/services/BuyerService';

async function testBuyerSidebarAPI() {
  console.log('📊 BuyerService.getSidebarCounts() をテスト中...\n');

  const buyerService = new BuyerService();
  const counts = await buyerService.getSidebarCounts();

  console.log('✅ APIレスポンス:\n');
  console.log(JSON.stringify(counts, null, 2));

  // viewingDayBefore カテゴリが含まれているか確認
  if (counts.viewingDayBefore !== undefined) {
    console.log('\n✅ viewingDayBefore カテゴリが含まれています');
    console.log(`   カウント: ${counts.viewingDayBefore}`);
  } else {
    console.log('\n❌ viewingDayBefore カテゴリが含まれていません');
  }
}

testBuyerSidebarAPI().catch(console.error);
