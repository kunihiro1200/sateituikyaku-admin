import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  // AA14310のmatch_areasとmatch_property_typesを修正
  const { data, error } = await supabase
    .from('sellers')
    .update({
      match_areas: ['⑮別府'],
      match_property_types: ['マンション'],
      match_updated_at: new Date().toISOString()
    })
    .eq('seller_number', 'AA14310')
    .select()
    .single();
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  console.log('✅ AA14310のマッチング情報を修正しました');
  console.log('match_areas:', data.match_areas);
  console.log('match_property_types:', data.match_property_types);
})();
