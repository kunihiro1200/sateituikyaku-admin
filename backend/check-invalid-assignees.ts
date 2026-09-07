import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkInvalidAssignees() {
  console.log('🔍 不正な担当者名を検索...\n');

  // 全買主データから担当者名を取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, name, follow_up_assignee, initial_assignee')
    .is('deleted_at', null);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`📊 買主データ: ${buyers?.length || 0}件\n`);

  // 不正なパターンを検出
  const invalidPatterns = [
    { pattern: /未確認/, name: '「未確認」を含む' },
    { pattern: /_/, name: '「_」（アンダースコア）を含む' },
    { pattern: /＿/, name: '「＿」（全角アンダースコア）を含む' },
    { pattern: /^.{2,}$/, name: '2文字以上（フルネームの可能性）' }
  ];

  invalidPatterns.forEach(({ pattern, name }) => {
    console.log(`\n🔍 ${name}:\n`);
    
    const matchingBuyers = buyers?.filter(b => {
      const followUpMatch = b.follow_up_assignee && pattern.test(b.follow_up_assignee);
      const initialMatch = b.initial_assignee && pattern.test(b.initial_assignee);
      return followUpMatch || initialMatch;
    }) || [];

    if (matchingBuyers.length === 0) {
      console.log('  ✅ 該当なし');
    } else {
      console.log(`  ❌ ${matchingBuyers.length}件見つかりました:\n`);
      matchingBuyers.slice(0, 20).forEach(b => {
        console.log(`    ${b.buyer_number} (${b.name || '名前なし'})`);
        if (b.follow_up_assignee && pattern.test(b.follow_up_assignee)) {
          console.log(`      後続担当: "${b.follow_up_assignee}"`);
        }
        if (b.initial_assignee && pattern.test(b.initial_assignee)) {
          console.log(`      初動担当: "${b.initial_assignee}"`);
        }
      });
      
      if (matchingBuyers.length > 20) {
        console.log(`    ... 他 ${matchingBuyers.length - 20}件`);
      }
    }
  });

  // 担当者名の統計
  console.log('\n\n📊 担当者名の統計:\n');
  const assigneeCount = new Map<string, number>();
  
  buyers?.forEach(b => {
    if (b.follow_up_assignee) {
      assigneeCount.set(b.follow_up_assignee, (assigneeCount.get(b.follow_up_assignee) || 0) + 1);
    }
    if (b.initial_assignee) {
      assigneeCount.set(b.initial_assignee, (assigneeCount.get(b.initial_assignee) || 0) + 1);
    }
  });

  const sortedAssignees = Array.from(assigneeCount.entries())
    .sort((a, b) => b[1] - a[1]);

  sortedAssignees.forEach(([assignee, count]) => {
    const hasInvalid = /未確認|_|＿/.test(assignee) || assignee.length > 2;
    const mark = hasInvalid ? '❌' : '✅';
    console.log(`  ${mark} ${assignee.padEnd(20)} ${count}件`);
  });
}

checkInvalidAssignees()
  .then(() => {
    console.log('\n✅ 完了');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ エラー:', err);
    process.exit(1);
  });
