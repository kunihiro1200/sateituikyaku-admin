import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllIncompleteProperties() {
  console.log('=== 全ての未完了物件を確認 ===\n');

  // confirmation = '未' の物件を全て取得
  const { data: incompleteProperties, error } = await supabase
    .from('property_listings')
    .select('property_number, confirmation, sales_assignee, address, display_address')
    .eq('confirmation', '未')
    .order('property_number');

  if (error) {
    console.error('エラー:', error);
    return;
  }

  console.log(`未完了物件数: ${incompleteProperties?.length || 0}\n`);

  if (incompleteProperties && incompleteProperties.length > 0) {
    console.log('未完了物件一覧:');
    incompleteProperties.forEach((property, index) => {
      console.log(`${index + 1}. ${property.property_number}`);
      console.log(`   confirmation: ${property.confirmation}`);
      console.log(`   担当: ${property.sales_assignee || '未設定'}`);
      console.log(`   住所: ${property.address || property.display_address || '未設定'}`);
      console.log('');
    });
  } else {
    console.log('未完了物件は0件です');
  }
}

checkAllIncompleteProperties().catch(console.error);
