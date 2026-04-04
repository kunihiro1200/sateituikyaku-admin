import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer7276() {
  console.log('🔍 買主7276のデータベースデータを確認...\n');

  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, viewing_mobile, viewing_type_general, viewing_date, viewing_time')
    .eq('buyer_number', '7276')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!data) {
    console.log('❌ 買主7276が見つかりません');
    return;
  }

  console.log('✅ 買主7276が見つかりました\n');
  console.log('📋 データベースのデータ:');
  console.log(`  買主番号: ${data.buyer_number}`);
  console.log(`  内覧形態 (viewing_mobile): "${data.viewing_mobile || ''}"`);
  console.log(`  内覧形態_一般媒介 (viewing_type_general): "${data.viewing_type_general || ''}"`);
  console.log(`  内覧日 (viewing_date): ${data.viewing_date || 'null'}`);
  console.log(`  内覧時間 (viewing_time): ${data.viewing_time || 'null'}\n`);

  console.log('🔍 詳細チェック:');
  console.log(`  viewing_mobile:`);
  console.log(`    値: ${data.viewing_mobile}`);
  console.log(`    型: ${typeof data.viewing_mobile}`);
  console.log(`    nullか: ${data.viewing_mobile === null}`);
  console.log(`    undefinedか: ${data.viewing_mobile === undefined}`);
  
  console.log(`\n  viewing_type_general:`);
  console.log(`    値: ${data.viewing_type_general}`);
  console.log(`    型: ${typeof data.viewing_type_general}`);
  console.log(`    nullか: ${data.viewing_type_general === null}`);
  console.log(`    undefinedか: ${data.viewing_type_general === undefined}`);
}

checkBuyer7276().catch(console.error);
