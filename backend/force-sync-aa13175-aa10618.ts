import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

async function forceSyncSellers() {
  const syncService = new EnhancedAutoSyncService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await syncService.initialize();

  const sellerNumbers = ['AA13175', 'AA10618'];

  console.log('強制同期を開始します...\n');

  for (const sellerNumber of sellerNumbers) {
    console.log(`=== ${sellerNumber} ===`);
    
    try {
      // スプレッドシートから最新データを取得して更新
      await syncService.syncUpdatedSellers([sellerNumber]);
      console.log(`✅ ${sellerNumber}: 同期成功\n`);
    } catch (error: any) {
      console.error(`❌ ${sellerNumber}: 同期失敗 - ${error.message}\n`);
    }
  }

  console.log('強制同期が完了しました。');
}

forceSyncSellers().catch(console.error);
