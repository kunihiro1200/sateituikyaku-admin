/**
 * 予約送信スクリプト：scheduled_chat_datetime を過ぎた未送信の共有アイテムをチャット送信
 * 
 * 実行: npx ts-node backend/send-scheduled-chats.ts
 * GitHub Actions: 15分ごとに自動実行
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { GoogleChatService } from './src/services/GoogleChatService';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// チャットWebhook URL
const CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAAAlknS4P0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=61OklKGHQpRoIFhiI00wGZPmcRHd4oY_BV47uQGMWbg';

// フロントエンドのベースURL
const FRONTEND_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://sateituikyaku-admin-frontend.vercel.app'
  : 'http://localhost:5173';

interface SharedItem {
  id: string;
  sharing_location?: string;
  title?: string;
  content?: string;
  pdf_url?: string;
  image_url?: string;
  scheduled_chat_datetime?: string;
  chat_sent_at?: string;
  [key: string]: any;
}

async function sendScheduledChats() {
  console.log('🚀 予約送信チェックを開始...');
  console.log(`⏰ 現在時刻: ${new Date().toISOString()}`);

  try {
    // scheduled_chat_datetime が現在時刻を過ぎていて、まだ送信されていないアイテムを取得
    const now = new Date().toISOString();
    const { data: items, error } = await supabase
      .from('shared_items')
      .select('*')
      .not('scheduled_chat_datetime', 'is', null)
      .is('chat_sent_at', null)
      .lte('scheduled_chat_datetime', now);

    if (error) {
      console.error('❌ データ取得エラー:', error);
      return;
    }

    if (!items || items.length === 0) {
      console.log('✅ 送信対象のアイテムはありません');
      return;
    }

    console.log(`📬 送信対象: ${items.length}件`);

    const chatService = new GoogleChatService();
    let successCount = 0;
    let failCount = 0;

    for (const item of items as SharedItem[]) {
      try {
        console.log(`\n📤 送信中: ID=${item.id}, 予定時刻=${item.scheduled_chat_datetime}`);

        // 共有場が「他」であることを確認
        if (item.sharing_location !== '他' && item['共有場'] !== '他') {
          console.log(`⚠️  スキップ: 共有場が「他」ではありません (${item.sharing_location || item['共有場']})`);
          continue;
        }

        // メッセージを作成
        const title = item.title || item['タイトル'] || '（タイトルなし）';
        const content = item.content || item['内容'] || '';
        const pdfUrl = item.pdf_url || item['PDF'] || '';
        const imageUrl = item.image_url || item['画像'] || '';
        const detailUrl = `${FRONTEND_BASE_URL}/shared-items/${item.id}`;

        let message = `【共有事項】\n`;
        message += `タイトル: ${title}\n\n`;
        message += `${content}\n\n`;
        message += `**「共有できていないスタッフ」の自分のアカウントにチェックして必ず保存してください**\n\n`;
        message += `詳細: ${detailUrl}\n`;

        if (pdfUrl) {
          message += `\nPDF: ${pdfUrl}`;
        }
        if (imageUrl) {
          message += `\n画像: ${imageUrl}`;
        }

        // Google Chatに送信
        const result = await chatService.sendMessage(CHAT_WEBHOOK_URL, message);

        if (result.success) {
          // 送信成功 → chat_sent_at を記録
          const { error: updateError } = await supabase
            .from('shared_items')
            .update({ chat_sent_at: new Date().toISOString() })
            .eq('id', item.id);

          if (updateError) {
            console.error(`⚠️  chat_sent_at更新エラー (ID=${item.id}):`, updateError.message);
          } else {
            console.log(`✅ 送信成功 (ID=${item.id})`);
            successCount++;
          }
        } else {
          console.error(`❌ 送信失敗 (ID=${item.id}):`, result.error);
          failCount++;
        }
      } catch (itemError: any) {
        console.error(`❌ アイテム処理エラー (ID=${item.id}):`, itemError.message);
        failCount++;
      }
    }

    console.log(`\n📊 送信結果: 成功=${successCount}件, 失敗=${failCount}件`);
  } catch (error: any) {
    console.error('❌ 予期しないエラー:', error.message);
    process.exit(1);
  }
}

// スクリプト実行
sendScheduledChats()
  .then(() => {
    console.log('\n🎉 予約送信チェックが完了しました');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  });
