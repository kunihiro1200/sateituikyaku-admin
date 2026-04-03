#!/usr/bin/env node
/**
 * buyersテーブルのスキーマを確認
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URLまたはSUPABASE_SERVICE_KEYが設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 buyersテーブルのスキーマを確認中...\n');

  // 買主7282を全カラム取得
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '7282')
    .single();

  if (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }

  if (!buyer) {
    console.log('❌ 買主7282が見つかりません');
    process.exit(1);
  }

  console.log('✅ 買主7282が見つかりました\n');

  // 全カラム名を表示
  const columns = Object.keys(buyer).sort();
  
  console.log('📊 buyersテーブルのカラム一覧:');
  console.log('='.repeat(60));
  
  // viewing関連のカラムを強調表示
  columns.forEach(col => {
    if (col.includes('viewing')) {
      console.log(`✅ ${col} ← viewing関連`);
    } else {
      console.log(`   ${col}`);
    }
  });
  
  console.log('='.repeat(60));
  
  // viewing_dateカラムの存在確認
  if (columns.includes('viewing_date')) {
    console.log('\n✅ viewing_dateカラムが存在します');
    console.log(`   値: ${buyer.viewing_date || '（null）'}`);
  } else {
    console.log('\n❌ viewing_dateカラムが存在しません');
  }
  
  // viewing_timeカラムの存在確認
  if (columns.includes('viewing_time')) {
    console.log('✅ viewing_timeカラムが存在します');
    console.log(`   値: ${buyer.viewing_time || '（null）'}`);
  } else {
    console.log('❌ viewing_timeカラムが存在しません');
  }
}

checkSchema().catch(console.error);
