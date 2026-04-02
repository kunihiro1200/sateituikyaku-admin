/**
 * properties.structure の CHECK制約を確認するスクリプト
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStructureConstraint() {
  console.log('🔍 Checking properties.structure constraint...\n');

  // 1. テーブル制約を確認
  const { data: constraints, error: constraintError } = await supabase
    .rpc('get_table_constraints', { table_name: 'properties' })
    .select('*');

  if (constraintError) {
    console.log('⚠️ Cannot query constraints directly, checking via test insert...\n');
  } else {
    console.log('📋 Table constraints:', JSON.stringify(constraints, null, 2));
  }

  // 2. テスト挿入で制約を確認
  console.log('\n🧪 Testing structure values...\n');

  const testValues = ['木造', '軽量鉄骨', '鉄骨', '他', 'その他', '済', '木造２F建て', '未', '不要'];

  for (const value of testValues) {
    const { error } = await supabase
      .from('properties')
      .insert({
        seller_id: '00000000-0000-0000-0000-000000000000', // ダミーID
        property_address: 'test',
        property_type: '土地',
        structure: value,
      });

    if (error) {
      if (error.message.includes('violates check constraint')) {
        console.log(`❌ "${value}": NOT allowed (constraint violation)`);
      } else if (error.message.includes('violates foreign key constraint')) {
        console.log(`✅ "${value}": Allowed (FK error is expected for dummy seller_id)`);
      } else {
        console.log(`⚠️ "${value}": ${error.message}`);
      }
    } else {
      console.log(`✅ "${value}": Allowed`);
      // テストデータを削除
      await supabase
        .from('properties')
        .delete()
        .eq('seller_id', '00000000-0000-0000-0000-000000000000');
    }
  }
}

checkStructureConstraint()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
