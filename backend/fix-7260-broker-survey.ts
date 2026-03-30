/**
 * 買主7260のbroker_surveyを修正するスクリプト
 * vendor_surveyに入っていた「未」をbroker_surveyに移行する
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 現在の状態を確認
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('buyer_number, vendor_survey, broker_survey')
    .eq('buyer_number', '7260')
    .single();

  if (error || !buyer) {
    console.error('Error fetching buyer 7260:', error);
    return;
  }

  console.log('Current state:', buyer);

  // vendor_surveyの値をbroker_surveyに移行
  if (buyer.vendor_survey && !buyer.broker_survey) {
    const { error: updateError } = await supabase
      .from('buyers')
      .update({
        broker_survey: buyer.vendor_survey,
        vendor_survey: null,
      })
      .eq('buyer_number', '7260');

    if (updateError) {
      console.error('Update error:', updateError);
    } else {
      console.log(`Updated 7260: broker_survey = "${buyer.vendor_survey}"`);
    }
  } else {
    console.log('No migration needed:', buyer);
  }
}

main().catch(console.error);
