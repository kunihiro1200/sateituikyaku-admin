import * as dotenv from 'dotenv';
import { BuyerService } from './src/services/BuyerService';

// 環境変数を読み込む
dotenv.config({ path: './backend/.env' });

async function test() {
  const buyerService = new BuyerService();
  
  console.log('=== Testing Buyer Sidebar Counts ===\n');
  
  // 1. サイドバーカウントを取得
  const sidebarCounts = await buyerService.getSidebarCounts();
  console.log('Sidebar counts:', JSON.stringify(sidebarCounts, null, 2));
  
  console.log('\n=== Testing Status Categories with Buyers ===\n');
  
  // 2. ステータスカテゴリと買主データを取得
  const result = await buyerService.getStatusCategoriesWithBuyers();
  console.log('Categories:', JSON.stringify(result.categories, null, 2));
  console.log('\nTotal buyers:', result.buyers.length);
  
  // 3. 内覧日前日の買主を抽出
  const viewingDayBeforeBuyers = result.buyers.filter(b => b.calculated_status === '内覧日前日');
  console.log('\n内覧日前日の買主:', viewingDayBeforeBuyers.length, '件');
  
  if (viewingDayBeforeBuyers.length > 0) {
    console.log('\n最初の5件:');
    viewingDayBeforeBuyers.slice(0, 5).forEach(b => {
      console.log(`  - ${b.buyer_number}: ${b.name} (calculated_status: ${b.calculated_status})`);
    });
  } else {
    console.log('⚠️ 内覧日前日の買主が見つかりませんでした');
    
    // 全買主のcalculated_statusを確認
    const statusCounts: Record<string, number> = {};
    result.buyers.forEach(b => {
      const status = b.calculated_status || '(空)';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('\n全買主のステータス分布:');
    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([status, count]) => {
        console.log(`  ${status}: ${count}件`);
      });
  }
  
  // 4. サイドバーカウントと実際の買主数を比較
  console.log('\n=== Comparison ===');
  console.log(`Sidebar viewingDayBefore count: ${sidebarCounts.viewingDayBefore}`);
  console.log(`Actual buyers with "内覧日前日": ${viewingDayBeforeBuyers.length}`);
  
  if (sidebarCounts.viewingDayBefore !== viewingDayBeforeBuyers.length) {
    console.log('❌ MISMATCH: Sidebar count does not match actual buyers!');
  } else {
    console.log('✅ MATCH: Sidebar count matches actual buyers');
  }
}

test().catch(console.error);
