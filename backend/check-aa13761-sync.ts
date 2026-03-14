import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
  const service = new EnhancedAutoSyncService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  await service.initialize();
  
  console.log('Detecting updated sellers...');
  const updated = await service.detectUpdatedSellers();
  console.log('Updated sellers count:', updated.length);
  const aa13761 = updated.find(s => s === 'AA13761');
  console.log('AA13761 in updated list:', aa13761 ? 'YES' : 'NO');
  if (updated.length > 0) {
    console.log('First 10 updated:', updated.slice(0, 10).join(', '));
  }
}

main().catch(console.error);
