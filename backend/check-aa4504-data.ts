import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

(async () => {
  const { data: seller } = await supabase
    .from('sellers')
    .select('id, seller_number, property_type, land_area, building_area, fixed_asset_tax_road_price, valuation_amount_1, valuation_amount_2, valuation_amount_3')
    .eq('seller_number', 'AA4504')
    .single();
  
  console.log('AA4504 seller data:');
  console.log(JSON.stringify(seller, null, 2));
  
  if (seller?.id) {
    const { data: property } = await supabase
      .from('properties')
      .select('property_type, land_area, building_area, seller_situation')
      .eq('seller_id', seller.id)
      .single();
    
    console.log('\nAA4504 property data:');
    console.log(JSON.stringify(property, null, 2));
  }
})();
