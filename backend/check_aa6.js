const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://krxhrbtlgfjzsseegaqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
);

async function main() {
  // AA6を検索（deleted_atも含めて）
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, status, deleted_at, visit_date, visit_assignee')
    .like('seller_number', 'AA6%')
    .order('seller_number');

  if (error) { console.error(error); return; }
  console.log('AA6系の売主:');
  for (const s of data || []) {
    console.log(`  ${s.seller_number} status:${s.status} deleted_at:${s.deleted_at || 'null'} visit_date:${s.visit_date || 'null'}`);
  }
  
  // 今月のvisit_date統計も確認
  const { data: stats, error: e2 } = await supabase
    .from('sellers')
    .select('seller_number, visit_date, visit_assignee')
    .gte('visit_date', '2026-03-01')
    .lte('visit_date', '2026-03-31')
    .is('deleted_at', null);
  
  console.log('\n2026年3月 visit_date あり:', stats?.length, '件');
  const counts = {};
  for (const s of stats || []) {
    const a = s.visit_assignee || '未設定';
    counts[a] = (counts[a] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sorted) {
    console.log(`  ${name}: ${count}件`);
  }
}

main().catch(console.error);
