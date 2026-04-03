#!/usr/bin/env node
/**
 * データベースの買主7282を直接確認
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkBuyer7282() {
  console.log('🔍 データベースの買主7282を確認中...\n');

  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, viewing_date, viewing_time, latest_viewing_date, updated_at')
    .eq('buyer_number', '7282')
    .single();

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!data) {
    console.log('❌ 買主7282が見つかりません');
    return;
  }

  console.log('✅ 買主7282のデータ:');
  console.log('='.repeat(60));
  console.log(`buyer_number: ${data.buyer_number}`);
  console.log(`viewing_date: ${data.viewing_date || '（null）'}`);
  console.log(`viewing_time: ${data.viewing_time || '（null）'}`);
  console.log(`latest_viewing_date: ${data.latest_viewing_date || '（null）'}`);
  console.log(`updated_at: ${data.updated_at}`);
  console.log('='.repeat(60));

  console.log('\n🔍 診断:');
  if (!data.viewing_date && !data.viewing_time) {
    console.log('❌ viewing_dateとviewing_timeの両方がnullです');
    console.log('   → GAS同期が実行されていない可能性が高い');
    console.log('   → gas_buyer_complete_code.js をGoogle Apps Scriptエディタにコピーして実行してください');
  } else if (data.viewing_date && data.viewing_time) {
    console.log('✅ viewing_dateとviewing_timeの両方がデータベースに保存されています');
    console.log('   → バックエンドAPIの問題の可能性');
  } else {
    console.log('⚠️  viewing_dateまたはviewing_timeのどちらかがnullです');
    console.log(`   viewing_date: ${data.viewing_date || 'null'}`);
    console.log(`   viewing_time: ${data.viewing_time || 'null'}`);
  }
}

checkBuyer7282().catch(console.error);
