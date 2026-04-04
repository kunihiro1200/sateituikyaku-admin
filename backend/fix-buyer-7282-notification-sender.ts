/**
 * 買主7282の通知送信者を「R」に戻す
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { BuyerColumnMapper } from './src/services/BuyerColumnMapper';
import { BuyerWriteService } from './src/services/BuyerWriteService';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID || '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト';

async function fixBuyer7282() {
  console.log('🔧 買主7282の通知送信者を「R」に戻します');
  
  try {
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: SHEET_NAME,
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH
    });
    
    await sheetsClient.authenticate();
    
    const columnMapper = new BuyerColumnMapper();
    const writeService = new BuyerWriteService(sheetsClient, columnMapper);
    
    // 「R」に戻す
    const result = await writeService.updateFields('7282', {
      notification_sender: 'R'
    });
    
    if (result.success) {
      console.log('✅ 成功: スプレッドシートを「R」に戻しました');
    } else {
      console.error('❌ 失敗:', result.error);
    }
    
  } catch (error: any) {
    console.error('❌ エラー:', error);
  }
}

fixBuyer7282().catch(console.error);
