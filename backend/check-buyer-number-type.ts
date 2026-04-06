import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyerNumberType() {
  console.log('[check-buyer-number-type] ===== START =====');
  
  // 買主7294を取得（数値で検索）
  const { data: buyer1, error: error1 } = await supabase
    .from('buyers')
    .select('buyer_number')
    .eq('buyer_number', 7294)
    .single();
  
  console.log('[check-buyer-number-type] Search with number (7294):');
  console.log('  Found:', !!buyer1);
  if (buyer1) {
    console.log('  buyer_number:', buyer1.buyer_number);
    console.log('  buyer_number type:', typeof buyer1.buyer_number);
  }
  if (error1) {
    console.log('  Error:', error1.message);
  }
  
  // 買主7294を取得（文字列で検索）
  const { data: buyer2, error: error2 } = await supabase
    .from('buyers')
    .select('buyer_number')
    .eq('buyer_number', '7294')
    .single();
  
  console.log('[check-buyer-number-type] Search with string ("7294"):');
  console.log('  Found:', !!buyer2);
  if (buyer2) {
    console.log('  buyer_number:', buyer2.buyer_number);
    console.log('  buyer_number type:', typeof buyer2.buyer_number);
  }
  if (error2) {
    console.log('  Error:', error2.message);
  }
  
  // 全買主を取得して、buyer_numberの型を確認
  const { data: allBuyers, error: error3 } = await supabase
    .from('buyers')
    .select('buyer_number')
    .limit(5);
  
  console.log('[check-buyer-number-type] First 5 buyers:');
  allBuyers?.forEach(b => {
    console.log(`  buyer_number: ${b.buyer_number} (type: ${typeof b.buyer_number})`);
  });
  
  console.log('[check-buyer-number-type] ===== END =====');
}

checkBuyerNumberType();
