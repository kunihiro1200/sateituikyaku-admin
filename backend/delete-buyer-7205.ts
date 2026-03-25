/**
 * 買主7205をDBから物理削除するスクリプト
 * スプレッドシートに存在しないため削除対象
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL または SUPABASE_SERVICE_KEY が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteBuyer7205() {
  const buyerNumber = '7205';

  // 1. 存在確認
  const { data: buyer, error: fetchError } = await supabase
    .from('buyers')
    .select('buyer_number, name, deleted_at')
    .eq('buyer_number', buyerNumber)
    .single();

  if (fetchError || !buyer) {
    console.log(`⚠️ 買主 ${buyerNumber} はDBに存在しません（既に削除済みの可能性）`);
    return;
  }

  if (buyer.deleted_at) {
    console.log(`⚠️ 買主 ${buyerNumber} は既にソフトデリート済みです (deleted_at: ${buyer.deleted_at})`);
    console.log('物理削除を実行します...');
  } else {
    console.log(`✅ 買主 ${buyerNumber} を発見: ${buyer.name || '(名前なし)'}`);
  }

  // 2. 監査ログに記録
  const { error: auditError } = await supabase
    .from('buyer_deletion_audit')
    .insert({
      buyer_number: buyerNumber,
      deleted_at: new Date().toISOString(),
      deleted_by: 'manual-script',
      reason: 'スプレッドシートに存在しないため手動削除 (delete-buyer-7205.ts)',
    });

  if (auditError) {
    console.warn(`⚠️ 監査ログの記録に失敗しました: ${auditError.message}`);
    // 監査ログ失敗でも削除は続行
  } else {
    console.log('📝 監査ログに記録しました');
  }

  // 3. 物理削除
  const { error: deleteError } = await supabase
    .from('buyers')
    .delete()
    .eq('buyer_number', buyerNumber);

  if (deleteError) {
    console.error(`❌ 削除失敗: ${deleteError.message}`);
    process.exit(1);
  }

  console.log(`✅ 買主 ${buyerNumber} を物理削除しました`);

  // 4. 削除確認
  const { data: check } = await supabase
    .from('buyers')
    .select('buyer_number')
    .eq('buyer_number', buyerNumber)
    .single();

  if (!check) {
    console.log('✅ 削除確認OK: DBから完全に削除されました');
  } else {
    console.error('❌ 削除確認NG: まだDBに残っています');
  }
}

deleteBuyer7205().catch(console.error);
