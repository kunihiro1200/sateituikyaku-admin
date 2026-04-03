#!/usr/bin/env node
/**
 * 買主7282の同期状態を簡易確認
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

async function checkBuyer() {
  console.log('🔍 買主7282の同期状態を確認中...\n');

  // 買主7282を取得
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

  console.log('📊 現在のデータベースの状態:');
  console.log('='.repeat(60));
  console.log(`買主番号: ${buyer.buyer_number}`);
  console.log(`内覧日（最新）: ${buyer.viewing_date || '（null）'}`);
  console.log(`時間: ${buyer.viewing_time || '（null）'}`);
  console.log(`内覧形態: ${buyer.viewing_mobile || '（null）'}`);
  console.log(`最新内覧日: ${buyer.latest_viewing_date || '（null）'}`);
  console.log(`更新日時: ${buyer.updated_at}`);
  console.log('='.repeat(60));

  console.log('\n🔍 問題の分析:');
  
  if (!buyer.viewing_date && buyer.viewing_time) {
    console.log('⚠️  viewing_date が null だが viewing_time には値がある');
    console.log('   → スプレッドシートの「内覧日（最新）」カラムが空、または同期されていない可能性');
  }
  
  if (buyer.viewing_date && !buyer.viewing_time) {
    console.log('⚠️  viewing_date には値があるが viewing_time が null');
    console.log('   → スプレッドシートの「時間」カラムが空、または同期されていない可能性');
  }
  
  if (!buyer.viewing_date && !buyer.viewing_time) {
    console.log('⚠️  viewing_date と viewing_time の両方が null');
    console.log('   → スプレッドシートの両カラムが空、または同期が実行されていない可能性');
  }
  
  if (buyer.viewing_date && buyer.viewing_time) {
    console.log('✅ viewing_date と viewing_time の両方に値がある（正常）');
  }

  console.log('\n💡 推奨される対応:');
  console.log('1. スプレッドシートの買主リストで買主7282の行を確認');
  console.log('2. 「内覧日（最新）」と「時間」カラムに値が入っているか確認');
  console.log('3. GASの syncBuyerList 関数を手動実行して同期をテスト');
  console.log('4. GASのログを確認して、エラーが出ていないか確認');
}

checkBuyer().catch(console.error);
