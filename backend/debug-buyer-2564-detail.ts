// 買主2564が具体的にどのフィルタで落ちているか詳細確認
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { getOitaCityAreas } from './src/utils/cityAreaMapping';

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

async function debug() {
  // 物件AA9195のエリア番号
  const { data: property } = await supabase
    .from('property_listings')
    .select('*')
    .eq('property_number', 'AA9195')
    .single();

  if (!property) { console.error('物件が見つかりません'); return; }

  const areaNumbers = new Set<string>();
  const distributionAreas = property.distribution_areas || '';
  if (distributionAreas) {
    const extracted = distributionAreas.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶㊷㊸]/g) || [];
    extracted.forEach((n: string) => areaNumbers.add(n));
  }
  if ((property.address || '').includes('大分市')) {
    getOitaCityAreas(property.address).forEach(n => areaNumbers.add(n));
    areaNumbers.add('㊵');
  }
  const propertyAreaNumbers = Array.from(areaNumbers);
  console.log(`物件エリア番号: [${propertyAreaNumbers.join(', ')}]\n`);

  // 買主2564を直接取得
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '2564')
    .single();

  if (error || !buyer) {
    console.error('買主2564が見つかりません:', error?.message);
    return;
  }

  console.log('=== 買主2564の全フィールド確認 ===');
  console.log(`buyer_number: "${buyer.buyer_number}"`);
  console.log(`deleted_at: ${buyer.deleted_at}`);
  console.log(`inquiry_source: "${buyer.inquiry_source}"`);
  console.log(`distribution_type: "${buyer.distribution_type}"`);
  console.log(`broker_inquiry: "${buyer.broker_inquiry}"`);
  console.log(`desired_area: "${buyer.desired_area}"`);
  console.log(`desired_property_type: "${buyer.desired_property_type}"`);
  console.log(`latest_status: "${buyer.latest_status}"`);
  console.log('');

  // 各フィルタを個別チェック
  console.log('=== フィルタ個別チェック ===');

  // 1. 削除済み
  console.log(`1. 削除済み: ${buyer.deleted_at ? '❌除外' : '✅通過'}`);

  // 2. 業者問合せ
  const inquirySource = (buyer.inquiry_source || '').trim();
  const distributionType = (buyer.distribution_type || '').trim();
  const brokerInquiry = (buyer.broker_inquiry || '').trim();
  const isGyosha = inquirySource.includes('業者') || distributionType.includes('業者') ||
    (brokerInquiry !== '' && brokerInquiry !== '0' && brokerInquiry.toLowerCase() !== 'false');
  console.log(`2. 業者問合せ: ${isGyosha ? '❌除外' : '✅通過'} (inquiry_source="${inquirySource}", distribution_type="${distributionType}", broker_inquiry="${brokerInquiry}")`);

  // 3. 最低条件
  const desiredArea = (buyer.desired_area || '').trim();
  const desiredPropertyType = (buyer.desired_property_type || '').trim();
  const hasMin = desiredArea !== '' || desiredPropertyType !== '';
  console.log(`3. 最低条件: ${!hasMin ? '❌除外' : '✅通過'} (desired_area="${desiredArea ? '有' : '空'}", desired_property_type="${desiredPropertyType ? '有' : '空'}")`);

  // 4. 配信種別
  const hasDistribution = distributionType === '要';
  console.log(`4. 配信種別: ${!hasDistribution ? `❌除外("${distributionType}")` : '✅通過'}`);

  // 5. ステータス
  const latestStatus = (buyer.latest_status || '').trim();
  const statusOk = !latestStatus.includes('買付') && !latestStatus.includes('D');
  console.log(`5. ステータス: ${!statusOk ? `❌除外("${latestStatus}")` : `✅通過("${latestStatus}")`}`);

  // 6. エリアマッチ
  const buyerAreaNumbers = extractAreaNumbers(desiredArea);
  const areaMatch = propertyAreaNumbers.some(area => buyerAreaNumbers.includes(area));
  console.log(`6. エリアマッチ: ${!areaMatch ? '❌除外' : '✅通過'}`);
  console.log(`   物件エリア: [${propertyAreaNumbers.join(', ')}]`);
  console.log(`   買主エリア抽出: [${buyerAreaNumbers.join(', ')}]`);
  console.log(`   desired_area raw: "${buyer.desired_area}"`);

  // 7. 種別マッチ
  const normalize = (t: string) => t.trim()
    .replace(/中古/g, '').replace(/新築/g, '')
    .replace(/一戸建て/g, '戸建').replace(/一戸建/g, '戸建')
    .replace(/戸建て/g, '戸建').replace(/分譲/g, '').trim();
  const normalizedPropType = normalize(property.property_type || '');
  const desiredTypes = desiredPropertyType.split(/[,、\s]+/).map(normalize);
  const typeMatch = desiredTypes.some((dt: string) =>
    dt === normalizedPropType || normalizedPropType.includes(dt) || dt.includes(normalizedPropType)
  );
  console.log(`7. 種別マッチ: ${!typeMatch ? '❌除外' : '✅通過'} (物件="${normalizedPropType}", 希望=[${desiredTypes.join(',')}])`);

  console.log('');
  console.log('=== 総合判定 ===');
  const allPass = !buyer.deleted_at && !isGyosha && hasMin && hasDistribution && statusOk && areaMatch && typeMatch;
  console.log(allPass ? '✅ 全フィルタ通過 → 候補に含まれるはず' : '❌ いずれかのフィルタで除外');
}

debug().catch(console.error);
