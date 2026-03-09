import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { SellerService } from './src/services/SellerService.supabase';

async function check() {
  const service = new SellerService();
  
  // 全件取得してAA13688を探す
  const result = await service.listSellers({ page: 1, limit: 2000 });
  const sellers = (result as any).sellers || result;
  const sellersArray = Array.isArray(sellers) ? sellers : [];
  
  const aa13688 = sellersArray.find((s: any) => s.sellerNumber === 'AA13688');
  
  if (!aa13688) {
    console.log('AA13688が見つかりません');
    console.log('総件数:', sellersArray.length);
    return;
  }
  
  console.log('AA13688のSellerServiceレスポンス:');
  console.log(JSON.stringify({
    sellerNumber: aa13688.sellerNumber,
    status: aa13688.status,
    nextCallDate: aa13688.nextCallDate,
    contactMethod: aa13688.contactMethod,
    preferredContactTime: aa13688.preferredContactTime,
    phoneContactPerson: aa13688.phoneContactPerson,
    visitAssignee: aa13688.visitAssignee,
    visitAssigneeInitials: aa13688.visitAssigneeInitials,
  }, null, 2));
}

check().catch(console.error);
