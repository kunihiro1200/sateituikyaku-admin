/**
 * 追客電話ランキングのデバッグスクリプト
 * 実際のスプレッドシートデータを確認する
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { GoogleSheetsClient } = await import('./src/services/GoogleSheetsClient');

  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I',
    sheetName: '売主追客ログ',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });

  await sheetsClient.authenticate();

  const rawData = await sheetsClient.readRawRange('A:G');

  console.log('=== ヘッダー行 ===');
  console.log(rawData[0]);

  console.log('\n=== 最初の5行（データ） ===');
  for (let i = 1; i <= 5 && i < rawData.length; i++) {
    console.log(`行${i + 1}:`, rawData[i]);
  }

  // 今月のデータを集計
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const year = jstNow.getUTCFullYear();
  const month = jstNow.getUTCMonth();

  const currentMonthStart = new Date(year, month, 1);
  const currentMonthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  console.log(`\n=== 集計対象月: ${year}年${month + 1}月 ===`);

  const counts = new Map<string, number>();
  let matchCount = 0;

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    const dateStr = row[0];
    const initial1 = row[4]; // E列
    const initial2 = row[5]; // F列

    if (!dateStr) continue;

    let date: Date;
    const parts = String(dateStr).split('/');
    if (parts.length === 3) {
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      // "2026-04-15 10:30:00" 形式も試す
      date = new Date(dateStr.substring(0, 10));
    }

    if (isNaN(date.getTime())) continue;
    if (date < currentMonthStart || date > currentMonthEnd) continue;

    matchCount++;
    if (initial1 && String(initial1).trim() !== '') {
      const init = String(initial1).trim();
      counts.set(init, (counts.get(init) || 0) + 1);
    }
    if (initial2 && String(initial2).trim() !== '') {
      const init = String(initial2).trim();
      counts.set(init, (counts.get(init) || 0) + 1);
    }
  }

  console.log(`当月マッチ行数: ${matchCount}`);
  console.log('\n=== ランキング結果 ===');
  const rankings = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1]);
  for (const [init, count] of rankings) {
    console.log(`  ${init}: ${count}件`);
  }

  // 最後の10行も確認
  console.log('\n=== 最後の10行 ===');
  for (let i = Math.max(1, rawData.length - 10); i < rawData.length; i++) {
    console.log(`行${i + 1}:`, rawData[i]);
  }
}

main().catch(console.error);
