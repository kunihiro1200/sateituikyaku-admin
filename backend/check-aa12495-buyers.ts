import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // 1. ilike検索で見つかるか
  const { data: ilikeData, error: ilikeError } = await supabase
    .from('buyers')
    .select('buyer_number, name, property_number, deleted_at')
    .ilike('property_number', '%AA12495%');

  console.log('=== ilike検索結果（deleted_at含む） ===');
  console.log(JSON.stringify(ilikeData, null, 2));
  if (ilikeError) console.log('エラー:', ilikeError);

  // 2. deleted_atなしで検索
  const { data: activeData } = await supabase
    .from('buyers')
    .select('buyer_number, name, property_number, deleted_at')
    .ilike('property_number', '%AA12495%')
    .is('deleted_at', null);

  console.log('\n=== アクティブのみ ===');
  console.log(JSON.stringify(activeData, null, 2));

  // 3. property_numberにAA12495が含まれる買主を全パターン確認
  const { data: allData } = await supabase
    .from('buyers')
    .select('buyer_number, name, property_number, deleted_at')
    .or(`property_number.ilike.%AA12495%,property_number.eq.AA12495`);

  console.log('\n=== OR検索結果 ===');
  console.log(JSON.stringify(allData, null, 2));
}

check().catch(console.error);
