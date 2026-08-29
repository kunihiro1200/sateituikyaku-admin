import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkTempFilter() {
  console.log('🔍 一時フィルターを確認中...\n');

  const filterIdToCheck = 'c88b6ed3-e5f9-44c7-b40c-576c432f8350';

  const { data, error } = await supabase
    .from('seller_sidebar_temp_filters')
    .select('*')
    .eq('id', filterIdToCheck)
    .single();

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!data) {
    console.log('❌ フィルターが見つかりません');
    return;
  }

  console.log('✅ フィルターID:', data.id);
  console.log('📝 ラベル:', data.label);
  console.log('📋 フィルター定義:');
  console.log(JSON.stringify(data.filters, null, 2));

  // フィルター条件を確認
  const filters = data.filters as Record<string, any>;
  console.log('\n📊 フィルター条件の詳細:');
  console.log('  - region:', filters.region);
  console.log('  - townName:', filters.townName);
  console.log('  - propertyType:', filters.propertyType);
  console.log('  - statusFilter:', filters.statusFilter);

  // townNameがある場合、該当する売主を検索
  if (filters.townName) {
    console.log(`\n🔍 townName="${filters.townName}" で売主を検索中...`);
    
    let query = supabase
      .from('sellers')
      .select('seller_number, property_address')
      .ilike('property_address', `%${filters.townName}%`);

    if (filters.region && filters.region.length > 0) {
      query = query.in('region', filters.region);
    }

    if (filters.statusFilter && filters.statusFilter.length > 0) {
      // statusFilterは部分一致
      const statusConditions = filters.statusFilter.map((s: string) => `status.ilike.%${s}%`);
      // Supabaseでは複数のilike条件をORで繋ぐのが難しいので、JS側でフィルター
    }

    const { data: sellers, error: sellerError } = await query;

    if (sellerError) {
      console.error('❌ 売主検索エラー:', sellerError.message);
      return;
    }

    console.log(`\n✅ ${sellers?.length || 0}件の売主が見つかりました`);
    
    if (sellers && sellers.length > 0) {
      console.log('\n📋 最初の10件:');
      sellers.slice(0, 10).forEach((s, i) => {
        const hasKeyword = s.property_address?.includes(filters.townName);
        const marker = hasKeyword ? '✅' : '❌';
        console.log(`  ${i + 1}. ${marker} ${s.seller_number}: ${s.property_address}`);
      });
    }
  }
}

checkTempFilter()
  .then(() => {
    console.log('\n✅ 確認完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
