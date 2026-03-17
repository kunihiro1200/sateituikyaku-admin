import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  const { data } = await supabase
    .from('buyers')
    .select('buyer_number, broker_inquiry')
    .not('broker_inquiry', 'is', null);

  const nullStr = data?.filter(b => b.broker_inquiry === 'null') || [];
  console.log(`broker_inquiry が文字列"null"の買主数: ${nullStr.length}`);
  nullStr.slice(0, 10).forEach(b => console.log(` - ${b.buyer_number}: "${b.broker_inquiry}"`));

  const truthy = data?.filter(b => {
    const v = (b.broker_inquiry || '').trim();
    return v && v !== '0' && v.toLowerCase() !== 'false' && v.toLowerCase() !== 'null';
  }) || [];
  console.log(`\n業者問合せと判定される買主数（修正後）: ${truthy.length}`);
  truthy.slice(0, 5).forEach(b => console.log(` - ${b.buyer_number}: "${b.broker_inquiry}"`));
}

check().catch(console.error);
