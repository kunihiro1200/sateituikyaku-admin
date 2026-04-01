/**
 * property_typeカラムのチェック制約を確認するスクリプト
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPropertyTypeConstraint() {
  console.log('🔍 property_typeカラムのチェック制約を確認中...\n');

  try {
    // 1. テーブルの制約を確認
    const { data: constraints, error: constraintsError } = await supabase
      .rpc('get_table_constraints', { table_name: 'properties' })
      .select('*');

    if (constraintsError) {
      console.log('⚠️ RPC関数が存在しないため、スキップします\n');
    } else {
      console.log('📋 propertiesテーブルの制約:');
      console.log(constraints);
    }

    // 2. property_typeカラムの定義を確認
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', 'properties')
      .eq('column_name', 'property_type');

    if (columnsError) {
      console.error('❌ カラム情報の取得に失敗:', columnsError);
    } else {
      console.log('\n📋 property_typeカラムの定義:');
      console.log(columns);
    }

    // 3. 実際のproperty_typeの値を確認
    const { data: propertyTypes, error: typesError } = await supabase
      .from('properties')
      .select('property_type')
      .limit(100);

    if (typesError) {
      console.error('❌ property_typeの値の取得に失敗:', typesError);
    } else {
      const uniqueTypes = [...new Set(propertyTypes.map(p => p.property_type))];
      console.log('\n📋 実際のproperty_typeの値（ユニーク）:');
      uniqueTypes.forEach(type => {
        console.log(`  - "${type}"`);
      });
    }

    // 4. テスト: 無効な値を挿入してみる
    console.log('\n🧪 テスト: 無効な値を挿入してみる...');
    const { data: testInsert, error: testError } = await supabase
      .from('properties')
      .insert({
        seller_id: '00000000-0000-0000-0000-000000000000', // ダミーID
        property_type: 'test_invalid_type',
        property_address: 'テスト住所',
      })
      .select();

    if (testError) {
      console.log('❌ 挿入エラー（制約が有効）:', testError.message);
    } else {
      console.log('✅ 挿入成功（制約が無効）');
      // テストデータを削除
      if (testInsert && testInsert.length > 0) {
        await supabase
          .from('properties')
          .delete()
          .eq('id', testInsert[0].id);
        console.log('🗑️ テストデータを削除しました');
      }
    }

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkPropertyTypeConstraint();
