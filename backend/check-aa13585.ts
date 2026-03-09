import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data } = await supabase.from('sellers').select('seller_number, deleted_at, status, contract_year_month, updated_at, created_at').eq('seller_number', 'AA13585').single();
  console.log(JSON.stringify(data, null, 2));
}
main().catch(console.error);
