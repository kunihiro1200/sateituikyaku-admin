/**
 * Bug Condition Exploration Test: pinrich500manUnregistered フィルタリング未実装バグ
 *
 * **Property 1: Bug Condition** - pinrich500manUnregistered フィルタリング未実装バグ
 *
 * **CRITICAL**: このテストは修正前のコードで FAIL することが期待される
 *   - FAIL することでバグの存在が確認される
 *   - DO NOT attempt to fix the test or the code when it fails
 *
 * バグの根本原因:
 *   `getBuyersByStatus` 内で `pinrich500manUnregistered` が
 *   「未実装カテゴリ」の else if 分岐に含まれていないため、
 *   else ブロック（calculated_status でフィルタリング）に落ちて空配列が返る。
 *
 * テスト内容:
 *   4条件（email非空・price≤500万・pinrich_500man_registration未・reception_date≥2026-01-01）
 *   を満たすモックデータを用意し、getBuyersByStatus のフィルタリングロジックを直接テストする。
 *
 * **Validates: Requirements 1.1, 1.2**
 */

// ============================================================
// getBuyersByStatus のフィルタリングロジックを抽出して直接テスト
// （DBへの接続なし）
// ============================================================

/**
 * getBuyersByStatus の pinrich500manUnregistered 分岐ロジックを
 * BuyerService.ts から抽出した関数（修正前の状態を再現）
 *
 * 修正前コードの動作:
 *   - pinrich500manUnregistered は「未実装カテゴリ」の else if に含まれていない
 *   - そのため else ブロック（calculated_status でフィルタリング）に落ちる
 *   - calculated_status が 'pinrich500manUnregistered' の買主は存在しないため空配列が返る
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
    // ⚠️ 修正前: 'pinrich500manUnregistered' がここに含まれていない
  ) {
    // 新カテゴリの場合（2026年4月追加）
    filteredBuyers = [];
  } else if (assignedMatch1 || assignedMatch2) {
    const assignee = assignedMatch1 ? assignedMatch1[1] : assignedMatch2![1];
    filteredBuyers = allBuyers.filter(buyer =>
      buyer.follow_up_assignee === assignee ||
      (!buyer.follow_up_assignee && buyer.initial_assignee === assignee)
    );
  } else {
    // 既存のロジック（calculated_status でフィルタリング）
    // pinrich500manUnregistered はここに落ちる → calculated_status が一致する買主は存在しない → 空配列
    filteredBuyers = allBuyers.filter(buyer => buyer.calculated_status === status);
  }

  return filteredBuyers;
}

// ============================================================
// テストデータ: 4条件を全て満たす買主モックデータ
// ============================================================

/**
 * 4条件を全て満たす買主データ
 * - email: 非空
 * - inquiry_property_price: 5,000,000 以下
 * - pinrich_500man_registration: '未'
 * - reception_date: '2026-01-01' 以降
 */
const QUALIFYING_BUYERS = [
  {
    buyer_number: 'TEST001',
    email: 'test001@example.com',
    inquiry_property_price: 4500000,
    pinrich_500man_registration: '未',
    reception_date: '2026-01-01',
    calculated_status: '当日TEL', // pinrich500manUnregistered ではない
    name: 'テスト買主1',
  },
  {
    buyer_number: 'TEST002',
    email: 'test002@example.com',
    inquiry_property_price: 5000000,
    pinrich_500man_registration: '未',
    reception_date: '2026-03-15',
    calculated_status: '追客中',
    name: 'テスト買主2',
  },
  {
    buyer_number: 'TEST003',
    email: 'test003@example.com',
    inquiry_property_price: 3000000,
    pinrich_500man_registration: null, // null も '未' と同等
    reception_date: '2026-06-01',
    calculated_status: '初回架電未',
    name: 'テスト買主3',
  },
];

/**
 * 4条件を満たさない買主データ（フィルタリングで除外されるべき）
 */
const NON_QUALIFYING_BUYERS = [
  {
    buyer_number: 'TEST004',
    email: '', // email が空 → 除外
    inquiry_property_price: 4000000,
    pinrich_500man_registration: '未',
    reception_date: '2026-02-01',
    calculated_status: '当日TEL',
    name: 'テスト買主4（email空）',
  },
  {
    buyer_number: 'TEST005',
    email: 'test005@example.com',
    inquiry_property_price: 6000000, // price > 500万 → 除外
    pinrich_500man_registration: '未',
    reception_date: '2026-02-01',
    calculated_status: '当日TEL',
    name: 'テスト買主5（price超過）',
  },
  {
    buyer_number: 'TEST006',
    email: 'test006@example.com',
    inquiry_property_price: 4000000,
    pinrich_500man_registration: '済', // 登録済み → 除外
    reception_date: '2026-02-01',
    calculated_status: '当日TEL',
    name: 'テスト買主6（登録済み）',
  },
  {
    buyer_number: 'TEST007',
    email: 'test007@example.com',
    inquiry_property_price: 4000000,
    pinrich_500man_registration: '未',
    reception_date: '2025-12-31', // reception_date < 2026-01-01 → 除外
    calculated_status: '当日TEL',
    name: 'テスト買主7（受付日古い）',
  },
];

const ALL_MOCK_BUYERS = [...QUALIFYING_BUYERS, ...NON_QUALIFYING_BUYERS];

// ============================================================
// テスト実行
// ============================================================

function runTests(): void {
  console.log('🔍 Bug Condition Exploration Test: pinrich500manUnregistered');
  console.log('='.repeat(70));
  console.log('');
  console.log('⚠️  CRITICAL: このテストは修正前のコードで FAIL することが期待される');
  console.log('   FAIL = バグの存在が確認された（正しい結果）');
  console.log('   PASS = バグが既に修正されている（要確認）');
  console.log('');
  console.log(`📊 テストデータ: 条件を満たす買主 ${QUALIFYING_BUYERS.length}件, 満たさない買主 ${NON_QUALIFYING_BUYERS.length}件`);
  console.log('');

  let testsPassed = 0;
  let testsFailed = 0;
  const counterExamples: string[] = [];

  // ============================================================
  // テスト1: getBuyersByStatus('pinrich500manUnregistered') が
  //          条件を満たす買主を返すことを確認
  //          （修正前コードでは空配列が返るため FAIL）
  // ============================================================
  console.log('🧪 テスト1: getBuyersByStatus("pinrich500manUnregistered") のフィルタリング');
  console.log('-'.repeat(70));

  const result = getBuyersByStatusLogic_UNFIXED('pinrich500manUnregistered', ALL_MOCK_BUYERS);

  console.log(`  実際の結果: ${result.length}件`);
  console.log(`  期待する結果: ${QUALIFYING_BUYERS.length}件以上`);

  if (result.length === 0) {
    console.log('  ❌ FAIL: 空配列が返された（バグの存在を確認）');
    console.log('');
    console.log('  📌 カウンターサンプル:');
    console.log(`     getBuyersByStatus('pinrich500manUnregistered') → [] (空配列)`);
    console.log(`     条件を満たす買主が ${QUALIFYING_BUYERS.length}件存在するにもかかわらず空配列が返る`);
    console.log('');
    console.log('  📌 根本原因:');
    console.log(`     'pinrich500manUnregistered' が未実装カテゴリの else if 分岐に含まれていない`);
    console.log(`     → else ブロック（calculated_status でフィルタリング）に落ちる`);
    console.log(`     → calculated_status が 'pinrich500manUnregistered' の買主は存在しない`);
    console.log(`     → 空配列が返る`);

    counterExamples.push(
      `getBuyersByStatus('pinrich500manUnregistered') returned [] (empty array) ` +
      `even though ${QUALIFYING_BUYERS.length} qualifying buyers exist. ` +
      `Root cause: 'pinrich500manUnregistered' is not in the 'unimplemented categories' else-if branch, ` +
      `so it falls through to the calculated_status filter which returns no matches.`
    );
    testsFailed++;
  } else {
    console.log(`  ✅ PASS: ${result.length}件が返された`);
    console.log('  ⚠️  注意: バグが既に修正されている可能性があります');
    testsPassed++;
  }

  // ============================================================
  // テスト2: 条件を満たす各買主が結果に含まれることを確認
  //          （修正前コードでは全て含まれないため FAIL）
  // ============================================================
  console.log('');
  console.log('🧪 テスト2: 条件を満たす各買主が結果に含まれることを確認');
  console.log('-'.repeat(70));

  let allQualifyingFound = true;
  for (const buyer of QUALIFYING_BUYERS) {
    const found = result.some(b => b.buyer_number === buyer.buyer_number);
    if (found) {
      console.log(`  ✅ ${buyer.buyer_number} (${buyer.name}): 結果に含まれている`);
    } else {
      console.log(`  ❌ ${buyer.buyer_number} (${buyer.name}): 結果に含まれていない（バグ）`);
      console.log(`     email=${buyer.email}, price=${buyer.inquiry_property_price}, ` +
        `pinrich=${buyer.pinrich_500man_registration}, reception_date=${buyer.reception_date}`);
      allQualifyingFound = false;
      counterExamples.push(
        `Buyer ${buyer.buyer_number} satisfies all 4 conditions ` +
        `(email="${buyer.email}", price=${buyer.inquiry_property_price}, ` +
        `pinrich_500man_registration="${buyer.pinrich_500man_registration}", ` +
        `reception_date="${buyer.reception_date}") ` +
        `but was NOT returned by getBuyersByStatus('pinrich500manUnregistered')`
      );
    }
  }

  if (!allQualifyingFound) {
    console.log('  ❌ FAIL: 条件を満たす買主が結果に含まれていない（バグの存在を確認）');
    testsFailed++;
  } else {
    console.log('  ✅ PASS: 全ての条件を満たす買主が結果に含まれている');
    testsPassed++;
  }

  // ============================================================
  // テスト3: 条件を満たさない買主が結果に含まれないことを確認
  //          （修正前コードでは空配列なので偶然 PASS するが、
  //            修正後コードでも PASS することを確認するための基準テスト）
  // ============================================================
  console.log('');
  console.log('🧪 テスト3: 条件を満たさない買主が結果に含まれないことを確認');
  console.log('-'.repeat(70));

  let noNonQualifyingFound = true;
  for (const buyer of NON_QUALIFYING_BUYERS) {
    const found = result.some(b => b.buyer_number === buyer.buyer_number);
    if (found) {
      console.log(`  ❌ ${buyer.buyer_number} (${buyer.name}): 結果に含まれている（誤り）`);
      noNonQualifyingFound = false;
    } else {
      console.log(`  ✅ ${buyer.buyer_number} (${buyer.name}): 結果に含まれていない（正しい）`);
    }
  }

  if (noNonQualifyingFound) {
    console.log('  ✅ PASS: 条件を満たさない買主は結果に含まれていない');
    testsPassed++;
  } else {
    console.log('  ❌ FAIL: 条件を満たさない買主が結果に含まれている');
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

  if (counterExamples.length > 0) {
    console.log('📌 発見したカウンターサンプル:');
    counterExamples.forEach((ex, i) => {
      console.log(`  ${i + 1}. ${ex}`);
    });
    console.log('');
  }

  if (testsFailed > 0) {
    console.log('❌ テスト FAILED');
    console.log('');
    console.log('✅ これは期待された結果です！');
    console.log('   バグの存在が確認されました。');
    console.log('   根本原因: getBuyersByStatus 内で pinrich500manUnregistered が');
    console.log('   未実装カテゴリの else if 分岐に含まれていないため、');
    console.log('   else ブロック（calculated_status フィルタ）に落ちて空配列が返る。');
    console.log('');
    console.log('   次のステップ: タスク3でバグを修正する');
    process.exit(1); // FAIL = バグの存在を確認 → 期待された結果
  } else {
    console.log('✅ テスト PASSED');
    console.log('');
    console.log('⚠️  注意: バグが既に修正されている可能性があります。');
    console.log('   修正前のコードでこのテストが PASS した場合は、');
    console.log('   バグの根本原因の分析を再確認してください。');
    process.exit(0);
  }
}

runTests();
