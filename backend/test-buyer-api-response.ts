import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を最初に読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

import { BuyerService } from './src/services/BuyerService';

async function testBuyerAPIResponse() {
  console.log('📊 BuyerService.getStatusCategoriesWithBuyers() をテスト中...\n');

  const buyerService = new BuyerService();
  const result = await buyerService.getStatusCategoriesWithBuyers();

  console.log('✅ APIレスポンス:');
  console.log('  categories.length:', result.categories.length);
  console.log('  buyers.length:', result.buyers.length);
  console.log('  normalStaffInitials.length:', result.normalStaffInitials.length);
  console.log('');

  // 買主7282を探す
  const buyer7282 = result.buyers.find((b: any) => b.buyer_number === '7282');
  if (buyer7282) {
    console.log('✅ 買主7282が見つかりました:');
    console.log('  buyer_number:', buyer7282.buyer_number);
    console.log('  calculated_status:', buyer7282.calculated_status);
    console.log('  status_priority:', buyer7282.status_priority);
    console.log('  viewing_date:', buyer7282.viewing_date);
    console.log('  broker_inquiry:', buyer7282.broker_inquiry);
    console.log('  notification_sender:', buyer7282.notification_sender);
  } else {
    console.log('⚠️  買主7282が見つかりません');
  }
  console.log('');

  // 「内覧日前日」カテゴリを探す
  const viewingDayBeforeCategory = result.categories.find((c: any) => c.status === '内覧日前日');
  if (viewingDayBeforeCategory) {
    console.log('✅ 「内覧日前日」カテゴリが見つかりました:');
    console.log('  status:', viewingDayBeforeCategory.status);
    console.log('  count:', viewingDayBeforeCategory.count);
    console.log('  priority:', viewingDayBeforeCategory.priority);
    console.log('  color:', viewingDayBeforeCategory.color);
  } else {
    console.log('⚠️  「内覧日前日」カテゴリが見つかりません');
  }
  console.log('');

  // calculated_status が「内覧日前日」の買主を探す
  const viewingDayBeforeBuyers = result.buyers.filter((b: any) => b.calculated_status === '内覧日前日');
  console.log(`✅ calculated_status が「内覧日前日」の買主: ${viewingDayBeforeBuyers.length}件`);
  viewingDayBeforeBuyers.forEach((b: any) => {
    console.log(`  - ${b.buyer_number}: ${b.calculated_status}`);
  });
}

testBuyerAPIResponse().catch(console.error);
