import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('Adding body column to property_report_history...');
  
  // まず現在のカラムを確認
  const { data: check, error: checkError } = await supabase
    .from('property_report_history')
    .select('id')
    .limit(1);
  
  if (checkError) {
    console.error('Table check error:', checkError.message);
    return;
  }
  
  console.log('Table exists. Checking body column...');
  
  // bodyカラムを含めて取得してみる
  const { data: bodyCheck, error: bodyError } = await supabase
    .from('property_report_history')
    .select('body')
    .limit(1);
  
  if (!bodyError) {
    console.log('body column already exists!');
    return;
  }
  
  console.log('body column does not exist. Need to add via Supabase dashboard SQL editor.');
  console.log('');
  console.log('Please run this SQL in Supabase SQL Editor:');
  console.log('ALTER TABLE property_report_history ADD COLUMN IF NOT EXISTS body TEXT;');
  console.log('');
  console.log('URL: https://supabase.com/dashboard/project/krxhrbtlgfjzsseegaqq/sql/new');
}

main().catch(console.error);
