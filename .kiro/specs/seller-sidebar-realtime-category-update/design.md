# 売主サイドバーリアルタイム更新バグ修正設計

## Overview

売主リストのサイドバーカテゴリーにおいて、通話モードページで次電日を変更した後、当日TEL一覧に戻ると、条件から外れた案件が約5秒間残り続けるバグを修正します。この遅延は、キャッシュの無効化タイミングとデータ再取得の順序に起因しています。修正により、ユーザーが次の案件に電話しようとする際の混乱を解消します。

## Glossary

- **Bug_Condition (C)**: サイドバーカテゴリーの条件から外れる変更（次電日を今日以降に変更など）を行った後、一覧に戻った際に、約5秒間古いデータが表示される状態
- **Property (P)**: カテゴリー条件から外れた案件は、一覧に戻った瞬間に即座にサイドバーから除外されるべき
- **Preservation**: 次電日を変更しない場合、または条件を満たす変更の場合は、サイドバーの表示が正しく維持される
- **pageDataCache**: フロントエンドのキャッシュ管理システム（`frontend/frontend/src/store/pageDataCache.ts`）
- **CACHE_KEYS.SELLERS_LIST**: 売主リストデータのキャッシュキー
- **CACHE_KEYS.SELLERS_SIDEBAR_COUNTS**: サイドバーカウントデータのキャッシュキー
- **fetchSidebarCounts()**: サイドバーのカテゴリ別カウントを取得する関数（`SellersPage.tsx`）
- **navigateWithWarningCheck()**: 未保存の変更がある場合に警告を表示してからナビゲートする関数（`CallModePage.tsx`）

## Bug Details

### Bug Condition

バグは、通話モードページで次電日を変更して当日TEL一覧に戻った際に発生します。変更した案件が約5秒間サイドバーに残り続け、その後自動的に消えます。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, nextCallDate: Date | null, returnToCategory: string }
  OUTPUT: boolean
  
  RETURN input.action === 'updateNextCallDate'
         AND input.nextCallDate > TODAY
         AND input.returnToCategory === 'todayCall'
         AND delayBeforeRemoval > 0
END FUNCTION
```

### Examples

- **例1**: AA13501の次電日を「2026/4/10」（今日以降）に変更 → 当日TEL一覧に戻る → 約5秒間AA13501がサイドバーに残る → 自動的に消える
- **例2**: AA13502の次電日を「2026/4/10」に変更 → 訪問日前日一覧に戻る → 約5秒間AA13502がサイドバーに残る → 自動的に消える
- **例3**: AA13503の営担を「Y」に設定 → 当日TEL分一覧に戻る → 約5秒間AA13503がサイドバーに残る（営担ありは当日TEL分から除外されるべき）
- **エッジケース**: 次電日を今日以前に変更 → 当日TEL一覧に戻る → 即座に表示される（期待通り）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 次電日を変更せずに一覧に戻った場合、サイドバーの表示は変更されないまま維持される
- 次電日を今日以前の日付に変更した場合、当日TEL分カテゴリーに正しく表示され続ける
- サイドバーカテゴリーの条件を満たす変更を行った場合、該当するカテゴリーに正しく表示され続ける

**Scope:**
次電日を変更しない操作、または条件を満たす変更（次電日を今日以前に設定など）は、この修正の影響を受けません。これには以下が含まれます：
- 名前、電話番号、メールアドレスなどの基本情報の変更
- コメントの追加・編集
- 査定額の変更
- 次電日を今日以前の日付に変更

## Hypothesized Root Cause

バグ説明に基づき、最も可能性の高い原因は以下の通りです：

### フロントエンド側の問題（修正済み）

1. **キャッシュ無効化のタイミング問題**: `CallModePage.tsx`で一覧に戻る際に`pageDataCache.invalidate(CACHE_KEYS.SELLERS_LIST)`を呼び出しているが、`CACHE_KEYS.SELLERS_SIDEBAR_COUNTS`は無効化していない
   - 売主リストデータは無効化されるが、サイドバーカウントは15分間キャッシュされたまま
   - サイドバーカウントの再取得が遅延する
   - **修正済み**: 3箇所の「一覧に戻る」ボタンで`CACHE_KEYS.SELLERS_SIDEBAR_COUNTS`と`sidebar_expanded:*`プレフィックスのキャッシュを無効化

2. **データ再取得の順序問題**: `SellersPage.tsx`の`fetchSidebarCounts()`が、キャッシュが有効な場合は再取得をスキップする
   - 一覧に戻った時点でキャッシュが有効なため、古いカウントが表示される
   - 約5秒後にバックグラウンドで再取得が完了し、正しいカウントに更新される
   - **修正済み**: `useEffect`でキャッシュが無効化されているかチェックし、無効化されている場合は`forceRefresh: true`で再取得

3. **forceRefreshフラグの未使用**: `fetchSidebarCounts(forceRefresh = false)`は`forceRefresh`パラメータを持つが、一覧に戻る際に`true`を渡していない
   - キャッシュを強制的に無効化して再取得する機能があるが、使用されていない
   - **修正済み**: キャッシュ無効化検出時に`forceRefresh: true`を使用

4. **非同期処理のタイミング**: `navigate('/')`の直後に`fetchSidebarCounts()`が呼ばれるが、ナビゲーション完了前にキャッシュチェックが行われる可能性
   - キャッシュ無効化とナビゲーションの順序が保証されていない
   - **修正済み**: キャッシュ無効化後にナビゲート

### バックエンド側の問題（未修正・根本原因）

**デバッグログとネットワークタブの分析結果**:
- フロントエンドは正しく動作している（API呼び出しは200-400msで完了）
- しかし、ネットワークタブでは`/api/sellers/sidebar-counts`エンドポイントが**7.68秒**かかっている
- これは**サーバー側のパフォーマンス問題**であり、フロントエンドの最適化では解決できない

**バックエンドのパフォーマンスボトルネック**:

1. **複数のページネーションループ**（`backend/src/services/SellerService.supabase.ts`の`getSidebarCountsFallback()`メソッド）:
   - `visitAssigneeSellers`（訪問日前日用）: 1000件ずつ全件取得
   - `todayCallAssignedSellers`（当日TEL担当用）: 1000件ずつ全件取得
   - `allAssignedSellers`（担当イニシャル親カテゴリ用）: 1000件ずつ全件取得
   - 各ループが複数回実行される可能性があり、合計で数千件のデータを取得

2. **JavaScriptでのフィルタリング**（データベースレベルではない）:
   - 訪問日前日の前営業日計算（木曜訪問のみ2日前、それ以外は1日前）
   - 当日TEL_未着手の複雑な条件（不通が空欄、反響日付が2026/1/1以降など）
   - これらの計算がJavaScript側で行われるため、データベースの最適化が効かない

3. **複数の個別クエリ**（並列化されていない部分もある）:
   - 訪問済み、未査定、査定（郵送）などの個別クエリが順次実行される
   - 一部は並列化されているが、全体的には非効率

4. **データベースインデックスの不足**:
   - `visit_assignee`, `visit_date`, `next_call_date`, `status`などの頻繁にクエリされるカラムにインデックスがない可能性
   - フルテーブルスキャンが発生している可能性

5. **キャッシュTTLの短さ**:
   - 現在のキャッシュTTLは60秒
   - サイドバーカウントは頻繁に変更されないため、より長いTTLでも問題ない可能性

## Correctness Properties

Property 1: Bug Condition - サイドバーカテゴリーからの即座の除外

_For any_ 通話モードページでの変更（次電日を今日以降に変更、営担を設定など）により、サイドバーカテゴリーの条件から外れる場合、一覧に戻った瞬間に、その案件はサイドバーから即座に除外され、遅延なく正しいカテゴリーに表示されるべきです。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 条件を満たす変更の正しい表示

_For any_ 次電日を変更しない操作、または条件を満たす変更（次電日を今日以前に設定など）を行った場合、一覧に戻った際に、サイドバーの表示は正しく維持され、該当するカテゴリーに正しく表示され続けるべきです。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Phase 1: フロントエンド修正（完了）

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: 一覧に戻るボタンのonClickハンドラー（3箇所）

**Specific Changes**:
1. **サイドバーカウントキャッシュの無効化を追加**:
   - `pageDataCache.invalidate(CACHE_KEYS.SELLERS_LIST)`の直後に`pageDataCache.invalidate(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS)`を追加
   - これにより、一覧に戻った際にサイドバーカウントも強制的に再取得される
   - **実装済み**: 3箇所の「一覧に戻る」ボタンで実装

2. **展開カテゴリキャッシュの無効化**:
   - `sidebar_expanded:${category}`形式のキャッシュも無効化する
   - カテゴリ展開時の全件データも最新に保つ
   - **実装済み**: プレフィックスマッチングで全展開カテゴリキャッシュを無効化

3. **キャッシュ無効化の順序を保証**:
   - `navigate('/')`の前にキャッシュ無効化を完了させる
   - **実装済み**: キャッシュ無効化後にナビゲート

**File**: `frontend/frontend/src/pages/SellersPage.tsx`

**Function**: `useEffect`（サイドバーカウント取得）

**Specific Changes**:
1. **forceRefreshフラグの活用**:
   - `useEffect`で、キャッシュが無効化されているかチェック
   - 無効化されている場合は`fetchSidebarCounts(true)`を呼び出す
   - **実装済み**: キャッシュ無効化検出時に`forceRefresh: true`を使用

2. **useMemoによる最適化**:
   - `categoryCounts`の計算を`useMemo`でメモ化
   - **実装済み**: 不要な再計算を防止

3. **useCallbackによる最適化**:
   - `handleCategorySelect`と`handleCategoryExpand`を`useCallback`でメモ化
   - **実装済み**: 不要な再レンダリングを防止

**File**: `frontend/frontend/src/components/SellerStatusSidebar.tsx`

**Specific Changes**:
1. **React.memoによる最適化**:
   - コンポーネント全体を`React.memo`でラップ
   - **実装済み**: propsが変更されない限り再レンダリングをスキップ

**結果**: フロントエンドは正しく動作しているが、バックエンドのパフォーマンス問題により5秒の遅延が残る

### Phase 2: バックエンドパフォーマンス改善（未実装・優先度高）

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `getSidebarCountsFallback()`

**問題**: 7-8秒かかっている原因
- 複数のページネーションループ（各1000件ずつ全件取得）
- JavaScriptでのフィルタリング（データベースレベルではない）
- 複数の個別クエリ（並列化されていない部分もある）
- データベースインデックスの不足

**解決策（優先度順）**:

#### 解決策1: データベースビューの作成（最も効果的）

**概要**: 複雑なフィルタリングロジックをデータベースビューに移動し、JavaScriptでの計算を削減

**実装**:
```sql
-- 訪問日前日ビュー（前営業日ロジックを含む）
CREATE OR REPLACE VIEW seller_visit_day_before AS
SELECT 
  id,
  visit_assignee,
  visit_date,
  CASE 
    WHEN EXTRACT(DOW FROM visit_date) = 4 THEN visit_date - INTERVAL '2 days'  -- 木曜訪問は2日前
    ELSE visit_date - INTERVAL '1 day'  -- それ以外は1日前
  END AS notify_date
FROM sellers
WHERE deleted_at IS NULL
  AND visit_assignee IS NOT NULL
  AND visit_assignee != ''
  AND visit_date IS NOT NULL
  AND (visit_reminder_assignee IS NULL OR visit_reminder_assignee = '');

-- 当日TEL分ビュー
CREATE OR REPLACE VIEW seller_today_call AS
SELECT 
  id,
  visit_assignee,
  phone_contact_person,
  preferred_contact_time,
  contact_method,
  unreachable_status,
  inquiry_date,
  pinrich_status,
  confidence_level,
  exclusion_date,
  status
FROM sellers
WHERE deleted_at IS NULL
  AND (status ILIKE '%追客中%' OR status = '他決→追客')
  AND next_call_date IS NOT NULL
  AND next_call_date <= CURRENT_DATE
  AND (visit_assignee IS NULL OR visit_assignee = '' OR visit_assignee = '外す');
```

**メリット**:
- データベースレベルでフィルタリング（インデックスが効く）
- JavaScriptでの計算が不要
- ページネーションループが不要（ビューから直接カウント取得）

**推定パフォーマンス改善**: 7-8秒 → 1-2秒

#### 解決策2: データベースインデックスの追加

**概要**: 頻繁にクエリされるカラムにインデックスを追加

**実装**:
```sql
-- 営担インデックス
CREATE INDEX IF NOT EXISTS idx_sellers_visit_assignee ON sellers(visit_assignee) WHERE deleted_at IS NULL;

-- 次電日インデックス
CREATE INDEX IF NOT EXISTS idx_sellers_next_call_date ON sellers(next_call_date) WHERE deleted_at IS NULL;

-- 訪問日インデックス
CREATE INDEX IF NOT EXISTS idx_sellers_visit_date ON sellers(visit_date) WHERE deleted_at IS NULL;

-- 状況（当社）インデックス（部分一致用）
CREATE INDEX IF NOT EXISTS idx_sellers_status_gin ON sellers USING gin(status gin_trgm_ops);

-- 複合インデックス（当日TEL分用）
CREATE INDEX IF NOT EXISTS idx_sellers_today_call ON sellers(status, next_call_date, visit_assignee) WHERE deleted_at IS NULL;
```

**メリット**:
- クエリ速度が大幅に向上
- フルテーブルスキャンを回避

**推定パフォーマンス改善**: 7-8秒 → 3-4秒

#### 解決策3: クエリの並列化

**概要**: 複数の個別クエリを`Promise.all()`で並列実行

**実装**:
```typescript
// 現在: 順次実行
const visitDayBeforeCount = await getVisitDayBeforeCount();
const visitCompletedCount = await getVisitCompletedCount();
const todayCallAssignedCount = await getTodayCallAssignedCount();

// 改善: 並列実行
const [visitDayBeforeCount, visitCompletedCount, todayCallAssignedCount] = await Promise.all([
  getVisitDayBeforeCount(),
  getVisitCompletedCount(),
  getTodayCallAssignedCount(),
]);
```

**メリット**:
- 複数のクエリを同時に実行
- 待ち時間を削減

**推定パフォーマンス改善**: 7-8秒 → 5-6秒

#### 解決策4: キャッシュTTLの延長

**概要**: サイドバーカウントのキャッシュTTLを60秒から5分に延長

**実装**:
```typescript
// 現在: 60秒
await CacheHelper.set(sidebarCacheKey, sidebarResult, CACHE_TTL.SIDEBAR_COUNTS);

// 改善: 5分（300秒）
await CacheHelper.set(sidebarCacheKey, sidebarResult, 300);
```

**メリット**:
- サイドバーカウントの再取得頻度を削減
- ユーザー体験への影響は最小限（5分以内の変更は許容範囲）

**推定パフォーマンス改善**: 再取得頻度が1/5に削減

#### 解決策5: `seller_sidebar_counts`テーブルの再導入（長期的）

**概要**: 買主リストと同様に、専用のサイドバーカウントテーブルを作成し、トリガーで自動更新

**実装**:
```sql
-- サイドバーカウントテーブル
CREATE TABLE seller_sidebar_counts (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  today_call INTEGER DEFAULT 0,
  today_call_with_info INTEGER DEFAULT 0,
  today_call_assigned INTEGER DEFAULT 0,
  visit_day_before INTEGER DEFAULT 0,
  visit_completed INTEGER DEFAULT 0,
  unvaluated INTEGER DEFAULT 0,
  mailing_pending INTEGER DEFAULT 0,
  today_call_not_started INTEGER DEFAULT 0,
  pinrich_empty INTEGER DEFAULT 0,
  exclusive INTEGER DEFAULT 0,
  general INTEGER DEFAULT 0,
  visit_other_decision INTEGER DEFAULT 0,
  unvisited_other_decision INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- トリガー関数（売主データ変更時に自動更新）
CREATE OR REPLACE FUNCTION update_seller_sidebar_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- カウントを再計算してテーブルを更新
  -- （詳細な実装は省略）
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー
CREATE TRIGGER seller_sidebar_counts_trigger
AFTER INSERT OR UPDATE OR DELETE ON sellers
FOR EACH ROW
EXECUTE FUNCTION update_seller_sidebar_counts();
```

**メリット**:
- サイドバーカウント取得が即座に完了（テーブルから読み取るだけ）
- 複雑な計算が不要

**デメリット**:
- トリガーのメンテナンスが必要
- データの整合性を保つ必要がある

**推定パフォーマンス改善**: 7-8秒 → 0.1-0.2秒

### 推奨実装順序

1. **解決策2（インデックス追加）**: 最も簡単で効果的（推定3-4秒に短縮）
2. **解決策3（クエリ並列化）**: コード変更のみで実装可能（推定5-6秒に短縮）
3. **解決策4（キャッシュTTL延長）**: 再取得頻度を削減（ユーザー体験向上）
4. **解決策1（データベースビュー）**: 最も効果的だが、SQL知識が必要（推定1-2秒に短縮）
5. **解決策5（専用テーブル）**: 長期的な解決策（推定0.1-0.2秒に短縮）

**目標**: 7-8秒 → 1秒以下

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現する反例を表面化させ、次に修正が正しく機能し、既存の動作を保持することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、バグを実証する反例を表面化させます。根本原因分析を確認または反証します。反証された場合は、再仮説が必要です。

**Test Plan**: 通話モードページで次電日を変更し、一覧に戻った際のサイドバーの表示を確認するテストを作成します。これらのテストを修正前のコードで実行し、失敗を観察して根本原因を理解します。

**Test Cases**:
1. **当日TEL分からの除外テスト**: 次電日を今日以降に変更 → 当日TEL一覧に戻る → 即座に除外されるべき（修正前は約5秒間残る）
2. **営担設定による除外テスト**: 営担を設定 → 当日TEL分一覧に戻る → 即座に除外されるべき（修正前は約5秒間残る）
3. **訪問日前日からの除外テスト**: 訪問日を削除 → 訪問日前日一覧に戻る → 即座に除外されるべき（修正前は約5秒間残る）
4. **複数カテゴリ変更テスト**: 次電日と営担を同時に変更 → 一覧に戻る → 即座に正しいカテゴリーに表示されるべき（修正前は遅延）

**Expected Counterexamples**:
- サイドバーカウントが古いまま表示される（約5秒間）
- 可能な原因: キャッシュ無効化の不足、データ再取得の遅延、非同期処理のタイミング

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := navigateBackToList_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT navigateBackToList_original(input) = navigateBackToList_fixed(input)
END FOR
```

**Testing Approach**: 保存チェックにはプロパティベーステストが推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動的に生成
- 手動の単体テストでは見逃す可能性のあるエッジケースをキャッチ
- すべての非バグ入力に対して動作が変更されていないという強力な保証を提供

**Test Plan**: まず、修正前のコードでマウスクリックやその他の操作の動作を観察し、次にその動作をキャプチャするプロパティベーステストを作成します。

**Test Cases**:
1. **次電日を変更しない場合の保存**: 名前やコメントのみを変更 → 一覧に戻る → サイドバーの表示が変更されないことを確認
2. **条件を満たす変更の保存**: 次電日を今日以前に変更 → 当日TEL一覧に戻る → 正しく表示され続けることを確認
3. **ページリロードの保存**: ページをリロード → サイドバーのカテゴリー判定が正しく動作することを確認
4. **他のカテゴリーの保存**: 訪問日前日、未査定などの他のカテゴリーが正しく動作し続けることを確認

### Unit Tests

- 通話モードページから一覧に戻る際のキャッシュ無効化をテスト
- カテゴリ一覧に戻る際のキャッシュ無効化をテスト
- エッジケース（次電日が空、営担が「外す」など）をテスト

### Property-Based Tests

- ランダムな売主データを生成し、次電日変更後のサイドバー表示が正しいことを検証
- ランダムなカテゴリー変更を生成し、一覧に戻った際の表示が即座に更新されることを検証
- すべての非バグ入力（次電日を変更しない、条件を満たす変更）で動作が保持されることを多くのシナリオでテスト

### Integration Tests

- 通話モードページでの変更 → 一覧に戻る → サイドバーの即座の更新を含む完全なフローをテスト
- カテゴリー間の切り替えと一覧への戻りをテスト
- 複数の売主で連続して変更を行い、サイドバーが常に正しく更新されることをテスト
