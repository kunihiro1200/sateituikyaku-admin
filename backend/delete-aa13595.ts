/**
 * AA13595 を手動でソフトデリートするスクリプト
 * スプレッドシートから削除済みだがDBに残っているため
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteSeller(sellerNumber: string) {
  console.log(`\n=== ${sellerNumber} ソフトデリート ===`);

  // 売主を取得
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('id, seller_number, status, deleted_at')
    .eq('seller_number', sellerNumber)
    .is('deleted_at', null)
    .single();

  if (error || !seller) {
    console.log('売主が見つからない（既に削除済みか存在しない）:', error?.message);
    return;
  }

  console.log('対象売主:', seller.seller_number, '/ status:', seller.status);

  // 専任・一般契約中はブロック
  const activeContractStatuses = ['専任契約中', '一般契約中'];
  if (activeContractStatuses.includes(seller.status)) {
    console.log('❌ アクティブな契約があるため削除できません:', seller.status);
    return;
  }

  const deletedAt = new Date().toISOString();

  // 監査ログに記録
  const { data: audit, error: auditError } = await supabase
    .from('seller_deletion_audit')
    .insert({
      seller_id: seller.id,
      seller_number: sellerNumber,
      deleted_at: deletedAt,
      deleted_by: 'manual_script',
      reason: 'Removed from spreadsheet (manual sync)',
      seller_data: seller,
    })
    .select()
    .single();

  if (auditError) {
    console.warn('⚠️ 監査ログ作成失敗（続行）:', auditError.message);
  } else {
    console.log('✅ 監査ログ作成:', audit.id);
  }

  // ソフトデリート実行
  const { error: deleteError } = await supabase
    .from('sellers')
    .update({ deleted_at: deletedAt })
    .eq('id', seller.id);

  if (deleteError) {
    console.error('❌ ソフトデリート失敗:', deleteError.message);
    return;
  }

  console.log('✅ ソフトデリート完了:', sellerNumber);

  // 確認
  const { data: check } = await supabase
    .from('sellers')
    .select('seller_number, deleted_at')
    .eq('seller_number', sellerNumber)
    .single();

  console.log('確認 deleted_at:', check?.deleted_at);
}

deleteSeller('AA13595').catch(console.error);
