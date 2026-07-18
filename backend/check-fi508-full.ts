import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.production'), override: true });

const { decrypt } = require('./src/utils/encryption');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data: sellers } = await supabase
    .from('sellers')
    .select('*')
    .in('seller_number', ['FI508', 'FI507']);

  for (const s of sellers ?? []) {
    const name = s.name ? (() => { try { return decrypt(s.name); } catch { return '[復号失敗]'; } })() : '';
    const address = s.address ? (() => { try { return decrypt(s.address); } catch { return s.address; } })() : '';
    console.log(`\n=== ${s.seller_number} ===`);
    console.log(`名前: ${name}`);
    console.log(`売主住所(address): ${JSON.stringify(address)}`);
    console.log(`物件住所(property_address): ${JSON.stringify(s.property_address)}`);
    console.log(`コメント全文:\n${s.comments}`);
    console.log(`---`);
  }
}

main().catch(console.error);
