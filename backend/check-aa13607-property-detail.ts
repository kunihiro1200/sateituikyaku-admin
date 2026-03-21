import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

async function check() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  // sellersテーブルのproperty_addressを確認
  const { data: seller } = await supabase
    .from('sellers')
    .select('id, seller_number, property_address')
    .eq('seller_number', 'AA13607')
    .single();
  
  console.log('sellers.property_address:', seller?.property_address);
  
  // propertiesテーブルの全カラムを確認
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('seller_id', seller?.id)
    .single();
  
  console.log('properties record:', JSON.stringify(property, null, 2));
}

check().catch(console.error);
