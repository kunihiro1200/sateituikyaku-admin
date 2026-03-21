/**
 * AA13607のpropertiesテーブルの状態を確認
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // sellersテーブルの確認
  const { data: seller } = await supabase
    .from('sellers')
    .select('id, seller_number, property_address, property_type, current_status')
    .eq('seller_number', 'AA13607')
    .single();

  console.log('📦 sellers テーブル:');
  console.log('  id:', seller?.id);
  console.log('  property_address:', seller?.property_address || '(null/空)');
  console.log('  property_type:', seller?.property_type || '(null/空)');
  console.log('  current_status:', seller?.current_status || '(null/空)');

  if (!seller?.id) return;

  // propertiesテーブルの確認
  const { data: properties } = await supabase
    .from('properties')
    .select('id, property_address, address, property_type, current_status, seller_situation')
    .eq('seller_id', seller.id);

  console.log('\n📦 properties テーブル:');
  if (!properties || properties.length === 0) {
    console.log('  (レコードなし)');
  } else {
    properties.forEach((p, i) => {
      console.log(`  [${i}] id: ${p.id}`);
      console.log(`       property_address: ${p.property_address || '(null/空)'}`);
      console.log(`       address: ${(p as any).address || '(null/空)'}`);
      console.log(`       property_type: ${p.property_type || '(null/空)'}`);
      console.log(`       current_status: ${p.current_status || '(null/空)'}`);
      console.log(`       seller_situation: ${p.seller_situation || '(null/空)'}`);
    });
  }
}

main().catch(console.error);
