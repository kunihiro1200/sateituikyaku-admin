import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkInquiryId() {
  console.log('🔍 Checking AA13175 inquiry_id field...\n');

  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, inquiry_id, inquiry_site')
    .eq('seller_number', 'AA13175')
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!seller) {
    console.log('❌ Seller AA13175 not found');
    return;
  }

  console.log('✅ Seller found:');
  console.log('  seller_number:', seller.seller_number);
  console.log('  inquiry_site:', seller.inquiry_site);
  console.log('  inquiry_id:', seller.inquiry_id);
  console.log('  inquiry_id type:', typeof seller.inquiry_id);
  console.log('  inquiry_id is null:', seller.inquiry_id === null);
  console.log('  inquiry_id is undefined:', seller.inquiry_id === undefined);
  console.log('  inquiry_id is empty string:', seller.inquiry_id === '');
}

checkInquiryId();
