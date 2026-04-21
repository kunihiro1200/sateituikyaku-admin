import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.krxhrbtlgfjzsseegaqq:CIWxQGSf74lks01H@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Connected to database');

  // corporate_name カラムを追加（EE列「法人名」）
  await client.query(`
    ALTER TABLE buyers ADD COLUMN IF NOT EXISTS corporate_name TEXT;
  `);
  console.log('✅ corporate_name column added to buyers table');

  // 追加されたことを確認
  const result = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'buyers' AND column_name = 'corporate_name';
  `);
  console.log('Column info:', result.rows);

  await client.end();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
