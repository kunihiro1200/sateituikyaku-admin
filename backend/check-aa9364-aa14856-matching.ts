import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMatching() {
  // AA9364の買いたい条件
  const { data: aa9364, error: error9364 } = await supabase
    .from('sellers')
    .select('seller_number, buy_match_areas, buy_match_property_types, property_address')
    .eq('seller_number', 'AA9364')
    .single();

  // AA14856の売りたい条件
  const { data: aa14856, error: error14856 } = await supabase
    .from('sellers')
    .select('seller_number, match_areas, match_property_types, property_address, property_type')
    .eq('seller_number', 'AA14856')
    .single();

  console.log('\n=== AA9364（買いたい）の条件 ===');
  console.log('エリア:', aa9364?.buy_match_areas);
  console.log('種別:', aa9364?.buy_match_property_types);
  console.log('物件住所:', aa9364?.property_address);

  console.log('\n=== AA14856（売りたい）の条件 ===');
  console.log('エリア:', aa14856?.match_areas);
  console.log('種別:', aa14856?.match_property_types);
  console.log('物件住所:', aa14856?.property_address);
  console.log('物件種別:', aa14856?.property_type);

  console.log('\n=== マッチング判定 ===');
  
  // エリア判定
  const aa9364Areas = aa9364?.buy_match_areas || [];
  const aa14856Areas = aa14856?.match_areas || [];
  const areaOverlap = aa9364Areas.filter((a: string) => aa14856Areas.includes(a));
  console.log('エリア重複:', areaOverlap.length > 0 ? areaOverlap : 'なし');
  
  // 種別判定
  const aa9364Types = aa9364?.buy_match_property_types || [];
  const aa14856Types = aa14856?.match_property_types || [];
  const typeOverlap = aa9364Types.filter((t: string) => aa14856Types.includes(t));
  console.log('種別重複:', typeOverlap.length > 0 ? typeOverlap : 'なし');
  
  // 物件住所からのマッチング判定
  console.log('\n=== 物件住所からの判定 ===');
  console.log('AA14856の物件住所:', aa14856?.property_address);
  console.log('AA9364の買いたいエリアに含まれるか?');
}

checkMatching();
