// Phase 1: 探索的テスト（Bug Exploration）
// バグ条件C(X)を満たす物件が存在することを確認

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .envファイルを正しく読み込む
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

describe('Property Listing Sidebar Stale Status Bug - Exploration', () => {
  // Task 1.1: バグ条件の確認テスト
  test('AA12497とAA12459が「レインズ登録＋SUUMO登録」カテゴリーに誤って表示される', async () => {
    const propertyNumbers = ['AA12497', 'AA12459'];

    for (const propertyNumber of propertyNumbers) {
      console.log(`\n--- ${propertyNumber} のバグ条件確認 ---`);

      // property_listingsテーブルから取得
      const { data: listing, error } = await supabase
        .from('property_listings')
        .select('*')
        .eq('property_number', propertyNumber)
        .single();

      if (error) {
        console.error(`❌ ${propertyNumber} の取得エラー:`, error);
        continue;
      }

      if (!listing) {
        console.log(`❌ ${propertyNumber} が見つかりません`);
        continue;
      }

      console.log(`  sidebar_status: ${listing.sidebar_status}`);
      console.log(`  suumo_url: ${listing.suumo_url || '(空)'}`);
      console.log(`  atbb_status: ${listing.atbb_status}`);

      // バグ条件C(X)を確認
      // C(X) = (sidebar_status === 'レインズ登録＋SUUMO登録') 
      //        AND (suumo_url !== null AND suumo_url !== '')
      
      const isBugCondition = (
        listing.sidebar_status === 'レインズ登録＋SUUMO登録' &&
        listing.suumo_url !== null &&
        listing.suumo_url !== ''
      );

      console.log(`  バグ条件C(X): ${isBugCondition ? '✅ 満たす（バグあり）' : '❌ 満たさない'}`);

      // 修正前のコードでは、このテストが成功する（バグが存在する）
      expect(isBugCondition).toBe(true);
    }
  });

  // Task 1.2: calculateSidebarStatusの動作確認テスト
  test('calculateSidebarStatusがSUUMO URLを正しくチェックしているか確認', async () => {
    // このテストは、PropertyListingSyncServiceのcalculateSidebarStatusメソッドを
    // 直接テストするのではなく、実際のデータベースの状態を確認する

    const propertyNumbers = ['AA12497', 'AA12459'];

    for (const propertyNumber of propertyNumbers) {
      console.log(`\n--- ${propertyNumber} の条件確認 ---`);

      // property_listingsテーブルから取得
      const { data: listing, error } = await supabase
        .from('property_listings')
        .select('*')
        .eq('property_number', propertyNumber)
        .single();

      if (error || !listing) {
        console.error(`❌ ${propertyNumber} の取得エラー`);
        continue;
      }

      // work_tasksテーブルから公開予定日を取得
      const { data: workTask } = await supabase
        .from('work_tasks')
        .select('publish_scheduled_date')
        .eq('property_number', propertyNumber)
        .maybeSingle();

      console.log(`  atbb_status: ${listing.atbb_status}`);
      console.log(`  suumo_url: ${listing.suumo_url || '(空)'}`);
      console.log(`  suumo_registered: ${listing.suumo_registered || '(空)'}`);
      console.log(`  publish_scheduled_date: ${workTask?.publish_scheduled_date || '(空)'}`);

      // 「レインズ登録＋SUUMO登録」の条件をチェック
      const isExclusivePublic = listing.atbb_status === '専任・公開中';
      
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
      const isSuumoUrlEmpty = !listing.suumo_url || listing.suumo_url.trim() === '';
      const isSuumoRegisteredNotSFuyo = listing.suumo_registered !== 'S不要';

      console.log(`  条件1 (atbb_status === '専任・公開中'): ${isExclusivePublic ? '✅' : '❌'}`);
      console.log(`  条件2 (公開予定日が昨日以前): ${isPubDateBeforeYesterday ? '✅' : '❌'}`);
      console.log(`  条件3 (suumo_urlが空): ${isSuumoUrlEmpty ? '✅' : '❌'}`);
      console.log(`  条件4 (suumo_registeredが「S不要」ではない): ${isSuumoRegisteredNotSFuyo ? '✅' : '❌'}`);

      const shouldBeInCategory = isExclusivePublic && isPubDateBeforeYesterday && isSuumoUrlEmpty && isSuumoRegisteredNotSFuyo;
      console.log(`  【結論】このカテゴリーに含まれるべきか: ${shouldBeInCategory ? '✅ はい' : '❌ いいえ'}`);

      // 修正前のコードでは、条件3が不合格なのに「レインズ登録＋SUUMO登録」カテゴリーに表示される
      expect(shouldBeInCategory).toBe(false);
      expect(listing.sidebar_status).toBe('レインズ登録＋SUUMO登録');
    }
  });
});
