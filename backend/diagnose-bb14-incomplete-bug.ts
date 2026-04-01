// BB14の「未完了」カテゴリー問題を診断するスクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseBB14() {
  console.log('🔍 BB14の「未完了」カテゴリー問題を診断中...\n');

  // 1. property_listingsテーブルからBB14を取得
  console.log('📊 Step 1: property_listingsテーブルからBB14を取得');
  const { data: bb14, error: bb14Error } = await supabase
    .from('property_listings')
    .select('*')
    .eq('property_number', 'BB14')
    .single();

  if (bb14Error) {
    console.error('❌ エラー:', bb14Error);
    return;
  }

  if (!bb14) {
    console.log('❌ BB14が見つかりません');
    return;
  }

  console.log('✅ BB14のデータ:');
  console.log('  物件番号:', bb14.property_number);
  console.log('  確認:', bb14.confirmation);
  console.log('  ATBB状況:', bb14.atbb_status);
  console.log('  営担:', bb14.sales_assignee);
  console.log('  報告日:', bb14.report_date);
  console.log('  報告担当:', bb14.report_assignee);
  console.log('  サイドバーステータス:', bb14.sidebar_status);
  console.log('');

  // 2. 「未完了」カテゴリの条件をチェック
  console.log('📊 Step 2: 「未完了」カテゴリの条件をチェック');
  const isIncomplete = bb14.confirmation === '未';
  console.log('  confirmation === "未":', isIncomplete);
  console.log('  結果:', isIncomplete ? '✅ 「未完了」に該当' : '❌ 「未完了」に該当しない');
  console.log('');

  // 3. 全物件の「未完了」カウントを取得
  console.log('📊 Step 3: 全物件の「未完了」カウントを取得');
  const { data: allIncomplete, error: allIncompleteError } = await supabase
    .from('property_listings')
    .select('property_number, confirmation')
    .eq('confirmation', '未');

  if (allIncompleteError) {
    console.error('❌ エラー:', allIncompleteError);
    return;
  }

  console.log('  「未完了」物件数:', allIncomplete?.length || 0);
  if (allIncomplete && allIncomplete.length > 0) {
    console.log('  「未完了」物件一覧:');
    allIncomplete.forEach(p => {
      console.log(`    - ${p.property_number}`);
    });
  }
  console.log('');

  // 4. APIエンドポイントをテスト
  console.log('📊 Step 4: APIエンドポイントをテスト');
  try {
    const apiUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/property-listings?limit=1000&offset=0`);
    const result = await response.json();
    
    console.log('  API応答ステータス:', response.status);
    console.log('  取得した物件数:', result.data?.length || 0);
    
    // BB14がAPIレスポンスに含まれているか確認
    const bb14InApi = result.data?.find((p: any) => p.property_number === 'BB14');
    if (bb14InApi) {
      console.log('  ✅ BB14がAPIレスポンスに含まれています');
      console.log('    confirmation:', bb14InApi.confirmation);
    } else {
      console.log('  ❌ BB14がAPIレスポンスに含まれていません');
    }
    
    // 「未完了」物件がAPIレスポンスに含まれているか確認
    const incompleteInApi = result.data?.filter((p: any) => p.confirmation === '未');
    console.log('  「未完了」物件数（API）:', incompleteInApi?.length || 0);
    if (incompleteInApi && incompleteInApi.length > 0) {
      console.log('  「未完了」物件一覧（API）:');
      incompleteInApi.forEach((p: any) => {
        console.log(`    - ${p.property_number}`);
      });
    }
  } catch (error) {
    console.error('❌ APIテストエラー:', error);
  }
  console.log('');

  // 5. 診断結果のまとめ
  console.log('📊 診断結果のまとめ');
  console.log('');
  
  if (bb14.confirmation === '未') {
    console.log('✅ BB14の`confirmation`は「未」です（データベース）');
  } else {
    console.log('❌ BB14の`confirmation`が「未」ではありません（データベース）');
    console.log(`   現在の値: ${bb14.confirmation}`);
  }
  
  if (allIncomplete && allIncomplete.length > 0) {
    console.log(`✅ データベースには${allIncomplete.length}件の「未完了」物件があります`);
  } else {
    console.log('❌ データベースに「未完了」物件がありません');
  }
  
  console.log('');
  console.log('🔍 推奨される次のステップ:');
  console.log('  1. フロントエンドのブラウザコンソールでlistingsデータを確認');
  console.log('  2. PropertySidebarStatusコンポーネントのstatusCountsを確認');
  console.log('  3. 「事務へチャット」ボタンを押した後、confirmationが正しく更新されるか確認');
}

diagnoseBB14().catch(console.error);
