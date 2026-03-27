/**
 * AA13863のDBのvisit_dateを確認するスクリプト
 */
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );

  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_date, land_area_verified, building_area_verified')
    .eq('seller_number', 'AA13863')
    .single();

  if (error) { console.error(error); return; }
  console.log('AA13863 DB値:');
  console.log('  visit_date:', data.visit_date);
  console.log('  land_area_verified:', data.land_area_verified);
  console.log('  building_area_verified:', data.building_area_verified);
}

main().catch(console.error);
