import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('=== buyers テーブルのカラム確認 ===');

  // 1件だけ select('*') で取得してカラム一覧を確認
  const { data: sample, error: sampleError } = await supabase
    .from('buyers')
    .select('*')
    .is('deleted_at', null)
    .limit(1);

  if (sampleError) {
    console.error('select(*) エラー:', sampleError.message);
  } else if (sample && sample.length > 0) {
    console.log('カラム一覧:', Object.keys(sample[0]).sort().join(', '));
    console.log('property_number:', sample[0].property_number);
    console.log('atbb_status (buyers):', sample[0].atbb_status);
  }

  // BUYER_COLUMNS で実際に取得できるか確認
  const BUYER_COLUMNS = [
    'buyer_number', 'buyer_id', 'name', 'phone_number', 'email',
    'reception_date', 'latest_viewing_date', 'next_call_date',
    'follow_up_assignee', 'initial_assignee', 'latest_status',
    'inquiry_confidence', 'inquiry_email_phone', 'inquiry_email_reply',
    'three_calls_confirmed', 'broker_inquiry', 'inquiry_source',
    'viewing_result_follow_up', 'viewing_unconfirmed', 'viewing_type_general',
    'post_viewing_seller_contact', 'notification_sender',
    'valuation_survey', 'valuation_survey_confirmed', 'broker_survey',
    'day_of_week', 'pinrich', 'email_confirmation', 'email_confirmation_assignee',
    'viewing_promotion_not_needed', 'viewing_promotion_sender',
    'past_buyer_list', 'price', 'property_number',
    'desired_area', 'desired_property_type', 'budget',
  ].join(', ');

  const { data, error } = await supabase
    .from('buyers')
    .select(BUYER_COLUMNS)
    .is('deleted_at', null)
    .range(0, 2);

  if (error) {
    console.error('\nBUYER_COLUMNS select エラー:', error.message);
    console.error('詳細:', JSON.stringify(error));
  } else {
    console.log('\nBUYER_COLUMNS select 成功:', data?.length, '件');
    if (data && data.length > 0) {
      console.log('サンプル:', JSON.stringify(data[0], null, 2));
    }
  }

  // property_listings から atbb_status を取得できるか確認
  if (sample && sample[0]?.property_number) {
    const propNum = sample[0].property_number.split(',')[0].trim();
    console.log('\n=== property_listings 確認 (property_number:', propNum, ') ===');
    const { data: listing, error: listingError } = await supabase
      .from('property_listings')
      .select('property_number, atbb_status, property_address, sales_assignee, property_type')
      .eq('property_number', propNum)
      .limit(1);

    if (listingError) {
      console.error('property_listings エラー:', listingError.message);
    } else {
      console.log('property_listings:', JSON.stringify(listing, null, 2));
    }
  }
}

main().catch(console.error);
