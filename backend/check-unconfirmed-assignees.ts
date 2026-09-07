import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUnconfirmedAssignees() {
  console.log('🔍 担当者名に「未確認」を含む買主を検索...\n');

  // 買主データを取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, name, follow_up_assignee, initial_assignee, phone_number')
    .or('follow_up_assignee.ilike.%未確認%,initial_assignee.ilike.%未確認%')
    .is('deleted_at', null);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`📊 検索結果: ${buyers?.length || 0}件\n`);

  if (!buyers || buyers.length === 0) {
    console.log('✅ 「未確認」を含む担当者名は見つかりませんでした');
    return;
  }

  // グループ化して表示
  const groupedByAssignee: Record<string, any[]> = {};

  buyers.forEach(buyer => {
    const assignee = buyer.follow_up_assignee || buyer.initial_assignee || '';
    if (!groupedByAssignee[assignee]) {
      groupedByAssignee[assignee] = [];
    }
    groupedByAssignee[assignee].push(buyer);
  });

  console.log('📋 担当者名ごとの内訳:\n');
  Object.entries(groupedByAssignee).forEach(([assignee, list]) => {
    console.log(`  ${assignee}: ${list.length}件`);
    list.forEach(b => {
      console.log(`    - ${b.buyer_number} (${b.name || '名前なし'})`);
      console.log(`      後続: ${b.follow_up_assignee || '(空)'}`);
      console.log(`      初動: ${b.initial_assignee || '(空)'}`);
    });
    console.log('');
  });

  // 修正提案
  console.log('\n💡 修正提案:\n');
  
  // 「＿未確認」を含む担当者名のパターンを分析
  const patterns = new Map<string, string[]>();
  
  buyers.forEach(buyer => {
    const assignee = buyer.follow_up_assignee || buyer.initial_assignee || '';
    if (assignee.includes('＿未確認')) {
      const baseName = assignee.replace(/＿未確認/g, '').replace(/_未確認/g, '');
      if (!patterns.has(baseName)) {
        patterns.set(baseName, []);
      }
      patterns.get(baseName)!.push(buyer.buyer_number);
    }
  });

  patterns.forEach((buyerNumbers, baseName) => {
    console.log(`  "${baseName}＿未確認" → "${baseName}" に統一すべき買主:`);
    buyerNumbers.forEach(num => {
      console.log(`    - ${num}`);
    });
    console.log('');
  });
}

checkUnconfirmedAssignees()
  .then(() => {
    console.log('✅ 完了');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ エラー:', err);
    process.exit(1);
  });
