import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://krxhrbtlgfjzsseegaqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
);

async function main() {
  // Supabase の rpc で SQL を実行
  const { data, error } = await supabase.rpc('exec_ddl', {
    sql: 'ALTER TABLE activity_logs ALTER COLUMN employee_id DROP NOT NULL;'
  });

  if (error) {
    console.error('RPC error:', error.message);
    
    // フォールバック: activity_logs に null で直接 insert テスト
    console.log('\nTesting direct insert with null employee_id...');
    const { data: insertData, error: insertError } = await supabase
      .from('activity_logs')
      .insert({
        employee_id: null,
        action: 'sms_test',
        target_type: 'buyer',
        target_id: 'test',
        metadata: { test: true },
      })
      .select();
    
    if (insertError) {
      console.error('Insert test failed:', insertError.message);
      console.log('\n⚠️  employee_id は NOT NULL のままです。');
      console.log('Supabase ダッシュボードの SQL Editor で以下を実行してください:');
      console.log('ALTER TABLE activity_logs ALTER COLUMN employee_id DROP NOT NULL;');
    } else {
      console.log('✅ Insert with null employee_id succeeded! Column is already nullable.');
      // テストレコードを削除
      await supabase.from('activity_logs').delete().eq('action', 'sms_test').eq('target_id', 'test');
      console.log('Test record cleaned up.');
    }
  } else {
    console.log('✅ Migration applied successfully:', data);
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
