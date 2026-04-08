import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testInquiryAddress() {
  console.log('=== Testing inquiry address for buyer 6143 ===');
  
  // 1. 買主情報を取得
  const { data: buyer, error: buyerError } = await supabase
    .from('buyers')
    .select('buyer_number, property_number, reception_date')
    .eq('buyer_number', '6143')
    .single();
  
  console.log('Buyer:', JSON.stringify(buyer, null, 2));
  console.log('Buyer error:', buyerError);
  
  if (buyer && buyer.property_number) {
    console.log('\nProperty number:', buyer.property_number);
    
    // 2. property_listingsから物件情報を取得
    const { data: property, error: propertyError } = await supabase
      .from('property_listings')
      .select('property_number, property_type, address, display_address')
      .eq('property_number', buyer.property_number)
      .single();
    
    console.log('\nProperty from property_listings:', JSON.stringify(property, null, 2));
    console.log('Property error:', propertyError);
    
    if (property) {
      const address = property.property_type === 'マンション' 
        ? (property.display_address || property.address || '-')
        : (property.address || '-');
      console.log('\nFinal address:', address);
    }
  } else {
    console.log('\nNo property_number found for buyer 6143');
  }
}

testInquiryAddress().catch(console.error);

