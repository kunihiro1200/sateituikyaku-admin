// 正確な訪問日前日判定（システムの現在日時を使用）
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 時刻を0:00:00に設定

console.log('=== 訪問日前日判定（正確な計算） ===\n');

console.log('📅 今日:', today.toISOString().split('T')[0], '(' + ['日','月','火','水','木','金','土'][today.getDay()] + '曜日)');
console.log('');

// AA13729の訪問日
const visitDate = new Date(2026, 3, 4); // 2026年4月4日（月は0始まりなので3=4月）
const visitDay = visitDate.getDay();

console.log('📅 訪問日:', visitDate.toISOString().split('T')[0], '(' + ['日','月','火','水','木','金','土'][visitDay] + '曜日)');
console.log('');

// 前営業日の計算
const daysBeforeVisit = (visitDay === 4) ? 2 : 1;
console.log('📅 前営業日の日数:', daysBeforeVisit, '日前');
console.log('   理由: 訪問日が', visitDay === 4 ? '木曜日' : '木曜日以外', 'なので', daysBeforeVisit, '日前');
console.log('');

// 通知日の計算
const notifyDate = new Date(visitDate);
notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
console.log('📅 通知日（訪問日の' + daysBeforeVisit + '日前）:', notifyDate.toISOString().split('T')[0], '(' + ['日','月','火','水','木','金','土'][notifyDate.getDay()] + '曜日)');
console.log('');

// 判定
const isMatch = today.getTime() === notifyDate.getTime();
console.log('🎯 今日 === 通知日:', isMatch);
console.log('');

if (isMatch) {
  console.log('✅ 結果: AA13729は訪問日前日カテゴリに含まれる');
} else {
  console.log('❌ 結果: AA13729は訪問日前日カテゴリに含まれない');
  console.log('');
  console.log('理由:');
  console.log('  今日:', today.toISOString().split('T')[0]);
  console.log('  通知日:', notifyDate.toISOString().split('T')[0]);
  console.log('  差:', Math.floor((today.getTime() - notifyDate.getTime()) / (1000 * 60 * 60 * 24)), '日');
}
