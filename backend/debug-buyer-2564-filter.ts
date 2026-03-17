// 買主2564がAA9195の候補に含まれない理由を詳細デバッグ
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { getOitaCityAreas, getBeppuCityAreas } from './src/utils/cityAreaMapping';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function extractAreaNumbers(areaString: string): string[] {
  const circledNumbers: string[] = areaString.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶㊷㊸]/g) || [];

  const numberMatches = areaString.match(/\b(\d+)\b/g) || [];
  for (const numStr of numberMatches) {
    const num = parseInt(numStr, 10);
    const circled = numberToCircled(num);
    if (circled) {
      circledNumbers.push(circled);
    }
  }

  return [...new Set(circledNumbers)];
}

function numberToCircled(num: number): string | null {
  if (num >= 1 && num <= 20) return String.fromCharCode(0x2460 + num - 1);
  if (num >= 21 && num <= 35) return String.fromCharCode(0x3251 + num - 21);
  if (num >= 36 && num <= 50) return String.fromCharCode(0x32B1 + num - 36);
  return null;
}

async function getAreaNumbersForProperty(property: any): Promise<string[]> {
  const areaNumbers = new Set<string>();

  // 1. distribution_areasフィールドから丸数字のみ抽出
  const distributionAreas = property.distribution_areas || property.distribution_area || '';
  if (distributionAreas) {
    const extracted = distributionAreas.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶㊷㊸]/g) || [];
    extracted.forEach((num: string) => areaNumbers.add(num));
    console.log(`  distribution_areasから抽出: [${extracted.join(', ')}]`);
  } else {
    console.log(`  distribution_areas: null/空`);
  }

  // 2. 住所から詳細エリアマッピング
  const address = (property.address || '').trim();
  if (address) {
    if (address.includes('大分市')) {
      const oitaAreas = getOitaCityAreas(address);
      oitaAreas.forEach(num => areaNumbers.add(num));
      areaNumbers.add('㊵');
      console.log(`  大分市エリアマッピング: [${oitaAreas.join(', ')}] + ㊵`);
    }
    if (address.includes('別府市')) {
      const beppuAreas = getBeppuCityAreas(address);
      beppuAreas.forEach(num => areaNumbers.add(num));
      areaNumbers.add('㊶');
      console.log(`  別府市エリアマッピング: [${beppuAreas.join(', ')}] + ㊶`);
    }
  }

  return Array.from(areaNumbers);
}

async function debug() {
  console.log('=== 買主2564がAA9195の候補に含まれない理由を詳細デバッグ ===\n');

  // 物件AA9195
  const { data: property } = await supabase
    .from('property_listings')
    .select('*')
    .eq('property_number', 'AA9195')
    .single();

  if (!property) { console.error('物件が見つかりません'); return; }

  console.log('【物件AA9195】');
  console.log(`  住所: ${property.address}`);
  console.log(`  種別: ${property.property_type}`);
  console.log(`  価格: ${property.sales_price}`);
  console.log(`  distribution_areas: ${property.distribution_areas}`);
  console.log('');

  console.log('【getAreaNumbersForProperty の実行結果】');
  const propertyAreaNumbers = await getAreaNumbersForProperty(property);
  console.log(`  → 最終エリア番号: [${propertyAreaNumbers.join(', ')}]`);
  console.log('');

  // 買主2564
  const { data: buyer } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '2564')
    .single();

  if (!buyer) { console.error('買主が見つかりません'); return; }

  console.log('【買主2564】');
  console.log(`  desired_area: "${buyer.desired_area}"`);
  console.log(`  desired_area バイト列: ${Buffer.from(buyer.desired_area || '').toString('hex').substring(0, 100)}...`);
  console.log('');

  console.log('【エリアマッチング詳細】');
  const desiredArea = (buyer.desired_area || '').trim();
  const buyerAreaNumbers = extractAreaNumbers(desiredArea);
  console.log(`  買主の希望エリアから抽出: [${buyerAreaNumbers.join(', ')}]`);
  console.log(`  物件エリア番号: [${propertyAreaNumbers.join(', ')}]`);

  const areaMatch = propertyAreaNumbers.some(area => buyerAreaNumbers.includes(area));
  console.log(`  → エリアマッチ: ${areaMatch ? '✅ 一致' : '❌ 不一致'}`);

  if (!areaMatch) {
    console.log('\n  【不一致の詳細分析】');
    for (const propArea of propertyAreaNumbers) {
      const propAreaHex = Buffer.from(propArea).toString('hex');
      console.log(`  物件エリア "${propArea}" (hex: ${propAreaHex})`);
      for (const buyerArea of buyerAreaNumbers) {
        const buyerAreaHex = Buffer.from(buyerArea).toString('hex');
        const match = propArea === buyerArea;
        console.log(`    vs 買主エリア "${buyerArea}" (hex: ${buyerAreaHex}) → ${match ? '✅ 一致' : '❌ 不一致'}`);
      }
    }
  }

  // 種別マッチ
  console.log('\n【種別マッチング】');
  const normalize = (t: string) => t.trim()
    .replace(/中古/g, '').replace(/新築/g, '')
    .replace(/一戸建て/g, '戸建').replace(/一戸建/g, '戸建')
    .replace(/戸建て/g, '戸建').replace(/分譲/g, '').trim();
  const normalizedPropType = normalize(property.property_type || '');
  const desiredTypes = (buyer.desired_property_type || '').split(/[,、\s]+/).map(normalize);
  const typeMatch = desiredTypes.some((dt: string) =>
    dt === normalizedPropType || normalizedPropType.includes(dt) || dt.includes(normalizedPropType)
  );
  console.log(`  物件種別: "${property.property_type}" → "${normalizedPropType}"`);
  console.log(`  希望種別: "${buyer.desired_property_type}" → [${desiredTypes.join(', ')}]`);
  console.log(`  → 種別マッチ: ${typeMatch ? '✅' : '❌'}`);

  // 価格帯マッチ
  console.log('\n【価格帯マッチング】');
  const normalizedType = normalize(property.property_type || '');
  let priceRange: string | null = null;
  if (normalizedType.includes('戸建')) priceRange = buyer.price_range_house;
  else if (normalizedType.includes('マンション')) priceRange = buyer.price_range_apartment;
  else if (normalizedType.includes('土地')) priceRange = buyer.price_range_land;
  console.log(`  適用フィールド: ${normalizedType.includes('土地') ? 'price_range_land' : '?'}`);
  console.log(`  価格帯: "${priceRange || 'なし'}"`);
  console.log(`  物件価格: ${property.sales_price}`);
  if (!priceRange || !priceRange.trim()) {
    console.log(`  → 価格帯未設定のため条件を満たす ✅`);
  }
}

debug().catch(console.error);
