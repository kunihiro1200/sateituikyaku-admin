import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // buyers テーブルの buyer_number カラムの型を確認（数値型 vs 文字列型）
  const { data: raw } = await supabase
    .from('buyers')
    .select('buyer_number, property_number')
    .eq('buyer_number', 6955)  // 数値で検索
    .single();

  console.log('数値6955で検索した結果:');
  console.log('  buyer_number:', raw?.buyer_number, '(型:', typeof raw?.buyer_number, ')');
  console.log('  property_number:', raw?.property_number);

  // buyer_id カラムも確認
  const { data: raw2 } = await supabase
    .from('buyers')
    .select('buyer_id, buyer_number, property_number')
    .eq('buyer_number', 6955)
    .single();

  console.log('\nbuyer_id も含めた結果:');
  console.log('  buyer_id:', raw2?.buyer_id);
  console.log('  buyer_number:', raw2?.buyer_number);
  console.log('  property_number:', raw2?.property_number);

  // getLinkedProperties は buyer_id（UUID）で呼ばれる可能性がある
  // BuyerDetailPage は buyer_number（数値文字列）でAPIを呼ぶ
  // バックエンドの /:id/properties は id をそのまま getLinkedProperties に渡す
  // getLinkedProperties は UUID判定 → 数値なら getByBuyerNumber を呼ぶ
  // getByBuyerNumber は .eq('buyer_number', buyerNumber) で検索
  // buyer_number カラムが数値型なら文字列"6955"でも一致するはず

  // 実際に buyer_id で getLinkedProperties と同じロジックを試す
  if (raw2?.buyer_id) {
    console.log('\n--- buyer_id で検索 ---');
    const { data: byId } = await supabase
      .from('buyers')
      .select('buyer_number, property_number')
      .eq('buyer_id', raw2.buyer_id)
      .single();
    console.log('buyer_id で取得:', byId?.buyer_number, byId?.property_number);
  }
}

main().catch(console.error);
