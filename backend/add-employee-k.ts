import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

async function addEmployeeK() {
  console.log('営担「K」をemployeesテーブルに追加中...\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  // 既存の「国」を確認
  const { data: existingKuni } = await supabase
    .from('employees')
    .select('*')
    .eq('initials', '国')
    .single();
  
  if (existingKuni) {
    console.log('✅ 既存の「国」が見つかりました:');
    console.log(`  ID: ${existingKuni.id}`);
    console.log(`  名前: ${existingKuni.name}`);
    console.log(`  メール: ${existingKuni.email}`);
    console.log(`  イニシャル: ${existingKuni.initials}`);
    console.log(`  is_active: ${existingKuni.is_active}`);
    console.log('');
    
    // イニシャルを「K」に更新
    console.log('イニシャルを「国」→「K」に更新中...');
    const { error: updateError } = await supabase
      .from('employees')
      .update({ initials: 'K' })
      .eq('id', existingKuni.id);
    
    if (updateError) {
      console.error('❌ 更新エラー:', updateError);
      return;
    }
    
    console.log('✅ イニシャルを「K」に更新しました');
  } else {
    console.log('❌ 「国」が見つかりませんでした');
    console.log('新しい従業員「K」を追加します...');
    
    // スタッフ管理シートのデータを使用
    const { error: insertError } = await supabase
      .from('employees')
      .insert({
        google_id: 'tomoko.kunihiro@ifoo-oita.com',
        email: 'tomoko.kunihiro@ifoo-oita.com',
        name: '国広智子',
        role: 'agent',
        is_active: true,
        initials: 'K'
      });
    
    if (insertError) {
      console.error('❌ 追加エラー:', insertError);
      return;
    }
    
    console.log('✅ 営担「K」を追加しました');
  }
  
  // 確認
  const { data: employeeK } = await supabase
    .from('employees')
    .select('*')
    .eq('initials', 'K')
    .single();
  
  if (employeeK) {
    console.log('\n✅ 営担「K」の最終確認:');
    console.log(`  ID: ${employeeK.id}`);
    console.log(`  名前: ${employeeK.name}`);
    console.log(`  メール: ${employeeK.email}`);
    console.log(`  イニシャル: ${employeeK.initials}`);
    console.log(`  is_active: ${employeeK.is_active}`);
  } else {
    console.log('\n❌ 営担「K」が見つかりませんでした');
  }
}

addEmployeeK().catch(console.error);
