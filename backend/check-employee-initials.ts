import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// backend/.envを読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkEmployeeInitials() {
  console.log('=== 全アカウントのイニシャル確認 ===\n');

  const emails = [
    'tomoko.kunihiro@ifoo-oita.com',
    'yuuko.yamamoto@ifoo-oita.com',
    'hiromitsu-kakui@ifoo-oita.com',
    'genta.hayashida@ifoo-oita.com',
    'karen.asou@ifoo-oita.com',
    'tenma.ura@ifoo-oita.com',
    'yurine.kimura@ifoo-oita.com',
    'mariko.kume@ifoo-oita.com',
    'jyuna.wada@ifoo-oita.com',
  ];

  for (const email of emails) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, email, initials, is_active')
      .ilike('email', email)
      .single();

    if (error) {
      console.log(`❌ ${email}: エラー - ${error.message}`);
    } else if (!data) {
      console.log(`❌ ${email}: データベースに存在しません`);
    } else {
      const status = data.is_active ? '✅' : '⚠️ (非アクティブ)';
      console.log(`${status} ${email}`);
      console.log(`   名前: ${data.name || '(未設定)'}`);
      console.log(`   イニシャル: ${data.initials || '(未設定)'}`);
      console.log('');
    }
  }
}

checkEmployeeInitials().catch(console.error);
