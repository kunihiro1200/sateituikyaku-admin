# 物件リストサイドバーの古いステータス表示バグ修正設計

## Overview

物件リストのサイドバーで「レインズ登録＋SUUMO登録」カテゴリーに、SUUMO URLが既に登録されている物件（AA12497, AA12459）が誤って表示されるバグを修正します。根本原因は、SUUMO URLが登録された後も`sidebar_status`が古い値のまま更新されていないことです。バックエンドの同期処理で`sidebar_status`を常に再計算することで、この問題を解決します。

## Glossary

- **Bug_Condition (C)**: バグ条件 - `sidebar_status`が「レインズ登録＋SUUMO登録」だが、`suumo_url`が既に登録されている状態
- **Property (P)**: 期待される動作 - SUUMO URLが登録されたら、自動的に`sidebar_status`が更新され、条件に合致しない物件はカテゴリーから除外される
- **Preservation**: 保存要件 - SUUMO URLが空の物件は、引き続き「レインズ登録＋SUUMO登録」カテゴリーに表示される
- **sidebar_status**: `property_listings`テーブルのカラム。物件のサイドバー表示カテゴリーを保存
- **calculateSidebarStatus()**: `PropertyListingSyncService`のメソッド。スプレッドシートデータから`sidebar_status`を計算
- **syncUpdatedPropertyListings()**: スプレッドシート→データベース同期処理のメインメソッド

## Bug Details

### Bug Condition

バグは、SUUMO URLが登録された後も`sidebar_status`が古い値のまま更新されない場合に発生します。`PropertyListingSyncService.calculateSidebarStatus()`は、SUUMO URLの変更を検知して`sidebar_status`を再計算していますが、同期処理が実行されるまで古い値が残ります。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PropertyListing
  OUTPUT: boolean
  
  RETURN input.sidebar_status === 'レインズ登録＋SUUMO登録'
         AND input.suumo_url !== null
         AND input.suumo_url !== ''
END FUNCTION
```

### Examples

- **AA12497**: `sidebar_status`が「レインズ登録＋SUUMO登録」だが、`suumo_url`が`https://suumo.jp/chukoikkodate/oita/sc_oita/nc_20541403/`（空ではない）
- **AA12459**: `sidebar_status`が「レインズ登録＋SUUMO登録」だが、`suumo_url`が登録済み（空ではない）
- **正常な物件**: `suumo_url`が空で、`atbb_status`が「専任・公開中」、公開予定日が昨日以前 → 「レインズ登録＋SUUMO登録」カテゴリーに正しく表示される
- **Edge case**: SUUMO URLが登録された直後、次回の同期処理が実行されるまで古い`sidebar_status`が残る

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- SUUMO URLが空の物件は、引き続き「レインズ登録＋SUUMO登録」カテゴリーに表示される
- 他のサイドバーカテゴリー（未報告、未完了、公開前情報など）の判定ロジックは変更されない
- フロントエンドの表示ロジックは変更されない（`sidebar_status`を信頼して表示）

**Scope:**
SUUMO URLが登録されていない物件（`suumo_url`が`null`または空文字列）は、この修正の影響を受けません。これには以下が含まれます：
- 新規登録された物件（SUUMO URLがまだ登録されていない）
- SUUMO登録が「S不要」の物件
- 一般媒介の物件（「SUUMO URL　要登録」カテゴリー）

## Hypothesized Root Cause

バグ説明に基づき、最も可能性の高い原因は以下の通りです：

1. **同期タイミングの問題**: `PropertyListingSyncService.syncUpdatedPropertyListings()`は定期的に実行されますが、SUUMO URLが登録された直後は古い`sidebar_status`が残る可能性があります。

2. **変更検知の不足**: `detectChanges()`メソッドは、スプレッドシートとデータベースの差分を検出しますが、`sidebar_status`の再計算結果が現在のDB値と異なる場合も変更として検出する必要があります。

3. **手動更新の未対応**: ブラウザで直接SUUMO URLを更新した場合、`sidebar_status`が自動的に再計算されない可能性があります。

4. **既存データの不整合**: AA12497とAA12459は、過去にSUUMO URLが空だった時点で`sidebar_status`が「レインズ登録＋SUUMO登録」に設定され、その後SUUMO URLが登録されたが、`sidebar_status`が更新されなかった。

## Correctness Properties

Property 1: Bug Condition - SUUMO URL登録後のステータス更新

_For any_ 物件で、SUUMO URLが登録されており（`suumo_url`が`null`でも空文字列でもない）、かつ`atbb_status`が「専任・公開中」で、公開予定日が昨日以前の場合、修正後の`calculateSidebarStatus`関数は「レインズ登録＋SUUMO登録」以外のステータスを返すべきです。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - SUUMO URL未登録物件のステータス

_For any_ 物件で、SUUMO URLが登録されていない（`suumo_url`が`null`または空文字列）、かつ`atbb_status`が「専任・公開中」、公開予定日が昨日以前、`suumo_registered`が「S不要」ではない場合、修正後のコードは元のコードと同じく「レインズ登録＋SUUMO登録」ステータスを返すべきです。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定すると：

**File**: `backend/src/services/PropertyListingSyncService.ts`

**Function**: `calculateSidebarStatus()`

**Specific Changes**:
1. **SUUMO URL判定の厳密化**: 「レインズ登録＋SUUMO登録」カテゴリーの条件で、`suumo_url`が空であることを厳密にチェックする
   - 現在の実装: `!suumoUrl`（falsy値をチェック）
   - 修正後: `!suumoUrl || suumoUrl.trim() === ''`（空文字列も明示的にチェック）

2. **同期処理での再計算**: `syncUpdatedPropertyListings()`メソッドで、`sidebar_status`を常に再計算する
   - 現在の実装: `detectChanges()`で差分を検出し、変更があった場合のみ`sidebar_status`を再計算
   - 修正後: 全物件に対して`sidebar_status`を再計算し、DB値と異なる場合は更新

3. **既存データの修正**: AA12497とAA12459の`sidebar_status`を正しい値に更新
   - 手動でSQLを実行するか、同期処理を実行して自動的に修正

4. **ログ出力の追加**: `sidebar_status`が更新された場合、ログに出力して追跡可能にする

5. **テストケースの追加**: バグ条件を満たす物件が存在しないことを確認するテストを追加

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現する探索テストを実行し、次に修正後のコードで正しい動作と既存機能の保存を検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証します。反証された場合は、再度仮説を立てます。

**Test Plan**: AA12497とAA12459の`sidebar_status`とSUUMO URLを確認するテストを作成します。修正前のコードで実行し、バグ条件を満たすことを確認します。

**Test Cases**:
1. **AA12497のバグ確認**: `sidebar_status`が「レインズ登録＋SUUMO登録」で、`suumo_url`が空ではないことを確認（修正前のコードで失敗）
2. **AA12459のバグ確認**: `sidebar_status`が「レインズ登録＋SUUMO登録」で、`suumo_url`が空ではないことを確認（修正前のコードで失敗）
3. **calculateSidebarStatusの動作確認**: SUUMO URLが登録されている物件に対して、「レインズ登録＋SUUMO登録」以外のステータスを返すことを確認（修正前のコードで失敗する可能性）
4. **同期処理の動作確認**: `syncUpdatedPropertyListings()`を実行し、`sidebar_status`が更新されることを確認（修正前のコードで失敗する可能性）

**Expected Counterexamples**:
- AA12497とAA12459の`sidebar_status`が「レインズ登録＋SUUMO登録」のまま
- Possible causes: 同期処理が実行されていない、`calculateSidebarStatus()`がSUUMO URLを正しくチェックしていない、`detectChanges()`が`sidebar_status`の変更を検出していない

### Fix Checking

**Goal**: バグ条件を満たす全ての入力に対して、修正後の関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := calculateSidebarStatus_fixed(input)
  ASSERT result !== 'レインズ登録＋SUUMO登録'
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない全ての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT calculateSidebarStatus_original(input) = calculateSidebarStatus_fixed(input)
END FOR
```

**Testing Approach**: 保存チェックにはプロパティベーステストが推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動的に生成
- 手動の単体テストでは見逃す可能性のあるエッジケースをキャッチ
- 非バグ入力に対して動作が変更されていないことを強力に保証

**Test Plan**: まず修正前のコードでSUUMO URLが空の物件の動作を観察し、次にその動作を捕捉するプロパティベーステストを作成します。

**Test Cases**:
1. **SUUMO URL空の物件の保存**: SUUMO URLが空で、他の条件を満たす物件が「レインズ登録＋SUUMO登録」カテゴリーに表示されることを確認
2. **他のカテゴリーの保存**: 未報告、未完了、公開前情報などの他のカテゴリーの判定ロジックが変更されていないことを確認
3. **一般媒介物件の保存**: 一般媒介の物件が「SUUMO URL　要登録」カテゴリーに表示されることを確認

### Unit Tests

- AA12497とAA12459のバグ条件を確認するテスト
- `calculateSidebarStatus()`がSUUMO URLを正しくチェックするテスト
- SUUMO URLが空の物件が「レインズ登録＋SUUMO登録」カテゴリーに表示されるテスト

### Property-Based Tests

- ランダムな物件データを生成し、SUUMO URLが登録されている物件が「レインズ登録＋SUUMO登録」カテゴリーに表示されないことを検証
- ランダムな物件データを生成し、SUUMO URLが空の物件が「レインズ登録＋SUUMO登録」カテゴリーに表示されることを検証
- 多くのシナリオで、他のカテゴリーの判定ロジックが変更されていないことをテスト

### Integration Tests

- スプレッドシート→データベース同期処理を実行し、`sidebar_status`が正しく更新されることを確認
- ブラウザでSUUMO URLを更新し、次回の同期処理で`sidebar_status`が更新されることを確認
- サイドバーのカウントが正しいことを確認（「レインズ登録＋SUUMO登録」カテゴリーが0件）
