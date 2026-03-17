// area_map_config テーブルに coordinates カラムを追加するマイグレーション
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('=== coordinates カラム追加マイグレーション ===\n');

  // Supabase REST API経由でSQL実行
  const sql = `
    ALTER TABLE area_map_config
    ADD COLUMN IF NOT EXISTS coordinates JSONB DEFAULT NULL;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    // exec_sql RPCがない場合は直接試みる
    console.log('RPC exec_sql が使えません。別の方法を試みます...');
    
    // テスト: coordinatesカラムに直接UPDATEを試みる
    const { error: testError } = await supabase
      .from('area_map_config')
      .update({ coordinates: { lat: 0, lng: 0 } })
      .eq('area_number', 'NONEXISTENT_TEST');
    
    if (testError && testError.message.includes('coordinates')) {
      console.error('❌ coordinatesカラムが存在しません。Supabaseダッシュボードで以下のSQLを実行してください:');
      console.log('\n--- SQL ---');
      console.log('ALTER TABLE area_map_config ADD COLUMN IF NOT EXISTS coordinates JSONB DEFAULT NULL;');
      console.log('--- SQL ---\n');
    } else {
      console.log('✅ coordinatesカラムは既に存在します（またはエラーが別の原因）');
      console.log('エラー詳細:', testError?.message);
    }
    return;
  }

  console.log('✅ マイグレーション成功');
}

main().catch(console.error);
