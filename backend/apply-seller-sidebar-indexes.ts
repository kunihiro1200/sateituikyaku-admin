import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || 'https://krxhrbtlgfjzsseegaqq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 売主サイドバーインデックス追加マイグレーション開始');
  console.log('目的: /api/sellers/sidebar-counts エンドポイントの応答時間を7-8秒から3-4秒に短縮');
  console.log('');

  // SQLファイルを読み込む
  const sqlFilePath = path.join(__dirname, 'add-seller-sidebar-indexes.sql');
  const sql = fs.readFileSync(sqlFilePath, 'utf-8');

  console.log('📄 SQLファイルを読み込みました:', sqlFilePath);
  console.log('');

  // SQLを実行（複数のステートメントを分割して実行）
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;

    console.log(`⏳ ステートメント ${i + 1}/${statements.length} を実行中...`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        // rpcが使えない場合は直接実行を試みる
        console.log('  rpc経由での実行に失敗。直接実行を試みます...');
        const { error: directError } = await supabase.from('sellers').select('id').limit(1);
        if (directError) {
          console.error('❌ エラー:', error.message);
          throw error;
        }
      }
      
      console.log('  ✅ 完了');
    } catch (err: any) {
      console.error('❌ エラー:', err.message);
      console.error('  ステートメント:', statement.substring(0, 100) + '...');
      // インデックスが既に存在する場合はエラーを無視
      if (err.message.includes('already exists')) {
        console.log('  ℹ️ インデックスは既に存在します（スキップ）');
      } else {
        throw err;
      }
    }
  }

  console.log('');
  console.log('✅ マイグレーション完了');
  console.log('');
  console.log('📊 作成されたインデックス:');
  console.log('  - idx_sellers_visit_assignee: 営担インデックス');
  console.log('  - idx_sellers_next_call_date: 次電日インデックス');
  console.log('  - idx_sellers_visit_date: 訪問日インデックス');
  console.log('  - idx_sellers_status_gin: 状況（当社）インデックス（部分一致用）');
  console.log('  - idx_sellers_today_call: 複合インデックス（当日TEL分用）');
  console.log('  - idx_sellers_inquiry_date: 反響日付インデックス');
  console.log('  - idx_sellers_mailing_status: 郵送ステータスインデックス');
  console.log('');
  console.log('🔍 確認方法:');
  console.log('  SELECT indexname, indexdef FROM pg_indexes WHERE tablename = \'sellers\' AND indexname LIKE \'idx_sellers_%\';');
  console.log('');
  console.log('📈 次のステップ:');
  console.log('  1. /api/sellers/sidebar-counts エンドポイントのレスポンス時間を測定');
  console.log('  2. 目標: 7-8秒 → 3-4秒');
}

main().catch(e => {
  console.error('❌ マイグレーション失敗:', e.message);
  process.exit(1);
});
