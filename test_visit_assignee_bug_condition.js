// ============================================================
// Task 1: Bug Condition Exploration Test
// ============================================================
// このテストは未修正コードでバグを再現することを目的としています
// 期待される結果: テストが失敗する（バグが存在することを証明）

/**
 * Bug Condition: スプレッドシートの「営担」列に担当者名が入力されているのに、
 * syncUpdatesToSupabase_がその値をDBに反映しない
 * 
 * 根本原因の仮説:
 * 1. rowToObject関数がヘッダー名を正規化（trim処理）していない
 *    → ヘッダーに余分な空白・改行が含まれている場合、row['営担']がundefinedになる
 * 2. syncUpdatesToSupabase_内の比較ロジックで、rawVisitAssignee === undefinedの条件がnullを捕捉しない
 *    → スプレッドシートのセルがnullとして読み込まれた場合も誤判定が発生する
 */

// ============================================================
// Test Case 1: ヘッダー名に空白が含まれる場合
// ============================================================
function testBugCondition_HeaderWithSpace() {
  Logger.log('=== Test Case 1: ヘッダー名に空白が含まれる場合 ===');
  
  // ヘッダーに余分な空白が含まれている場合をシミュレート
  var headers = ['売主番号', '営担 ', '状況（当社）', '次電日']; // 「営担 」（末尾に空白）
  var rowData = ['AA12497', 'Y', '追客中', '2026/03/30'];
  
  // rowToObject関数を実行（未修正コード）
  var row = rowToObject(headers, rowData);
  
  // 検証: row['営担']がundefinedになるはず（バグ）
  var visitAssignee = row['営担'];
  Logger.log('row["営担"]: ' + visitAssignee); // undefined
  Logger.log('row["営担 "]: ' + row['営担 ']); // "Y"（空白付きキーでアクセスすると取得できる）
  
  // 期待される動作: row['営担']が"Y"であるべき
  // 実際の動作: row['営担']がundefinedになる（バグ）
  if (visitAssignee === undefined) {
    Logger.log('❌ FAIL: row["営担"]がundefinedになっている（バグを再現）');
    Logger.log('   期待値: "Y"');
    Logger.log('   実際値: undefined');
    return false;
  } else {
    Logger.log('✅ PASS: row["営担"]が正しく取得できている');
    return true;
  }
}

// ============================================================
// Test Case 2: ヘッダー名に改行が含まれる場合
// ============================================================
function testBugCondition_HeaderWithNewline() {
  Logger.log('=== Test Case 2: ヘッダー名に改行が含まれる場合 ===');
  
  // ヘッダーに改行が含まれている場合をシミュレート
  var headers = ['売主番号', '営担\n', '状況（当社）', '次電日']; // 「営担\n」（改行付き）
  var rowData = ['AA12498', 'I', '追客中', '2026/03/30'];
  
  // rowToObject関数を実行（未修正コード）
  var row = rowToObject(headers, rowData);
  
  // 検証: row['営担']がundefinedになるはず（バグ）
  var visitAssignee = row['営担'];
  Logger.log('row["営担"]: ' + visitAssignee); // undefined
  Logger.log('row["営担\\n"]: ' + row['営担\n']); // "I"（改行付きキーでアクセスすると取得できる）
  
  // 期待される動作: row['営担']が"I"であるべき
  // 実際の動作: row['営担']がundefinedになる（バグ）
  if (visitAssignee === undefined) {
    Logger.log('❌ FAIL: row["営担"]がundefinedになっている（バグを再現）');
    Logger.log('   期待値: "I"');
    Logger.log('   実際値: undefined');
    return false;
  } else {
    Logger.log('✅ PASS: row["営担"]が正しく取得できている');
    return true;
  }
}

// ============================================================
// Test Case 3: syncUpdatesToSupabase_でのnull/undefined混同
// ============================================================
function testBugCondition_NullUndefinedMixup() {
  Logger.log('=== Test Case 3: syncUpdatesToSupabase_でのnull/undefined混同 ===');
  
  // スプレッドシートの「営担」列がnullとして読み込まれた場合をシミュレート
  var rawVisitAssignee = null; // スプレッドシートの空セルがnullとして読み込まれた
  
  // 未修正コードの条件式
  var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
  
  // 検証: rawVisitAssignee === nullの場合、条件式がfalseになる
  Logger.log('rawVisitAssignee: ' + rawVisitAssignee); // null
  Logger.log('rawVisitAssignee === undefined: ' + (rawVisitAssignee === undefined)); // false
  Logger.log('sheetVisitAssignee: ' + sheetVisitAssignee); // "null"（文字列）
  
  // 期待される動作: sheetVisitAssigneeがnullであるべき
  // 実際の動作: sheetVisitAssigneeが"null"（文字列）になる（バグ）
  if (sheetVisitAssignee === null) {
    Logger.log('✅ PASS: sheetVisitAssigneeがnullになっている');
    return true;
  } else {
    Logger.log('❌ FAIL: sheetVisitAssigneeが"null"（文字列）になっている（バグを再現）');
    Logger.log('   期待値: null');
    Logger.log('   実際値: "' + sheetVisitAssignee + '"');
    return false;
  }
}

// ============================================================
// Test Case 4: 正常なヘッダー名の場合（ベースライン）
// ============================================================
function testBugCondition_NormalHeader() {
  Logger.log('=== Test Case 4: 正常なヘッダー名の場合（ベースライン） ===');
  
  // ヘッダーに空白・改行がない場合
  var headers = ['売主番号', '営担', '状況（当社）', '次電日'];
  var rowData = ['AA12499', 'Y', '追客中', '2026/03/30'];
  
  // rowToObject関数を実行（未修正コード）
  var row = rowToObject(headers, rowData);
  
  // 検証: row['営担']が正しく取得できるはず
  var visitAssignee = row['営担'];
  Logger.log('row["営担"]: ' + visitAssignee); // "Y"
  
  // 期待される動作: row['営担']が"Y"であるべき
  // 実際の動作: row['営担']が"Y"になる（正常）
  if (visitAssignee === 'Y') {
    Logger.log('✅ PASS: row["営担"]が正しく取得できている');
    return true;
  } else {
    Logger.log('❌ FAIL: row["営担"]が正しく取得できていない');
    Logger.log('   期待値: "Y"');
    Logger.log('   実際値: ' + visitAssignee);
    return false;
  }
}

// ============================================================
// メインテスト実行関数
// ============================================================
function runBugConditionExplorationTests() {
  Logger.log('========================================');
  Logger.log('Bug Condition Exploration Tests');
  Logger.log('========================================');
  Logger.log('');
  
  var results = [];
  
  // Test Case 1: ヘッダー名に空白が含まれる場合
  results.push({
    name: 'Test Case 1: ヘッダー名に空白が含まれる場合',
    passed: testBugCondition_HeaderWithSpace()
  });
  Logger.log('');
  
  // Test Case 2: ヘッダー名に改行が含まれる場合
  results.push({
    name: 'Test Case 2: ヘッダー名に改行が含まれる場合',
    passed: testBugCondition_HeaderWithNewline()
  });
  Logger.log('');
  
  // Test Case 3: syncUpdatesToSupabase_でのnull/undefined混同
  results.push({
    name: 'Test Case 3: syncUpdatesToSupabase_でのnull/undefined混同',
    passed: testBugCondition_NullUndefinedMixup()
  });
  Logger.log('');
  
  // Test Case 4: 正常なヘッダー名の場合（ベースライン）
  results.push({
    name: 'Test Case 4: 正常なヘッダー名の場合（ベースライン）',
    passed: testBugCondition_NormalHeader()
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
  
  // 期待される結果: Test Case 1, 2, 3が失敗する（バグを再現）
  // Test Case 4は成功する（正常なケース）
  if (failedCount === 3 && passedCount === 1) {
    Logger.log('✅ Bug Condition Exploration Tests: バグを正しく再現しました');
    Logger.log('   - Test Case 1, 2, 3が失敗（バグを再現）');
    Logger.log('   - Test Case 4が成功（正常なケース）');
  } else {
    Logger.log('⚠️ Bug Condition Exploration Tests: 期待される結果と異なります');
    Logger.log('   期待: Test Case 1, 2, 3が失敗、Test Case 4が成功');
    Logger.log('   実際: ' + failedCount + '件失敗、' + passedCount + '件成功');
  }
}

// ============================================================
// rowToObject関数（未修正コード）
// ============================================================
function rowToObject(headers, rowData) {
  var obj = {};
  // 反響詳細日時は時刻情報が必要なため、Dateオブジェクトをそのまま保持する列
  var datetimeColumns = { '反響詳細日時': true };
  for (var j = 0; j < headers.length; j++) {
    if (headers[j] === '') continue; // ← ここが問題：trim処理がない
    var val = rowData[j];
    if (val instanceof Date) {
      if (val.getTime() === 0) {
        obj[headers[j]] = '';
      } else if (datetimeColumns[headers[j]]) {
        // 日時列はDateオブジェクトをそのまま保持（syncUpdatesToSupabase_でtoISOString()する）
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
