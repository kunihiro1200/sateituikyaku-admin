import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

async function main() {
  console.log('Applying migration 112 via Supabase REST API...');

  // カラム型変更SQL
  const sql = `
    ALTER TABLE work_tasks
      ALTER COLUMN site_registration_due_date TYPE TIMESTAMPTZ
      USING site_registration_due_date::TIMESTAMPTZ;
    COMMENT ON COLUMN work_tasks.site_registration_due_date IS 'サイト登録納期予定日（タイムスタンプ）';
  `;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Migration failed:', error);
    // exec_sql RPCが存在しない場合は別の方法を試す
    console.log('Trying alternative approach...');
    await tryAlternative();
    return;
  }

  const result = await response.json();
  console.log('✅ Migration 112 applied successfully:', result);

  // 確認
  await verifyMigration();
}

async function tryAlternative() {
  // Supabase Management API を使用
  const sql = `ALTER TABLE work_tasks ALTER COLUMN site_registration_due_date TYPE TIMESTAMPTZ USING site_registration_due_date::TIMESTAMPTZ;`;
  
  console.log('Please run the following SQL in Supabase SQL Editor:');
  console.log('---');
  console.log(sql);
  console.log('---');
  console.log('URL: https://supabase.com/dashboard/project/krxhrbtlgfjzsseegaqq/sql/new');
}

async function verifyMigration() {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/work_tasks?select=site_registration_due_date&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  
  if (response.ok) {
    console.log('✅ Verification: work_tasks table accessible');
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
