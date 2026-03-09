/**
 * AA13636をDBから削除するスクリプト
 * スプレッドシートから削除済みのためDBからもソフトデリート
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteAA13636() {
  const sellerNumber = 'AA13636';

  // 現在の状態を確認
  const { data: seller, error: fetchError } = await supabase
    .from('sellers')
    .select('id, seller_number, name, status, deleted_at')
    .eq('seller_number', sellerNumber)
    .single();

  if (fetchError || !seller) {
    console.error('❌ 売主が見つかりません:', fetchError?.message);
    return;
  }

  console.log('📋 削除対象:', {
    id: seller.id,
    seller_number: seller.seller_number,
    status: seller.status,
    deleted_at: seller.deleted_at,
  });

  if (seller.deleted_at) {
    console.log('⚠️ 既に削除済みです');
    return;
  }

  // ソフトデリート実行
  const { error: deleteError } = await supabase
    .from('sellers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('seller_number', sellerNumber);

  if (deleteError) {
    console.error('❌ 削除失敗:', deleteError.message);
    return;
  }

  console.log(`✅ ${sellerNumber} をソフトデリートしました`);
}

deleteAA13636().catch(console.error);
