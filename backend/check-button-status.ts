import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkButtonStatus() {
  // AA9364の状態確認
  const { data: aa9364 } = await supabase
    .from('sellers')
    .select('seller_number, match_updated_at, buy_match_areas, buy_match_property_types')
    .eq('seller_number', 'AA9364')
    .single();

  // AA14856の状態確認
  const { data: aa14856 } = await supabase
    .from('sellers')
    .select('seller_number, match_updated_at, buy_match_areas, buy_match_property_types')
    .eq('seller_number', 'AA14856')
    .single();

  console.log('\n=== AA9364 ===');
  console.log('売りたいボタンを押しているか (match_updated_at):', aa9364?.match_updated_at);
  console.log('買いたい条件 (buy_match_areas):', aa9364?.buy_match_areas);
  console.log('買いたい条件 (buy_match_property_types):', aa9364?.buy_match_property_types);
  console.log('→', aa9364?.buy_match_areas?.length > 0 || aa9364?.buy_match_property_types?.length > 0 ? '買いたい人' : '売りたい人');

  console.log('\n=== AA14856 ===');
  console.log('売りたいボタンを押しているか (match_updated_at):', aa14856?.match_updated_at);
  console.log('買いたい条件 (buy_match_areas):', aa14856?.buy_match_areas);
  console.log('買いたい条件 (buy_match_property_types):', aa14856?.buy_match_property_types);
  console.log('→', aa14856?.buy_match_areas?.length > 0 || aa14856?.buy_match_property_types?.length > 0 ? '買いたい人' : '売りたい人');
}

checkButtonStatus();
