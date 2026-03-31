import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URLまたはSUPABASE_SERVICE_ROLE_KEYが設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🔄 マイグレーション104を実行中...');
    
    // SQLファイルを読み込み
    const sqlPath = path.join(__dirname, '104_add_confirmation_constraints.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // SQLを個別のステートメントに分割して実行
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 ${statements.length}個のSQLステートメントを実行します`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n🔄 ステートメント ${i + 1}/${statements.length} を実行中...`);
      console.log(`   ${statement.substring(0, 60)}...`);
      
      const { error } = await supabase.rpc('exec', { sql: statement });
      
      if (error) {
        console.error(`❌ ステートメント ${i + 1} 実行エラー:`, error);
        console.error(`   SQL: ${statement}`);
        process.exit(1);
      }
      
      console.log(`✅ ステートメント ${i + 1} 完了`);
    }
    
    console.log('\n✅ マイグレーション104が正常に完了しました');
    console.log('📊 実行内容:');
    console.log('  - 既存物件の確認フィールドに初期値「未」を設定');
    console.log('  - デフォルト値を「未」に設定');
    console.log('  - CHECK制約を追加（「未」または「済」のみ許可）');
    console.log('  - NOT NULL制約を追加');
    
  } catch (error) {
    console.error('❌ マイグレーション実行エラー:', error);
    process.exit(1);
  }
}

runMigration();
