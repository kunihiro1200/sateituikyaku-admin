import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkInquiryEmailField() {
  console.log('🔍 買主番号7272のinquiry/email/phone関連フィールドを確認...\n');
  
  const { data, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '7272')
    .single();
  
  if (error) {
    console.log('❌ エラー:', error);
    return;
  }
  
  console.log('✅ 買主番号7272のフィールド一覧:');
  Object.keys(data).sort().forEach(key => {
    if (key.includes('inquiry') || key.includes('email') || key.includes('phone')) {
      console.log(`  ${key}: ${JSON.stringify(data[key])}`);
    }
  });
}

checkInquiryEmailField().catch(console.error);
