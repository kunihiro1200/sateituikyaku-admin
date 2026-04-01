// GOOGLE_SERVICE_ACCOUNT_JSON環境変数をテスト
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const jsonString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

console.log('環境変数の長さ:', jsonString?.length || 0);
console.log('先頭50文字:', jsonString?.substring(0, 50));
console.log('末尾50文字:', jsonString?.substring((jsonString?.length || 0) - 50));

try {
  const parsed = JSON.parse(jsonString!);
  console.log('\n✅ JSONパース成功');
  console.log('client_email:', parsed.client_email);
  console.log('project_id:', parsed.project_id);
  console.log('private_key exists:', !!parsed.private_key);
} catch (error: any) {
  console.log('\n❌ JSONパース失敗:', error.message);
}
