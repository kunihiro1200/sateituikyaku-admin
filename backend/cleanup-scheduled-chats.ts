/**
 * shared_item_scheduled_chats の不正な未送信レコードをクリーンアップするスクリプト
 * 
 * 対象: scheduled_datetime が過去 かつ chat_sent_at IS NULL のレコード
 *       （送信済みとして記録されないまま残ったゾンビレコード）
 * 
 * 実行: npx ts-node backend/cleanup-scheduled-chats.ts
 * dry-run: npx ts-node backend/cleanup-scheduled-chats.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`=== shared_item_scheduled_chats クリーンアップ${isDryRun ? '（dry-run）' : ''} ===\n`);

  const now = new Date().toISOString();

  // 過去日時かつ未送信のレコードを取得
  const { data: targets, error } = await supabase
    .from('shared_item_scheduled_chats')
    .select('*')
    .is('chat_sent_at', null)
    .lte('scheduled_datetime', now)
    .order('scheduled_datetime', { ascending: true });

  if (error) {
    console.error('❌ 取得エラー:', error);
    process.exit(1);
  }

  if (!targets || targets.length === 0) {
    console.log('✅ クリーンアップ対象レコードはありません');
    return;
  }

  console.log(`🚨 削除対象: ${targets.length} 件`);
  for (const r of targets) {
    const scheduled = new Date(r.scheduled_datetime).toLocaleString('ja-JP');
    console.log(`  id=${r.id} | spreadsheet_item_id=${r.spreadsheet_item_id} | scheduled=${scheduled}`);
  }

  if (isDryRun) {
    console.log('\n⚠️  dry-run モードのため削除しません。');
    console.log('   実際に削除するには --dry-run を外して実行してください。');
    return;
  }

  // 削除実行
  const ids = targets.map(r => r.id);
  const { error: deleteError } = await supabase
    .from('shared_item_scheduled_chats')
    .delete()
    .in('id', ids);

  if (deleteError) {
    console.error('❌ 削除エラー:', deleteError);
    process.exit(1);
  }

  console.log(`\n✅ ${targets.length} 件のレコードを削除しました`);
  console.log('   これ以降、15分ごとのGitHub Actionsで誤送信は発生しません。');
}

main().catch(console.error);
