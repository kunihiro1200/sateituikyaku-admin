/**
 * AA13729のdecryptSeller後のデータを確認
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import { SellerService } from './src/services/SellerService.supabase';

async function testDecryptSeller() {
  const sellerService = new SellerService();

  console.log('🔍 Testing decryptSeller for AA13729...\n');

  const seller = await sellerService.getSeller('AA13729');

  if (!seller) {
    console.error('❌ Seller not found');
    return;
  }

  console.log('✅ Decrypted seller data:');
  console.log('  - ID:', seller.id);
  console.log('  - Seller Number:', seller.sellerNumber);
  console.log('  - visitDate:', seller.visitDate);
  console.log('  - visitDate type:', typeof seller.visitDate);
  console.log('  - visitAssignee:', seller.visitAssignee);
  console.log('\n📝 Full seller object keys:');
  console.log(Object.keys(seller).sort());
}

testDecryptSeller();
