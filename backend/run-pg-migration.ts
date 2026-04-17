import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:CIWxQGSf74lks01H@db.krxhrbtlgfjzsseegaqq.supabase.co:5432/postgres';
console.log('接続先:', connectionString.replace(/:([^:@]+)@/, ':***@'));

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('✅ DB接続成功');

  await client.query('ALTER TABLE buyers ADD COLUMN IF NOT EXISTS pinrich_500man_registration TEXT;');
  console.log('✅ pinrich_500man_registration カラムを追加しました');

  const result = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'buyers' AND column_name = 'pinrich_500man_registration';
  `);
  console.log('カラム情報:', result.rows);

  await client.end();
}

main().catch(e => {
  console.error('❌ エラー:', e.message);
  process.exit(1);
});
