import { getOitaCityAreas } from './src/utils/cityAreaMapping';

const address = '大分市大字迫1103番地の1';
const areas = getOitaCityAreas(address);
console.log('物件AA9195のエリア番号:', areas);
console.log('最終エリア番号（㊵含む）:', [...areas, '㊵']);

// 買主2564の希望エリアから抽出される番号
const desiredArea = '⑥中学校区（滝尾中・大南中・南大分・三重）';
const circledNumbers = desiredArea.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶㊷㊸]/g) || [];
console.log('\n買主2564の希望エリア番号:', circledNumbers);

// マッチング確認
const propertyAreas = [...areas, '㊵'];
const match = propertyAreas.some(a => circledNumbers.includes(a));
console.log('\nエリアマッチ:', match ? '✅ 一致' : '❌ 不一致（除外される）');
console.log('物件エリア:', propertyAreas);
console.log('買主希望エリア:', circledNumbers);
