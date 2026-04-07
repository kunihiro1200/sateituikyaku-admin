import { StaffSyncService } from './src/services/StaffSyncService';
import * as dotenv from 'dotenv';

dotenv.config();

async function syncStaff() {
  console.log('=== スタッフ同期を開始 ===\n');
  
  const staffSyncService = new StaffSyncService();
  
  try {
    await staffSyncService.syncStaff();
    console.log('\n=== スタッフ同期が完了しました ===');
  } catch (error) {
    console.error('\n=== スタッフ同期が失敗しました ===');
    console.error(error);
    process.exit(1);
  }
}

syncStaff();
