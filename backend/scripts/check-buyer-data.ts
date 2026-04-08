// 買主データのエンコーディングを確認
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const SUPABASE_URL = 'https://krxhrbtlgfjzsseegaqq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

async function checkBuyerData() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // 最初の10件を取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, desired_area')
    .not('desired_area', 'is', null)
    .is('deleted_at', null)
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('=== Sample Buyer Data ===');
  buyers?.forEach((buyer, index) => {
    console.log(`\n[${index + 1}] Buyer ${buyer.buyer_number}`);
    console.log(`  desired_area: ${buyer.desired_area}`);
    console.log(`  length: ${buyer.desired_area?.length || 0}`);
    console.log(`  bytes: ${Buffer.from(buyer.desired_area || '', 'utf-8').length}`);
  });
}

checkBuyerData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
