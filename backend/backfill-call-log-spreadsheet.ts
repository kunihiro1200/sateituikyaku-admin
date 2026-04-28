/**
 * 売主追客ログスプレッドシートへの一括バックフィルスクリプト
 * 2026-04-13以降のphone_callアクティビティをスプレッドシートに追記する
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SPREADSHEET_ID = '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I';
const SHEET_NAME = '売主追客ログ';
const BACKFILL_FROM = '2026-04-13T00:00:00+09:00';

async function main() {
  const supabase = (await import('./src/config/supabase')).default;
  const { GoogleSheetsClient } = await import('./src/services/GoogleSheetsClient');

  // 1. スプレッドシートの既存データを取得（重複チェック用）
  console.log('スプレッドシートの既存データを取得中...');
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await sheetsClient.authenticate();

  const rawData = await sheetsClient.readRawRange('A:C');
  const headers = rawData[0];
  const dateIdx = headers.findIndex((h: string) => h === '日付');
  const keyIdx = headers.findIndex((h: string) => h === '売主追客ログID');
  const sellerIdx = headers.findIndex((h: string) => h === '売主番号');

  console.log(`ヘッダー: ${JSON.stringify(headers)}`);
  console.log(`既存行数: ${rawData.length - 1}`);

  // 既存のactivityIDセット（重複防止）
  const existingKeys = new Set<string>();
  for (let i = 1; i < rawData.length; i++) {
    const key = rawData[i][keyIdx];
    if (key) existingKeys.add(String(key).trim());
  }
  console.log(`既存キー数: ${existingKeys.size}`);

  // 2. DBから2026-04-13以降のphone_callを取得
  console.log(`\nDBから${BACKFILL_FROM}以降のphone_callを取得中...`);
  const { data: activities, error } = await supabase
    .from('activities')
    .select(`
      id,
      seller_id,
      type,
      created_at,
      employees:employee_id (
        id,
        name,
        initials
      )
    `)
    .eq('type', 'phone_call')
    .gte('created_at', BACKFILL_FROM)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('DBエラー:', error);
    process.exit(1);
  }

  console.log(`取得件数: ${activities?.length ?? 0}`);

  if (!activities || activities.length === 0) {
    console.log('バックフィル対象なし');
    return;
  }

  // 3. 売主番号を一括取得
  const sellerIds = [...new Set(activities.map((a: any) => a.seller_id))];
  const { data: sellers } = await supabase
    .from('sellers')
    .select('id, seller_number')
    .in('id', sellerIds);

  const sellerMap = new Map<string, string>();
  for (const s of sellers || []) {
    sellerMap.set(s.id, s.seller_number);
  }

  // 4. 未記録分を書き込み
  let skipped = 0;
  let written = 0;
  let failed = 0;

  for (const activity of activities) {
    const shortId = activity.id.substring(0, 8);

    // 重複チェック
    if (existingKeys.has(shortId)) {
      skipped++;
      continue;
    }

    const sellerNumber = sellerMap.get(activity.seller_id);
    if (!sellerNumber) {
      console.warn(`  売主番号不明: seller_id=${activity.seller_id}`);
      failed++;
      continue;
    }

    const emp = (activity as any).employees;
    const initials = emp?.initials || emp?.name || '?';

    // JST日時文字列
    const createdAt = new Date(activity.created_at);
    const jstDate = new Date(createdAt.getTime() + 9 * 60 * 60 * 1000);
    const jstDateString = jstDate.toISOString().replace('T', ' ').substring(0, 19);

    const rowData: Record<string, string> = {
      '日付': jstDateString,
      '売主追客ログID': shortId,
      '売主番号': sellerNumber,
      '担当（前半）': initials,
    };

    try {
      await sheetsClient.appendRow(rowData);
      console.log(`  ✅ ${sellerNumber} by ${initials} at ${jstDateString}`);
      written++;
      // レート制限対策
      await new Promise(r => setTimeout(r, 300));
    } catch (err: any) {
      console.error(`  ❌ ${sellerNumber}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== 完了 ===`);
  console.log(`書き込み: ${written}件`);
  console.log(`スキップ（既存）: ${skipped}件`);
  console.log(`失敗: ${failed}件`);
}

main().catch(console.error);
