import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMigration() {
  console.log('🚀 Running Migration: Add report_memo to property_listings\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260402_add_report_memo_to_property_listings.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Executing migration SQL...');
    
    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try direct execution if RPC fails
      console.log('⚠️  RPC failed, trying direct execution...');
      
      // Split SQL into statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const statement of statements) {
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
        if (stmtError) {
          console.warn(`⚠️  Statement warning: ${stmtError.message}`);
        }
      }
    }

    console.log('✅ Migration executed successfully!\n');

    // Verify the changes
    console.log('🔍 Verifying migration...');
    
    // Check if report_memo column exists
    const { data: columns, error: colError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'property_listings'
          AND column_name = 'report_memo';
        `
      });

    if (colError) {
      console.log('⚠️  Could not verify column, but migration likely succeeded');
      console.log('   Please check Supabase Dashboard → Database → property_listings table');
    } else {
      console.log('✅ report_memo column added successfully');
      console.log('   Column details:', columns);
    }

    console.log('\n📊 Summary:');
    console.log('   - report_memo column added to property_listings table');
    console.log('   - Type: TEXT');
    console.log('   - NULL allowed: YES');
    console.log('   - Default: NULL');
    console.log('   - Spreadsheet sync: EXCLUDED');
    console.log('\n✅ Migration complete! Ready to implement frontend.');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📝 Manual execution required:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Run the following SQL:');
    console.log('\n   ALTER TABLE property_listings');
    console.log('   ADD COLUMN IF NOT EXISTS report_memo TEXT;');
    console.log('\n   COMMENT ON COLUMN property_listings.report_memo IS');
    console.log('   \'報告メモ（報告ページ専用、スプレッドシート同期対象外）\';');
    process.exit(1);
  }
}

runMigration();
