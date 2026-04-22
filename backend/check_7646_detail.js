const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // 物件AA10027の全フィールドを確認
  const { data: prop, error: propErr } = await supabase
    .from('property_listings')
    .select('property_number, address, price, property_type, distribution_areas, google_map_url, buyer_filter_pet, buyer_filter_parking, buyer_filter_onsen, buyer_filter_floor')
    .eq('property_number', 'AA10027')
    .single();
  
  console.log('=== Property AA10027 ===');
  if (propErr) console.log('Error:', propErr.message);
  else console.log(JSON.stringify(prop, null, 2));

  // 買主7646の全フィールドを確認
  const { data: buyer, error: buyerErr } = await supabase
    .from('buyers')
    .select('buyer_number, name, email, desired_area, distribution_type, latest_status, desired_property_type, price_range_apartment, price_range_house, price_range_land, deleted_at, pet, parking, onsen, floor')
    .eq('buyer_number', '7646')
    .single();
  
  console.log('\n=== Buyer 7646 ===');
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
  const propertyAreas = extractAreaNumbers(prop?.distribution_areas);
  const buyerAreas = extractAreaNumbers(buyer?.desired_area);
  console.log('Property distribution_areas:', prop?.distribution_areas);
  console.log('Property extracted areas:', propertyAreas);
  console.log('Buyer desired_area:', buyer?.desired_area);
  console.log('Buyer extracted areas:', buyerAreas);
  
  const matchedAreas = buyerAreas.filter(a => propertyAreas.includes(a));
  console.log('Matched areas:', matchedAreas);
  console.log('Area match result:', matchedAreas.length > 0);
}

function extractAreaNumbers(text) {
  if (!text) return [];
  const areaPattern = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿]/g;
  const matches = text.match(areaPattern) || [];
  return [...new Set(matches)];
}

main().catch(console.error);
