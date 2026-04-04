import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkTuikyakuchu() {
  console.log('🔍 買主の「追客中」ステータスチェック\n');
  
  // 今日の日付（YYYY-MM-DD形式）
  const today = new Date().toISOString().split('T')[0];
  console.log(`📅 今日の日付: ${today}\n`);
  
  // 「追客中」を含む買主を取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, latest_status, next_call_date, follow_up_assignee, initial_assignee')
    .ilike('latest_status', '%追客中%')
    .order('buyer_number', { ascending: true });
  
  if (error) {
    console.error('❌ エラー:', error);
    return;
  }
  
  console.log(`📊 「追客中」を含む買主数: ${buyers?.length || 0}\n`);
  
  if (!buyers || buyers.length === 0) {
    console.log('⚠️ 「追客中」を含む買主が見つかりませんでした');
    return;
  }
  
  // 次電日が今日以前の買主をフィルタ
  const todayOrBefore = buyers.filter(b => {
    const nextCallDate = b.next_call_date ? b.next_call_date.split('T')[0] : null;
    return nextCallDate && nextCallDate <= today;
  });
  
  console.log(`📊 次電日が今日以前の買主数: ${todayOrBefore.length}\n`);
  
  // 担当ありの買主をカウント
  const withAssignee = todayOrBefore.filter(b => {
    const assignee = b.follow_up_assignee || b.initial_assignee || '';
    return assignee && assignee !== '外す';
  });
  
  console.log(`📊 担当ありの買主数: ${withAssignee.length}\n`);
  
  // 担当別にカウント
  const assigneeCounts: Record<string, number> = {};
  withAssignee.forEach(b => {
    const assignee = b.follow_up_assignee || b.initial_assignee || '';
    assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
  });
  
  console.log('✅ 担当別カウント:');
  console.log(assigneeCounts);
  
  console.log('\n📋 詳細（最初の10件）:');
  withAssignee.slice(0, 10).forEach(b => {
    const assignee = b.follow_up_assignee || b.initial_assignee || '';
    const nextCallDate = b.next_call_date ? b.next_call_date.split('T')[0] : null;
    console.log(`  - ${b.buyer_number}: 担当=${assignee}, 次電日=${nextCallDate}, 状況=${b.latest_status}`);
  });
  
  // latest_statusの値のサンプルを表示
  console.log('\n📋 latest_statusのサンプル（最初の5件）:');
  buyers.slice(0, 5).forEach(b => {
    console.log(`  - ${b.buyer_number}: "${b.latest_status}"`);
  });
}

checkTuikyakuchu().catch(console.error);
