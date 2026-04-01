import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Running migration 110: Add land_area_verified and building_area_verified to sellers table...');
    
    // PostgreSQL接続情報を取得
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    
    if (!connectionString) {
      console.error('❌ DATABASE_URL or SUPABASE_DB_URL not found in environment variables');
      process.exit(1);
    }
    
    // pg clientを使用してSQLを実行
    const { Client } = require('pg');
    const client = new Client({ connectionString });
    
    await client.connect();
    console.log('✅ Connected to database');
    
    // マイグレーションSQLを読み込む
    const migrationPath = path.join(__dirname, 'migrations', '110_add_verified_area_to_sellers.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    // SQLを実行
    await client.query(sql);
    console.log('✅ Migration 110 completed successfully!');
    
    // 確認クエリ
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sellers' 
      AND column_name IN ('land_area_verified', 'building_area_verified')
      ORDER BY column_name
    `);
    
    console.log('✅ Columns verified:');
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

runMigration();
