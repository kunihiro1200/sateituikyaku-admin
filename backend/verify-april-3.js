// 今日が2026年4月3日（木曜日）の場合の検証
console.log('=== 今日が2026年4月3日（木曜日）の場合 ===\n');

// 1. 今日の日付（2026-04-03 = 木曜日）
const today = new Date('2026-04-03T00:00:00');
const todayDay = today.getDay();
console.log('📅 今日:', today.toISOString().split('T')[0], '(' + ['日','月','火','水','木','金','土'][todayDay] + '曜日)');

// 2. 訪問日（2026-04-04 = 金曜日）
const visitDate = new Date('2026-04-04T00:00:00');
const visitDay = visitDate.getDay();
console.log('📅 訪問日:', visitDate.toISOString().split('T')[0], '(' + ['日','月','火','水','木','金','土'][visitDay] + '曜日)');

// 3. 前営業日の計算
const daysBeforeVisit = (visitDay === 4) ? 2 : 1;
console.log('📅 前営業日の日数:', daysBeforeVisit, '日前');
console.log('   理由: 訪問日が', visitDay === 4 ? '木曜日' : '木曜日以外', 'なので', daysBeforeVisit, '日前');

// 4. 通知日の計算
const notifyDate = new Date(visitDate);
notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
console.log('📅 通知日（訪問日の' + daysBeforeVisit + '日前）:', notifyDate.toISOString().split('T')[0], '(' + ['日','月','火','水','木','金','土'][notifyDate.getDay()] + '曜日)');

// 5. 判定
const isMatch = today.getTime() === notifyDate.getTime();
console.log('\n🎯 今日（4月3日木曜） === 通知日（4月3日木曜）:', isMatch);

if (isMatch) {
  console.log('\n✅ 結果: 訪問日前日カテゴリに含まれる');
} else {
  console.log('\n❌ 結果: 訪問日前日カテゴリに含まれない');
  console.log('   今日:', today.toISOString().split('T')[0]);
  console.log('   通知日:', notifyDate.toISOString().split('T')[0]);
}

console.log('\n=== 結論 ===');
console.log('今日が2026年4月3日（木曜日）で、訪問日が2026年4月4日（金曜日）の場合：');
console.log('- 訪問日は金曜日なので、前営業日は1日前');
console.log('- 通知日は4月3日（木曜日）');
console.log('- 今日（4月3日）=== 通知日（4月3日）→', isMatch ? '✅ 一致' : '❌ 不一致');
