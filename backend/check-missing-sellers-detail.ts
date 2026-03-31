import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const missingSellerNumbers = ['AA12560', 'AA12746', 'AA12428'];

async function checkMissingSellers() {
  console.log('🔍 スプシにあってDBにない売主の詳細を確認中...\n');

  for (const sellerNumber of missingSellerNumbers) {
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('seller_number, status, visit_assignee')
      .eq('seller_number', sellerNumber)
      .maybeSingle();

    if (error) {
      console.error(`❌ ${sellerNumber}: エラー`, error);
      continue;
    }

    if (!seller) {
      console.log(`❌ ${sellerNumber}: DBに存在しない`);
    } else {
      console.log(`✅ ${sellerNumber}: DBに存在する`);
      console.log(`   - status: ${seller.status}`);
      console.log(`   - visit_assignee: ${seller.visit_assignee}`);
    }
  }
}

checkMissingSellers().catch(console.error);
