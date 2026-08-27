const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, name, match_updated_at')
    .not('match_updated_at', 'is', null)
    .order('buyer_number', { ascending: true });
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  console.log('マッチングボタンONの買主一覧:');
  console.log('買主番号 | 名前 | match_updated_at');
  console.log('---------|------|------------------');
  data.forEach(b => {
    console.log(`${b.buyer_number} | ${b.name || '(空)'} | ${b.match_updated_at}`);
  });
  console.log(`\n合計: ${data.length}件`);
})();
