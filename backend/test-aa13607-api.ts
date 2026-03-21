import * as dotenv from 'dotenv';
dotenv.config();

import { SellerService } from './src/services/SellerService.supabase';

async function test() {
  const sellerService = new SellerService();
  
  // seller_numberからIDを取得
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  const { data } = await supabase
    .from('sellers')
    .select('id')
    .eq('seller_number', 'AA13607')
    .single();
  
  if (!data) {
    console.log('AA13607 not found');
    return;
  }
  
  console.log('seller ID:', data.id);
  
  const seller = await sellerService.getSeller(data.id);
  
  if (!seller) {
    console.log('getSeller returned null');
    return;
  }
  
  console.log('=== APIレスポンス確認 ===');
  console.log('propertyAddress:', seller.propertyAddress);
  console.log('property:', seller.property);
  console.log('visitAssignee:', seller.visitAssignee);
  console.log('visitAssigneeInitials:', seller.visitAssigneeInitials);
  console.log('visitDate:', seller.visitDate);
  console.log('currentStatus:', seller.currentStatus);
  console.log('status:', seller.status);
}

test().catch(console.error);
