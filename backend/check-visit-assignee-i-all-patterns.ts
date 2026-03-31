import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// スクリーンショットの売主番号リスト
const screenshotSellerNumbers = [
  // 1枚目
  'AA13326', 'AA13331', 'AA13345', 'AA13402', 'AA13428', 'AA13521', 'AA13599',
  'AA13600', 'AA13602', 'AA13633', 'AA13722', 'AA13800', 'AA13825', 'AA13826', 'AA13841',
  // 2枚目
  'AA12501', 'AA12506', 'AA12534', 'AA12560', 'AA12718', 'AA12746', 'AA12762',
  'AA12811', 'AA12838', 'AA12854', 'AA12879', 'AA12911', 'AA12924', 'AA13210', 'AA13228', 'AA13315',
  // 3枚目
  'AA220', 'AA3959', 'AA5039', 'AA5276', 'AA9419', 'AA10447', 'AA10601',
  'AA11036', 'AA11184', 'AA12329', 'AA12365', 'AA12389', 'AA12425', 'AA12428', 'AA12472', 'AA12478'
];

async function checkAllPatterns() {
  console.log('🔍 営担（I）の全パターンを確認中...\n');

  // パターン1: 営担（I）の全件
  const { data: allI } = await supabase
    .from('sellers')
    .select('seller_number, status, visit_assignee')
    .eq('visit_assignee', 'I');

  console.log(`📊 パターン1: 営担（I）の全件 = ${allI?.length || 0}件`);

  // パターン2: 営担（I）で「追客中」を含む
  const withTsuikyaku = allI?.filter(s => s.status?.includes('追客中'));
  console.log(`📊 パターン2: 営担（I）+ 追客中 = ${withTsuikyaku?.length || 0}件`);

  // パターン3: 営担（I）で「追客」を含む（追客中、他決→追客、追客不要など全て）
  const withTsuikyakuAll = allI?.filter(s => s.status?.includes('追客'));
  console.log(`📊 パターン3: 営担（I）+ 追客を含む = ${withTsuikyakuAll?.length || 0}件`);

  // パターン4: 営担（I）で「追客」を含み、「追客不要」を除外
  const withTsuikyakuNoFuyo = allI?.filter(s => 
    s.status?.includes('追客') && !s.status?.includes('追客不要')
  );
  console.log(`📊 パターン4: 営担（I）+ 追客を含む - 追客不要 = ${withTsuikyakuNoFuyo?.length || 0}件`);

  console.log('\n🎯 61件に一致するパターンを探します...\n');

  // 各パターンで61件に一致するか確認
  if (allI?.length === 61) {
    console.log('✅ パターン1（営担（I）の全件）が61件に一致');
  }
  if (withTsuikyaku?.length === 61) {
    console.log('✅ パターン2（営担（I）+ 追客中）が61件に一致');
  }
  if (withTsuikyakuAll?.length === 61) {
    console.log('✅ パターン3（営担（I）+ 追客を含む）が61件に一致');
  }
  if (withTsuikyakuNoFuyo?.length === 61) {
    console.log('✅ パターン4（営担（I）+ 追客を含む - 追客不要）が61件に一致');
    
    // このパターンでスクリーンショットとの差分を確認
    const dbNumbers = withTsuikyakuNoFuyo.map(s => s.seller_number).sort();
    const missing = dbNumbers.filter(num => !screenshotSellerNumbers.includes(num));
    
    console.log(`\n🚨 スクリーンショット以外の売主番号（${missing.length}件）:\n`);
    missing.forEach(num => {
      const seller = withTsuikyakuNoFuyo.find(s => s.seller_number === num);
      console.log(`  ${num} (status: ${seller?.status})`);
    });
  } else {
    console.log('❌ 61件に一致するパターンが見つかりませんでした');
    console.log('\n📊 最も近いパターン4（59件）でスクリーンショットとの差分を確認します...\n');
    
    const dbNumbers = withTsuikyakuNoFuyo!.map(s => s.seller_number).sort();
    const missing = dbNumbers.filter(num => !screenshotSellerNumbers.includes(num));
    
    console.log(`🚨 スクリーンショット以外の売主番号（${missing.length}件）:\n`);
    missing.forEach(num => {
      const seller = withTsuikyakuNoFuyo!.find(s => s.seller_number === num);
      console.log(`  ${num} (status: ${seller?.status})`);
    });
  }
}

checkAllPatterns().catch(console.error);
