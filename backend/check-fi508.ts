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

  // FI508とFI507（削除済み含む）を取得
  const { data: sellers } = await supabase
    .from('sellers')
    .select('seller_number, name, address, phone_number, property_address, comments, inquiry_detailed_datetime, created_at, deleted_at')
    .in('seller_number', ['FI508', 'FI507']);

  for (const s of sellers ?? []) {
    const name = s.name ? (() => { try { return decrypt(s.name); } catch { return s.name; } })() : '';
    const address = s.address ? (() => { try { return decrypt(s.address); } catch { return s.address; } })() : '';
    console.log(`\n=== ${s.seller_number} ===`);
    console.log(`名前: ${name}`);
    console.log(`売主住所: ${address}`);
    console.log(`物件住所: ${s.property_address}`);
    console.log(`コメント: ${s.comments?.substring(0, 200)}`);
    console.log(`反響日時: ${s.inquiry_detailed_datetime}`);
    console.log(`登録日時: ${s.created_at}`);
    console.log(`削除日時: ${s.deleted_at}`);
  }
}

main().catch(console.error);
