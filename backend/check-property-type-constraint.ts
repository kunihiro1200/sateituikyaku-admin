import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraint() {
  console.log('🔍 Checking property_type constraint...\n');

  // Try to insert a test property with 'その他'
  const testSellerId = '62cab64e-da56-4819-b228-90413242562a'; // From sample data

  console.log('Testing with property_type = "その他"...');
  const { data: test1, error: error1 } = await supabase
    .from('properties')
    .insert({
      seller_id: testSellerId,
      property_address: 'テスト住所',
      property_type: 'その他',
    })
    .select();

  if (error1) {
    console.log('❌ "その他" is NOT allowed:', error1.message);
  } else {
    console.log('✅ "その他" is allowed');
    // Clean up
    if (test1 && test1[0]) {
      await supabase.from('properties').delete().eq('id', test1[0].id);
    }
  }

  console.log('\nTesting with property_type = "土地"...');
  const { data: test2, error: error2 } = await supabase
    .from('properties')
    .insert({
      seller_id: testSellerId,
      property_address: 'テスト住所2',
      property_type: '土地',
    })
    .select();

  if (error2) {
    console.log('❌ "土地" is NOT allowed:', error2.message);
  } else {
    console.log('✅ "土地" is allowed');
    // Clean up
    if (test2 && test2[0]) {
      await supabase.from('properties').delete().eq('id', test2[0].id);
    }
  }

  console.log('\n🔍 Current constraint allows: 戸建て, 土地, マンション');
  console.log('Migration 082 would add: アパート一棟, その他, 事業用');
}

checkConstraint().catch(console.error);
