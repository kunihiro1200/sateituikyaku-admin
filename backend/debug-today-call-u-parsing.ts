import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { isTodayOrPast } from './src/utils/dateHelpers';

// backend/.envファイルを読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 環境変数が設定されていません');
  console.error('SUPABASE_URL:', supabaseUrl ? '設定済み' : '未設定');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '設定済み' : '未設定');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTodayCallUParsing() {
  console.log('🔍 買主「当日TEL(U)」のnext_call_dateパース問題をデバッグ...\n');

  const targetBuyerNumbers = ['7278', '7148', '7104', '6930'];

  for (const buyerNumber of targetBuyerNumbers) {
    console.log(`\n📋 買主${buyerNumber}:`);

    const { data: buyer, error } = await supabase
      .from('buyers')
      .select('buyer_number, follow_up_assignee, next_call_date')
      .eq('buyer_number', buyerNumber)
      .single();

    if (error || !buyer) {
      console.log(`  ❌ 買主が見つかりません: ${error?.message}`);
      continue;
    }

    console.log(`  follow_up_assignee: ${buyer.follow_up_assignee}`);
    console.log(`  next_call_date (生データ): ${buyer.next_call_date}`);
    console.log(`  next_call_date (型): ${typeof buyer.next_call_date}`);

    // isTodayOrPast()の判定結果
    const result = isTodayOrPast(buyer.next_call_date);
    console.log(`  isTodayOrPast(next_call_date): ${result}`);

    // 今日の日付（JST）
    const today = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstMs = today.getTime() + jstOffset;
    const jst = new Date(jstMs);
    const todayStr = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
    console.log(`  今日の日付（JST）: ${todayStr}`);

    // 文字列比較
    const nextCallDateStr = buyer.next_call_date ? String(buyer.next_call_date).split('T')[0] : null;
    console.log(`  next_call_date (YYYY-MM-DD): ${nextCallDateStr}`);
    console.log(`  文字列比較: ${nextCallDateStr} <= ${todayStr} → ${nextCallDateStr ? nextCallDateStr <= todayStr : false}`);

    // 判定結果
    if (buyer.follow_up_assignee === 'U' && result) {
      console.log(`  ✅ 「当日TEL(U)」にカウントされるべき`);
    } else if (buyer.follow_up_assignee === 'U' && !result) {
      console.log(`  ❌ 「当日TEL(U)」にカウントされない（問題）`);
    } else {
      console.log(`  ℹ️  follow_up_assignee が U ではない`);
    }
  }

  console.log('\n✅ デバッグ完了');
}

debugTodayCallUParsing().catch(console.error);
