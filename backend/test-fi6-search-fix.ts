import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { decrypt } from './src/utils/encryption';

// 環境変数を読み込む
dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFI6Search() {
  console.log('🔍 FI6検索修正テスト開始...\n');

  // テスト1: FI6で検索（OR条件）
  console.log('1️⃣ FI6で検索（OR条件: FI6% または FI00006%）:');
  try {
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .or('seller_number.ilike.FI6%,seller_number.ilike.FI00006%')
      .is('deleted_at', null)
      .order('seller_number', { ascending: true })
      .limit(50);

    if (error) throw error;

    console.log(`✅ ${data.length}件見つかりました:`);
    data.forEach(seller => {
      const name = seller.name ? decrypt(seller.name) : '(名前なし)';
      console.log(`  - ${seller.seller_number}: ${name}`);
    });
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }

  // テスト2: FI2で検索（OR条件）
  console.log('\n2️⃣ FI2で検索（OR条件: FI2% または FI00002%）:');
  try {
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .or('seller_number.ilike.FI2%,seller_number.ilike.FI00002%')
      .is('deleted_at', null)
      .order('seller_number', { ascending: true })
      .limit(50);

    if (error) throw error;

    console.log(`✅ ${data.length}件見つかりました:`);
    data.forEach(seller => {
      const name = seller.name ? decrypt(seller.name) : '(名前なし)';
      console.log(`  - ${seller.seller_number}: ${name}`);
    });
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }

  // テスト3: FI00006で検索（完全一致）
  console.log('\n3️⃣ FI00006で検索（完全一致）:');
  try {
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .eq('seller_number', 'FI00006')
      .is('deleted_at', null);

    if (error) throw error;

    console.log(`✅ ${data.length}件見つかりました:`);
    data.forEach(seller => {
      const name = seller.name ? decrypt(seller.name) : '(名前なし)';
      console.log(`  - ${seller.seller_number}: ${name}`);
    });
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }

  // テスト4: AA検索（回帰テスト）
  console.log('\n4️⃣ AA13501で検索（回帰テスト）:');
  try {
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .eq('seller_number', 'AA13501')
      .is('deleted_at', null);

    if (error) throw error;

    console.log(`✅ ${data.length}件見つかりました:`);
    data.forEach(seller => {
      const name = seller.name ? decrypt(seller.name) : '(名前なし)';
      console.log(`  - ${seller.seller_number}: ${name}`);
    });
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }

  console.log('\n✅ テスト完了');
}

testFI6Search().catch(console.error);
