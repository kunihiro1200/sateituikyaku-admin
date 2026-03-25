import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:CIWxQGSf74lks01H@db.krxhrbtlgfjzsseegaqq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Connected to database');

  // vendor_survey カラムを buyers テーブルに追加
  await client.query(`
    ALTER TABLE buyers ADD COLUMN IF NOT EXISTS vendor_survey TEXT;
  `);
  console.log('✅ vendor_survey column added to buyers table');

  // カラムの存在を確認
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'buyers' AND column_name = 'vendor_survey';
  `);
  console.log('Column info:', result.rows);

  await client.end();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
