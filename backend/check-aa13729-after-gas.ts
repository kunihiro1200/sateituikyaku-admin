import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://krxhrbtlgfjzsseegaqq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAA13729() {
  console.log('=== AA13729のデータベース状態確認 ===\n');

  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_date, visit_assignee')
    .eq('seller_number', 'AA13729')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log('✅ データベースの状態:');
  console.log('  売主番号:', data.seller_number);
  console.log('  visit_date:', data.visit_date);
  console.log('  visit_date型:', typeof data.visit_date);
  console.log('  営担:', data.visit_assignee);
  console.log('');

  if (data.visit_date) {
    const visitDate = new Date(data.visit_date);
    console.log('📅 日付解析:');
    console.log('  年:', visitDate.getFullYear());
    console.log('  月:', visitDate.getMonth() + 1);
    console.log('  日:', visitDate.getDate());
    console.log('  時:', visitDate.getHours());
    console.log('  分:', visitDate.getMinutes());
    console.log('');

    if (visitDate.getHours() === 0 && visitDate.getMinutes() === 0) {
      console.log('⚠️ 時刻が00:00 → 時刻情報が失われています');
    } else {
      console.log('✅ 時刻情報あり');
    }
  } else {
    console.log('❌ visit_dateがnull');
  }
}

checkAA13729();
