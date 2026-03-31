# Design Document

## Overview

本機能は、売主リスト一覧のサイドバーにおいて、営業担当別カテゴリ（担当(I)、担当(K)、担当(M)等）から「状況（当社）」が「他社買取」を含む売主を除外する機能です。

現在、営業担当別カテゴリには「一般媒介」「専任媒介」「追客不要」を含む売主が除外されていますが、「他社買取」を含む売主は除外されていません。これにより、実際には追客が不要な売主が担当別カテゴリに表示され、営業担当者の業務効率を低下させています。

本機能により、営業担当者は実際に追客が必要な売主のみに集中でき、業務効率が向上します。

## Architecture

本機能は以下の3つのレイヤーで実装されます：

```
┌─────────────────────────────────────────┐
│  フロントエンド                          │
│  - SellerStatusSidebar.tsx              │
│  - sellerStatusFilters.ts               │
│    └─ isVisitAssignedTo()               │
│    └─ getUniqueAssignees()              │
└─────────────────────────────────────────┘
              ↓ API呼び出し
┌─────────────────────────────────────────┐
│  バックエンドAPI                         │
│  - routes/sellers.ts                    │
│    └─ GET /api/sellers/sidebar-counts   │
│    └─ GET /api/sellers                  │
└─────────────────────────────────────────┘
              ↓ サービス層
┌─────────────────────────────────────────┐
│  サービス層                              │
│  - SellerService.supabase.ts            │
│    └─ getSidebarCounts()                │
│    └─ getSidebarCountsFallback()        │
│    └─ listSellers()                     │
└─────────────────────────────────────────┘
              ↓ データベース
┌─────────────────────────────────────────┐
│  Supabase                               │
│  - sellers テーブル                      │
│  - seller_sidebar_counts テーブル        │
└─────────────────────────────────────────┘
```

### 除外処理の実装箇所

1. **フロントエンド**: `isVisitAssignedTo()` 関数に除外ロジックを追加
2. **バックエンド（カウント計算）**: `getSidebarCountsFallback()` の `visitAssignedCounts` 計算時に除外
3. **バックエンド（リスト取得）**: `listSellers()` の `visitAssigned:xxx` カテゴリ処理時に除外

### 既存の除外ルール

現在、営業担当別カテゴリでは以下のステータスを含む売主が除外されています：

- 「一般媒介」を含む
- 「専任媒介」を含む
- 「追客不要」を含む

本機能では、これに「他社買取」を追加します。

## Components and Interfaces

### 1. フロントエンド: sellerStatusFilters.ts

#### isVisitAssignedTo()

営業担当別カテゴリのフィルタリング関数。statusフィールドに「他社買取」を含む売主を除外するロジックを追加します。

```typescript
export const isVisitAssignedTo = (seller: Seller | any, assignee: string): boolean => {
  // 空文字や「外す」は担当なしと同じ扱い
  if (!assignee || assignee.trim() === '' || assignee.trim() === '外す') {
    return false;
  }
  
  // 「他社買取」を含む売主を除外（新規追加）
  const status = seller.status || '';
  if (typeof status === 'string' && status.includes('他社買取')) {
    return false;
  }
  
  // visitAssigneeInitials（元のイニシャル）を優先して比較
  const visitAssigneeInitials = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee || '';
  return visitAssigneeInitials.trim() === assignee;
};
```

#### getUniqueAssignees()

担当者イニシャルのリストを取得する関数。「他社買取」を含む売主を除外した担当者リストを返すように修正します。

```typescript
export const getUniqueAssignees = (sellers: (Seller | any)[]): string[] => {
  // 「他社買取」を含む売主を除外してから担当者を抽出
  const filteredSellers = sellers.filter(s => {
    const status = s.status || '';
    return !(typeof status === 'string' && status.includes('他社買取'));
  });
  
  const assignees = filteredSellers
    .map(s => s.visitAssigneeInitials || s.visit_assignee || s.visitAssignee || '')
    .filter(a => a && a.trim() !== '' && a.trim() !== '外す');
  return [...new Set(assignees)].sort();
};
```

### 2. バックエンド: SellerService.supabase.ts

#### getSidebarCountsFallback()

サイドバーカウントのフォールバック計算。`visitAssignedCounts` の計算時に「他社買取」を含む売主を除外します。

```typescript
// 既存の除外条件に「他社買取」を追加
const { data: allAssignedSellers } = await this.table('sellers')
  .select('visit_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  .neq('visit_assignee', '外す')
  .not('status', 'ilike', '%一般媒介%')
  .not('status', 'ilike', '%専任媒介%')
  .not('status', 'ilike', '%追客不要%')
  .not('status', 'ilike', '%他社買取%');  // 新規追加
```

#### listSellers()

売主リスト取得。`visitAssigned:xxx` カテゴリの処理時に「他社買取」を含む売主を除外します。

```typescript
if (dynamicCategory.startsWith('visitAssigned:')) {
  const assignee = dynamicCategory.replace('visitAssigned:', '');
  // 担当者別（営担が指定のイニシャルの全売主、一般媒介・専任媒介・追客不要・他社買取は除外）
  query = query
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .eq('visit_assignee', assignee)
    .not('status', 'ilike', '%一般媒介%')
    .not('status', 'ilike', '%専任媒介%')
    .not('status', 'ilike', '%追客不要%')
    .not('status', 'ilike', '%他社買取%');  // 新規追加
}
```

### 3. データベース: seller_sidebar_counts テーブル

`seller_sidebar_counts` テーブルは、GASまたはバックエンドの定期処理によって更新されます。現在のコードでは、`getSidebarCounts()` がこのテーブルから読み取り、テーブルが空の場合は `getSidebarCountsFallback()` にフォールバックします。

本機能では、`getSidebarCountsFallback()` の計算ロジックを修正することで、テーブルが更新される際に「他社買取」除外が反映されます。

## Data Models

### Seller

売主データモデル。statusフィールドに「他社買取」が含まれるかどうかで除外判定を行います。

```typescript
interface Seller {
  id: string;
  sellerNumber: string;
  name: string;
  status: string;  // 「状況（当社）」フィールド
  visitAssignee: string;  // 営業担当者イニシャル
  visitAssigneeInitials: string;  // 営業担当者イニシャル（元の値）
  // ... その他のフィールド
}
```

### StatusCategory

サイドバーのカテゴリ型。営業担当別カテゴリは `visitAssigned:${assignee}` の形式です。

```typescript
type StatusCategory = 
  | 'all' 
  | 'todayCall' 
  | 'todayCallWithInfo' 
  | 'todayCallAssigned' 
  | 'visitDayBefore' 
  | 'visitCompleted' 
  | 'unvaluated' 
  | 'mailingPending' 
  | 'todayCallNotStarted' 
  | 'pinrichEmpty'
  | `visitAssigned:${string}`        // 担当カテゴリー（例: visitAssigned:Y）
  | `todayCallAssigned:${string}`    // 当日TELサブカテゴリー（例: todayCallAssigned:Y）
  | `todayCallWithInfo:${string}`;   // 当日TEL（内容）ラベル別カテゴリー
```

### CategoryCounts

カテゴリ別の件数。`visitAssignedCounts` に営業担当別の件数が格納されます。

```typescript
interface CategoryCounts {
  all: number;
  todayCall: number;
  todayCallWithInfo: number;
  todayCallAssigned: number;
  visitDayBefore: number;
  visitCompleted: number;
  unvaluated: number;
  mailingPending: number;
  todayCallNotStarted: number;
  pinrichEmpty: number;
  visitAssignedCounts?: Record<string, number>;     // 担当者別件数（全売主）
  todayCallAssignedCounts?: Record<string, number>; // 担当者別当日TEL件数
  todayCallWithInfoLabels?: string[];
  todayCallWithInfoLabelCounts?: Record<string, number>;
}
```

## Correctness Properties

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことです。本質的には、システムが何をすべきかについての形式的な記述です。プロパティは、人間が読める仕様と機械が検証可能な正確性保証の橋渡しとなります。*

### Property 1: 他社買取除外フィルタ

*任意の*売主データと担当者イニシャルに対して、statusフィールドに「他社買取」という文字列が含まれる場合、`isVisitAssignedTo(seller, assignee)` はfalseを返すべきである。

**Validates: Requirements 1.1, 1.3, 2.2, 3.1, 3.3**

### Property 2: 他社買取除外カウント

*任意の*売主リストに対して、営業担当別カテゴリのカウント（visitAssignedCounts）を計算する際、statusフィールドに「他社買取」を含む売主はカウントに含まれないべきである。

**Validates: Requirements 1.2, 2.1, 2.3**

### Property 3: 他社買取以外の売主の表示

*任意の*売主データと担当者イニシャルに対して、statusフィールドに「他社買取」を含まず、visitAssigneeが指定の担当者と一致する場合、`isVisitAssignedTo(seller, assignee)` はtrueを返すべきである。

**Validates: Requirements 1.4, 5.4**

### Property 4: 担当者リストからの除外

*任意の*売主リストに対して、`getUniqueAssignees(sellers)` が返す担当者リストには、statusに「他社買取」を含む売主のみが担当している担当者は含まれないべきである。

**Validates: Requirements 3.2**

### Property 5: 全担当者への一貫した適用

*任意の*担当者イニシャルに対して、営業担当別カテゴリ（`visitAssigned:${assignee}`）のフィルタリングは、statusに「他社買取」を含む売主を除外するという同じルールを適用すべきである。

**Validates: Requirements 3.4**


### 除外ロジックの詳細

#### 部分一致による検出

statusフィールドの値に「他社買取」という文字列が含まれるかどうかを判定します。以下のような値が除外対象となります：

- 「他社買取」（完全一致）
- 「他社買取→追客」（前方一致）
- 「追客中→他社買取」（後方一致）
- 「他社買取（確定）」（中間一致）

#### 判定方法

```typescript
// JavaScript/TypeScript
const status = seller.status || '';
const shouldExclude = typeof status === 'string' && status.includes('他社買取');

// SQL (Supabase)
.not('status', 'ilike', '%他社買取%')
```

#### 他のカテゴリへの影響

「他社買取」除外ルールは、営業担当別カテゴリ（`visitAssigned:xxx`）にのみ適用されます。以下のカテゴリには影響しません：

- 「All」カテゴリ：全ての売主を表示（除外なし）
- 「当日TEL分」カテゴリ：営担が空の売主のみが対象のため、影響なし
- 「未査定」カテゴリ：営担が空の売主のみが対象のため、影響なし
- 「訪問日前日」カテゴリ：訪問日の条件のみで判定、statusは関係なし
- その他の固定カテゴリ：それぞれ独自の条件で判定

### 既存の除外ルールとの統合

営業担当別カテゴリでは、既に以下のステータスを含む売主が除外されています：

1. 「一般媒介」を含む
2. 「専任媒介」を含む
3. 「追客不要」を含む

本機能では、これに4つ目の除外ルールとして「他社買取」を追加します。

```typescript
// 既存の除外条件
.not('status', 'ilike', '%一般媒介%')
.not('status', 'ilike', '%専任媒介%')
.not('status', 'ilike', '%追客不要%')

// 新規追加
.not('status', 'ilike', '%他社買取%')
```

## Error Handling

### フロントエンド

#### isVisitAssignedTo()

```typescript
export const isVisitAssignedTo = (seller: Seller | any, assignee: string): boolean => {
  try {
    // 空文字や「外す」は担当なしと同じ扱い
    if (!assignee || assignee.trim() === '' || assignee.trim() === '外す') {
      return false;
    }
    
    // statusフィールドが存在しない場合は空文字として扱う
    const status = seller.status || '';
    
    // 「他社買取」を含む売主を除外
    if (typeof status === 'string' && status.includes('他社買取')) {
      return false;
    }
    
    // visitAssigneeが存在しない場合は空文字として扱う
    const visitAssigneeInitials = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee || '';
    return visitAssigneeInitials.trim() === assignee;
  } catch (error) {
    console.error('isVisitAssignedTo error:', error);
    return false;
  }
};
```

#### getUniqueAssignees()

```typescript
export const getUniqueAssignees = (sellers: (Seller | any)[]): string[] => {
  try {
    // sellersが配列でない場合は空配列を返す
    if (!Array.isArray(sellers)) {
      console.warn('getUniqueAssignees: sellers is not an array');
      return [];
    }
    
    // 「他社買取」を含む売主を除外してから担当者を抽出
    const filteredSellers = sellers.filter(s => {
      const status = s.status || '';
      return !(typeof status === 'string' && status.includes('他社買取'));
    });
    
    const assignees = filteredSellers
      .map(s => s.visitAssigneeInitials || s.visit_assignee || s.visitAssignee || '')
      .filter(a => a && a.trim() !== '' && a.trim() !== '外す');
    return [...new Set(assignees)].sort();
  } catch (error) {
    console.error('getUniqueAssignees error:', error);
    return [];
  }
};
```

### バックエンド

#### getSidebarCountsFallback()

```typescript
try {
  // 既存の除外条件に「他社買取」を追加
  const { data: allAssignedSellers } = await this.table('sellers')
    .select('visit_assignee')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .not('status', 'ilike', '%一般媒介%')
    .not('status', 'ilike', '%専任媒介%')
    .not('status', 'ilike', '%追客不要%')
    .not('status', 'ilike', '%他社買取%');  // 新規追加

  // エラーハンドリング
  if (!allAssignedSellers) {
    console.warn('getSidebarCountsFallback: allAssignedSellers is null');
    return { /* デフォルト値 */ };
  }

  // カウント計算
  const visitAssignedCounts: Record<string, number> = {};
  allAssignedSellers.forEach((s: any) => {
    const a = s.visit_assignee;
    if (a) visitAssignedCounts[a] = (visitAssignedCounts[a] || 0) + 1;
  });

  return { visitAssignedCounts, /* その他のカウント */ };
} catch (error) {
  console.error('getSidebarCountsFallback error:', error);
  // フォールバック値を返す
  return {
    todayCall: 0,
    todayCallWithInfo: 0,
    todayCallAssigned: 0,
    visitDayBefore: 0,
    visitCompleted: 0,
    unvaluated: 0,
    mailingPending: 0,
    todayCallNotStarted: 0,
    pinrichEmpty: 0,
    visitAssignedCounts: {},
    todayCallAssignedCounts: {},
    todayCallWithInfoLabels: [],
    todayCallWithInfoLabelCounts: {},
  };
}
```

#### listSellers()

```typescript
if (dynamicCategory.startsWith('visitAssigned:')) {
  const assignee = dynamicCategory.replace('visitAssigned:', '');
  
  try {
    // 担当者別（営担が指定のイニシャルの全売主、一般媒介・専任媒介・追客不要・他社買取は除外）
    query = query
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す')
      .eq('visit_assignee', assignee)
      .not('status', 'ilike', '%一般媒介%')
      .not('status', 'ilike', '%専任媒介%')
      .not('status', 'ilike', '%追客不要%')
      .not('status', 'ilike', '%他社買取%');  // 新規追加
  } catch (error) {
    console.error('listSellers visitAssigned filter error:', error);
    // エラー時は空の結果を返す
    query = query.in('id', ['__no_match__']);
  }
}
```

### エラーケース

1. **statusフィールドがnullまたはundefined**: 空文字として扱い、除外しない
2. **statusフィールドが文字列でない**: 型チェックで安全に処理
3. **visitAssigneeフィールドが存在しない**: 空文字として扱い、担当なしと判定
4. **データベースクエリエラー**: フォールバック値を返す、またはエラーログを出力

## Testing Strategy

本機能のテストは、ユニットテストとプロパティベーステストの両方で実施します。

### ユニットテスト

#### フロントエンド（sellerStatusFilters.test.ts）

```typescript
describe('isVisitAssignedTo', () => {
  it('「他社買取」を含む売主を除外する', () => {
    const seller = {
      status: '他社買取',
      visitAssigneeInitials: 'I',
    };
    expect(isVisitAssignedTo(seller, 'I')).toBe(false);
  });

  it('「他社買取→追客」を含む売主を除外する', () => {
    const seller = {
      status: '他社買取→追客',
      visitAssigneeInitials: 'K',
    };
    expect(isVisitAssignedTo(seller, 'K')).toBe(false);
  });

  it('「追客中」の売主は除外しない', () => {
    const seller = {
      status: '追客中',
      visitAssigneeInitials: 'M',
    };
    expect(isVisitAssignedTo(seller, 'M')).toBe(true);
  });

  it('statusが空の売主は除外しない', () => {
    const seller = {
      status: '',
      visitAssigneeInitials: 'Y',
    };
    expect(isVisitAssignedTo(seller, 'Y')).toBe(true);
  });
});

describe('getUniqueAssignees', () => {
  it('「他社買取」を含む売主の担当者を除外する', () => {
    const sellers = [
      { status: '追客中', visitAssigneeInitials: 'I' },
      { status: '他社買取', visitAssigneeInitials: 'K' },
      { status: '追客中', visitAssigneeInitials: 'M' },
    ];
    const result = getUniqueAssignees(sellers);
    expect(result).toEqual(['I', 'M']);
  });
});
```

#### バックエンド（SellerService.test.ts）

```typescript
describe('getSidebarCountsFallback', () => {
  it('visitAssignedCountsから「他社買取」を含む売主を除外する', async () => {
    // テストデータをセットアップ
    await setupTestSellers([
      { seller_number: 'AA001', visit_assignee: 'I', status: '追客中' },
      { seller_number: 'AA002', visit_assignee: 'I', status: '他社買取' },
      { seller_number: 'AA003', visit_assignee: 'K', status: '追客中' },
    ]);

    const counts = await sellerService.getSidebarCountsFallback();
    
    expect(counts.visitAssignedCounts['I']).toBe(1);  // AA001のみ
    expect(counts.visitAssignedCounts['K']).toBe(1);  // AA003のみ
  });
});

describe('listSellers', () => {
  it('visitAssigned:I カテゴリで「他社買取」を含む売主を除外する', async () => {
    // テストデータをセットアップ
    await setupTestSellers([
      { seller_number: 'AA001', visit_assignee: 'I', status: '追客中' },
      { seller_number: 'AA002', visit_assignee: 'I', status: '他社買取' },
    ]);

    const result = await sellerService.listSellers({
      statusCategory: 'visitAssigned:I',
      page: 1,
      pageSize: 50,
    });
    
    expect(result.data.length).toBe(1);
    expect(result.data[0].sellerNumber).toBe('AA001');
  });
});
```

### プロパティベーステスト

プロパティベーステストには、JavaScriptの `fast-check` ライブラリを使用します。各テストは最低100回の反復実行を行い、ランダムな入力に対してプロパティが成立することを検証します。

#### テスト設定

```typescript
import * as fc from 'fast-check';

// 最低100回の反復実行
const testConfig = { numRuns: 100 };
```

#### Arbitrary（ランダムデータ生成器）

```typescript
// 売主データのArbitrary
const sellerArbitrary = fc.record({
  id: fc.uuid(),
  sellerNumber: fc.string({ minLength: 5, maxLength: 10 }).map(s => `AA${s}`),
  status: fc.oneof(
    fc.constant('追客中'),
    fc.constant('他社買取'),
    fc.constant('他社買取→追客'),
    fc.constant('追客中→他社買取'),
    fc.constant('専任媒介'),
    fc.constant(''),
  ),
  visitAssigneeInitials: fc.oneof(
    fc.constantFrom('I', 'K', 'M', 'Y', 'U'),
    fc.constant(''),
    fc.constant('外す'),
  ),
});

// 担当者イニシャルのArbitrary
const assigneeArbitrary = fc.constantFrom('I', 'K', 'M', 'Y', 'U');
```



#### プロパティテストの実装例

```typescript
describe('Property: 他社買取除外フィルタ', () => {
  it('任意の売主と担当者に対して、statusに「他社買取」を含む場合はfalseを返す', () => {
    fc.assert(
      fc.property(
        sellerArbitrary,
        assigneeArbitrary,
        (seller, assignee) => {
          // statusに「他社買取」を含む売主を生成
          const sellerWithOtherCompany = {
            ...seller,
            status: '他社買取',
            visitAssigneeInitials: assignee,
          };
          
          // isVisitAssignedTo()がfalseを返すことを検証
          const result = isVisitAssignedTo(sellerWithOtherCompany, assignee);
          return result === false;
        }
      ),
      testConfig
    );
  });
});
```

### テスト実行

```bash
# フロントエンドテスト
cd frontend/frontend
npm test -- sellerStatusFilters.test.ts

# バックエンドテスト
cd backend
npm test -- SellerService.test.ts
```

### テストカバレッジ

- ユニットテスト: 具体的な例とエッジケースをカバー
- プロパティテスト: ランダムな入力に対する普遍的なルールを検証
- 統合テスト: フロントエンドとバックエンドの連携を検証



### エッジケースのテスト

以下のエッジケースは、プロパティテストのジェネレータで自動的にカバーされますが、明示的なユニットテストでも検証します：

1. **statusが空文字列の場合**: 除外されない（Requirements 1.5）
2. **statusが「他社買取→追客」の場合**: 除外される（Requirements 2.4）
3. **statusが「追客中→他社買取」の場合**: 除外される（部分一致）
4. **statusが「他社買取（確定）」の場合**: 除外される（部分一致）

### 他のカテゴリへの影響なしの検証

以下のカテゴリは、「他社買取」除外ルールの影響を受けないことを検証します：

1. **「All」カテゴリ**: 全ての売主を表示（Requirements 4.4）
2. **「当日TEL分」カテゴリ**: 営担が空の売主のみが対象のため、影響なし（Requirements 4.1）
3. **「未査定」カテゴリ**: 営担が空の売主のみが対象のため、影響なし（Requirements 4.2）
4. **「訪問日前日」カテゴリ**: 訪問日の条件のみで判定、statusは関係なし（Requirements 4.3）

これらは具体的な例として、ユニットテストで検証します。



### プロパティテストの詳細実装

#### Property 1: 他社買取除外フィルタ

```typescript
describe('Property 1: 他社買取除外フィルタ', () => {
  it('Feature: seller-sidebar-exclude-other-company-purchase, Property 1: 任意の売主と担当者に対して、statusに「他社買取」を含む場合はfalseを返す', () => {
    fc.assert(
      fc.property(
        sellerArbitrary,
        assigneeArbitrary,
        (seller, assignee) => {
          // statusに「他社買取」を含む売主を生成
          const sellerWithOtherCompany = {
            ...seller,
            status: '他社買取',
            visitAssigneeInitials: assignee,
          };
          
          // isVisitAssignedTo()がfalseを返すことを検証
          const result = isVisitAssignedTo(sellerWithOtherCompany, assignee);
          return result === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Property 2: 他社買取除外カウント

```typescript
describe('Property 2: 他社買取除外カウント', () => {
  it('Feature: seller-sidebar-exclude-other-company-purchase, Property 2: 任意の売主リストに対して、「他社買取」を含む売主はカウントに含まれない', () => {
    fc.assert(
      fc.property(
        fc.array(sellerArbitrary, { minLength: 1, maxLength: 50 }),
        (sellers) => {
          // 「他社買取」を含む売主の数を計算
          const otherCompanyCount = sellers.filter(s => 
            s.status && s.status.includes('他社買取') && s.visitAssigneeInitials
          ).length;
          
          // visitAssignedCountsを計算（フロントエンドロジック）
          const filteredSellers = sellers.filter(s => {
            const status = s.status || '';
            return !(typeof status === 'string' && status.includes('他社買取'));
          });
          
          const assignees = filteredSellers
            .map(s => s.visitAssigneeInitials)
            .filter(a => a && a.trim() !== '' && a.trim() !== '外す');
          
          const totalAssignedCount = assignees.length;
          const totalWithOtherCompany = sellers.filter(s => 
            s.visitAssigneeInitials && s.visitAssigneeInitials.trim() !== '' && s.visitAssigneeInitials.trim() !== '外す'
          ).length;
          
          // 「他社買取」を含む売主がカウントから除外されていることを検証
          return totalAssignedCount === totalWithOtherCompany - otherCompanyCount;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Property 3: 他社買取以外の売主の表示

```typescript
describe('Property 3: 他社買取以外の売主の表示', () => {
  it('Feature: seller-sidebar-exclude-other-company-purchase, Property 3: 任意の売主と担当者に対して、statusに「他社買取」を含まず担当者が一致する場合はtrueを返す', () => {
    fc.assert(
      fc.property(
        sellerArbitrary.filter(s => !s.status.includes('他社買取')),
        assigneeArbitrary,
        (seller, assignee) => {
          // statusに「他社買取」を含まない売主を生成
          const sellerWithoutOtherCompany = {
            ...seller,
            visitAssigneeInitials: assignee,
          };
          
          // isVisitAssignedTo()がtrueを返すことを検証
          const result = isVisitAssignedTo(sellerWithoutOtherCompany, assignee);
          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Property 4: 担当者リストからの除外

```typescript
describe('Property 4: 担当者リストからの除外', () => {
  it('Feature: seller-sidebar-exclude-other-company-purchase, Property 4: 任意の売主リストに対して、「他社買取」のみの担当者は含まれない', () => {
    fc.assert(
      fc.property(
        fc.array(sellerArbitrary, { minLength: 1, maxLength: 50 }),
        (sellers) => {
          // getUniqueAssignees()を実行
          const uniqueAssignees = getUniqueAssignees(sellers);
          
          // 「他社買取」のみを担当している担当者を特定
          const assigneeToSellers = new Map<string, any[]>();
          sellers.forEach(s => {
            const assignee = s.visitAssigneeInitials;
            if (assignee && assignee.trim() !== '' && assignee.trim() !== '外す') {
              if (!assigneeToSellers.has(assignee)) {
                assigneeToSellers.set(assignee, []);
              }
              assigneeToSellers.get(assignee)!.push(s);
            }
          });
          
          // 「他社買取」のみを担当している担当者を検出
          const otherCompanyOnlyAssignees = Array.from(assigneeToSellers.entries())
            .filter(([_, sellerList]) => 
              sellerList.every(s => s.status && s.status.includes('他社買取'))
            )
            .map(([assignee, _]) => assignee);
          
          // 「他社買取」のみの担当者がuniqueAssigneesに含まれないことを検証
          return otherCompanyOnlyAssignees.every(a => !uniqueAssignees.includes(a));
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Property 5: 全担当者への一貫した適用

```typescript
describe('Property 5: 全担当者への一貫した適用', () => {
  it('Feature: seller-sidebar-exclude-other-company-purchase, Property 5: 任意の担当者に対して、同じ除外ルールが適用される', () => {
    fc.assert(
      fc.property(
        fc.array(sellerArbitrary, { minLength: 10, maxLength: 50 }),
        assigneeArbitrary,
        (sellers, assignee) => {
          // 指定の担当者に割り当てられた売主をフィルタリング
          const assignedSellers = sellers.filter(s => 
            isVisitAssignedTo(s, assignee)
          );
          
          // フィルタリング結果に「他社買取」を含む売主が含まれないことを検証
          return assignedSellers.every(s => {
            const status = s.status || '';
            return !(typeof status === 'string' && status.includes('他社買取'));
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 統合テスト

#### フロントエンドとバックエンドの連携テスト

```typescript
describe('Integration: 営業担当別カテゴリの除外', () => {
  it('サイドバーカウントとリスト取得で一貫した除外が行われる', async () => {
    // テストデータをセットアップ
    await setupTestSellers([
      { seller_number: 'AA001', visit_assignee: 'I', status: '追客中' },
      { seller_number: 'AA002', visit_assignee: 'I', status: '他社買取' },
      { seller_number: 'AA003', visit_assignee: 'K', status: '追客中' },
    ]);

    // サイドバーカウントを取得
    const counts = await fetch('/api/sellers/sidebar-counts').then(r => r.json());
    
    // 担当(I)のリストを取得
    const list = await fetch('/api/sellers?statusCategory=visitAssigned:I').then(r => r.json());
    
    // カウントとリストの件数が一致することを検証
    expect(counts.visitAssignedCounts['I']).toBe(1);
    expect(list.data.length).toBe(1);
    expect(list.data[0].sellerNumber).toBe('AA001');
  });
});
```

### テストタグの形式

各プロパティテストには、以下の形式でタグを付けます：

```
Feature: seller-sidebar-exclude-other-company-purchase, Property {number}: {property_text}
```

例：
- `Feature: seller-sidebar-exclude-other-company-purchase, Property 1: 任意の売主と担当者に対して、statusに「他社買取」を含む場合はfalseを返す`
- `Feature: seller-sidebar-exclude-other-company-purchase, Property 2: 任意の売主リストに対して、「他社買取」を含む売主はカウントに含まれない`

### テストライブラリ

- **フロントエンド**: Jest + fast-check
- **バックエンド**: Jest + fast-check
- **統合テスト**: Supertest + Jest

### テスト実行コマンド

```bash
# 全テスト実行
npm test

# プロパティテストのみ実行
npm test -- --testNamePattern="Property"

# 特定のプロパティテスト実行
npm test -- --testNamePattern="Property 1"

# カバレッジレポート生成
npm test -- --coverage
```

## Implementation Notes

### 実装の優先順位

1. **フロントエンド**: `isVisitAssignedTo()` の修正（最優先）
2. **バックエンド**: `getSidebarCountsFallback()` の修正
3. **バックエンド**: `listSellers()` の修正
4. **フロントエンド**: `getUniqueAssignees()` の修正（オプション）

### 後方互換性

本機能は既存の除外ルール（一般媒介、専任媒介、追客不要）に追加する形で実装されるため、既存の動作に影響を与えません。

### パフォーマンスへの影響

- **フロントエンド**: `isVisitAssignedTo()` に1つの条件チェックが追加されるのみ。パフォーマンスへの影響は無視できる程度。
- **バックエンド**: SQLクエリに1つの `NOT ILIKE` 条件が追加されるのみ。インデックスが適切に設定されていれば、パフォーマンスへの影響は最小限。

### デプロイ手順

1. コードをコミット
2. `git push origin main` で自動デプロイ
3. フロントエンド（`sateituikyaku-admin-frontend`）とバックエンド（`sateituikyaku-admin-backend`）が自動的にデプロイされる
4. デプロイ後、サイドバーの営業担当別カテゴリで「他社買取」売主が除外されることを確認

### ロールバック手順

問題が発生した場合、以下の手順でロールバックします：

1. `git revert <commit-hash>` で変更を取り消し
2. `git push origin main` で自動デプロイ
3. 元の動作に戻ることを確認

## Review Checklist

設計レビュー時に確認すべき項目：

- [ ] 「他社買取」除外ルールが営業担当別カテゴリにのみ適用されることを確認
- [ ] 他のカテゴリ（All、当日TEL分、未査定等）に影響がないことを確認
- [ ] 既存の除外ルール（一般媒介、専任媒介、追客不要）との整合性を確認
- [ ] 部分一致（includes）で「他社買取」を検出することを確認
- [ ] フロントエンドとバックエンドの両方で除外ロジックが実装されることを確認
- [ ] プロパティテストが最低100回の反復実行を行うことを確認
- [ ] エラーハンドリングが適切に実装されることを確認

