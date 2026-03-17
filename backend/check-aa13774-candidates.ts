// AA13774の買主候補を確認するスクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // AA13774の物件情報を取得
  const { data: property, error } = await supabase
    .from('property_listings')
    .select('property_number, address, property_type, sales_price, distribution_areas')
    .eq('property_number', 'AA13774')
    .single();

  if (error || !property) {
    console.error('物件が見つかりません:', error);
    return;
  }

  console.log('=== AA13774 物件情報 ===');
  console.log('住所:', property.address);
  console.log('種別:', property.property_type);
  console.log('価格:', property.sales_price);
  console.log('配信エリア:', property.distribution_areas);
}

main().catch(console.error);
