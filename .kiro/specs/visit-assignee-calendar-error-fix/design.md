# 訪問予約カレンダー送信エラー修正（特定アカウントのみ）設計ドキュメント

## Overview

売主リストの通話モードページで訪問日を保存してGoogleカレンダー送信する際、特定のアカウント（yurine~、mariko~）でのみ400エラーが発生する問題を修正します。根本原因は、イニシャル「U」がemployeesテーブルに存在しない、または異なる名前にマッピングされているため、`SellerService.decryptSeller()`でイニシャルからフルネームへの変換が失敗し、`visitAssignee`と`visitAssigneeInitials`の両方が`undefined`になることです。

修正方針は、イニシャルからフルネームへの変換が失敗した場合でも、`visitAssigneeInitials`は元のイニシャル値（例: "U"）を保持するように変更することです。これにより、フロントエンドで営担チェック時に`visitAssigneeInitials`をフォールバックとして使用でき、カレンダー送信が成功するようになります。

## Glossary

- **Bug_Condition (C)**: イニシャル「U」がemployeesテーブルに存在しない、または異なる名前にマッピングされている状態で、訪問予約を保存しようとする条件
- **Property (P)**: `visitAssigneeInitials`が元のイニシャル値（例: "U"）を保持し、フロントエンドで営担チェックとカレンダー送信が成功する動作
- **Preservation**: イニシャルがemployeesテーブルに正しく登録されている売主の訪問予約保存時に、`visitAssignee`（フルネーム）と`visitAssigneeInitials`（イニシャル）の両方が正しく返される既存の動作
- **decryptSeller()**: `backend/src/services/SellerService.supabase.ts`のメソッドで、売主データを復号化し、イニシャルをフルネームに変換する処理を行う
- **initialsMap**: employeesテーブルから取得したイニシャルとフルネームのマッピング（例: `{ "T": "田中太郎", "G": "源田玄太" }`）
- **visitAssignee**: 訪問担当者のフルネーム（例: "裏天真"）
- **visitAssigneeInitials**: 訪問担当者のイニシャル（例: "U"）

## Bug Details

### Bug Condition

バグは、イニシャル「U」がemployeesテーブルに存在しない、または異なる名前にマッピングされている状態で、yurine~またはmariko~のアカウントで訪問予約を保存しようとする際に発生します。`SellerService.decryptSeller()`メソッドは、`initialsMap[seller.visit_assignee]`でイニシャルからフルネームへの変換を試みますが、イニシャル「U」が存在しない場合、変換に失敗します。

現在の実装では、変換失敗時に`visitAssigneeInitials`も`undefined`に設定されるため、フロントエンドで営担チェック（`visitAssignee || visitAssigneeInitials`）が失敗し、「現在の売主の営担が設定されていません」という警告が表示され、Googleカレンダー送信時に400エラーが発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { sellerId: string, visitAssignee: string }
  OUTPUT: boolean
  
  RETURN input.visitAssignee IN employeesTable.initials
         AND initialsMap[input.visitAssignee] === null
         AND userAccount IN ['yurine~', 'mariko~']
         AND NOT (visitAssigneeInitials is preserved)
END FUNCTION
```

### Examples

- **例1**: yurine~アカウントで売主番号AA18を開き、訪問予約を編集して保存する → Googleカレンダー送信時に400エラーが発生
  - **期待される動作**: `visitAssigneeInitials`が"U"として保持され、カレンダー送信が成功する
  - **実際の動作**: `visitAssignee`と`visitAssigneeInitials`が両方とも`undefined`になり、カレンダー送信が失敗する

- **例2**: mariko~アカウントで訪問予約を保存する → コンソールに「現在の売主の営担が設定されていません。サイドバーを表示しません。」という警告が表示される
  - **期待される動作**: `visitAssigneeInitials`が"U"として保持され、サイドバーが表示される
  - **実際の動作**: `visitAssignee`と`visitAssigneeInitials`が両方とも`undefined`になり、サイドバーが表示されない

- **例3**: ネットワークタブでAPIレスポンスを確認する → `visitAssignee: "裏天真"`、`visitAssigneeInitials: "U"`が正しく返されている
  - **期待される動作**: フロントエンドでも`visitAssignee`と`visitAssigneeInitials`が正しく表示される
  - **実際の動作**: コンソールログで`seller.visitAssignee`、`seller.visitAssigneeInitials`、`seller.assignedTo`が全て`undefined`と表示される

- **エッジケース**: tomoko~やgenta~のアカウントで訪問予約を保存する → 正常にGoogleカレンダー送信が成功する
  - **理由**: これらのアカウントのイニシャル（"T"、"G"）はemployeesテーブルに正しく登録されているため、変換が成功する

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- イニシャルがemployeesテーブルに正しく登録されている売主の訪問予約を保存する際、`visitAssignee`（フルネーム）と`visitAssigneeInitials`（イニシャル）の両方が正しく返される
- 営担チェックで`visitAssignee`または`visitAssigneeInitials`のいずれかが存在する場合、サイドバーが正しく表示される
- 訪問日削除機能を使用する際、引き続き正常に訪問日・営担・訪問査定取得者が削除される
- 訪問査定取得者の自動設定機能を使用する際、引き続き正常にログインユーザーに自動設定される

**Scope:**
イニシャルがemployeesテーブルに正しく登録されている売主（tomoko~、genta~など）の訪問予約保存は、完全に影響を受けません。これには以下が含まれます：
- イニシャル「T」、「G」などの正常なマッピング
- `visitAssignee`（フルネーム）の正常な取得
- `visitAssigneeInitials`（イニシャル）の正常な取得

## Hypothesized Root Cause

バグ要件ドキュメントと実装コードの分析に基づき、最も可能性の高い根本原因は以下の通りです：

1. **イニシャルマッピングの欠落**: employeesテーブルにイニシャル「U」が存在しない、または異なる名前にマッピングされている
   - `initialsMap`は`getInitialsMap()`関数で取得され、employeesテーブルの`initials`と`name`カラムから構築される
   - イニシャル「U」が存在しない場合、`initialsMap["U"]`は`undefined`を返す

2. **decryptSellerメソッドの変換ロジック**: 現在の実装では、変換失敗時に`visitAssigneeInitials`も`undefined`に設定される
   - 現在のコード: `visitAssigneeInitials: seller.visit_assignee || undefined`
   - 問題: `seller.visit_assignee`が"U"の場合、`initialsMap["U"]`が`undefined`を返すと、`visitAssigneeFullName`が`null`になり、`visitAssignee`が`undefined`になる
   - しかし、`visitAssigneeInitials`は元のイニシャル値（"U"）を保持すべきだが、現在の実装では`seller.visit_assignee || undefined`となっており、`seller.visit_assignee`が存在する場合は正しく保持される
   - **実際の問題**: コードを確認すると、`visitAssigneeInitials: seller.visit_assignee || undefined`となっているため、`seller.visit_assignee`が"U"の場合は正しく保持されるはず
   - **真の原因**: フロントエンドで`seller.visitAssigneeInitials`が`undefined`と表示されるのは、バックエンドからのレスポンスが正しく処理されていない可能性がある

3. **フロントエンドでの処理**: `CallModePage.tsx`で営担チェック時に`visitAssignee || visitAssigneeInitials`を使用しているが、両方とも`undefined`の場合にエラーが発生する
   - 現在の実装: `visitAssignee || visitAssigneeInitials`のいずれかが存在すればサイドバーを表示
   - 問題: 両方とも`undefined`の場合、「現在の売主の営担が設定されていません」という警告が表示される

4. **データベースの状態**: `sellers`テーブルの`visit_assignee`カラムに"U"が保存されているが、employeesテーブルに対応するレコードが存在しない
   - ネットワークタブでは`visitAssignee: "裏天真"`、`visitAssigneeInitials: "U"`が正しく返されているが、コンソールログでは`undefined`と表示される
   - **矛盾**: ネットワークタブとコンソールログの不一致は、フロントエンドでの処理に問題がある可能性を示唆している

## Correctness Properties

Property 1: Bug Condition - イニシャル変換失敗時のvisitAssigneeInitials保持

_For any_ 訪問予約保存リクエストで、イニシャルがemployeesテーブルに存在しない場合（isBugCondition returns true）、修正後の`decryptSeller`メソッドは、`visitAssigneeInitials`に元のイニシャル値（例: "U"）を保持し、フロントエンドで営担チェックとカレンダー送信が成功するようにする。

**Validates: Requirements 2.3, 2.4, 2.5**

Property 2: Preservation - 正常なイニシャルマッピングの保持

_For any_ 訪問予約保存リクエストで、イニシャルがemployeesテーブルに正しく登録されている場合（isBugCondition returns false）、修正後のコードは、`visitAssignee`（フルネーム）と`visitAssigneeInitials`（イニシャル）の両方を正しく返し、既存の動作を完全に保持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の修正を実施します：

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `decryptSeller()`

**Specific Changes**:
1. **visitAssigneeInitialsの保持ロジック修正**: イニシャルからフルネームへの変換が失敗した場合でも、`visitAssigneeInitials`は元のイニシャル値を保持するように変更
   - 現在: `visitAssigneeInitials: seller.visit_assignee || undefined`
   - 修正後: `visitAssigneeInitials: seller.visit_assignee || undefined`（変更なし、既に正しい実装）
   - **実際の問題**: コードを確認すると、既に正しい実装になっているため、問題は別の箇所にある可能性が高い

2. **デバッグログの追加**: `visitAssigneeInitials`の値を確認するためのデバッグログを追加
   - `console.log('visitAssigneeInitials:', seller.visit_assignee)`を追加して、元のイニシャル値が正しく保持されているか確認

3. **フロントエンドでの処理確認**: `CallModePage.tsx`で`seller.visitAssigneeInitials`が正しく表示されているか確認
   - ネットワークタブとコンソールログの不一致を調査

4. **employeesテーブルの確認**: イニシャル「U」が存在するか、または正しい名前にマッピングされているか確認
   - `SELECT * FROM employees WHERE initials = 'U'`を実行して確認

5. **修正方針の再検討**: コードレビューの結果、`visitAssigneeInitials`は既に正しく保持されているため、問題は以下のいずれかである可能性が高い
   - employeesテーブルにイニシャル「U」が存在しない
   - フロントエンドで`seller.visitAssigneeInitials`が正しく処理されていない
   - APIレスポンスとフロントエンドの間でデータが失われている

**修正後のコード（decryptSellerメソッド）**:
```typescript
// イニシャルをフルネームに変換（フォールバック付き）
visitAssignee: visitAssigneeFullName || seller.visit_assignee || undefined,
visitAssigneeInitials: seller.visit_assignee || undefined, // 元のイニシャルを保持（変更なし）
```

**注意**: 現在の実装を確認した結果、`visitAssigneeInitials`は既に正しく保持されているため、問題は別の箇所にある可能性が高いです。次のステップとして、以下を確認する必要があります：
- employeesテーブルにイニシャル「U」が存在するか
- フロントエンドで`seller.visitAssigneeInitials`が正しく処理されているか
- APIレスポンスとフロントエンドの間でデータが失われていないか

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現し、根本原因を確認します。次に、修正後のコードで、イニシャル変換が失敗した場合でも`visitAssigneeInitials`が正しく保持され、カレンダー送信が成功することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認します。根本原因分析を確認または反証します。反証された場合は、再度仮説を立てる必要があります。

**Test Plan**: yurine~またはmariko~のアカウントで売主番号AA18を開き、訪問予約を編集して保存するテストを実行します。修正前のコードで実行し、失敗を観察して根本原因を理解します。

**Test Cases**:
1. **yurine~アカウントでの訪問予約保存**: 売主番号AA18を開き、訪問予約を編集して保存する（修正前のコードで失敗）
2. **mariko~アカウントでの訪問予約保存**: 訪問予約を保存し、コンソールログを確認する（修正前のコードで失敗）
3. **ネットワークタブでのAPIレスポンス確認**: `visitAssignee`と`visitAssigneeInitials`が正しく返されているか確認（修正前のコードで成功）
4. **employeesテーブルの確認**: イニシャル「U」が存在するか確認（存在しない場合、バグの根本原因）

**Expected Counterexamples**:
- `visitAssignee`と`visitAssigneeInitials`が両方とも`undefined`になる
- 可能性のある原因: employeesテーブルにイニシャル「U」が存在しない、フロントエンドでの処理エラー、APIレスポンスとフロントエンドの間でデータが失われている

### Fix Checking

**Goal**: イニシャル変換が失敗した場合でも、修正後のコードで`visitAssigneeInitials`が元のイニシャル値を保持し、カレンダー送信が成功することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := decryptSeller_fixed(input)
  ASSERT result.visitAssigneeInitials === input.visitAssignee
  ASSERT result.visitAssignee === undefined OR result.visitAssignee === initialsMap[input.visitAssignee]
  ASSERT calendarSendSuccess(result)
END FOR
```

### Preservation Checking

**Goal**: イニシャルがemployeesテーブルに正しく登録されている場合、修正後のコードで`visitAssignee`（フルネーム）と`visitAssigneeInitials`（イニシャル）の両方が正しく返されることを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT decryptSeller_original(input) = decryptSeller_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは、保存チェックに推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動的に生成する
- 手動ユニットテストでは見逃す可能性のあるエッジケースをキャッチする
- 非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: 修正前のコードでtomoko~やgenta~のアカウントの動作を観察し、その動作をキャプチャするproperty-based testを作成します。

**Test Cases**:
1. **tomoko~アカウントでの訪問予約保存**: 修正前のコードで正常に動作することを確認し、修正後も同じ動作を維持することをテストする
2. **genta~アカウントでの訪問予約保存**: 修正前のコードで正常に動作することを確認し、修正後も同じ動作を維持することをテストする
3. **サイドバー表示の保存**: 修正前のコードで営担チェックが正常に動作することを確認し、修正後も同じ動作を維持することをテストする

### Unit Tests

- イニシャル「U」がemployeesテーブルに存在しない場合の`decryptSeller`メソッドのテスト
- イニシャル「T」、「G」などが正しくマッピングされている場合の`decryptSeller`メソッドのテスト
- `visitAssigneeInitials`が元のイニシャル値を保持することをテスト

### Property-Based Tests

- ランダムなイニシャルを生成し、`decryptSeller`メソッドが正しく動作することを検証
- イニシャルがemployeesテーブルに存在しない場合でも、`visitAssigneeInitials`が保持されることを検証
- イニシャルが正しくマッピングされている場合、`visitAssignee`と`visitAssigneeInitials`の両方が正しく返されることを検証

### Integration Tests

- yurine~アカウントで訪問予約を保存し、Googleカレンダー送信が成功することをテスト
- mariko~アカウントで訪問予約を保存し、サイドバーが正しく表示されることをテスト
- tomoko~やgenta~のアカウントで訪問予約を保存し、既存の動作が保持されることをテスト
