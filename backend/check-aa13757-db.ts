import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data } = await supabase.from('sellers').select('seller_number, inquiry_date, inquiry_year').eq('seller_number', 'AA13757').single();
  console.log(JSON.stringify(data));
}
main().catch(console.error);
