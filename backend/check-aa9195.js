const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://krxhrbtlgfjzsseegaqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
);

supabase
  .from('work_tasks')
  .select('property_number,cw_request_email_site,site_registration_requestor,cw_request_email_floor_plan,floor_plan_ok_sent,floor_plan_stored_email,email_distribution')
  .eq('property_number', 'AA9195')
  .single()
  .then(({ data, error }) => {
    if (error) console.log('ERROR:', JSON.stringify(error));
    else console.log('DATA:', JSON.stringify(data, null, 2));
  });
