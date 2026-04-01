import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { SpreadsheetSyncService } from './src/services/SpreadsheetSyncService';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function forceSyncBuildingArea() {
  const sellerNumber = 'AA13886';
  
  console.log(`\n🔄 [Force Sync] Starting sync for ${sellerNumber}...\n`);
  
  // 1. sellersテーブルからseller_idを取得
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id, seller_number, building_area_verified')
    .eq('seller_number', sellerNumber)
    .single();
  
  if (sellerError || !seller) {
    console.error('❌ [Force Sync] Error fetching seller:', sellerError);
    return;
  }
  
  console.log('📊 [Force Sync] Seller data:');
  console.log(`  - ID: ${seller.id}`);
  console.log(`  - Seller Number: ${seller.seller_number}`);
  console.log(`  - building_area_verified: ${seller.building_area_verified}`);
  
  // 2. SpreadsheetSyncServiceを使用して同期
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || 'google-service-account.json',
  });
  
  await sheetsClient.authenticate();
  
  const syncService = new SpreadsheetSyncService(sheetsClient, supabase);
  
  console.log('\n🔄 [Force Sync] Syncing to spreadsheet...');
  const result = await syncService.syncToSpreadsheet(seller.id);
  
  if (result.success) {
    console.log(`\n✅ [Force Sync] Sync successful!`);
    console.log(`  - Operation: ${result.operation}`);
    console.log(`  - Rows affected: ${result.rowsAffected}`);
  } else {
    console.error(`\n❌ [Force Sync] Sync failed:`, result.error);
  }
}

forceSyncBuildingArea().catch(console.error);
