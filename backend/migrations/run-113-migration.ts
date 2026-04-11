import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URLまたはSUPABASE_SERVICE_ROLE_KEYが設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 マイグレーション113を実行中: cw_counts テーブルを作成...\n');

  try {
    // SQLファイルを読み込む
    const sqlPath = path.join(__dirname, '113_create_cw_counts_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📄 マイグレーションSQLを実行中...');

    // マイグレーションを実行
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ マイグレーション失敗:', error);
      process.exit(1);
    }

    console.log('✅ マイグレーション113が正常に完了しました！\n');

    // 検証
    console.log('🔍 検証中...');

    const { data: rows, error: queryError } = await supabase
      .from('cw_counts')
      .select('id, item_name, current_total, synced_at, updated_at')
      .limit(1);

    if (queryError) {
      console.error('❌ 検証クエリ失敗:', queryError);
      process.exit(1);
    }

    console.log('✅ 検証完了！cw_counts テーブルにアクセスできます。');
    console.log('📊 サンプルデータ:', rows);

    console.log('\n📋 実行内容:');
    console.log('  - cw_counts テーブルを作成');
    console.log('  - RLS（Row Level Security）を有効化');
    console.log('  - 認証済みユーザーのSELECTポリシーを追加');
    console.log('  - service_roleの全操作ポリシーを追加');
    console.log('  - idx_cw_counts_item_name インデックスを追加');

  } catch (err) {
    console.error('❌ 予期しないエラー:', err);
    process.exit(1);
  }
}

runMigration();
