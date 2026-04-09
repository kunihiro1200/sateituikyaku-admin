# 売主スプレッドシート重複行追加バグ修正設計書

## Overview

通話モードページで売主情報を編集して保存すると、たまに（10回に1回程度）スプレッドシートに同じ売主番号の行が重複して追加される問題を修正します。この問題は、スプレッドシート同期処理において既存行の検索に失敗し、更新ではなく新規追加として処理されることが原因です。

根本原因は、`GoogleSheetsClient.findRowByColumn()`メソッドが競合状態（race condition）に対して脆弱であり、複数の同期リクエストが同時に実行された場合に既存行を見つけられないことです。

## Glossary

- **Bug_Condition (C)**: スプレッドシート同期処理が既存行の検索に失敗する条件 - 複数の同期リクエストが短時間に実行される
- **Property (P)**: 同期処理が正しく動作する状態 - 既存行が見つかった場合は更新、見つからない場合のみ新規追加
- **Preservation**: 既存の同期機能が正しく動作し続けること
- **SpreadsheetSyncService**: `backend/src/services/SpreadsheetSyncService.ts` - スプレッドシート同期を管理するサービス
- **GoogleSheetsClient**: `backend/src/services/GoogleSheetsClient.ts` - Google Sheets APIとの通信を担当するクライアント
- **findRowByColumn**: 売主番号で既存行を検索するメソッド
- **Race Condition**: 複数の同期リクエストが同時に実行され、互いに干渉する状態

## Bug Details

### Bug Condition

バグは、通話モードページで売主情報を編集して保存した際に、スプレッドシート同期処理が既存行の検索に失敗し、新規行を追加してしまうときに発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(syncRequest)
  INPUT: syncRequest of type { sellerId: string, timestamp: number }
  OUTPUT: boolean
  
  RETURN existingRowExists(syncRequest.sellerId)
         AND findRowByColumn(syncRequest.sellerId) RETURNS null
         AND (concurrentSyncRequestExists(syncRequest.sellerId, syncRequest.timestamp)
              OR cacheInvalidationOccurred(syncRequest.timestamp))
END FUNCTION
```

### Examples

- **例1（競合状態）**: AA13888の売主情報を編集して保存 → 0.5秒後に再度保存 → 1回目の同期が完了する前に2回目の同期が開始 → 2回目の検索で既存行が見つからない → 重複行が追加される
- **例2（キャッシュ問題）**: AA13888の売主情報を編集して保存 → スプレッドシートに新規行が追加される → 直後に再度編集して保存 → ヘッダーキャッシュが古いままで列インデックスがずれる → 検索で既存行が見つからない → 重複行が追加される
- **例3（正常動作）**: AA13888の売主情報を編集して保存 → 同期が完了するまで待つ → 再度編集して保存 → 既存行が正しく見つかる → 既存行が更新される
- **エッジケース**: 新規売主を登録 → 既存行が存在しない → 新規行が追加される（期待通り）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 新規売主を登録した場合、スプレッドシートに新しい行を追加する
- 既存行の検索が成功した場合、既存行を正しく更新する
- 他のフィールド（名前、電話番号、メールアドレスなど）を正しく同期する

**Scope:**
売主番号が空欄の売主、または同期処理が実行されない入力は、この修正の影響を受けません。これには以下が含まれます：
- 売主番号が空欄の売主（エラーを返す）
- スプレッドシート同期が無効化されている場合
- Google Sheets APIが利用できない場合

## Hypothesized Root Cause

バグ説明に基づいて、最も可能性の高い原因は以下の通りです：

1. **競合状態（Race Condition）**: 複数の同期リクエストが短時間に実行される
   - 通話モードページで連続して保存ボタンをクリック
   - 1回目の同期が完了する前に2回目の同期が開始
   - 2回目の`findRowByColumn()`が1回目の追加行を見つけられない

2. **Google Sheets APIのレスポンス遅延**: APIレスポンスが遅い場合、検索結果が古い
   - `findRowByColumn()`がスプレッドシートを読み取る
   - 読み取り中に別の同期処理が新規行を追加
   - 読み取り結果が古いため、新規行が見つからない

3. **ヘッダーキャッシュの問題**: ヘッダーキャッシュが古いままで列インデックスがずれる
   - `getHeaders()`がヘッダーをキャッシュ
   - スプレッドシートに新しい列が追加される
   - キャッシュが古いままで`findRowByColumn()`が間違った列を検索

4. **文字列比較の問題**: 売主番号の文字列比較が失敗する
   - スプレッドシートに`"AA13888 "`（末尾にスペース）が格納されている
   - `findRowByColumn()`が`"AA13888"`で検索
   - `trim()`が適用されていない場合、一致しない

## Correctness Properties

Property 1: Bug Condition - 既存行検索の確実性

_For any_ 同期リクエストにおいて、売主番号がスプレッドシートに既に存在する場合、修正後の`findRowByColumn()`メソッドSHALL既存行を確実に見つけ、行番号を返す。これは、複数の同期リクエストが同時に実行される場合でも保証される。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 新規行追加の正確性

_For any_ 同期リクエストにおいて、売主番号がスプレッドシートに存在しない場合、修正後のコードSHALL新規行を追加し、既存の同期機能と同じ動作を保持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `backend/src/services/SpreadsheetSyncService.ts`

**Function**: `syncToSpreadsheet`

**Specific Changes**:
1. **同期処理のロック機構を追加**: 同じ売主番号に対する同期処理を直列化
   - インメモリのロックマップを使用（`Map<string, Promise<SyncResult>>`）
   - 同じ売主番号の同期リクエストが来た場合、前の同期が完了するまで待つ
   - ロックが解放されたら、再度既存行を検索してから同期を実行

2. **既存行検索のリトライロジックを追加**: 検索失敗時に再試行
   - `findRowByColumn()`が`null`を返した場合、短い遅延（100ms）後に再試行
   - 最大3回まで再試行
   - 3回とも失敗した場合のみ新規行を追加

3. **ヘッダーキャッシュのクリア**: 同期前にヘッダーキャッシュをクリア
   - `syncToSpreadsheet()`の開始時に`this.sheetsClient.clearHeaderCache()`を呼び出す
   - これにより、常に最新のヘッダー情報で列インデックスを計算

4. **文字列比較の強化**: `findRowByColumn()`で`trim()`を確実に適用
   - 既に実装済みだが、念のため確認

5. **ログの強化**: デバッグ情報を追加
   - 既存行検索の結果をログに記録
   - 新規行追加と既存行更新を明確に区別
   - 競合状態が発生した場合にログに記録

**File**: `backend/src/services/GoogleSheetsClient.ts`

**Function**: `findRowByColumn`

**Specific Changes**:
1. **検索範囲の拡大**: 検索範囲を明示的に指定
   - 現在は`${columnLetter}2:${columnLetter}`（最終行まで）
   - 最終行を明示的に取得して範囲を指定（例: `${columnLetter}2:${columnLetter}10000`）

2. **エラーハンドリングの強化**: API エラー時のリトライ
   - Google Sheets APIがエラーを返した場合、短い遅延後に再試行
   - 最大3回まで再試行

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、未修正コードでバグを再現する反例を表面化し、次に修正が正しく動作し、既存の動作を保持することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、未修正コードでバグを再現する反例を表面化します。根本原因分析を確認または反証します。反証した場合、再仮説が必要です。

**Test Plan**: 複数の同期リクエストを短時間に実行するテストを作成し、未修正コードで重複行が追加されることを確認します。

**Test Cases**:
1. **競合状態テスト**: AA13888の同期を0.5秒間隔で2回実行（未修正コードで失敗）
2. **連続同期テスト**: AA13888の同期を即座に3回実行（未修正コードで失敗）
3. **ヘッダーキャッシュテスト**: 新しい列を追加後、AA13888の同期を実行（未修正コードで失敗する可能性）
4. **正常動作テスト**: AA13888の同期を5秒間隔で2回実行（未修正コードでも成功）

**Expected Counterexamples**:
- 複数の同期リクエストが同時に実行された場合、`findRowByColumn()`が既存行を見つけられない
- 可能な原因: 競合状態、APIレスポンス遅延、ヘッダーキャッシュの問題

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL syncRequest WHERE isBugCondition(syncRequest) DO
  result := syncToSpreadsheet_fixed(syncRequest.sellerId)
  ASSERT result.operation = 'update'
  ASSERT NOT duplicateRowExists(syncRequest.sellerId)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL syncRequest WHERE NOT isBugCondition(syncRequest) DO
  ASSERT syncToSpreadsheet_original(syncRequest.sellerId) = syncToSpreadsheet_fixed(syncRequest.sellerId)
END FOR
```

**Testing Approach**: 保存チェックにはプロパティベーステストが推奨されます。理由：
- 入力ドメイン全体で多くのテストケースを自動生成
- 手動ユニットテストが見逃す可能性のあるエッジケースをキャッチ
- バグのない入力に対して動作が変更されていないことを強力に保証

**Test Plan**: まず未修正コードで新規売主登録と通常の同期の動作を観察し、その動作をキャプチャするプロパティベーステストを作成します。

**Test Cases**:
1. **新規売主登録の保存**: 新規売主を登録した場合、新規行が追加されることを確認
2. **通常の同期の保存**: 既存売主を更新した場合（競合なし）、既存行が更新されることを確認
3. **他のフィールドの保存**: 名前、電話番号、メールアドレスなどが正しく同期されることを確認
4. **エラーハンドリングの保存**: 売主番号が空欄の場合、エラーが返されることを確認

### Unit Tests

- 競合状態での同期処理をテスト（複数の同期リクエストを同時に実行）
- 既存行検索のリトライロジックをテスト
- ヘッダーキャッシュのクリアをテスト
- エッジケース（新規売主、売主番号が空欄）をテスト

### Property-Based Tests

- ランダムな売主データを生成し、同期が正しく動作することを検証
- ランダムな同期タイミングを生成し、重複行が追加されないことを検証
- 多くのシナリオで既存の動作が保持されることをテスト

### Integration Tests

- 通話モードページでの完全な同期フローをテスト
- 複数のユーザーが同時に編集した場合の同期をテスト
- Google Sheets APIのエラー時の動作をテスト
