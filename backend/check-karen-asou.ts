import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// backend/.envを読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkKarenAsou() {
  console.log('=== karen.asou@ifoo-oita.comの確認 ===\n');

  const email = 'karen.asou@ifoo-oita.com';

  // 複数レコードを取得
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, email, initials, is_active')
    .ilike('email', email);

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ データベースに存在しません');
    return;
  }

  console.log(`✅ ${data.length}件のレコードが見つかりました:\n`);
  data.forEach((emp, index) => {
    console.log(`レコード ${index + 1}:`);
    console.log(`  ID: ${emp.id}`);
    console.log(`  名前: ${emp.name || '(未設定)'}`);
    console.log(`  イニシャル: ${emp.initials || '(未設定)'}`);
    console.log(`  アクティブ: ${emp.is_active ? 'はい' : 'いいえ'}`);
    console.log('');
  });
}

checkKarenAsou().catch(console.error);
