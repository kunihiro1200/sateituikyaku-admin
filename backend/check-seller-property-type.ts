import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkPropertyType() {
  console.log('🔍 Checking property_type column data...\n');

  // サンプルデータを取得
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, property_type, 種別')
    .limit(20);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📊 Sample data (first 20 sellers):');
  console.table(sellers);

  // property_typeの値の分布を確認
  const typeDistribution: Record<string, number> = {};
  const { data: allSellers } = await supabase
    .from('sellers')
    .select('property_type, 種別');

  allSellers?.forEach((s: any) => {
    const type = s.property_type || s['種別'] || '(null)';
    typeDistribution[type] = (typeDistribution[type] || 0) + 1;
  });

  console.log('\n📈 property_type distribution:');
  console.table(typeDistribution);

  // 「土地」で検索してみる
  console.log('\n🔍 Testing filter with 種別 = "土地":');
  const { data: filtered, error: filterError } = await supabase
    .from('sellers')
    .select('seller_number, property_type, 種別')
    .eq('種別', '土地')
    .limit(10);

  if (filterError) {
    console.error('❌ Filter error:', filterError);
  } else {
    console.log(`✅ Found ${filtered?.length} sellers with 種別 = "土地"`);
    console.table(filtered);
  }
}

checkPropertyType().catch(console.error);
