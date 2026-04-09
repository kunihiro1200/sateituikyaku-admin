import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBuyer6752ActivityLogs() {
  console.log('=== 買主6752のactivity_logs確認 ===\n');

  // 買主6752のactivity_logsを取得
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('target_type', 'buyer')
    .eq('target_id', '6752')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`📊 買主6752のactivity_logs: ${logs?.length || 0}件\n`);

  if (logs && logs.length > 0) {
    logs.forEach((log, index) => {
      console.log(`--- ログ ${index + 1} ---`);
      console.log(`ID: ${log.id}`);
      console.log(`Action: ${log.action}`);
      console.log(`Created at: ${log.created_at}`);
      console.log(`Metadata:`, JSON.stringify(log.metadata, null, 2));
      console.log('');
    });
  } else {
    console.log('⚠️ 買主6752のactivity_logsが見つかりません');
  }

  // BB14の物件に関連するactivity_logsを取得
  console.log('\n=== BB14の物件に関連するactivity_logs ===\n');
  
  const { data: bb14Logs, error: bb14Error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action', 'email')
    .order('created_at', { ascending: false })
    .limit(50);

  if (bb14Error) {
    console.error('❌ エラー:', bb14Error);
    return;
  }

  const bb14RelatedLogs = bb14Logs?.filter(log => {
    const metadata = log.metadata || {};
    const propertyNumbers = metadata.propertyNumbers || metadata.property_numbers || [];
    return propertyNumbers.includes('BB14');
  });

  console.log(`📊 BB14に関連するactivity_logs: ${bb14RelatedLogs?.length || 0}件\n`);

  if (bb14RelatedLogs && bb14RelatedLogs.length > 0) {
    bb14RelatedLogs.forEach((log, index) => {
      console.log(`--- ログ ${index + 1} ---`);
      console.log(`ID: ${log.id}`);
      console.log(`Target type: ${log.target_type}`);
      console.log(`Target ID: ${log.target_id}`);
      console.log(`Action: ${log.action}`);
      console.log(`Created at: ${log.created_at}`);
      console.log(`Metadata:`, JSON.stringify(log.metadata, null, 2));
      console.log('');
    });
  } else {
    console.log('⚠️ BB14に関連するactivity_logsが見つかりません');
  }

  // 最近のメール送信ログを確認（source: 'buyer_candidate_list'）
  console.log('\n=== 買主候補リストからの最近のメール送信ログ ===\n');
  
  const { data: candidateLogs, error: candidateError } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action', 'email')
    .order('created_at', { ascending: false })
    .limit(20);

  if (candidateError) {
    console.error('❌ エラー:', candidateError);
    return;
  }

  const candidateListLogs = candidateLogs?.filter(log => {
    const metadata = log.metadata || {};
    return metadata.source === 'buyer_candidate_list';
  });

  console.log(`📊 買主候補リストからのメール送信ログ: ${candidateListLogs?.length || 0}件\n`);

  if (candidateListLogs && candidateListLogs.length > 0) {
    candidateListLogs.forEach((log, index) => {
      console.log(`--- ログ ${index + 1} ---`);
      console.log(`ID: ${log.id}`);
      console.log(`Target type: ${log.target_type}`);
      console.log(`Target ID: ${log.target_id}`);
      console.log(`Created at: ${log.created_at}`);
      console.log(`Metadata:`, JSON.stringify(log.metadata, null, 2));
      console.log('');
    });
  } else {
    console.log('⚠️ 買主候補リストからのメール送信ログが見つかりません');
  }
}

checkBuyer6752ActivityLogs().catch(console.error);
