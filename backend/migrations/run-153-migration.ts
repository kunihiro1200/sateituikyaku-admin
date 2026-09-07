import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

async function runMigration() {
  console.log('🚀 Running Migration 153: Add chat send fields to shared_items\n');

  try {
    const sqlPath = path.join(__dirname, '153_add_chat_send_fields_to_shared_items.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Executing SQL via direct PostgreSQL connection...\n');

    // SupabaseのpostgREST APIを使用して直接SQLを実行
    const response = await axios.post(
      `${supabaseUrl}/rest/v1/rpc/exec_sql`,
      { query: sql },
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Migration 153 completed successfully!');
    console.log('\nshared_itemsテーブルに以下のフィールドが追加されました:');
    console.log('  - scheduled_chat_datetime (チャット送信予定日時)');
    console.log('  - chat_sent_at (実際の送信日時)');
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log('\n⚠️  exec_sql関数が見つかりませんでした。');
      console.log('📋 以下のSQLをSupabaseのSQL Editorで直接実行してください:\n');
      
      const sqlPath = path.join(__dirname, '153_add_chat_send_fields_to_shared_items.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(sql);
    } else {
      console.error('❌ Migration failed:', error.message || error);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }
    process.exit(1);
  }
}

runMigration();
