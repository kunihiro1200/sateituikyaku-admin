/**
 * seller_sidebar_countsテーブルを確認
 */

// 環境変数を最初に読み込む
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSidebarCounts() {
  console.log('🔍 seller_sidebar_countsテーブルを確認...\n');

  const { data, error } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .eq('category', 'general')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  generalカテゴリのレコードが存在しません');
    return;
  }

  console.log(`📊 generalカテゴリのレコード: ${data.length}件\n`);

  data.forEach(record => {
    console.log(`📋 レコード:`);
    console.log(`   - category: ${record.category}`);
    console.log(`   - count: ${record.count}`);
    console.log(`   - label: ${record.label}`);
    console.log(`   - assignee: ${record.assignee}`);
    console.log(`   - updated_at: ${record.updated_at}\n`);
  });
}

checkSidebarCounts().catch(console.error);
