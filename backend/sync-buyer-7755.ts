/**
 * 買主番号7755をスプレッドシートからDBに同期するスクリプト
 */
import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .envファイルを読み込む
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function syncBuyer7755() {
  console.log('🔄 買主番号7755の同期を開始...\n');

  const syncService = new EnhancedAutoSyncService(supabaseUrl, supabaseKey);

  try {
    // 1. 買主の不足データを検出
    console.log('🔍 不足している買主を検出中...');
    const missingBuyers = await syncService.detectMissingBuyers();
    
    console.log(`\n📊 不足している買主: ${missingBuyers.length}件`);
    
    // 7755が含まれているか確認
    const has7755 = missingBuyers.includes('7755');
    console.log(`   買主番号7755: ${has7755 ? '✅ 不足リストに含まれています' : '❌ 不足リストに含まれていません'}`);
    
    if (!has7755) {
      console.log('\n⚠️ 買主番号7755は不足リストに含まれていません');
      console.log('   スプレッドシートに7755が存在するか確認してください');
      return;
    }

    // 2. 7755のみを同期
    console.log('\n🔄 買主番号7755を同期中...');
    const result = await syncService.syncMissingBuyers(['7755']);
    
    console.log('\n📋 同期結果:');
    console.log('   新規作成:', result.newSellersCount);
    console.log('   エラー:', result.errors.length);
    
    if (result.errors.length > 0) {
      console.log('\n❌ エラー詳細:');
      result.errors.forEach(err => {
        console.log(`   - ${err.sellerNumber}: ${err.message}`);
      });
    } else {
      console.log('\n✅ 買主番号7755の同期が完了しました');
    }
    
  } catch (error: any) {
    console.error('\n❌ エラー:', error.message);
    throw error;
  }
}

syncBuyer7755()
  .then(() => {
    console.log('\n✅ 処理完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 処理失敗:', error);
    process.exit(1);
  });
