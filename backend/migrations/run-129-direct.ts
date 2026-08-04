import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('🚀 マイグレーション129を実行中（直接PostgreSQL接続）: activities.type 制約に fax を追加...\n');

  const client = await pool.connect();

  try {
    const sqlPath = path.join(__dirname, '129_add_fax_activity_type.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📄 SQLを実行中...');
    await client.query(sql);
    console.log('✅ マイグレーションSQL実行完了\n');

    // 検証: 制約定義を確認
    console.log('🔍 検証中...');
    const constraintCheck = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = 'activities_type_check'
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('✅ activities_type_check 制約が確認されました:');
      console.log('  ', constraintCheck.rows[0].definition);
    } else {
      console.log('❌ activities_type_check 制約が見つかりません！');
      process.exit(1);
    }

    console.log('\n📋 実行内容:');
    console.log('  - activities テーブルの type 制約に fax を追加');
    console.log('\n✅ マイグレーション129が正常に完了しました！');

  } catch (error) {
    console.error('❌ マイグレーション失敗:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
