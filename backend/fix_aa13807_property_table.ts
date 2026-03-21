/**
 * AA13807 の properties テーブルの address を修正するスクリプト
 * sellers.property_address の値を properties.address にコピーする
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
  );

  const TARGET = 'AA13807';

  // sellers テーブルから property_address を取得
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id, seller_number, property_address')
    .eq('seller_number', TARGET)
    .single();

  if (sellerError || !seller) {
    console.error('❌ sellers テーブルからの取得エラー:', sellerError?.message);
    return;
  }

  console.log('📋 sellers テーブル:');
  console.log('  id:', seller.id);
  console.log('  property_address:', seller.property_address ?? '(null)');

  // properties テーブルから対応レコードを取得
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('id, seller_id, address')
    .eq('seller_id', seller.id);

  if (propError) {
    console.error('❌ properties テーブルからの取得エラー:', propError.message);
    return;
  }

  console.log('\n📋 properties テーブル:');
  if (!properties || properties.length === 0) {
    console.log('  → レコードなし（properties テーブルに対応レコードが存在しない）');
    console.log('\n✅ sellers.property_address に値があれば、フロントエンドは seller.propertyAddress を使うはず');
    console.log('   → CallModePage の表示ロジックを確認してください');
    return;
  }

  for (const prop of properties) {
    console.log(`  id: ${prop.id}`);
    console.log(`  address: "${prop.address ?? '(null)'}"`);
  }

  // property_address の値を properties.address にコピー
  if (seller.property_address && seller.property_address.trim() !== '') {
    for (const prop of properties) {
      if (!prop.address || prop.address.trim() === '' || prop.address === '未入力') {
        console.log(`\n✅ properties.address が空 → sellers.property_address の値をコピーします`);
        const { error: updateError } = await supabase
          .from('properties')
          .update({ address: seller.property_address.trim() })
          .eq('id', prop.id);

        if (updateError) {
          console.error('❌ properties 更新エラー:', updateError.message);
        } else {
          console.log(`✅ properties.address を "${seller.property_address.trim()}" に更新しました`);
        }
      } else {
        console.log(`\nℹ️  properties.address は既に "${prop.address}" が設定されています`);
        console.log('   → 上書きしません');
      }
    }
  } else {
    console.log('\n⚠️  sellers.property_address が空です');
    console.log('   → スプレッドシートの「物件所在地」列に値を入力してください');
  }

  // AA6 のコメントも確認
  console.log('\n' + '='.repeat(60));
  console.log('【AA6】コメントの確認');
  console.log('='.repeat(60));

  const { data: seller6, error: seller6Error } = await supabase
    .from('sellers')
    .select('id, seller_number, comments')
    .eq('seller_number', 'AA6')
    .single();

  if (seller6Error || !seller6) {
    console.error('❌ AA6 取得エラー:', seller6Error?.message);
    return;
  }

  console.log('DBのコメント（先頭200文字）:');
  console.log('"' + (seller6.comments || '').substring(0, 200) + '"');
  console.log('\n→ ブラウザで AA6 の通話モードページを開いてコメントが表示されているか確認してください');
  console.log('  URL: /sellers/<AA6のID>/call');
}

main().catch(console.error);
