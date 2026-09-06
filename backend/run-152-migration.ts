import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

async function runMigration() {
  console.log('🚀 Running Migration 152: Add team answer visibility flags\n');

  try {
    const sqlPath = path.join(__dirname, 'migrations', '152_add_team_answer_visibility.sql');
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

    console.log('✅ Migration 152 completed successfully!');
    console.log('\n各担当者の回答に公開状態フラグが追加されました:');
    console.log('  - is_kunihiro_visible (国広)');
    console.log('  - is_yamamoto_visible (山本)');
    console.log('  - is_ura_visible (裏)');
    console.log('  - is_kadoi_visible (角井)');
    console.log('  - is_hayashida_visible (林田)');
    console.log('  - is_aso_visible (麻生)');
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log('\n⚠️  exec_sql関数が見つかりませんでした。');
      console.log('📋 以下のSQLをSupabaseのSQL Editorで直接実行してください:\n');
      
      const sqlPath = path.join(__dirname, 'migrations', '152_add_team_answer_visibility.sql');
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
