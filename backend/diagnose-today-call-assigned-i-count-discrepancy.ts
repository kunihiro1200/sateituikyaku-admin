import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// .env.localファイルを探す
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('✅ .env.local を読み込みました\n');
} else {
  console.log('⚠️ .env.local が見つかりません。環境変数を確認してください。\n');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 環境変数が設定されていません');
  console.error('SUPABASE_URL:', supabaseUrl ? '設定済み' : '未設定');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '設定済み' : '未設定');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('🔍 診断開始: 当日TEL(I)のカウント不一致\n');

  // 1. バックエンドの getSidebarCountsFallback() と同じクエリ（todayCallAssignedSellers）
  console.log('📊 バックエンドのtodayCallAssignedSellersクエリ（getSidebarCountsFallback）:');
  const today = new Date().toISOString().split('T')[0];
  
  const { data: backendQuery, error: backendError } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, status, next_call_date')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .lte('next_call_date', today)
    .ilike('status', '%追客中%')
    .not('status', 'ilike', '%他社買取%');

  if (backendError) {
    console.error('❌ エラー:', backendError);
    return;
  }

  console.log(`✅ 取得件数: ${backendQuery?.length || 0}件\n`);

  // 担当者別にカウント
  const backendCounts: Record<string, number> = {};
  backendQuery?.forEach((s: any) => {
    const assignee = s.visit_assignee;
    if (assignee) {
      backendCounts[assignee] = (backendCounts[assignee] || 0) + 1;
    }
  });

  console.log('📊 バックエンドの担当者別カウント:');
  Object.entries(backendCounts).forEach(([assignee, count]) => {
    console.log(`  ${assignee}: ${count}件`);
  });
  console.log(`  合計: ${backendQuery?.length || 0}件\n`);

  // 2. バックエンドの listSellers() と同じクエリ（todayCallAssigned:I）
  console.log('📊 バックエンドのlistSellersクエリ（todayCallAssigned:I）:');
  
  const { data: listQuery, error: listError } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, status, next_call_date')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .eq('visit_assignee', 'I')
    .lte('next_call_date', today)
    .ilike('status', '%追客中%')
    .not('status', 'ilike', '%他社買取%');

  if (listError) {
    console.error('❌ エラー:', listError);
    return;
  }

  console.log(`✅ 取得件数: ${listQuery?.length || 0}件\n`);

  // 3. 詳細を表示
  console.log('📋 当日TEL(I)の売主詳細:');
  listQuery?.forEach((s: any, index: number) => {
    console.log(`  ${index + 1}. ${s.seller_number} - 営担: ${s.visit_assignee}, 状況: ${s.status}, 次電日: ${s.next_call_date}`);
  });

  console.log('\n🔍 結論:');
  console.log(`  バックエンドのtodayCallAssignedCounts['I']: ${backendCounts['I'] || 0}件`);
  console.log(`  バックエンドのlistSellers(todayCallAssigned:I): ${listQuery?.length || 0}件`);
  
  if (backendCounts['I'] !== listQuery?.length) {
    console.log(`  ❌ 不一致が検出されました！`);
    console.log(`  差分: ${Math.abs((backendCounts['I'] || 0) - (listQuery?.length || 0))}件`);
  } else {
    console.log(`  ✅ バックエンドのカウントとリストは一致しています`);
  }

  // 4. フロントエンドの isVisitAssignedTo() と同じ条件で確認
  console.log('\n📊 フロントエンドのisVisitAssignedTo()条件:');
  console.log('  条件: visitAssignee === "I" && status に「他社買取」を含まない');
  
  const { data: allSellers, error: allError } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, status, next_call_date')
    .is('deleted_at', null)
    .eq('visit_assignee', 'I');

  if (allError) {
    console.error('❌ エラー:', allError);
    return;
  }

  const frontendFiltered = allSellers?.filter((s: any) => {
    const status = s.status || '';
    return !(typeof status === 'string' && status.includes('他社買取'));
  });

  console.log(`✅ 営担=Iの全売主: ${allSellers?.length || 0}件`);
  console.log(`✅ 「他社買取」除外後: ${frontendFiltered?.length || 0}件\n`);

  // 5. 「当日TEL(I)」の条件を満たす売主を確認
  console.log('📊 「当日TEL(I)」の条件を満たす売主:');
  console.log('  条件: visitAssignee === "I" && next_call_date <= 今日 && status に「追客中」を含む && status に「他社買取」を含まない');
  
  const todayCallAssignedI = frontendFiltered?.filter((s: any) => {
    const nextCallDate = s.next_call_date;
    const status = s.status || '';
    return nextCallDate && nextCallDate <= today && status.includes('追客中');
  });

  console.log(`✅ 条件を満たす売主: ${todayCallAssignedI?.length || 0}件\n`);

  console.log('📋 詳細:');
  todayCallAssignedI?.forEach((s: any, index: number) => {
    console.log(`  ${index + 1}. ${s.seller_number} - 営担: ${s.visit_assignee}, 状況: ${s.status}, 次電日: ${s.next_call_date}`);
  });

  console.log('\n🎯 最終結論:');
  console.log(`  サイドバー表示（期待値）: ${backendCounts['I'] || 0}件`);
  console.log(`  クリック時の展開リスト（期待値）: ${listQuery?.length || 0}件`);
  console.log(`  フロントエンドフィルタ結果: ${todayCallAssignedI?.length || 0}件`);
}

diagnose().catch(console.error);
