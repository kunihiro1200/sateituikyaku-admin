import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// .envファイルを手動で読み込む
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllRows(query: any): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      }
      page++;
    }
  }

  return allRows;
}

async function testListSellers() {
  console.log('Testing listSellers with statusCategory=visitDayBefore...\n');
  
  // 今日の日付（JST）
  const now = new Date();
  const jstOffset = 9 * 60;
  const jstDate = new Date(now.getTime() + jstOffset * 60 * 1000);
  const todayJST = jstDate.toISOString().split('T')[0];
  console.log(`Today (JST): ${todayJST}\n`);
  
  // 訪問日前日の候補を全件取得
  const visitDayBeforeSellers = await fetchAllRows(
    supabase
      .from('sellers')
      .select('id, seller_number, visit_date, visit_assignee, visit_reminder_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .not('visit_date', 'is', null)
  );
  
  console.log(`Total candidates: ${visitDayBeforeSellers.length}\n`);
  
  // JSでフィルタ
  const matchedSellers = visitDayBeforeSellers.filter((s: any) => {
    // visitReminderAssigneeに値がある場合は除外
    const reminderAssignee = s.visit_reminder_assignee || '';
    if (reminderAssignee.trim() !== '') return false;
    
    const vd = s.visit_date;
    if (!vd) return false;
    
    // TIMESTAMP型対応: 日付部分のみを抽出
    const visitDateOnly = vd.split('T')[0].split(' ')[0];
    const parts = visitDateOnly.split('-');
    if (parts.length !== 3) return false;
    
    const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dow = visitDate.getDay();
    const days = dow === 4 ? 2 : 1;
    const notify = new Date(visitDate);
    notify.setDate(visitDate.getDate() - days);
    const notifyStr = `${notify.getFullYear()}-${String(notify.getMonth() + 1).padStart(2, '0')}-${String(notify.getDate()).padStart(2, '0')}`;
    
    return notifyStr === todayJST;
  });
  
  console.log(`Matched sellers: ${matchedSellers.length}`);
  console.log('\nSeller Numbers:');
  matchedSellers.forEach((seller: any) => {
    console.log(`  - ${seller.seller_number} (visitAssignee: ${seller.visit_assignee}, visitDate: ${seller.visit_date})`);
  });
  
  // AA13729とAA10538が含まれているか確認
  const aa13729 = matchedSellers.find((s: any) => s.seller_number === 'AA13729');
  const aa10538 = matchedSellers.find((s: any) => s.seller_number === 'AA10538');
  
  console.log('\n✅ Verification:');
  console.log(`  AA13729: ${aa13729 ? '✅ Found' : '❌ Not found'}`);
  console.log(`  AA10538: ${aa10538 ? '✅ Found' : '❌ Not found'}`);
  
  if (matchedSellers.length === 2 && aa13729 && aa10538) {
    console.log('\n🎉 SUCCESS: Both sellers are correctly counted!');
  } else {
    console.log('\n❌ FAILED: Count mismatch or missing sellers');
  }
}

testListSellers().catch(console.error);
