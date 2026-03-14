import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
  const service = new EnhancedAutoSyncService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  await service.initialize();

  console.log('更新対象を検出中...');
  const updated = await service.detectUpdatedSellers();
  console.log(`更新対象: ${updated.length}件`);

  if (updated.length > 0) {
    console.log('同期開始...');
    const result = await service.syncUpdatedSellers(updated);
    console.log(`完了: ${result.updatedSellersCount}件更新, ${result.errors.length}件エラー`);
    if (result.errors.length > 0) {
      console.log('エラー一覧:', result.errors.map(e => `${e.sellerNumber}: ${e.message}`).join('\n'));
    }
  }
}

main().catch(console.error);
