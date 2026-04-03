import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を最初に読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer5641() {
  console.log('📊 買主5641のデータを確認中...\n');

  // データベースから買主5641を取得
  const { data, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '5641')
    .single();

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!data) {
    console.log('⚠️  買主5641が見つかりません');
    return;
  }

  console.log('✅ 買主5641のデータ:\n');
  console.log('買主番号:', data.buyer_number);
  console.log('名前:', data.name);
  console.log('内覧日:', data.viewing_date);
  console.log('内覧時間:', data.viewing_time);
  console.log('更新日時:', data.updated_at);
  console.log('\n📋 重要フィールド:');
  console.log('  viewing_date:', data.viewing_date);
  console.log('  viewing_time:', data.viewing_time);
  console.log('  viewing_assignee:', data.viewing_assignee);
}

checkBuyer5641().catch(console.error);
