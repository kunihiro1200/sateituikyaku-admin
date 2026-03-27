/**
 * propertiesテーブルのproperty_type制約を確認するスクリプト
 */
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );

  // 制約の内容をpg_constraintから取得
  const { data, error } = await supabase.rpc('get_property_type_constraint');
  if (error) {
    // RPCがない場合は直接クエリ
    const { data: d2, error: e2 } = await (supabase as any)
      .from('information_schema.check_constraints')
      .select('constraint_name, check_clause')
      .ilike('constraint_name', '%property_type%');
    console.log('check_constraints:', d2, e2);
  } else {
    console.log(data);
  }

  // 実際にDBに存在するproperty_typeの値一覧を確認
  const { data: types, error: e3 } = await supabase
    .from('properties')
    .select('property_type')
    .limit(1000);

  if (types) {
    const unique = [...new Set(types.map((r: any) => r.property_type))].filter(Boolean);
    console.log('\n現在DBに存在するproperty_type値:', unique);
  }
}

main().catch(console.error);
