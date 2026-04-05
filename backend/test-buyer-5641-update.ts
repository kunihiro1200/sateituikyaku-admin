// 買主5641の次電日を更新してサイドバーカウントが正しく更新されるかテスト
import * as dotenv from 'dotenv';

// .envファイルを読み込む（最初に実行）
dotenv.config({ path: './backend/.env' });

import { createClient } from '@supabase/supabase-js';
import { BuyerService } from './src/services/BuyerService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testBuyerUpdate() {
  console.log('=== 買主5641の次電日を更新してサイドバーカウントをテスト ===\n');

  const buyerService = new BuyerService();

  // 1. 現在のサイドバーカウントを確認
  console.log('📊 更新前のサイドバーカウント:');
  const { data: beforeCounts } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'todayCall');
  console.log('  todayCall:', beforeCounts?.[0]?.count || 0);

  // 2. 買主5641の次電日を明日（2026-04-06）に変更
  console.log('\n🔄 買主5641の次電日を2026-04-06に変更...');
  await buyerService.update('5641', {
    next_call_date: '2026-04-06'
  });

  // 3. サイドバーカウント更新を待つ（非同期処理のため）
  console.log('⏳ サイドバーカウント更新を待機中...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 4. 更新後のサイドバーカウントを確認
  console.log('\n📊 更新後のサイドバーカウント:');
  const { data: afterCounts } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'todayCall');
  console.log('  todayCall:', afterCounts?.[0]?.count || 0);

  // 5. 結果を判定
  const beforeCount = beforeCounts?.[0]?.count || 0;
  const afterCount = afterCounts?.[0]?.count || 0;

  console.log('\n📊 結果:');
  console.log(`  更新前: ${beforeCount}`);
  console.log(`  更新後: ${afterCount}`);
  console.log(`  期待値: ${beforeCount - 1}`);

  if (afterCount === beforeCount - 1) {
    console.log('\n✅ テスト成功！サイドバーカウントが正しく更新されました。');
  } else {
    console.log('\n❌ テスト失敗！サイドバーカウントが正しく更新されませんでした。');
  }

  // 6. 元に戻す（次電日を今日に戻す）
  console.log('\n🔄 買主5641の次電日を2026-04-05に戻す...');
  await buyerService.update('5641', {
    next_call_date: '2026-04-05'
  });

  console.log('⏳ サイドバーカウント更新を待機中...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const { data: finalCounts } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'todayCall');
  console.log('\n📊 元に戻した後のサイドバーカウント:');
  console.log('  todayCall:', finalCounts?.[0]?.count || 0);
}

testBuyerUpdate().catch(console.error);
