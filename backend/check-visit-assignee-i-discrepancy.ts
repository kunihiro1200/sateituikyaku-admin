import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 正しいプロジェクトパスの.env.localを読み込む
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!; // SUPABASE_SERVICE_KEYを使用
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

async function checkDiscrepancy() {
  console.log('🔍 営担（I）で追客中の売主をDBから取得中...\n');

  // 「追客中」のみ（「他決→追客」は除外）
  const { data: allSellers, error: allError } = await supabase
    .from('sellers')
    .select('seller_number, status, visit_assignee')
    .eq('visit_assignee', 'I');

  if (allError) {
    console.error('❌ エラー:', allError);
    return;
  }

  // フィルタリング: 「追客中」を含む（「他決→追客」は除外）
  const sellers = allSellers?.filter(s => 
    s.status?.includes('追客中')
  ).sort((a, b) => a.seller_number.localeCompare(b.seller_number));

  console.log(`📊 DB件数: ${sellers?.length || 0}件`);
  console.log(`📊 スプシ件数: 47件（スクリーンショット）\n`);

  // スクリーンショットにない売主番号を抽出
  const dbSellerNumbers = sellers?.map(s => s.seller_number) || [];
  const missingInScreenshot = dbSellerNumbers.filter(
    num => !screenshotSellerNumbers.includes(num)
  );

  // DBにない売主番号を抽出（スプシ側の余分）
  const missingInDB = screenshotSellerNumbers.filter(
    num => !dbSellerNumbers.includes(num)
  );

  console.log('🚨 スクリーンショットにない売主番号（DB側の余分）:\n');
  if (missingInScreenshot.length === 0) {
    console.log('✅ なし');
  } else {
    console.log(`❌ ${missingInScreenshot.length}件の差分あり:\n`);
    missingInScreenshot.forEach(num => {
      const seller = sellers?.find(s => s.seller_number === num);
      console.log(`  - ${num} (status: ${seller?.status})`);
    });
  }

  console.log('\n🚨 DBにない売主番号（スプシ側の余分）:\n');
  if (missingInDB.length === 0) {
    console.log('✅ なし（DBとスプシが一致）');
  } else {
    console.log(`❌ ${missingInDB.length}件の差分あり:\n`);
    missingInDB.forEach(num => {
      console.log(`  - ${num}`);
    });
  }

  console.log('\n📋 全DB売主番号リスト:');
  dbSellerNumbers.forEach(num => console.log(`  ${num}`));
}

checkDiscrepancy().catch(console.error);
