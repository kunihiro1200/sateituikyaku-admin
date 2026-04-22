const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // 買主7646の全フィールドを確認（petなし）
  const { data: buyer, error: buyerErr } = await supabase
    .from('buyers')
    .select('buyer_number, name, email, desired_area, distribution_type, latest_status, desired_property_type, price_range_apartment, price_range_house, price_range_land, deleted_at')
    .eq('buyer_number', '7646')
    .single();
  
  console.log('=== Buyer 7646 ===');
  if (buyerErr) console.log('Error:', buyerErr.message);
  else console.log(JSON.stringify(buyer, null, 2));

  // 7646と同じメールアドレスを持つ他の買主を確認
  if (buyer && buyer.email) {
    const { data: sameEmail, error: sameEmailErr } = await supabase
      .from('buyers')
      .select('buyer_number, name, email, desired_area, distribution_type, latest_status, deleted_at')
      .eq('email', buyer.email)
      .is('deleted_at', null);
    
    console.log('\n=== Buyers with same email (active) ===');
    if (sameEmailErr) console.log('Error:', sameEmailErr.message);
    else console.log(JSON.stringify(sameEmail, null, 2));
  }

  // エリア抽出のシミュレーション
  console.log('\n=== Area Extraction Simulation ===');
  const propertyAreas = extractAreaNumbers('②,㊵');
  const buyerAreas = extractAreaNumbers(buyer?.desired_area);
  console.log('Property distribution_areas: ②,㊵');
  console.log('Property extracted areas:', propertyAreas);
  console.log('Buyer desired_area:', buyer?.desired_area);
  console.log('Buyer extracted areas:', buyerAreas);
  
  const matchedAreas = buyerAreas.filter(a => propertyAreas.includes(a));
  console.log('Matched areas:', matchedAreas);
  console.log('Area match result:', matchedAreas.length > 0);

  // ステータスフィルターチェック
  console.log('\n=== Status Filter Check ===');
  const status = buyer?.latest_status || '';
  const statusPass = !status.includes('買付') && !status.includes('D');
  console.log('Status:', status);
  console.log('Status filter pass:', statusPass);

  // 配信タイプフィルターチェック
  console.log('\n=== Distribution Type Filter Check ===');
  const distType = buyer?.distribution_type || '';
  const distPass = distType === '要' || distType === 'mail' || distType === '配信希望' || distType.includes('LINE→mail');
  console.log('Distribution type:', distType);
  console.log('Distribution filter pass:', distPass);
}

function extractAreaNumbers(text) {
  if (!text) return [];
  const areaPattern = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿]/g;
  const matches = text.match(areaPattern) || [];
  return [...new Set(matches)];
}

main().catch(console.error);
