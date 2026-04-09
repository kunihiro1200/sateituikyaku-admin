/**
 * AA13888のAPIレスポンスを確認
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
  console.log('🔍 AA13888のAPIレスポンスを確認\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // /api/sellers/:id エンドポイントと同じクエリを実行
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('seller_number', 'AA13888')
    .is('deleted_at', null)
    .single();

  if (error || !seller) {
    console.log('❌ AA13888が見つかりません');
    console.log('エラー:', error?.message);
    return;
  }

  console.log('✅ AA13888が見つかりました\n');
  console.log('📊 重要なフィールド:');
  console.log(`  seller_number: ${seller.seller_number}`);
  console.log(`  status: "${seller.status}"`);
  console.log(`  confidence_level: "${seller.confidence_level || '(空)'}"`);
  console.log(`  next_call_date: ${seller.next_call_date || '(空)'}`);
  console.log(`  updated_at: ${seller.updated_at}`);
  console.log('');

  // フロントエンドが受け取るJSONと同じ形式で表示
  console.log('📄 フロントエンドが受け取るJSON（抜粋）:');
  console.log(JSON.stringify({
    sellerNumber: seller.seller_number,
    status: seller.status,
    confidence: seller.confidence_level,
    nextCallDate: seller.next_call_date,
  }, null, 2));
}

check().catch(console.error);
