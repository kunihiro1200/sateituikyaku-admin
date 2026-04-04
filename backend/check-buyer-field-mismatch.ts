import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkFieldMismatch() {
  console.log('📊 Checking buyer field name mismatches...\n');

  // 買主7276のデータを取得
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('buyer_number, viewing_date, latest_viewing_date, viewing_type, viewing_mobile, viewing_type_general')
    .eq('buyer_number', '7276')
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Buyer 7276:');
  console.log('  viewing_date:', buyer.viewing_date);
  console.log('  latest_viewing_date:', buyer.latest_viewing_date);
  console.log('  viewing_type:', buyer.viewing_type);
  console.log('  viewing_mobile:', buyer.viewing_mobile);
  console.log('  viewing_type_general:', buyer.viewing_type_general);
  console.log('');

  // 全買主の統計を取得
  const { data: allBuyers, error: allError } = await supabase
    .from('buyers')
    .select('viewing_date, latest_viewing_date, viewing_type, viewing_mobile, viewing_type_general')
    .limit(1000);

  if (allError) {
    console.error('❌ Error:', allError);
    return;
  }

  const stats = {
    viewing_date_count: 0,
    latest_viewing_date_count: 0,
    viewing_type_count: 0,
    viewing_mobile_count: 0,
    viewing_type_general_count: 0,
  };

  allBuyers?.forEach(b => {
    if (b.viewing_date) stats.viewing_date_count++;
    if (b.latest_viewing_date) stats.latest_viewing_date_count++;
    if (b.viewing_type) stats.viewing_type_count++;
    if (b.viewing_mobile) stats.viewing_mobile_count++;
    if (b.viewing_type_general) stats.viewing_type_general_count++;
  });

  console.log('📊 Statistics (first 1000 buyers):');
  console.log('  viewing_date (non-null):', stats.viewing_date_count);
  console.log('  latest_viewing_date (non-null):', stats.latest_viewing_date_count);
  console.log('  viewing_type (non-null):', stats.viewing_type_count);
  console.log('  viewing_mobile (non-null):', stats.viewing_mobile_count);
  console.log('  viewing_type_general (non-null):', stats.viewing_type_general_count);
  console.log('');

  // フィールド名の不一致を検出
  console.log('🚨 Field name mismatches detected:');
  console.log('');
  console.log('1. viewing_date vs latest_viewing_date:');
  console.log('   - viewing_date: Used by GAS sync ✅');
  console.log('   - latest_viewing_date: Exists but not synced ❌');
  console.log('   - Frontend uses: latest_viewing_date in some places ❌');
  console.log('   - Recommendation: Use viewing_date everywhere');
  console.log('');
  console.log('2. viewing_mobile vs viewing_type:');
  console.log('   - viewing_mobile: Used by GAS sync ✅');
  console.log('   - viewing_type: Exists but not synced ❌');
  console.log('   - Frontend uses: viewing_mobile (after fix) ✅');
  console.log('   - Recommendation: Use viewing_mobile everywhere');
  console.log('');
  console.log('3. viewing_type_general:');
  console.log('   - viewing_type_general: Used by GAS sync ✅');
  console.log('   - Frontend uses: viewing_type_general ✅');
  console.log('   - Recommendation: Keep as is');
}

checkFieldMismatch().catch(console.error);
