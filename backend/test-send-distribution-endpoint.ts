import axios from 'axios';

const BACKEND_URL = 'https://baikyaku-property-site3.vercel.app';

async function testSendDistributionEndpoint() {
  console.log('=== send-distributionエンドポイントのテスト ===\n');

  try {
    // まず、エンドポイントが存在するか確認（OPTIONS リクエスト）
    console.log('1. エンドポイントの存在確認...');
    const optionsResponse = await axios.options(`${BACKEND_URL}/api/emails/send-distribution`);
    console.log('✅ エンドポイントが存在します');
    console.log('   Status:', optionsResponse.status);
    console.log('   Headers:', optionsResponse.headers);
  } catch (error: any) {
    if (error.response) {
      console.log('⚠️ エンドポイントのレスポンス:', error.response.status);
      console.log('   Headers:', error.response.headers);
    } else {
      console.error('❌ エンドポイントへの接続失敗:', error.message);
    }
  }

  console.log('\n2. 認証なしでPOSTリクエスト（401エラーが期待される）...');
  try {
    const response = await axios.post(`${BACKEND_URL}/api/emails/send-distribution`, {
      senderAddress: 'tenant@ifoo-oita.com',
      recipients: [{ email: 'test@example.com', buyerNumber: '6752' }],
      subject: 'テスト',
      body: 'テスト本文',
      propertyNumber: 'BB14',
      source: 'buyer_candidate_list',
    });
    console.log('⚠️ 認証なしでリクエストが成功しました（予期しない動作）');
    console.log('   Status:', response.status);
  } catch (error: any) {
    if (error.response) {
      console.log('✅ 認証エラーが返されました（期待通り）');
      console.log('   Status:', error.response.status);
      console.log('   Message:', error.response.data?.message || error.response.data);
    } else {
      console.error('❌ リクエスト失敗:', error.message);
    }
  }

  console.log('\n=== テスト完了 ===');
}

testSendDistributionEndpoint().catch(console.error);
