import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyer5641() {
  console.log('🔍 Checking buyer 5641 in database...\n');

  // 1. buyer_numberで検索
  console.log('1️⃣ Searching by buyer_number = "5641"...');
  const { data: byNumber, error: errorByNumber } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '5641')
    .single();

  if (errorByNumber) {
    console.log('❌ Error:', errorByNumber.message);
    console.log('   Code:', errorByNumber.code);
  } else if (byNumber) {
    console.log('✅ Found buyer by buyer_number:');
    console.log('   buyer_id:', byNumber.buyer_id);
    console.log('   buyer_number:', byNumber.buyer_number);
    console.log('   next_call_date:', byNumber.next_call_date);
    console.log('   follow_up_assignee:', byNumber.follow_up_assignee);
    console.log('   deleted_at:', byNumber.deleted_at);
  } else {
    console.log('❌ No buyer found with buyer_number = "5641"');
  }

  console.log('\n2️⃣ Searching by buyer_id (if exists)...');
  if (byNumber?.buyer_id) {
    const { data: byId, error: errorById } = await supabase
      .from('buyers')
      .select('*')
      .eq('buyer_id', byNumber.buyer_id)
      .single();

    if (errorById) {
      console.log('❌ Error:', errorById.message);
    } else if (byId) {
      console.log('✅ Found buyer by buyer_id:');
      console.log('   buyer_id:', byId.buyer_id);
      console.log('   buyer_number:', byId.buyer_number);
    }
  }

  console.log('\n3️⃣ Checking all buyers with buyer_number containing "5641"...');
  const { data: allMatches, error: errorAll } = await supabase
    .from('buyers')
    .select('buyer_id, buyer_number, next_call_date, follow_up_assignee, deleted_at')
    .ilike('buyer_number', '%5641%');

  if (errorAll) {
    console.log('❌ Error:', errorAll.message);
  } else if (allMatches && allMatches.length > 0) {
    console.log(`✅ Found ${allMatches.length} buyer(s):`);
    allMatches.forEach((buyer, index) => {
      console.log(`   ${index + 1}. buyer_number: "${buyer.buyer_number}", buyer_id: ${buyer.buyer_id}`);
      console.log(`      next_call_date: ${buyer.next_call_date}, follow_up_assignee: ${buyer.follow_up_assignee}`);
      console.log(`      deleted_at: ${buyer.deleted_at}`);
    });
  } else {
    console.log('❌ No buyers found');
  }

  console.log('\n4️⃣ Checking table schema...');
  const { data: schema, error: schemaError } = await supabase
    .from('buyers')
    .select('*')
    .limit(1);

  if (schema && schema.length > 0) {
    console.log('✅ Table columns:', Object.keys(schema[0]).join(', '));
  }
}

checkBuyer5641().catch(console.error);
