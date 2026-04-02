import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStructureValues() {
  console.log('🔍 Checking structure values in sellers table...\n');

  // Get all unique structure values from sellers
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, structure')
    .not('structure', 'is', null)
    .order('structure');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  // Count unique structure values
  const structureCounts: Record<string, number> = {};
  sellers?.forEach((s: any) => {
    const structure = String(s.structure).trim();
    structureCounts[structure] = (structureCounts[structure] || 0) + 1;
  });

  console.log('📊 Unique structure values in sellers table:\n');
  Object.entries(structureCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([structure, count]) => {
      const allowed = ['木造', '軽量鉄骨', '鉄骨', '他'].includes(structure);
      const icon = allowed ? '✅' : '❌';
      console.log(`${icon} "${structure}": ${count}件`);
    });

  console.log('\n🔍 Allowed values in properties.structure constraint:');
  console.log('   ✅ 木造');
  console.log('   ✅ 軽量鉄骨');
  console.log('   ✅ 鉄骨');
  console.log('   ✅ 他');
  
  console.log('\n⚠️  Values that would cause constraint violation:');
  Object.entries(structureCounts)
    .filter(([structure]) => !['木造', '軽量鉄骨', '鉄骨', '他'].includes(structure))
    .forEach(([structure, count]) => {
      console.log(`   ❌ "${structure}": ${count}件`);
    });
}

checkStructureValues().catch(console.error);
