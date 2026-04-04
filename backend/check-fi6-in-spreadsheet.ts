import dotenv from 'dotenv';
import { google } from 'googleapis';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const SERVICE_ACCOUNT_KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH!;

async function checkFI6InSpreadsheet() {
  console.log('🔍 Checking for FI6 in spreadsheet...\n');
  
  // Initialize Google Sheets API
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  
  const sheets = google.sheets({ version: 'v4', auth });
  
  // Get all data from spreadsheet
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '売主リスト!A:E', // A-E列（売主番号はB列）
  });
  
  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.log('❌ No data found in spreadsheet');
    return;
  }
  
  // Find FI6 (B列 = index 1)
  const fi6Rows = rows.filter(row => {
    const sellerNumber = row[1]; // B列（0-indexed: 1）
    return sellerNumber && sellerNumber.toString().toUpperCase().startsWith('FI');
  });
  
  if (fi6Rows.length === 0) {
    console.log('❌ No sellers with FI prefix found in spreadsheet');
    return;
  }
  
  console.log(`✅ Found ${fi6Rows.length} sellers with FI prefix:\n`);
  fi6Rows.forEach((row, index) => {
    console.log(`${index + 1}. Seller Number: ${row[1]}`);
    console.log(`   Name: ${row[2] || '(empty)'}`);
    console.log(`   Address: ${row[3] || '(empty)'}`);
    console.log(`   Phone: ${row[4] || '(empty)'}`);
    console.log('');
  });
}

checkFI6InSpreadsheet().catch(console.error);
