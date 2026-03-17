import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function run() {
  console.log('レインズ関連カラムを追加します...');

  const columns = [
    { name: 'reins_url', type: 'TEXT', comment: 'レインズURL' },
    { name: 'reins_certificate_email', type: 'TEXT', comment: 'レインズ証明書メール済み' },
    { name: 'cc_assignee', type: 'TEXT', comment: '担当をCCにいれる' },
    { name: 'report_date_setting', type: 'TEXT', comment: '報告日設定' },
  ];

  for (const col of columns) {
    // カラムが存在するか確認
    const { data: existing } = await supabase
      .from('property_listings')
      .select(col.name)
      .limit(1);

    if (existing !== null) {
      console.log(`✅ ${col.name} は既に存在します`);
      continue;
    }

    // pg_catalogで確認
    const { data: colCheck, error: colCheckError } = await supabase.rpc('exec_sql', {
      sql: `SELECT column_name FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = '${col.name}'`
    });

    console.log(`カラム ${col.name} を追加中...`);
  }

  // 直接SQLで追加
  const sql = `
    ALTER TABLE public.property_listings
    ADD COLUMN IF NOT EXISTS reins_url TEXT,
    ADD COLUMN IF NOT EXISTS reins_certificate_email TEXT,
    ADD COLUMN IF NOT EXISTS cc_assignee TEXT,
    ADD COLUMN IF NOT EXISTS report_date_setting TEXT;
    NOTIFY pgrst, 'reload schema';
  `;

  // Supabase REST APIでSQL実行
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_KEY!,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY!}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('SQL実行エラー:', text);
    
    // 別の方法: 直接pgを使用
    console.log('\n別の方法でカラムを確認します...');
    const { data, error } = await supabase
      .from('property_listings')
      .select('reins_url, reins_certificate_email, cc_assignee, report_date_setting')
      .limit(1);
    
    if (error) {
      console.error('カラムが存在しません。Supabaseダッシュボードで以下のSQLを実行してください:');
      console.log('\n--- SQL ---');
      console.log(`ALTER TABLE public.property_listings
ADD COLUMN IF NOT EXISTS reins_url TEXT,
ADD COLUMN IF NOT EXISTS reins_certificate_email TEXT,
ADD COLUMN IF NOT EXISTS cc_assignee TEXT,
ADD COLUMN IF NOT EXISTS report_date_setting TEXT;

NOTIFY pgrst, 'reload schema';`);
      console.log('--- END SQL ---\n');
    } else {
      console.log('✅ カラムは既に存在します');
    }
    return;
  }

  console.log('✅ カラムの追加が完了しました');

  // 確認
  const { data, error } = await supabase
    .from('property_listings')
    .select('reins_url, reins_certificate_email, cc_assignee, report_date_setting')
    .limit(1);

  if (error) {
    console.error('確認エラー:', error.message);
  } else {
    console.log('✅ カラムの確認OK:', Object.keys(data?.[0] || {}));
  }
}

run().catch(console.error);
