import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:CIWxQGSf74lks01H@db.krxhrbtlgfjzsseegaqq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Connected to database');

  // employee_id を nullable に変更
  await client.query(`
    ALTER TABLE activity_logs
      ALTER COLUMN employee_id DROP NOT NULL;
  `);
  console.log('✅ employee_id is now nullable');

  // 現在の定義を確認
  const result = await client.query(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'employee_id';
  `);
  console.log('Column info:', result.rows);

  await client.end();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
