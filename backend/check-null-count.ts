import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { count } = await supabase.from('sellers').select('*', { count: 'exact', head: true }).is('deleted_at', null).is('inquiry_date', null);
  console.log('inquiry_date null count:', count);
  const { data } = await supabase.from('sellers').select('seller_number, inquiry_date').is('deleted_at', null).is('inquiry_date', null).limit(5);
  console.log('sample:', JSON.stringify(data));
}
main().catch(console.error);
