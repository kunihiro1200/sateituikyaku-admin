// area_map_config テーブルの状態を確認するスクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('=== area_map_config テーブルの確認 ===\n');

  const { data, error } = await supabase
    .from('area_map_config')
    .select('*')
    .eq('is_active', true)
    .order('area_number');

  if (error) {
    console.error('エラー:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('データなし');
    return;
  }

  console.log(`レコード数: ${data.length}\n`);
  
  for (const row of data) {
    const hasCoords = row.coordinates !== null && row.coordinates !== undefined;
    console.log(`エリア ${row.area_number}: coordinates=${hasCoords ? JSON.stringify(row.coordinates) : 'NULL'}, url=${row.google_map_url ? '有り' : 'なし'}`);
  }

  const withCoords = data.filter(r => r.coordinates !== null && r.coordinates !== undefined);
  const withoutCoords = data.filter(r => r.coordinates === null || r.coordinates === undefined);
  
  console.log(`\n座標あり: ${withCoords.length}件`);
  console.log(`座標なし: ${withoutCoords.length}件`);
  
  if (withoutCoords.length > 0) {
    console.log('\n座標なしのエリア:');
    withoutCoords.forEach(r => console.log(`  - ${r.area_number} (URL: ${r.google_map_url || 'なし'})`));
  }
}

main().catch(console.error);
