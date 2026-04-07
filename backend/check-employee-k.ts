import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkEmployeeK() {
  console.log('全従業員のイニシャルを確認中...\n');
  
  // 全従業員を取得
  const { data: allEmployees, error: allError } = await supabase
    .from('employees')
    .select('*')
    .order('initials');
  
  if (allError) {
    console.error('❌ エラー:', allError);
    return;
  }
  
  if (!allEmployees || allEmployees.length === 0) {
    console.log('❌ 従業員が見つかりませんでした');
    return;
  }
  
  console.log(`✅ 全従業員（${allEmployees.length}人）:`);
  console.log('');
  
  allEmployees.forEach((emp: any) => {
    console.log(`イニシャル: ${emp.initials || '(なし)'}`);
    console.log(`  名前: ${emp.name || '(なし)'}`);
    console.log(`  カラム: ${Object.keys(emp).join(', ')}`);
    console.log('');
  });
  
  // 営担「K」を検索
  console.log('\n営担「K」を検索中...');
  const employeeK = allEmployees.find((emp: any) => emp.initials === 'K');
  if (employeeK) {
    console.log('✅ 営担「K」が見つかりました:');
    console.log(JSON.stringify(employeeK, null, 2));
  } else {
    console.log('❌ 営担「K」は見つかりませんでした');
    console.log('   → 訪問予約の保存時に400エラー「無効な営担です」が発生します');
  }
}

checkEmployeeK().catch(console.error);
