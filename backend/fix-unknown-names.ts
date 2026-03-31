/**
 * 名前が「不明」になっている売主を自動修正するスクリプト
 * 
 * 実行方法:
 * npx ts-node backend/fix-unknown-names.ts
 */
import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { decrypt, encrypt } from './src/utils/encryption';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function fixUnknownNames() {
  console.log('🔧 Fixing sellers with "不明" name...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH!,
  });
  await sheetsClient.authenticate();

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
            // 復号エラーは無視
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

  console.log('🔧 Updating sellers...\n');
  
  let updatedCount = 0;
  let skippedCount = 0;

  for (const seller of unknownNameSellers) {
    const sellerNumber = seller.seller_number;
    const sheetRow = sheetDataBySellerNumber.get(sellerNumber);
    
    if (!sheetRow) {
      console.log(`⚠️  ${sellerNumber}: Not found in spreadsheet (skipped)`);
      skippedCount++;
      continue;
    }

    const sheetName = sheetRow['名前(漢字のみ）'];
    
    if (!sheetName || sheetName === '') {
      console.log(`⚠️  ${sellerNumber}: Sheet name is also empty (skipped)`);
      skippedCount++;
      continue;
    }

    // 名前を更新
    const encryptedName = encrypt(String(sheetName));
    const { error } = await supabase
      .from('sellers')
      .update({ name: encryptedName })
      .eq('id', seller.id);

    if (error) {
      console.error(`❌ ${sellerNumber}: Update failed - ${error.message}`);
    } else {
      console.log(`✅ ${sellerNumber}: Updated to "${sheetName}"`);
      updatedCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Total sellers with "不明": ${unknownNameSellers.length}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log('\n🎉 Done!');
}

fixUnknownNames().catch(console.error);
