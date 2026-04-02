import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

(async () => {
  console.log('🔄 AA4504を強制同期してキャッシュをクリアします...');
  
  // 1. 現在のデータを確認
  const { data: beforeSeller } = await supabase
    .from('sellers')
    .select('seller_number, valuation_text, valuation_method, valuation_amount_1, valuation_amount_2, valuation_amount_3')
    .eq('seller_number', 'AA4504')
    .single();
  
  console.log('\n📊 同期前のデータ:');
  console.log(JSON.stringify(beforeSeller, null, 2));
  
  // 2. valuation_textをnullに更新（スプレッドシートで削除されたため）
  const { error: updateError } = await supabase
    .from('sellers')
    .update({
      valuation_text: null,
      updated_at: new Date().toISOString()
    })
    .eq('seller_number', 'AA4504');
  
  if (updateError) {
    console.error('❌ 更新エラー:', updateError);
    return;
  }
  
  console.log('\n✅ valuation_textをnullに更新しました');
  
  // 3. 更新後のデータを確認
  const { data: afterSeller } = await supabase
    .from('sellers')
    .select('seller_number, valuation_text, valuation_method, valuation_amount_1, valuation_amount_2, valuation_amount_3')
    .eq('seller_number', 'AA4504')
    .single();
  
  console.log('\n📊 同期後のデータ:');
  console.log(JSON.stringify(afterSeller, null, 2));
  
  // 4. Redisキャッシュをクリア
  console.log('\n🗑️ Redisキャッシュをクリアします...');
  
  // SellerServiceのキャッシュをクリア
  const sellerId = (await supabase.from('sellers').select('id').eq('seller_number', 'AA4504').single()).data?.id;
  
  if (sellerId) {
    // Redis経由でキャッシュクリア（CacheHelperを使用）
    try {
      const { CacheHelper } = await import('./src/utils/cache');
      await CacheHelper.del(`seller:${sellerId}`);
      await CacheHelper.delPattern('sellers:list*');
      console.log('✅ Redisキャッシュをクリアしました');
    } catch (error) {
      console.log('⚠️ Redisキャッシュのクリアに失敗（Redisが利用できない可能性）:', error);
    }
  }
  
  console.log('\n🎉 完了！ブラウザでAA4504を開いて確認してください。');
})();
