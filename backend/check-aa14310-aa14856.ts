import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  // AA14310の売りたい条件を確認
  const { data: aa14310, error: e1 } = await supabase
    .from('sellers')
    .select('seller_number, property_address, property_type, match_areas, match_property_types, match_updated_at')
    .eq('seller_number', 'AA14310')
    .single();
  
  if (e1) { 
    console.error('AA14310 error:', e1); 
    return; 
  }
  
  console.log('=== AA14310 (売りたい側) ===');
  console.log('物件住所:', aa14310.property_address);
  console.log('物件種別:', aa14310.property_type);
  console.log('match_areas:', JSON.stringify(aa14310.match_areas));
  console.log('match_property_types:', JSON.stringify(aa14310.match_property_types));
  console.log('match_updated_at:', aa14310.match_updated_at);
  
  console.log('');
  
  // AA14856の買いたい条件を確認
  const { data: aa14856, error: e2 } = await supabase
    .from('sellers')
    .select('seller_number, buy_match_areas, buy_match_property_types, buy_match_updated_at')
    .eq('seller_number', 'AA14856')
    .single();
  
  if (e2) { 
    console.error('AA14856 error:', e2); 
    return; 
  }
  
  console.log('=== AA14856 (買いたい側) ===');
  console.log('buy_match_areas:', JSON.stringify(aa14856.buy_match_areas));
  console.log('buy_match_property_types:', JSON.stringify(aa14856.buy_match_property_types));
  console.log('buy_match_updated_at:', aa14856.buy_match_updated_at);
  
  // エリアの重複をチェック
  console.log('');
  console.log('=== マッチング判定 ===');
  
  const aa14310Areas = aa14310.match_areas || [];
  const aa14856Areas = aa14856.buy_match_areas || [];
  
  console.log('AA14310のエリア:', aa14310Areas);
  console.log('AA14856のエリア:', aa14856Areas);
  
  const overlap = aa14310Areas.filter((a: string) => aa14856Areas.includes(a));
  console.log('重複エリア:', overlap);
  
  const aa14310Types = aa14310.match_property_types || [];
  const aa14856Types = aa14856.buy_match_property_types || [];
  
  console.log('AA14310の種別:', aa14310Types);
  console.log('AA14856の種別:', aa14856Types);
  
  const typeOverlap = aa14310Types.filter((t: string) => aa14856Types.includes(t));
  console.log('重複種別:', typeOverlap);
  
  if (overlap.length > 0 && typeOverlap.length > 0) {
    console.log('✅ マッチングする！');
  } else {
    console.log('❌ マッチングしない');
    if (overlap.length === 0) console.log('  理由: エリアが一致しない');
    if (typeOverlap.length === 0) console.log('  理由: 種別が一致しない');
  }
})();
