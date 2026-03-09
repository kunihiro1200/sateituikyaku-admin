// AA13561 の実際のAPIレスポンスを確認（decryptSeller後のデータ）
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // sellers テーブルの全フィールドを取得
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('seller_number', 'AA13561')
    .single();
  
  if (error) { console.log('error:', error); return; }
  
  // visit_assignee 関連フィールドを全て表示
  console.log('=== visit_assignee 関連 ===');
  console.log('visit_assignee:', data.visit_assignee);
  console.log('visit_valuation_acquirer:', data.visit_valuation_acquirer);
  console.log('valuation_assignee:', data.valuation_assignee);
  console.log('phone_assignee:', data.phone_assignee);
  console.log('first_caller_initials:', data.first_caller_initials);
  console.log('phone_contact_person:', data.phone_contact_person);
  console.log('assigned_to:', data.assigned_to);
  
  // "I" を含む全フィールドを表示
  console.log('\n=== "I" を含む全フィールド ===');
  Object.entries(data).forEach(([k, v]) => {
    if (v !== null && v !== undefined && String(v).includes('I')) {
      console.log(`${k}: ${JSON.stringify(v)}`);
    }
  });
  
  // null でない全フィールドを表示
  console.log('\n=== null でない全フィールド ===');
  Object.entries(data).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') {
      console.log(`${k}: ${JSON.stringify(v)}`);
    }
  });
}

main();
