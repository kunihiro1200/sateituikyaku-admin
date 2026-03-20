import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id, seller_number, property_address, land_area, property_type, fixed_asset_tax_road_price')
    .eq('seller_number', 'AA13810')
    .single();
  
  console.log('Seller:', JSON.stringify(seller, null, 2));
  if (sellerError) console.log('Seller error:', sellerError.message);
  
  if (seller) {
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('*')
      .eq('seller_id', seller.id);
    
    console.log('Properties count:', properties ? properties.length : 0);
    if (properties && properties.length > 0) {
      console.log('First property:', JSON.stringify(properties[0], null, 2));
    } else {
      console.log('⚠️ propertiesテーブルにレコードなし');
    }
    if (propError) console.log('Properties error:', propError.message);
  }
}

check().catch(console.error);
