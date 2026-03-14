/**
 * buyer_number UNIQUE制約の適用状況を確認するスクリプト
 * 
 * 実行方法:
 *   npx ts-node backend/check-buyer-number-unique-constraint.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkUniqueConstraint() {
  console.log('=== buyer_number UNIQUE制約の確認 ===\n');

  // 1. UNIQUE制約の存在確認
  const { data: constraints, error: constraintError } = await supabase
    .rpc('check_buyer_number_constraint' as any)
    .select();

  // rpcが使えない場合は直接クエリで確認
  const { data: constraintData, error: constraintQueryError } = await supabase
    .from('information_schema.table_constraints' as any)
    .select('constraint_name, constraint_type')
    .eq('table_name', 'buyers')
    .eq('constraint_type', 'UNIQUE');

  if (constraintQueryError) {
    console.log('制約確認クエリエラー（information_schemaへのアクセス制限の可能性）:', constraintQueryError.message);
  } else {
    console.log('UNIQUE制約一覧:', constraintData);
  }

  // 2. upsertのテスト（新規レコードが挿入されるか確認）
  console.log('\n=== upsertテスト ===');
  const testBuyerNumber = `TEST_${Date.now()}`;
  
  const { data: upsertData, error: upsertError } = await supabase
    .from('buyers')
    .upsert(
      {
        buyer_number: testBuyerNumber,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'buyer_number' }
    )
    .select();

  if (upsertError) {
    console.log('❌ upsertエラー:', upsertError.message);
    console.log('   code:', (upsertError as any).code);
    console.log('   details:', (upsertError as any).details);
    console.log('   hint:', (upsertError as any).hint);
    
    if ((upsertError as any).code === '42P10') {
      console.log('\n🚨 根本原因特定: UNIQUE制約が適用されていません（PostgreSQL error 42P10）');
      console.log('   解決策: backend/migrations/094_add_buyer_number_unique_constraint.sql をSupabaseに適用してください');
    }
  } else {
    console.log('✅ upsert成功:', upsertData);
    
    // テストレコードを削除
    await supabase.from('buyers').delete().eq('buyer_number', testBuyerNumber);
    console.log('テストレコードを削除しました');
  }

  // 3. 既存の重複確認
  console.log('\n=== 重複buyer_numberの確認 ===');
  const { data: allBuyers, error: buyersError } = await supabase
    .from('buyers')
    .select('buyer_number')
    .not('buyer_number', 'is', null);

  if (buyersError) {
    console.log('買主一覧取得エラー:', buyersError.message);
  } else {
    const buyerNumbers = allBuyers?.map(b => b.buyer_number) || [];
    const duplicates = buyerNumbers.filter((num, idx) => buyerNumbers.indexOf(num) !== idx);
    
    if (duplicates.length > 0) {
      console.log('⚠️ 重複buyer_numberが見つかりました:', [...new Set(duplicates)]);
    } else {
      console.log('✅ 重複buyer_numberはありません（総レコード数:', buyerNumbers.length, '）');
    }
  }

  // 4. insertのみのテスト（onConflictなし）
  console.log('\n=== insertテスト（onConflictなし） ===');
  const testBuyerNumber2 = `TEST2_${Date.now()}`;
  
  const { data: insertData, error: insertError } = await supabase
    .from('buyers')
    .insert({
      buyer_number: testBuyerNumber2,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select();

  if (insertError) {
    console.log('❌ insertエラー:', insertError.message);
    console.log('   code:', (insertError as any).code);
  } else {
    console.log('✅ insert成功:', insertData);
    // テストレコードを削除
    await supabase.from('buyers').delete().eq('buyer_number', testBuyerNumber2);
    console.log('テストレコードを削除しました');
  }
}

checkUniqueConstraint().catch(console.error);
