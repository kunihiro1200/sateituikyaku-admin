import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // 買主番号6955を検索
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, name, property_number')
    .eq('buyer_number', '6955')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('買主データ:');
  console.log('  buyer_number:', data?.buyer_number);
  console.log('  name:', data?.name);
  console.log('  property_number:', data?.property_number);

  // AA2408が property_listings に存在するか確認
  const { data: prop, error: propError } = await supabase
    .from('property_listings')
    .select('property_number, address')
    .eq('property_number', 'AA2408')
    .single();

  if (propError) {
    console.log('\nAA2408 は property_listings に存在しません:', propError.message);
  } else {
    console.log('\nAA2408 の物件データ:');
    console.log('  property_number:', prop?.property_number);
    console.log('  address:', prop?.address);
  }

  // BuyerService.getLinkedProperties と同じロジックを再現
  console.log('\n--- getLinkedProperties ロジック再現 ---');
  const buyerData = data;
  if (!buyerData?.property_number) {
    console.log('property_number が空のため空配列を返す');
  } else {
    const propertyNumbers = buyerData.property_number
      .split(',')
      .map((n: string) => n.trim())
      .filter((n: string) => n);
    console.log('分割後の物件番号:', propertyNumbers);

    const { data: linked, error: linkedError } = await supabase
      .from('property_listings')
      .select('property_number, address')
      .in('property_number', propertyNumbers);

    if (linkedError) {
      console.log('エラー:', linkedError.message);
    } else {
      console.log('取得できた物件数:', linked?.length);
      linked?.forEach(p => console.log(' ', p.property_number, p.address));
    }
  }

  // buyers テーブルの buyer_number カラムの型を確認
  console.log('\n--- buyer_number の型確認 ---');
  console.log('buyer_number の値:', JSON.stringify(buyerData?.buyer_number));
  console.log('buyer_number の型:', typeof buyerData?.buyer_number);
}

main().catch(console.error);
