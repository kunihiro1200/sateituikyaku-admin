import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// backend/.envを読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fixKunihiroInitials() {
  console.log('=== 国広智子さんのイニシャルを修正 ===\n');

  const email = 'tomoko.kunihiro@ifoo-oita.com';

  // 現在の値を確認
  const { data: before } = await supabase
    .from('employees')
    .select('id, name, email, initials')
    .ilike('email', email)
    .single();

  console.log('修正前:');
  console.log(`  名前: ${before?.name}`);
  console.log(`  イニシャル: ${before?.initials}`);
  console.log('');

  // イニシャルを「国」に修正
  const { data: updated, error } = await supabase
    .from('employees')
    .update({ initials: '国' })
    .ilike('email', email)
    .select()
    .single();

  if (error) {
    console.error('❌ 修正失敗:', error.message);
    return;
  }

  console.log('✅ 修正完了:');
  console.log(`  名前: ${updated.name}`);
  console.log(`  イニシャル: ${updated.initials}`);
}

fixKunihiroInitials().catch(console.error);
