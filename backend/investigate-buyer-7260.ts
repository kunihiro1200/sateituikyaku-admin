// 買主7260のデータ調査スクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .envファイルを読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateBuyer7260() {
  console.log('=== 買主7260のデータ調査 ===\n');

  // 1. データベースのbroker_surveyとvendor_surveyを確認
  console.log('1. データベースの買主7260のデータ:');
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('buyer_number, broker_survey, vendor_survey')
    .eq('buyer_number', '7260')
    .single();

  if (error) {
    console.error('エラー:', error);
    return;
  }

  if (!buyer) {
    console.log('買主7260が見つかりませんでした');
    return;
  }

  console.log('買主番号:', buyer.buyer_number);
  console.log('broker_survey:', buyer.broker_survey);
  console.log('vendor_survey:', buyer.vendor_survey);
  console.log('');

  // 2. 結論
  console.log('=== 調査結果 ===');
  if (buyer.broker_survey === '未') {
    console.log('✓ データベースのbroker_surveyは「未」です');
    console.log('→ スプレッドシートが「確認済み」なのに、データベースが「未」のまま');
    console.log('→ GAS同期が正しく動作していない可能性が高い');
  } else if (buyer.broker_survey === '確認済み') {
    console.log('✓ データベースのbroker_surveyは「確認済み」です');
    console.log('→ データベースは正しい');
    console.log('→ サイドバーのステータス計算ロジックに問題がある可能性');
  } else {
    console.log('✓ データベースのbroker_surveyは:', buyer.broker_survey);
  }

  if (buyer.vendor_survey) {
    console.log('');
    console.log('注意: vendor_surveyフィールドにも値があります:', buyer.vendor_survey);
    console.log('→ 過去にvendor_surveyが使われていた可能性');
  }
}

investigateBuyer7260().catch(console.error);
