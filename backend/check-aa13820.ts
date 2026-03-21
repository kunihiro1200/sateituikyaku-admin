import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.production.local' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // sellersテーブルを確認
  const { data: seller } = await supabase
    .from('sellers')
    .select('id, seller_number, property_address')
    .eq('seller_number', 'AA13820')
    .single();

  console.log('=== sellers テーブル ===');
  console.log('seller_number:', seller?.seller_number);
  console.log('property_address:', JSON.stringify(seller?.property_address));
  console.log('seller.id:', seller?.id);

  if (!seller?.id) return;

  // propertiesテーブルを確認
  const { data: props } = await supabase
    .from('properties')
    .select('id, seller_id, property_address, address')
    .eq('seller_id', seller.id);

  console.log('\n=== properties テーブル ===');
  if (!props || props.length === 0) {
    console.log('propertiesレコードなし');
  } else {
    props.forEach(p => {
      console.log('property.id:', p.id);
      console.log('property.property_address:', JSON.stringify(p.property_address));
      console.log('property.address:', JSON.stringify((p as any).address));
    });
  }

  // AA13820以降で property_address が '未入力' の件数を sellers で確認
  const { data: unnyuryoku } = await supabase
    .from('sellers')
    .select('seller_number, property_address')
    .eq('property_address', '未入力')
    .order('seller_number', { ascending: true });

  console.log('\n=== sellers.property_address = "未入力" の件数 ===');
  console.log('件数:', unnyuryoku?.length ?? 0);

  // propertiesテーブルで property_address が '未入力' の件数
  const { data: propUnnyuryoku } = await supabase
    .from('properties')
    .select('id, seller_id, property_address')
    .eq('property_address', '未入力');

  console.log('\n=== properties.property_address = "未入力" の件数 ===');
  console.log('件数:', propUnnyuryoku?.length ?? 0);
  if (propUnnyuryoku && propUnnyuryoku.length > 0) {
    console.log('最初の5件:');
    propUnnyuryoku.slice(0, 5).forEach(p => {
      console.log(`  seller_id=${p.seller_id}, property_address=${JSON.stringify(p.property_address)}`);
    });
  }
}

check();
