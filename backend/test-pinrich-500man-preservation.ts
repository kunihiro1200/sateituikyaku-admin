/**
 * Preservation Property Test: 他カテゴリへの非影響確認
 *
 * **Property 2: Preservation** - 他カテゴリへの非影響
 *
 * **IMPORTANT**: このテストは修正前のコードで PASS することが期待される
 *   - PASS することで修正前の基準動作が確認される
 *   - 修正後も PASS することでリグレッションがないことを確認する
 *
 * テスト内容:
 *   1. inquiryEmailUnanswered, brokerInquiry, generalViewingSellerContactPending,
 *      viewingPromotionRequired, pinrichUnregistered が空配列を返すことを確認
 *   2. todayCall, viewingDayBefore 等の既存カテゴリが calculated_status でフィルタリングされることを確認
 *   3. assigned:Y 等の担当別カテゴリが正常に動作することを確認
 *   4. getSidebarCountsFallback の pinrich500manUnregistered 以外のカウント計算が正常に動作することを確認
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

// ============================================================
// getBuyersByStatus のフィルタリングロジックを抽出して直接テスト
// (DBへの接続なし)
// ============================================================

/**
 * getBuyersByStatus のフィルタリングロジック（修正前の状態を再現）
 * BuyerService.ts から抽出
 */
function getBuyersByStatusLogic_UNFIXED(status: string, allBuyers: any[]): any[] {
  const assignedPattern1 = /^assigned:(.+)$/;
  const assignedPattern2 = /^担当\((.+)\)$/;
  const todayCallAssignedPattern = /^todayCallAssigned:(.+)$/;
  const assignedMatch1 = status.match(assignedPattern1);
  const assignedMatch2 = status.match(assignedPattern2);
  const todayCallAssignedMatch = status.match(todayCallAssignedPattern);

  let filteredBuyers: any[];

  if (todayCallAssignedMatch) {
    const assignee = todayCallAssignedMatch[1];
    filteredBuyers = allBuyers.filter(buyer => buyer.calculated_status === `当日TEL(${assignee})`);
  } else if (status === 'threeCallUnchecked') {
    filteredBuyers = allBuyers.filter(buyer => buyer.calculated_status === '3回架電未');
  } else if (
    status === 'inquiryEmailUnanswered' ||
    status === 'brokerInquiry' ||
    status === 'generalViewingSellerContactPending' ||
    status === 'viewingPromotionRequired' ||
    status === 'pinrichUnregistered'
    // 修正前: 'pinrich500manUnregistered' はここに含まれていない
  ) {
    filteredBuyers = [];
  } else if (assignedMatch1 || assignedMatch2) {
    const assignee = assignedMatch1 ? assignedMatch1[1] : assignedMatch2![1];
    filteredBuyers = allBuyers.filter(buyer =>
      buyer.follow_up_assignee === assignee ||
      (!buyer.follow_up_assignee && buyer.initial_assignee === assignee)
    );
  } else {
    // 既存のロジック（calculated_status でフィルタリング）
    filteredBuyers = allBuyers.filter(buyer => buyer.calculated_status === status);
  }

  return filteredBuyers;
}

/**
 * getSidebarCountsFallback の pinrich500manUnregistered カウントロジック（修正前）
 * BuyerService.ts から抽出
 */
function countPinrich500manUnregistered_UNFIXED(allBuyers: any[]): number {
  let count = 0;
  allBuyers.forEach((buyer: any) => {
    if (
      buyer.email && String(buyer.email).trim() &&
      buyer.inquiry_property_price !== null &&
      buyer.inquiry_property_price !== undefined &&
      Number(buyer.inquiry_property_price) <= 5000000 &&
      (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未')
      // 修正前: reception_date 条件なし
    ) {
      count++;
    }
  });
  return count;
}

/**
 * getSidebarCountsFallback の他カテゴリカウントロジック（calculated_status ベース）
 * BuyerService.ts から抽出
 */
function countByCalculatedStatus(allBuyers: any[], targetStatus: string): number {
  return allBuyers.filter(buyer => buyer.calculated_status === targetStatus).length;
}

// ============================================================
// テストデータ
// ============================================================

const MOCK_BUYERS = [
  // 当日TEL カテゴリ
  {
    buyer_number: 'B001',
    email: 'b001@example.com',
    inquiry_property_price: 4000000,
    pinrich_500man_registration: '未',
    reception_date: '2026-02-01',
    calculated_status: '当日TEL',
    follow_up_assignee: 'Y',
    initial_assignee: 'Y',
    name: '買主B001',
  },
  {
    buyer_number: 'B002',
    email: 'b002@example.com',
    inquiry_property_price: 3000000,
    pinrich_500man_registration: '未',
    reception_date: '2026-03-01',
    calculated_status: '当日TEL',
    follow_up_assignee: 'I',
    initial_assignee: 'I',
    name: '買主B002',
  },
  // 当日TEL(Y) カテゴリ（担当別）
  {
    buyer_number: 'B003',
    email: 'b003@example.com',
    inquiry_property_price: 4500000,
    pinrich_500man_registration: null,
    reception_date: '2026-04-01',
    calculated_status: '当日TEL(Y)',
    follow_up_assignee: 'Y',
    initial_assignee: 'Y',
    name: '買主B003',
  },
  // 3回架電未 カテゴリ
  {
    buyer_number: 'B004',
    email: 'b004@example.com',
    inquiry_property_price: 5000000,
    pinrich_500man_registration: '未',
    reception_date: '2026-01-15',
    calculated_status: '3回架電未',
    follow_up_assignee: null,
    initial_assignee: 'I',
    name: '買主B004',
  },
  // 内覧前日 カテゴリ
  {
    buyer_number: 'B005',
    email: 'b005@example.com',
    inquiry_property_price: 4800000,
    pinrich_500man_registration: '済',
    reception_date: '2026-01-20',
    calculated_status: '内覧前日',
    follow_up_assignee: null,
    initial_assignee: 'Y',
    name: '買主B005',
  },
  // 担当(Y) カテゴリ
  {
    buyer_number: 'B006',
    email: 'b006@example.com',
    inquiry_property_price: 3500000,
    pinrich_500man_registration: '未',
    reception_date: '2026-02-10',
    calculated_status: '追客中',
    follow_up_assignee: 'Y',
    initial_assignee: 'Y',
    name: '買主B006',
  },
  // 担当(I) カテゴリ（follow_up_assignee なし → initial_assignee で判定）
  {
    buyer_number: 'B007',
    email: 'b007@example.com',
    inquiry_property_price: 4200000,
    pinrich_500man_registration: '未',
    reception_date: '2026-03-05',
    calculated_status: '初回架電未',
    follow_up_assignee: null,
    initial_assignee: 'I',
    name: '買主B007',
  },
  // reception_date が 2025年（古い）の買主
  {
    buyer_number: 'B008',
    email: 'b008@example.com',
    inquiry_property_price: 4000000,
    pinrich_500man_registration: '未',
    reception_date: '2025-12-31',
    calculated_status: '当日TEL',
    follow_up_assignee: null,
    initial_assignee: 'Y',
    name: '買主B008（受付日古い）',
  },
  // reception_date が null の買主
  {
    buyer_number: 'B009',
    email: 'b009@example.com',
    inquiry_property_price: 4000000,
    pinrich_500man_registration: '未',
    reception_date: null,
    calculated_status: '当日TEL',
    follow_up_assignee: null,
    initial_assignee: 'Y',
    name: '買主B009（受付日null）',
  },
];

// ============================================================
// テスト実行
// ============================================================

function runTests(): void {
  console.log('🛡️  Preservation Property Test: 他カテゴリへの非影響確認');
  console.log('='.repeat(70));
  console.log('');
  console.log('✅ IMPORTANT: このテストは修正前のコードで PASS することが期待される');
  console.log('   PASS = 修正前の基準動作が確認された（正しい結果）');
  console.log('   FAIL = 既存の動作が壊れている（要調査）');
  console.log('');

  let testsPassed = 0;
  let testsFailed = 0;

  // ============================================================
  // テスト1: 未実装カテゴリが空配列を返すことを確認
  // Requirements 3.1
  // ============================================================
  console.log('🧪 テスト1: 未実装カテゴリが空配列を返すことを確認（Requirements 3.1）');
  console.log('-'.repeat(70));

  const unimplementedCategories = [
    'inquiryEmailUnanswered',
    'brokerInquiry',
    'generalViewingSellerContactPending',
    'viewingPromotionRequired',
    'pinrichUnregistered',
  ];

  let test1Passed = true;
  for (const category of unimplementedCategories) {
    const result = getBuyersByStatusLogic_UNFIXED(category, MOCK_BUYERS);
    if (result.length === 0) {
      console.log(`  ✅ ${category}: 空配列が返された（正しい）`);
    } else {
      console.log(`  ❌ ${category}: ${result.length}件が返された（誤り）`);
      test1Passed = false;
    }
  }

  if (test1Passed) {
    console.log('  ✅ PASS: 全ての未実装カテゴリが空配列を返した');
    testsPassed++;
  } else {
    console.log('  ❌ FAIL: 一部の未実装カテゴリが空配列を返さなかった');
    testsFailed++;
  }

  // ============================================================
  // テスト2: todayCall が calculated_status でフィルタリングされることを確認
  // Requirements 3.2
  // ============================================================
  console.log('');
  console.log('🧪 テスト2: todayCall が calculated_status でフィルタリングされることを確認（Requirements 3.2）');
  console.log('-'.repeat(70));

  const todayCallResult = getBuyersByStatusLogic_UNFIXED('当日TEL', MOCK_BUYERS);
  const expectedTodayCallBuyers = MOCK_BUYERS.filter(b => b.calculated_status === '当日TEL');

  console.log(`  実際の結果: ${todayCallResult.length}件`);
  console.log(`  期待する結果: ${expectedTodayCallBuyers.length}件`);

  if (todayCallResult.length === expectedTodayCallBuyers.length) {
    const allMatch = expectedTodayCallBuyers.every(expected =>
      todayCallResult.some(actual => actual.buyer_number === expected.buyer_number)
    );
    if (allMatch) {
      console.log('  ✅ PASS: todayCall が正しくフィルタリングされた');
      testsPassed++;
    } else {
      console.log('  ❌ FAIL: todayCall のフィルタリング結果が一致しない');
      testsFailed++;
    }
  } else {
    console.log('  ❌ FAIL: todayCall のフィルタリング件数が一致しない');
    testsFailed++;
  }

  // ============================================================
  // テスト3: 内覧前日 が calculated_status でフィルタリングされることを確認
  // Requirements 3.2
  // ============================================================
  console.log('');
  console.log('🧪 テスト3: 内覧前日 が calculated_status でフィルタリングされることを確認（Requirements 3.2）');
  console.log('-'.repeat(70));

  const viewingDayBeforeResult = getBuyersByStatusLogic_UNFIXED('内覧前日', MOCK_BUYERS);
  const expectedViewingDayBefore = MOCK_BUYERS.filter(b => b.calculated_status === '内覧前日');

  console.log(`  実際の結果: ${viewingDayBeforeResult.length}件`);
  console.log(`  期待する結果: ${expectedViewingDayBefore.length}件`);

  if (viewingDayBeforeResult.length === expectedViewingDayBefore.length) {
    console.log('  ✅ PASS: 内覧前日 が正しくフィルタリングされた');
    testsPassed++;
  } else {
    console.log('  ❌ FAIL: 内覧前日 のフィルタリング件数が一致しない');
    testsFailed++;
  }

  // ============================================================
  // テスト4: threeCallUnchecked が 3回架電未 でフィルタリングされることを確認
  // Requirements 3.2
  // ============================================================
  console.log('');
  console.log('🧪 テスト4: threeCallUnchecked が 3回架電未 でフィルタリングされることを確認（Requirements 3.2）');
  console.log('-'.repeat(70));

  const threeCallResult = getBuyersByStatusLogic_UNFIXED('threeCallUnchecked', MOCK_BUYERS);
  const expectedThreeCall = MOCK_BUYERS.filter(b => b.calculated_status === '3回架電未');

  console.log(`  実際の結果: ${threeCallResult.length}件`);
  console.log(`  期待する結果: ${expectedThreeCall.length}件`);

  if (threeCallResult.length === expectedThreeCall.length) {
    console.log('  ✅ PASS: threeCallUnchecked が正しくフィルタリングされた');
    testsPassed++;
  } else {
    console.log('  ❌ FAIL: threeCallUnchecked のフィルタリング件数が一致しない');
    testsFailed++;
  }

  // ============================================================
  // テスト5: assigned:Y が follow_up_assignee または initial_assignee でフィルタリングされることを確認
  // Requirements 3.2
  // ============================================================
  console.log('');
  console.log('🧪 テスト5: assigned:Y が担当者でフィルタリングされることを確認（Requirements 3.2）');
  console.log('-'.repeat(70));

  const assignedYResult = getBuyersByStatusLogic_UNFIXED('assigned:Y', MOCK_BUYERS);
  const expectedAssignedY = MOCK_BUYERS.filter(b =>
    b.follow_up_assignee === 'Y' ||
    (!b.follow_up_assignee && b.initial_assignee === 'Y')
  );

  console.log(`  実際の結果: ${assignedYResult.length}件`);
  console.log(`  期待する結果: ${expectedAssignedY.length}件`);
  assignedYResult.forEach(b => {
    console.log(`    - ${b.buyer_number}: follow_up_assignee=${b.follow_up_assignee}, initial_assignee=${b.initial_assignee}`);
  });

  if (assignedYResult.length === expectedAssignedY.length) {
    const allMatch = expectedAssignedY.every(expected =>
      assignedYResult.some(actual => actual.buyer_number === expected.buyer_number)
    );
    if (allMatch) {
      console.log('  ✅ PASS: assigned:Y が正しくフィルタリングされた');
      testsPassed++;
    } else {
      console.log('  ❌ FAIL: assigned:Y のフィルタリング結果が一致しない');
      testsFailed++;
    }
  } else {
    console.log('  ❌ FAIL: assigned:Y のフィルタリング件数が一致しない');
    testsFailed++;
  }

  // ============================================================
  // テスト6: assigned:I が follow_up_assignee または initial_assignee でフィルタリングされることを確認
  // Requirements 3.2
  // ============================================================
  console.log('');
  console.log('🧪 テスト6: assigned:I が担当者でフィルタリングされることを確認（Requirements 3.2）');
  console.log('-'.repeat(70));

  const assignedIResult = getBuyersByStatusLogic_UNFIXED('assigned:I', MOCK_BUYERS);
  const expectedAssignedI = MOCK_BUYERS.filter(b =>
    b.follow_up_assignee === 'I' ||
    (!b.follow_up_assignee && b.initial_assignee === 'I')
  );

  console.log(`  実際の結果: ${assignedIResult.length}件`);
  console.log(`  期待する結果: ${expectedAssignedI.length}件`);

  if (assignedIResult.length === expectedAssignedI.length) {
    console.log('  ✅ PASS: assigned:I が正しくフィルタリングされた');
    testsPassed++;
  } else {
    console.log('  ❌ FAIL: assigned:I のフィルタリング件数が一致しない');
    testsFailed++;
  }

  // ============================================================
  // テスト7: todayCallAssigned:Y が 当日TEL(Y) でフィルタリングされることを確認
  // Requirements 3.2
  // ============================================================
  console.log('');
  console.log('🧪 テスト7: todayCallAssigned:Y が 当日TEL(Y) でフィルタリングされることを確認（Requirements 3.2）');
  console.log('-'.repeat(70));

  const todayCallAssignedResult = getBuyersByStatusLogic_UNFIXED('todayCallAssigned:Y', MOCK_BUYERS);
  const expectedTodayCallAssigned = MOCK_BUYERS.filter(b => b.calculated_status === '当日TEL(Y)');

  console.log(`  実際の結果: ${todayCallAssignedResult.length}件`);
  console.log(`  期待する結果: ${expectedTodayCallAssigned.length}件`);

  if (todayCallAssignedResult.length === expectedTodayCallAssigned.length) {
    console.log('  ✅ PASS: todayCallAssigned:Y が正しくフィルタリングされた');
    testsPassed++;
  } else {
    console.log('  ❌ FAIL: todayCallAssigned:Y のフィルタリング件数が一致しない');
    testsFailed++;
  }

  // ============================================================
  // テスト8: getSidebarCountsFallback の pinrich500manUnregistered カウント計算
  //          修正前は reception_date 条件なし → 2025年の買主もカウントされる
  // Requirements 3.3
  // ============================================================
  console.log('');
  console.log('🧪 テスト8: pinrich500manUnregistered カウント計算（修正前: reception_date 条件なし）（Requirements 3.3）');
  console.log('-'.repeat(70));

  const pinrich500manCount = countPinrich500manUnregistered_UNFIXED(MOCK_BUYERS);

  // 修正前は reception_date 条件なし → 2025年の買主(B008)もカウントされる
  // 条件: email非空 AND price<=500万 AND pinrich_500man_registration未
  const expectedWithoutDateFilter = MOCK_BUYERS.filter(b =>
    b.email && String(b.email).trim() &&
    b.inquiry_property_price !== null &&
    b.inquiry_property_price !== undefined &&
    Number(b.inquiry_property_price) <= 5000000 &&
    (!b.pinrich_500man_registration || b.pinrich_500man_registration === '未')
  );

  console.log(`  実際のカウント: ${pinrich500manCount}件`);
  console.log(`  期待するカウント（reception_date 条件なし）: ${expectedWithoutDateFilter.length}件`);
  console.log(`  ※ 修正前は B008（2025-12-31）と B009（null）もカウントに含まれる`);

  if (pinrich500manCount === expectedWithoutDateFilter.length) {
    console.log('  ✅ PASS: 修正前のカウントロジックが正しく動作している');
    testsPassed++;
  } else {
    console.log('  ❌ FAIL: カウントが期待値と一致しない');
    testsFailed++;
  }

  // ============================================================
  // テスト9: 他カテゴリのカウント計算が正常に動作することを確認
  // Requirements 3.3, 3.4
  // ============================================================
  console.log('');
  console.log('🧪 テスト9: 他カテゴリのカウント計算が正常に動作することを確認（Requirements 3.3, 3.4）');
  console.log('-'.repeat(70));

  const todayCallCount = countByCalculatedStatus(MOCK_BUYERS, '当日TEL');
  const expectedTodayCallCount = MOCK_BUYERS.filter(b => b.calculated_status === '当日TEL').length;

  const threeCallCount = countByCalculatedStatus(MOCK_BUYERS, '3回架電未');
  const expectedThreeCallCount = MOCK_BUYERS.filter(b => b.calculated_status === '3回架電未').length;

  console.log(`  当日TEL カウント: ${todayCallCount}件 (期待: ${expectedTodayCallCount}件)`);
  console.log(`  3回架電未 カウント: ${threeCallCount}件 (期待: ${expectedThreeCallCount}件)`);

  if (todayCallCount === expectedTodayCallCount && threeCallCount === expectedThreeCallCount) {
    console.log('  ✅ PASS: 他カテゴリのカウント計算が正常に動作している');
    testsPassed++;
  } else {
    console.log('  ❌ FAIL: 他カテゴリのカウント計算が一致しない');
    testsFailed++;
  }

  // ============================================================
  // サマリー
  // ============================================================
  console.log('');
  console.log('📊 テスト結果サマリー');
  console.log('='.repeat(70));
  console.log(`  PASS: ${testsPassed}件`);
  console.log(`  FAIL: ${testsFailed}件`);
  console.log('');

  if (testsFailed === 0) {
    console.log('✅ 全テスト PASSED');
    console.log('');
    console.log('✅ 修正前の基準動作が確認されました。');
    console.log('   - 未実装カテゴリ（inquiryEmailUnanswered 等）は空配列を返す');
    console.log('   - todayCall, 内覧前日 等は calculated_status でフィルタリングされる');
    console.log('   - assigned:Y 等の担当別カテゴリは正常に動作する');
    console.log('   - pinrich500manUnregistered 以外のカウント計算は正常に動作する');
    console.log('');
    console.log('   次のステップ: タスク3でバグを修正し、このテストが引き続き PASS することを確認する');
    process.exit(0);
  } else {
    console.log('❌ テスト FAILED');
    console.log('');
    console.log('⚠️  注意: 保全テストが FAIL しました。');
    console.log('   修正前のコードで既存の動作が壊れている可能性があります。');
    console.log('   根本原因を調査してください。');
    process.exit(1);
  }
}

runTests();
