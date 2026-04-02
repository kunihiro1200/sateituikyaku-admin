import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 複数の.envファイルを試す
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '.env.local'),
  path.join(__dirname, '.env.production'),
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

console.log('環境変数チェック:');
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ 設定済み' : '❌ 未設定');
console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ 設定済み' : '❌ 未設定');
console.log('');

async function forceSyncAA10318() {
  console.log('🔄 AA10318を強制同期中...\n');

  const syncService = new EnhancedAutoSyncService();
  
  try {
    // AA10318を強制同期
    await syncService.syncSingleSeller('AA10318');
    console.log('\n✅ AA10318の同期が完了しました');
    
    // 同期後の値を確認
    console.log('\n📊 同期後の査定額を確認中...');
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: seller } = await supabase
      .from('sellers')
      .select('seller_number, valuation_amount_1, valuation_amount_2, valuation_amount_3')
      .eq('seller_number', 'AA10318')
      .single();
    
    if (seller) {
      console.log('\n📊 同期後のDBの査定額（万円単位）:');
      console.log(`  査定額1: ${seller.valuation_amount_1 ? seller.valuation_amount_1 / 10000 : 'null'}万円`);
      console.log(`  査定額2: ${seller.valuation_amount_2 ? seller.valuation_amount_2 / 10000 : 'null'}万円`);
      console.log(`  査定額3: ${seller.valuation_amount_3 ? seller.valuation_amount_3 / 10000 : 'null'}万円`);
    }
  } catch (error) {
    console.error('❌ 同期エラー:', error);
  }
}

forceSyncAA10318().catch(console.error);
