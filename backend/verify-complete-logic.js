// 完全な検証：今日が2026-04-03（金）、訪問日が2026-04-04（土）の場合
console.log('=== 完全な検証 ===\n');

// 1. 今日の日付
const today = new Date('2026-04-03');
today.setHours(0, 0, 0, 0);
console.log('📅 今日:', today.toISOString().split('T')[0], '(金曜日)');

// 2. 訪問日
const visitDate = new Date('2026-04-04');
visitDate.setHours(0, 0, 0, 0);
const visitDay = visitDate.getDay(); // 6 = 土曜日
console.log('📅 訪問日:', visitDate.toISOString().split('T')[0], '(土曜日)');
console.log('📅 訪問日の曜日コード:', visitDay);

// 3. 前営業日の計算
const daysBeforeVisit = (visitDay === 4) ? 2 : 1;
console.log('📅 前営業日の日数:', daysBeforeVisit, '日前');
console.log('   理由: 訪問日が', visitDay === 4 ? '木曜日' : '木曜日以外', 'なので', daysBeforeVisit, '日前');

// 4. 通知日の計算
const notifyDate = new Date(visitDate);
notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
console.log('📅 通知日（訪問日の' + daysBeforeVisit + '日前）:', notifyDate.toISOString().split('T')[0]);

// 5. 判定
const isMatch = today.getTime() === notifyDate.getTime();
console.log('\n🎯 今日 === 通知日:', isMatch);
console.log('   今日のタイムスタンプ:', today.getTime());
console.log('   通知日のタイムスタンプ:', notifyDate.getTime());

if (isMatch) {
  console.log('\n✅ 結果: 訪問日前日カテゴリに含まれる');
} else {
  console.log('\n❌ 結果: 訪問日前日カテゴリに含まれない');
  console.log('   期待される通知日:', notifyDate.toISOString().split('T')[0]);
  console.log('   実際の今日:', today.toISOString().split('T')[0]);
}

// 6. データベースの形式をシミュレート
console.log('\n=== データベース形式のシミュレーション ===');
const dbVisitDate = '2026-04-04T10:00:00'; // ISO 8601形式
console.log('データベースの値:', dbVisitDate);

// 日付部分のみを抽出（修正後のロジック）
const visitDateOnly = dbVisitDate.split('T')[0].split(' ')[0];
console.log('抽出後:', visitDateOnly);

// 再度判定
const visitDate2 = new Date(visitDateOnly);
visitDate2.setHours(0, 0, 0, 0);
const visitDay2 = visitDate2.getDay();
const daysBeforeVisit2 = (visitDay2 === 4) ? 2 : 1;
const notifyDate2 = new Date(visitDate2);
notifyDate2.setDate(notifyDate2.getDate() - daysBeforeVisit2);
const isMatch2 = today.getTime() === notifyDate2.getTime();

console.log('判定結果:', isMatch2 ? '✅ 含まれる' : '❌ 含まれない');
