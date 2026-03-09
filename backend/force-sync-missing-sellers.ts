/**
 * 不足売主を強制同期するスクリプト
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { getEnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';

async function main() {
  console.log('=== 不足売主の強制同期 ===\n');

  const syncService = getEnhancedAutoSyncService();

  console.log('不足売主を検出中...');
  const missing = await syncService.detectMissingSellers();
  console.log(`不足売主数: ${missing.length}`);
  
  if (missing.length === 0) {
    console.log('✅ 不足売主なし');
    return;
  }

  // AA13686以降のみ表示
  const newSellers = missing.filter(n => {
    const num = parseInt(n.replace('AA', ''), 10);
    return num >= 13686;
  });
  console.log(`AA13686以降の不足売主: ${newSellers.length}件`);
  console.log(newSellers.join(', '));

  console.log('\n同期実行中...');
  const result = await syncService.syncMissingSellers(missing);
  console.log(`✅ 追加: ${result.newSellersCount}件, エラー: ${result.errors.length}件`);
  if (result.errors.length > 0) {
    result.errors.slice(0, 5).forEach(e => console.error(`  ❌ ${e.sellerNumber}: ${e.message}`));
  }
}

main().catch(console.error);
