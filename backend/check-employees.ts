import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkEmployees() {
  console.log('=== employeesテーブルの内容を確認 ===\n');

  const { data: employees, error } = await supabase
    .from('employees')
    .select('*')
    .order('initials');

  if (error) {
    console.error('エラー:', error);
    return;
  }

  console.log(`全${employees.length}人のスタッフ:\n`);

  employees.forEach((emp: any) => {
    console.log(`イニシャル: ${emp.initials}`);
    console.log(`  名前: ${emp.name}`);
    console.log(`  メール: ${emp.email}`);
    console.log(`  有効: ${emp.is_active}`);
    console.log('');
  });

  // yurine~とmariko~を特に確認
  console.log('=== 特定のスタッフを確認 ===\n');

  const targetInitials = ['R', '久'];
  for (const initials of targetInitials) {
    const emp = employees.find((e: any) => e.initials === initials);
    if (emp) {
      console.log(`✅ ${initials} (${emp.name}) が見つかりました`);
      console.log(`   メール: ${emp.email}`);
    } else {
      console.log(`❌ ${initials} が見つかりません`);
    }
  }
}

checkEmployees();
