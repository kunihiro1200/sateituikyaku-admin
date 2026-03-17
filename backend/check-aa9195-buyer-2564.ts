// AA9195の買主候補リストに買主2564が含まれない理由を調査
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function investigate() {
  console.log('=== AA9195の買主候補リストに買主2564が含まれない理由を調査 ===\n');

  // 1. 物件AA9195の情報を取得
  console.log('【1. 物件AA9195の情報】');
  const { data: property, error: propError } = await supabase
    .from('property_listings')
    .select('*')
    .eq('property_number', 'AA9195')
    .single();

  if (propError || !property) {
    console.error('物件取得エラー:', propError?.message || '物件が見つかりません');
    return;
  }

  console.log(`  物件番号: ${property.property_number}`);
  console.log(`  住所: ${property.address}`);
  console.log(`  種別: ${property.property_type}`);
  console.log(`  価格: ${property.sales_price?.toLocaleString() || 'なし'}円`);
  console.log(`  配信エリア(distribution_areas): ${property.distribution_areas || 'なし'}`);
  console.log(`  Google Map URL: ${property.google_map_url || 'なし'}`);
  console.log('');

  // 2. 買主2564の情報を取得
  console.log('【2. 買主2564の情報】');
  const { data: buyer, error: buyerError } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '2564')
    .single();

  if (buyerError || !buyer) {
    console.error('買主取得エラー:', buyerError?.message || '買主が見つかりません');
    return;
  }

  console.log(`  買主番号: ${buyer.buyer_number}`);
  console.log(`  名前: ${buyer.name || 'なし'}`);
  console.log(`  最新状況(latest_status): "${buyer.latest_status || ''}"`);
  console.log(`  希望エリア(desired_area): "${buyer.desired_area || ''}"`);
  console.log(`  希望種別(desired_property_type): "${buyer.desired_property_type || ''}"`);
  console.log(`  配信種別(distribution_type): "${buyer.distribution_type || ''}"`);
  console.log(`  問合せ元(inquiry_source): "${buyer.inquiry_source || ''}"`);
  console.log(`  業者問合せ(broker_inquiry): "${buyer.broker_inquiry || ''}"`);
  console.log(`  価格帯(戸建)(price_range_house): "${buyer.price_range_house || ''}"`);
  console.log(`  価格帯(マンション)(price_range_apartment): "${buyer.price_range_apartment || ''}"`);
  console.log(`  価格帯(土地)(price_range_land): "${buyer.price_range_land || ''}"`);
  console.log(`  削除日時(deleted_at): ${buyer.deleted_at || 'なし'}`);
  console.log('');

  // 3. 各フィルタリング条件を個別にチェック
  console.log('【3. フィルタリング条件チェック】');

  // 3-1. 削除済みチェック
  const isDeleted = buyer.deleted_at !== null;
  console.log(`  ① 削除済みチェック: ${isDeleted ? '❌ 削除済み（除外される）' : '✅ 削除されていない'}`);

  // 3-2. 業者問合せチェック
  const inquirySource = (buyer.inquiry_source || '').trim();
  const distributionType = (buyer.distribution_type || '').trim();
  const brokerInquiry = (buyer.broker_inquiry || '').trim();
  const isGyosha = 
    inquirySource === '業者問合せ' || inquirySource.includes('業者') ||
    distributionType === '業者問合せ' || distributionType.includes('業者') ||
    (brokerInquiry !== '' && brokerInquiry !== '0' && brokerInquiry.toLowerCase() !== 'false');
  console.log(`  ② 業者問合せチェック: ${isGyosha ? '❌ 業者問合せ（除外される）' : '✅ 業者問合せではない'}`);

  // 3-3. 最低条件チェック（希望エリアと希望種別が両方空欄）
  const desiredArea = (buyer.desired_area || '').trim();
  const desiredPropertyType = (buyer.desired_property_type || '').trim();
  const hasMinimumCriteria = desiredArea !== '' || desiredPropertyType !== '';
  console.log(`  ③ 最低条件チェック: ${!hasMinimumCriteria ? '❌ 希望エリアと希望種別が両方空欄（除外される）' : '✅ 最低条件あり'}`);
  console.log(`     希望エリア: "${desiredArea}", 希望種別: "${desiredPropertyType}"`);

  // 3-4. 配信種別チェック
  const hasDistributionRequired = distributionType === '要';
  console.log(`  ④ 配信種別チェック: ${!hasDistributionRequired ? `❌ 配信種別が「要」ではない（"${distributionType}"）（除外される）` : '✅ 配信種別=要'}`);

  // 3-5. ステータスチェック
  const latestStatus = (buyer.latest_status || '').trim();
  const statusOk = !latestStatus.includes('買付') && !latestStatus.includes('D');
  console.log(`  ⑤ ステータスチェック: ${!statusOk ? `❌ ステータスが除外対象（"${latestStatus}"）` : `✅ ステータスOK（"${latestStatus}"）`}`);

  // 3-6. エリアマッチチェック（簡易版）
  console.log(`  ⑥ エリアマッチチェック:`);
  console.log(`     物件の配信エリア: "${property.distribution_areas || 'なし'}"`);
  console.log(`     買主の希望エリア: "${desiredArea}"`);
  if (!desiredArea) {
    console.log(`     → 希望エリアが空欄のため、エリア条件は満たす`);
  } else {
    // 丸数字を抽出して比較
    const circledPattern = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶]/g;
    const propertyAreaNums = (property.distribution_areas || '').match(circledPattern) || [];
    const buyerAreaNums = desiredArea.match(circledPattern) || [];
    const areaMatch = propertyAreaNums.some(a => buyerAreaNums.includes(a));
    console.log(`     物件エリア番号: [${propertyAreaNums.join(', ')}]`);
    console.log(`     買主エリア番号: [${buyerAreaNums.join(', ')}]`);
    console.log(`     → エリアマッチ: ${areaMatch ? '✅ 一致あり' : '❌ 一致なし（除外される可能性）'}`);
  }

  // 3-7. 種別マッチチェック
  console.log(`  ⑦ 種別マッチチェック:`);
  const propertyType = property.property_type || '';
  if (desiredPropertyType === '指定なし') {
    console.log(`     → 希望種別=指定なし のため、種別条件は満たす`);
  } else if (!desiredPropertyType) {
    console.log(`     → 希望種別が空欄のため、種別条件を満たさない（除外される）`);
  } else {
    const normalize = (t: string) => t.trim()
      .replace(/中古/g, '').replace(/新築/g, '')
      .replace(/一戸建て/g, '戸建').replace(/一戸建/g, '戸建')
      .replace(/戸建て/g, '戸建').replace(/分譲/g, '').trim();
    const normalizedPropType = normalize(propertyType);
    const normalizedDesiredTypes = desiredPropertyType.split(/[,、\s]+/).map(normalize);
    const typeMatch = normalizedDesiredTypes.some(dt =>
      dt === normalizedPropType || normalizedPropType.includes(dt) || dt.includes(normalizedPropType)
    );
    console.log(`     物件種別: "${propertyType}" → 正規化: "${normalizedPropType}"`);
    console.log(`     希望種別: "${desiredPropertyType}" → 正規化: [${normalizedDesiredTypes.join(', ')}]`);
    console.log(`     → 種別マッチ: ${typeMatch ? '✅ 一致' : '❌ 不一致（除外される）'}`);
  }

  // 3-8. 価格帯チェック
  console.log(`  ⑧ 価格帯チェック:`);
  const salesPrice = property.sales_price;
  if (!salesPrice) {
    console.log(`     → 物件価格が未設定のため、価格条件は満たす`);
  } else {
    const normalize = (t: string) => t.trim()
      .replace(/中古/g, '').replace(/新築/g, '')
      .replace(/一戸建て/g, '戸建').replace(/一戸建/g, '戸建')
      .replace(/戸建て/g, '戸建').replace(/分譲/g, '').trim();
    const normalizedType = normalize(propertyType);
    let priceRange: string | null = null;
    if (normalizedType.includes('戸建')) priceRange = buyer.price_range_house;
    else if (normalizedType.includes('マンション')) priceRange = buyer.price_range_apartment;
    else if (normalizedType.includes('土地')) priceRange = buyer.price_range_land;
    
    console.log(`     物件価格: ${salesPrice.toLocaleString()}円`);
    console.log(`     適用価格帯フィールド: ${normalizedType.includes('戸建') ? 'price_range_house' : normalizedType.includes('マンション') ? 'price_range_apartment' : normalizedType.includes('土地') ? 'price_range_land' : '不明'}`);
    console.log(`     価格帯設定値: "${priceRange || 'なし'}"`);
    if (!priceRange || !priceRange.trim()) {
      console.log(`     → 価格帯が未設定のため、価格条件は満たす`);
    }
  }

  // 4. 総合判定
  console.log('\n【4. 総合判定】');
  const shouldBeExcluded = isDeleted || isGyosha || !hasMinimumCriteria || !hasDistributionRequired || !statusOk;
  if (shouldBeExcluded) {
    console.log('❌ 買主2564は以下の理由で除外されます:');
    if (isDeleted) console.log('   - 削除済み');
    if (isGyosha) console.log('   - 業者問合せ');
    if (!hasMinimumCriteria) console.log('   - 希望エリアと希望種別が両方空欄');
    if (!hasDistributionRequired) console.log(`   - 配信種別が「要」ではない（"${distributionType}"）`);
    if (!statusOk) console.log(`   - ステータスが除外対象（"${latestStatus}"）`);
  } else {
    console.log('✅ 基本的な除外条件はクリア。エリア・種別・価格帯の詳細マッチングを確認してください。');
  }
}

investigate().catch(console.error);
