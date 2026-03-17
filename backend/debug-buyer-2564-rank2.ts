// 買主2564がフィルタリング後何番目に来るか確認（修正済みロジック使用）
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
    let circled: string | null = null;
    if (num >= 1 && num <= 20) circled = String.fromCharCode(0x2460 + num - 1);
    else if (num >= 21 && num <= 35) circled = String.fromCharCode(0x3251 + num - 21);
    else if (num >= 36 && num <= 50) circled = String.fromCharCode(0x32B1 + num - 36);
    if (circled) circledNumbers.push(circled);
  }
  return [...new Set(circledNumbers)];
}

function normalizePropertyType(type: string): string {
  return type.trim()
    .replace(/中古/g, '').replace(/新築/g, '')
    .replace(/一戸建て/g, '戸建').replace(/一戸建/g, '戸建')
    .replace(/戸建て/g, '戸建').replace(/分譲/g, '').trim();
}

// BuyerCandidateService.isGyoshaInquiry と同じロジック
function isGyoshaInquiry(buyer: any): boolean {
  const inquirySource = (buyer.inquiry_source || '').trim();
  const distributionType = (buyer.distribution_type || '').trim();
  const brokerInquiry = (buyer.broker_inquiry || '').trim();

  if (inquirySource === '業者問合せ' || inquirySource.includes('業者')) return true;
  if (distributionType === '業者問合せ' || distributionType.includes('業者')) return true;
  if (brokerInquiry && brokerInquiry !== '' && brokerInquiry !== '0' &&
      brokerInquiry.toLowerCase() !== 'false' && brokerInquiry.toLowerCase() !== 'null') return true;
  return false;
}

function shouldExclude(buyer: any): { excluded: boolean; reason: string } {
  if (buyer.deleted_at) return { excluded: true, reason: '削除済み' };
  if (isGyoshaInquiry(buyer)) return { excluded: true, reason: `業者問合せ(broker="${buyer.broker_inquiry}", source="${buyer.inquiry_source}")` };

  const desiredArea = (buyer.desired_area || '').trim();
  const desiredPropertyType = (buyer.desired_property_type || '').trim();
  if (!desiredArea && !desiredPropertyType) return { excluded: true, reason: '希望エリア・種別が両方空' };

  const distributionType = (buyer.distribution_type || '').trim();
  if (distributionType !== '要') return { excluded: true, reason: `配信種別が「要」でない("${distributionType}")` };

  const latestStatus = (buyer.latest_status || '').trim();
  if (latestStatus.includes('買付') || latestStatus.includes('D')) {
    return { excluded: true, reason: `ステータス除外("${latestStatus}")` };
  }

  return { excluded: false, reason: '' };
}

function matchesArea(buyer: any, propertyAreaNumbers: string[]): boolean {
  const desiredArea = (buyer.desired_area || '').trim();
  if (!desiredArea) return true;
  if (propertyAreaNumbers.length === 0) return false;
  const buyerAreaNumbers = extractAreaNumbers(desiredArea);
  return propertyAreaNumbers.some(area => buyerAreaNumbers.includes(area));
}

function matchesType(buyer: any, propertyType: string | null): boolean {
  const desiredType = (buyer.desired_property_type || '').trim();
  if (desiredType === '指定なし') return true;
  if (!desiredType) return false;
  if (!propertyType) return false;
  const normalizedPropType = normalizePropertyType(propertyType);
  const normalizedDesiredTypes = desiredType.split(/[,、\s]+/).map(normalizePropertyType);
  return normalizedDesiredTypes.some((dt: string) =>
    dt === normalizedPropType || normalizedPropType.includes(dt) || dt.includes(normalizedPropType)
  );
}

async function debug() {
  console.log('=== 買主2564のランク確認（修正済みロジック） ===\n');

  const { data: property } = await supabase
    .from('property_listings')
    .select('*')
    .eq('property_number', 'AA9195')
    .single();

  if (!property) { console.error('物件が見つかりません'); return; }

  // getAreaNumbersForProperty相当
  const areaNumbers = new Set<string>();
  const distributionAreas = property.distribution_areas || '';
  if (distributionAreas) {
    const extracted = distributionAreas.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶㊷㊸]/g) || [];
    extracted.forEach((num: string) => areaNumbers.add(num));
  }
  if ((property.address || '').includes('大分市')) {
    getOitaCityAreas(property.address).forEach(n => areaNumbers.add(n));
    areaNumbers.add('㊵');
  }
  if ((property.address || '').includes('別府市')) {
    getBeppuCityAreas(property.address).forEach(n => areaNumbers.add(n));
    areaNumbers.add('㊶');
  }
  const propertyAreaNumbers = Array.from(areaNumbers);
  console.log(`物件エリア番号: [${propertyAreaNumbers.join(', ')}]`);
  console.log(`物件種別: ${property.property_type}, 価格: ${property.sales_price}\n`);

  // 全買主取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('*')
    .is('deleted_at', null)
    .order('reception_date', { ascending: false, nullsFirst: false });

  if (error || !buyers) { console.error('買主取得エラー'); return; }
  console.log(`全買主数: ${buyers.length}`);

  // フィルタリング
  const passed: any[] = [];
  const failedReasons: Record<string, number> = {};

  for (const buyer of buyers) {
    const { excluded, reason } = shouldExclude(buyer);
    if (excluded) {
      failedReasons[reason] = (failedReasons[reason] || 0) + 1;
      continue;
    }

    if (!matchesArea(buyer, propertyAreaNumbers)) {
      failedReasons['エリア不一致'] = (failedReasons['エリア不一致'] || 0) + 1;
      continue;
    }

    if (!matchesType(buyer, property.property_type)) {
      failedReasons['種別不一致'] = (failedReasons['種別不一致'] || 0) + 1;
      continue;
    }

    passed.push(buyer);
  }

  console.log(`フィルタリング通過数: ${passed.length}`);
  console.log('除外理由の内訳（上位）:');
  const sorted = Object.entries(failedReasons).sort((a, b) => b[1] - a[1]);
  sorted.slice(0, 10).forEach(([reason, count]) => console.log(`  ${reason}: ${count}件`));

  const rank = passed.findIndex(b => b.buyer_number === '2564');
  if (rank === -1) {
    console.log('\n❌ 買主2564はフィルタリングを通過していません！');
    // 2564を個別に詳細確認
    const buyer2564 = buyers.find(b => b.buyer_number === '2564');
    if (buyer2564) {
      console.log('\n--- 買主2564の個別チェック ---');
      const { excluded, reason } = shouldExclude(buyer2564);
      console.log(`  shouldExclude: ${excluded ? `除外(${reason})` : '通過'}`);
      console.log(`  matchesArea: ${matchesArea(buyer2564, propertyAreaNumbers)}`);
      console.log(`  matchesType: ${matchesType(buyer2564, property.property_type)}`);
      console.log(`  desired_area: "${buyer2564.desired_area}"`);
      console.log(`  desired_property_type: "${buyer2564.desired_property_type}"`);
      console.log(`  distribution_type: "${buyer2564.distribution_type}"`);
      console.log(`  broker_inquiry raw value: ${JSON.stringify(buyer2564.broker_inquiry)}`);
      console.log(`  latest_status raw value: ${JSON.stringify(buyer2564.latest_status)}`);
    }
  } else {
    console.log(`\n✅ 買主2564はフィルタリング通過後 ${rank + 1}番目`);
    if (rank >= 50) {
      console.log(`⚠️  50件制限により表示されません（${rank + 1}番目 > 50件）`);
      console.log('→ 50件制限を撤廃するか増やす必要があります');
    } else {
      console.log(`✅ 50件以内なので表示されるはずです`);
    }
  }

  // 通過した全買主を表示
  if (passed.length > 0) {
    console.log('\n--- 通過した買主一覧 ---');
    passed.forEach((b, i) => {
      const mark = b.buyer_number === '2564' ? ' ← ★2564' : '';
      console.log(`  ${i + 1}. ${b.buyer_number} (${b.desired_area?.substring(0, 20) || ''}...)${mark}`);
    });
  }
}

debug().catch(console.error);
