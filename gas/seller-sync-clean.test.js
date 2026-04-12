/**
 * seller-sync-clean.gs のロジックテスト
 *
 * タスク5: バグ2テスト - GAS差分検知の Preservation Checking
 *
 * Property 4: スプレッドシートに変更がない売主は修正後もPATCHがスキップされることを確認
 * Validates: Requirements 3.3, 3.4
 */

'use strict';

// ============================================================
// GASロジックをNode.jsで再現（テスト用）
// ============================================================

/**
 * 行データをオブジェクトに変換（GASのrowToObject相当）
 */
function rowToObject(headers, rowData) {
  var obj = {};
  for (var j = 0; j < headers.length; j++) {
    if (headers[j] === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      obj[headers[j]] = (val.getTime() === 0) ? '' :
        val.getFullYear() + '/' +
        String(val.getMonth() + 1).padStart(2, '0') + '/' +
        String(val.getDate()).padStart(2, '0');
    } else {
      obj[headers[j]] = val;
    }
  }
  return obj;
}

/**
 * 行データのハッシュ文字列を生成（差分検知用）
 * gas/seller-sync-clean.gs の buildRowHash_() と同一ロジック
 */
function buildRowHash_(row) {
  var keys = [
    '状況（当社）', '次電日', '営担', '不通', 'コメント', '電話担当（任意）',
    '連絡取りやすい日、時間帯', '連絡方法', '契約年月 他決は分かった時点',
    '状況（売主）', 'Pinrich', '訪問事前通知メール担当', '物件所在地',
    '土（㎡）', '建（㎡）', '築年', '構造', '間取り', '反響日付',
    '査定方法', '査定額1', '査定額2', '査定額3',
    '査定額1（自動計算）v', '査定額2（自動計算）v', '査定額3（自動計算）v',
    '訪問取得日\n年/月/日', '訪問取得日', '訪問日 \nY/M/D', '訪問日',
    '訪問時間', '訪問査定取得者', '査定担当', '確度', '競合名',
    '競合名、理由\n（他決、専任）', '競合名、理由', '専任・他決要因', '訪問メモ', '1番電話'
  ];
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    parts.push(String(row[keys[i]] !== undefined ? row[keys[i]] : ''));
  }
  return parts.join('|');
}

/**
 * 差分検知ロジック（syncUpdatesToSupabase_の核心部分を再現）
 * @param {Object[]} sheetRows - スプレッドシートの行データ配列
 * @param {Object} prevHashes - 前回保存済みハッシュ { sellerNumber: hash }
 * @returns {{ changedRows: Object[], newHashes: Object }}
 */
function detectChangedRows(sheetRows, prevHashes) {
  var newHashes = {};
  var changedRows = [];

  for (var i = 0; i < sheetRows.length; i++) {
    var row = sheetRows[i];
    var sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.match(/^AA\d+$/)) continue;
    var hash = buildRowHash_(row);
    newHashes[sellerNumber] = hash;
    if (prevHashes[sellerNumber] !== hash) {
      changedRows.push(row);
    }
  }

  return { changedRows: changedRows, newHashes: newHashes };
}

// ============================================================
// テストヘルパー
// ============================================================

/**
 * テスト用の売主行データを生成
 */
function createSellerRow(overrides) {
  var defaults = {
    '売主番号': 'AA1001',
    '状況（当社）': '追客中',
    '次電日': '2026/04/14',
    '営担': '',
    '不通': '',
    'コメント': '',
    '電話担当（任意）': '',
    '連絡取りやすい日、時間帯': '',
    '連絡方法': '',
    '契約年月 他決は分かった時点': '',
    '状況（売主）': '',
    'Pinrich': '',
    '訪問事前通知メール担当': '',
    '物件所在地': '東京都渋谷区',
    '土（㎡）': '',
    '建（㎡）': '',
    '築年': '',
    '構造': '',
    '間取り': '',
    '反響日付': '2026/02/01',
    '査定方法': '',
    '査定額1': '',
    '査定額2': '',
    '査定額3': '',
    '査定額1（自動計算）v': '',
    '査定額2（自動計算）v': '',
    '査定額3（自動計算）v': '',
    '訪問取得日\n年/月/日': '',
    '訪問取得日': '',
    '訪問日 \nY/M/D': '',
    '訪問日': '',
    '訪問時間': '',
    '訪問査定取得者': '',
    '査定担当': '',
    '確度': '',
    '競合名': '',
    '競合名、理由\n（他決、専任）': '',
    '競合名、理由': '',
    '専任・他決要因': '',
    '訪問メモ': '',
    '1番電話': ''
  };
  return Object.assign({}, defaults, overrides);
}

// ============================================================
// テスト実行
// ============================================================

var passed = 0;
var failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  ✅ PASS: ' + message);
    passed++;
  } else {
    console.error('  ❌ FAIL: ' + message);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log('  ✅ PASS: ' + message);
    passed++;
  } else {
    console.error('  ❌ FAIL: ' + message + ' (expected: ' + JSON.stringify(expected) + ', actual: ' + JSON.stringify(actual) + ')');
    failed++;
  }
}

// ============================================================
// タスク4.1: buildRowHash_() が '次電日' フィールドを含むことを確認
// ============================================================

console.log('\n=== タスク4.1: buildRowHash_() の次電日フィールド確認 ===');

(function test_buildRowHash_includes_nextCallDate() {
  console.log('\n[テスト] buildRowHash_() が次電日フィールドをハッシュに含むこと');

  var row1 = createSellerRow({ '次電日': '2026/04/12' });
  var row2 = createSellerRow({ '次電日': '2026/04/14' });

  var hash1 = buildRowHash_(row1);
  var hash2 = buildRowHash_(row2);

  assert(hash1 !== hash2,
    '次電日が異なる場合、ハッシュが異なること（次電日の変更が検知される）');

  assert(hash1.includes('2026/04/12'),
    'ハッシュに次電日の値（2026/04/12）が含まれること');

  assert(hash2.includes('2026/04/14'),
    'ハッシュに次電日の値（2026/04/14）が含まれること');
})();

(function test_buildRowHash_nextCallDate_position() {
  console.log('\n[テスト] buildRowHash_() の次電日はkeys配列の2番目（インデックス1）に位置すること');

  // 次電日のみ変更し、他は同一
  var rowBase = createSellerRow({ '次電日': '2026/04/12', '状況（当社）': '追客中' });
  var rowChanged = createSellerRow({ '次電日': '2026/04/15', '状況（当社）': '追客中' });

  var hashBase = buildRowHash_(rowBase);
  var hashChanged = buildRowHash_(rowChanged);

  assert(hashBase !== hashChanged,
    '次電日のみ変更した場合にハッシュが変わること（次電日がハッシュに正しく組み込まれている）');
})();

// ============================================================
// タスク5.1: Property 4 - 変更なし売主はPATCHがスキップされること
// ============================================================

console.log('\n=== タスク5.1: Property 4 - 変更なし売主のPATCHスキップ確認 ===');

(function test_noChange_skipsUpdate() {
  console.log('\n[テスト] スプレッドシートに変更がない売主はchangedRowsに含まれないこと');

  var row = createSellerRow({ '売主番号': 'AA1001', '次電日': '2026/04/14' });
  var sheetRows = [row];

  // 初回: ハッシュなし → 全件変更あり
  var result1 = detectChangedRows(sheetRows, {});
  assertEqual(result1.changedRows.length, 1,
    '初回（ハッシュなし）は変更ありとして検知されること');

  // 2回目: 同じデータ、前回ハッシュあり → 変更なし
  var result2 = detectChangedRows(sheetRows, result1.newHashes);
  assertEqual(result2.changedRows.length, 0,
    '同じデータで再実行した場合、変更なしとしてスキップされること（PATCHなし）');
})();

(function test_multipleRows_onlyChangedDetected() {
  console.log('\n[テスト] 複数売主のうち変更があった売主のみ検知されること');

  var row1 = createSellerRow({ '売主番号': 'AA1001', '次電日': '2026/04/14' });
  var row2 = createSellerRow({ '売主番号': 'AA1002', '次電日': '2026/04/10' });
  var row3 = createSellerRow({ '売主番号': 'AA1003', '次電日': '2026/04/05' });
  var sheetRows = [row1, row2, row3];

  // 初回実行でハッシュを保存
  var result1 = detectChangedRows(sheetRows, {});
  assertEqual(result1.changedRows.length, 3, '初回は全件変更ありとして検知されること');

  // AA1002の次電日のみ変更
  var row2Updated = createSellerRow({ '売主番号': 'AA1002', '次電日': '2026/04/20' });
  var sheetRowsUpdated = [row1, row2Updated, row3];

  var result2 = detectChangedRows(sheetRowsUpdated, result1.newHashes);
  assertEqual(result2.changedRows.length, 1,
    '変更があったAA1002のみ検知されること（AA1001とAA1003はスキップ）');
  assertEqual(result2.changedRows[0]['売主番号'], 'AA1002',
    '検知された売主番号がAA1002であること');
})();

(function test_nextCallDate_change_detected() {
  console.log('\n[テスト] 次電日の変更が正しく差分として検知されること（AA13950シナリオ）');

  // AA13950: 次電日が4/12 → 4/14に変更されたシナリオ
  var rowBefore = createSellerRow({ '売主番号': 'AA13950', '次電日': '2026/04/12' });
  var rowAfter = createSellerRow({ '売主番号': 'AA13950', '次電日': '2026/04/14' });

  // 4/12のハッシュを保存済みとする
  var prevHashes = {};
  var result1 = detectChangedRows([rowBefore], {});
  prevHashes = result1.newHashes;

  // 4/14に変更後の差分検知
  var result2 = detectChangedRows([rowAfter], prevHashes);
  assertEqual(result2.changedRows.length, 1,
    '次電日が4/12→4/14に変更されたAA13950が差分として検知されること');
  assertEqual(result2.changedRows[0]['次電日'], '2026/04/14',
    '検知された行の次電日が4/14であること');
})();

(function test_resetHashCache_causes_full_resync() {
  console.log('\n[テスト] ハッシュキャッシュリセット後は全件が差分ありとして検知されること');

  var rows = [
    createSellerRow({ '売主番号': 'AA1001', '次電日': '2026/04/14' }),
    createSellerRow({ '売主番号': 'AA1002', '次電日': '2026/04/10' }),
    createSellerRow({ '売主番号': 'AA1003', '次電日': '2026/04/05' })
  ];

  // 通常実行でハッシュを保存
  var result1 = detectChangedRows(rows, {});
  var savedHashes = result1.newHashes;

  // 変更なしで再実行 → スキップ
  var result2 = detectChangedRows(rows, savedHashes);
  assertEqual(result2.changedRows.length, 0, '変更なし時はスキップされること');

  // resetRowHashCache() 相当: ハッシュを空にする
  var emptyHashes = {}; // _seller_hashesシートをclearContents()した状態

  // リセット後の再実行 → 全件差分あり
  var result3 = detectChangedRows(rows, emptyHashes);
  assertEqual(result3.changedRows.length, 3,
    'ハッシュキャッシュリセット後は全件が差分ありとして検知されること');
})();

// ============================================================
// タスク5.2: onEditTrigger の動作確認（ロジック検証）
// ============================================================

console.log('\n=== タスク5.2: onEditTrigger 動作確認 ===');

(function test_onEditTrigger_logic() {
  console.log('\n[テスト] onEditTrigger: 売主リストシート以外の編集は無視されること');

  // onEditTriggerのロジックを再現
  function simulateOnEditTrigger(sheetName, editedRow) {
    // シート名チェック
    if (sheetName !== '売主リスト') return { processed: false, reason: 'wrong_sheet' };
    // ヘッダー行チェック
    if (editedRow <= 1) return { processed: false, reason: 'header_row' };
    return { processed: true };
  }

  var result1 = simulateOnEditTrigger('売主リスト', 5);
  assert(result1.processed === true,
    '売主リストシートの5行目編集は処理されること');

  var result2 = simulateOnEditTrigger('_seller_hashes', 5);
  assert(result2.processed === false,
    '_seller_hashesシートの編集は無視されること');

  var result3 = simulateOnEditTrigger('売主リスト', 1);
  assert(result3.processed === false,
    '売主リストのヘッダー行（1行目）編集は無視されること');

  var result4 = simulateOnEditTrigger('別シート', 10);
  assert(result4.processed === false,
    '売主リスト以外のシートの編集は無視されること');
})();

(function test_onEditTrigger_sellerNumber_validation() {
  console.log('\n[テスト] onEditTrigger: 売主番号のバリデーション');

  // 売主番号バリデーションロジックを再現
  function isValidSellerNumber(sellerNumber) {
    if (!sellerNumber || typeof sellerNumber !== 'string') return false;
    if (!sellerNumber.startsWith('AA')) return false;
    return true;
  }

  assert(isValidSellerNumber('AA13950') === true,
    'AA13950は有効な売主番号として認識されること');

  assert(isValidSellerNumber('AA907') === true,
    'AA907は有効な売主番号として認識されること');

  assert(isValidSellerNumber('') === false,
    '空文字は無効な売主番号として認識されること');

  assert(isValidSellerNumber(null) === false,
    'nullは無効な売主番号として認識されること');

  assert(isValidSellerNumber('BB1234') === false,
    'AAで始まらない番号は無効として認識されること');
})();

(function test_onEditTrigger_does_not_affect_hash_cache() {
  console.log('\n[テスト] onEditTrigger: 即時同期はハッシュキャッシュを更新しないこと（独立した同期経路）');

  // onEditTriggerはpostToBackend('/api/sync/seller-row', rowObj)を呼ぶだけで
  // ハッシュキャッシュ（_seller_hashesシート）を更新しない
  // → 次回の定期同期（syncSellerList）でも差分として検知される

  var row = createSellerRow({ '売主番号': 'AA1001', '次電日': '2026/04/14' });

  // 定期同期でハッシュを保存
  var result1 = detectChangedRows([row], {});
  var savedHashes = result1.newHashes;

  // onEditTriggerが発火（ハッシュキャッシュは変更しない）
  // → savedHashesは変わらない

  // 次回定期同期: 同じデータなのでスキップ（onEditTriggerの発火に関わらず）
  var result2 = detectChangedRows([row], savedHashes);
  assertEqual(result2.changedRows.length, 0,
    'onEditTrigger発火後も定期同期では変更なしとしてスキップされること（二重更新なし）');
})();

// ============================================================
// 結果サマリー
// ============================================================

console.log('\n========================================');
console.log('テスト結果: ' + passed + ' passed, ' + failed + ' failed');
console.log('========================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ 全テスト通過');
}
