import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSellers() {
  const sellerNumbers = ['AA13175', 'AA10618'];
  
  for (const sellerNumber of sellerNumbers) {
    console.log(`\n=== ${sellerNumber} ===`);
    
    const { data, error } = await supabase
      .from('sellers')
      .select('seller_number, name, created_at, updated_at')
      .eq('seller_number', sellerNumber)
      .single();
    
    if (error) {
      console.log('エラー:', error.message);
    } else if (data) {
      console.log('売主番号:', data.seller_number);
      console.log('名前（暗号化）:', data.name);
      console.log('名前の長さ:', data.name?.length || 0);
      console.log('名前がnull:', data.name === null);
      console.log('名前が空文字:', data.name === '');
      console.log('作成日時:', data.created_at);
      console.log('更新日時:', data.updated_at);
    } else {
      console.log('データが見つかりません');
    }
  }
}

checkSellers().catch(console.error);
