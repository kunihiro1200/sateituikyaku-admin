import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyerSidebarCountsTable() {
  console.log('📊 buyer_sidebar_counts テーブルの内容を確認中...\n');

  try {
    const { data, error } = await supabase
      .from('buyer_sidebar_counts')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.error('❌ エラー:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️ buyer_sidebar_counts テーブルが空です');
      console.log('   GASの syncBuyerList が実行されていない可能性があります');
      return;
    }

    console.log(`✅ ${data.length}件のレコードが見つかりました:\n`);
    
    // カテゴリ別に表示
    const categories = new Map<string, any[]>();
    data.forEach(row => {
      const category = row.category;
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(row);
    });

    categories.forEach((rows, category) => {
      console.log(`📌 ${category}:`);
      rows.forEach(row => {
        const parts = [`  count: ${row.count}`];
        if (row.label) parts.push(`label: ${row.label}`);
        if (row.assignee) parts.push(`assignee: ${row.assignee}`);
        console.log(`  ${parts.join(', ')}`);
      });
      console.log('');
    });

    // 主要カテゴリの確認
    console.log('🔍 主要カテゴリの確認:');
    const hasViewingDayBefore = data.some(r => r.category === 'viewingDayBefore');
    const hasTodayCall = data.some(r => r.category === 'todayCall');
    const hasAssigned = data.some(r => r.category === 'assigned');
    const hasTodayCallAssigned = data.some(r => r.category === 'todayCallAssigned');

    console.log(`  内覧日前日 (viewingDayBefore): ${hasViewingDayBefore ? '✅' : '❌'}`);
    console.log(`  当日TEL (todayCall): ${hasTodayCall ? '✅' : '❌'}`);
    console.log(`  担当 (assigned): ${hasAssigned ? '✅' : '❌'}`);
    console.log(`  当日TEL担当 (todayCallAssigned): ${hasTodayCallAssigned ? '✅' : '❌'}`);

  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }
}

checkBuyerSidebarCountsTable().catch(console.error);
