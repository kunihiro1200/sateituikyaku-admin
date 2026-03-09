import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { error } = await supabase.from('sellers').update({ deleted_at: new Date().toISOString() }).eq('seller_number', 'AA13585');
  if (error) console.error('Error:', error.message);
  else console.log('AA13585 deleted successfully');
}
main().catch(console.error);
