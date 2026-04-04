import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAA13846DataLength() {
  console.log('🔍 AA13846のデータ長を確認中...\n');

  // AA13846を取得
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('seller_number', 'AA13846');

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!sellers || sellers.length === 0) {
    console.log('❌ AA13846が見つかりません');
    return;
  }

  console.log(`✅ AA13846を${sellers.length}件取得しました\n`);

  // 全てのAA13846をチェック
  for (let i = 0; i < sellers.length; i++) {
    const seller = sellers[i];
    console.log(`\n--- AA13846 (${i + 1}/${sellers.length}) ---`);

  // VARCHAR(100)制限を超えているカラムを検出
  const longFields: { field: string; length: number; value: string }[] = [];

  for (const [key, value] of Object.entries(seller)) {
    if (typeof value === 'string' && value.length > 100) {
      longFields.push({
        field: key,
        length: value.length,
        value: value.substring(0, 150) + (value.length > 150 ? '...' : ''),
      });
    }
  }

  if (longFields.length === 0) {
    console.log('✅ VARCHAR(100)制限を超えているカラムはありません');
    continue;
  }

  console.log('🚨 VARCHAR(100)制限を超えているカラム:\n');
  for (const field of longFields) {
    console.log(`📊 ${field.field}:`);
    console.log(`   長さ: ${field.length}文字`);
    console.log(`   値: ${field.value}\n`);
  }
  }

  console.log('\n💡 対応方法:');
  console.log('以下のSQLをSupabase SQL Editorで実行してください:\n');
  
  // 全てのAA13846から検出されたカラムをユニークにする
  const allLongFields = new Set<string>();
  for (const seller of sellers) {
    for (const [key, value] of Object.entries(seller)) {
      if (typeof value === 'string' && value.length > 100) {
        allLongFields.add(key);
      }
    }
  }
  
  for (const field of allLongFields) {
    console.log(`ALTER TABLE sellers ALTER COLUMN ${field} TYPE TEXT;`);
  }
}

checkAA13846DataLength().catch(console.error);
