# 事務へCHAT送信時の確認フィールド同期バグ修正デザイン

## Overview

物件リスト詳細画面（PropertyListingDetailPage.tsx）の「事務へCHAT」ボタン（BB14）を押すと、チャットメッセージが送信され、確認フィールドが「未」に更新される仕様です。しかし、以下の問題が発生しています：

1. サイドバーカテゴリーが「未完了」に即時更新されない
2. スプレッドシートのDQ列「確認」に即時同期されない
3. 10分後の自動同期でスプレッドシートの空欄（未同期）がDBに同期されて「未」が消える

この問題の根本原因は、フロントエンドの`handleSendChatToOffice`メソッドで、`handleUpdateConfirmation`メソッドと同じキャッシュクリア・イベント発火処理が実装されていないことです。また、バックエンドのスプレッドシート同期が失敗している可能性もあります。

## Glossary

- **Bug_Condition (C)**: 「事務へCHAT」ボタンを押した時に、キャッシュクリアとイベント発火が実行されない状態
- **Property (P)**: 「事務へCHAT」送信後、サイドバーカテゴリーが即座に「未完了」に更新され、スプレッドシートのDQ列に「未」が同期される状態
- **Preservation**: 手動で確認フィールドを変更した時の既存動作（キャッシュクリア、イベント発火、スプレッドシート同期）が維持される
- **handleSendChatToOffice**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`の「事務へCHAT」送信メソッド
- **handleUpdateConfirmation**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`の確認フィールド手動更新メソッド
- **pageDataCache**: 物件リストのキャッシュを管理するサービス（`frontend/frontend/src/store/pageDataCache.ts`）
- **propertyConfirmationUpdated**: サイドバー更新のためのカスタムイベント
- **syncConfirmationToSpreadsheet**: `backend/src/services/PropertyListingSpreadsheetSync.ts`のスプレッドシート同期メソッド

## Bug Details

### Bug Condition

「事務へCHAT」ボタンを押した時、フロントエンドのローカルstate（`confirmation`）のみが「未」に更新され、以下の処理が実行されない：

1. `pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS)` - 物件リストキャッシュのクリア
2. `sessionStorage.setItem('propertyListingsNeedsRefresh', 'true')` - 再取得フラグの設定
3. `window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', ...))` - サイドバー更新イベントの発火

また、バックエンドでスプレッドシート同期が失敗している可能性がある。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, propertyNumber: string }
  OUTPUT: boolean
  
  RETURN input.action == 'send-chat-to-office'
         AND confirmationFieldUpdatedInDB(input.propertyNumber)
         AND NOT cacheCleared(input.propertyNumber)
         AND NOT eventFired(input.propertyNumber)
         AND NOT spreadsheetSynced(input.propertyNumber)
END FUNCTION
```

### Examples

- **例1**: ユーザーが物件BB1234の詳細画面で「事務へCHAT」ボタンを押す → チャットが送信され、DBの確認フィールドが「未」に更新される → 物件リストページに戻る → サイドバーカテゴリーが「未完了」に表示されない（古いキャッシュが使用される）
- **例2**: ユーザーが物件BB1234の詳細画面で「事務へCHAT」ボタンを押す → チャットが送信され、DBの確認フィールドが「未」に更新される → スプレッドシートのDQ列は空欄のまま → 10分後の自動同期でスプレッドシートの空欄がDBに同期され、確認フィールドが空欄に上書きされる
- **例3**: ユーザーが物件BB1234の詳細画面で確認フィールドを手動で「未」に変更する → キャッシュがクリアされ、イベントが発火され、スプレッドシートに同期される → 物件リストページに戻る → サイドバーカテゴリーが「未完了」に即座に表示される（正常動作）
- **エッジケース**: ユーザーが「事務へCHAT」ボタンを連続で2回押す → 2回目のチャット送信時も同じ処理が実行される（冪等性が保証される）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 手動で確認フィールドを「未」または「済」に変更した時の既存動作（`handleUpdateConfirmation`メソッド）が継続して正しく動作する
- サイドバーステータス計算ロジック（`calculateSidebarStatus`メソッド）で確認フィールドが「未」の場合に「未完了」ステータスが返される動作が継続する
- チャットメッセージが営業担当または事務チャットに正しく送信される動作が継続する

**Scope:**
「事務へCHAT」送信以外の操作（手動での確認フィールド変更、物件リスト表示、サイドバー表示）は完全に影響を受けない。これには以下が含まれる：
- 手動での確認フィールド変更（`handleUpdateConfirmation`メソッド）
- 物件リストページの表示とフィルタリング
- サイドバーカテゴリーの表示と集計

## Hypothesized Root Cause

バグ説明に基づき、最も可能性の高い原因は以下の通り：

1. **フロントエンドのキャッシュクリアとイベント発火が欠落**
   - `handleSendChatToOffice`メソッドでは`setConfirmation('未')`のみが実行される
   - `handleUpdateConfirmation`メソッドで実行されている以下の処理が欠落している：
     - `pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS)`
     - `sessionStorage.setItem('propertyListingsNeedsRefresh', 'true')`
     - `window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', ...))`

2. **スプレッドシート同期の失敗**
   - `PropertyListingSpreadsheetSync.syncConfirmationToSpreadsheet`メソッドが失敗している可能性
   - エラーがcatchされてログに出力されるが、フロントエンドには通知されない
   - 同期失敗の原因：
     - GoogleSheetsClientの認証エラー
     - DQ列（列番号120）の範囲指定エラー
     - スプレッドシートのアクセス権限エラー

3. **自動同期による上書き**
   - 10分後の自動同期（`PropertyListingSyncService.syncUpdatedPropertyListings`）でスプレッドシートの空欄（未同期）がDBに同期される
   - スプレッドシート→DB方向の同期が確認フィールドを上書きしている

## Correctness Properties

Property 1: Bug Condition - 事務へCHAT送信時のサイドバー即時更新

_For any_ 「事務へCHAT」ボタンを押した時、確認フィールドが「未」に更新され、物件リストのキャッシュがクリアされ、sessionStorageフラグが設定され、サイドバー更新イベントが発火され、スプレッドシートのDQ列に「未」が同期される。その結果、物件リストページに戻った時にサイドバーカテゴリーが即座に「未完了」として表示される。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - 手動変更時の既存動作維持

_For any_ 確認フィールドを手動で「未」または「済」に変更した時、既存の`handleUpdateConfirmation`メソッドの動作（キャッシュクリア、sessionStorageフラグ設定、カスタムイベント発火、スプレッドシート同期）が継続して正しく動作し、サイドバーカテゴリーが即座に更新される。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**Function**: `handleSendChatToOffice`

**Specific Changes**:
1. **キャッシュクリアの追加**: `pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS)`を追加
   - 物件リストのキャッシュをクリアして、次回表示時に最新データを取得する

2. **sessionStorageフラグの設定**: `sessionStorage.setItem('propertyListingsNeedsRefresh', 'true')`を追加
   - 物件リストページに戻った時に再取得を強制する

3. **カスタムイベントの発火**: `window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', { detail: { propertyNumber, confirmation: '未' } }))`を追加
   - サイドバーコンポーネントに確認フィールドの変更を通知する

4. **ログ出力の追加**: `console.log('[PropertyListingDetailPage] イベント発火:', { propertyNumber, confirmation: '未' })`を追加
   - デバッグ用のログを出力する

5. **エラーハンドリングの改善**: スプレッドシート同期エラーをフロントエンドに通知する（オプション）
   - バックエンドから同期エラーが返された場合、警告メッセージを表示する

**File**: `backend/src/services/PropertyListingSpreadsheetSync.ts`

**Function**: `syncConfirmationToSpreadsheet`

**Specific Changes**:
1. **エラーログの詳細化**: 同期失敗時のエラーメッセージを詳細化
   - GoogleSheetsClientの認証エラー、範囲指定エラー、アクセス権限エラーを区別する

2. **リトライロジックの追加**: 同期失敗時に最大3回リトライする（オプション）
   - 一時的なネットワークエラーやAPI制限エラーに対応する

3. **同期結果の返却**: 同期成功/失敗をレスポンスに含める（オプション）
   - フロントエンドに同期結果を通知する

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従う：まず、修正前のコードでバグを再現する反例を表面化させ、次に修正後のコードで正しく動作することを検証し、既存の動作が保持されることを確認する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現する反例を表面化させる。根本原因分析を確認または反証する。反証された場合は、再度仮説を立てる。

**Test Plan**: 「事務へCHAT」送信時にキャッシュクリア、sessionStorageフラグ設定、カスタムイベント発火が実行されないことを確認するテストを作成する。修正前のコードで実行してテスト失敗を観察し、根本原因を理解する。

**Test Cases**:
1. **キャッシュクリアテスト**: 「事務へCHAT」送信後、`pageDataCache.get(CACHE_KEYS.PROPERTY_LISTINGS)`がnullを返すことを確認（修正前のコードでは失敗）
2. **sessionStorageフラグテスト**: 「事務へCHAT」送信後、`sessionStorage.getItem('propertyListingsNeedsRefresh')`が'true'を返すことを確認（修正前のコードでは失敗）
3. **カスタムイベント発火テスト**: 「事務へCHAT」送信後、`propertyConfirmationUpdated`イベントが発火されることを確認（修正前のコードでは失敗）
4. **スプレッドシート同期テスト**: 「事務へCHAT」送信後、スプレッドシートのDQ列に「未」が同期されることを確認（修正前のコードでは失敗する可能性）

**Expected Counterexamples**:
- キャッシュがクリアされず、古いデータが残る
- sessionStorageフラグが設定されず、物件リストページで再取得が実行されない
- カスタムイベントが発火されず、サイドバーが更新されない
- スプレッドシート同期が失敗し、DQ列が空欄のまま

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して、期待される動作が実行されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleSendChatToOffice_fixed(input)
  ASSERT cacheCleared(input.propertyNumber)
  ASSERT sessionStorageFlagSet(input.propertyNumber)
  ASSERT eventFired(input.propertyNumber)
  ASSERT spreadsheetSynced(input.propertyNumber)
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない全ての入力に対して、修正前のコードと同じ結果が返されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleUpdateConfirmation_original(input) = handleUpdateConfirmation_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは保存チェックに推奨される。理由：
- 入力ドメイン全体で多くのテストケースを自動生成する
- 手動のユニットテストでは見逃す可能性のあるエッジケースを捕捉する
- バグ条件が成立しない全ての入力に対して、動作が変更されていないことを強力に保証する

**Test Plan**: 修正前のコードで手動での確認フィールド変更の動作を観察し、その動作を捕捉するproperty-based testを作成する。

**Test Cases**:
1. **手動変更の保存テスト**: 確認フィールドを手動で「未」または「済」に変更した時、キャッシュクリア、sessionStorageフラグ設定、カスタムイベント発火が実行されることを確認
2. **サイドバー表示の保存テスト**: 確認フィールドが「未」の物件がサイドバーカテゴリーに「未完了」として表示されることを確認
3. **物件リスト表示の保存テスト**: 確認フィールドが「済」の物件がサイドバーカテゴリーに表示されないことを確認

### Unit Tests

- 「事務へCHAT」送信時にキャッシュクリア、sessionStorageフラグ設定、カスタムイベント発火が実行されることをテスト
- 手動での確認フィールド変更時に既存動作が維持されることをテスト
- スプレッドシート同期が成功することをテスト（モックを使用）

### Property-Based Tests

- ランダムな物件番号と確認値を生成し、「事務へCHAT」送信後にサイドバーが正しく更新されることを検証
- ランダムな物件番号と確認値を生成し、手動変更後にサイドバーが正しく更新されることを検証
- 多くのシナリオで既存動作が維持されることをテスト

### Integration Tests

- 「事務へCHAT」送信から物件リストページ表示までの完全なフローをテスト
- 手動での確認フィールド変更から物件リストページ表示までの完全なフローをテスト
- スプレッドシート同期が正しく動作し、10分後の自動同期で上書きされないことをテスト
