const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://krxhrbtlgfjzsseegaqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
);

async function main() {
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_date, visit_assignee, assigned_to')
    .gte('visit_date', '2026-03-01')
    .lte('visit_date', '2026-03-31')
    .is('deleted_at', null)
    .order('visit_date');

  if (error) { console.error(error); return; }
  
  console.log(`2026年3月 visit_date あり: ${data?.length}件\n`);
  
  // 担当ごとに集計
  const counts = {};
  for (const s of data || []) {
    const assignee = s.visit_assignee || s.assigned_to || '未設定';
    counts[assignee] = (counts[assignee] || 0) + 1;
  }
  
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log('【担当ごとの訪問数】');
  for (const [name, count] of sorted) {
    console.log(`  ${name}: ${count}件`);
  }
  
  console.log('\n【詳細】');
  for (const s of data || []) {
    console.log(`  ${s.seller_number} ${s.visit_date} assignee:${s.visit_assignee || '-'} assigned_to:${s.assigned_to || '-'}`);
  }
}

main().catch(console.error);
