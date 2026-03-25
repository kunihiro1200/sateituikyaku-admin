import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://krxhrbtlgfjzsseegaqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
);

async function main() {
  // 現在の値を確認
  const { data: before } = await supabase
    .from('buyers')
    .select('buyer_number, vendor_survey')
    .eq('buyer_number', '7092')
    .single();
  console.log('Before:', before);

  // vendor_survey を「確認済み」に更新
  const { data, error } = await supabase
    .from('buyers')
    .update({ vendor_survey: '確認済み' })
    .eq('buyer_number', '7092')
    .select('buyer_number, vendor_survey')
    .single();

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Updated:', data);
  }
}

main().catch(console.error);
