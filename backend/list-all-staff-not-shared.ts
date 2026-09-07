import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAllStaffNotShared() {
  console.log('🔍 すべてのstaff_not_sharedフィールドを確認...\n');

  const { data: items, error } = await supabase
    .from('shared_items')
    .select('id, staff_not_shared, confirmation_date')
    .not('staff_not_shared', 'is', null)
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`📊 staff_not_sharedフィールドがあるレコード: ${items?.length || 0}件\n`);

  const staffCount = new Map<string, number>();

  items?.forEach(item => {
    const value = item.staff_not_shared;
    const confirmed = item.confirmation_date ? '✓確認済' : '✗未確認';
    console.log(`  ID ${String(item.id).padEnd(5)} [${confirmed}] "${value}"`);
    
    // 未確認のみカウント
    if (!item.confirmation_date) {
      staffCount.set(value, (staffCount.get(value) || 0) + 1);
    }
  });

  console.log('\n📋 未確認の staff_not_shared 集計:\n');
  Array.from(staffCount.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([value, count]) => {
      // バイト数を表示（全角スペースと半角スペースを区別するため）
      const bytes = Buffer.from(value, 'utf8').toString('hex');
      console.log(`  ${count}件: "${value}" (hex: ${bytes.substring(0, 40)}...)`);
    });
}

listAllStaffNotShared()
  .then(() => {
    console.log('\n✅ 完了');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ エラー:', err);
    process.exit(1);
  });
