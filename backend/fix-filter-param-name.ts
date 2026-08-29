import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fixFilterParamName() {
  console.log('🔧 フィルターのパラメータ名を修正中...\n');

  // 全ての一時フィルターを取得
  const { data: filters, error } = await supabase
    .from('seller_sidebar_temp_filters')
    .select('*');

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!filters || filters.length === 0) {
    console.log('⚠️ フィルターが見つかりません');
    return;
  }

  console.log(`✅ ${filters.length}件のフィルターが見つかりました\n`);

  let updatedCount = 0;

  for (const filter of filters) {
    const filterData = filter.filters as Record<string, any>;
    
    // addressKeyword が存在する場合は townName にリネーム
    if (filterData.addressKeyword !== undefined) {
      console.log(`🔧 ${filter.label} (${filter.id}):`);
      console.log(`   addressKeyword="${filterData.addressKeyword}" → townName="${filterData.addressKeyword}"`);
      
      // 新しいフィルターオブジェクトを作成
      const newFilters = { ...filterData };
      newFilters.townName = filterData.addressKeyword;
      delete newFilters.addressKeyword;
      
      // データベースを更新
      const { error: updateError } = await supabase
        .from('seller_sidebar_temp_filters')
        .update({ filters: newFilters })
        .eq('id', filter.id);
      
      if (updateError) {
        console.error(`   ❌ 更新失敗:`, updateError.message);
      } else {
        console.log(`   ✅ 更新成功`);
        updatedCount++;
      }
    } else {
      console.log(`✓ ${filter.label} (${filter.id}): 変更不要`);
    }
  }

  console.log(`\n✅ ${updatedCount}件のフィルターを更新しました`);
}

fixFilterParamName()
  .then(() => {
    console.log('\n✅ 完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
