import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function forceSync() {
  try {
    console.log('🔄 Force syncing AA13886 to Google Spreadsheet...\n');
    
    // Step 1: Get seller ID
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('id, seller_number, land_area_verified, building_area_verified')
      .eq('seller_number', 'AA13886')
      .single();
    
    if (error || !seller) {
      console.error('❌ Seller not found:', error);
      return;
    }
    
    console.log('📊 Current database values:');
    console.log(`   - seller_number: ${seller.seller_number}`);
    console.log(`   - land_area_verified: ${seller.land_area_verified}`);
    console.log(`   - building_area_verified: ${seller.building_area_verified}`);
    console.log('');
    
    // Step 2: Import and run sync
    const { SpreadsheetSyncService } = await import('./src/services/SpreadsheetSyncService');
    const { GoogleSheetsClient } = await import('./src/services/GoogleSheetsClient');
    
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    
    console.log('🔐 Authenticating with Google Sheets...');
    await sheetsClient.authenticate();
    console.log('✅ Authenticated\n');
    
    const syncService = new SpreadsheetSyncService(sheetsClient, supabase);
    
    console.log('📤 Syncing to spreadsheet...');
    const result = await syncService.syncToSpreadsheet(seller.id);
    
    if (result.success) {
      console.log('\n✅ Sync successful!');
      console.log(`   - Operation: ${result.operation}`);
      console.log(`   - Rows affected: ${result.rowsAffected}`);
      console.log('\n📝 Please check Google Spreadsheet BT column for AA13886');
    } else {
      console.error('\n❌ Sync failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

forceSync();
