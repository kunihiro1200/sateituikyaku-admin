// AA12497とAA12459が「レインズ登録＋SUUMO登録」カテゴリーに表示される理由を調査

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPropertyListings() {
  console.log('=== AA12497とAA12459のデータ確認 ===\n');

  const propertyNumbers = ['AA12497', 'AA12459'];

  for (const propertyNumber of propertyNumbers) {
    console.log(`\n--- ${propertyNumber} ---`);

    // property_listingsテーブルから取得
    const { data: listing, error: listingError } = await supabase
      .from('property_listings')
      .select('*')
      .eq('property_number', propertyNumber)
      .single();

    if (listingError) {
      console.error(`❌ property_listings取得エラー:`, listingError);
      continue;
    }

    if (!listing) {
      console.log(`❌ ${propertyNumber}が見つかりません`);
      continue;
    }

    console.log(`\n【property_listingsのデータ】`);
    console.log(`  property_number: ${listing.property_number}`);
    console.log(`  atbb_status: ${listing.atbb_status}`);
    console.log(`  suumo_url: ${listing.suumo_url || '(空)'}`);
    console.log(`  suumo_registered: ${listing.suumo_registered || '(空)'}`);
    console.log(`  sidebar_status: ${listing.sidebar_status || '(空)'}`);
    console.log(`  confirmation: ${listing.confirmation || '(空)'}`);
    console.log(`  sales_assignee: ${listing.sales_assignee || '(空)'}`);

    // work_tasksテーブルから公開予定日を取得
    const { data: workTask, error: workTaskError } = await supabase
      .from('work_tasks')
      .select('publish_scheduled_date')
      .eq('property_number', propertyNumber)
      .maybeSingle();

    if (workTaskError) {
      console.error(`❌ work_tasks取得エラー:`, workTaskError);
    } else if (workTask) {
      console.log(`\n【work_tasksのデータ】`);
      console.log(`  publish_scheduled_date: ${workTask.publish_scheduled_date || '(空)'}`);
    } else {
      console.log(`\n【work_tasksのデータ】`);
      console.log(`  ❌ work_tasksにデータがありません`);
    }

    // 「レインズ登録＋SUUMO登録」の条件をチェック
    console.log(`\n【「レインズ登録＋SUUMO登録」の条件チェック】`);
    
    const isExclusivePublic = listing.atbb_status === '専任・公開中';
    console.log(`  1. atbb_status === '専任・公開中': ${isExclusivePublic ? '✅' : '❌'} (実際: ${listing.atbb_status})`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let pubDate: Date | null = null;
    if (workTask?.publish_scheduled_date) {
      const parts = workTask.publish_scheduled_date.split('-');
      if (parts.length === 3) {
        pubDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        pubDate.setHours(0, 0, 0, 0);
      }
    }

    const isPubDateBeforeYesterday = pubDate ? pubDate <= yesterday : false;
    console.log(`  2. 公開予定日が昨日以前: ${isPubDateBeforeYesterday ? '✅' : '❌'} (実際: ${workTask?.publish_scheduled_date || '(空)'}, 昨日: ${yesterday.toISOString().split('T')[0]})`);

    const isSuumoUrlEmpty = !listing.suumo_url;
    console.log(`  3. suumo_urlが空: ${isSuumoUrlEmpty ? '✅' : '❌'} (実際: ${listing.suumo_url || '(空)'})`);

    const isSuumoRegisteredNotSFuyo = listing.suumo_registered !== 'S不要';
    console.log(`  4. suumo_registeredが「S不要」ではない: ${isSuumoRegisteredNotSFuyo ? '✅' : '❌'} (実際: ${listing.suumo_registered || '(空)'})`);

    const shouldBeInCategory = isExclusivePublic && isPubDateBeforeYesterday && isSuumoUrlEmpty && isSuumoRegisteredNotSFuyo;
    console.log(`\n  【結論】このカテゴリーに含まれるべきか: ${shouldBeInCategory ? '✅ はい' : '❌ いいえ'}`);

    // sidebar_statusが正しく設定されているか確認
    if (listing.sidebar_status === 'レインズ登録＋SUUMO登録') {
      console.log(`  ⚠️ sidebar_statusが「レインズ登録＋SUUMO登録」に設定されています`);
      if (!shouldBeInCategory) {
        console.log(`  🚨 問題: 条件に合致しないのにsidebar_statusが設定されています`);
      }
    }
  }

  console.log('\n=== 調査完了 ===');
}

checkPropertyListings().catch(console.error);
