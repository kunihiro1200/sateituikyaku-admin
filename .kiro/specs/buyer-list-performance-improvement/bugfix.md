# バグ修正要件定義書：買主リスト表示パフォーマンス改善

## Introduction

買主リストページの表示パフォーマンスが売主リストページと比較して著しく遅い問題を修正します。

**現状**:
- 買主リスト全体の表示に10秒かかる（本番環境）
- 売主リストは4秒で表示される
- 買主リストのサイドバー表示が特に遅い（最初は非表示で「くるくる」している）
- テーブル部分は比較的早く表示される

**期待される動作**:
- 買主リストの表示速度を売主リストと同程度（4秒程度）にする
- サイドバーの表示を高速化する

---

## Bug Analysis

### Current Behavior (Defect)

#### 1.1 サイドバーカウント取得の遅延

**条件**: 買主リストページを開いたとき

**現在の動作**:
- `/api/buyers/status-categories-with-buyers` が全件取得（全買主データ + property_listings全件を並列取得）を実行
- 初回ロード時に10秒以上かかる
- サイドバーが「くるくる」（ローディング状態）で表示される

**技術的詳細**:
```typescript
// backend/src/services/BuyerService.ts
async getStatusCategoriesWithBuyers() {
  // 全件取得（遅い）
  const [allBuyers, normalStaffInitials] = await Promise.all([
    this.fetchAllBuyers(),  // ← 全買主データ + property_listings全件を取得
    this.fetchNormalStaffInitials(),
  ]);
  // ...
}
```

**影響**:
- ユーザーがサイドバーのカテゴリカウントを確認できるまで10秒以上待つ必要がある
- 初回ロード時のユーザー体験が悪い

---

#### 1.2 テーブル表示の遅延

**条件**: 買主リストページを開いたとき

**現在の動作**:
- テーブル表示は `/api/buyers` から取得（ページネーション対応）
- サイドバーカウント取得が完了するまで、テーブルも表示されない
- 全体として10秒以上かかる

**技術的詳細**:
```typescript
// frontend/frontend/src/pages/BuyersPage.tsx
useEffect(() => {
  // サイドバー未ロード時: まず最初の50件を即座に表示
  const quickRes = await api.get('/api/buyers', { params: quickParams });
  setBuyers(quickRes.data.data || []);
  
  // バックグラウンドで全件取得（サイドバー更新）
  api.get('/api/buyers/status-categories-with-buyers').then((res) => {
    // ← これが遅い（10秒以上）
    setSidebarCategories(result.categories);
  });
}, []);
```

**影響**:
- テーブル表示は比較的早いが、サイドバーが遅いため全体として遅く感じる

---

### Expected Behavior (Correct)

#### 2.1 サイドバーカウント取得の高速化

**条件**: 買主リストページを開いたとき

**期待される動作**:
- サイドバーカウントを事前計算されたテーブル（`buyer_sidebar_counts`）から取得
- 初回ロード時でも1秒以内に表示される
- サイドバーが即座に表示される（「くるくる」が最小限）

**技術的詳細**:
```typescript
// backend/src/services/BuyerService.ts
async getSidebarCounts() {
  // buyer_sidebar_counts テーブルから取得（高速）
  const { data } = await this.supabase
    .from('buyer_sidebar_counts')
    .select('category, count, label, assignee');
  
  // カテゴリ別に集計して返す
  return result;
}
```

**実装方針**:
- 売主リストと同じアプローチを採用
- `buyer_sidebar_counts` テーブルを新規作成
- GASで10分ごとにカウントを更新
- APIは `buyer_sidebar_counts` から取得

---

#### 2.2 テーブル表示の高速化

**条件**: 買主リストページを開いたとき

**期待される動作**:
- テーブル表示は従来通り `/api/buyers` から取得（ページネーション対応）
- サイドバーカウント取得と並列実行
- 全体として4秒程度で表示される

**技術的詳細**:
```typescript
// frontend/frontend/src/pages/BuyersPage.tsx
useEffect(() => {
  // テーブルとサイドバーを並列取得
  Promise.all([
    api.get('/api/buyers', { params: quickParams }),
    api.get('/api/buyers/sidebar-counts'),  // ← 新しいエンドポイント（高速）
  ]).then(([buyersRes, sidebarRes]) => {
    setBuyers(buyersRes.data.data || []);
    setSidebarCategories(sidebarRes.data.categories);
  });
}, []);
```

---

### Unchanged Behavior (Regression Prevention)

#### 3.1 テーブルデータの取得

**条件**: 買主リストページでテーブルデータを取得するとき

**期待される動作**:
- `/api/buyers` エンドポイントは変更しない
- ページネーション、検索、フィルタリングは従来通り動作する
- テーブルに表示されるデータは変更されない

---

#### 3.2 サイドバーカテゴリの定義

**条件**: サイドバーにカテゴリカウントを表示するとき

**期待される動作**:
- サイドバーカテゴリの定義は変更しない
- カテゴリカウントの計算ロジックは変更しない
- カテゴリの表示順序は変更しない

---

#### 3.3 買主ステータスの計算

**条件**: 買主のステータスを計算するとき

**期待される動作**:
- `calculateBuyerStatus` 関数は変更しない
- ステータスの計算ロジックは変更しない
- ステータスの表示は変更しない

---

## 実装対象ファイル

### バックエンド

1. **`backend/src/routes/buyers.ts`**
   - 新しいエンドポイント `/api/buyers/sidebar-counts` を追加

2. **`backend/src/services/BuyerService.ts`**
   - `getSidebarCounts()` メソッドを追加
   - `getSidebarCountsFallback()` メソッドを追加（フォールバック用）

3. **`backend/supabase/migrations/YYYYMMDDHHMMSS_create_buyer_sidebar_counts.sql`**
   - `buyer_sidebar_counts` テーブルを作成

### フロントエンド

4. **`frontend/frontend/src/pages/BuyersPage.tsx`**
   - サイドバーカウント取得を `/api/buyers/sidebar-counts` に変更
   - `/api/buyers/status-categories-with-buyers` の使用を削除

### GAS（Google Apps Script）

5. **`gas_complete_code.js`**
   - `updateBuyerSidebarCounts_()` 関数を追加
   - `syncBuyerList()` 関数に `updateBuyerSidebarCounts_()` の呼び出しを追加

---

## テスト項目

### 1. サイドバーカウントの正確性

**テスト内容**:
- 各カテゴリのカウントが正しいことを確認
- 売主リストのサイドバーカウントと同じロジックで計算されていることを確認

**期待される結果**:
- 全てのカテゴリカウントが正確
- 手動計算と一致する

---

### 2. パフォーマンス

**テスト内容**:
- 買主リストページの初回ロード時間を測定
- サイドバー表示時間を測定
- テーブル表示時間を測定

**期待される結果**:
- 初回ロード時間: 4秒以内
- サイドバー表示時間: 1秒以内
- テーブル表示時間: 2秒以内

---

### 3. リグレッション

**テスト内容**:
- テーブルデータの取得が正常に動作することを確認
- ページネーション、検索、フィルタリングが正常に動作することを確認
- サイドバーカテゴリの表示が正常に動作することを確認

**期待される結果**:
- 全ての機能が従来通り動作する
- データの整合性が保たれる

---

## 実装優先順位

1. **Phase 1**: `buyer_sidebar_counts` テーブルの作成（マイグレーション）
2. **Phase 2**: GASの `updateBuyerSidebarCounts_()` 関数の実装
3. **Phase 3**: バックエンドの `/api/buyers/sidebar-counts` エンドポイントの実装
4. **Phase 4**: フロントエンドの修正
5. **Phase 5**: テスト・検証

---

**最終更新日**: 2026年3月26日  
**作成理由**: 買主リストページの表示パフォーマンスを売主リストページと同程度に改善するため
