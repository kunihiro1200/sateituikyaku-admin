// AA13774の座標をDBに設定するスクリプト
// 大分市大字政所3798 の概算座標
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function setCoords() {
  // まず現在の状態を確認
  const { data: before } = await supabase
    .from('property_listings')
    .select('property_number, address, latitude, longitude')
    .eq('property_number', 'AA13774')
    .single();
  console.log('Before:', JSON.stringify(before, null, 2));

  // 大分市大字政所3798 の座標を設定
  // 33°14'38.4"N 131°43'10.6"E → 33.2440, 131.7196
  const { error } = await supabase
    .from('property_listings')
    .update({
      latitude: 33.2440,
      longitude: 131.7196,
    })
    .eq('property_number', 'AA13774');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  const { data: after } = await supabase
    .from('property_listings')
    .select('property_number, address, latitude, longitude')
    .eq('property_number', 'AA13774')
    .single();
  console.log('After:', JSON.stringify(after, null, 2));
}

setCoords().catch(console.error);
