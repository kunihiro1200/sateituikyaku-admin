import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// backend/.env を読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSidebarCountsTable() {
  console.log('🔍 Checking seller_sidebar_counts table...\n');

  const { data, error } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .order('category', { ascending: true });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️ seller_sidebar_counts table is EMPTY');
    console.log('\n📝 This table should be populated by GAS (Google Apps Script)');
    console.log('   Check if GAS trigger is running every 10 minutes');
    return;
  }

  console.log(`✅ Found ${data.length} rows in seller_sidebar_counts:\n`);

  // Group by category
  const byCategory = data.reduce((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row);
    return acc;
  }, {} as Record<string, any[]>);

  for (const [category, rows] of Object.entries(byCategory)) {
    console.log(`📊 ${category}:`);
    for (const row of rows) {
      const parts = [
        `  count: ${row.count}`,
        row.label ? `label: "${row.label}"` : null,
        row.assignee ? `assignee: "${row.assignee}"` : null,
      ].filter(Boolean);
      console.log(`  - ${parts.join(', ')}`);
    }
    console.log('');
  }

  // Check for new categories
  const expectedCategories = [
    'exclusive',
    'general',
    'visitOtherDecision',
  ];

  const foundCategories = Object.keys(byCategory);
  const missingCategories = expectedCategories.filter(c => !foundCategories.includes(c));

  if (missingCategories.length > 0) {
    console.log('⚠️ Missing categories:');
    for (const cat of missingCategories) {
      console.log(`  - ${cat}`);
    }
    console.log('\n📝 These categories should be added to GAS script');
  } else {
    console.log('✅ All expected categories found!');
  }
}

checkSidebarCountsTable().catch(console.error);
