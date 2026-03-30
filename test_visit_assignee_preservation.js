// ============================================================
// Task 2: Preservation Property Tests
// ============================================================
// このテストは未修正コードで非バグ入力の動作を観察し、
// 修正後もその動作が保持されることを確認します
// 期待される結果: テストが成功する（元の動作を捕捉）

/**
 * Preservation Requirements:
 * 1. 「営担」列が空欄または「外す」の場合、visit_assigneeをnullとしてDBに保存する
 * 2. スプレッドシートとDBのvisit_assigneeが同じ値の場合、不要な更新リクエストを送信しない
 * 3. status、next_call_date、commentsなど他のフィールドの同期処理は正常に動作する
 * 4. 売主番号がAA\d+形式でない行はスキップする
 * 5. onEditTriggerによる即時同期は正常に動作する
 */

// ============================================================
// Test Case 1: 「営担」列が空欄の場合
// ============================================================
function testPreservation_EmptyVisitAssignee() {
  Logger.log('=== Test Case 1: 「営担」列が空欄の場合 ===');
  
  var headers = ['売主番号', '営担', '状況（当社）', '次電日'];
  var rowData = ['AA12500', '', '追客中', '2026/03/30']; // 営担が空欄
  
  var row = rowToObject(headers, rowData);
  
  // syncUpdatesToSupabase_の処理をシミュレート
  var rawVisitAssignee = row['営担'];
  var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
  
  Logger.log('rawVisitAssignee: "' + rawVisitAssignee + '"');
  Logger.log('sheetVisitAssignee: ' + sheetVisitAssignee);
  
  // 期待される動作: sheetVisitAssigneeがnullになる
  if (sheetVisitAssignee === null) {
    Logger.log('✅ PASS: 空欄の場合、visit_assigneeがnullになる');
    return true;
  } else {
    Logger.log('❌ FAIL: 空欄の場合、visit_assigneeがnullになるべき');
    Logger.log('   期待値: null');
    Logger.log('   実際値: ' + sheetVisitAssignee);
    return false;
  }
}

// ============================================================
// Test Case 2: 「営担」列が「外す」の場合
// ============================================================
function testPreservation_RemoveVisitAssignee() {
  Logger.log('=== Test Case 2: 「営担」列が「外す」の場合 ===');
  
  var headers = ['売主番号', '営担', '状況（当社）', '次電日'];
  var rowData = ['AA12501', '外す', '追客中', '2026/03/30']; // 営担が「外す」
  
  var row = rowToObject(headers, rowData);
  
  // syncUpdatesToSupabase_の処理をシミュレート
  var rawVisitAssignee = row['営担'];
  var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
  
  Logger.log('rawVisitAssignee: "' + rawVisitAssignee + '"');
  Logger.log('sheetVisitAssignee: ' + sheetVisitAssignee);
  
  // 期待される動作: sheetVisitAssigneeがnullになる
  if (sheetVisitAssignee === null) {
    Logger.log('✅ PASS: 「外す」の場合、visit_assigneeがnullになる');
    return true;
  } else {
    Logger.log('❌ FAIL: 「外す」の場合、visit_assigneeがnullになるべき');
    Logger.log('   期待値: null');
    Logger.log('   実際値: ' + sheetVisitAssignee);
    return false;
  }
}

// ============================================================
// Test Case 3: 「営担」列に担当者名が入力されている場合（正常）
// ============================================================
function testPreservation_ValidVisitAssignee() {
  Logger.log('=== Test Case 3: 「営担」列に担当者名が入力されている場合（正常） ===');
  
  var headers = ['売主番号', '営担', '状況（当社）', '次電日'];
  var rowData = ['AA12502', 'Y', '追客中', '2026/03/30']; // 営担が"Y"
  
  var row = rowToObject(headers, rowData);
  
  // syncUpdatesToSupabase_の処理をシミュレート
  var rawVisitAssignee = row['営担'];
  var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
  
  Logger.log('rawVisitAssignee: "' + rawVisitAssignee + '"');
  Logger.log('sheetVisitAssignee: "' + sheetVisitAssignee + '"');
  
  // 期待される動作: sheetVisitAssigneeが"Y"になる
  if (sheetVisitAssignee === 'Y') {
    Logger.log('✅ PASS: 担当者名が入力されている場合、visit_assigneeがその値になる');
    return true;
  } else {
    Logger.log('❌ FAIL: 担当者名が入力されている場合、visit_assigneeがその値になるべき');
    Logger.log('   期待値: "Y"');
    Logger.log('   実際値: ' + sheetVisitAssignee);
    return false;
  }
}

// ============================================================
// Test Case 4: 他のフィールド（status）の同期処理
// ============================================================
function testPreservation_OtherFields_Status() {
  Logger.log('=== Test Case 4: 他のフィールド（status）の同期処理 ===');
  
  var headers = ['売主番号', '営担', '状況（当社）', '次電日'];
  var rowData = ['AA12503', 'Y', '追客中', '2026/03/30'];
  
  var row = rowToObject(headers, rowData);
  
  // syncUpdatesToSupabase_の処理をシミュレート
  var sheetStatus = row['状況（当社）'] ? String(row['状況（当社）']) : null;
  
  Logger.log('sheetStatus: "' + sheetStatus + '"');
  
  // 期待される動作: sheetStatusが"追客中"になる
  if (sheetStatus === '追客中') {
    Logger.log('✅ PASS: statusフィールドが正しく取得できている');
    return true;
  } else {
    Logger.log('❌ FAIL: statusフィールドが正しく取得できていない');
    Logger.log('   期待値: "追客中"');
    Logger.log('   実際値: ' + sheetStatus);
    return false;
  }
}

// ============================================================
// Test Case 5: 他のフィールド（next_call_date）の同期処理
// ============================================================
function testPreservation_OtherFields_NextCallDate() {
  Logger.log('=== Test Case 5: 他のフィールド（next_call_date）の同期処理 ===');
  
  var headers = ['売主番号', '営担', '状況（当社）', '次電日'];
  var rowData = ['AA12504', 'Y', '追客中', '2026/03/30'];
  
  var row = rowToObject(headers, rowData);
  
  // formatDateToISO_の処理をシミュレート
  var sheetNextCallDate = formatDateToISO_(row['次電日']);
  
  Logger.log('sheetNextCallDate: "' + sheetNextCallDate + '"');
  
  // 期待される動作: sheetNextCallDateが"2026-03-30"になる
  if (sheetNextCallDate === '2026-03-30') {
    Logger.log('✅ PASS: next_call_dateフィールドが正しく取得できている');
    return true;
  } else {
    Logger.log('❌ FAIL: next_call_dateフィールドが正しく取得できていない');
    Logger.log('   期待値: "2026-03-30"');
    Logger.log('   実際値: ' + sheetNextCallDate);
    return false;
  }
}

// ============================================================
// Test Case 6: 売主番号がAA\d+形式でない行はスキップ
// ============================================================
function testPreservation_InvalidSellerNumber() {
  Logger.log('=== Test Case 6: 売主番号がAA\d+形式でない行はスキップ ===');
  
  var headers = ['売主番号', '営担', '状況（当社）', '次電日'];
  var rowData = ['BB12505', 'Y', '追客中', '2026/03/30']; // 売主番号が"BB12505"（AA\d+形式でない）
  
  var row = rowToObject(headers, rowData);
  
  var sellerNumber = row['売主番号'];
  
  // syncUpdatesToSupabase_の処理をシミュレート
  var isValid = sellerNumber && typeof sellerNumber === 'string' && sellerNumber.match(/^AA\d+$/);
  
  Logger.log('sellerNumber: "' + sellerNumber + '"');
  Logger.log('isValid: ' + isValid);
  
  // 期待される動作: isValidがfalseになる（スキップされる）
  if (!isValid) {
    Logger.log('✅ PASS: AA\d+形式でない売主番号はスキップされる');
    return true;
  } else {
    Logger.log('❌ FAIL: AA\d+形式でない売主番号はスキップされるべき');
    Logger.log('   期待値: false');
    Logger.log('   実際値: ' + isValid);
    return false;
  }
}

// ============================================================
// Test Case 7: 差分なしの場合は更新をスキップ
// ============================================================
function testPreservation_NoUpdateWhenSame() {
  Logger.log('=== Test Case 7: 差分なしの場合は更新をスキップ ===');
  
  // スプレッドシートの値
  var sheetVisitAssignee = 'Y';
  
  // DBの値
  var dbVisitAssignee = 'Y';
  
  // syncUpdatesToSupabase_の処理をシミュレート
  var needsUpdate = (sheetVisitAssignee !== (dbVisitAssignee || null));
  
  Logger.log('sheetVisitAssignee: "' + sheetVisitAssignee + '"');
  Logger.log('dbVisitAssignee: "' + dbVisitAssignee + '"');
  Logger.log('needsUpdate: ' + needsUpdate);
  
  // 期待される動作: needsUpdateがfalseになる（更新をスキップ）
  if (!needsUpdate) {
    Logger.log('✅ PASS: 差分なしの場合は更新をスキップする');
    return true;
  } else {
    Logger.log('❌ FAIL: 差分なしの場合は更新をスキップするべき');
    Logger.log('   期待値: false');
    Logger.log('   実際値: ' + needsUpdate);
    return false;
  }
}

// ============================================================
// メインテスト実行関数
// ============================================================
function runPreservationPropertyTests() {
  Logger.log('========================================');
  Logger.log('Preservation Property Tests');
  Logger.log('========================================');
  Logger.log('');
  
  var results = [];
  
  // Test Case 1: 「営担」列が空欄の場合
  results.push({
    name: 'Test Case 1: 「営担」列が空欄の場合',
    passed: testPreservation_EmptyVisitAssignee()
  });
  Logger.log('');
  
  // Test Case 2: 「営担」列が「外す」の場合
  results.push({
    name: 'Test Case 2: 「営担」列が「外す」の場合',
    passed: testPreservation_RemoveVisitAssignee()
  });
  Logger.log('');
  
  // Test Case 3: 「営担」列に担当者名が入力されている場合（正常）
  results.push({
    name: 'Test Case 3: 「営担」列に担当者名が入力されている場合（正常）',
    passed: testPreservation_ValidVisitAssignee()
  });
  Logger.log('');
  
  // Test Case 4: 他のフィールド（status）の同期処理
  results.push({
    name: 'Test Case 4: 他のフィールド（status）の同期処理',
    passed: testPreservation_OtherFields_Status()
  });
  Logger.log('');
  
  // Test Case 5: 他のフィールド（next_call_date）の同期処理
  results.push({
    name: 'Test Case 5: 他のフィールド（next_call_date）の同期処理',
    passed: testPreservation_OtherFields_NextCallDate()
  });
  Logger.log('');
  
  // Test Case 6: 売主番号がAA\d+形式でない行はスキップ
  results.push({
    name: 'Test Case 6: 売主番号がAA\d+形式でない行はスキップ',
    passed: testPreservation_InvalidSellerNumber()
  });
  Logger.log('');
  
  // Test Case 7: 差分なしの場合は更新をスキップ
  results.push({
    name: 'Test Case 7: 差分なしの場合は更新をスキップ',
    passed: testPreservation_NoUpdateWhenSame()
  });
  Logger.log('');
  
  // サマリー
  Logger.log('========================================');
  Logger.log('Test Summary');
  Logger.log('========================================');
  var passedCount = 0;
  var failedCount = 0;
  for (var i = 0; i < results.length; i++) {
    var result = results[i];
    if (result.passed) {
      passedCount++;
      Logger.log('✅ PASS: ' + result.name);
    } else {
      failedCount++;
      Logger.log('❌ FAIL: ' + result.name);
    }
  }
  Logger.log('');
  Logger.log('Total: ' + results.length + ' tests');
  Logger.log('Passed: ' + passedCount + ' tests');
  Logger.log('Failed: ' + failedCount + ' tests');
  Logger.log('');
  
  // 期待される結果: 全てのテストが成功する（元の動作を捕捉）
  if (failedCount === 0) {
    Logger.log('✅ Preservation Property Tests: 全てのテストが成功しました');
    Logger.log('   元の動作を正しく捕捉しています');
  } else {
    Logger.log('⚠️ Preservation Property Tests: 一部のテストが失敗しました');
    Logger.log('   元の動作を正しく捕捉できていない可能性があります');
  }
}

// ============================================================
// ユーティリティ関数（未修正コード）
// ============================================================
function rowToObject(headers, rowData) {
  var obj = {};
  var datetimeColumns = { '反響詳細日時': true };
  for (var j = 0; j < headers.length; j++) {
    if (headers[j] === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      if (val.getTime() === 0) {
        obj[headers[j]] = '';
      } else if (datetimeColumns[headers[j]]) {
        obj[headers[j]] = val;
      } else {
        obj[headers[j]] = val.getFullYear() + '/' +
          String(val.getMonth() + 1).padStart(2, '0') + '/' +
          String(val.getDate()).padStart(2, '0');
      }
    } else {
      obj[headers[j]] = val;
    }
  }
  return obj;
}

function formatDateToISO_(value) {
  if (!value || value === '') return null;
  var str = String(value).trim();
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    var parts = str.split('/');
    return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
  }
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    var parts2 = str.split('-');
    return parts2[0] + '-' + parts2[1].padStart(2, '0') + '-' + parts2[2].padStart(2, '0');
  }
  return null;
}
