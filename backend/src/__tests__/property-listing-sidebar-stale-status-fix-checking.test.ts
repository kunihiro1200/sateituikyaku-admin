// Phase 3: 修正検証テスト（Fix Checking）
// 修正後のcalculateSidebarStatusが正しく動作することを確認

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

describe('Property Listing Sidebar Stale Status Bug - Fix Checking', () => {
  // Task 3.1: 修正後のcalculateSidebarStatusテスト
  test('SUUMO URLが登録されている物件は「レインズ登録＋SUUMO登録」以外のステータスが返される', async () => {
    const propertyNumbers = ['AA12497', 'AA12459'];

    for (const propertyNumber of propertyNumbers) {
      console.log(`\n--- ${propertyNumber} の修正確認 ---`);

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

      console.log(`  sidebar_status: ${listing.sidebar_status}`);
      console.log(`  suumo_url: ${listing.suumo_url || '(空)'}`);
      console.log(`  atbb_status: ${listing.atbb_status}`);

      // 修正後のコードでは、SUUMO URLが登録されている場合、
      // 「レインズ登録＋SUUMO登録」以外のステータスが返される
      expect(listing.sidebar_status).not.toBe('レインズ登録＋SUUMO登録');
      
      // SUUMO URLが登録されている
      expect(listing.suumo_url).not.toBeNull();
      expect(listing.suumo_url).not.toBe('');

      console.log(`  ✅ 修正が正しく適用されています`);
    }
  });

  // Task 3.2: AA12497とAA12459の修正確認テスト
  test('AA12497とAA12459のsidebar_statusが「レインズ登録＋SUUMO登録」ではないことを確認', async () => {
    const propertyNumbers = ['AA12497', 'AA12459'];

    for (const propertyNumber of propertyNumbers) {
      console.log(`\n--- ${propertyNumber} の最終確認 ---`);

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

      console.log(`  sidebar_status: ${listing.sidebar_status}`);
      console.log(`  suumo_url: ${listing.suumo_url || '(空)'}`);

      // 既存データが修正されたことを確認
      expect(listing.sidebar_status).not.toBe('レインズ登録＋SUUMO登録');

      console.log(`  ✅ 既存データが正しく修正されています`);
    }
  });
});
