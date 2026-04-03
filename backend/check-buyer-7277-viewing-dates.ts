import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyer7277() {
  console.log('📊 買主7277の内覧日データを確認...\n');

  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, viewing_date, latest_viewing_date, follow_up_assignee')
    .eq('buyer_number', '7277')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log('買主番号:', data.buyer_number);
  console.log('viewing_date (●内覧日(最新）):', data.viewing_date);
  console.log('latest_viewing_date (最新内覧日):', data.latest_viewing_date);
  console.log('follow_up_assignee (後続担当):', data.follow_up_assignee);
}

checkBuyer7277().catch(console.error);
