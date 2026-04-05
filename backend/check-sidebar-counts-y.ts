import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 環境変数を読み込む
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSidebarCountsY() {
  console.log('🔍 [DEBUG] Checking buyer_sidebar_counts table for todayCallAssigned:Y...\n');
  
  const { data: counts, error } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'todayCallAssigned')
    .eq('assignee', 'Y');
  
  if (error) {
    console.error('❌ Error fetching sidebar counts:', error);
    return;
  }
  
  console.log('✅ Sidebar counts for todayCallAssigned:Y:');
  console.log(JSON.stringify(counts, null, 2));
  
  // Also check the actual buyers
  const today = new Date().toISOString().split('T')[0];
  const { data: buyers, error: buyersError } = await supabase
    .from('buyers')
    .select('buyer_number, follow_up_assignee, next_call_date, viewing_date')
    .eq('follow_up_assignee', 'Y')
    .lte('next_call_date', today);
  
  if (buyersError) {
    console.error('❌ Error fetching buyers:', buyersError);
    return;
  }
  
  console.log(`\n✅ Actual buyers with follow_up_assignee=Y and next_call_date<=today: ${buyers?.length || 0}`);
  console.log(JSON.stringify(buyers, null, 2));
}

checkSidebarCountsY().catch(console.error);
