import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSidebarCounts() {
  console.log('=== seller_sidebar_countsテーブルの一般カテゴリを確認 ===\n');

  const { data, error } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .eq('category', 'general')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`✅ 一般カテゴリのレコード: ${data?.length || 0}件\n`);

  if (data && data.length > 0) {
    data.forEach((record: any) => {
      console.log(`カウント: ${record.count}`);
      console.log(`更新日時: ${record.updated_at}`);
      console.log(`ラベル: ${record.label || 'null'}`);
      console.log(`担当: ${record.assignee || 'null'}`);
      console.log('---');
    });
  }
}

checkSidebarCounts().catch(console.error);
