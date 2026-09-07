/**
 * audit_logs テーブルから FI1201 関連の記録を調査するスクリプト（読み取りのみ）
 *
 * 使い方: npx ts-node backend/check-audit-logs-fi1201.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '.env.vercel.check') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  const { data: fi1201 } = await supabase
    .from('sellers')
    .select('id, seller_number')
    .eq('seller_number', 'FI1201')
    .single();

  if (!fi1201) {
    console.log('FI1201 が見つかりません');
    return;
  }

  console.log('FI1201 の id:', fi1201.id);

  // entity_id で検索
  const { data: byEntityId, error: e1 } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_id', fi1201.id)
    .order('timestamp', { ascending: true });

  console.log('\n' + '='.repeat(80));
  console.log(`audit_logs（entity_id = ${fi1201.id}）: ${byEntityId?.length || 0}件`);
  console.log('='.repeat(80));
  if (e1) console.log('エラー:', e1.message);
  for (const log of byEntityId || []) {
    console.log(`\n[${log.timestamp}] action=${log.action} entity_type=${log.entity_type}`);
    console.log(`  employee_id: ${log.employee_id}`);
    console.log(`  details: ${JSON.stringify(log.details || log.changes || {}).substring(0, 500)}`);
  }

  // 直近2026-08-29〜09-01の売主関連の全audit_logsも見る（FI1201のIDで拾えない場合の保険）
  const { data: recentLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .gte('timestamp', '2026-08-29T00:00:00Z')
    .lte('timestamp', '2026-09-01T23:59:59Z')
    .order('timestamp', { ascending: true })
    .limit(200);

  console.log('\n' + '='.repeat(80));
  console.log(`2026-08-29〜09-01 の全 audit_logs: ${recentLogs?.length || 0}件`);
  console.log('='.repeat(80));

  // FI1201のIDを含むもの、またはentity_typeがsellerのものを抽出
  const relevant = (recentLogs || []).filter(
    (l: any) => l.entity_id === fi1201.id || String(l.entity_type || '').toLowerCase().includes('seller')
  );
  console.log(`sellers関連: ${relevant.length}件`);
  for (const log of relevant.slice(0, 50)) {
    console.log(`  [${log.timestamp}] action=${log.action} entity_type=${log.entity_type} entity_id=${log.entity_id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
