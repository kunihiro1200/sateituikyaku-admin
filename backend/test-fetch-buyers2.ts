import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // property_listings のカラム確認
  const { data: listing, error } = await supabase
    .from('property_listings')
    .select('*')
    .limit(1);

  if (error) {
    console.error('property_listings エラー:', error.message);
  } else if (listing && listing.length > 0) {
    console.log('property_listings カラム:', Object.keys(listing[0]).sort().join(', '));
    // address 系のカラムを探す
    const addrCols = Object.keys(listing[0]).filter(k => k.includes('address') || k.includes('addr'));
    console.log('address 系カラム:', addrCols);
    // atbb 系
    const atbbCols = Object.keys(listing[0]).filter(k => k.includes('atbb'));
    console.log('atbb 系カラム:', atbbCols);
    // sales 系
    const salesCols = Object.keys(listing[0]).filter(k => k.includes('sales') || k.includes('assignee'));
    console.log('sales/assignee 系カラム:', salesCols);
  }

  // buyers の email_confirmation 系カラム確認
  const { data: buyer } = await supabase.from('buyers').select('*').limit(1);
  if (buyer && buyer.length > 0) {
    const emailCols = Object.keys(buyer[0]).filter(k => k.includes('email_confirm') || k.includes('confirmation'));
    console.log('\nbuyers email_confirm 系カラム:', emailCols);
  }
}

main().catch(console.error);
