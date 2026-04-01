// BB14の確認フィールドをチェックするスクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBB14() {
  console.log('🔍 BB14の確認フィールドをチェック中...\n');

  // property_listingsテーブルからBB14を取得
  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, confirmation, atbb_status, sales_assignee, report_date, report_assignee')
    .eq('property_number', 'BB14')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!data) {
    console.log('❌ BB14が見つかりません');
    return;
  }

  console.log('✅ BB14のデータ:');
  console.log('  物件番号:', data.property_number);
  console.log('  確認:', data.confirmation);
  console.log('  ATBB状況:', data.atbb_status);
  console.log('  営担:', data.sales_assignee);
  console.log('  報告日:', data.report_date);
  console.log('  報告担当:', data.report_assignee);
  console.log('');

  // 「未完了」カテゴリの条件をチェック
  const isIncomplete = data.confirmation === '未';
  console.log('📊 「未完了」カテゴリの判定:');
  console.log('  confirmation === "未":', isIncomplete);
  console.log('  結果:', isIncomplete ? '✅ 「未完了」に該当' : '❌ 「未完了」に該当しない');
}

checkBB14().catch(console.error);
