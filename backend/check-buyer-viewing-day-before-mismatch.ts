import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMismatch() {
  console.log('🔍 内覧日前日カテゴリのカウント不一致を調査中...\n');

  // 1. サイドバーカウントを取得
  const { data: sidebarData, error: sidebarError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'viewingDayBefore');

  if (sidebarError) {
    console.error('❌ サイドバーカウント取得エラー:', sidebarError);
    return;
  }

  const sidebarCount = sidebarData?.reduce((sum, row) => sum + (row.count || 0), 0) || 0;
  console.log(`📊 サイドバーカウント: ${sidebarCount}件\n`);

  // 2. 全買主データを取得
  const { data: allBuyers, error: buyersError } = await supabase
    .from('buyers')
    .select('buyer_number, viewing_date, latest_viewing_date, broker_inquiry, notification_sender');

  if (buyersError) {
    console.error('❌ 買主データ取得エラー:', buyersError);
    return;
  }

  console.log(`📊 全買主データ: ${allBuyers?.length}件\n`);

  // 3. 内覧日前日の条件を満たす買主を手動計算
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const matchingBuyers = allBuyers?.filter(buyer => {
    // 条件1: viewing_date が空でない
    if (!buyer.viewing_date) return false;

    // 条件2: broker_inquiry が「業者問合せ」でない
    if (buyer.broker_inquiry === '業者問合せ') return false;

    // 条件3: notification_sender が空である
    if (buyer.notification_sender) return false;

    // 条件4: 日付計算（明日または木曜日の場合は2日後）
    const viewingDate = new Date(buyer.viewing_date);
    viewingDate.setHours(0, 0, 0, 0);
    const viewingDay = viewingDate.getDay();
    const daysBeforeViewing = viewingDay === 4 ? 2 : 1; // 木曜内覧のみ2日前
    const notifyDate = new Date(viewingDate);
    notifyDate.setDate(notifyDate.getDate() - daysBeforeViewing);
    notifyDate.setHours(0, 0, 0, 0);

    return notifyDate.getTime() === today.getTime();
  }) || [];

  console.log(`🔢 手動計算結果: ${matchingBuyers.length}件\n`);

  if (matchingBuyers.length > 0) {
    console.log('✅ 内覧日前日の条件を満たす買主:');
    matchingBuyers.forEach(buyer => {
      console.log(`  - ${buyer.buyer_number}: viewing_date=${buyer.viewing_date}, broker_inquiry=${buyer.broker_inquiry}, notification_sender=${buyer.notification_sender}`);
    });
  } else {
    console.log('⚠️  内覧日前日の条件を満たす買主が見つかりません');
  }

  console.log('\n========================================');
  console.log('📊 比較:');
  console.log(`  - サイドバーカウント: ${sidebarCount}件`);
  console.log(`  - 手動計算結果: ${matchingBuyers.length}件`);
  console.log(`  - 差分: ${Math.abs(sidebarCount - matchingBuyers.length)}件`);
  console.log('========================================\n');

  if (sidebarCount !== matchingBuyers.length) {
    console.log('❌ カウント不一致が確認されました！');
    console.log('   GASの updateBuyerSidebarCounts_ 関数を実行して、サイドバーカウントを更新してください。');
  } else {
    console.log('✅ カウントが一致しています！');
  }
}

checkMismatch().catch(console.error);
