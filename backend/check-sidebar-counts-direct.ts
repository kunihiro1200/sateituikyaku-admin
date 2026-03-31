/**
 * SellerServiceのgetSidebarCountsメソッドを直接呼び出してカウントを確認
 */

import { SellerService } from './src/services/SellerService.supabase';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

async function main() {
  console.log('=== サイドバーカウントの直接確認 ===\n');

  const sellerService = new SellerService();
  const counts = await sellerService.getSidebarCounts();

  console.log('【レスポンス】');
  console.log(JSON.stringify(counts, null, 2));
  console.log();

  console.log('【当日TEL（担当）のカウント】');
  console.log(`todayCallAssigned（全体）: ${counts.todayCallAssigned}件`);
  console.log();

  console.log('【担当者別カウント（todayCallAssignedCounts）】');
  if (counts.todayCallAssignedCounts) {
    Object.entries(counts.todayCallAssignedCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([assignee, count]) => {
        console.log(`  ${assignee}: ${count}件`);
      });
  } else {
    console.log('  （データなし）');
  }
  console.log();

  console.log('【担当者別カウント（visitAssignedCounts）】');
  if (counts.visitAssignedCounts) {
    Object.entries(counts.visitAssignedCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([assignee, count]) => {
        console.log(`  ${assignee}: ${count}件`);
      });
  } else {
    console.log('  （データなし）');
  }
  console.log();

  console.log('=== 分析 ===');
  if (counts.todayCallAssignedCounts && counts.todayCallAssignedCounts['I']) {
    console.log(`✅ サイドバーに表示されるべき「当日TEL(I)」のカウント: ${counts.todayCallAssignedCounts['I']}件`);
    console.log(`❌ ユーザーが見ている表示: 6件`);
    console.log(`→ 不一致の原因: フロントエンドのキャッシュまたは表示ロジックの問題`);
  } else {
    console.log('❌ 「I」の担当者別カウントが見つかりません');
  }
}

main().catch(console.error);
