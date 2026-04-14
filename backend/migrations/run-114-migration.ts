import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URLまたはSUPABASE_SERVICE_ROLE_KEYが設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 マイグレーション114を実行中: buyers テーブルに viewing_mobile カラムを追加...\n');

  try {
    // 1. viewing_mobile カラムを追加
    console.log('📄 ステップ1: viewing_mobile カラムを追加中...');
    const { error: alterError } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE buyers ADD COLUMN IF NOT EXISTS viewing_mobile TEXT;'
    });

    if (alterError) {
      console.error('❌ ALTER TABLE 失敗:', alterError);
      console.log('⚠️ exec RPCが利用できない可能性があります。Supabase管理画面から手動で実行してください。');
      console.log('\n実行するSQL:');
      console.log('---');
      const sqlPath = path.join(__dirname, '114_add_viewing_mobile_to_buyers.sql');
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      console.log(sql);
      console.log('---');
      process.exit(1);
    }

    console.log('✅ viewing_mobile カラムを追加しました');

    // 2. 既存データの移行
    console.log('\n📄 ステップ2: viewing_type のデータを viewing_mobile にコピー中...');
    const { error: updateError } = await supabase.rpc('exec', {
      sql: `UPDATE buyers SET viewing_mobile = viewing_type WHERE viewing_type IS NOT NULL AND viewing_type <> '' AND (viewing_mobile IS NULL OR viewing_mobile = '');`
    });

    if (updateError) {
      console.error('❌ データ移行失敗:', updateError);
      process.exit(1);
    }

    console.log('✅ データ移行完了');

    // 3. 検証
    console.log('\n🔍 検証中...');
    const { data: rows, error: queryError } = await supabase
      .from('buyers')
      .select('buyer_number, viewing_type, viewing_mobile')
      .not('viewing_type', 'is', null)
      .limit(5);

    if (queryError) {
      console.error('❌ 検証クエリ失敗:', queryError);
      process.exit(1);
    }

    console.log('✅ 検証完了！buyers テーブルの viewing_mobile カラムにアクセスできます。');
    if (rows && rows.length > 0) {
      console.log('📊 サンプルデータ（viewing_type → viewing_mobile）:');
      rows.forEach(row => {
        console.log(`  buyer_number=${row.buyer_number}: viewing_type="${row.viewing_type}" → viewing_mobile="${row.viewing_mobile}"`);
      });
    } else {
      console.log('📊 viewing_type にデータがある行はありませんでした');
    }

    console.log('\n📋 実行内容:');
    console.log('  - buyers テーブルに viewing_mobile TEXT カラムを追加');
    console.log('  - viewing_type の既存データを viewing_mobile にコピー');

  } catch (err) {
    console.error('❌ 予期しないエラー:', err);
    process.exit(1);
  }
}

runMigration();
