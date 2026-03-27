import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );
  const { data, error } = await supabase.from('seller_sidebar_counts').select('*').limit(3);
  console.log('columns:', data ? Object.keys(data[0] || {}) : 'no data');
  console.log('error:', error);
  console.log('sample:', data);
}
main().catch(console.error);
