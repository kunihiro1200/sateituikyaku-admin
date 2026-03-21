/**
 * スタッフ管理シートのE列（メアド）を確認するスクリプト
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { StaffManagementService } from './src/services/StaffManagementService';

async function main() {
  const service = new StaffManagementService();
  
  console.log('スタッフ管理シートのメールアドレス一覧を取得中...');
  
  try {
    const staffData = await service.fetchStaffData();
    
    console.log(`\n合計 ${staffData.length} 件のスタッフデータを取得`);
    console.log('\n=== メールアドレス一覧 ===');
    
    staffData.forEach((staff, i) => {
      console.log(`[${i + 1}] イニシャル: ${staff.initials || '(なし)'} | 名前: ${staff.name || '(なし)'} | メール: ${staff.email || '(空欄)'}`);
    });
    
    const emailsOnly = staffData.filter(s => s.email).map(s => s.email);
    console.log(`\n=== メールアドレスがある件数: ${emailsOnly.length} ===`);
    emailsOnly.forEach(e => console.log(' -', e));
    
  } catch (error: any) {
    console.error('エラー:', error.message);
  }
}

main();
