import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function forceSyncAA13729() {
  console.log('🔄 Forcing sync for AA13729 from spreadsheet...\n');

  // スプレッドシートから最新データを取得するため、GASの同期を待つ
  console.log('⏳ Please run GAS syncSellerList() to sync AA13729 from spreadsheet');
  console.log('   Or wait for the next automatic sync (every 10 minutes)\n');

  // 現在のデータを確認
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_date, visit_time, visit_assignee')
    .eq('seller_number', 'AA13729')
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('📊 Current data in database:');
  console.log('   Seller Number:', seller.seller_number);
  console.log('   Visit Date:', seller.visit_date);
  console.log('   Visit Time:', seller.visit_time);
  console.log('   Visit Assignee:', seller.visit_assignee);
  console.log('\n');

  console.log('💡 To sync from spreadsheet:');
  console.log('   1. Open Google Spreadsheet');
  console.log('   2. Extensions → Apps Script');
  console.log('   3. Run syncSellerList() function');
  console.log('   4. Wait for completion');
  console.log('   5. Run this script again to verify\n');
}

forceSyncAA13729().catch(console.error);
