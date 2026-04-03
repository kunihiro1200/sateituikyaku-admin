#!/usr/bin/env node
/**
 * 買主7282のデータベースデータを確認
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
  console.log('🔍 買主7282のデータベースデータを確認中...\n');

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

  // 重要なフィールドを表示
  const importantFields = [
    'buyer_number',
    'viewing_date',
    'viewing_time',
    'viewing_mobile',
    'latest_viewing_date',
    'post_viewing_seller_contact',
    'viewing_promotion_email',
    'updated_at'
  ];

  console.log('📊 データベースのデータ:');
  console.log('='.repeat(60));

  importantFields.forEach(field => {
    const value = buyer[field];
    console.log(`${field}: ${value !== null && value !== undefined ? value : '（null）'}`);
  });

  console.log('='.repeat(60));
}

checkBuyer().catch(console.error);
