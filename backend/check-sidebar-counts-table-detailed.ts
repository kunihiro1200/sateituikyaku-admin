import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSidebarCountsTable() {
  console.log('🔍 Checking seller_sidebar_counts table...\n');

  try {
    // 全レコードを取得
    const { data, error } = await supabase
      .from('seller_sidebar_counts')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.error('❌ Error fetching data:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  seller_sidebar_counts table is EMPTY');
      console.log('');
      console.log('📝 This is the root cause of the sidebar display issue.');
      console.log('');
      console.log('✅ Solution: Run GAS syncSellerList() to populate the table.');
      return;
    }

    console.log(`✅ Found ${data.length} records in seller_sidebar_counts:\n`);

    // カテゴリ別に表示
    const categories = [
      'todayCall',
      'todayCallWithInfo',
      'todayCallAssigned',
      'visitDayBefore',
      'visitCompleted',
      'unvaluated',
      'mailingPending',
      'todayCallNotStarted',
      'pinrichEmpty',
      'exclusive',
      'general',
      'visitOtherDecision',
      'unvisitedOtherDecision',
    ];

    categories.forEach(cat => {
      const records = data.filter(r => r.category === cat);
      if (records.length > 0) {
        const totalCount = records.reduce((sum, r) => sum + (r.count || 0), 0);
        console.log(`  ${cat}: ${totalCount} (${records.length} records)`);
      } else {
        console.log(`  ${cat}: ❌ MISSING`);
      }
    });

    console.log('\n📊 All records:');
    data.forEach(record => {
      console.log(`  - ${record.category} (label: ${record.label || 'null'}, assignee: ${record.assignee || 'null'}): ${record.count}`);
    });

    console.log('\n⏰ Last updated:');
    const latestRecord = data.reduce((latest, r) => {
      if (!latest || new Date(r.updated_at) > new Date(latest.updated_at)) {
        return r;
      }
      return latest;
    }, data[0]);
    console.log(`  ${new Date(latestRecord.updated_at).toLocaleString('ja-JP')}`);

  } catch (e) {
    console.error('❌ Unexpected error:', e);
  }
}

checkSidebarCountsTable();
