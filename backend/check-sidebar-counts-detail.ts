import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { SellerService } from './src/services/SellerService.supabase';

async function check() {
  const service = new SellerService();
  const counts = await service.getSidebarCounts();
  console.log('サイドバーカウント:');
  console.log(JSON.stringify({
    todayCall: counts.todayCall,
    todayCallWithInfo: counts.todayCallWithInfo,
    todayCallAssigned: counts.todayCallAssigned,
    visitScheduled: counts.visitScheduled,
    visitCompleted: counts.visitCompleted,
    unvaluated: counts.unvaluated,
    mailingPending: counts.mailingPending,
    todayCallNotStarted: counts.todayCallNotStarted,
    pinrichEmpty: counts.pinrichEmpty,
  }, null, 2));
}

check().catch(console.error);
