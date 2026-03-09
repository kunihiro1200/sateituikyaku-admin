/**
 * 更新同期を強制実行するスクリプト
 * unreachable_status と comments の同期確認用
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function forceUpdateSync() {
  console.log('🔄 Starting forced update sync...\n');

  try {
    const { getEnhancedAutoSyncService } = await import('./src/services/EnhancedAutoSyncService');
    const syncService = getEnhancedAutoSyncService();
    
    console.log('📊 Initializing sync service...');
    await syncService.initialize();
    console.log('✅ Sync service initialized\n');

    // 更新が必要な売主を検出
    console.log('🔍 Detecting updated sellers...');
    const updatedSellers = await syncService.detectUpdatedSellers();
    console.log(`📋 Found ${updatedSellers.length} sellers needing update\n`);

    if (updatedSellers.length === 0) {
      console.log('✅ No sellers need updating. Database is up to date!');
      process.exit(0);
    }

    // 最初の20件を表示
    console.log('Sellers to update (first 20):');
    updatedSellers.slice(0, 20).forEach((sellerNumber, index) => {
      console.log(`  ${index + 1}. ${sellerNumber}`);
    });
    if (updatedSellers.length > 20) {
      console.log(`  ... and ${updatedSellers.length - 20} more\n`);
    } else {
      console.log('');
    }

    // 更新同期を実行
    console.log('🚀 Starting update sync...');
    const startTime = Date.now();
    const result = await syncService.syncUpdatedSellers(updatedSellers);
    const duration = Date.now() - startTime;

    console.log('\n📊 Update Results:');
    console.log('─'.repeat(50));
    console.log(`✅ Status: ${result.success ? 'success' : 'failed'}`);
    console.log(`🔄 Sellers updated: ${result.updatedSellersCount}`);
    console.log(`❌ Errors: ${result.errors.length}`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log('─'.repeat(50));

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.slice(0, 5).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.sellerNumber}: ${error.message}`);
      });
    }

    console.log('\n✅ Update sync completed!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Update sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

forceUpdateSync();
