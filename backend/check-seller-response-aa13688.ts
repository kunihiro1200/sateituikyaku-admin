import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { SellerService } from './src/services/SellerService.supabase';

async function main() {
  const service = new SellerService();
  
  // AA13688を直接取得
  const { data: raw } = await (service as any).table('sellers')
    .select('*')
    .eq('seller_number', 'AA13688')
    .single();
  
  console.log('DB raw:', {
    contact_method: raw?.contact_method,
    preferred_contact_time: raw?.preferred_contact_time,
    phone_contact_person: raw?.phone_contact_person,
  });
  
  // decryptSellerを通した結果
  const decrypted = await (service as any).decryptSeller(raw);
  console.log('decrypted:', {
    contactMethod: decrypted?.contactMethod,
    preferredContactTime: decrypted?.preferredContactTime,
    phoneContactPerson: decrypted?.phoneContactPerson,
  });
}

main().catch(console.error);
