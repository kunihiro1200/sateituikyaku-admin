/**
 * 予約送信スクリプト：scheduled_chat_datetime を過ぎた未送信の共有アイテムをチャット送信
 * 
 * 実行: npx ts-node backend/send-scheduled-chats.ts
 * GitHub Actions: 15分ごとに自動実行
 * 
 * 注意: shared_itemsはスプレッドシート管理のため、予約情報は
 *       shared_item_scheduled_chats テーブルに保存される
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { GoogleChatService } from './src/services/GoogleChatService';
import { SharedItemsService } from './src/services/SharedItemsService';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// チャットWebhook URL（環境変数から取得、なければデフォルト値）
const CHAT_WEBHOOK_URL = process.env.GOOGLE_CHAT_WEBHOOK_URL || 
  'https://chat.googleapis.com/v1/spaces/AAAAlknS4P0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=61OklKGHQpRoIFhiI00wGZPmcRHd4oY_BV47uQGMWbg';

// フロントエンドのベースURL
const FRONTEND_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://sateituikyaku-admin-frontend.vercel.app'
  : 'http://localhost:5173';

interface ScheduledChat {
  id: string;
  spreadsheet_item_id: string;
  scheduled_datetime: string;
  include_warning_text: boolean;
}

async function sendScheduledChats() {
  console.log('🚀 予約送信チェックを開始...');
  console.log(`⏰ 現在時刻: ${new Date().toISOString()}`);

  try {
    // scheduled_datetime が現在時刻を過ぎていて、まだ送信されていない予約を取得
    const now = new Date().toISOString();
    const { data: scheduledChats, error } = await supabase
      .from('shared_item_scheduled_chats')
      .select('*')
      .is('chat_sent_at', null)
      .lte('scheduled_datetime', now);

    if (error) {
      console.error('❌ データ取得エラー:', error);
      return;
    }

    if (!scheduledChats || scheduledChats.length === 0) {
      console.log('✅ 送信対象のアイテムはありません');
      return;
    }

    console.log(`📬 送信対象: ${scheduledChats.length}件`);

    // スプレッドシートから共有アイテムを取得
    const sharedItemsService = new SharedItemsService();
    await sharedItemsService.initialize();
    const allItems = await sharedItemsService.getAll();

    const chatService = new GoogleChatService();
    let successCount = 0;
    let failCount = 0;

    for (const scheduled of scheduledChats as ScheduledChat[]) {
      try {
        console.log(`\n📤 送信中: スプレッドシートID=${scheduled.spreadsheet_item_id}, 予定時刻=${scheduled.scheduled_datetime}`);

        // スプレッドシートからアイテムを検索
        const item = allItems.find((i: any) => i.id === scheduled.spreadsheet_item_id);
        
        if (!item) {
          console.log(`⚠️  スキップ: アイテムが見つかりません (ID=${scheduled.spreadsheet_item_id})`);
          continue;
        }

        // 共有場が「他」であることを確認
        const sharingLocation = item['共有場'] || item.sharing_location;
        if (sharingLocation !== '他') {
          console.log(`⚠️  スキップ: 共有場が「他」ではありません (${sharingLocation})`);
          continue;
        }

        // メッセージを作成
        const title = item['タイトル'] || item.title || '（タイトルなし）';
        const content = item['内容'] || item.content || '';
        const pdfUrl = item['PDF'] || item.pdf_url || '';
        const imageUrl = item['画像'] || item.image_url || '';
        const detailUrl = `${FRONTEND_BASE_URL}/shared-items/${scheduled.spreadsheet_item_id}`;

        let message = `【共有事項】\n`;
        message += `タイトル: ${title}\n\n`;
        message += `${content}\n\n`;
        
        // include_warning_textがtrueの場合のみ注意文を含める
        if (scheduled.include_warning_text) {
          message += `**「共有できていないスタッフ」の自分のアカウントにチェックして必ず保存してください**\n\n`;
        }
        
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
            .from('shared_item_scheduled_chats')
            .update({ chat_sent_at: new Date().toISOString() })
            .eq('id', scheduled.id);

          if (updateError) {
            console.error(`⚠️  chat_sent_at更新エラー (ID=${scheduled.id}):`, updateError.message);
          } else {
            console.log(`✅ 送信成功 (スプレッドシートID=${scheduled.spreadsheet_item_id})`);
            successCount++;
          }
        } else {
          console.error(`❌ 送信失敗 (スプレッドシートID=${scheduled.spreadsheet_item_id}):`, result.error);
          failCount++;
        }
      } catch (itemError: any) {
        console.error(`❌ アイテム処理エラー (ID=${scheduled.id}):`, itemError.message);
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
