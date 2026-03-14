import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 最近の買主を確認
  const { data: buyers } = await supabase
    .from('buyers')
    .select('buyer_number, property_number, follow_up_assignee, name')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('最近の買主:');
  buyers?.forEach(b => {
    console.log(`  buyer_number=${b.buyer_number}, property_number=${b.property_number}, follow_up_assignee=${b.follow_up_assignee}, name=${b.name}`);
  });

  // property_listings の sales_assignee の値の種類を確認
  const { data: listings } = await supabase
    .from('property_listings')
    .select('sales_assignee')
    .not('sales_assignee', 'is', null)
    .limit(20);

  const uniqueAssignees = [...new Set(listings?.map(l => l.sales_assignee))];
  console.log('\nproperty_listings.sales_assignee の値一覧:');
  uniqueAssignees.forEach(a => console.log(`  "${a}"`));
}

main().catch(console.error);
