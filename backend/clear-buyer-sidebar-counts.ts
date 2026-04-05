import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clearBuyerSidebarCounts() {
  console.log('🗑️  buyer_sidebar_countsテーブルをクリア中...\n');

  // 全データを削除
  const { error } = await supabase
    .from('buyer_sidebar_counts')
    .delete()
    .neq('category', '___never___'); // 全行を削除

  if (error) {
    console.error('❌ 削除エラー:', error);
    return;
  }

  console.log('✅ buyer_sidebar_countsテーブルをクリアしました\n');

  // 確認
  const { data, error: selectError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*');

  if (selectError) {
    console.error('❌ 確認エラー:', selectError);
    return;
  }

  console.log(`📊 残りのレコード数: ${data?.length || 0}件`);
}

clearBuyerSidebarCounts().catch(console.error);
