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
  console.log('🚀 マイグレーション114を実行中（直接PostgreSQL接続）: buyers テーブルに viewing_mobile カラムを追加...\n');

  const client = await pool.connect();

  try {
    const sqlPath = path.join(__dirname, '114_add_viewing_mobile_to_buyers.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📄 SQLを実行中...');
    await client.query(sql);
    console.log('✅ マイグレーションSQL実行完了\n');

    // 検証: viewing_mobile カラムが存在するか確認
    console.log('🔍 検証中...');
    const columnCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'buyers'
        AND column_name = 'viewing_mobile'
    `);

    if (columnCheck.rows.length > 0) {
      console.log('✅ viewing_mobile カラムが確認されました:', columnCheck.rows[0]);
    } else {
      console.log('❌ viewing_mobile カラムが見つかりません！');
      process.exit(1);
    }

    // データ移行の確認
    const dataCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM buyers
      WHERE viewing_mobile IS NOT NULL
    `);
    console.log(`✅ viewing_mobile にデータがある行数: ${dataCheck.rows[0].count}`);

    // サンプルデータ確認
    const sampleData = await client.query(`
      SELECT buyer_number, viewing_type, viewing_mobile
      FROM buyers
      WHERE viewing_type IS NOT NULL
      LIMIT 5
    `);
    if (sampleData.rows.length > 0) {
      console.log('\n📊 サンプルデータ（viewing_type → viewing_mobile）:');
      sampleData.rows.forEach((row: any) => {
        console.log(`  buyer_number=${row.buyer_number}: viewing_type="${row.viewing_type}" → viewing_mobile="${row.viewing_mobile}"`);
      });
    }

    console.log('\n📋 実行内容:');
    console.log('  - buyers テーブルに viewing_mobile TEXT カラムを追加');
    console.log('  - viewing_type の既存データを viewing_mobile にコピー');
    console.log('\n✅ マイグレーション114が正常に完了しました！');

  } catch (error) {
    console.error('❌ マイグレーション失敗:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
