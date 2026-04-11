import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .env を読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Connected to database');

  // 現在のカラム型を確認
  const before = await client.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'work_tasks' AND column_name = 'site_registration_due_date';
  `);
  console.log('Before migration:', before.rows);

  // migration 112 を適用
  const sql = fs.readFileSync(
    path.join(__dirname, 'migrations', '112_change_site_registration_due_date_to_timestamptz.sql'),
    'utf-8'
  );
  await client.query(sql);
  console.log('✅ Migration 112 applied');

  // 変更後のカラム型を確認
  const after = await client.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'work_tasks' AND column_name = 'site_registration_due_date';
  `);
  console.log('After migration:', after.rows);

  await client.end();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
