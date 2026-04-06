import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// backend/.envを読み込む
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer4154() {
  console.log('🔍 買主4154の調査を開始...\n');

  // 1. データベースに存在するか確認
  console.log('1️⃣ データベースでの確認:');
  const { data: buyer, error: buyerError } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '4154')
    .single();

  if (buyerError) {
    console.log('❌ データベースエラー:', buyerError.message);
  } else if (buyer) {
    console.log('✅ データベースに存在します');
    console.log('   買主番号:', buyer.buyer_number);
    console.log('   削除フラグ:', buyer.is_deleted);
    console.log('   作成日:', buyer.created_at);
    console.log('   更新日:', buyer.updated_at);
  } else {
    console.log('❌ データベースに存在しません');
  }

  console.log('\n2️⃣ GASログの確認:');
  console.log('   GASの削除同期処理は以下のロジックで動作します:');
  console.log('   - スプレッドシートから全買主番号を取得');
  console.log('   - データベースから全アクティブ買主番号を取得');
  console.log('   - DBにあってスプシにない買主を「削除対象」として検出');
  console.log('   - 検出された買主をDBから物理削除');

  console.log('\n3️⃣ 安全ガード:');
  console.log('   - スプシが0件の場合は削除処理をスキップ');
  console.log('   - スプシの買主数がDBの50%未満の場合は削除処理をスキップ');

  console.log('\n4️⃣ 考えられる原因:');
  console.log('   ① スプレッドシートから手動で行が削除された');
  console.log('   ② スプレッドシートのフィルタで非表示になっている');
  console.log('   ③ GASの同期処理が実行され、スプシにないため削除された');
  console.log('   ④ 買主番号の入力ミス（4154ではなく別の番号）');

  console.log('\n5️⃣ 次のステップ:');
  console.log('   ① スプレッドシートで買主番号4154を検索');
  console.log('   ② フィルタを全て解除して再検索');
  console.log('   ③ GASのログを確認（削除同期のログ）');
  console.log('   ④ 必要であれば、データベースから復元');
}

checkBuyer4154().catch(console.error);
