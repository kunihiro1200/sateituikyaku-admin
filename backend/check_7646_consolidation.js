const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function extractAreaNumbers(text) {
  if (!text) return [];
  const areaPattern = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿]/g;
  const matches = text.match(areaPattern) || [];
  return [...new Set(matches)];
}

function isMorePermissiveStatus(status1, status2) {
  const priority = {
    'C': 3,
    'B': 2,
    'A': 2,
    'D': 1
  };
  const p1 = priority[status1 || ''] || 2;
  const p2 = priority[status2 || ''] || 2;
  return p1 > p2;
}

function isMorePermissiveDistributionType(type1, type2) {
  const priority = {
    '要': 3,
    'mail': 2,
    'LINE→mail': 1
  };
  const p1 = priority[type1 || ''] || 0;
  const p2 = priority[type2 || ''] || 0;
  return p1 > p2;
}

function filterByDistributionFlag(distributionType) {
  const dt = (distributionType || '').trim();
  return dt === '要' || dt === 'mail' || dt === '配信希望' || dt.includes('LINE→mail');
}

function filterByLatestStatus(status) {
  const s = status || '';
  if (s.includes('買付') || s.includes('D')) {
    return false;
  }
  return true;
}

async function main() {
  const targetEmail = 'tomoko.kunihiro@ifoo-oita.com';
  
  // distribution_type='要' の買主のみ取得（fetchAllBuyersと同じ条件）
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, name, email, desired_area, distribution_type, latest_status, desired_property_type, price_range_apartment, price_range_house, price_range_land')
    .eq('email', targetEmail)
    .eq('distribution_type', '要')
    .is('deleted_at', null);
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }
  
  console.log('=== Buyers fetched (distribution_type=要 only) ===');
  console.log(JSON.stringify(buyers, null, 2));
  
  // 統合シミュレーション
  let consolidated = null;
  for (const buyer of buyers) {
    if (!consolidated) {
      consolidated = {
        email: buyer.email,
        name: buyer.name,
        buyerNumbers: [buyer.buyer_number],
        allDesiredAreas: buyer.desired_area || '',
        mostPermissiveStatus: buyer.latest_status || '',
        distributionType: buyer.distribution_type || '',
        propertyTypes: buyer.desired_property_type ? [buyer.desired_property_type] : [],
        priceRanges: {
          apartment: buyer.price_range_apartment ? [buyer.price_range_apartment] : [],
          house: buyer.price_range_house ? [buyer.price_range_house] : [],
          land: buyer.price_range_land ? [buyer.price_range_land] : []
        }
      };
    } else {
      consolidated.buyerNumbers.push(buyer.buyer_number);
      
      // エリアをマージ
      const existingAreas = new Set(consolidated.allDesiredAreas.split(''));
      const newAreas = (buyer.desired_area || '').split('');
      newAreas.forEach(area => {
        if (area.trim()) existingAreas.add(area);
      });
      consolidated.allDesiredAreas = Array.from(existingAreas).join('');
      
      // より許容的なステータスを選択
      if (isMorePermissiveStatus(buyer.latest_status, consolidated.mostPermissiveStatus)) {
        consolidated.mostPermissiveStatus = buyer.latest_status;
      }
      
      // 配信タイプをマージ
      if (isMorePermissiveDistributionType(buyer.distribution_type, consolidated.distributionType)) {
        consolidated.distributionType = buyer.distribution_type;
      }
    }
  }
  
  console.log('\n=== Consolidated buyer ===');
  console.log(JSON.stringify(consolidated, null, 2));
  
  // フィルター結果
  console.log('\n=== Filter Results ===');
  
  // エリアマッチング
  const propertyAreas = extractAreaNumbers('②,㊵');
  const buyerAreas = extractAreaNumbers(consolidated?.allDesiredAreas);
  const matchedAreas = buyerAreas.filter(a => propertyAreas.includes(a));
  console.log('Property areas:', propertyAreas);
  console.log('Buyer consolidated areas:', buyerAreas);
  console.log('Matched areas:', matchedAreas);
  console.log('Geography filter (area):', matchedAreas.length > 0);
  
  // 配信フラグ
  const distPass = filterByDistributionFlag(consolidated?.distributionType);
  console.log('Distribution filter:', distPass, '(type:', consolidated?.distributionType, ')');
  
  // ステータス
  const statusPass = filterByLatestStatus(consolidated?.mostPermissiveStatus);
  console.log('Status filter:', statusPass, '(status:', consolidated?.mostPermissiveStatus, ')');
  
  // 価格帯（戸建、8900万円）
  const priceRangeHouse = consolidated?.priceRanges?.house || [];
  console.log('Price range house:', priceRangeHouse);
  console.log('Price filter: true (指定なし = pass)');
  
  console.log('\n=== Overall result ===');
  const geoPass = matchedAreas.length > 0;
  console.log('Would be included:', geoPass && distPass && statusPass);
}

main().catch(console.error);
