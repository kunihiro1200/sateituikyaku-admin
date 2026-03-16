import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

// BuyerService を直接インスタンス化して getLinkedProperties を呼ぶ
import { BuyerService } from './src/services/BuyerService';

async function main() {
  const buyerService = new BuyerService();
  
  console.log('--- getLinkedProperties("6955") を直接呼び出し ---');
  try {
    const result = await buyerService.getLinkedProperties('6955');
    console.log('結果:', JSON.stringify(result, null, 2));
    console.log('件数:', result.length);
  } catch (e: any) {
    console.log('エラー:', e.message);
  }
}

main().catch(console.error);
