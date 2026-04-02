import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testBuyer7272Sync() {
  console.log('🔍 買主番号7272の同期テスト開始...\n');
  
  const syncService = new EnhancedAutoSyncService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  // 買主初期化
  await syncService.initializeBuyer();
  
  // キャッシュをクリア
  syncService.clearBuyerSpreadsheetCache();
  
  // 不足している買主を検出
  console.log('📊 不足している買主を検出中...');
  const missingBuyers = await syncService.detectMissingBuyers();
  
  console.log(`\n🆕 不足している買主: ${missingBuyers.length}件`);
  console.log('   買主番号:', missingBuyers.join(', '));
  
  // 7272が含まれているか確認
  const has7272 = missingBuyers.includes('7272');
  console.log(`\n❓ 7272が含まれているか: ${has7272 ? '✅ はい' : '❌ いいえ'}`);
  
  if (has7272) {
    console.log('\n🔄 7272を同期中...');
    const result = await syncService.syncMissingBuyers(['7272']);
    console.log('\n📊 同期結果:');
    console.log('  - 成功:', result.success);
    console.log('  - 新規追加:', result.newSellersCount);
    console.log('  - エラー:', result.errors.length);
    if (result.errors.length > 0) {
      console.log('  - エラー詳細:', result.errors);
    }
  } else {
    console.log('\n⚠️ 7272は不足している買主リストに含まれていません');
    console.log('   スプレッドシートに7272が存在するか確認してください');
  }
}

testBuyer7272Sync().catch(console.error);
