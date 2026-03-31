// 既存データの修正スクリプト
// AA12497とAA12459のsidebar_statusを正しい値に更新

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPropertyListingSidebarStatus() {
  console.log('=== 既存データの修正開始 ===\n');

  const propertyNumbers = ['AA12497', 'AA12459'];

  for (const propertyNumber of propertyNumbers) {
    console.log(`\n--- ${propertyNumber} の修正 ---`);

    // 現在のsidebar_statusを確認
    const { data: listing, error: fetchError } = await supabase
      .from('property_listings')
      .select('*')
      .eq('property_number', propertyNumber)
      .single();

    if (fetchError || !listing) {
      console.error(`❌ ${propertyNumber} の取得エラー:`, fetchError);
      continue;
    }

    console.log(`  現在のsidebar_status: ${listing.sidebar_status}`);
    console.log(`  suumo_url: ${listing.suumo_url || '(空)'}`);
    console.log(`  atbb_status: ${listing.atbb_status}`);

    // 正しいsidebar_statusを計算
    // SUUMO URLが登録されている場合、「レインズ登録＋SUUMO登録」から除外
    // 担当別のステータスに変更
    let newSidebarStatus = '';

    if (listing.atbb_status === '専任・公開中') {
      // 担当名を取得
      const assignee = listing.sales_assignee_name || '';
      
      // 担当別のステータスを計算
      const assigneeMapping: Record<string, string> = {
        '山本': 'Y専任公開中',
        '生野': '生・専任公開中',
        '久': '久・専任公開中',
        '裏': 'U専任公開中',
        '林': '林・専任公開中',
        '国広': 'K専任公開中',
        '木村': 'R専任公開中',
        '角井': 'I専任公開中',
      };

      newSidebarStatus = assigneeMapping[assignee] || '専任・公開中';
    }

    console.log(`  新しいsidebar_status: ${newSidebarStatus}`);

    if (newSidebarStatus === listing.sidebar_status) {
      console.log(`  ✅ 既に正しい値です（更新不要）`);
      continue;
    }

    // sidebar_statusを更新
    const { error: updateError } = await supabase
      .from('property_listings')
      .update({
        sidebar_status: newSidebarStatus,
        updated_at: new Date().toISOString()
      })
      .eq('property_number', propertyNumber);

    if (updateError) {
      console.error(`❌ ${propertyNumber} の更新エラー:`, updateError);
      continue;
    }

    console.log(`  ✅ sidebar_statusを更新しました: ${listing.sidebar_status} → ${newSidebarStatus}`);
  }

  console.log('\n=== 修正完了 ===');
}

fixPropertyListingSidebarStatus().catch(console.error);
