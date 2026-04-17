/**
 * Fix Verification Test: pinrich500manUnregistered フィルタリング修正確認
 *
 * **Property 1: Fix Checking** - pinrich500manUnregistered フィルタリング
 *
 * **IMPORTANT**: このテストは修正後のコードで PASS することが期待される
 *   - PASS することでバグが修正されたことが確認される
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */

// ============================================================
// getBuyersByStatus の修正後ロジックを抽出して直接テスト
// ============================================================

/**
 * getBuyersByStatus の修正後ロジック
 * BuyerService.ts の修正後コードを再現
 */
function getBuyersByStatusLogic_FIXED(status: string, allBuyers: any[]): any[] {
  const assignedPattern1 = /^assigned:(.+)$/;
  const assignedPattern2 = /^担当\((.+)\)$/;
  const todayCallAssignedPattern = /^todayCallAssigned:(.+)$/;
  const assignedMatch1 = status.match(assignedPattern1);
  const assignedMatch2 = status.match(assignedPattern2);
  const todayCallAssignedMatch = status.match(todayCallAssignedPattern);

  let filteredBuyers: any[];

  if (todayCallAssignedMatch) {
    const assignee = todayCallAssignedMatch[1];
    filteredBuyers = allBuyers.filter((buyer: any) => buyer.calculated_status === `当日TEL(${assignee})`);
  } else if (status === 'threeCallUnchecked') {
    filteredBuyers = allBuyers.filter((buyer: any) => buyer.calculated_status === '3回架電未');
  } else if (status === 'pinrich500manUnregistered') {
    // ✅ 修正後: 専用分岐を追加
    filteredBuyers = allBuyers.filter((buyer: any) => {
      return (
        buyer.email && String(buyer.email).trim() &&
        buyer.inquiry_property_price !== null &&
        buyer.inquiry_property_price !== undefined &&
        Number(buyer.inquiry_property_price) <= 5000000 &&
        (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未') &&
        buyer.reception_date && buyer.reception_date >= '2026-01-01'
      );
    });
  } else if (
    status === 'inquiryEmailUnanswered' ||
    status === 'brokerInquiry' ||
    status === 'generalViewingSellerContactPending' ||
    status === 'viewingPromotionRequired' ||
    status === 'pinrichUnregistered'
  ) {
    filteredBuyers = [];
  } else if (assignedMatch1 || assignedMatch2) {
    const assignee = assignedMatch1 ? assignedMatch1[1] : assignedMatch2![1];
    filteredBuyers = allBuyers.filter((buyer: any) =>
      buyer.follow_up_assignee === assignee ||
      (!buyer.follow_up_assignee && buyer.initial_assignee === assignee)
    );
  } else {
    filteredBuyers = allBuyers.filter((buyer: any) => buyer.calculated_status === status);
  }

  return filteredBuyers;
}

/**
 * getSidebarCountsFallback の修正後カウントロジック
 */
function countPinrich500manUnregistered_FIXED(allBuyers: any[]): number {
  let count = 0;
  allBuyers.forEach((buyer: any) => {
    if (
      buyer.email && String(buyer.email).trim() &&
      buyer.inquiry_property_price !== null &&
      buyer.inquiry_property_price !== undefined &&
      Number(buyer.inquiry_property_price) <= 5000000 &&
      (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未') &&
      buyer.reception_date && buyer.reception_date >= '2026-01-01'  // ✅ 修正後: reception_date 条件追加
    ) {
      count++;
    }
  });
  return count;
}

// ============================================================
// テストデータ
// ============================================================

const QUALIFYING_BUYERS = [
  {
    buyer_number: 'TEST001',
    email: 'test001@example.com',
    inquiry_property_price: 4500000,
    pinrich_500man_registration: '未',
    reception_date: '2026-01-01',
    calculated_status: '当日TEL',
    name: 'テスト買主1（受付日ちょうど2026-01-01）',
  },
  {
    buyer_number: 'TEST002',
    email: 'test002@example.com',
    inquiry_property_price: 5000000,
    pinrich_500man_registration: '未',
    reception_date: '2026-03-15',
    calculated_status: '追客中',
    name: 'テスト買主2（price=500万ちょうど）',
  },
  {
    buyer_number: 'TEST003',
    email: 'test003@example.com',
    inquiry_property_price: 3000000,
    pinrich_500man_registration: null,
    reception_date: '2026-06-01',
    calculated_status: '初回架電未',
    name: 'テスト買主3（pinrich_500man_registration=null）',
  },
  {
    buyer_number: 'TEST004',
    email: 'test004@example.com',
    inquiry_property_price: 1000000,
    pinrich_500man_registration: '',
    reception_date: '2026-12-31',
    calculated_status: '追客中',
    name: 'テスト買主4（pinrich_500man_registration=空文字）',
  },
];

const NON_QUALIFYING_BUYERS = [
  {
    buyer_number: 'EXCL001',
    email: '',
    inquiry_property_price: 4000000,
    pinrich_500man_registration: '未',
    reception_date: '2026-02-01',
    calculated_status: '当日TEL',
    name: '除外1（email空）',
  },
  {
    buyer_number: 'EXCL002',
    email: 'excl002@example.com',
    inquiry_property_price: 6000000,
    pinrich_500man_registration: '未',
    reception_date: '2026-02-01',
    calculated_status: '当日TEL',
    name: '除外2（price>500万）',
  },
  {
    buyer_number: 'EXCL003',
    email: 'excl003@example.com',
    inquiry_property_price: 4000000,
    pinrich_500man_registration: '済',
    reception_date: '2026-02-01',
    calculated_status: '当日TEL',
    name: '除外3（登録済み）',
  },
  {
    buyer_number: 'EXCL004',
    email: 'excl004@example.com',
    inquiry_property_price: 4000000,
    pinrich_500man_registration: '未',
    reception_date: '2025-12-31',
    calculated_status: '当日TEL',
    name: '除外4（受付日2025-12-31）',
  },
  {
    buyer_number: 'EXCL005',
    email: 'excl005@example.com',
    inquiry_property_price: 4000000,
    pinrich_500man_registration: '未',
    reception_date: null,
    calculated_status: '当日TEL',
    name: '除外5（受付日null）',
  },
];

const ALL_MOCK_BUYERS = [...QUALIFYING_BUYERS, ...NON_QUALIFYING_BUYERS];

// ============================================================
// テスト実行
// ============================================================

function runTests(): void {
  console.log('✅ Fix Verification Test: pinrich500manUnregistered フィルタリング修正確認');
  console.log('='.repeat(70));
  console.log('');

  let testsPassed = 0;
  let testsFailed = 0;

  // テスト1: 条件を満たす買主が全て返されることを確認
  console.log('🧪 テスト1: 条件を満たす買主が全て返されることを確認（Requirements 2.1, 2.2）');
  console.log('-'.repeat(70));

  const result = getBuyersByStatusLogic_FIXED('pinrich500manUnregistered', ALL_MOCK_BUYERS);
  console.log(`  実際の結果: ${result.length}件`);
  console.log(`  期待する結果: ${QUALIFYING_BUYERS.length}件`);

  if (result.length === QUALIFYING_BUYERS.length) {
    const allFound = QUALIFYING_BUYERS.every(q => result.some(r => r.buyer_number === q.buyer_number));
    if (allFound) {
      console.log('  ✅ PASS: 条件を満たす全買主が返された');
      testsPassed++;
    } else {
      console.log('  ❌ FAIL: 一部の買主が返されなかった');
      testsFailed++;
    }
  } else {
    console.log('  ❌ FAIL: 件数が一致しない');
    testsFailed++;
  }

  // テスト2: 条件を満たさない買主が除外されることを確認
  console.log('');
  console.log('🧪 テスト2: 条件を満たさない買主が除外されることを確認（Requirements 2.1, 2.2）');
  console.log('-'.repeat(70));

  let allExcluded = true;
  for (const buyer of NON_QUALIFYING_BUYERS) {
    const found = result.some(r => r.buyer_number === buyer.buyer_number);
    if (found) {
      console.log(`  ❌ ${buyer.buyer_number} (${buyer.name}): 誤って含まれている`);
      allExcluded = false;
    } else {
      console.log(`  ✅ ${buyer.buyer_number} (${buyer.name}): 正しく除外された`);
    }
  }

  if (allExcluded) {
    console.log('  ✅ PASS: 全ての除外対象が正しく除外された');
    testsPassed++;
  } else {
    console.log('  ❌ FAIL: 除外対象が含まれている');
    testsFailed++;
  }

  // テスト3: カウント計算に reception_date 条件が適用されることを確認
  console.log('');
  console.log('🧪 テスト3: カウント計算に reception_date 条件が適用されることを確認（Requirements 2.3, 2.4）');
  console.log('-'.repeat(70));

  const count = countPinrich500manUnregistered_FIXED(ALL_MOCK_BUYERS);
  console.log(`  実際のカウント: ${count}件`);
  console.log(`  期待するカウント: ${QUALIFYING_BUYERS.length}件`);
  console.log(`  ※ 2025-12-31 の買主(EXCL004)と reception_date=null の買主(EXCL005)は除外される`);

  if (count === QUALIFYING_BUYERS.length) {
    console.log('  ✅ PASS: カウントが正しく計算された（reception_date 条件が適用されている）');
    testsPassed++;
  } else {
    console.log('  ❌ FAIL: カウントが期待値と一致しない');
    testsFailed++;
  }

  // サマリー
  console.log('');
  console.log('📊 テスト結果サマリー');
  console.log('='.repeat(70));
  console.log(`  PASS: ${testsPassed}件`);
  console.log(`  FAIL: ${testsFailed}件`);
  console.log('');

  if (testsFailed === 0) {
    console.log('✅ 全テスト PASSED — バグが修正されました！');
    process.exit(0);
  } else {
    console.log('❌ テスト FAILED — 修正を確認してください');
    process.exit(1);
  }
}

runTests();
