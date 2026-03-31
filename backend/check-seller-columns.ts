import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSellerColumns() {
  console.log('📊 売主テーブルのカラム名を確認中...\n');

  // サンプルデータを1件取得してカラム名を確認
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️ データが見つかりません');
    return;
  }

  const seller = data[0];
  const columns = Object.keys(seller);

  console.log('✅ 売主テーブルのカラム一覧:');
  console.log('─'.repeat(50));
  
  // サイト関連のカラムを探す
  const siteColumns = columns.filter(col => 
    col.toLowerCase().includes('site') || 
    col.toLowerCase().includes('inquiry') ||
    col.toLowerCase().includes('サイト')
  );
  
  console.log('\n🔍 サイト・問い合わせ関連のカラム:');
  siteColumns.forEach(col => {
    console.log(`  - ${col}: ${seller[col]}`);
  });

  // 種別関連のカラムを探す
  const typeColumns = columns.filter(col => 
    col.toLowerCase().includes('type') || 
    col.toLowerCase().includes('property') ||
    col.toLowerCase().includes('種別')
  );
  
  console.log('\n🔍 種別・物件関連のカラム:');
  typeColumns.forEach(col => {
    console.log(`  - ${col}: ${seller[col]}`);
  });

  // 状況関連のカラムを探す
  const statusColumns = columns.filter(col => 
    col.toLowerCase().includes('status') ||
    col.toLowerCase().includes('状況')
  );
  
  console.log('\n🔍 状況関連のカラム:');
  statusColumns.forEach(col => {
    console.log(`  - ${col}: ${seller[col]}`);
  });

  console.log('\n📋 全カラム一覧:');
  console.log('─'.repeat(50));
  columns.sort().forEach(col => {
    console.log(`  - ${col}`);
  });
}

checkSellerColumns().catch(console.error);
