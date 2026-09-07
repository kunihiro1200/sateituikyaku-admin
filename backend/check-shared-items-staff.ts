import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSharedItemsStaff() {
  console.log('🔍 共有リストのカラムと未確認スタッフを確認...\n');

  // まず1件取得してカラム名を確認
  const { data: sample, error: sampleError } = await supabase
    .from('shared_items')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.error('❌ エラー:', sampleError);
    return;
  }

  if (sample && sample.length > 0) {
    console.log('📋 テーブルのカラム一覧:\n');
    Object.keys(sample[0]).forEach(key => {
      console.log(`  - ${key}`);
    });
    console.log('');
  }

  // 「共有できていない」カラムを探す（いくつかの候補名で試す）
  const possibleColumns = ['staff_not_shared', '共有できていない', 'sharing_incomplete', 'unshared_staff'];
  
  for (const colName of possibleColumns) {
    console.log(`\n🔍 "${colName}" カラムで検索中...`);
    
    const { data: items, error, count } = await supabase
      .from('shared_items')
      .select('id, ' + colName, { count: 'exact' })
      .not(colName, 'is', null)
      .limit(10);

    if (!error && items && items.length > 0) {
      console.log(`  ✅ 見つかりました！ ${count}件\n`);
      
      items.forEach((item: any) => {
        console.log(`    ID ${item.id}: "${item[colName]}"`);
      });
      
      // スタッフ名のパターンを分析
      console.log('\n📊 分割パターンの分析:\n');
      items.forEach((item: any) => {
        const staffStr = String(item[colName]);
        const staffNames = staffStr
          .split(/[,、，\s　]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        
        console.log(`    "${staffStr}" → [${staffNames.join(', ')}]`);
      });
      
      return; // 見つかったので終了
    }
  }
  
  console.log('\n❌ どのカラム名でも「共有できていない」フィールドが見つかりませんでした');
}

checkSharedItemsStaff()
  .then(() => {
    console.log('\n✅ 完了');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ エラー:', err);
    process.exit(1);
  });
