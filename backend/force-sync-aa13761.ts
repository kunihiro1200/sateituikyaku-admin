import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const service = new EnhancedAutoSyncService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  await service.initialize();

  console.log('AA13761を強制同期します...');
  const result = await service.syncUpdatedSellers(['AA13761']);
  console.log('同期結果:', JSON.stringify(result, null, 2));

  // 同期後のDB値を確認
  const { data: seller } = await supabase
    .from('sellers')
    .select('seller_number, status, comments, unreachable_status, next_call_date, updated_at')
    .eq('seller_number', 'AA13761')
    .single();

  console.log('\n同期後のDB値:', JSON.stringify(seller, null, 2));
}

main().catch(console.error);
