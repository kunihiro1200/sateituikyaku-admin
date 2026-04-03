import { SellerService } from './src/services/SellerService.supabase';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function test() {
  console.log('=== getSidebarCounts()をテスト ===\n');
  
  const service = new SellerService();
  const counts = await service.getSidebarCounts();
  
  console.log('📊 訪問日前日カウント:', counts.visitDayBefore);
  console.log('📊 訪問済みカウント:', counts.visitCompleted);
  console.log('📊 当日TEL（担当）カウント:', counts.todayCallAssigned);
  console.log('📊 担当(イニシャル)カウント:', JSON.stringify(counts.visitAssignedCounts, null, 2));
}

test().catch(console.error);
