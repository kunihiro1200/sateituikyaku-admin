// 買主番号7260のbuyer_idを修復するスクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBuyer7260BuyerId() {
  console.log('=== 買主番号7260のbuyer_idを修復するスクリプト ===\n');

  try {
    // 1. 買主番号7260のレコードを取得
    console.log('1. 買主番号7260のレコードを取得中...');
    const { data: buyer, error: selectError } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, name, initial_assignee')
      .eq('buyer_number', '7260')
      .maybeSingle();

    if (selectError) {
      console.error('❌ エラー:', selectError.message);
      return;
    }

    if (!buyer) {
      console.error('❌ 買主番号7260のレコードが見つかりません');
      return;
    }

    console.log(`   買主番号: ${buyer.buyer_number}`);
    console.log(`   氏名: ${buyer.name || '（空欄）'}`);
    console.log(`   初動担当: ${buyer.initial_assignee || '（空欄）'}`);
    console.log(`   buyer_id: ${buyer.buyer_id || '（null）'}`);
    console.log('');

    // 2. buyer_idがnullの場合は修復
    if (!buyer.buyer_id) {
      console.log('2. buyer_idがnullのため、新しいUUIDを生成して設定します...');
      const newBuyerId = uuidv4();
      console.log(`   新しいbuyer_id: ${newBuyerId}`);

      const { error: updateError } = await supabase
        .from('buyers')
        .update({ buyer_id: newBuyerId })
        .eq('buyer_number', '7260');

      if (updateError) {
        console.error('❌ エラー:', updateError.message);
        return;
      }

      console.log('✅ buyer_idを設定しました');
      console.log('');

      // 3. 確認
      console.log('3. 修復後の確認:');
      const { data: updatedBuyer, error: confirmError } = await supabase
        .from('buyers')
        .select('buyer_id, buyer_number, name, initial_assignee')
        .eq('buyer_number', '7260')
        .maybeSingle();

      if (confirmError) {
        console.error('❌ エラー:', confirmError.message);
        return;
      }

      if (!updatedBuyer) {
        console.error('❌ 買主番号7260のレコードが見つかりません');
        return;
      }

      console.log(`   buyer_id: ${updatedBuyer.buyer_id}`);
      console.log(`   buyer_number: ${updatedBuyer.buyer_number}`);
      console.log(`   name: ${updatedBuyer.name}`);
      console.log(`   initial_assignee: ${updatedBuyer.initial_assignee || '（空欄）'}`);
      console.log('');

      console.log('=== 修復完了 ===');
      console.log('✅ 買主番号7260のbuyer_idが正常に設定されました');
      console.log('   404エラーが解消されるはずです');
    } else {
      console.log('2. buyer_idは既に設定されています');
      console.log(`   buyer_id: ${buyer.buyer_id}`);
      console.log('   修復の必要はありません');
    }

  } catch (error: any) {
    console.error('❌ 予期しないエラー:', error.message);
  }
}

fixBuyer7260BuyerId();
