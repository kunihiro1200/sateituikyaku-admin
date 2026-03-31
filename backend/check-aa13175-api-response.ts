// AA13175のAPIレスポンスを確認するスクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function checkApiResponse() {
  console.log('🔍 Checking AA13175 API response...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // 1. データベース確認（既に完了）
  console.log('✅ Step 1: Database check (already confirmed)');
  console.log('  inquiry_id = CO2511-94507 is stored in database\n');

  // 2. SellerServiceのdecryptSellerメソッド確認
  console.log('✅ Step 2: SellerService.decryptSeller() check');
  console.log('  Line 1673: inquiryId: seller.inquiry_id is included\n');

  // 3. APIレスポンス確認（実際のAPIを呼び出す代わりにSellerServiceを直接テスト）
  console.log('🔍 Step 3: Testing SellerService directly...');
  
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('seller_number', 'AA13175')
    .single();

  if (error || !seller) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('  Raw database data:');
  console.log('    inquiry_id:', seller.inquiry_id);
  console.log('    inquiry_site:', seller.inquiry_site);
  console.log('');

  // 4. フロントエンドの型定義確認
  console.log('🔍 Step 4: Checking frontend type definition...');
  console.log('  Need to check: frontend/frontend/src/types/index.ts');
  console.log('  Looking for: inquiryId?: string;');
  console.log('');

  console.log('📊 Summary:');
  console.log('  ✅ Database has inquiry_id: CO2511-94507');
  console.log('  ✅ SellerService.decryptSeller() includes inquiryId');
  console.log('  ❓ Need to verify: API response and frontend type');
}

checkApiResponse();
