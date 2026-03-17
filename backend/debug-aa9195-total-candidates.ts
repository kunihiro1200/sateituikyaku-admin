// AA9195の候補総数を確認（50件制限の影響を調査）
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
    if (num >= 1 && num <= 20) circledNumbers.push(String.fromCharCode(0x2460 + num - 1));
    else if (num >= 21 && num <= 35) circledNumbers.push(String.fromCharCode(0x3251 + num - 21));
    else if (num >= 36 && num <= 50) circledNumbers.push(String.fromCharCode(0x32B1 + num - 36));
  }
  return [...new Set(circledNumbers)];
}

function normalizeType(t: string): string {
  return t.trim()
    .replace(/中古/g, '').replace(/新築/g, '')
    .replace(/一戸建て/g, '戸建').replace(/一戸建/g, '戸建')
    .replace(/戸建て/g, '戸建').replace(/分譲/g, '').trim();
}

async function main() {
  // 物件AA9195
  const { data: property } = await supabase
    .from('property_listings').select('*').eq('property_number', 'AA9195').single();
  if (!property) { console.error('物件なし'); return; }

  // エリア番号計算
  const areaNumbers = new Set<string>();
  const distAreas = property.distribution_areas || '';
  if (distAreas) {
    (distAreas.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶㊷㊸]/g) || []).forEach((n: string) => areaNumbers.add(n));
  }
  const addr = (property.address || '').trim();
  if (addr.includes('大分市')) {
    getOitaCityAreas(addr).forEach(n => areaNumbers.add(n));
    areaNumbers.add('㊵');
  }
  if (addr.includes('別府市')) {
    getBeppuCityAreas(addr).forEach(n => areaNumbers.add(n));
    areaNumbers.add('㊶');
  }
  const propertyAreaNumbers = Array.from(areaNumbers);
  console.log(`物件エリア番号: [${propertyAreaNumbers.join(', ')}]`);
  console.log(`物件種別: ${property.property_type}, 価格: ${property.sales_price}`);

  // 全買主取得（ページネーション）
  const buyers: any[] = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('buyers').select('*').is('deleted_at', null)
      .order('reception_date', { ascending: false, nullsFirst: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    buyers.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  console.log(`\n総買主数: ${buyers.length}`);

  // フィルタリング
  const matched: any[] = [];
  const excluded: { buyer_number: string; reason: string }[] = [];

  for (const b of buyers) {
    // 業者
    const inqSrc = (b.inquiry_source || '').trim();
    const distType = (b.distribution_type || '').trim();
    const brokerInq = (b.broker_inquiry || '').trim();
    const isGyosha = inqSrc.includes('業者') || distType.includes('業者') ||
      (brokerInq !== '' && brokerInq !== '0' && brokerInq.toLowerCase() !== 'false' && brokerInq.toLowerCase() !== 'null');
    if (isGyosha) { excluded.push({ buyer_number: b.buyer_number, reason: '業者問合せ' }); continue; }

    // 最低条件
    const da = (b.desired_area || '').trim();
    const dpt = (b.desired_property_type || '').trim();
    if (!da && !dpt) { excluded.push({ buyer_number: b.buyer_number, reason: '希望エリア・種別両方空' }); continue; }

    // 配信種別
    if (distType !== '要') { excluded.push({ buyer_number: b.buyer_number, reason: `配信種別="${distType}"` }); continue; }

    // ステータス
    const ls = (b.latest_status || '').trim();
    if (ls.includes('買付') || ls.includes('D')) { excluded.push({ buyer_number: b.buyer_number, reason: `ステータス="${ls}"` }); continue; }

    // エリア
    if (da) {
      const buyerAreas = extractAreaNumbers(da);
      const areaMatch = propertyAreaNumbers.some(a => buyerAreas.includes(a));
      if (!areaMatch) { excluded.push({ buyer_number: b.buyer_number, reason: `エリア不一致(希望:${da.substring(0,20)})` }); continue; }
    }

    // 種別
    const desiredType = (b.desired_property_type || '').trim();
    if (desiredType !== '指定なし' && desiredType) {
      const normProp = normalizeType(property.property_type || '');
      const normDesired = desiredType.split(/[,、\s]+/).map(normalizeType);
      const typeMatch = normDesired.some((dt: string) =>
        dt === normProp || normProp.includes(dt) || dt.includes(normProp));
      if (!typeMatch) { excluded.push({ buyer_number: b.buyer_number, reason: `種別不一致(希望:${desiredType})` }); continue; }
    } else if (!desiredType) {
      excluded.push({ buyer_number: b.buyer_number, reason: '希望種別空' }); continue;
    }

    matched.push(b);
  }

  console.log(`\nマッチした買主数（フィルタ後）: ${matched.length}`);
  console.log(`除外された買主数: ${excluded.length}`);

  // 買主2564の位置
  const idx2564 = matched.findIndex(b => b.buyer_number === '2564');
  console.log(`\n買主2564のマッチリスト内の位置: ${idx2564 >= 0 ? `${idx2564 + 1}番目` : '含まれていない'}`);

  if (idx2564 < 0) {
    // 除外理由を確認
    const exc = excluded.find(e => e.buyer_number === '2564');
    if (exc) {
      console.log(`買主2564の除外理由: ${exc.reason}`);
    } else {
      console.log('買主2564はマッチリストにも除外リストにも含まれていない（取得されていない可能性）');
    }
  }

  // 上位60件を表示
  console.log('\n=== マッチした買主（上位60件）===');
  matched.slice(0, 60).forEach((b, i) => {
    const mark = b.buyer_number === '2564' ? ' ← ★2564★' : '';
    console.log(`  ${i + 1}. 買主${b.buyer_number} | ${b.reception_date} | エリア:${(b.desired_area || '').substring(0, 30)}${mark}`);
  });
}

main().catch(console.error);
