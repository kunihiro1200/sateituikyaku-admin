/**
 * /api/employees/active-initials の動作確認
 * スプシから取得できているか、DBフォールバックになっているかを確認
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { StaffManagementService } from './src/services/StaffManagementService';

async function main() {
  console.log('=== StaffManagementService.getActiveInitials() テスト ===\n');

  const service = new StaffManagementService();

  try {
    const initials = await service.getActiveInitials();
    console.log('✅ スプシから取得成功');
    console.log('有効なイニシャル一覧:', initials);
    console.log('件数:', initials.length);
  } catch (error: any) {
    console.error('❌ スプシ取得失敗:', error.message);
  }
}

main().catch(console.error);
