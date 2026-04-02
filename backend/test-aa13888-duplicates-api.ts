import { config } from 'dotenv';
import axios from 'axios';

config();

async function testDuplicatesAPI() {
  console.log('🔍 AA13888の重複検出APIをテスト\n');

  const sellerId = 'dd457e95-a785-4d27-aa17-5feeeb61c21a'; // AA13888のID

  try {
    const response = await axios.get(`http://localhost:3000/api/sellers/${sellerId}/duplicates`, {
      timeout: 10000,
    });

    console.log('✅ APIレスポンス成功');
    console.log('重複件数:', response.data.duplicates?.length || 0);

    if (response.data.duplicates && response.data.duplicates.length > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 重複売主:');
      
      for (const dup of response.data.duplicates) {
        console.log('\n売主番号:', dup.sellerInfo?.sellerNumber || '(不明)');
        console.log('名前:', dup.sellerInfo?.name || '(不明)');
        console.log('マッチタイプ:', dup.matchType);
        console.log('状況:', dup.sellerInfo?.status || '(不明)');
      }
    } else {
      console.log('\n❌ 重複が検出されませんでした');
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ バックエンドサーバーが起動していません');
      console.log('   以下のコマンドでサーバーを起動してください:');
      console.log('   cd backend && npm run dev');
    } else {
      console.log('❌ エラー:', error.message);
      if (error.response) {
        console.log('ステータス:', error.response.status);
        console.log('レスポンス:', error.response.data);
      }
    }
  }
}

testDuplicatesAPI().catch(console.error);
