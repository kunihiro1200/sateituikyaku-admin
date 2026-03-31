# Design Document: 売主サイドバー専任・一般・訪問後他決カテゴリー追加

## Overview

売主リストページのサイドバーに、専任媒介・一般媒介・訪問後他決の3つの新しいステータスカテゴリーを追加します。これにより、営業担当者が専任他決打合せが必要な売主を効率的に把握し、適切なフォローアップを行えるようにします。

### 背景

現在のサイドバーには、当日TEL分、未査定、査定（郵送）などのカテゴリーが存在しますが、専任媒介・一般媒介・訪問後他決の売主を一覧で確認する機能がありません。これらのカテゴリーを追加することで、専任他決打合せが必要な売主を効率的に把握できるようになります。

### 目標

- 専任媒介関連の売主を一覧で確認できる
- 一般媒介関連の売主を一覧で確認できる
- 訪問後に他決となった売主を一覧で確認できる
- 各カテゴリーの件数をリアルタイムで表示する
- カテゴリーをクリックして該当する売主のリストを展開表示できる

---

## Architecture

### システム構成

```
フロントエンド（React + TypeScript）
  ↓
  ├─ SellerStatusSidebar.tsx（UIコンポーネント）
  ├─ sellerStatusFilters.ts（フィルタリングロジック）
  └─ SellersPage.tsx（売主リストページ）
       ↓
       API呼び出し（/api/sellers/sidebar-counts）
       ↓
バックエンド（Node.js + Express + Supabase）
  ↓
  ├─ sellers.ts（ルーティング）
  └─ SellerService.supabase.ts（ビジネスロジック）
       ↓
       getSidebarCounts()メソッド
       ↓
Supabase（PostgreSQL）
  ↓
  seller_sidebar_counts テーブル（キャッシュテーブル）
  sellers テーブル（マスターデータ）
```

### データフロー

1. **初期表示時**:
   - フロントエンドが `/api/sellers/sidebar-counts` を呼び出し
   - バックエンドが `seller_sidebar_counts` テーブルから集計済みデータを取得
   - フロントエンドがサイドバーに件数を表示

2. **カテゴリークリック時**:
   - フロントエンドが `/api/sellers?statusCategory=exclusive` を呼び出し
   - バックエンドが `sellers` テーブルから該当する売主を取得
   - フロントエンドが展開リストに売主を表示

3. **売主データ更新時**:
   - バックエンドが `sellers` テーブルを更新
   - キャッシュ（`seller_sidebar_counts`）を無効化
   - GASが10分ごとに `seller_sidebar_counts` を再計算

---

## Components and Interfaces

### フロントエンド

#### 1. StatusCategory型の拡張

**ファイル**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

```typescript
export type StatusCategory = 
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
  | 'exclusive'              // 新規: 専任カテゴリー
  | 'general'                // 新規: 一般カテゴリー
  | 'visitOtherDecision'     // 新規: 訪問後他決カテゴリー
  | `visitAssigned:${string}`
  | `todayCallAssigned:${string}`
  | `todayCallWithInfo:${string}`;
```

#### 2. CategoryCounts型の拡張

**ファイル**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

```typescript
export interface CategoryCounts {
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
  exclusive: number;              // 新規: 専任カテゴリーの件数
  general: number;                // 新規: 一般カテゴリーの件数
  visitOtherDecision: number;     // 新規: 訪問後他決カテゴリーの件数
  visitAssignedCounts?: Record<string, number>;
  todayCallAssignedCounts?: Record<string, number>;
  todayCallWithInfoLabels?: string[];
  todayCallWithInfoLabelCounts?: Record<string, number>;
}
```

#### 3. フィルタリング関数

**ファイル**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

```typescript
/**
 * 専任カテゴリー判定
 * 
 * 条件:
 * - exclusive_other_decision_meeting <> "完了"
 * - next_call_date <> TODAY()
 * - status IN ("専任媒介", "他決→専任", "リースバック（専任）")
 */
export const isExclusive = (seller: Seller | any): boolean => {
  // 専任他決打合せが「完了」の場合は除外
  const exclusiveOtherDecisionMeeting = seller.exclusiveOtherDecisionMeeting || seller.exclusive_other_decision_meeting || '';
  if (exclusiveOtherDecisionMeeting === '完了') {
    return false;
  }
  
  // 次電日が今日の場合は除外
  const nextCallDate = seller.nextCallDate || seller.next_call_date;
  if (isTodayOrBefore(nextCallDate)) {
    return false;
  }
  
  // 状況（当社）が専任媒介関連かチェック
  const status = seller.status || '';
  return status === '専任媒介' || status === '他決→専任' || status === 'リースバック（専任）';
};

/**
 * 一般カテゴリー判定
 * 
 * 条件:
 * - exclusive_other_decision_meeting <> "完了"
 * - next_call_date <> TODAY()
 * - status = "一般媒介"
 * - contract_year_month >= "2025/6/23"
 */
export const isGeneral = (seller: Seller | any): boolean => {
  // 専任他決打合せが「完了」の場合は除外
  const exclusiveOtherDecisionMeeting = seller.exclusiveOtherDecisionMeeting || seller.exclusive_other_decision_meeting || '';
  if (exclusiveOtherDecisionMeeting === '完了') {
    return false;
  }
  
  // 次電日が今日の場合は除外
  const nextCallDate = seller.nextCallDate || seller.next_call_date;
  if (isTodayOrBefore(nextCallDate)) {
    return false;
  }
  
  // 状況（当社）が一般媒介かチェック
  const status = seller.status || '';
  if (status !== '一般媒介') {
    return false;
  }
  
  // 契約年月が2025/6/23以降かチェック
  const contractYearMonth = seller.contractYearMonth || seller.contract_year_month;
  if (!contractYearMonth) {
    return false;
  }
  
  const cutoffDate = '2025-06-23';
  const normalizedContractDate = normalizeDateString(contractYearMonth);
  if (!normalizedContractDate) {
    return false;
  }
  
  return normalizedContractDate >= cutoffDate;
};

/**
 * 訪問後他決カテゴリー判定
 * 
 * 条件:
 * - exclusive_other_decision_meeting <> "完了"
 * - next_call_date <> TODAY()
 * - status IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取")
 * - visit_assignee <> ""
 */
export const isVisitOtherDecision = (seller: Seller | any): boolean => {
  // 専任他決打合せが「完了」の場合は除外
  const exclusiveOtherDecisionMeeting = seller.exclusiveOtherDecisionMeeting || seller.exclusive_other_decision_meeting || '';
  if (exclusiveOtherDecisionMeeting === '完了') {
    return false;
  }
  
  // 次電日が今日の場合は除外
  const nextCallDate = seller.nextCallDate || seller.next_call_date;
  if (isTodayOrBefore(nextCallDate)) {
    return false;
  }
  
  // 状況（当社）が他決関連かチェック
  const status = seller.status || '';
  const isOtherDecisionStatus = 
    status === '他決→追客' || 
    status === '他決→追客不要' || 
    status === '一般→他決' || 
    status === '他社買取';
  if (!isOtherDecisionStatus) {
    return false;
  }
  
  // 営担に入力があるかチェック
  const visitAssignee = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee || '';
  if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') {
    return false;
  }
  
  return true;
};
```

#### 4. SellerStatusSidebar.tsx の更新

**ファイル**: `frontend/frontend/src/components/SellerStatusSidebar.tsx`

```typescript
// カテゴリの表示名を取得
const getCategoryLabel = (category: StatusCategory): string => {
  switch (category) {
    // ... 既存のカテゴリー
    case 'exclusive':
      return '専任';
    case 'general':
      return '一般';
    case 'visitOtherDecision':
      return '訪問後他決';
    // ...
  }
};

// カテゴリの色を取得
const getCategoryColor = (category: StatusCategory): string => {
  switch (category) {
    // ... 既存のカテゴリー
    case 'exclusive':
      return '#2e7d32'; // 緑色
    case 'general':
      return '#1565c0'; // 青色
    case 'visitOtherDecision':
      return '#ff9800'; // オレンジ色
    // ...
  }
};

// 全カテゴリ表示モード
const renderAllCategories = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    {/* ... 既存のカテゴリー */}
    
    {/* 担当者別カテゴリーの後に追加 */}
    <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'grey.200' }}>
      {renderCategoryButton('exclusive', '専任', '#2e7d32')}
      {renderCategoryButton('general', '一般', '#1565c0')}
      {renderCategoryButton('visitOtherDecision', '訪問後他決', '#ff9800')}
    </Box>
  </Box>
);
```

### バックエンド

#### 1. getSidebarCounts()メソッドの拡張

**ファイル**: `backend/src/services/SellerService.supabase.ts`

```typescript
async getSidebarCounts(): Promise<{
  todayCall: number;
  todayCallWithInfo: number;
  todayCallAssigned: number;
  visitDayBefore: number;
  visitCompleted: number;
  unvaluated: number;
  mailingPending: number;
  todayCallNotStarted: number;
  pinrichEmpty: number;
  exclusive: number;              // 新規: 専任カテゴリーの件数
  general: number;                // 新規: 一般カテゴリーの件数
  visitOtherDecision: number;     // 新規: 訪問後他決カテゴリーの件数
  visitAssignedCounts: Record<string, number>;
  todayCallAssignedCounts: Record<string, number>;
  todayCallWithInfoLabels: string[];
  todayCallWithInfoLabelCounts: Record<string, number>;
}> {
  try {
    // seller_sidebar_counts テーブルから全行取得（GASが10分ごとに更新）
    const { data, error } = await this.supabase
      .from('seller_sidebar_counts')
      .select('category, count, label, assignee');

    if (error || !data || data.length === 0) {
      console.log('⚠️ seller_sidebar_counts empty or error, falling back to DB query');
      return this.getSidebarCountsFallback();
    }

    // カテゴリ別に集計
    const result = {
      // ... 既存のフィールド
      exclusive: 0,              // 新規
      general: 0,                // 新規
      visitOtherDecision: 0,     // 新規
      // ...
    };

    for (const row of data) {
      const count = row.count || 0;
      switch (row.category) {
        // ... 既存のケース
        case 'exclusive':         result.exclusive = count; break;
        case 'general':           result.general = count; break;
        case 'visitOtherDecision': result.visitOtherDecision = count; break;
      }
    }

    console.log('✅ seller_sidebar_counts loaded from cache table');
    return result;
  } catch (e) {
    console.error('❌ getSidebarCounts error, falling back:', e);
    return this.getSidebarCountsFallback();
  }
}
```

#### 2. getSidebarCountsFallback()メソッドの拡張

**ファイル**: `backend/src/services/SellerService.supabase.ts`

```typescript
private async getSidebarCountsFallback(): Promise<{
  // ... 既存の型定義
  exclusive: number;
  general: number;
  visitOtherDecision: number;
}> {
  // ... 既存のキャッシュチェック

  // 専任カテゴリー
  const { count: exclusiveCount } = await this.table('sellers')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .neq('exclusive_other_decision_meeting', '完了')
    .gt('next_call_date', todayJST)
    .in('status', ['専任媒介', '他決→専任', 'リースバック（専任）']);

  // 一般カテゴリー
  const { count: generalCount } = await this.table('sellers')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .neq('exclusive_other_decision_meeting', '完了')
    .gt('next_call_date', todayJST)
    .eq('status', '一般媒介')
    .gte('contract_year_month', '2025-06-23');

  // 訪問後他決カテゴリー
  const { count: visitOtherDecisionCount } = await this.table('sellers')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .neq('exclusive_other_decision_meeting', '完了')
    .gt('next_call_date', todayJST)
    .in('status', ['他決→追客', '他決→追客不要', '一般→他決', '他社買取'])
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す');

  const counts = {
    // ... 既存のカウント
    exclusive: exclusiveCount || 0,
    general: generalCount || 0,
    visitOtherDecision: visitOtherDecisionCount || 0,
    // ...
  };

  // キャッシュに保存（60秒TTL）
  await CacheHelper.set(sidebarCacheKey, counts, CACHE_TTL.SIDEBAR_COUNTS);

  return counts;
}
```

#### 3. listSellers()メソッドの拡張

**ファイル**: `backend/src/services/SellerService.supabase.ts`

```typescript
async listSellers(params: ListSellersParams): Promise<PaginatedResult<Seller>> {
  // ... 既存のクエリ構築

  // statusCategoryフィルター
  if (params.statusCategory) {
    switch (params.statusCategory) {
      // ... 既存のケース
      case 'exclusive':
        query = query
          .neq('exclusive_other_decision_meeting', '完了')
          .gt('next_call_date', todayJST)
          .in('status', ['専任媒介', '他決→専任', 'リースバック（専任）']);
        break;
      case 'general':
        query = query
          .neq('exclusive_other_decision_meeting', '完了')
          .gt('next_call_date', todayJST)
          .eq('status', '一般媒介')
          .gte('contract_year_month', '2025-06-23');
        break;
      case 'visitOtherDecision':
        query = query
          .neq('exclusive_other_decision_meeting', '完了')
          .gt('next_call_date', todayJST)
          .in('status', ['他決→追客', '他決→追客不要', '一般→他決', '他社買取'])
          .not('visit_assignee', 'is', null)
          .neq('visit_assignee', '')
          .neq('visit_assignee', '外す');
        break;
    }
  }

  // ... 既存のクエリ実行
}
```

---

## Data Models

### Seller型の拡張

**ファイル**: `backend/src/types/index.ts`

```typescript
export interface Seller {
  // ... 既存のフィールド
  exclusiveOtherDecisionMeeting?: string;  // 専任他決打合せ（"完了" または空）
  contractYearMonth?: string;              // 契約年月 他決は分かった時点
  // ...
}
```

### seller_sidebar_countsテーブル

**テーブル名**: `seller_sidebar_counts`

**カラム**:
- `category` (TEXT): カテゴリー名（'exclusive', 'general', 'visitOtherDecision'など）
- `count` (INTEGER): 件数
- `label` (TEXT, nullable): ラベル（todayCallWithInfoで使用）
- `assignee` (TEXT, nullable): 担当者イニシャル（visitAssigned, todayCallAssignedで使用）

**新規レコード**:
```sql
INSERT INTO seller_sidebar_counts (category, count) VALUES
  ('exclusive', 0),
  ('general', 0),
  ('visitOtherDecision', 0);
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

preworkで特定されたプロパティを確認し、冗長性を排除します：

- Property 1.3, 2.3, 3.3（カウント表示）は同じロジックをテストしているため、1つの包括的なプロパティに統合できます
- Property 6.1, 6.2, 6.3は1.3, 2.3, 3.3と完全に重複しているため削除します
- Property 8.2は1.3, 2.3, 3.3と重複しているため削除します
- Property 5.1, 5.2, 5.3（フィルタリング）は同じロジックをテストしているため、1つの包括的なプロパティに統合できます
- Property 5.4は5.1, 5.2, 5.3を包含しているため、5.4のみを残します

### Property 1: 専任カテゴリー分類の正確性

*For any* 売主データに対して、以下の条件を全て満たす場合に限り、専任カテゴリーに分類されるべきである：
- `exclusive_other_decision_meeting` <> "完了"
- `next_call_date` <> TODAY()
- `status` IN ("専任媒介", "他決→専任", "リースバック（専任）")

**Validates: Requirements 1.2**

### Property 2: 一般カテゴリー分類の正確性

*For any* 売主データに対して、以下の条件を全て満たす場合に限り、一般カテゴリーに分類されるべきである：
- `exclusive_other_decision_meeting` <> "完了"
- `next_call_date` <> TODAY()
- `status` = "一般媒介"
- `contract_year_month` >= "2025/6/23"

**Validates: Requirements 2.2**

### Property 3: 訪問後他決カテゴリー分類の正確性

*For any* 売主データに対して、以下の条件を全て満たす場合に限り、訪問後他決カテゴリーに分類されるべきである：
- `exclusive_other_decision_meeting` <> "完了"
- `next_call_date` <> TODAY()
- `status` IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取")
- `visit_assignee` <> ""

**Validates: Requirements 3.2**

### Property 4: カテゴリー件数の正確性

*For any* 売主リストに対して、各カテゴリーの表示件数は、そのカテゴリーの条件を満たす売主の実際の件数と一致するべきである。

**Validates: Requirements 1.3, 2.3, 3.3**

### Property 5: フィルタリングの正確性

*For any* カテゴリーと売主リストに対して、そのカテゴリーでフィルタリングした結果は、カテゴリーの条件を満たす売主のみを含み、条件を満たさない売主を含まないべきである。

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 6: カウント更新の一貫性

*For any* 売主データの更新に対して、更新後のカテゴリー件数は、更新後の売主データに基づいて再計算されるべきである。

**Validates: Requirements 6.4**

---

## Error Handling

### フロントエンド

#### 1. APIエラーハンドリング

**シナリオ**: `/api/sellers/sidebar-counts` の呼び出しが失敗した場合

**対応**:
```typescript
try {
  const response = await fetch('/api/sellers/sidebar-counts');
  if (!response.ok) {
    throw new Error('Failed to fetch sidebar counts');
  }
  const counts = await response.json();
  setCategoryCounts(counts);
} catch (error) {
  console.error('Error fetching sidebar counts:', error);
  // フォールバック: 既存のカウントを維持、またはエラーメッセージを表示
  setError('カテゴリー件数の取得に失敗しました');
}
```

#### 2. データ不整合のハンドリング

**シナリオ**: カテゴリー件数が0件なのに展開リストに売主が表示される

**対応**:
- カテゴリー件数が0件の場合は、カテゴリーボタンを非表示にする
- 展開リスト取得時に再度件数を確認し、0件の場合は「該当する売主がいません」と表示

### バックエンド

#### 1. データベースクエリエラー

**シナリオ**: `getSidebarCounts()` のクエリが失敗した場合

**対応**:
```typescript
try {
  const { data, error } = await this.supabase
    .from('seller_sidebar_counts')
    .select('category, count, label, assignee');
  
  if (error) {
    console.error('Error fetching sidebar counts:', error);
    return this.getSidebarCountsFallback();
  }
  
  return result;
} catch (e) {
  console.error('❌ getSidebarCounts error, falling back:', e);
  return this.getSidebarCountsFallback();
}
```

#### 2. キャッシュテーブルが空の場合

**シナリオ**: `seller_sidebar_counts` テーブルにデータが存在しない

**対応**:
- `getSidebarCountsFallback()` メソッドにフォールバックし、DBから直接集計
- GASの定期同期（10分ごと）により、次回の同期でキャッシュテーブルが更新される

#### 3. 日付比較エラー

**シナリオ**: `next_call_date` が不正な形式の場合

**対応**:
```typescript
const normalizeDateString = (dateStr: string | Date | undefined | null): string | null => {
  if (!dateStr) return null;
  
  try {
    // 日付正規化ロジック
    // ...
  } catch {
    return null; // エラー時はnullを返す
  }
};
```

---

## Testing Strategy

### 単体テスト（Unit Tests）

#### フロントエンド

**ファイル**: `frontend/frontend/src/utils/__tests__/sellerStatusFilters.test.ts`

**テストケース**:

1. **isExclusive()のテスト**:
   - 専任媒介の売主が正しく判定される
   - 専任他決打合せが「完了」の売主が除外される
   - 次電日が今日の売主が除外される
   - 状況が専任媒介関連でない売主が除外される

2. **isGeneral()のテスト**:
   - 一般媒介の売主が正しく判定される
   - 契約年月が2025/6/23以降の売主が含まれる
   - 契約年月が2025/6/23より前の売主が除外される
   - 専任他決打合せが「完了」の売主が除外される

3. **isVisitOtherDecision()のテスト**:
   - 訪問後他決の売主が正しく判定される
   - 営担が空の売主が除外される
   - 営担が「外す」の売主が除外される
   - 状況が他決関連でない売主が除外される

4. **filterSellersByCategory()のテスト**:
   - 専任カテゴリーでフィルタリングした結果が正しい
   - 一般カテゴリーでフィルタリングした結果が正しい
   - 訪問後他決カテゴリーでフィルタリングした結果が正しい

#### バックエンド

**ファイル**: `backend/src/services/__tests__/SellerService.sidebar-counts.test.ts`

**テストケース**:

1. **getSidebarCounts()のテスト**:
   - `seller_sidebar_counts` テーブルから正しくカウントを取得できる
   - 専任・一般・訪問後他決のカウントが含まれる
   - テーブルが空の場合にフォールバックする

2. **getSidebarCountsFallback()のテスト**:
   - DBから直接集計した結果が正しい
   - 専任カテゴリーの条件を満たす売主のみがカウントされる
   - 一般カテゴリーの条件を満たす売主のみがカウントされる
   - 訪問後他決カテゴリーの条件を満たす売主のみがカウントされる

3. **listSellers()のstatusCategory拡張テスト**:
   - `statusCategory=exclusive` でフィルタリングした結果が正しい
   - `statusCategory=general` でフィルタリングした結果が正しい
   - `statusCategory=visitOtherDecision` でフィルタリングした結果が正しい

### プロパティベーステスト（Property-Based Tests）

**ファイル**: `frontend/frontend/src/utils/__tests__/sellerStatusFilters.property.test.ts`

**テストケース**:

1. **Property 1: 専任カテゴリー分類の正確性**:
   ```typescript
   test('Property 1: Exclusive category classification accuracy', () => {
     fc.assert(
       fc.property(
         fc.record({
           exclusiveOtherDecisionMeeting: fc.oneof(fc.constant(''), fc.constant('完了')),
           nextCallDate: fc.date(),
           status: fc.oneof(
             fc.constant('専任媒介'),
             fc.constant('他決→専任'),
             fc.constant('リースバック（専任）'),
             fc.constant('追客中')
           ),
         }),
         (seller) => {
           const result = isExclusive(seller);
           const expected = 
             seller.exclusiveOtherDecisionMeeting !== '完了' &&
             !isTodayOrBefore(seller.nextCallDate) &&
             ['専任媒介', '他決→専任', 'リースバック（専任）'].includes(seller.status);
           expect(result).toBe(expected);
         }
       ),
       { numRuns: 100 }
     );
   });
   ```
   **Feature: seller-sidebar-exclusive-general-visit-categories, Property 1: 専任カテゴリー分類の正確性**

2. **Property 4: カテゴリー件数の正確性**:
   ```typescript
   test('Property 4: Category count accuracy', () => {
     fc.assert(
       fc.property(
         fc.array(fc.record({
           exclusiveOtherDecisionMeeting: fc.oneof(fc.constant(''), fc.constant('完了')),
           nextCallDate: fc.date(),
           status: fc.string(),
           contractYearMonth: fc.date(),
           visitAssignee: fc.string(),
         })),
         (sellers) => {
           const counts = getCategoryCounts(sellers);
           const expectedExclusive = sellers.filter(isExclusive).length;
           const expectedGeneral = sellers.filter(isGeneral).length;
           const expectedVisitOtherDecision = sellers.filter(isVisitOtherDecision).length;
           
           expect(counts.exclusive).toBe(expectedExclusive);
           expect(counts.general).toBe(expectedGeneral);
           expect(counts.visitOtherDecision).toBe(expectedVisitOtherDecision);
         }
       ),
       { numRuns: 100 }
     );
   });
   ```
   **Feature: seller-sidebar-exclusive-general-visit-categories, Property 4: カテゴリー件数の正確性**

3. **Property 5: フィルタリングの正確性**:
   ```typescript
   test('Property 5: Filtering accuracy', () => {
     fc.assert(
       fc.property(
         fc.array(fc.record({
           exclusiveOtherDecisionMeeting: fc.oneof(fc.constant(''), fc.constant('完了')),
           nextCallDate: fc.date(),
           status: fc.string(),
           contractYearMonth: fc.date(),
           visitAssignee: fc.string(),
         })),
         fc.oneof(
           fc.constant('exclusive' as StatusCategory),
           fc.constant('general' as StatusCategory),
           fc.constant('visitOtherDecision' as StatusCategory)
         ),
         (sellers, category) => {
           const filtered = filterSellersByCategory(sellers, category);
           
           // 全ての結果がカテゴリー条件を満たす
           filtered.forEach(seller => {
             switch (category) {
               case 'exclusive':
                 expect(isExclusive(seller)).toBe(true);
                 break;
               case 'general':
                 expect(isGeneral(seller)).toBe(true);
                 break;
               case 'visitOtherDecision':
                 expect(isVisitOtherDecision(seller)).toBe(true);
                 break;
             }
           });
           
           // 条件を満たす売主が全て含まれる
           sellers.forEach(seller => {
             const shouldBeIncluded = 
               (category === 'exclusive' && isExclusive(seller)) ||
               (category === 'general' && isGeneral(seller)) ||
               (category === 'visitOtherDecision' && isVisitOtherDecision(seller));
             
             if (shouldBeIncluded) {
               expect(filtered).toContain(seller);
             }
           });
         }
       ),
       { numRuns: 100 }
     );
   });
   ```
   **Feature: seller-sidebar-exclusive-general-visit-categories, Property 5: フィルタリングの正確性**

### 統合テスト（Integration Tests）

**ファイル**: `frontend/frontend/src/components/__tests__/SellerStatusSidebar.integration.test.tsx`

**テストケース**:

1. **サイドバー表示テスト**:
   - 専任・一般・訪問後他決カテゴリーが表示される
   - 各カテゴリーの件数が正しく表示される
   - カテゴリーが正しい色で表示される

2. **カテゴリークリックテスト**:
   - 専任カテゴリーをクリックすると該当する売主のリストが展開される
   - 一般カテゴリーをクリックすると該当する売主のリストが展開される
   - 訪問後他決カテゴリーをクリックすると該当する売主のリストが展開される

3. **フィルタリング統合テスト**:
   - カテゴリーをクリックすると売主リストがフィルタリングされる
   - フィルタリング後の売主リストが正しい

### エッジケーステスト

1. **0件の場合**:
   - カテゴリーに該当する売主が0件の場合、カテゴリーが表示されない

2. **日付境界値テスト**:
   - 契約年月が2025/6/23ちょうどの売主が一般カテゴリーに含まれる
   - 契約年月が2025/6/22の売主が一般カテゴリーに含まれない

3. **空文字列とnullの扱い**:
   - `exclusive_other_decision_meeting` が空文字列の場合とnullの場合で同じ動作をする
   - `visit_assignee` が空文字列の場合とnullの場合で同じ動作をする

---

## Database Query Optimization

### インデックス戦略

**テーブル**: `sellers`

**推奨インデックス**:

```sql
-- 専任カテゴリー用インデックス
CREATE INDEX idx_sellers_exclusive_category 
ON sellers (exclusive_other_decision_meeting, next_call_date, status) 
WHERE deleted_at IS NULL;

-- 一般カテゴリー用インデックス
CREATE INDEX idx_sellers_general_category 
ON sellers (exclusive_other_decision_meeting, next_call_date, status, contract_year_month) 
WHERE deleted_at IS NULL;

-- 訪問後他決カテゴリー用インデックス
CREATE INDEX idx_sellers_visit_other_decision_category 
ON sellers (exclusive_other_decision_meeting, next_call_date, status, visit_assignee) 
WHERE deleted_at IS NULL;
```

### クエリパフォーマンス

**目標**:
- `getSidebarCounts()`: 50ms以内（キャッシュテーブルから取得）
- `getSidebarCountsFallback()`: 500ms以内（DBから直接集計）
- `listSellers()`: 200ms以内（ページネーション付き）

**最適化手法**:
1. **キャッシュテーブルの活用**: `seller_sidebar_counts` テーブルから集計済みデータを取得
2. **インデックスの活用**: 上記の推奨インデックスを作成
3. **並列クエリ**: 複数のカテゴリーのカウントを並列で取得
4. **ページネーション**: `listSellers()` で大量のデータを一度に取得しない

---

## Deployment and Rollout

### デプロイ手順

1. **データベースマイグレーション**:
   ```sql
   -- seller_sidebar_counts テーブルに新規レコードを追加
   INSERT INTO seller_sidebar_counts (category, count) VALUES
     ('exclusive', 0),
     ('general', 0),
     ('visitOtherDecision', 0);
   ```

2. **バックエンドデプロイ**:
   - `SellerService.supabase.ts` の更新をデプロイ
   - `sellers.ts` ルーティングの更新をデプロイ

3. **フロントエンドデプロイ**:
   - `sellerStatusFilters.ts` の更新をデプロイ
   - `SellerStatusSidebar.tsx` の更新をデプロイ

4. **GAS更新**:
   - `syncSellerList` 関数を更新して、新しいカテゴリーのカウントを計算
   - 10分ごとの定期同期で `seller_sidebar_counts` テーブルを更新

### ロールバック計画

**問題が発生した場合**:

1. **フロントエンドのロールバック**:
   - 前のバージョンにロールバック
   - 新しいカテゴリーが表示されなくなる

2. **バックエンドのロールバック**:
   - 前のバージョンにロールバック
   - 新しいカテゴリーのカウントが返されなくなる

3. **データベースのロールバック**:
   ```sql
   -- seller_sidebar_counts テーブルから新規レコードを削除
   DELETE FROM seller_sidebar_counts 
   WHERE category IN ('exclusive', 'general', 'visitOtherDecision');
   ```

---

## Monitoring and Metrics

### 監視項目

1. **APIレスポンスタイム**:
   - `/api/sellers/sidebar-counts`: 平均50ms以内
   - `/api/sellers?statusCategory=exclusive`: 平均200ms以内

2. **エラー率**:
   - `getSidebarCounts()` のエラー率: 1%以下
   - `listSellers()` のエラー率: 1%以下

3. **キャッシュヒット率**:
   - `seller_sidebar_counts` テーブルからの取得成功率: 95%以上

### アラート設定

1. **レスポンスタイム超過**:
   - `/api/sellers/sidebar-counts` が500ms以上の場合にアラート

2. **エラー率上昇**:
   - エラー率が5%を超えた場合にアラート

3. **キャッシュテーブル空**:
   - `seller_sidebar_counts` テーブルが空の場合にアラート

---

## まとめ

この設計により、売主サイドバーに専任・一般・訪問後他決の3つの新しいカテゴリーを追加し、営業担当者が専任他決打合せが必要な売主を効率的に把握できるようになります。

**主要な設計決定**:
- 既存のサイドバーアーキテクチャを活用
- `seller_sidebar_counts` キャッシュテーブルを使用してパフォーマンスを最適化
- GASの10分ごとの定期同期でキャッシュを更新
- プロパティベーステストで包括的なテストカバレッジを確保

**次のステップ**:
- タスクリストの作成
- 実装の開始
- テストの実行
- デプロイ

