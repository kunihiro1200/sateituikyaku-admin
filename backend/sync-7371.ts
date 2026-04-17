import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { BuyerColumnMapper } from './src/services/BuyerColumnMapper';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { BuyerWriteService } from './src/services/BuyerWriteService';

async function main() {
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト',
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  });

  await sheetsClient.authenticate();

  const columnMapper = new BuyerColumnMapper();
  const writeService = new BuyerWriteService(sheetsClient, columnMapper);

  const updates = {
    property_address: '大分市城崎町1丁目4番15号',
    display_address: '城崎マンション　102-1',
    price: 2500000,
    property_assignee: '角井',
  };

  console.log('Syncing buyer 7371 to spreadsheet...');
  console.log('Updates:', JSON.stringify(updates, null, 2));

  const result = await writeService.updateFields('7371', updates);
  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
