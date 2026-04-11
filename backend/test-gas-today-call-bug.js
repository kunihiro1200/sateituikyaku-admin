// GAS updateBuyerSidebarCounts() の当日TELカウントロジックのバグ確認テスト

function getTodayStr() {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
}

function getYesterdayStr() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function getTomorrowStr() {
  var d = new Date();
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ===== バグあり版（修正前）=====
function countTodayCall_BUGGY(buyers) {
  var todayStr = getTodayStr();
  var todayCall = 0;
  for (var i = 0; i < buyers.length; i++) {
    var buyer = buyers[i];
    var nextCallDate = buyer.next_call_date || '';
    // バグ: === で今日のみ、担当分岐なし
    if (nextCallDate === todayStr) {
      todayCall++;
    }
  }
  return todayCall;
}

// ===== 修正後版 =====
function countTodayCall_FIXED(buyers) {
  var todayStr = getTodayStr();
  var todayCall = 0;
  for (var i = 0; i < buyers.length; i++) {
    var buyer = buyers[i];
    var nextCallDate = buyer.next_call_date || '';
    // 修正: <= で今日以前、担当なしのみ
    if (nextCallDate && nextCallDate <= todayStr && !buyer.follow_up_assignee) {
      todayCall++;
    }
  }
  return todayCall;
}

// ===== テストデータ =====
var todayStr = getTodayStr();
var yesterdayStr = getYesterdayStr();
var tomorrowStr = getTomorrowStr();

// 買主7326・7327・7342相当（過去日付・担当なし）
var testBuyers = [
  { buyer_number: '7326', next_call_date: yesterdayStr, follow_up_assignee: '', initial_assignee: 'Y' },
  { buyer_number: '7327', next_call_date: yesterdayStr, follow_up_assignee: '', initial_assignee: '' },
  { buyer_number: '7342', next_call_date: yesterdayStr, follow_up_assignee: '', initial_assignee: 'U' },
  // 担当ありの買主（今日）→ バグ版では todayCall に入ってしまう
  { buyer_number: '9001', next_call_date: todayStr, follow_up_assignee: 'Y', initial_assignee: '' },
  // 未来日付 → どちらもカウントしない
  { buyer_number: '9002', next_call_date: tomorrowStr, follow_up_assignee: '', initial_assignee: '' },
];

// ===== テスト実行 =====
var buggyCount = countTodayCall_BUGGY(testBuyers);
var fixedCount = countTodayCall_FIXED(testBuyers);

console.log('=== バグ確認テスト ===');
console.log('今日:', todayStr);
console.log('昨日:', yesterdayStr);
console.log('明日:', tomorrowStr);
console.log('');
console.log('バグあり版 todayCall:', buggyCount, '(期待: 3以外の値)');
console.log('修正後版 todayCall:', fixedCount, '(期待: 3)');
console.log('');

// アサーション
var passed = true;

// バグあり版は3にならないはず（7326・7327・7342は過去日付なので=== では引っかからない）
if (buggyCount === 3) {
  console.log('❌ FAIL: バグあり版が偶然3になっている（テストデータを確認）');
  passed = false;
} else {
  console.log('✅ PASS: バグあり版は3ではない（バグ確認）:', buggyCount);
}

// 修正後版は3になるはず
if (fixedCount !== 3) {
  console.log('❌ FAIL: 修正後版が3ではない:', fixedCount);
  passed = false;
} else {
  console.log('✅ PASS: 修正後版は3件（7326・7327・7342）');
}

// 未来日付はどちらもカウントしない
var futureOnlyBuyers = [{ buyer_number: '9002', next_call_date: tomorrowStr, follow_up_assignee: '', initial_assignee: '' }];
if (countTodayCall_BUGGY(futureOnlyBuyers) !== 0 || countTodayCall_FIXED(futureOnlyBuyers) !== 0) {
  console.log('❌ FAIL: 未来日付がカウントされている');
  passed = false;
} else {
  console.log('✅ PASS: 未来日付はカウントされない');
}

// 担当ありの買主（今日）はバグ版では todayCall に入るが、修正後版では入らない
var assignedTodayBuyers = [{ buyer_number: '9001', next_call_date: todayStr, follow_up_assignee: 'Y', initial_assignee: '' }];
var buggyAssignedCount = countTodayCall_BUGGY(assignedTodayBuyers);
var fixedAssignedCount = countTodayCall_FIXED(assignedTodayBuyers);
if (buggyAssignedCount !== 1) {
  console.log('❌ FAIL: バグあり版で担当あり今日の買主がtodayCallに入っていない（期待: 1）:', buggyAssignedCount);
  passed = false;
} else {
  console.log('✅ PASS: バグあり版で担当あり今日の買主がtodayCallに過剰カウント（バグ確認）:', buggyAssignedCount);
}
if (fixedAssignedCount !== 0) {
  console.log('❌ FAIL: 修正後版で担当あり今日の買主がtodayCallに入っている（期待: 0）:', fixedAssignedCount);
  passed = false;
} else {
  console.log('✅ PASS: 修正後版で担当あり今日の買主はtodayCallに入らない（todayCallAssignedに入るべき）');
}

console.log('');
console.log(passed ? '✅ 全テスト通過' : '❌ テスト失敗あり');
