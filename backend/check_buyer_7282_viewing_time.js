const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://krxhrbtlgfjzsseegaqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
);

async function checkBuyer7282ViewingTime() {
  console.log('🔍 買主7282のviewing_timeを確認中...\n');
  
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, viewing_date, viewing_time')
    .eq('buyer_number', '7282')
    .single();
  
  if (error) {
    console.error('❌ エラー:', error);
    return;
  }
  
  console.log('✅ データベースの値:');
  console.log('  buyer_number:', data.buyer_number);
  console.log('  viewing_date:', data.viewing_date);
  console.log('  viewing_time:', data.viewing_time);
  console.log('  viewing_timeの型:', typeof data.viewing_time);
  
  // viewing_timeが日付型の場合、詳細を表示
  if (data.viewing_time) {
    console.log('\n📊 viewing_timeの詳細:');
    console.log('  文字列表現:', String(data.viewing_time));
    console.log('  長さ:', String(data.viewing_time).length);
    console.log('  最初の10文字:', String(data.viewing_time).substring(0, 10));
    
    // ISO形式かチェック
    if (String(data.viewing_time).includes('T')) {
      console.log('  ⚠️ ISO日付形式で保存されています（間違い）');
    } else if (String(data.viewing_time).includes(':')) {
      console.log('  ✅ 時刻形式で保存されています（正しい）');
    }
  }
}

checkBuyer7282ViewingTime();
