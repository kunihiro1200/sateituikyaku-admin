import axios from 'axios';

const BACKEND_URL = 'https://sateituikyaku-admin-backend.vercel.app';

async function testActivityLogsAPI() {
  console.log('=== activity-logs APIのテスト ===\n');

  try {
    // 認証トークンを取得（ローカルストレージから）
    console.log('⚠️ 注意: このスクリプトは認証トークンが必要です');
    console.log('ブラウザのコンソールで以下を実行してトークンを取得してください:');
    console.log('localStorage.getItem("session_token")');
    console.log('');

    // ダミートークンでテスト（401エラーが期待される）
    const response = await axios.get(`${BACKEND_URL}/api/activity-logs`, {
      params: {
        target_type: 'buyer',
        target_id: '6752',
      },
      headers: {
        Authorization: 'Bearer dummy-token',
      },
    });

    console.log('✅ レスポンス:', response.data);
  } catch (error: any) {
    if (error.response) {
      console.log('⚠️ エラーレスポンス:');
      console.log('   Status:', error.response.status);
      console.log('   Data:', error.response.data);
    } else {
      console.error('❌ リクエスト失敗:', error.message);
    }
  }
}

testActivityLogsAPI().catch(console.error);
