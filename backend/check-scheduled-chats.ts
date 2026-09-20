/**
 * shared_item_scheduled_chats の未送信レコードを確認するスクリプト
 * 実行: npx ts-node backend/check-scheduled-chats.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// ルートの .env.local を優先、なければ backend/.env.local を試みる
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('=== shared_item_scheduled_chats 確認スクリプト ===\n');

  // 1. 未送信レコード（chat_sent_at IS NULL）
  const { data: pending, error: e1 } = await supabase
    .from('shared_item_scheduled_chats')
    .select('*')
    .is('chat_sent_at', null)
    .order('scheduled_datetime', { ascending: true });

  if (e1) { console.error('❌ 取得エラー:', e1); process.exit(1); }

  console.log(`📋 未送信レコード（chat_sent_at IS NULL）: ${pending?.length ?? 0} 件`);
  if (pending && pending.length > 0) {
    console.log('\n--- 一覧 ---');
    for (const r of pending) {
      const scheduled = new Date(r.scheduled_datetime).toLocaleString('ja-JP');
      const isPast = new Date(r.scheduled_datetime) < new Date();
      console.log(`  id=${r.id} | spreadsheet_item_id=${r.spreadsheet_item_id} | scheduled=${scheduled} ${isPast ? '⚠️ 過去 → 次のActions実行時に送信される' : '（未来）'} | include_warning_text=${r.include_warning_text}`);
    }
  }

  // 2. 送信済みレコード（直近10件）
  const { data: sent, error: e2 } = await supabase
    .from('shared_item_scheduled_chats')
    .select('*')
    .not('chat_sent_at', 'is', null)
    .order('chat_sent_at', { ascending: false })
    .limit(10);

  if (e2) { console.error('❌ 取得エラー:', e2); process.exit(1); }

  console.log(`\n📤 送信済みレコード（直近10件）: ${sent?.length ?? 0} 件`);
  if (sent && sent.length > 0) {
    console.log('\n--- 一覧 ---');
    for (const r of sent) {
      const sentAt = new Date(r.chat_sent_at).toLocaleString('ja-JP');
      console.log(`  id=${r.id} | spreadsheet_item_id=${r.spreadsheet_item_id} | sent_at=${sentAt}`);
    }
  }

  // 3. 過去の未送信レコードを特定（即刻送信対象）
  const now = new Date().toISOString();
  const overdue = (pending ?? []).filter(r => r.scheduled_datetime <= now);
  console.log(`\n🚨 即刻送信対象（scheduled_datetime が過去）: ${overdue.length} 件`);
  if (overdue.length > 0) {
    console.log('   これらが「保存したら届く」原因です。');
    console.log('\n削除しますか？ → backend/cleanup-scheduled-chats.ts を実行してください');
  } else {
    console.log('   過去の未送信レコードはありません。');
  }
}

main().catch(console.error);
