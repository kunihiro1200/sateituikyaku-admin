// 内覧日前日ロジックのテスト

// 今日の日付（2026年4月3日 木曜日）
const today = new Date('2026-04-03T00:00:00');
today.setHours(0, 0, 0, 0);

// 内覧日（2026年4月4日 金曜日）
const viewingDate = '2026-04-04';
const vDate = new Date(viewingDate + 'T00:00:00');
const vDay = vDate.getDay();  // 5 (金曜日)

console.log('今日:', today.toISOString().substring(0, 10), '(', ['日', '月', '火', '水', '木', '金', '土'][today.getDay()], ')');
console.log('内覧日:', viewingDate, '(', ['日', '月', '火', '水', '木', '金', '土'][vDay], ')');

// 通知日の計算
const daysBeforeViewing = (vDay === 4) ? 2 : 1;  // 木曜内覧のみ2日前
console.log('通知日の計算: 内覧日の', daysBeforeViewing, '日前');

const notifyDate = new Date(vDate);
notifyDate.setDate(notifyDate.getDate() - daysBeforeViewing);
notifyDate.setHours(0, 0, 0, 0);

console.log('通知日:', notifyDate.toISOString().substring(0, 10), '(', ['日', '月', '火', '水', '木', '金', '土'][notifyDate.getDay()], ')');

// 今日が通知日か？
const isNotifyDay = notifyDate.getTime() === today.getTime();
console.log('\n今日が通知日か？', isNotifyDay);

if (isNotifyDay) {
  console.log('✅ 内覧日前日カテゴリに表示される');
} else {
  console.log('❌ 内覧日前日カテゴリに表示されない');
  console.log('   今日:', today.getTime());
  console.log('   通知日:', notifyDate.getTime());
  console.log('   差:', (notifyDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24), '日');
}
