// 大分市エリアマッピングテーブルの確認
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // oita_area_mapping テーブルが存在するか確認
  const { data: d1, error: e1 } = await supabase.from('oita_area_mapping').select('*').limit(5);
  if (e1) {
    console.log('oita_area_mapping テーブルなし:', e1.message);
  } else {
    console.log('oita_area_mapping テーブルあり:', JSON.stringify(d1, null, 2));
  }

  // beppu_area_mapping に「迫」のデータがあるか確認
  const { data: d2, error: e2 } = await supabase
    .from('beppu_area_mapping')
    .select('region_name, distribution_areas')
    .ilike('region_name', '%迫%')
    .limit(5);
  if (e2) {
    console.log('beppu_area_mapping 検索エラー:', e2.message);
  } else {
    console.log('beppu_area_mapping 迫の検索結果:', JSON.stringify(d2, null, 2));
  }

  // AA9195の住所を確認
  const { data: prop, error: pe } = await supabase
    .from('property_listings')
    .select('property_number, address, distribution_areas')
    .eq('property_number', 'AA9195')
    .single();
  if (pe) {
    console.log('AA9195取得エラー:', pe.message);
  } else {
    console.log('AA9195:', JSON.stringify(prop, null, 2));
  }
}

main().catch(console.error);
