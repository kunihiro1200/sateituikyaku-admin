import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '.env.local') });

// 直接Supabaseクライアントを作成
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testSellerService() {
  console.log('🔍 Testing SellerService for AA13175...\n');

  // seller_numberでSeller IDを取得
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('id, seller_number')
    .eq('seller_number', 'AA13175')
    .single();

  if (error || !seller) {
    console.error('❌ Error finding seller:', error);
    return;
  }

  console.log('✅ Found seller ID:', seller.id);
  console.log('');

  // SellerServiceを動的にインポート（環境変数読み込み後）
  const { SellerService } = await import('./src/services/SellerService.supabase');
  const sellerService = new SellerService();
  const sellerData = await sellerService.getSeller(seller.id);

  console.log('📊 SellerService.getSeller() response:');
  console.log('  seller_number:', sellerData.sellerNumber);
  console.log('  inquiry_site:', sellerData.inquirySite);
  console.log('  inquiryId:', sellerData.inquiryId);
  console.log('  inquiryId type:', typeof sellerData.inquiryId);
  console.log('  inquiryId is null:', sellerData.inquiryId === null);
  console.log('  inquiryId is undefined:', sellerData.inquiryId === undefined);
  console.log('  inquiryId is empty string:', sellerData.inquiryId === '');
}

testSellerService();
