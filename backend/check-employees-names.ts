/**
 * employeesテーブルのスタッフ名を確認するスクリプト
 * 
 * 実行方法:
 * npx ts-node backend/check-employees-names.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkEmployeesNames() {
  console.log('📊 employeesテーブルのスタッフ名を確認\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );

  const { data: employees, error } = await supabase
    .from('employees')
    .select('name, initials, is_active')
    .eq('is_active', true)
    .neq('name', '')
    .order('name');

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`✅ 全${employees.length}件取得\n`);

  // 「林田」「元汰」「和田」「樹奈」を含む名前を検索
  const targetNames = employees.filter(e =>
    e.name.includes('林田') ||
    e.name.includes('元汰') ||
    e.name.includes('和田') ||
    e.name.includes('樹奈')
  );

  console.log(`🔍 「林田」「元汰」「和田」「樹奈」を含むスタッフ: ${targetNames.length}件\n`);

  targetNames.forEach(emp => {
    console.log(`名前: "${emp.name}"`);
    console.log(`  イニシャル: ${emp.initials}`);
    console.log(`  文字数: ${emp.name.length}文字`);
    console.log(`  含まれる文字コード: ${Array.from(emp.name).map(c => `${c}(U+${c.charCodeAt(0).toString(16).toUpperCase()})`).join(', ')}`);
    console.log('');
  });

  console.log('✅ 確認完了');
}

checkEmployeesNames().catch(console.error);
