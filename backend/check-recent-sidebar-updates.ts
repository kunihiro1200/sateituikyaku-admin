import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentSidebarUpdates() {
  console.log('🔍 最近のbuyer_sidebar_countsテーブル更新を確認中...\n');

  // todayCallAssigned:Kのレコードを確認
  const { data, error } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'todayCallAssigned')
    .eq('assignee', 'K')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log('📊 todayCallAssigned:Kのレコード:\n');
  if (data && data.length > 0) {
    data.forEach(record => {
      console.log(`  - count: ${record.count}`);
      console.log(`    updated_at: ${record.updated_at}`);
      console.log(`    created_at: ${record.created_at || 'N/A'}`);
      console.log('');
    });
  } else {
    console.log('  レコードなし\n');
  }

  // 全レコードを確認
  const { data: allData, error: allError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (allError) {
    console.error('❌ エラー:', allError);
    return;
  }

  console.log('📊 最近更新された10件のレコード:\n');
  if (allData && allData.length > 0) {
    allData.forEach(record => {
      console.log(`  - category: ${record.category}, assignee: ${record.assignee || 'null'}, count: ${record.count}`);
      console.log(`    updated_at: ${record.updated_at}`);
      console.log('');
    });
  }
}

checkRecentSidebarUpdates().catch(console.error);
