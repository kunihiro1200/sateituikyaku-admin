import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // deleted_at を含めて検索
  const { data: buyer } = await supabase
    .from('buyers')
    .select('buyer_number, viewing_type_general, latest_viewing_date, post_viewing_seller_contact, atbb_status, property_number, deleted_at')
    .eq('buyer_number', '7173')
    .maybeSingle();
  console.log('buyer (including deleted):', JSON.stringify(buyer, null, 2));

  if (buyer && buyer.property_number) {
    const pn = buyer.property_number.split(',')[0].trim();
    const { data: listing } = await supabase
      .from('property_listings')
      .select('property_number, atbb_status')
      .eq('property_number', pn)
      .single();
    console.log('listing:', JSON.stringify(listing, null, 2));
  }
}

main().catch(console.error);
