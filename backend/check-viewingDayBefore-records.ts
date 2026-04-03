/**
 * viewingDayBeforeカテゴリのレコードを詳細確認
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

import { supabase } from './src/config/supabase';

async function checkViewingDayBeforeRecords() {
  console.log('🔍 viewingDayBeforeカテゴリのレコードを詳細確認\n');

  const { data, error } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'viewingDayBefore')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ viewingDayBeforeカテゴリのレコードが見つかりません');
    return;
  }

  console.log(`📊 レコード数: ${data.length}件\n`);

  data.forEach((record, index) => {
    console.log(`レコード ${index + 1}:`);
    console.log(`  ID: ${record.id}`);
    console.log(`  カテゴリ: ${record.category}`);
    console.log(`  カウント: ${record.count}`);
    console.log(`  ラベル: ${record.label || '(空)'}`);
    console.log(`  担当: ${record.assignee || '(空)'}`);
    console.log(`  作成日時: ${record.created_at}`);
    console.log(`  更新日時: ${record.updated_at}`);
    console.log('');
  });

  // 合計カウント
  const totalCount = data.reduce((sum, record) => sum + (record.count || 0), 0);
  console.log(`合計カウント: ${totalCount}件`);
}

checkViewingDayBeforeRecords().catch(console.error);
