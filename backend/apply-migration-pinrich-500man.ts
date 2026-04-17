import * as dotenv from 'dotenv';
import * as path from 'path';
import * as https from 'https';
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://krxhrbtlgfjzsseegaqq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Supabase Management APIでSQLを実行する関数
function execSQLViaManagementAPI(sql: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const projectRef = 'krxhrbtlgfjzsseegaqq';
    const body = JSON.stringify({ query: sql });

    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🚀 pinrich_500man_registration マイグレーション開始');
  console.log('');

  console.log('⏳ pinrich_500man_registration カラム追加...');
  try {
    await execSQLViaManagementAPI(
      'ALTER TABLE buyers ADD COLUMN IF NOT EXISTS pinrich_500man_registration TEXT;'
    );
    console.log('  ✅ 完了');
  } catch (err: any) {
    console.error('  ❌ エラー:', err.message);
    throw err;
  }

  console.log('');
  console.log('✅ マイグレーション完了！');
  console.log('  - buyers.pinrich_500man_registration カラム追加（TEXT, nullable）');
}

main().catch(e => {
  console.error('❌ マイグレーション失敗:', e.message);
  process.exit(1);
});
