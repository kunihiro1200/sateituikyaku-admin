const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 買主2564の紐づき物件を確認
  const { data: buyer, error: e1 } = await supabase
    .from('buyers')
    .select('buyer_number, name, desired_area, budget')
    .eq('buyer_number', '2564')
    .single();
  
  console.log('買主2564:', buyer);

  // buyer_property_linksを確認
  const { data: links, error: e2 } = await supabase
    .from('buyer_property_links')
    .select('*')
    .eq('buyer_number', '2564');
  
  console.log('\n紐づき物件:', links);

  if (links && links.length > 0) {
    const propNum = links[0].property_number;
    const { data: prop, error: e3 } = await supabase
      .from('property_listings')
      .select('property_number, address, property_type, price, atbb_status, latitude, longitude')
      .eq('property_number', propNum)
      .single();
    console.log('\n基準物件:', prop);
  }
}

main().catch(console.error);
