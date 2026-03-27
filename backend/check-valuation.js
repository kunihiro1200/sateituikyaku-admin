const { createClient } = require('@supabase/supabase-js');

const url = 'https://krxhrbtlgfjzsseegaqq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

const supabase = createClient(url, key);

supabase
  .from('sellers')
  .select('seller_number, valuation_amount_1, valuation_amount_2, valuation_amount_3')
  .eq('seller_number', 'AA13863')
  .single()
  .then(({ data, error }) => {
    console.log('data:', JSON.stringify(data, null, 2));
    if (error) console.log('error:', JSON.stringify(error));
  });
