const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// EnhancedBuyerDistributionServiceを直接インポートして実行
// TypeScriptなのでts-nodeが必要。代わりにAPIを直接呼び出す
const https = require('https');
const http = require('http');

// ローカルサーバーが起動していない場合は、Supabaseで直接確認
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const targetEmail = 'tomoko.kunihiro@ifoo-oita.com';
  
  // 実際のfetchAllBuyersと同じクエリ
  let allBuyers = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('buyers')
      .select('buyer_number, name, email, desired_area, distribution_type, latest_status, desired_property_type, price_range_apartment, price_range_house, price_range_land')
      .not('email', 'is', null)
      .neq('email', '')
      .eq('distribution_type', '要')
      .is('deleted_at', null)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    if (data && data.length > 0) {
      allBuyers = allBuyers.concat(data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`Total buyers fetched: ${allBuyers.length}`);
  
  // 対象メールアドレスの買主を確認
  const targetBuyers = allBuyers.filter(b => b.email?.toLowerCase() === targetEmail.toLowerCase());
  console.log(`\nBuyers with email ${targetEmail}:`);
  console.log(JSON.stringify(targetBuyers, null, 2));
  
  // 7646が含まれているか確認
  const has7646 = targetBuyers.some(b => b.buyer_number === '7646');
  console.log(`\nBuyer 7646 in fetched list: ${has7646}`);
  
  // 価格帯フィルターの詳細確認（戸建、8900万円）
  console.log('\n=== Price Range Filter Detail ===');
  const propertyPrice = 89000000; // 8900万円
  const propertyType = '戸建';
  
  for (const buyer of targetBuyers) {
    let priceRangeTexts = [];
    if (propertyType === '戸建' || propertyType === '戸建て' || propertyType === '戸') {
      priceRangeTexts = buyer.price_range_house ? [buyer.price_range_house] : [];
    }
    
    console.log(`\nBuyer ${buyer.buyer_number}:`);
    console.log(`  price_range_house: ${buyer.price_range_house}`);
    console.log(`  priceRangeTexts: ${JSON.stringify(priceRangeTexts)}`);
    
    // 価格帯チェック
    if (priceRangeTexts.length === 0 || priceRangeTexts.every(t => !t || t.includes('指定なし') || t.trim() === '')) {
      console.log(`  Price filter: PASS (指定なし or empty)`);
    } else {
      let matched = false;
      for (const text of priceRangeTexts) {
        if (!text || text.includes('指定なし') || text.trim() === '') continue;
        
        // 範囲チェック
        const rangeMatch = text.match(/(\d+)(?:万円?)?[～~](\d+)(?:万円?)?/);
        if (rangeMatch) {
          const min = parseInt(rangeMatch[1]) * 10000;
          const max = parseInt(rangeMatch[2]) * 10000;
          console.log(`  Range: ${min}~${max}, Property: ${propertyPrice}`);
          if (propertyPrice >= min && propertyPrice <= max) {
            matched = true;
            console.log(`  Price filter: PASS (range match)`);
          } else {
            console.log(`  Price filter: FAIL (out of range)`);
          }
        }
        
        // 以上チェック
        const minOnlyMatch = text.match(/(\d+)万円以上/);
        if (minOnlyMatch) {
          const min = parseInt(minOnlyMatch[1]) * 10000;
          console.log(`  Min: ${min}, Property: ${propertyPrice}`);
          if (propertyPrice >= min) {
            matched = true;
            console.log(`  Price filter: PASS (min match)`);
          } else {
            console.log(`  Price filter: FAIL (below min)`);
          }
        }
        
        // 以下チェック
        const maxOnlyMatch = text.match(/^(\d+)万円以下$/);
        if (maxOnlyMatch) {
          const max = parseInt(maxOnlyMatch[1]) * 10000;
          console.log(`  Max: ${max}, Property: ${propertyPrice}`);
          if (propertyPrice <= max) {
            matched = true;
            console.log(`  Price filter: PASS (max match)`);
          } else {
            console.log(`  Price filter: FAIL (above max)`);
          }
        }
        
        // 3000万円台などの特殊フォーマット
        const senManMatch = text.match(/(\d+)万円台/);
        if (senManMatch) {
          console.log(`  Special format "万円台": ${text} - cannot parse, treating as FAIL`);
        }
      }
      if (!matched) {
        console.log(`  Price filter: FAIL (no match)`);
      }
    }
  }
}

main().catch(console.error);
