import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

async function checkColumn() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  
  console.log('SUPABASE_URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT SET');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // AA13814のvaluation_reasonを確認
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, valuation_reason, valuation_method')
    .eq('seller_number', 'AA13814')
    .single();
  
  if (error) {
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    // カラムが存在しない場合は "column sellers.valuation_reason does not exist" のようなエラー
    return;
  }
  
  console.log('AA13814のデータ:');
  console.log('  valuation_reason:', data?.valuation_reason);
  console.log('  valuation_method:', data?.valuation_method);
  
  // カラム一覧を確認（information_schema経由）
  const { data: columns, error: colError } = await supabase
    .rpc('get_table_columns', { table_name: 'sellers' })
    .select('*');
  
  if (colError) {
    // RPCが存在しない場合は別の方法で確認
    console.log('\nRPC not available, checking via direct query...');
    
    // sellersテーブルから1行取得してカラム名を確認
    const { data: sample, error: sampleError } = await supabase
      .from('sellers')
      .select('*')
      .limit(1)
      .single();
    
    if (sample) {
      const hasValuationReason = 'valuation_reason' in sample;
      console.log('\nvaluation_reasonカラムが存在するか:', hasValuationReason);
      console.log('利用可能なカラム（valuation関連）:', 
        Object.keys(sample).filter(k => k.includes('valuation')));
    }
  }
}

checkColumn().catch(console.error);
