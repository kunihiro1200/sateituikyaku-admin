import axios from 'axios';

// 実際のAPIエンドポイントを呼び出して AA13561 のレスポンスを確認
async function main() {
  const baseUrl = 'https://sateituikyaku-admin-backend.vercel.app';
  
  try {
    // sidebar-counts を確認
    const countsRes = await axios.get(`${baseUrl}/api/sellers/sidebar-counts`, {
      headers: {
        'Authorization': 'Bearer test' // 認証が必要な場合
      }
    });
    console.log('sidebar-counts:', JSON.stringify(countsRes.data, null, 2));
  } catch (e: any) {
    console.log('sidebar-counts error:', e.response?.status, e.response?.data || e.message);
  }
}

main().catch(console.error);
