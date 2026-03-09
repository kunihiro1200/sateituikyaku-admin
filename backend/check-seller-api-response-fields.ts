import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// SellerServiceのAPIレスポンスを確認
import { SellerService } from './src/services/SellerService.supabase';

async function main() {
  const service = new SellerService();
  
  // AA13688とAA13719を取得
  const sellers = await service.getSellers({ limit: 2000 });
  const targets = sellers.filter((s: any) => 
    s.sellerNumber === 'AA13688' || s.sellerNumber === 'AA13719'
  );
  
  targets.forEach((s: any) => {
    console.log(`\n${s.sellerNumber}:`);
    console.log(`  contactMethod: ${JSON.stringify(s.contactMethod)}`);
    console.log(`  preferredContactTime: ${JSON.stringify(s.preferredContactTime)}`);
    console.log(`  phoneContactPerson: ${JSON.stringify(s.phoneContactPerson)}`);
    console.log(`  visitAssignee: ${JSON.stringify(s.visitAssignee)}`);
    console.log(`  visitAssigneeInitials: ${JSON.stringify(s.visitAssigneeInitials)}`);
    // snake_case版も確認
    console.log(`  contact_method: ${JSON.stringify((s as any).contact_method)}`);
    console.log(`  preferred_contact_time: ${JSON.stringify((s as any).preferred_contact_time)}`);
    console.log(`  phone_contact_person: ${JSON.stringify((s as any).phone_contact_person)}`);
  });
}

main().catch(console.error);
