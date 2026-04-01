import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

async function testSidebarCountsAPI() {
  console.log('🧪 Testing getSidebarCounts API...\n');

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // seller_sidebar_counts テーブルから全行取得
    const { data, error } = await supabase
      .from('seller_sidebar_counts')
      .select('category, count, label, assignee');

    if (error) {
      console.error('❌ Query failed:', error);
      return;
    }

    console.log(`✅ Found ${data.length} records\n`);

    // カテゴリ別に集計
    const result = {
      todayCall: 0,
      todayCallWithInfo: 0,
      todayCallAssigned: 0,
      visitDayBefore: 0,
      visitCompleted: 0,
      unvaluated: 0,
      mailingPending: 0,
      todayCallNotStarted: 0,
      pinrichEmpty: 0,
      exclusive: 0,
      general: 0,
      visitOtherDecision: 0,
      unvisitedOtherDecision: 0,
      visitAssignedCounts: {} as Record<string, number>,
      todayCallAssignedCounts: {} as Record<string, number>,
      todayCallWithInfoLabels: [] as string[],
      todayCallWithInfoLabelCounts: {} as Record<string, number>,
    };

    for (const row of data) {
      const count = row.count || 0;
      switch (row.category) {
        case 'todayCall':         result.todayCall = count; break;
        case 'visitDayBefore':    result.visitDayBefore = count; break;
        case 'visitCompleted':    result.visitCompleted += count; break;
        case 'unvaluated':        result.unvaluated = count; break;
        case 'mailingPending':    result.mailingPending = count; break;
        case 'todayCallNotStarted': result.todayCallNotStarted = count; break;
        case 'pinrichEmpty':      result.pinrichEmpty = count; break;
        case 'exclusive':         result.exclusive = count; break;
        case 'general':           result.general = count; break;
        case 'visitOtherDecision': result.visitOtherDecision = count; break;
        case 'unvisitedOtherDecision': result.unvisitedOtherDecision = count; break;
        case 'todayCallAssigned':
          result.todayCallAssigned += count;
          if (row.assignee) result.todayCallAssignedCounts[row.assignee] = count;
          break;
        case 'visitAssigned':
          if (row.assignee) result.visitAssignedCounts[row.assignee] = count;
          break;
        case 'todayCallWithInfo':
          result.todayCallWithInfo += count;
          if (row.label) {
            const fullLabel = `当日TEL(${row.label})`;
            result.todayCallWithInfoLabelCounts[fullLabel] = count;
            if (!result.todayCallWithInfoLabels.includes(fullLabel)) {
              result.todayCallWithInfoLabels.push(fullLabel);
            }
          }
          break;
      }
    }

    console.log('✅ Result:\n');
    console.log(JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.error('❌ Test failed:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
}

testSidebarCountsAPI();
