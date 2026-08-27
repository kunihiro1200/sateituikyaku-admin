// AA14856の買いたいマッチングデータを確認
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function verify() {
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, buy_match_areas, buy_match_updated_at')
    .eq('seller_number', 'AA14856')
    .single();
  
  if (error || !data) {
    console.error('エラー:', error);
    return;
  }
  
  console.log('=== AA14856の買いたいマッチングデータ ===');
  console.log('売主番号:', data.seller_number);
  console.log('buy_match_areas:', data.buy_match_areas);
  console.log('buy_match_updated_at:', data.buy_match_updated_at);
  console.log('');
  
  if (data.buy_match_updated_at) {
    console.log('❌ マッチングが有効です（buy_match_updated_atに値があります）');
  } else {
    console.log('✅ マッチングは無効です（buy_match_updated_atがnullです）');
  }
}

verify().catch(console.error);
