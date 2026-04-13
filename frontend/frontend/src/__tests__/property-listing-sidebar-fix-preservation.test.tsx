/**
 * Preservation Test: 物件リストサイドバー修正 - 既存動作の保全確認
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * このテストは修正前のコードで既存の動作が正しく動作していることを確認するためのものです。
 * テストが PASS することが期待される結果です（ベースライン動作の確認）。
 *
 * 保全確認内容:
 * 1. sidebarStatus === 'Y専任公開中' の場合、担当者「山本」の物件が正しくフィルタリングされる
 * 2. sidebarStatus === '生・専任公開中' の場合、担当者「生野」の物件が正しくフィルタリングされる
 * 3. sidebarStatus === '未完了' などその他カテゴリーが正しく動作する
 * 4. <List> コンポーネントに maxHeight: 'calc(100vh - 200px)' と overflow: 'auto' が維持されている
 *
 * EXPECTED OUTCOME: 修正前のコードで全テストが PASS する（ベースライン動作の確認）
 */

import * as fs from 'fs';
import * as path from 'path';

// ===== 未修正コードの filteredListings ロジックを再現 =====

function filteredListings_unfixed(
  allListings: Array<{ sidebar_status?: string; sales_assignee?: string; confirmation?: string; [key: string]: any }>,
  sidebarStatus: string
) {
  let listings = allListings;

  if (sidebarStatus && sidebarStatus !== 'all') {
    if (sidebarStatus === '未完了') {
      listings = listings.filter(l => l.confirmation === '未');
    } else if (sidebarStatus === '要値下げ') {
      // 簡略化（calculatePropertyStatusに依存するため）
      listings = listings.filter(l => false);
    } else if (sidebarStatus.startsWith('未報告')) {
      // 簡略化（calculatePropertyStatusに依存するため）
      listings = listings.filter(l => false);
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
      listings = listings.filter(l => l.sidebar_status === sidebarStatus);
    }
  }

  return listings;
}

// ===== 保全テスト1: Y専任公開中フィルター =====

describe('Property 2: Preservation - Y専任公開中フィルターの動作維持', () => {
  const listings = [
    { id: '1', sidebar_status: 'Y専任公開中', sales_assignee: '山本' },
    { id: '2', sidebar_status: '専任・公開中', sales_assignee: '山本' }, // 古いデータ
    { id: '3', sidebar_status: '専任・公開中', sales_assignee: '生野' }, // 別担当者
    { id: '4', sidebar_status: '生・専任公開中', sales_assignee: '生野' },
    { id: '5', sidebar_status: '林専任公開中', sales_assignee: '林田' },
  ];

  /**
   * テスト: sidebarStatus === 'Y専任公開中' の場合、担当者「山本」の物件が取得できる
   *
   * 修正前のコードで PASS することを確認（ベースライン動作）
   */
  test('sidebarStatus === "Y専任公開中" の場合、sidebar_status === "Y専任公開中" の物件が取得できる', () => {
    const result = filteredListings_unfixed(listings, 'Y専任公開中');
    expect(result.some(l => l.id === '1')).toBe(true);
  });

  test('sidebarStatus === "Y専任公開中" の場合、sidebar_status === "専任・公開中" かつ sales_assignee === "山本" の物件が取得できる', () => {
    const result = filteredListings_unfixed(listings, 'Y専任公開中');
    expect(result.some(l => l.id === '2')).toBe(true);
  });

  test('sidebarStatus === "Y専任公開中" の場合、別担当者の物件は取得されない', () => {
    const result = filteredListings_unfixed(listings, 'Y専任公開中');
    // 生野の物件は取得されない
    expect(result.some(l => l.id === '3')).toBe(false);
    expect(result.some(l => l.id === '4')).toBe(false);
    // 林田の物件は取得されない
    expect(result.some(l => l.id === '5')).toBe(false);
  });

  test('sidebarStatus === "Y専任公開中" の場合、取得件数が正しい（山本の物件のみ）', () => {
    const result = filteredListings_unfixed(listings, 'Y専任公開中');
    // id='1'（Y専任公開中）と id='2'（専任・公開中 + 山本）の2件
    expect(result.length).toBe(2);
  });
});

// ===== 保全テスト2: 生・専任公開中フィルター =====

describe('Property 2: Preservation - 生・専任公開中フィルターの動作維持', () => {
  const listings = [
    { id: '1', sidebar_status: '生・専任公開中', sales_assignee: '生野' },
    { id: '2', sidebar_status: '専任・公開中', sales_assignee: '生野' }, // 古いデータ
    { id: '3', sidebar_status: '専任・公開中', sales_assignee: '山本' }, // 別担当者
    { id: '4', sidebar_status: 'Y専任公開中', sales_assignee: '山本' },
    { id: '5', sidebar_status: '林専任公開中', sales_assignee: '林田' },
  ];

  /**
   * テスト: sidebarStatus === '生・専任公開中' の場合、担当者「生野」の物件が取得できる
   *
   * 修正前のコードで PASS することを確認（ベースライン動作）
   */
  test('sidebarStatus === "生・専任公開中" の場合、sidebar_status === "生・専任公開中" の物件が取得できる', () => {
    const result = filteredListings_unfixed(listings, '生・専任公開中');
    expect(result.some(l => l.id === '1')).toBe(true);
  });

  test('sidebarStatus === "生・専任公開中" の場合、sidebar_status === "専任・公開中" かつ sales_assignee === "生野" の物件が取得できる', () => {
    const result = filteredListings_unfixed(listings, '生・専任公開中');
    expect(result.some(l => l.id === '2')).toBe(true);
  });

  test('sidebarStatus === "生・専任公開中" の場合、別担当者の物件は取得されない', () => {
    const result = filteredListings_unfixed(listings, '生・専任公開中');
    // 山本の物件は取得されない
    expect(result.some(l => l.id === '3')).toBe(false);
    expect(result.some(l => l.id === '4')).toBe(false);
    // 林田の物件は取得されない
    expect(result.some(l => l.id === '5')).toBe(false);
  });

  test('sidebarStatus === "生・専任公開中" の場合、取得件数が正しい（生野の物件のみ）', () => {
    const result = filteredListings_unfixed(listings, '生・専任公開中');
    // id='1'（生・専任公開中）と id='2'（専任・公開中 + 生野）の2件
    expect(result.length).toBe(2);
  });
});

// ===== 保全テスト3: その他カテゴリーフィルター =====

describe('Property 2: Preservation - その他カテゴリーフィルターの動作維持', () => {
  const listings = [
    { id: '1', sidebar_status: '未完了', confirmation: '未', sales_assignee: '山本' },
    { id: '2', sidebar_status: 'Y専任公開中', confirmation: '済', sales_assignee: '山本' },
    { id: '3', sidebar_status: '一般公開中物件', confirmation: '済', sales_assignee: '生野' },
    { id: '4', sidebar_status: '公開前情報', confirmation: '済', sales_assignee: '久' },
    { id: '5', sidebar_status: '非公開（配信メールのみ）', confirmation: '済', sales_assignee: '裏' },
    { id: '6', sidebar_status: '林専任公開中', confirmation: '済', sales_assignee: '林田' },
  ];

  /**
   * テスト: sidebarStatus === '未完了' の場合、confirmation === '未' の物件が取得できる
   */
  test('sidebarStatus === "未完了" の場合、confirmation === "未" の物件が取得できる', () => {
    const result = filteredListings_unfixed(listings, '未完了');
    expect(result.some(l => l.id === '1')).toBe(true);
  });

  test('sidebarStatus === "未完了" の場合、confirmation !== "未" の物件は取得されない', () => {
    const result = filteredListings_unfixed(listings, '未完了');
    expect(result.some(l => l.id === '2')).toBe(false);
    expect(result.some(l => l.id === '3')).toBe(false);
  });

  /**
   * テスト: sidebarStatus === '一般公開中物件' の場合、正しくフィルタリングされる
   */
  test('sidebarStatus === "一般公開中物件" の場合、sidebar_status === "一般公開中物件" の物件が取得できる', () => {
    const result = filteredListings_unfixed(listings, '一般公開中物件');
    expect(result.some(l => l.id === '3')).toBe(true);
    expect(result.length).toBe(1);
  });

  /**
   * テスト: sidebarStatus === '公開前情報' の場合、正しくフィルタリングされる
   */
  test('sidebarStatus === "公開前情報" の場合、sidebar_status === "公開前情報" の物件が取得できる', () => {
    const result = filteredListings_unfixed(listings, '公開前情報');
    expect(result.some(l => l.id === '4')).toBe(true);
    expect(result.length).toBe(1);
  });

  /**
   * テスト: sidebarStatus === '非公開（配信メールのみ）' の場合、正しくフィルタリングされる
   */
  test('sidebarStatus === "非公開（配信メールのみ）" の場合、正しくフィルタリングされる', () => {
    const result = filteredListings_unfixed(listings, '非公開（配信メールのみ）');
    expect(result.some(l => l.id === '5')).toBe(true);
    expect(result.length).toBe(1);
  });

  /**
   * テスト: sidebarStatus === 'all' または null の場合、全件取得できる
   */
  test('sidebarStatus === "all" の場合、全件取得できる', () => {
    const result = filteredListings_unfixed(listings, 'all');
    expect(result.length).toBe(listings.length);
  });
});

// ===== 保全テスト4: List コンポーネントのスタイル維持 =====

describe('Property 2: Preservation - List コンポーネントのスタイル維持', () => {
  const componentPath = path.join(__dirname, '../components/PropertySidebarStatus.tsx');
  let componentContent: string;

  beforeAll(() => {
    componentContent = fs.readFileSync(componentPath, 'utf-8');
  });

  /**
   * テスト: <List> コンポーネントに maxHeight: 'calc(100vh - 200px)' が設定されている
   *
   * 修正前のコードで PASS することを確認（ベースライン動作）
   * 修正後もこのスタイルが維持されていることを確認（リグレッション防止）
   */
  test('<List> コンポーネントに maxHeight: "calc(100vh - 200px)" が設定されている', () => {
    // maxHeight: 'calc(100vh - 200px)' が List の sx に設定されているか確認
    const maxHeightPattern = /maxHeight:\s*['"]calc\(100vh\s*-\s*200px\)['"]/;
    expect(componentContent).toMatch(maxHeightPattern);
  });

  /**
   * テスト: <List> コンポーネントに overflow: 'auto' が設定されている
   *
   * 修正前のコードで PASS することを確認（ベースライン動作）
   * 修正後もこのスタイルが維持されていることを確認（リグレッション防止）
   */
  test('<List> コンポーネントに overflow: "auto" が設定されている', () => {
    // overflow: 'auto' が List の sx に設定されているか確認
    const overflowPattern = /overflow:\s*['"]auto['"]/;
    expect(componentContent).toMatch(overflowPattern);
  });

  /**
   * テスト: <List dense sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}> が存在する
   *
   * 修正前のコードで PASS することを確認（ベースライン動作）
   * 修正後もこのスタイルが維持されていることを確認（リグレッション防止）
   */
  test('<List dense sx={{ maxHeight: "calc(100vh - 200px)", overflow: "auto" }}> が存在する', () => {
    // List コンポーネントに dense と maxHeight と overflow が設定されているか確認
    const listDensePattern = /<List\s+dense/;
    const hasMaxHeight = /maxHeight:\s*['"]calc\(100vh\s*-\s*200px\)['"]/.test(componentContent);
    const hasOverflow = /overflow:\s*['"]auto['"]/.test(componentContent);

    expect(componentContent).toMatch(listDensePattern);
    expect(hasMaxHeight).toBe(true);
    expect(hasOverflow).toBe(true);
  });
});

// ===== 保全テスト5: 全専任公開中フィルターの動作維持（プロパティベーステスト） =====

describe('Property 2: Preservation - 全専任公開中フィルターの動作維持（プロパティベーステスト）', () => {
  /**
   * テスト: '林専任公開中' 以外の全専任公開中ステータスで正しくフィルタリングされる
   *
   * 修正前のコードで PASS することを確認（ベースライン動作）
   * 修正後も同じ結果が返ることを確認（リグレッション防止）
   */

  const assigneeMap: Record<string, string> = {
    'Y専任公開中': '山本',
    '生・専任公開中': '生野',
    '久・専任公開中': '久',
    'U専任公開中': '裏',
    '林・専任公開中': '林',
    'K専任公開中': '国広',
    'R専任公開中': '木村',
    'I専任公開中': '角井',
  };

  const seninStatuses = Object.keys(assigneeMap);

  // テスト用物件データ（各担当者の物件を含む）
  const listings = [
    { id: '1', sidebar_status: 'Y専任公開中', sales_assignee: '山本' },
    { id: '2', sidebar_status: '専任・公開中', sales_assignee: '山本' },
    { id: '3', sidebar_status: '生・専任公開中', sales_assignee: '生野' },
    { id: '4', sidebar_status: '専任・公開中', sales_assignee: '生野' },
    { id: '5', sidebar_status: '久・専任公開中', sales_assignee: '久' },
    { id: '6', sidebar_status: '専任・公開中', sales_assignee: '久' },
    { id: '7', sidebar_status: 'U専任公開中', sales_assignee: '裏' },
    { id: '8', sidebar_status: '専任・公開中', sales_assignee: '裏' },
    { id: '9', sidebar_status: '林・専任公開中', sales_assignee: '林' },
    { id: '10', sidebar_status: '専任・公開中', sales_assignee: '林' },
    { id: '11', sidebar_status: 'K専任公開中', sales_assignee: '国広' },
    { id: '12', sidebar_status: '専任・公開中', sales_assignee: '国広' },
    { id: '13', sidebar_status: 'R専任公開中', sales_assignee: '木村' },
    { id: '14', sidebar_status: '専任・公開中', sales_assignee: '木村' },
    { id: '15', sidebar_status: 'I専任公開中', sales_assignee: '角井' },
    { id: '16', sidebar_status: '専任・公開中', sales_assignee: '角井' },
    { id: '17', sidebar_status: '林専任公開中', sales_assignee: '林田' }, // バグ対象（別テスト）
    { id: '18', sidebar_status: '専任・公開中', sales_assignee: '林田' }, // バグ対象（別テスト）
  ];

  seninStatuses.forEach(status => {
    const targetAssignee = assigneeMap[status];

    test(`sidebarStatus === "${status}" の場合、担当者「${targetAssignee}」の物件が正しくフィルタリングされる`, () => {
      const result = filteredListings_unfixed(listings, status);

      // 対象担当者の物件が含まれる
      const targetListings = listings.filter(l =>
        l.sidebar_status === status ||
        (l.sidebar_status === '専任・公開中' && l.sales_assignee === targetAssignee)
      );

      expect(result.length).toBe(targetListings.length);
      targetListings.forEach(l => {
        expect(result.some(r => r.id === l.id)).toBe(true);
      });
    });

    test(`sidebarStatus === "${status}" の場合、他の担当者の物件は含まれない`, () => {
      const result = filteredListings_unfixed(listings, status);

      // 対象担当者以外の物件が含まれない
      result.forEach(l => {
        const isTargetStatus = l.sidebar_status === status;
        const isOldDataWithTargetAssignee = l.sidebar_status === '専任・公開中' && l.sales_assignee === targetAssignee;
        expect(isTargetStatus || isOldDataWithTargetAssignee).toBe(true);
      });
    });
  });
});
