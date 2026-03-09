import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, seller_number, deleted_at')
    .eq('seller_number', 'AA13636')
    .single();

  if (error) {
    console.log('エラーまたは見つからない:', error.message);
    return;
  }

  console.log('AA13636:', data);
  if (data.deleted_at) {
    console.log('✅ ソフトデリート済み（deleted_at:', data.deleted_at, '）');
  } else {
    console.log('❌ まだ削除されていない（deleted_atがnull）');
  }
}

check();
