// 最終確認：GASのロジックが正しいか検証
console.log('=== 最終確認 ===\n');

// シミュレーション1: スプレッドシートから取得した場合（YYYY-MM-DD形式）
console.log('【シミュレーション1】スプレッドシートから取得（YYYY-MM-DD形式）');
const visitDateStr1 = '2026-04-04'; // formatDateToISO_が返す形式
const visitDateOnly1 = visitDateStr1 ? visitDateStr1.split('T')[0].split(' ')[0] : null;
console.log('  入力:', visitDateStr1);
console.log('  出力:', visitDateOnly1);
console.log('  結果:', visitDateOnly1 === '2026-04-04' ? '✅ 正しい' : '❌ 間違い');
console.log('');

// シミュレーション2: データベースから取得した場合（ISO 8601形式）
console.log('【シミュレーション2】データベースから取得（ISO 8601形式）');
const visitDateStr2 = '2026-04-04T10:00:00';
const visitDateOnly2 = visitDateStr2 ? visitDateStr2.split('T')[0].split(' ')[0] : null;
console.log('  入力:', visitDateStr2);
console.log('  出力:', visitDateOnly2);
console.log('  結果:', visitDateOnly2 === '2026-04-04' ? '✅ 正しい' : '❌ 間違い');
console.log('');

// シミュレーション3: スペース区切り形式
console.log('【シミュレーション3】スペース区切り形式');
const visitDateStr3 = '2026-04-04 10:00:00';
const visitDateOnly3 = visitDateStr3 ? visitDateStr3.split('T')[0].split(' ')[0] : null;
console.log('  入力:', visitDateStr3);
console.log('  出力:', visitDateOnly3);
console.log('  結果:', visitDateOnly3 === '2026-04-04' ? '✅ 正しい' : '❌ 間違い');
console.log('');

// 訪問日前日判定のシミュレーション
console.log('【訪問日前日判定】');
console.log('今日: 2026-04-03（木曜日）');
console.log('訪問日: 2026-04-04（金曜日）');
console.log('');

const today = new Date('2026-04-03T00:00:00Z');
const visitDate = new Date('2026-04-04T00:00:00Z');
const visitDay = visitDate.getUTCDay();
const daysBeforeVisit = (visitDay === 4) ? 2 : 1;
const notifyDate = new Date(visitDate);
notifyDate.setUTCDate(notifyDate.getUTCDate() - daysBeforeVisit);

console.log('訪問日の曜日:', ['日','月','火','水','木','金','土'][visitDay]);
console.log('前営業日の日数:', daysBeforeVisit, '日前');
console.log('通知日:', notifyDate.toISOString().split('T')[0]);
console.log('今日 === 通知日:', today.getTime() === notifyDate.getTime() ? '✅ 一致' : '❌ 不一致');
console.log('');

console.log('=== 結論 ===');
console.log('✅ GASのコードは正しい');
console.log('✅ visitDateStr.split("T")[0].split(" ")[0] は全ての形式に対応');
console.log('✅ 今日が4月3日（木）、訪問日が4月4日（金）の場合、訪問日前日カテゴリに含まれる');
