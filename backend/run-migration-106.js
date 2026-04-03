#!/usr/bin/env node
/**
 * Migration 106を実行: viewing_dateカラムを追加
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URLまたはSUPABASE_SERVICE_KEYが設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔄 Migration 106を実行中...\n');

  // マイグレーションSQLを読み込む
  const sqlPath = path.join(__dirname, 'migrations', '106_add_viewing_date_to_buyers.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('📄 実行するSQL:');
  console.log('='.repeat(60));
  console.log(sql);
  console.log('='.repeat(60));
  console.log('');

  // SQLを実行
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ マイグレーション失敗:', error.message);
    
    // rpc関数が存在しない場合は、直接実行を試みる
    console.log('\n⚠️  rpc関数が存在しないため、直接実行を試みます...');
    
    // 各SQL文を個別に実行
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.startsWith('COMMENT')) {
        console.log('⏭️  COMMENTステートメントをスキップ');
        continue;
      }

      console.log(`\n🔄 実行中: ${statement.substring(0, 50)}...`);
      
      const { error: execError } = await supabase.rpc('exec', { 
        query: statement 
      });

      if (execError) {
        console.error(`❌ エラー: ${execError.message}`);
        console.log('\n💡 手動でSupabase SQL Editorで実行してください:');
        console.log('   https://supabase.com/dashboard/project/krxhrbtlgfjzsseegaqq/sql');
        process.exit(1);
      }

      console.log('✅ 成功');
    }
  } else {
    console.log('✅ マイグレーション成功');
  }

  // 確認
  console.log('\n🔍 viewing_dateカラムが追加されたか確認中...');
  
  const { data: buyer, error: selectError } = await supabase
    .from('buyers')
    .select('buyer_number, viewing_date, viewing_time')
    .eq('buyer_number', '7282')
    .single();

  if (selectError) {
    console.error('❌ 確認失敗:', selectError.message);
    process.exit(1);
  }

  console.log('\n✅ 確認成功:');
  console.log(`   buyer_number: ${buyer.buyer_number}`);
  console.log(`   viewing_date: ${buyer.viewing_date || '（null）'}`);
  console.log(`   viewing_time: ${buyer.viewing_time || '（null）'}`);

  console.log('\n🎉 Migration 106が正常に完了しました！');
}

runMigration().catch(console.error);
