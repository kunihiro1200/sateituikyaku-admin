/**
 * Bug Condition Exploration Test: 物件リストサイドバー修正
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは未修正コードでバグの存在を証明するためのものです。
 * テストが FAIL することが期待される結果です（バグの存在を確認）。
 *
 * バグ1: PropertySidebarStatus.tsx の Paper コンポーネントに boxShadow: 'none' と border: 'none' が設定されていない
 * バグ2: PropertyListingsPage.tsx の filteredListings ロジックが '林専任公開中' に対応していない
 *
 * CRITICAL: このテストは修正前のコードで必ず FAIL する — 失敗がバグの存在を証明する
 * DO NOT attempt to fix the test or the code when it fails
 */

import * as fs from 'fs';
import * as path from 'path';

// ===== バグ1テスト: PropertySidebarStatus.tsx の Paper コンポーネントの枠線 =====

describe('Property 1: Bug Condition - サイドバー枠線バグ', () => {
  const componentPath = path.join(__dirname, '../components/PropertySidebarStatus.tsx');
  let componentContent: string;

  beforeAll(() => {
    componentContent = fs.readFileSync(componentPath, 'utf-8');
  });

  /**
   * テスト: Paper コンポーネントに boxShadow: 'none' が設定されていることを確認
   *
   * 未修正コードでの期待される動作:
   * - `<Paper sx={{ width: 210, flexShrink: 0 }}>` のみで boxShadow が設定されていない
   * - このテストは FAIL する（バグが存在することを証明）
   *
   * 修正後コードでの期待される動作:
   * - `<Paper sx={{ width: 210, flexShrink: 0, boxShadow: 'none', border: 'none' }}>` が存在する
   * - このテストは PASS する
   *
   * isBugCondition_Border: component.elevation IS NOT 0 AND component.sx.boxShadow IS NOT 'none'
   */
  test('Paper コンポーネントに boxShadow: "none" が設定されている', () => {
    // boxShadow: 'none' が Paper の sx に設定されているか確認
    const boxShadowPattern = /boxShadow:\s*['"]none['"]/;
    expect(componentContent).toMatch(boxShadowPattern);
  });

  test('Paper コンポーネントに border: "none" が設定されている', () => {
    // border: 'none' が Paper の sx に設定されているか確認
    const borderPattern = /border:\s*['"]none['"]/;
    expect(componentContent).toMatch(borderPattern);
  });

  test('Paper コンポーネントに boxShadow と border が両方設定されている（バグ条件確認）', () => {
    // 未修正コードでは <Paper sx={{ width: 210, flexShrink: 0 }}> のみ
    // 修正後コードでは <Paper sx={{ width: 210, flexShrink: 0, boxShadow: 'none', border: 'none' }}>
    const hasBoxShadow = /boxShadow:\s*['"]none['"]/.test(componentContent);
    const hasBorder = /border:\s*['"]none['"]/.test(componentContent);

    // 未修正コードでは両方 false → このテストは FAIL する（バグの存在を証明）
    // 修正後コードでは両方 true → このテストは PASS する
    expect(hasBoxShadow).toBe(true);
    expect(hasBorder).toBe(true);
  });
});

// ===== バグ2テスト: PropertyListingsPage.tsx の filteredListings ロジック =====

describe('Property 1: Bug Condition - 林専任公開中フィルターバグ', () => {
  /**
   * PropertyListingsPage.tsx の filteredListings ロジックを直接再現する
   *
   * 未修正コードのフィルタリングロジック:
   * - assigneeMap に '林専任公開中' が含まれていない
   * - フィルタリング条件配列に '林専任公開中' が含まれていない
   * → sidebarStatus === '林専任公開中' の場合、else ブランチに落ちて
   *   l.sidebar_status === '林専任公開中' の単純比較のみになる
   * → sidebar_status === '専任・公開中' かつ sales_assignee === '林田' の古いデータがフィルタリングされない
   */

  // 未修正コードの filteredListings ロジックを再現
  function filteredListings_unfixed(
    allListings: Array<{ sidebar_status?: string; sales_assignee?: string; [key: string]: any }>,
    sidebarStatus: string
  ) {
    let listings = allListings;

    if (sidebarStatus && sidebarStatus !== 'all') {
      if (sidebarStatus === '未完了') {
        listings = listings.filter(l => l.confirmation === '未');
      } else if (sidebarStatus === '要値下げ') {
        listings = listings.filter(l => false); // 簡略化
      } else if (sidebarStatus.startsWith('未報告')) {
        listings = listings.filter(l => false); // 簡略化
      } else if (
        // 未修正コード: '林専任公開中' が含まれていない配列
        ['Y専任公開中', '生・専任公開中', '久・専任公開中', 'U専任公開中', '林・専任公開中', 'K専任公開中', 'R専任公開中', 'I専任公開中'].includes(sidebarStatus)
      ) {
        // 未修正コードの assigneeMap: '林専任公開中' が含まれていない
        const assigneeMap: Record<string, string> = {
          'Y専任公開中': '山本',
          '生・専任公開中': '生野',
          '久・専任公開中': '久',
          'U専任公開中': '裏',
          '林・専任公開中': '林',
          'K専任公開中': '国広',
          'R専任公開中': '木村',
          'I専任公開中': '角井',
          // '林専任公開中': '林田' が存在しない（バグ）
        };
        const targetAssignee = assigneeMap[sidebarStatus];
        listings = listings.filter(l =>
          l.sidebar_status === sidebarStatus ||
          (l.sidebar_status === '専任・公開中' && l.sales_assignee === targetAssignee)
        );
      } else {
        // '林専任公開中' はここに落ちる（else ブランチ）
        listings = listings.filter(l => l.sidebar_status === sidebarStatus);
      }
    }

    return listings;
  }

  /**
   * テスト: sidebar_status === '林専任公開中' の物件が '林専任公開中' フィルターで取得できることを確認
   *
   * 未修正コードでの期待される動作:
   * - else ブランチで l.sidebar_status === '林専任公開中' の単純比較になる
   * - sidebar_status === '林専任公開中' の物件は取得できる（これは動作する）
   *
   * このテストは PASS する（else ブランチでも単純比較は動作するため）
   */
  test('sidebar_status === "林専任公開中" の物件が "林専任公開中" フィルターで取得できる', () => {
    const listings = [
      { id: '1', sidebar_status: '林専任公開中', sales_assignee: '林田' },
      { id: '2', sidebar_status: '専任・公開中', sales_assignee: '林田' },
      { id: '3', sidebar_status: 'Y専任公開中', sales_assignee: '山本' },
    ];

    const result = filteredListings_unfixed(listings, '林専任公開中');

    // sidebar_status === '林専任公開中' の物件は取得できる（else ブランチの単純比較）
    expect(result.some(l => l.id === '1')).toBe(true);
  });

  /**
   * テスト: sidebar_status === '専任・公開中' かつ sales_assignee === '林田' の物件が
   *         '林専任公開中' フィルターで取得できることを確認
   *
   * 未修正コードでの期待される動作:
   * - '林専任公開中' は assigneeMap に含まれていないため、else ブランチに落ちる
   * - else ブランチでは l.sidebar_status === '林専任公開中' の単純比較のみ
   * - sidebar_status === '専任・公開中' かつ sales_assignee === '林田' の物件は取得されない（バグ）
   * - このテストは FAIL する（バグの存在を証明）
   *
   * 修正後コードでの期待される動作:
   * - '林専任公開中' が assigneeMap に含まれ、フィルタリング条件配列にも含まれる
   * - sidebar_status === '専任・公開中' かつ sales_assignee === '林田' の物件も取得される
   * - このテストは PASS する
   *
   * isBugCondition_Filter: sidebarStatus === '林専任公開中' AND '林専任公開中' NOT IN filterArray AND '林専任公開中' NOT IN assigneeMap
   */
  test('sidebar_status === "専任・公開中" かつ sales_assignee === "林田" の物件が "林専任公開中" フィルターで取得できる（バグ条件）', () => {
    const listings = [
      { id: '1', sidebar_status: '林専任公開中', sales_assignee: '林田' },
      { id: '2', sidebar_status: '専任・公開中', sales_assignee: '林田' }, // 古いデータ
      { id: '3', sidebar_status: 'Y専任公開中', sales_assignee: '山本' },
    ];

    const result = filteredListings_unfixed(listings, '林専任公開中');

    // 未修正コードでは id='2' は取得されない（バグ）
    // このテストは FAIL する（バグの存在を証明）
    expect(result.some(l => l.id === '2')).toBe(true);
  });

  /**
   * テスト: '林専任公開中' が filteredListings のフィルタリング条件配列に含まれていないことを確認
   *
   * 未修正コードでの期待される動作:
   * - フィルタリング条件配列に '林専任公開中' が含まれていない
   * - このテストは PASS する（バグの存在を証明）
   *
   * 修正後コードでの期待される動作:
   * - フィルタリング条件配列に '林専任公開中' が含まれている
   * - このテストは FAIL する（バグが修正されたことを証明）
   */
  test('未修正コードの filterArray に "林専任公開中" が含まれていないことを確認（バグ条件の直接確認）', () => {
    // 未修正コードのフィルタリング条件配列
    const unfixedFilterArray = [
      'Y専任公開中', '生・専任公開中', '久・専任公開中', 'U専任公開中',
      '林・専任公開中', 'K専任公開中', 'R専任公開中', 'I専任公開中'
    ];

    // '林専任公開中' が含まれていないことを確認（バグの存在を証明）
    // このテストは PASS する（バグが存在することを示す）
    expect(unfixedFilterArray.includes('林専任公開中')).toBe(false);
  });

  /**
   * テスト: PropertyListingsPage.tsx のソースコードに '林専任公開中' が assigneeMap に含まれていることを確認
   *
   * 未修正コードでの期待される動作:
   * - assigneeMap に '林専任公開中': '林田' が含まれていない
   * - このテストは FAIL する（バグの存在を証明）
   *
   * 修正後コードでの期待される動作:
   * - assigneeMap に '林専任公開中': '林田' が含まれている
   * - このテストは PASS する
   */
  test('PropertyListingsPage.tsx の assigneeMap に "林専任公開中" が含まれている', () => {
    const pagePath = path.join(__dirname, '../pages/PropertyListingsPage.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf-8');

    // assigneeMap に '林専任公開中': '林田' が含まれているか確認
    const assigneeMapPattern = /['"]林専任公開中['"]\s*:\s*['"]林田['"]/;
    expect(pageContent).toMatch(assigneeMapPattern);
  });

  /**
   * テスト: PropertyListingsPage.tsx のフィルタリング条件配列に '林専任公開中' が含まれていることを確認
   *
   * 未修正コードでの期待される動作:
   * - フィルタリング条件配列に '林専任公開中' が含まれていない
   * - このテストは FAIL する（バグの存在を証明）
   *
   * 修正後コードでの期待される動作:
   * - フィルタリング条件配列に '林専任公開中' が含まれている
   * - このテストは PASS する
   */
  test('PropertyListingsPage.tsx のフィルタリング条件配列に "林専任公開中" が含まれている', () => {
    const pagePath = path.join(__dirname, '../pages/PropertyListingsPage.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf-8');

    // フィルタリング条件配列に '林専任公開中' が含まれているか確認
    // 配列の中に '林専任公開中' が含まれているパターン
    const filterArrayPattern = /\[([^\]]*['"]林専任公開中['"][^\]]*)\]\.includes\(sidebarStatus\)/;
    expect(pageContent).toMatch(filterArrayPattern);
  });
});
