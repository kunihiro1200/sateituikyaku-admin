/**
 * 買主追加同期APIを呼び出すスクリプト
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

// .envファイルを読み込む
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function callBuyerSyncAPI() {
  console.log('🔄 買主追加同期APIを呼び出し中...\n');

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const apiUrl = `${backendUrl}/api/sync?buyerAddition=true&additionOnly=true`;

  console.log(`📡 API URL: ${apiUrl}\n`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ API呼び出し成功\n');
    console.log('📋 結果:');
    console.log('   成功:', result.success);
    console.log('   メッセージ:', result.message);
    console.log('   追加件数:', result.data?.added || 0);
    console.log('   エラー件数:', result.data?.errors || 0);
    
    if (result.data?.errors > 0) {
      console.log('\n⚠️ エラーが発生しました');
    }
    
  } catch (error: any) {
    console.error('\n❌ エラー:', error.message);
    throw error;
  }
}

callBuyerSyncAPI()
  .then(() => {
    console.log('\n✅ 処理完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 処理失敗:', error);
    process.exit(1);
  });
