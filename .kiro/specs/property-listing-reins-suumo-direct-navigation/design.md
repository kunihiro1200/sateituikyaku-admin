# Design Document

## Overview

本機能は、物件リストページのサイドバーで「レインズ登録＋SUUMO登録」カテゴリが選択されている状態で物件をクリックした際、通常の物件詳細ページではなく、直接「レインズ登録・サイト入力」ページに遷移する機能です。これにより、レインズ登録作業者は余計なクリックを省略でき、作業効率が向上します。

既存の「未報告」カテゴリの直接遷移機能と同様のパターンを採用し、一貫性のあるユーザー体験を提供します。

## Architecture

### システム構成

```
PropertyListingsPage (物件リストページ)
  ↓
  handleRowClick() - 遷移先を判定
  ↓
  ├─ sidebarStatus === 'レインズ登録＋SUUMO登録' → /property-listings/:propertyNumber/reins-registration
  ├─ sidebarStatus === '未報告' → /property-listings/:propertyNumber/report
  └─ その他 → /property-listings/:propertyNumber (物件詳細ページ)
```

### 遷移ロジックの優先順位

1. **「未報告」カテゴリ**: 報告ページへ直接遷移（既存機能、維持）
2. **「レインズ登録＋SUUMO登録」カテゴリ**: レインズ登録ページへ直接遷移（新機能）
3. **その他のカテゴリまたはカテゴリ未選択**: 物件詳細ページへ遷移（デフォルト）

### 状態管理

物件リストページの状態（ページ番号、検索クエリ、選択中のカテゴリ）は、遷移前に`sessionStorage`に保存されます。これにより、レインズ登録ページから戻る際に、元の状態を復元できます。

## Components and Interfaces

### 1. PropertyListingsPage.tsx

**役割**: 物件リストページのメインコンポーネント

**変更箇所**: `handleRowClick()` メソッド

**変更内容**:
- 「レインズ登録＋SUUMO登録」カテゴリ選択時の遷移先を追加
- 既存の「未報告」カテゴリの遷移ロジックを維持

**変更前**:
```typescript
const handleRowClick = (propertyNumber: string) => {
  console.log('[handleRowClick] called with:', propertyNumber);

  // 「未報告」カテゴリー選択中は報告ページへ直接遷移
  if (sidebarStatus && sidebarStatus.startsWith('未報告')) {
    navigate(`/property-listings/${propertyNumber}/report`);
    return;
  }

  const currentState = {
    page,
    rowsPerPage,
    searchQuery,
    sidebarStatus,
    lastFilter,
  };
  sessionStorage.setItem('propertyListState', JSON.stringify(currentState));
  console.log('[handleRowClick] navigating to:', `/property-listings/${propertyNumber}`);
  navigate(`/property-listings/${propertyNumber}`);
};
```

**変更後**:
```typescript
const handleRowClick = (propertyNumber: string) => {
  console.log('[handleRowClick] called with:', propertyNumber);

  // 状態を保存（全ての遷移で共通）
  const currentState = {
    page,
    rowsPerPage,
    searchQuery,
    sidebarStatus,
    lastFilter,
  };
  sessionStorage.setItem('propertyListState', JSON.stringify(currentState));

  // 「未報告」カテゴリー選択中は報告ページへ直接遷移
  if (sidebarStatus && sidebarStatus.startsWith('未報告')) {
    console.log('[handleRowClick] 報告ページへ直接遷移');
    navigate(`/property-listings/${propertyNumber}/report`);
    return;
  }

  // 「レインズ登録＋SUUMO登録」カテゴリー選択中はレインズ登録ページへ直接遷移
  if (sidebarStatus === 'レインズ登録＋SUUMO登録') {
    console.log('[handleRowClick] レインズ登録ページへ直接遷移');
    navigate(`/property-listings/${propertyNumber}/reins-registration`);
    return;
  }

  // その他は物件詳細ページへ遷移
  console.log('[handleRowClick] navigating to:', `/property-listings/${propertyNumber}`);
  navigate(`/property-listings/${propertyNumber}`);
};
```

**変更のポイント**:
1. `sessionStorage`への状態保存を、全ての遷移パターンで共通化（最初に実行）
2. 「レインズ登録＋SUUMO登録」カテゴリの判定を追加
3. ログ出力を追加（デバッグ用）

### 2. PropertySidebarStatus.tsx

**役割**: サイドバーのステータスカテゴリを表示するコンポーネント

**変更**: なし（既に「レインズ登録＋SUUMO登録」カテゴリが実装済み）

### 3. React Router

**役割**: ルーティング管理

**変更**: なし（`/property-listings/:propertyNumber/reins-registration`ルートは既に存在）

## Data Models

### PropertyListing

```typescript
interface PropertyListing {
  id: string;
  property_number?: string;
  sidebar_status?: string;  // 'レインズ登録＋SUUMO登録' などのステータス
  sales_assignee?: string;
  property_type?: string;
  address?: string;
  display_address?: string;
  seller_name?: string;
  buyer_name?: string;
  contract_date?: string;
  settlement_date?: string;
  price?: number;
  storage_location?: string;
  atbb_status?: string;
  [key: string]: any;
}
```

### PropertyListState (sessionStorage)

```typescript
interface PropertyListState {
  page: number;              // 現在のページ番号
  rowsPerPage: number;       // 1ページあたりの表示件数
  searchQuery: string;       // 検索クエリ
  sidebarStatus: string | null;  // 選択中のサイドバーステータス
  lastFilter: 'sidebar' | 'search' | null;  // 最後に使用したフィルター
}
```


## Correctness Properties

*プロパティとは、システムの全ての有効な実行において真であるべき特性や動作のことです。本質的には、システムが何をすべきかについての形式的な記述です。プロパティは、人間が読める仕様と機械が検証可能な正確性保証の橋渡しとなります。*

### Property 1: カテゴリ別遷移先の正確性

*For any* 物件番号と選択中のサイドバーステータスの組み合わせにおいて、物件をクリックした際の遷移先URLは以下のルールに従う必要がある：
- サイドバーステータスが「未報告」で始まる場合 → `/property-listings/:propertyNumber/report`
- サイドバーステータスが「レインズ登録＋SUUMO登録」の場合 → `/property-listings/:propertyNumber/reins-registration`
- その他の場合（nullまたは'all'を含む） → `/property-listings/:propertyNumber`

**Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 3.1**

### Property 2: 状態保持のラウンドトリップ

*For any* 物件リストページの状態（ページ番号、検索クエリ、選択中のカテゴリ）において、物件をクリックして遷移する際にsessionStorageに保存され、戻るボタンで戻った際に同じ状態が復元される必要がある。

**Validates: Requirements 1.4, 1.5, 3.2**

## Error Handling

### 1. 物件番号が存在しない場合

**シナリオ**: `handleRowClick`に無効な物件番号が渡された場合

**対応**: 
- 現在の実装では、物件番号の存在チェックは行わない（React Routerが404ページを表示）
- 遷移前のログ出力により、デバッグが容易

### 2. sessionStorageが利用できない場合

**シナリオ**: ブラウザがsessionStorageをサポートしていない、またはプライベートモードで無効化されている場合

**対応**:
- `sessionStorage.setItem()`がエラーをスローする可能性がある
- try-catchで囲む必要はない（sessionStorageが利用できない環境は想定外）
- 状態が保存されない場合、デフォルト状態（ページ1、検索クエリなし）で物件リストページが表示される

### 3. 遷移先ページが存在しない場合

**シナリオ**: `/property-listings/:propertyNumber/reins-registration`ルートが定義されていない場合

**対応**:
- React Routerが404ページを表示
- 本機能の実装前に、ルートの存在を確認する必要がある

## Testing Strategy

### Unit Testing

**テストフレームワーク**: Jest + React Testing Library

**テスト対象**: `PropertyListingsPage.tsx`の`handleRowClick`メソッド

**テストケース**:

1. **「レインズ登録＋SUUMO登録」カテゴリでの遷移**
   - サイドバーステータスを「レインズ登録＋SUUMO登録」に設定
   - 物件をクリック
   - 遷移先が`/property-listings/:propertyNumber/reins-registration`であることを確認

2. **「未報告」カテゴリでの遷移（回帰テスト）**
   - サイドバーステータスを「未報告」に設定
   - 物件をクリック
   - 遷移先が`/property-listings/:propertyNumber/report`であることを確認

3. **その他のカテゴリでの遷移**
   - サイドバーステータスを「本日公開予定」に設定
   - 物件をクリック
   - 遷移先が`/property-listings/:propertyNumber`であることを確認

4. **カテゴリ未選択時の遷移**
   - サイドバーステータスをnullに設定
   - 物件をクリック
   - 遷移先が`/property-listings/:propertyNumber`であることを確認

5. **状態保存の確認**
   - ページ番号、検索クエリ、カテゴリを設定
   - 物件をクリック
   - sessionStorageに正しく保存されていることを確認

6. **ログ出力の確認**
   - 各カテゴリで物件をクリック
   - console.logが正しいメッセージを出力していることを確認

### Property-Based Testing

**テストライブラリ**: fast-check

**設定**: 各テストは最低100回実行

**Property Test 1: カテゴリ別遷移先の正確性**

```typescript
// Feature: property-listing-reins-suumo-direct-navigation, Property 1: カテゴリ別遷移先の正確性
fc.assert(
  fc.property(
    fc.string({ minLength: 5, maxLength: 10 }), // 物件番号
    fc.oneof(
      fc.constant(null),
      fc.constant('all'),
      fc.constant('未報告'),
      fc.constant('レインズ登録＋SUUMO登録'),
      fc.constant('本日公開予定'),
      fc.constant('SUUMO URL　要登録')
    ), // サイドバーステータス
    (propertyNumber, sidebarStatus) => {
      const expectedPath = getExpectedNavigationPath(propertyNumber, sidebarStatus);
      const actualPath = simulateHandleRowClick(propertyNumber, sidebarStatus);
      return actualPath === expectedPath;
    }
  ),
  { numRuns: 100 }
);
```

**Property Test 2: 状態保持のラウンドトリップ**

```typescript
// Feature: property-listing-reins-suumo-direct-navigation, Property 2: 状態保持のラウンドトリップ
fc.assert(
  fc.property(
    fc.integer({ min: 0, max: 10 }), // ページ番号
    fc.integer({ min: 25, max: 100 }), // 1ページあたりの表示件数
    fc.string({ maxLength: 20 }), // 検索クエリ
    fc.oneof(fc.constant(null), fc.constant('レインズ登録＋SUUMO登録'), fc.constant('本日公開予定')), // サイドバーステータス
    (page, rowsPerPage, searchQuery, sidebarStatus) => {
      const state = { page, rowsPerPage, searchQuery, sidebarStatus, lastFilter: 'sidebar' as const };
      
      // 状態を保存
      sessionStorage.setItem('propertyListState', JSON.stringify(state));
      
      // 状態を復元
      const restored = JSON.parse(sessionStorage.getItem('propertyListState') || '{}');
      
      // ラウンドトリップが成功することを確認
      return (
        restored.page === state.page &&
        restored.rowsPerPage === state.rowsPerPage &&
        restored.searchQuery === state.searchQuery &&
        restored.sidebarStatus === state.sidebarStatus
      );
    }
  ),
  { numRuns: 100 }
);
```

### Integration Testing

**テスト対象**: 物件リストページ → レインズ登録ページ → 物件リストページの遷移フロー

**テストケース**:

1. **エンドツーエンドの遷移フロー**
   - 物件リストページで「レインズ登録＋SUUMO登録」カテゴリを選択
   - 物件をクリック
   - レインズ登録ページが表示されることを確認
   - 「物件リストに戻る」ボタンをクリック
   - 物件リストページが元の状態で表示されることを確認

### Manual Testing

**テストケース**:

1. **デスクトップ環境での動作確認**
   - 各カテゴリで物件をクリックし、正しいページに遷移することを確認
   - 戻るボタンで元の状態に戻ることを確認

2. **モバイル環境での動作確認**
   - アコーディオンからカテゴリを選択
   - 物件カードをタップし、正しいページに遷移することを確認
   - 戻るボタンで元の状態に戻ることを確認

3. **ブラウザの開発者ツールでログを確認**
   - 各カテゴリで物件をクリック
   - コンソールに正しいログが出力されることを確認

