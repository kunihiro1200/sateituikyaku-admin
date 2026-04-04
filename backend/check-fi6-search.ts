import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFI6Search() {
  console.log('🔍 FI6検索テスト開始...\n');

  // 1. データベースに存在するか確認（完全一致）
  console.log('1️⃣ データベース存在確認（完全一致）:');
  const { data: exactMatch, error: exactError } = await supabase
    .from('sellers')
    .select('seller_number, name, created_at')
    .eq('seller_number', 'FI00006')
    .is('deleted_at', null);

  if (exactError) {
    console.error('❌ エラー:', exactError.message);
  } else if (exactMatch && exactMatch.length > 0) {
    console.log('✅ FI00006が見つかりました:');
    console.log(JSON.stringify(exactMatch, null, 2));
  } else {
    console.log('❌ FI00006が見つかりません');
  }

  // 2. FI6で前方一致検索
  console.log('\n2️⃣ FI6で前方一致検索:');
  const { data: prefixMatch, error: prefixError } = await supabase
    .from('sellers')
    .select('seller_number, name, created_at')
    .ilike('seller_number', 'FI6%')
    .is('deleted_at', null);

  if (prefixError) {
    console.error('❌ エラー:', prefixError.message);
  } else if (prefixMatch && prefixMatch.length > 0) {
    console.log(`✅ ${prefixMatch.length}件見つかりました:`);
    console.log(JSON.stringify(prefixMatch, null, 2));
  } else {
    console.log('❌ FI6で始まる売主が見つかりません');
  }

  // 3. FI00006で前方一致検索
  console.log('\n3️⃣ FI00006で前方一致検索:');
  const { data: paddedMatch, error: paddedError } = await supabase
    .from('sellers')
    .select('seller_number, name, created_at')
    .ilike('seller_number', 'FI00006%')
    .is('deleted_at', null);

  if (paddedError) {
    console.error('❌ エラー:', paddedError.message);
  } else if (paddedMatch && paddedMatch.length > 0) {
    console.log(`✅ ${paddedMatch.length}件見つかりました:`);
    console.log(JSON.stringify(paddedMatch, null, 2));
  } else {
    console.log('❌ FI00006で始まる売主が見つかりません');
  }

  // 4. FIプレフィックスの全売主を検索
  console.log('\n4️⃣ FIプレフィックスの全売主:');
  const { data: allFI, error: allFIError } = await supabase
    .from('sellers')
    .select('seller_number, name, created_at')
    .ilike('seller_number', 'FI%')
    .is('deleted_at', null)
    .order('seller_number', { ascending: true });

  if (allFIError) {
    console.error('❌ エラー:', allFIError.message);
  } else if (allFI && allFI.length > 0) {
    console.log(`✅ ${allFI.length}件見つかりました:`);
    console.log(JSON.stringify(allFI, null, 2));
  } else {
    console.log('❌ FIプレフィックスの売主が見つかりません');
  }

  console.log('\n✅ テスト完了');
}

checkFI6Search().catch(console.error);
