import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer7267() {
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, owned_home_hearing_inquiry')
    .eq('buyer_number', '7267')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('買主7267のデータ:');
  console.log('buyer_number:', data.buyer_number);
  console.log('owned_home_hearing_inquiry:', JSON.stringify(data.owned_home_hearing_inquiry));
  console.log('型:', typeof data.owned_home_hearing_inquiry);
  console.log('長さ:', data.owned_home_hearing_inquiry ? String(data.owned_home_hearing_inquiry).length : 0);
  console.log('trim後:', data.owned_home_hearing_inquiry ? String(data.owned_home_hearing_inquiry).trim() : '');
  console.log('trim後の長さ:', data.owned_home_hearing_inquiry ? String(data.owned_home_hearing_inquiry).trim().length : 0);
  
  // 文字コードを確認
  if (data.owned_home_hearing_inquiry) {
    const str = String(data.owned_home_hearing_inquiry);
    console.log('文字コード:');
    for (let i = 0; i < str.length; i++) {
      console.log(`  [${i}]: "${str[i]}" (code: ${str.charCodeAt(i)})`);
    }
  }
  
  // isHomeHearingResultRequired のロジックをテスト
  const isRequired_OLD = !!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim());
  const isRequired_NEW = (() => {
    if (!data.owned_home_hearing_inquiry) return false;
    const trimmed = String(data.owned_home_hearing_inquiry).trim();
    return trimmed.length > 0;
  })();
  
  console.log('\nisHomeHearingResultRequired:');
  console.log('  修正前:', isRequired_OLD);
  console.log('  修正後:', isRequired_NEW);
}

checkBuyer7267();
