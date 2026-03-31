/**
 * 当日TEL(I)のカウント不一致調査スクリプト
 * 
 * サイドバー表示: 6件
 * テーブル表示: 75件
 * ユーザー指摘: DBは61件
 * 
 * 各パターンでのカウントを確認
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== 当日TEL(I)のカウント不一致調査 ===\n');

  // 今日の日付（JST）
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  const todayJST = `${year}-${month}-${day}`;
  console.log(`今日の日付（JST）: ${todayJST}\n`);

  // パターン1: サイドバーカウントの条件（全担当者）
  console.log('【パターン1】サイドバーカウントの条件（全担当者）');
  console.log('条件: 営担あり（「外す」以外） + 次電日が今日以前 + 追客不要を含まない');
  const { data: pattern1, count: count1 } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, next_call_date, status', { count: 'exact' })
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .lte('next_call_date', todayJST)
    .not('status', 'ilike', '%追客不要%');
  console.log(`件数: ${count1}件\n`);

  // パターン2: 営担=Iのみ（サイドバーカウント）
  console.log('【パターン2】営担=Iのみ（サイドバーカウント）');
  console.log('条件: 営担=I + 次電日が今日以前 + 追客不要を含まない');
  const { data: pattern2, count: count2 } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, next_call_date, status', { count: 'exact' })
    .is('deleted_at', null)
    .eq('visit_assignee', 'I')
    .lte('next_call_date', todayJST)
    .not('status', 'ilike', '%追客不要%');
  console.log(`件数: ${count2}件`);
  console.log(`→ これがサイドバーの「当日TEL(I) 6」のカウントのはず\n`);

  // パターン3: 営担=I + 次電日が今日以前のみ（追客不要チェックなし）
  console.log('【パターン3】営担=I + 次電日が今日以前のみ（追客不要チェックなし）');
  console.log('条件: 営担=I + 次電日が今日以前');
  const { data: pattern3, count: count3 } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, next_call_date, status', { count: 'exact' })
    .is('deleted_at', null)
    .eq('visit_assignee', 'I')
    .lte('next_call_date', todayJST);
  console.log(`件数: ${count3}件`);
  console.log(`→ ユーザー指摘の「DBは61件」に近い可能性\n`);

  // パターン4: 営担=I + 次電日が今日以前 + 追客を含む
  console.log('【パターン4】営担=I + 次電日が今日以前 + 追客を含む');
  console.log('条件: 営担=I + 次電日が今日以前 + statusに「追客」を含む');
  const { data: pattern4, count: count4 } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, next_call_date, status', { count: 'exact' })
    .is('deleted_at', null)
    .eq('visit_assignee', 'I')
    .lte('next_call_date', todayJST)
    .ilike('status', '%追客%');
  console.log(`件数: ${count4}件\n`);

  // パターン5: 営担=I + 次電日が今日以前 + 追客を含む - 追客不要を除外
  console.log('【パターン5】営担=I + 次電日が今日以前 + 追客を含む - 追客不要を除外');
  console.log('条件: 営担=I + 次電日が今日以前 + statusに「追客」を含む - 追客不要を除外');
  const { data: pattern5, count: count5 } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, next_call_date, status', { count: 'exact' })
    .is('deleted_at', null)
    .eq('visit_assignee', 'I')
    .lte('next_call_date', todayJST)
    .ilike('status', '%追客%')
    .not('status', 'ilike', '%追客不要%');
  console.log(`件数: ${count5}件\n`);

  // パターン2とパターン3の差分を確認（追客不要を含む売主）
  console.log('【差分確認】パターン3 - パターン2（追客不要を含む売主）');
  const pattern2Numbers = new Set((pattern2 || []).map((s: any) => s.seller_number));
  const pattern3Only = (pattern3 || []).filter((s: any) => !pattern2Numbers.has(s.seller_number));
  console.log(`件数: ${pattern3Only.length}件`);
  if (pattern3Only.length > 0) {
    console.log('売主番号:');
    pattern3Only.forEach((s: any) => {
      console.log(`  ${s.seller_number} - 営担: ${s.visit_assignee}, 次電日: ${s.next_call_date}, 状況: ${s.status}`);
    });
  }
  console.log();

  // パターン3とパターン5の差分を確認（追客を含まない売主）
  console.log('【差分確認】パターン3 - パターン5（追客を含まない売主）');
  const pattern5Numbers = new Set((pattern5 || []).map((s: any) => s.seller_number));
  const pattern3OnlyNoFollowUp = (pattern3 || []).filter((s: any) => !pattern5Numbers.has(s.seller_number));
  console.log(`件数: ${pattern3OnlyNoFollowUp.length}件`);
  if (pattern3OnlyNoFollowUp.length > 0) {
    console.log('売主番号:');
    pattern3OnlyNoFollowUp.forEach((s: any) => {
      console.log(`  ${s.seller_number} - 営担: ${s.visit_assignee}, 次電日: ${s.next_call_date}, 状況: ${s.status}`);
    });
  }
  console.log();

  // まとめ
  console.log('=== まとめ ===');
  console.log(`サイドバー表示: 6件 → パターン2: ${count2}件`);
  console.log(`テーブル表示: 75件 → 原因不明（要調査）`);
  console.log(`ユーザー指摘: 61件 → パターン3: ${count3}件`);
  console.log();
  console.log('【推測】');
  console.log('- サイドバーカウント（6件）は正しい（追客不要を除外）');
  console.log('- テーブルフィルター（75件）は間違っている可能性');
  console.log('  → バックエンドのフィルター条件が不足している？');
  console.log('  → フロントエンドのフィルター条件が不足している？');
  console.log('- ユーザー指摘（61件）はパターン3（追客不要チェックなし）に近い');
}

main().catch(console.error);
