import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkInquirySite() {
  console.log('🔍 Checking inquiry_site column data...\n');

  // サンプルデータを取得
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, inquiry_site, site')
    .limit(20);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📊 Sample data (first 20 sellers):');
  console.table(sellers);

  // inquiry_siteの値の分布を確認
  const siteDistribution: Record<string, number> = {};
  const { data: allSellers } = await supabase
    .from('sellers')
    .select('inquiry_site');

  allSellers?.forEach((s: any) => {
    const site = s.inquiry_site || '(null)';
    siteDistribution[site] = (siteDistribution[site] || 0) + 1;
  });

  console.log('\n📈 inquiry_site distribution:');
  console.table(siteDistribution);

  // 「す」で検索してみる
  console.log('\n🔍 Testing filter with inquiry_site = "す":');
  const { data: filtered, error: filterError } = await supabase
    .from('sellers')
    .select('seller_number, inquiry_site')
    .eq('inquiry_site', 'す')
    .limit(10);

  if (filterError) {
    console.error('❌ Filter error:', filterError);
  } else {
    console.log(`✅ Found ${filtered?.length} sellers with inquiry_site = "す"`);
    console.table(filtered);
  }
}

checkInquirySite().catch(console.error);
