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

1. **キャッシュ無効化のタイミング問題**: `CallModePage.tsx`で一覧に戻る際に`pageDataCache.invalidate(CACHE_KEYS.SELLERS_LIST)`を呼び出しているが、`CACHE_KEYS.SELLERS_SIDEBAR_COUNTS`は無効化していない
   - 売主リストデータは無効化されるが、サイドバーカウントは15分間キャッシュされたまま
   - サイドバーカウントの再取得が遅延する

2. **データ再取得の順序問題**: `SellersPage.tsx`の`fetchSidebarCounts()`が、キャッシュが有効な場合は再取得をスキップする
   - 一覧に戻った時点でキャッシュが有効なため、古いカウントが表示される
   - 約5秒後にバックグラウンドで再取得が完了し、正しいカウントに更新される

3. **forceRefreshフラグの未使用**: `fetchSidebarCounts(forceRefresh = false)`は`forceRefresh`パラメータを持つが、一覧に戻る際に`true`を渡していない
   - キャッシュを強制的に無効化して再取得する機能があるが、使用されていない

4. **非同期処理のタイミング**: `navigate('/')`の直後に`fetchSidebarCounts()`が呼ばれるが、ナビゲーション完了前にキャッシュチェックが行われる可能性
   - キャッシュ無効化とナビゲーションの順序が保証されていない

## Correctness Properties

Property 1: Bug Condition - サイドバーカテゴリーからの即座の除外

_For any_ 通話モードページでの変更（次電日を今日以降に変更、営担を設定など）により、サイドバーカテゴリーの条件から外れる場合、一覧に戻った瞬間に、その案件はサイドバーから即座に除外され、遅延なく正しいカテゴリーに表示されるべきです。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 条件を満たす変更の正しい表示

_For any_ 次電日を変更しない操作、または条件を満たす変更（次電日を今日以前に設定など）を行った場合、一覧に戻った際に、サイドバーの表示は正しく維持され、該当するカテゴリーに正しく表示され続けるべきです。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: 一覧に戻るボタンのonClickハンドラー（2箇所）

**Specific Changes**:
1. **サイドバーカウントキャッシュの無効化を追加**:
   - `pageDataCache.invalidate(CACHE_KEYS.SELLERS_LIST)`の直後に`pageDataCache.invalidate(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS)`を追加
   - これにより、一覧に戻った際にサイドバーカウントも強制的に再取得される

2. **カテゴリ一覧に戻るボタンでも同様の処理を追加**:
   - `{label}一覧`ボタンのonClickハンドラーでも`CACHE_KEYS.SELLERS_SIDEBAR_COUNTS`を無効化

3. **キャッシュ無効化の順序を保証**:
   - `navigate('/')`の前にキャッシュ無効化を完了させる
   - 必要に応じて`await`を使用して順序を保証

4. **forceRefreshフラグの活用（オプション）**:
   - `SellersPage.tsx`の`useEffect`で、特定の条件下で`fetchSidebarCounts(true)`を呼び出す
   - ただし、キャッシュ無効化で十分な場合は不要

5. **展開カテゴリキャッシュの無効化（オプション）**:
   - `sidebar_expanded:${category}`形式のキャッシュも無効化する
   - カテゴリ展開時の全件データも最新に保つ

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
