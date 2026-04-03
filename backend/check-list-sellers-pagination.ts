import { SellerService } from './src/services/SellerService.supabase';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env.local' });

async function main() {
  const sellerService = new SellerService();
  
  console.log('=== listSellers with visitDayBefore category ===');
  
  // ページ1、50件取得
  const result = await sellerService.listSellers({
    page: 1,
    pageSize: 50,
    sortBy: 'inquiry_date',
    sortOrder: 'desc',
    statusCategory: 'visitDayBefore',
  });
  
  console.log('Total:', result.total);
  console.log('Data length:', result.data.length);
  console.log('Sellers:');
  result.data.forEach((seller: any) => {
    console.log(`  - ${seller.sellerNumber}: ${seller.name}, visitAssignee=${seller.visitAssignee}, visitDate=${seller.visitDate}`);
  });
}

main().catch(console.error);
