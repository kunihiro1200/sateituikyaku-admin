import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAA13939SellerNumber() {
  console.log('=== AA13939のseller_numberを確認 ===');
  
  // seller_numberで検索
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('id, seller_number, name')
    .eq('seller_number', 'AA13939')
    .single();
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  if (!seller) {
    console.log('❌ AA13939が見つかりません');
    return;
  }
  
  console.log('✅ AA13939が見つかりました:');
  console.log('  id:', seller.id);
  console.log('  seller_number:', seller.seller_number);
  console.log('  name:', seller.name);
  
  if (!seller.seller_number) {
    console.log('❌ seller_numberがnullです！');
  } else {
    console.log('✅ seller_numberは正しく設定されています');
  }
}

checkAA13939SellerNumber().then(() => process.exit(0));
