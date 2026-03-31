/**
 * 既存データで名前が「不明」になっている売主を検出するスクリプト
 * 
 * 実行方法:
 * npx ts-node backend/detect-unknown-names.ts
 */
import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { decrypt } from './src/utils/encryption';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function detectUnknownNames() {
  console.log('🔍 Detecting sellers with "不明" name...\n');

  // Supabaseクライアントを初期化
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Google Sheetsクライアントを初期化
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH!,
  });
  await sheetsClient.authenticate();

  // スプレッドシートから全データを取得
  console.log('📊 Fetching spreadsheet data...');
  const allRows = await sheetsClient.readAll();
  const sheetDataBySellerNumber = new Map<string, any>();
  
  for (const row of allRows) {
    const sellerNumber = row['売主番号'];
    if (sellerNumber) {
      sheetDataBySellerNumber.set(String(sellerNumber), row);
    }
  }
  console.log(`✅ Loaded ${sheetDataBySellerNumber.size} sellers from spreadsheet\n`);

  // DBから名前が「不明」の売主を取得（ページネーション対応）
  console.log('📊 Fetching sellers with "不明" name from database...');
  const unknownNameSellers: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('sellers')
      .select('id, seller_number, name')
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('❌ Error fetching sellers:', error.message);
      throw error;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      for (const seller of data) {
        if (seller.name) {
          try {
            const decryptedName = decrypt(seller.name);
            if (decryptedName === '不明') {
              unknownNameSellers.push(seller);
            }
          } catch (e) {
            // 復号エラーは無視（暗号化されていないデータの可能性）
          }
        }
      }
      offset += pageSize;
      
      if (data.length < pageSize) {
        hasMore = false;
      }
    }
  }

  console.log(`✅ Found ${unknownNameSellers.length} sellers with "不明" name\n`);

  if (unknownNameSellers.length === 0) {
    console.log('🎉 No sellers with "不明" name found!');
    return;
  }

  // スプレッドシートと比較
  console.log('📋 Comparing with spreadsheet data...\n');
  
  const needsUpdate: Array<{ sellerNumber: string; currentName: string; sheetName: string }> = [];
  const stillEmpty: string[] = [];

  for (const seller of unknownNameSellers) {
    const sellerNumber = seller.seller_number;
    const sheetRow = sheetDataBySellerNumber.get(sellerNumber);
    
    if (!sheetRow) {
      console.log(`⚠️  ${sellerNumber}: Not found in spreadsheet (deleted?)`);
      continue;
    }

    const sheetName = sheetRow['名前(漢字のみ）'];
    
    if (sheetName && sheetName !== '') {
      needsUpdate.push({
        sellerNumber,
        currentName: '不明',
        sheetName: String(sheetName),
      });
      console.log(`🔄 ${sellerNumber}: DB="不明", Sheet="${sheetName}" → Needs update`);
    } else {
      stillEmpty.push(sellerNumber);
      console.log(`⚠️  ${sellerNumber}: DB="不明", Sheet=empty → Still empty`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Total sellers with "不明": ${unknownNameSellers.length}`);
  console.log(`   Needs update (sheet has name): ${needsUpdate.length}`);
  console.log(`   Still empty (sheet also empty): ${stillEmpty.length}`);

  if (needsUpdate.length > 0) {
    console.log('\n💡 To fix these sellers, run:');
    console.log('   npx ts-node backend/fix-unknown-names.ts');
  }
}

detectUnknownNames().catch(console.error);
