import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPinrichBuyers() {
  console.log('ピンリッチ未登録の買主を検索中...\n');
  
  // ピンリッチ未登録の条件:
  // 1. pinrich が空 かつ email が非空 かつ broker_inquiry が空
  // 2. pinrich = "登録無し" かつ email が非空 かつ broker_inquiry が空
  
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, pinrich, email, broker_inquiry')
    .or('pinrich.is.null,pinrich.eq.登録無し')
    .not('email', 'is', null)
    .order('buyer_number', { ascending: true });
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  console.log(`取得した買主数: ${buyers?.length || 0}\n`);
  
  // broker_inquiry が空の買主のみフィルタ
  const filtered = buyers?.filter(b => !b.broker_inquiry) || [];
  
  console.log(`broker_inquiry が空の買主数: ${filtered.length}\n`);
  
  // 最初の10件を表示
  filtered.slice(0, 10).forEach(b => {
    console.log(`買主番号: ${b.buyer_number}`);
    console.log(`  pinrich: "${b.pinrich}"`);
    console.log(`  email: "${b.email}"`);
    console.log(`  broker_inquiry: "${b.broker_inquiry}"`);
    console.log('');
  });
}

checkPinrichBuyers();
