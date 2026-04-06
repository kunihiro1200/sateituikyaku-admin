/**
 * 買主7260のbroker_surveyとvendor_surveyの値を確認するスクリプト
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyer7260() {
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, broker_survey, vendor_survey')
    .eq('buyer_number', '7260')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('買主7260のデータ:');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkBuyer7260();
