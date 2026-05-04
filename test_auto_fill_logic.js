// 自動入力ロジックのテスト

const testData = {
  "price": "2,190万円",
  "address": "大分県大分市季の坂２丁目",
  "parking": "有 7,000円/月",
  "floor": "15階建 / 8階",
  "details": {
    "所在地": "大分県大分市季の坂２丁目",
    "物件種目": "中古マンション",
    "駐車場": "有 7,000円/月",
    "階建/階": "15階建 / 8階",
    "設備・サービス": "モニター付オートロック、全居室収納、ウォークインクローゼット、バイク置き場、三面バルコニー、収納スペース、室内洗濯機置場、クローゼット、給湯、駐輪場、ダウンライト、インターネット対応、ケーブルTV",
    "備考": "主要採光面：南向き施工会社：梅林建設株式会社用途地域：１種中高延べ面積：5,732.31㎡IT重説対応物件☆　図面と現況が相違する場合は、現状優先となります。☆　記載事項に誤りがある可能性があります。"
  }
};

console.log('=== 自動入力ロジックテスト ===\n');

// 1. 住所
console.log('✅ 住所:', testData.address);

// 2. 価格帯
const priceStr = testData.price.replace(/[^0-9]/g, '');
const priceNum = parseInt(priceStr, 10);
let priceRange = '';
if (priceNum >= 2000) {
  priceRange = '2000万円以上';
} else if (priceNum >= 1000) {
  priceRange = '1000万円~2999万円';
} else {
  priceRange = '~1900万円';
}
console.log('✅ 価格帯:', priceRange, `(${priceNum}万円)`);

// 3. 物件種別
const propertyType = testData.details['物件種目'];
const propertyTypeMap = {
  '中古マンション': 'マンション',
  '新築マンション': 'マンション',
  'マンション': 'マンション',
  '中古一戸建て': '戸建',
  '新築一戸建て': '戸建',
  '一戸建て': '戸建',
  '戸建': '戸建',
  '土地': '土地',
};
const mappedType = propertyTypeMap[propertyType];
const isMansion = mappedType === 'マンション';
console.log('✅ 物件種別:', mappedType);

// 4. 高層階（マンションのみ）
if (isMansion) {
  const floorInfo = testData.details['階建/階'];
  const floorMatch = floorInfo.match(/\/\s*(\d+)階/);
  if (floorMatch) {
    const floor = parseInt(floorMatch[1], 10);
    const floorType = floor >= 7 ? '高層階' : '低層階';
    console.log('✅ 高層階:', floorType, `(${floor}階)`);
  }
}

// 5. ペット（マンションのみ）
if (isMansion) {
  const features = testData.details['設備・サービス'] || '';
  const remarks = testData.details['備考'] || '';
  const allText = (features + ' ' + remarks).toLowerCase();
  
  let pet = 'どちらでも';
  if (allText.includes('ペット可') || allText.includes('大型犬可') || allText.includes('小型犬可') || allText.includes('猫可')) {
    pet = '可';
  } else if (allText.includes('ペット不可') || allText.includes('ペット禁止')) {
    pet = '不可';
  }
  console.log('✅ ペット:', pet, '(情報なし → どちらでも)');
}

// 6. 温泉
const features = testData.details['設備・サービス'] || '';
const remarks = testData.details['備考'] || '';
const allText = (features + ' ' + remarks).toLowerCase();

let onsen = 'なし';
if (allText.includes('温泉') || allText.includes('天然温泉') || allText.includes('源泉')) {
  onsen = 'あり';
}
console.log('✅ 温泉:', onsen, '(情報なし → なし)');

// 7. P台数
const parkingStr = testData.parking.toLowerCase();

// 「○台」という明示的な表記を優先的に検索
const explicitMatch = parkingStr.match(/(\d+)\s*台/);

let parking = '指定なし';
if (explicitMatch) {
  // 「10台」「2台」のような明示的な表記がある場合
  const parkingNum = parseInt(explicitMatch[1], 10);
  if (parkingNum >= 10) {
    parking = '10台以上';
  } else if (parkingNum >= 3) {
    parking = '3台以上';
  } else if (parkingNum >= 2) {
    parking = '2台以上';
  } else if (parkingNum >= 1) {
    parking = '1台';
  }
} else if (parkingStr.includes('有')) {
  // 「有」のみの場合は1台（マンションの場合は基本1台）
  parking = '1台';
}
console.log('✅ P台数:', parking, `(「有 7,000円/月」→「有」のみ → 1台)`);

console.log('\n=== テスト完了 ===');
console.log('\n期待される結果:');
console.log('- 住所: 大分県大分市季の坂２丁目');
console.log('- 価格帯: 2000万円以上');
console.log('- 物件種別: マンション');
console.log('- 高層階: 高層階 (8階 >= 7階)');
console.log('- ペット: どちらでも (情報なし)');
console.log('- 温泉: なし (情報なし)');
console.log('- P台数: 1台 (「有」のみ)');
