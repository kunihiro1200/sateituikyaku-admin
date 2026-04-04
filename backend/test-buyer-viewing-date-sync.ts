/**
 * 買主5641の内覧日・時間の即時同期テスト
 * 
 * このスクリプトは、買主5641の内覧日・時間をDBに保存し、
 * スプレッドシートに即座に同期されることを確認します。
 */

import { BuyerService } from './src/services/BuyerService';
import dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config({ path: './backend/.env' });

async function testBuyerViewingDateSync() {
  console.log('=== 買主5641の内覧日・時間の即時同期テスト ===\n');

  const buyerService = new BuyerService();
  const buyerNumber = '5641';

  try {
    // 1. 現在の買主データを取得
    console.log('1. 現在の買主データを取得...');
    const buyer = await buyerService.getByBuyerNumber(buyerNumber);
    
    if (!buyer) {
      console.error(`❌ 買主${buyerNumber}が見つかりません`);
      return;
    }

    console.log(`✅ 買主${buyerNumber}を取得しました`);
    console.log(`   現在の内覧日: ${buyer.viewing_date || 'null'}`);
    console.log(`   現在の内覧時間: ${buyer.viewing_time || 'null'}`);
    console.log('');

    // 2. 内覧日・時間を更新（即時同期あり）
    console.log('2. 内覧日・時間を更新（即時同期あり）...');
    const testViewingDate = '2026-04-05';
    const testViewingTime = '14:00';

    const result = await buyerService.updateWithSync(
      buyerNumber,
      {
        viewing_date: testViewingDate,
        viewing_time: testViewingTime,
      },
      'test-user-id',
      'test@example.com',
      { force: true }
    );

    console.log(`✅ 更新完了`);
    console.log(`   同期ステータス: ${result.syncResult.syncStatus}`);
    console.log(`   同期成功: ${result.syncResult.success}`);
    
    if (result.syncResult.error) {
      console.log(`   同期エラー: ${result.syncResult.error}`);
    }
    
    console.log(`   更新後の内覧日: ${result.buyer.viewing_date || 'null'}`);
    console.log(`   更新後の内覧時間: ${result.buyer.viewing_time || 'null'}`);
    console.log('');

    // 3. DBから再取得して確認
    console.log('3. DBから再取得して確認...');
    const updatedBuyer = await buyerService.getByBuyerNumber(buyerNumber);
    
    console.log(`   DBの内覧日: ${updatedBuyer.viewing_date || 'null'}`);
    console.log(`   DBの内覧時間: ${updatedBuyer.viewing_time || 'null'}`);
    console.log('');

    // 4. 結果の検証
    console.log('4. 結果の検証...');
    
    const dbDateMatches = updatedBuyer.viewing_date === testViewingDate;
    const dbTimeMatches = updatedBuyer.viewing_time === testViewingTime;
    const syncSuccess = result.syncResult.success;

    console.log(`   DBの内覧日が一致: ${dbDateMatches ? '✅' : '❌'}`);
    console.log(`   DBの内覧時間が一致: ${dbTimeMatches ? '✅' : '❌'}`);
    console.log(`   スプレッドシート同期成功: ${syncSuccess ? '✅' : '❌'}`);
    console.log('');

    if (dbDateMatches && dbTimeMatches && syncSuccess) {
      console.log('🎉 テスト成功！内覧日・時間が正しく保存され、スプレッドシートに同期されました。');
    } else {
      console.log('❌ テスト失敗！以下の問題があります：');
      if (!dbDateMatches) console.log('   - DBの内覧日が一致しません');
      if (!dbTimeMatches) console.log('   - DBの内覧時間が一致しません');
      if (!syncSuccess) console.log('   - スプレッドシート同期に失敗しました');
    }

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }
}

// スクリプトを実行
testBuyerViewingDateSync()
  .then(() => {
    console.log('\nテスト完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('テスト実行エラー:', error);
    process.exit(1);
  });
