#!/usr/bin/env node
/**
 * 買主7605のDB状態と同期状況を詳しく確認するスクリプト
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URLまたはSUPABASE_SERVICE_KEYが設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer7605() {
  console.log('🔍 買主7605のDB状態を確認中...\n');

  // 1. buyer_number = '7605' で検索
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '7605')
    .maybeSingle();

  if (error) {
    console.error('❌ エラー:', error.message);
  } else if (buyer) {
    console.log('✅ 買主7605はDBに存在します');
    console.log('  buyer_number:', buyer.buyer_number);
    console.log('  name:', buyer.name);
    console.log('  reception_date:', buyer.reception_date);
    console.log('  created_at:', buyer.created_at);
    console.log('  updated_at:', buyer.updated_at);
    console.log('  last_synced_at:', buyer.last_synced_at);
    console.log('  deleted_at:', buyer.deleted_at);
    console.log('  is_deleted:', buyer.is_deleted);
  } else {
    console.log('❌ 買主7605はDBに存在しません');
  }

  console.log('\n=== 近隣の買主番号の存在確認 ===\n');

  // 近隣の買主番号を確認
  const { data: nearbyBuyers } = await supabase
    .from('buyers')
    .select('buyer_number, name, reception_date, last_synced_at, deleted_at')
    .gte('buyer_number', '7600')
    .lte('buyer_number', '7620')
    .order('buyer_number');

  if (nearbyBuyers && nearbyBuyers.length > 0) {
    console.log(`7600-7620の範囲: ${nearbyBuyers.length}件`);
    for (const b of nearbyBuyers) {
      console.log(`  ${b.buyer_number}: ${b.name || 'N/A'} (受付日: ${b.reception_date || 'N/A'}, 削除: ${b.deleted_at || 'なし'})`);
    }
  } else {
    console.log('7600-7620の範囲: 0件');
  }

  console.log('\n=== buyersテーブルの統計 ===\n');

  // 総件数
  const { count: totalCount } = await supabase
    .from('buyers')
    .select('*', { count: 'exact', head: true });
  console.log(`  総件数: ${totalCount}`);

  // 削除済みを除いた件数
  const { count: activeCount } = await supabase
    .from('buyers')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);
  console.log(`  アクティブ件数（deleted_at IS NULL）: ${activeCount}`);

  // 最大buyer_number（数値として）
  const { data: allBuyers } = await supabase
    .from('buyers')
    .select('buyer_number')
    .is('deleted_at', null);

  if (allBuyers) {
    const numbers = allBuyers
      .map(b => parseInt(b.buyer_number, 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);
    
    if (numbers.length > 0) {
      console.log(`  最小buyer_number: ${numbers[0]}`);
      console.log(`  最大buyer_number: ${numbers[numbers.length - 1]}`);
      
      // 7000以上の買主番号
      const highNumbers = numbers.filter(n => n >= 7000);
      console.log(`\n  7000以上の買主番号: ${highNumbers.length}件`);
      for (const n of highNumbers) {
        const b = allBuyers.find(b => parseInt(b.buyer_number, 10) === n);
        console.log(`    ${n}`);
      }
    }
  }

  console.log('\n=== 最近同期された買主（last_synced_at降順）===\n');

  const { data: recentSynced } = await supabase
    .from('buyers')
    .select('buyer_number, name, last_synced_at')
    .not('last_synced_at', 'is', null)
    .order('last_synced_at', { ascending: false })
    .limit(10);

  if (recentSynced && recentSynced.length > 0) {
    for (const b of recentSynced) {
      console.log(`  ${b.buyer_number}: ${b.name || 'N/A'} (最終同期: ${b.last_synced_at})`);
    }
  } else {
    console.log('  同期済み買主なし');
  }
}

checkBuyer7605().catch(console.error);
