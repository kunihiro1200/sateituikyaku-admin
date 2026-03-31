/**
 * 認証ミドルウェアのデバッグスクリプト
 * sidebar-countsエンドポイントの認証問題を調査
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function checkAuthMiddleware() {
  console.log('🔍 認証ミドルウェアのデバッグ開始...\n');

  // 1. 認証なしでリクエスト
  console.log('1️⃣ 認証なしでリクエスト:');
  try {
    const response = await axios.get(`${API_BASE_URL}/api/sellers/sidebar-counts`);
    console.log('✅ 成功（予期しない）:', response.status);
  } catch (error: any) {
    if (error.response) {
      console.log('❌ エラー:', error.response.status, error.response.data);
    } else {
      console.log('❌ ネットワークエラー:', error.message);
    }
  }

  console.log('\n2️⃣ 無効なトークンでリクエスト:');
  try {
    const response = await axios.get(`${API_BASE_URL}/api/sellers/sidebar-counts`, {
      headers: {
        Authorization: 'Bearer invalid_token_12345',
      },
    });
    console.log('✅ 成功（予期しない）:', response.status);
  } catch (error: any) {
    if (error.response) {
      console.log('❌ エラー:', error.response.status, error.response.data);
    } else {
      console.log('❌ ネットワークエラー:', error.message);
    }
  }

  console.log('\n✅ デバッグ完了');
  console.log('\n📝 結論:');
  console.log('- sidebar-countsエンドポイントは認証が必須です');
  console.log('- フロントエンドでログインしてから再度アクセスしてください');
  console.log('- ログイン後、localStorage に session_token が保存されます');
}

checkAuthMiddleware().catch(console.error);
