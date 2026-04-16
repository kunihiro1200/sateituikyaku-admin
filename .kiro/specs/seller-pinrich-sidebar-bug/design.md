# Pinrich要変更サイドバーバグ Bugfix Design

## Overview

売主リストのサイドバーカテゴリー「Pinrich要変更」が未実装のため、対象売主（AA13712を含む）がサイドバーに表示されない。

バグの本質は「機能未実装」であり、以下の3箇所に新規実装が必要：

1. **バックエンド（カウント計算）**: `SellerSidebarCountsUpdateService.ts` に `pinrichChangeRequired` カテゴリのカウント計算ロジックを追加
2. **バックエンド（フィルタリング）**: `SellerService.supabase.ts` の `statusCategory` switch文に `pinrichChangeRequired` ケースを追加
3. **フロントエンド（サイドバー表示）**: `SellerStatusSidebar.tsx` に「Pinrich要変更」ボタンを追加、`sellerStatusFilters.ts` に判定関数と型定義を追加

修正方針は最小限の変更に留める：
- 既存の `pinrichEmpty` カテゴリの実装パターンを踏襲する
- 4つのOR条件（A〜D）を正確に実装する
- 既存カテゴリへのリグレッションを防ぐ

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `pinrichChangeRequired` カテゴリが未実装のため、対象売主がサイドバーに表示されない状態
- **Property (P)**: 期待される正しい動作 — 条件A〜Dのいずれかを満たす売主が「Pinrich要変更」カテゴリにカウントされ、クリックで一覧表示される
- **Preservation**: 修正によって変更してはならない既存の動作 — 既存の全サイドバーカテゴリー（`pinrichEmpty` を含む）の表示・カウント・フィルタリング
- **SellerSidebarCountsUpdateService**: `backend/src/services/SellerSidebarCountsUpdateService.ts` — `seller_sidebar_counts` テーブルを更新するサービス
- **SellerService.supabase.ts**: `backend/src/services/SellerService.supabase.ts` — 売主一覧取得・フィルタリングを担うサービス（`statusCategory` パラメータでサイドバーフィルタリングを処理）
- **SellerStatusSidebar**: `frontend/frontend/src/components/SellerStatusSidebar.tsx` — 売主リストページと通話モードページで共通使用するサイドバーコンポーネント
- **sellerStatusFilters.ts**: `frontend/frontend/src/utils/sellerStatusFilters.ts` — `StatusCategory` 型定義と各カテゴリの判定関数を定義するユーティリティ
- **pinrichChangeRequired**: 新規追加するカテゴリキー — 「Pinrich要変更」カテゴリの識別子
- **contract_year_month**: `sellers` テーブルのカラム — 契約年月（YYYY-MM-DD形式）

## Bug Details

### Bug Condition

バグは「Pinrich要変更」カテゴリが3箇所すべてで未実装であることにより発現する。

- バックエンドの `SellerSidebarCountsUpdateService` が `pinrichChangeRequired` カテゴリのカウントを計算・保存しない
- バックエンドの `SellerService.supabase.ts` が `statusCategory=pinrichChangeRequired` のフィルタリングを処理しない
- フロントエンドの `SellerStatusSidebar` に「Pinrich要変更」ボタンが存在しない

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller of type Seller
  OUTPUT: boolean

  // 条件A: 訪問担当が「外す」かつPinrichがクローズかつ追客中
  conditionA := seller.visit_assignee = "外す"
                AND seller.pinrich_status = "クローズ"
                AND seller.status = "追客中"

  // 条件B: 信頼度Dかつ特定のPinrichステータスでない
  EXCLUDED_PINRICH_B := {"クローズ", "登録不要", "アドレスエラー",
                         "配信不要（他決後、訪問後、担当付）", "△配信停止"}
  conditionB := seller.confidence_level = "D"
                AND seller.pinrich_status NOT IN EXCLUDED_PINRICH_B

  // 条件C: 訪問日あり・配信中・営担あり・特定ステータス
  VALID_STATUS_C := {"専任媒介", "追客中", "除外後追客中"}
  conditionC := seller.visit_date IS NOT NULL AND seller.visit_date != ""
                AND seller.pinrich_status = "配信中"
                AND seller.visit_assignee IS NOT NULL AND seller.visit_assignee != ""
                AND seller.status IN VALID_STATUS_C

  // 条件D: 特定ステータス・クローズ・2025-05-01以降の契約
  VALID_STATUS_D := {"他決→追客", "他決→追客不要", "一般媒介"}
  conditionD := seller.status IN VALID_STATUS_D
                AND seller.pinrich_status = "クローズ"
                AND seller.contract_year_month >= "2025-05-01"

  RETURN conditionA OR conditionB OR conditionC OR conditionD
END FUNCTION
```

### Examples

- **条件Aの例**: `visit_assignee="外す"`, `pinrich_status="クローズ"`, `status="追客中"` の売主AA13712 → 「Pinrich要変更」に表示されるべきだが、現在は表示されない
- **条件Bの例**: `confidence_level="D"`, `pinrich_status="配信中"` の売主 → 「Pinrich要変更」に表示されるべきだが、現在は表示されない
- **条件Cの例**: `visit_date="2025-06-01"`, `pinrich_status="配信中"`, `visit_assignee="Y"`, `status="追客中"` の売主 → 「Pinrich要変更」に表示されるべきだが、現在は表示されない
- **条件Dの例**: `status="他決→追客"`, `pinrich_status="クローズ"`, `contract_year_month="2025-05-15"` の売主 → 「Pinrich要変更」に表示されるべきだが、現在は表示されない
- **除外例（条件B）**: `confidence_level="D"`, `pinrich_status="クローズ"` の売主 → 条件Bの除外リストに該当するため「Pinrich要変更」に表示されない（正常動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 既存の「⑧Pinrich空欄（pinrichEmpty）」カテゴリの条件・カウント・フィルタリングは変更しない
- 既存の全カテゴリ（`todayCall`, `todayCallWithInfo`, `todayCallAssigned`, `visitDayBefore`, `visitCompleted`, `unvaluated`, `mailingPending`, `todayCallNotStarted`, `exclusive`, `general`, `visitOtherDecision`, `unvisitedOtherDecision`）のカウント・表示は変更しない
- `SellerSidebarCountsUpdateService` の既存カテゴリ計算ロジックは変更しない
- `SellerService.supabase.ts` の既存 `statusCategory` ケースは変更しない
- `SellerStatusSidebar` の既存ボタン・レイアウトは変更しない

**Scope:**
`pinrichChangeRequired` 条件に関係しない全ての入力は、この修正によって完全に影響を受けない。これには以下が含まれる：
- 既存カテゴリのボタンクリック操作
- 既存カテゴリのカウント表示
- 売主詳細・通話モードページの動作

## Hypothesized Root Cause

バグの説明に基づき、最も可能性の高い原因は以下の通り：

1. **機能未実装（バックエンド・カウント計算）**: `SellerSidebarCountsUpdateService.ts` に `pinrichChangeRequired` カテゴリのカウント計算ロジックが存在しない
   - `seller_sidebar_counts` テーブルに `pinrichChangeRequired` のレコードが保存されない
   - フロントエンドが `categoryCounts.pinrichChangeRequired` を参照しても `undefined` になる

2. **機能未実装（バックエンド・フィルタリング）**: `SellerService.supabase.ts` の `statusCategory` switch文に `pinrichChangeRequired` ケースが存在しない
   - `statusCategory=pinrichChangeRequired` でAPIを呼び出しても全件が返される（または空になる）

3. **機能未実装（フロントエンド）**: `SellerStatusSidebar.tsx` の `renderAllCategories()` に「Pinrich要変更」ボタンが存在しない
   - `sellerStatusFilters.ts` の `StatusCategory` 型に `pinrichChangeRequired` が含まれていない
   - `isPinrichChangeRequired()` 判定関数が存在しない

## Correctness Properties

Property 1: Bug Condition - Pinrich要変更カテゴリの正常表示

_For any_ 売主において条件A〜Dのいずれかを満たす場合（isBugCondition returns true）、修正後のシステムは `seller_sidebar_counts` テーブルに `pinrichChangeRequired` カウントが保存され、フロントエンドのサイドバーに「Pinrich要変更」ボタンが表示され、クリックすると対象売主の一覧が表示される SHALL。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 既存カテゴリの動作保持

_For any_ 入力において `pinrichChangeRequired` 条件に関係しない操作（既存カテゴリのクリック、既存カテゴリのカウント表示など）は、修正後のシステムが修正前のシステムと同一の結果を返す SHALL。具体的には、`pinrichEmpty` を含む全既存カテゴリのカウント・フィルタリング・表示が変更されない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合の修正：

---

**File 1**: `backend/src/services/SellerSidebarCountsUpdateService.ts`

**Function**: `updateSellerSidebarCounts()`

**Specific Changes**:
1. **データ取得クエリを追加**: `Promise.all` に `pinrichChangeRequired` 用のクエリを追加
   - 条件A〜Dを満たす売主を取得するクエリ（複数クエリをOR結合またはJS側でフィルタリング）
   - 既存の `pinrichEmpty` 用クエリ（`todayCallBaseResult1/2`）のパターンを参考にする
2. **カウント計算ロジックを追加**: 取得データから条件A〜Dを評価してカウントを算出
3. **rows配列に追加**: `{ category: 'pinrichChangeRequired', count: pinrichChangeRequiredCount, label: null, assignee: null }` を追加

---

**File 2**: `backend/src/services/SellerService.supabase.ts`

**Function**: `getSellers()` 内の `statusCategory` switch文

**Specific Changes**:
1. **`pinrichChangeRequired` ケースを追加**: 既存の `pinrichEmpty` ケース（約1452行目）の直後に追加
   - 条件A〜Dを満たす売主をSupabaseクエリまたはJS側フィルタリングで取得
   - 条件が複雑なため、全件取得後にJS側でフィルタリングするアプローチを採用（`pinrichEmpty` と同様）

---

**File 3**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**Specific Changes**:
1. **`StatusCategory` 型に `pinrichChangeRequired` を追加**
2. **`isPinrichChangeRequired()` 判定関数を追加**: 条件A〜Dを評価する関数
3. **`calculateCategoryCounts()` に `pinrichChangeRequired` を追加**
4. **`filterSellersByCategory()` の switch文に `pinrichChangeRequired` ケースを追加**

---

**File 4**: `frontend/frontend/src/components/SellerStatusSidebar.tsx`

**Specific Changes**:
1. **`isPinrichChangeRequired` をインポートに追加**
2. **`renderAllCategories()` に「Pinrich要変更」ボタンを追加**: `pinrichEmpty` ボタンの直前または直後に配置
   - `renderCategoryButton('pinrichChangeRequired', 'Pinrich要変更', '#e91e63')` を呼び出す
3. **`getCategoryLabel()` に `pinrichChangeRequired` ケースを追加**: `'Pinrich要変更'` を返す
4. **`getCategoryColor()` に `pinrichChangeRequired` ケースを追加**: 適切な色（例: `'#e91e63'`）を返す
5. **`filterSellersByCategory()` の switch文に `pinrichChangeRequired` ケースを追加**

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズのアプローチに従う：まず未修正コードでバグを実証するカウンターサンプルを表面化し、次に修正が正しく動作し既存の動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、未修正コードでバグを実証するカウンターサンプルを表面化する。根本原因分析を確認または反証する。反証された場合は再仮説が必要。

**Test Plan**: 条件A〜Dを満たす売主データをモックして `SellerStatusSidebar` をレンダリングし、「Pinrich要変更」ボタンが存在しないことを確認するテストを書く。また、`SellerSidebarCountsUpdateService` が `pinrichChangeRequired` カウントを保存しないことを確認するテストを書く。これらのテストを未修正コードで実行して失敗を観察し、根本原因を理解する。

**Test Cases**:
1. **フロントエンドボタン欠落テスト**: 条件Aを満たす売主を含む `categoryCounts` を渡して `SellerStatusSidebar` をレンダリングし、「Pinrich要変更」ボタンが存在しないことを確認（未修正コードでは `getByText('Pinrich要変更')` が失敗する）
2. **カウント計算欠落テスト**: `SellerSidebarCountsUpdateService.updateSellerSidebarCounts()` を実行し、`seller_sidebar_counts` テーブルに `pinrichChangeRequired` レコードが存在しないことを確認（未修正コードでは失敗する）
3. **フィルタリング欠落テスト**: `statusCategory=pinrichChangeRequired` でAPIを呼び出し、条件A〜Dを満たす売主が返されないことを確認（未修正コードでは失敗する）
4. **AA13712特定テスト**: AA13712が条件Aを満たす場合、サイドバーに表示されないことを確認（未修正コードでは失敗する）

**Expected Counterexamples**:
- `SellerStatusSidebar` に「Pinrich要変更」ボタンが存在しない
- `seller_sidebar_counts` テーブルに `pinrichChangeRequired` レコードが存在しない
- 可能性のある原因: 機能未実装（3箇所すべて）

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を返すことを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  // バックエンド: カウント計算
  counts := updateSellerSidebarCounts_fixed()
  ASSERT counts['pinrichChangeRequired'] > 0

  // バックエンド: フィルタリング
  result := getSellers_fixed({ statusCategory: 'pinrichChangeRequired' })
  ASSERT seller IN result.data

  // フロントエンド: ボタン表示
  rendered := render(SellerStatusSidebar_fixed, { categoryCounts: counts })
  ASSERT 'Pinrich要変更' IN rendered.buttons
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前の関数と同一の結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  counts_original := updateSellerSidebarCounts_original()
  counts_fixed    := updateSellerSidebarCounts_fixed()
  
  FOR EACH category IN EXISTING_CATEGORIES DO
    ASSERT counts_original[category] = counts_fixed[category]
  END FOR
END FOR
```

**Testing Approach**: 保持チェックにプロパティベーステストを推奨する理由：
- 入力ドメイン全体にわたって多数のテストケースを自動生成できる
- 手動ユニットテストが見逃すエッジケースを検出できる
- 既存カテゴリのカウントが変更されていないことを強く保証できる

**Test Plan**: まず未修正コードで既存カテゴリ（`pinrichEmpty` など）のカウントを観察し、その動作をキャプチャするプロパティベーステストを書く。

**Test Cases**:
1. **pinrichEmpty保持テスト**: `pinrichEmpty` カウントが修正前後で変わらないことを検証
2. **todayCall保持テスト**: `todayCall` カウントが修正前後で変わらないことを検証
3. **exclusive/general保持テスト**: `exclusive`, `general` カウントが修正前後で変わらないことを検証
4. **全カテゴリ保持テスト**: 既存13カテゴリ全てのカウントが修正前後で変わらないことを検証

### Unit Tests

- `isPinrichChangeRequired()` が条件A〜Dを正しく評価することをテスト（各条件の境界値を含む）
- `isPinrichChangeRequired()` が条件Bの除外リスト（`クローズ`, `登録不要` 等）を正しく処理することをテスト
- `SellerSidebarCountsUpdateService` が `pinrichChangeRequired` カウントを正しく計算することをテスト
- `filterSellersByCategory(sellers, 'pinrichChangeRequired')` が条件A〜Dを満たす売主のみを返すことをテスト

### Property-Based Tests

- ランダムな売主データを生成し、`isPinrichChangeRequired()` が条件A〜Dを正しく評価することを検証
- ランダムな売主リストを生成し、`pinrichChangeRequired` カウントと `filterSellersByCategory` の結果が一致することを検証
- 多数のシナリオにわたって、修正前後で既存カテゴリのカウントが変わらないことを検証

### Integration Tests

- 条件A〜Dを満たす売主がサイドバーの「Pinrich要変更」カテゴリに表示されることをテスト
- 「Pinrich要変更」ボタンをクリックすると対象売主の一覧が表示されることをテスト
- 修正後も既存カテゴリ（`pinrichEmpty` 等）のカウントと一覧表示が正しく動作することをテスト
