import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:CIWxQGSf74lks01H@db.krxhrbtlgfjzsseegaqq.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Connected to database');

  // 1. subject カラムを追加
  await client.query(`
    ALTER TABLE property_chat_history
      ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT '';
  `);
  console.log('✅ subject column added to property_chat_history');

  await client.query(`
    COMMENT ON COLUMN property_chat_history.subject IS '送信履歴の件名（EMAIL/GMAIL: メール件名、SMS: 空文字）';
  `);
  console.log('✅ comment added to subject column');

  // 2. 既存の chat_type CHECK 制約を削除して再作成
  await client.query(`
    ALTER TABLE property_chat_history
      DROP CONSTRAINT IF EXISTS property_chat_history_chat_type_check;
  `);
  console.log('✅ old chat_type check constraint dropped');

  await client.query(`
    ALTER TABLE property_chat_history
      ADD CONSTRAINT property_chat_history_chat_type_check
        CHECK (chat_type IN ('office', 'assignee', 'seller_email', 'seller_sms', 'seller_gmail'));
  `);
  console.log('✅ new chat_type check constraint added (seller_email, seller_sms, seller_gmail)');

  // 3. chat_type カラムへのインデックスを追加
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_property_chat_history_chat_type
      ON property_chat_history(chat_type);
  `);
  console.log('✅ index on chat_type created');

  // 確認
  const colResult = await client.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'property_chat_history' AND column_name = 'subject';
  `);
  console.log('subject column info:', colResult.rows);

  const constraintResult = await client.query(`
    SELECT constraint_name, check_clause
    FROM information_schema.check_constraints
    WHERE constraint_name = 'property_chat_history_chat_type_check';
  `);
  console.log('check constraint info:', constraintResult.rows);

  await client.end();
  console.log('Migration completed successfully!');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
